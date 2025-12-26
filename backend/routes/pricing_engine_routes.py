"""
Aviation-Grade Helicopter Pricing API Routes
Complete pricing configuration and calculation endpoints
"""

from fastapi import APIRouter, HTTPException, Depends
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
from uuid import uuid4
import logging

from database import get_database
from middleware import get_current_user, require_roles
from models import UserRole
from models.pricing_models import (
    PricingType, BookingPurpose, DeadLegRateType, CommissionType,
    OperatorBasePricing, DeadLegPricing, AdditionalCharges,
    AdminPricingControls, RoutePricing, CorporateContract,
    PriceCalculationRequest, PriceCalculationResponse
)
from services.pricing_engine import pricing_engine, haversine_distance, estimate_flight_hours

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/pricing-engine", tags=["Pricing Engine"])


# ==================== PUBLIC ENDPOINTS ====================

@router.post("/calculate")
async def calculate_price(request: PriceCalculationRequest):
    """
    Calculate complete price with all aviation factors
    Returns detailed breakdown for customer, operator, and admin views
    """
    try:
        response = await pricing_engine.calculate_price(request)
        return response.dict()
    except Exception as e:
        logger.error(f"Price calculation error: {e}")
        raise HTTPException(status_code=500, detail=f"Price calculation failed: {str(e)}")


@router.post("/quick-estimate")
async def quick_estimate(
    pickup_lat: float,
    pickup_lon: float,
    drop_lat: float,
    drop_lon: float,
    departure_date: str,
    purpose: str = "personal"
):
    """Quick price estimate without full details"""
    
    distance_km = haversine_distance(pickup_lat, pickup_lon, drop_lat, drop_lon)
    flight_hours = estimate_flight_hours(distance_km)
    
    request = PriceCalculationRequest(
        pickup_city="Origin",
        pickup_latitude=pickup_lat,
        pickup_longitude=pickup_lon,
        drop_city="Destination",
        drop_latitude=drop_lat,
        drop_longitude=drop_lon,
        distance_km=round(distance_km, 2),
        departure_date=departure_date,
        departure_time="10:00",
        estimated_flight_hours=flight_hours,
        booking_purpose=BookingPurpose(purpose) if purpose in [e.value for e in BookingPurpose] else BookingPurpose.PERSONAL
    )
    
    response = await pricing_engine.calculate_price(request)
    
    return {
        "distance_km": round(distance_km, 2),
        "estimated_hours": flight_hours,
        "estimated_price": response.price_breakdown.final_customer_price,
        "breakdown": response.customer_view
    }


@router.get("/config/public")
async def get_public_pricing_config():
    """Get public pricing configuration for price calculator"""
    admin_controls = await pricing_engine.get_admin_controls()
    
    return {
        "gst_percent": admin_controls.get("gst_percent", 18),
        "cgst_percent": admin_controls.get("cgst_percent", 9),
        "sgst_percent": admin_controls.get("sgst_percent", 9),
        "convenience_fee_percent": admin_controls.get("convenience_fee_percent", 5),
        "insurance_percent": admin_controls.get("insurance_percent", 2),
        "insurance_enabled": admin_controls.get("insurance_enabled", True),
        "peak_season_enabled": admin_controls.get("peak_season_enabled", True),
        "purpose_options": [e.value for e in BookingPurpose],
        "pricing_types": [e.value for e in PricingType]
    }


# ==================== OPERATOR ENDPOINTS ====================

@router.get("/operator/my-pricing")
async def get_operator_pricing(user: dict = Depends(get_current_user)):
    """Get operator's pricing configuration"""
    if "operator" not in user.get("roles", []):
        raise HTTPException(status_code=403, detail="Operator access required")
    
    db = get_database()
    
    # Get operator profile
    operator = await db.operators.find_one({"user_id": user["id"]}, {"_id": 0})
    if not operator:
        raise HTTPException(status_code=404, detail="Operator profile not found")
    
    operator_id = operator["id"]
    
    # Get all pricing configs
    base_pricing = await db.operator_pricing.find(
        {"operator_id": operator_id}, {"_id": 0}
    ).to_list(100)
    
    dead_leg = await db.dead_leg_pricing.find_one(
        {"operator_id": operator_id}, {"_id": 0}
    )
    
    additional = await db.additional_charges.find_one(
        {"operator_id": operator_id}, {"_id": 0}
    )
    
    return {
        "operator_id": operator_id,
        "base_pricing": base_pricing,
        "dead_leg_config": dead_leg or {},
        "additional_charges": additional or {},
        "default_multipliers": {
            "personal": 1.0, "business": 1.0, "wedding": 1.3,
            "medical": 0.9, "pilgrimage": 1.1, "election": 1.5,
            "corporate": 1.2, "vip": 1.4
        }
    }


@router.post("/operator/base-pricing")
async def set_operator_base_pricing(
    pricing: OperatorBasePricing,
    user: dict = Depends(get_current_user)
):
    """Set operator's base pricing for a helicopter"""
    if "operator" not in user.get("roles", []):
        raise HTTPException(status_code=403, detail="Operator access required")
    
    db = get_database()
    
    operator = await db.operators.find_one({"user_id": user["id"]}, {"_id": 0, "id": 1})
    if not operator:
        raise HTTPException(status_code=404, detail="Operator profile not found")
    
    pricing.operator_id = operator["id"]
    pricing.id = pricing.id or str(uuid4())
    pricing.created_at = pricing.created_at or datetime.now(timezone.utc).isoformat()
    pricing.updated_at = datetime.now(timezone.utc).isoformat()
    
    # Upsert
    await db.operator_pricing.update_one(
        {"operator_id": pricing.operator_id, "helicopter_id": pricing.helicopter_id},
        {"$set": pricing.dict()},
        upsert=True
    )
    
    return {"message": "Base pricing saved", "pricing_id": pricing.id}


@router.post("/operator/dead-leg-config")
async def set_dead_leg_config(
    config: DeadLegPricing,
    user: dict = Depends(get_current_user)
):
    """Configure dead-leg/positioning pricing"""
    if "operator" not in user.get("roles", []):
        raise HTTPException(status_code=403, detail="Operator access required")
    
    db = get_database()
    
    operator = await db.operators.find_one({"user_id": user["id"]}, {"_id": 0, "id": 1})
    if not operator:
        raise HTTPException(status_code=404, detail="Operator profile not found")
    
    config.operator_id = operator["id"]
    config.id = config.id or str(uuid4())
    config.created_at = config.created_at or datetime.now(timezone.utc).isoformat()
    config.updated_at = datetime.now(timezone.utc).isoformat()
    
    await db.dead_leg_pricing.update_one(
        {"operator_id": config.operator_id},
        {"$set": config.dict()},
        upsert=True
    )
    
    return {"message": "Dead-leg configuration saved"}


@router.post("/operator/additional-charges")
async def set_additional_charges(
    charges: AdditionalCharges,
    user: dict = Depends(get_current_user)
):
    """Configure additional charges (waiting, night halt, etc.)"""
    if "operator" not in user.get("roles", []):
        raise HTTPException(status_code=403, detail="Operator access required")
    
    db = get_database()
    
    operator = await db.operators.find_one({"user_id": user["id"]}, {"_id": 0, "id": 1})
    if not operator:
        raise HTTPException(status_code=404, detail="Operator profile not found")
    
    charges.operator_id = operator["id"]
    charges.id = charges.id or str(uuid4())
    charges.created_at = charges.created_at or datetime.now(timezone.utc).isoformat()
    charges.updated_at = datetime.now(timezone.utc).isoformat()
    
    await db.additional_charges.update_one(
        {"operator_id": charges.operator_id},
        {"$set": charges.dict()},
        upsert=True
    )
    
    return {"message": "Additional charges saved"}


# ==================== ADMIN ENDPOINTS ====================

@router.get("/admin/controls")
async def get_admin_controls(
    user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.FINANCE]))
):
    """Get admin pricing controls"""
    controls = await pricing_engine.get_admin_controls()
    return controls


@router.post("/admin/controls")
async def set_admin_controls(
    controls: AdminPricingControls,
    user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN]))
):
    """Set admin pricing controls (operators cannot edit)"""
    db = get_database()
    
    controls.id = controls.id or str(uuid4())
    controls.created_at = controls.created_at or datetime.now(timezone.utc).isoformat()
    controls.updated_at = datetime.now(timezone.utc).isoformat()
    
    # Store with is_active flag
    data = controls.dict()
    data["is_active"] = True
    
    # Deactivate old controls
    await db.admin_pricing_controls.update_many(
        {"is_active": True},
        {"$set": {"is_active": False}}
    )
    
    await db.admin_pricing_controls.insert_one(data)
    
    # Log the change
    await db.pricing_audit_logs.insert_one({
        "action": "admin_controls_updated",
        "user_id": user["id"],
        "user_email": user.get("email"),
        "changes": data,
        "timestamp": datetime.now(timezone.utc).isoformat()
    })
    
    return {"message": "Admin controls saved", "id": controls.id}


@router.post("/admin/commission-override")
async def set_commission_override(
    override_type: str,  # by_operator, by_purpose, by_route, by_helicopter_model
    key: str,
    commission_percent: float,
    user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN]))
):
    """Set commission override for specific operator/purpose/route"""
    if override_type not in ["by_operator", "by_purpose", "by_route", "by_helicopter_model"]:
        raise HTTPException(status_code=400, detail="Invalid override type")
    
    db = get_database()
    
    await db.admin_pricing_controls.update_one(
        {"is_active": True},
        {"$set": {f"commission_overrides.{override_type}.{key}": commission_percent}}
    )
    
    # Log
    await db.pricing_audit_logs.insert_one({
        "action": "commission_override_set",
        "user_id": user["id"],
        "override_type": override_type,
        "key": key,
        "commission_percent": commission_percent,
        "timestamp": datetime.now(timezone.utc).isoformat()
    })
    
    return {"message": f"Commission override set: {override_type}.{key} = {commission_percent}%"}


@router.post("/admin/peak-dates")
async def set_peak_dates(
    peak_dates: List[Dict],
    user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN]))
):
    """Set peak season dates with multipliers"""
    db = get_database()
    
    await db.admin_pricing_controls.update_one(
        {"is_active": True},
        {"$set": {"peak_dates": peak_dates}}
    )
    
    return {"message": f"Peak dates updated: {len(peak_dates)} periods"}


@router.post("/admin/route-pricing")
async def set_route_pricing(
    route: RoutePricing,
    user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN]))
):
    """Define route-based pricing"""
    db = get_database()
    
    route.id = route.id or str(uuid4())
    route.created_at = route.created_at or datetime.now(timezone.utc).isoformat()
    route.updated_at = datetime.now(timezone.utc).isoformat()
    
    await db.route_pricing.update_one(
        {"route_from": route.route_from, "route_to": route.route_to},
        {"$set": route.dict()},
        upsert=True
    )
    
    return {"message": f"Route pricing set: {route.route_from} → {route.route_to} = ₹{route.base_price}"}


@router.get("/admin/routes")
async def get_all_routes(
    user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.FINANCE]))
):
    """Get all route-based pricing"""
    db = get_database()
    routes = await db.route_pricing.find({"is_active": True}, {"_id": 0}).to_list(100)
    return {"routes": routes}


@router.post("/admin/corporate-contract")
async def create_corporate_contract(
    contract: CorporateContract,
    user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN]))
):
    """Create corporate/government contract pricing"""
    db = get_database()
    
    contract.id = contract.id or str(uuid4())
    contract.created_at = contract.created_at or datetime.now(timezone.utc).isoformat()
    
    await db.corporate_contracts.insert_one(contract.dict())
    
    return {"message": "Corporate contract created", "contract_id": contract.contract_id}


@router.get("/admin/contracts")
async def get_contracts(
    user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.FINANCE]))
):
    """Get all corporate contracts"""
    db = get_database()
    contracts = await db.corporate_contracts.find({"is_active": True}, {"_id": 0}).to_list(100)
    return {"contracts": contracts}


@router.get("/admin/audit-logs")
async def get_pricing_audit_logs(
    limit: int = 100,
    user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN]))
):
    """Get pricing audit logs"""
    db = get_database()
    logs = await db.pricing_audit_logs.find(
        {}, {"_id": 0}
    ).sort("timestamp", -1).limit(limit).to_list(limit)
    return {"logs": logs}


@router.get("/admin/calculations")
async def get_price_calculations(
    limit: int = 50,
    user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.FINANCE]))
):
    """Get recent price calculations for audit"""
    db = get_database()
    calculations = await db.price_calculations.find(
        {}, {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    return {"calculations": calculations}


# ==================== CANCELLATION ENDPOINTS ====================

@router.get("/cancellation-charges")
async def get_cancellation_charges(
    booking_date: str,
    booking_amount: float
):
    """Calculate cancellation charges based on time"""
    admin_controls = await pricing_engine.get_admin_controls()
    
    try:
        booking_dt = datetime.strptime(booking_date, "%Y-%m-%d %H:%M")
    except:
        booking_dt = datetime.strptime(booking_date, "%Y-%m-%d")
    
    now = datetime.now()
    hours_until_booking = (booking_dt - now).total_seconds() / 3600
    
    slabs = admin_controls.get("cancellation_slabs", [])
    
    applicable_slab = None
    for slab in sorted(slabs, key=lambda x: x["hours_before"], reverse=True):
        if hours_until_booking >= slab["hours_before"]:
            applicable_slab = slab
            break
    
    if not applicable_slab:
        applicable_slab = slabs[-1] if slabs else {"charge_percent": 100, "label": "Same day"}
    
    cancellation_charge = booking_amount * (applicable_slab["charge_percent"] / 100)
    refund_amount = booking_amount - cancellation_charge
    
    return {
        "hours_until_booking": round(hours_until_booking, 1),
        "applicable_slab": applicable_slab.get("label", ""),
        "charge_percent": applicable_slab["charge_percent"],
        "cancellation_charge": round(cancellation_charge),
        "refund_amount": round(refund_amount)
    }
