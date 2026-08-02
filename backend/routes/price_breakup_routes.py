"""
Price Breakup & Price Lock System - AirYatra Smart Pricing

Features:
1. Transparent Price Breakup for Customers
   - Base Fare, Landing Charges, Operational Costs, Platform Fee, GST
   
2. Operator Settlement View
   - Quote Amount, Commission, Platform Fee, Net Payout
   
3. Price Lock Timer (15 minutes)
   - Price guaranteed during lock period
   - Auto-expire if payment not completed
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, timedelta, timezone
import uuid

from database import get_database
from middleware import get_current_user, require_roles

router = APIRouter(prefix="/pricing", tags=["Price Breakup & Lock"])


# ============ MODELS ============

class PriceBreakdownRequest(BaseModel):
    """Request for price breakdown"""
    base_price: float
    landing_charges: float = 0
    handling_charges: float = 0
    crew_charges: float = 0
    fuel_surcharge: float = 0
    other_charges: float = 0
    discount: float = 0


class PriceLockRequest(BaseModel):
    """Request to lock a price"""
    quote_id: Optional[str] = None
    auction_id: Optional[str] = None
    booking_id: Optional[str] = None
    base_price: float
    landing_charges: float = 0
    handling_charges: float = 0
    crew_charges: float = 0
    fuel_surcharge: float = 0
    other_charges: float = 0
    discount: float = 0
    lock_duration_minutes: int = Field(default=15, ge=5, le=30)


# ============ CONSTANTS ============

# Platform fees (configurable by admin)
DEFAULT_PLATFORM_SETTINGS = {
    "platform_commission_percent": 10.0,  # 10% of base fare
    "platform_fixed_fee": 500,  # ₹500 fixed fee
    "gst_rate": 18.0,  # 18% GST
    "tds_rate": 2.0,  # 2% TDS on operator payout
    "price_lock_duration_minutes": 15,
    "price_lock_max_minutes": 30
}


# ============ HELPER FUNCTIONS ============

async def get_platform_settings():
    """Get platform pricing settings from DB or defaults"""
    db = get_database()
    settings = await db.platform_settings.find_one({"type": "pricing"}, {"_id": 0})
    if settings:
        return {**DEFAULT_PLATFORM_SETTINGS, **settings}
    return DEFAULT_PLATFORM_SETTINGS


def calculate_customer_breakup(
    base_price: float,
    landing_charges: float,
    handling_charges: float,
    crew_charges: float,
    fuel_surcharge: float,
    other_charges: float,
    discount: float,
    settings: dict
) -> dict:
    """
    Calculate detailed price breakdown for customer view
    """
    # Base components
    subtotal = base_price + landing_charges + handling_charges + crew_charges + fuel_surcharge + other_charges
    
    # Platform fee (commission on base + fixed fee)
    platform_commission = round(base_price * (settings["platform_commission_percent"] / 100), 2)
    platform_fixed_fee = settings["platform_fixed_fee"]
    total_platform_fee = platform_commission + platform_fixed_fee
    
    # Apply discount
    discounted_subtotal = subtotal - discount
    
    # GST on total (subtotal + platform fee)
    taxable_amount = discounted_subtotal + total_platform_fee
    gst_amount = round(taxable_amount * (settings["gst_rate"] / 100), 2)
    
    # Final total
    grand_total = round(taxable_amount + gst_amount, 2)
    
    return {
        "breakdown": {
            "base_fare": {
                "label": "Base Fare / आधार किराया",
                "amount": base_price,
                "description": "Aircraft charter base price"
            },
            "landing_charges": {
                "label": "Landing Charges / लैंडिंग शुल्क",
                "amount": landing_charges,
                "description": "Airport/helipad landing fees"
            },
            "handling_charges": {
                "label": "Handling Charges / हैंडलिंग शुल्क",
                "amount": handling_charges,
                "description": "Ground handling and parking"
            },
            "crew_charges": {
                "label": "Crew Charges / क्रू शुल्क",
                "amount": crew_charges,
                "description": "Pilot and crew costs"
            },
            "fuel_surcharge": {
                "label": "Fuel Surcharge / ईंधन अधिभार",
                "amount": fuel_surcharge,
                "description": "Fuel cost adjustment"
            },
            "other_charges": {
                "label": "Other Charges / अन्य शुल्क",
                "amount": other_charges,
                "description": "Miscellaneous charges"
            }
        },
        "subtotal": subtotal,
        "discount": {
            "label": "Discount / छूट",
            "amount": discount,
            "description": "Applied discount"
        },
        "discounted_subtotal": discounted_subtotal,
        "platform_fee": {
            "label": "AirYatra Platform Fee / प्लेटफ़ॉर्म शुल्क",
            "amount": total_platform_fee,
            "commission": platform_commission,
            "fixed_fee": platform_fixed_fee,
            "description": "Platform service charge"
        },
        "taxable_amount": taxable_amount,
        "gst": {
            "label": f"GST ({settings['gst_rate']}%)",
            "amount": gst_amount,
            "rate": settings["gst_rate"],
            "description": "Goods and Services Tax"
        },
        "grand_total": grand_total,
        "currency": "INR",
        "formatted_total": f"₹ {grand_total:,.2f}"
    }


def calculate_operator_settlement(
    base_price: float,
    landing_charges: float,
    handling_charges: float,
    crew_charges: float,
    fuel_surcharge: float,
    other_charges: float,
    discount: float,
    settings: dict
) -> dict:
    """
    Calculate operator settlement/payout breakdown
    """
    # Total quote amount (what operator quoted)
    subtotal = base_price + landing_charges + handling_charges + crew_charges + fuel_surcharge + other_charges
    quote_after_discount = subtotal - discount
    
    # Platform deductions
    platform_commission = round(base_price * (settings["platform_commission_percent"] / 100), 2)
    platform_fixed_fee = settings["platform_fixed_fee"]
    total_platform_deduction = platform_commission + platform_fixed_fee
    
    # TDS (Tax Deducted at Source)
    tds_amount = round(quote_after_discount * (settings["tds_rate"] / 100), 2)
    
    # Net payout to operator
    net_payout = round(quote_after_discount - total_platform_deduction - tds_amount, 2)
    
    return {
        "quote_summary": {
            "base_price": base_price,
            "additional_charges": landing_charges + handling_charges + crew_charges + fuel_surcharge + other_charges,
            "discount_given": discount,
            "total_quote": quote_after_discount
        },
        "deductions": {
            "platform_commission": {
                "label": f"AirYatra Commission ({settings['platform_commission_percent']}%)",
                "amount": platform_commission,
                "rate": settings["platform_commission_percent"],
                "calculated_on": "Base fare"
            },
            "platform_fixed_fee": {
                "label": "Platform Fee / प्लेटफ़ॉर्म शुल्क",
                "amount": platform_fixed_fee
            },
            "tds": {
                "label": f"TDS ({settings['tds_rate']}%)",
                "amount": tds_amount,
                "rate": settings["tds_rate"],
                "description": "Tax Deducted at Source"
            },
            "total_deductions": total_platform_deduction + tds_amount
        },
        "net_payout": {
            "label": "Net Payout / शुद्ध भुगतान",
            "amount": net_payout,
            "formatted": f"₹ {net_payout:,.2f}"
        },
        "settlement_info": {
            "expected_days": "T+3 working days",
            "payment_method": "Bank Transfer (NEFT/RTGS)",
            "description": "Settlement will be processed after successful flight completion"
        },
        "currency": "INR"
    }


# ============ CUSTOMER ENDPOINTS ============

@router.post("/customer/breakup")
async def get_customer_price_breakup(
    request: PriceBreakdownRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Get transparent price breakdown for customer
    """
    settings = await get_platform_settings()
    
    breakup = calculate_customer_breakup(
        base_price=request.base_price,
        landing_charges=request.landing_charges,
        handling_charges=request.handling_charges,
        crew_charges=request.crew_charges,
        fuel_surcharge=request.fuel_surcharge,
        other_charges=request.other_charges,
        discount=request.discount,
        settings=settings
    )
    
    return breakup


@router.get("/customer/quote/{quote_id}/breakup")
async def get_quote_breakup_for_customer(
    quote_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Get price breakdown for a specific auction quote
    """
    db = get_database()
    settings = await get_platform_settings()
    
    # Get quote
    quote = await db.auction_quotes.find_one({"id": quote_id}, {"_id": 0})
    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found")
    
    # Get auction to verify customer access
    auction = await db.auctions.find_one({"id": quote["auction_id"]})
    if auction["customer_id"] != current_user["id"] and "admin" not in current_user.get("roles", []):
        raise HTTPException(status_code=403, detail="Access denied")
    
    breakup = calculate_customer_breakup(
        base_price=quote.get("base_price", 0),
        landing_charges=quote.get("landing_charges", 0),
        handling_charges=quote.get("handling_charges", 0),
        crew_charges=quote.get("crew_charges", 0),
        fuel_surcharge=quote.get("fuel_surcharge", 0),
        other_charges=quote.get("other_charges", 0),
        discount=quote.get("discount", 0),
        settings=settings
    )
    
    breakup["quote_info"] = {
        "quote_id": quote_id,
        "operator_name": quote.get("operator_name"),
        "aircraft_model": quote.get("aircraft_model"),
        "estimated_flight_time": quote.get("estimated_flight_time")
    }
    
    return breakup


# ============ OPERATOR ENDPOINTS ============

@router.post("/operator/settlement-preview")
async def get_operator_settlement_preview(
    request: PriceBreakdownRequest,
    current_user: dict = Depends(require_roles(["operator"]))
):
    """
    Operator previews their settlement/payout for a quote
    """
    settings = await get_platform_settings()
    
    settlement = calculate_operator_settlement(
        base_price=request.base_price,
        landing_charges=request.landing_charges,
        handling_charges=request.handling_charges,
        crew_charges=request.crew_charges,
        fuel_surcharge=request.fuel_surcharge,
        other_charges=request.other_charges,
        discount=request.discount,
        settings=settings
    )
    
    return settlement


@router.get("/operator/quote/{quote_id}/settlement")
async def get_quote_settlement_for_operator(
    quote_id: str,
    current_user: dict = Depends(require_roles(["operator"]))
):
    """
    Get settlement breakdown for operator's own quote
    """
    db = get_database()
    settings = await get_platform_settings()
    
    quote = await db.auction_quotes.find_one({"id": quote_id}, {"_id": 0})
    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found")
    
    if quote["operator_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="You can only view your own quotes")
    
    settlement = calculate_operator_settlement(
        base_price=quote.get("base_price", 0),
        landing_charges=quote.get("landing_charges", 0),
        handling_charges=quote.get("handling_charges", 0),
        crew_charges=quote.get("crew_charges", 0),
        fuel_surcharge=quote.get("fuel_surcharge", 0),
        other_charges=quote.get("other_charges", 0),
        discount=quote.get("discount", 0),
        settings=settings
    )
    
    settlement["quote_info"] = {
        "quote_id": quote_id,
        "status": quote.get("status"),
        "created_at": quote.get("created_at")
    }
    
    return settlement


# ============ PRICE LOCK ENDPOINTS ============

@router.post("/lock")
async def create_price_lock(
    request: PriceLockRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Lock a price for checkout (15-minute default)
    """
    db = get_database()
    settings = await get_platform_settings()
    
    # Calculate full breakup
    breakup = calculate_customer_breakup(
        base_price=request.base_price,
        landing_charges=request.landing_charges,
        handling_charges=request.handling_charges,
        crew_charges=request.crew_charges,
        fuel_surcharge=request.fuel_surcharge,
        other_charges=request.other_charges,
        discount=request.discount,
        settings=settings
    )
    
    now = datetime.now(timezone.utc)
    lock_duration = min(request.lock_duration_minutes, settings["price_lock_max_minutes"])
    expires_at = now + timedelta(minutes=lock_duration)
    
    # Create price lock
    price_lock = {
        "id": str(uuid.uuid4()),
        "user_id": current_user["id"],
        "quote_id": request.quote_id,
        "auction_id": request.auction_id,
        "booking_id": request.booking_id,
        
        # Locked pricing
        "locked_price": {
            "base_price": request.base_price,
            "landing_charges": request.landing_charges,
            "handling_charges": request.handling_charges,
            "crew_charges": request.crew_charges,
            "fuel_surcharge": request.fuel_surcharge,
            "other_charges": request.other_charges,
            "discount": request.discount,
            "platform_fee": breakup["platform_fee"]["amount"],
            "gst": breakup["gst"]["amount"],
            "grand_total": breakup["grand_total"]
        },
        
        # Lock timing
        "created_at": now.isoformat(),
        "expires_at": expires_at.isoformat(),
        "duration_minutes": lock_duration,
        
        # Status
        "status": "active",  # active, used, expired
        "used_at": None,
        
        # Platform settings at time of lock
        "settings_snapshot": {
            "platform_commission_percent": settings["platform_commission_percent"],
            "platform_fixed_fee": settings["platform_fixed_fee"],
            "gst_rate": settings["gst_rate"]
        }
    }
    
    await db.price_locks.insert_one(price_lock)
    
    return {
        "success": True,
        "lock_id": price_lock["id"],
        "locked_total": breakup["grand_total"],
        "expires_at": expires_at.isoformat(),
        "duration_minutes": lock_duration,
        "message": f"Price locked for {lock_duration} minutes. Complete payment before expiry.",
        "timer": {
            "minutes": lock_duration,
            "seconds": 0,
            "formatted": f"{lock_duration}:00"
        }
    }


@router.get("/lock/{lock_id}")
async def get_price_lock(
    lock_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Get price lock details and remaining time
    """
    db = get_database()
    
    lock = await db.price_locks.find_one({"id": lock_id}, {"_id": 0})
    if not lock:
        raise HTTPException(status_code=404, detail="Price lock not found")
    
    if lock["user_id"] != current_user["id"] and "admin" not in current_user.get("roles", []):
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Calculate time remaining
    now = datetime.now(timezone.utc)
    expires_at = datetime.fromisoformat(lock["expires_at"].replace('Z', '+00:00'))
    
    if lock["status"] == "active":
        remaining = expires_at - now
        if remaining.total_seconds() <= 0:
            # Mark as expired
            await db.price_locks.update_one(
                {"id": lock_id},
                {"$set": {"status": "expired"}}
            )
            lock["status"] = "expired"
            lock["time_remaining"] = {"expired": True, "minutes": 0, "seconds": 0}
        else:
            minutes = int(remaining.total_seconds() // 60)
            seconds = int(remaining.total_seconds() % 60)
            lock["time_remaining"] = {
                "expired": False,
                "minutes": minutes,
                "seconds": seconds,
                "total_seconds": int(remaining.total_seconds()),
                "formatted": f"{minutes:02d}:{seconds:02d}"
            }
    else:
        lock["time_remaining"] = {"expired": True, "minutes": 0, "seconds": 0}
    
    return lock


@router.post("/lock/{lock_id}/use")
async def use_price_lock(
    lock_id: str,
    payment_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """
    Mark price lock as used (called after successful payment)
    """
    db = get_database()
    
    lock = await db.price_locks.find_one({"id": lock_id})
    if not lock:
        raise HTTPException(status_code=404, detail="Price lock not found")
    
    if lock["user_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    if lock["status"] != "active":
        raise HTTPException(status_code=400, detail=f"Price lock is {lock['status']}")
    
    # Check if expired
    now = datetime.now(timezone.utc)
    expires_at = datetime.fromisoformat(lock["expires_at"].replace('Z', '+00:00'))
    
    if now > expires_at:
        await db.price_locks.update_one(
            {"id": lock_id},
            {"$set": {"status": "expired"}}
        )
        raise HTTPException(status_code=400, detail="Price lock has expired")
    
    # Mark as used
    await db.price_locks.update_one(
        {"id": lock_id},
        {
            "$set": {
                "status": "used",
                "used_at": now.isoformat(),
                "payment_id": payment_id
            }
        }
    )
    
    return {
        "success": True,
        "message": "Price lock used successfully",
        "locked_total": lock["locked_price"]["grand_total"]
    }


@router.get("/lock/{lock_id}/validate")
async def validate_price_lock(
    lock_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Validate if price lock is still active and valid
    """
    db = get_database()
    
    lock = await db.price_locks.find_one({"id": lock_id}, {"_id": 0})
    if not lock:
        return {"valid": False, "reason": "Lock not found"}
    
    if lock["user_id"] != current_user["id"]:
        return {"valid": False, "reason": "Access denied"}
    
    if lock["status"] != "active":
        return {"valid": False, "reason": f"Lock is {lock['status']}"}
    
    # Check expiry
    now = datetime.now(timezone.utc)
    expires_at = datetime.fromisoformat(lock["expires_at"].replace('Z', '+00:00'))
    
    if now > expires_at:
        await db.price_locks.update_one(
            {"id": lock_id},
            {"$set": {"status": "expired"}}
        )
        return {"valid": False, "reason": "Lock has expired"}
    
    remaining = expires_at - now
    return {
        "valid": True,
        "locked_total": lock["locked_price"]["grand_total"],
        "seconds_remaining": int(remaining.total_seconds()),
        "expires_at": lock["expires_at"]
    }


# ============ ADMIN ENDPOINTS ============

@router.get("/admin/settings")
async def get_pricing_settings(
    current_user: dict = Depends(require_roles(["admin"]))
):
    """
    Admin: Get current platform pricing settings
    """
    settings = await get_platform_settings()
    return settings


@router.put("/admin/settings")
async def update_pricing_settings(
    platform_commission_percent: float = Query(ge=0, le=30),
    platform_fixed_fee: float = Query(ge=0),
    gst_rate: float = Query(default=18.0, ge=0, le=28),
    tds_rate: float = Query(default=2.0, ge=0, le=10),
    price_lock_duration_minutes: int = Query(default=15, ge=5, le=60),
    current_user: dict = Depends(require_roles(["admin"]))
):
    """
    Admin: Update platform pricing settings
    """
    db = get_database()
    
    settings = {
        "type": "pricing",
        "platform_commission_percent": platform_commission_percent,
        "platform_fixed_fee": platform_fixed_fee,
        "gst_rate": gst_rate,
        "tds_rate": tds_rate,
        "price_lock_duration_minutes": price_lock_duration_minutes,
        "price_lock_max_minutes": 30,
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "updated_by": current_user["id"]
    }
    
    await db.platform_settings.update_one(
        {"type": "pricing"},
        {"$set": settings},
        upsert=True
    )
    
    return {
        "success": True,
        "message": "Pricing settings updated",
        "settings": settings
    }
