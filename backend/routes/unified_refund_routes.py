"""
AirYatra Unified Refund Routes
Endpoints for refund preview, processing, and management across all payment gateways
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
from database import get_database
from middleware import get_current_user, require_roles
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/refunds", tags=["Refunds"])

from services.unified_refund_service import unified_refund_service, refund_calculator, CANCELLATION_RULES


# ==================== PYDANTIC MODELS ====================

class RefundPreviewRequest(BaseModel):
    booking_id: Optional[str] = None
    total_amount: Optional[float] = None
    departure_datetime: Optional[str] = None
    hours_before: Optional[float] = None

class RefundProcessRequest(BaseModel):
    booking_id: str
    confirm_terms: bool = False  # Must accept terms before refund
    custom_deduction_percent: Optional[float] = None  # Admin only
    admin_override: Optional[bool] = False  # Admin only - full refund
    refund_reason: Optional[str] = "Customer cancellation"


# ==================== PUBLIC ENDPOINTS ====================

@router.get("/policy")
async def get_refund_policy():
    """Get refund policy rules"""
    return {
        "success": True,
        "cancellation_rules": [
            {
                "time_window": rule["description"],
                "deduction_percent": rule["deduction_percent"],
                "refund_percent": 100 - rule["deduction_percent"]
            }
            for rule in CANCELLATION_RULES.values()
        ],
        "additional_fees": {
            "processing_fee_percent": 2.5,
            "admin_fee_inr": 500
        },
        "important_notes": [
            "Refund amount is calculated based on time remaining before departure",
            "Payment gateway processing fees are non-refundable",
            "Admin processing fee of ₹500 applies to all cancellations",
            "Refunds are processed within 5-7 business days",
            "For international payments (PayPal), refund will be in USD equivalent"
        ]
    }


@router.post("/preview")
async def preview_refund(
    data: RefundPreviewRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Preview refund amount before cancellation
    Shows breakdown of all deductions
    """
    db = get_database()
    
    total_amount = data.total_amount
    departure_datetime = None
    
    # Get booking details if booking_id provided
    if data.booking_id:
        booking = await db.bookings.find_one({"id": data.booking_id})
        if not booking:
            raise HTTPException(status_code=404, detail="Booking not found")
        
        total_amount = total_amount or booking.get("total_amount", 0)
        
        # Get departure datetime
        departure_str = booking.get("departure_datetime") or booking.get("date")
        if departure_str:
            try:
                departure_datetime = datetime.fromisoformat(departure_str.replace('Z', '+00:00'))
            except (ValueError, AttributeError):
                pass
    
    if not total_amount:
        raise HTTPException(status_code=400, detail="Amount required")
    
    # Parse provided datetime
    if data.departure_datetime and not departure_datetime:
        try:
            departure_datetime = datetime.fromisoformat(data.departure_datetime.replace('Z', '+00:00'))
        except (ValueError, AttributeError):
            pass
    
    # Calculate refund
    calculation = refund_calculator.calculate_refund(
        total_amount=total_amount,
        departure_datetime=departure_datetime,
        hours_before=data.hours_before
    )
    
    return {
        "success": True,
        "preview": calculation,
        "terms_link": "/api/legal-documents/public/refund_policy",
        "message": f"You will receive ₹{calculation['net_refund_amount']:,.2f} after deductions"
    }


@router.post("/process")
async def process_refund(
    data: RefundProcessRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Process refund for a booking
    Customer must accept terms before cancellation
    """
    db = get_database()
    
    # Check terms acceptance
    if not data.confirm_terms:
        raise HTTPException(
            status_code=400, 
            detail="You must accept the refund policy terms to proceed with cancellation"
        )
    
    # Get booking
    booking = await db.bookings.find_one({"id": data.booking_id})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    # Check if user owns this booking (unless admin)
    user_roles = current_user.get("roles", [])
    is_admin = "admin" in user_roles or "super_admin" in user_roles
    
    if not is_admin:
        if booking.get("customer_id") != current_user["id"] and booking.get("user_id") != current_user["id"]:
            raise HTTPException(status_code=403, detail="Not authorized to cancel this booking")
        
        # Non-admin cannot use override
        if data.admin_override or data.custom_deduction_percent is not None:
            raise HTTPException(status_code=403, detail="Admin privileges required for custom deductions")
    
    # Check booking status
    if booking.get("status") == "cancelled":
        raise HTTPException(status_code=400, detail="Booking already cancelled")
    
    if booking.get("payment_status") != "paid":
        raise HTTPException(status_code=400, detail="Cannot refund unpaid booking")
    
    # Determine payment gateway
    payment_gateway = booking.get("payment_method", "unknown")
    
    # Process refund
    result = await unified_refund_service.process_refund(
        db=db,
        booking_id=data.booking_id,
        payment_gateway=payment_gateway,
        custom_deduction_percent=data.custom_deduction_percent if is_admin else None,
        admin_override=data.admin_override if is_admin else False,
        refund_reason=data.refund_reason,
        requested_by=current_user["id"]
    )
    
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error", "Refund failed"))
    
    return {
        "success": True,
        "message": "Cancellation processed successfully",
        "refund_id": result.get("refund_id"),
        "refund_amount": result.get("calculation", {}).get("net_refund_amount"),
        "original_amount": result.get("calculation", {}).get("original_amount"),
        "deductions": result.get("calculation", {}).get("deductions"),
        "processing_note": "Refund will be credited within 5-7 business days"
    }


# ==================== ADMIN ENDPOINTS ====================

@router.get("/admin/list")
async def list_all_refunds(
    status: Optional[str] = None,
    payment_gateway: Optional[str] = None,
    limit: int = Query(50, le=200),
    current_user: dict = Depends(require_roles(["admin", "super_admin"]))
):
    """List all refunds (Admin)"""
    db = get_database()
    
    query = {}
    if status:
        query["gateway_status"] = status
    if payment_gateway:
        query["payment_gateway"] = payment_gateway
    
    refunds = await db.refunds.find(query, {"_id": 0}).sort("created_at", -1).to_list(limit)
    
    # Calculate totals
    total_refunded = sum(r.get("refund_amount", 0) for r in refunds)
    total_deductions = sum(r.get("total_deductions", 0) for r in refunds)
    
    # Stats by gateway
    gateway_stats = {}
    for r in refunds:
        gw = r.get("payment_gateway", "unknown")
        if gw not in gateway_stats:
            gateway_stats[gw] = {"count": 0, "total": 0}
        gateway_stats[gw]["count"] += 1
        gateway_stats[gw]["total"] += r.get("refund_amount", 0)
    
    return {
        "success": True,
        "refunds": refunds,
        "totals": {
            "count": len(refunds),
            "total_refunded": total_refunded,
            "total_deductions": total_deductions,
            "by_gateway": gateway_stats
        }
    }


@router.get("/admin/{refund_id}")
async def get_refund_details(
    refund_id: str,
    current_user: dict = Depends(require_roles(["admin", "super_admin"]))
):
    """Get refund details (Admin)"""
    db = get_database()
    
    refund = await db.refunds.find_one({"id": refund_id}, {"_id": 0})
    if not refund:
        raise HTTPException(status_code=404, detail="Refund not found")
    
    # Get related booking
    booking = await db.bookings.find_one({"id": refund.get("booking_id")}, {"_id": 0})
    
    return {
        "success": True,
        "refund": refund,
        "booking": booking
    }


@router.post("/admin/manual-refund")
async def admin_manual_refund(
    data: RefundProcessRequest,
    current_user: dict = Depends(require_roles(["admin", "super_admin"]))
):
    """
    Admin manual refund with optional override
    Can skip deduction rules if needed
    """
    db = get_database()
    
    booking = await db.bookings.find_one({"id": data.booking_id})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    payment_gateway = booking.get("payment_method", "unknown")
    
    result = await unified_refund_service.process_refund(
        db=db,
        booking_id=data.booking_id,
        payment_gateway=payment_gateway,
        custom_deduction_percent=data.custom_deduction_percent,
        admin_override=data.admin_override,
        refund_reason=data.refund_reason or "Admin initiated refund",
        requested_by=current_user["id"]
    )
    
    return result


@router.put("/admin/rules")
async def update_refund_rules(
    rules: dict,
    current_user: dict = Depends(require_roles(["super_admin"]))
):
    """Update refund deduction rules (Super Admin)"""
    db = get_database()
    
    # Store custom rules in database
    await db.settings.update_one(
        {"key": "refund_rules"},
        {"$set": {
            "key": "refund_rules",
            "value": rules,
            "updated_by": current_user["id"],
            "updated_at": datetime.now(timezone.utc).isoformat()
        }},
        upsert=True
    )
    
    return {"success": True, "message": "Refund rules updated"}


@router.get("/admin/rules")
async def get_refund_rules(
    current_user: dict = Depends(require_roles(["admin", "super_admin"]))
):
    """Get current refund rules (Admin)"""
    db = get_database()
    
    custom_rules = await db.settings.find_one({"key": "refund_rules"})
    
    return {
        "success": True,
        "default_rules": CANCELLATION_RULES,
        "custom_rules": custom_rules.get("value") if custom_rules else None,
        "active_rules": custom_rules.get("value") if custom_rules else CANCELLATION_RULES
    }
