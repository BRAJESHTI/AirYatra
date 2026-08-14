from fastapi import APIRouter, HTTPException, Depends
from typing import Optional
from database import get_database
from models import Quote
from middleware import get_current_user
import uuid
from datetime import datetime, timedelta, timezone
from email_service import email_service
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/quotes", tags=["Quotes"])

@router.post("/")
async def create_quote(quote_data: dict, user: dict = Depends(get_current_user)):
    """Create a quote for a booking (Operator only)"""
    db = get_database()
    
    if "operator" not in user["roles"]:
        raise HTTPException(status_code=403, detail="Only operators can create quotes")
    
    operator = await db.operators.find_one({"user_id": user["id"]}, {"_id": 0})
    if not operator:
        raise HTTPException(status_code=404, detail="Operator profile not found")
    
    booking = await db.bookings.find_one({"id": quote_data["booking_id"]}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    # City/route-wise platform fee auto-apply (admin-set rules)
    from services.platform_fee_service import resolve_platform_fee, compute_platform_fee
    fee_rule = await resolve_platform_fee(
        db,
        booking.get("from_location") or booking.get("pickup_location", ""),
        booking.get("to_location") or booking.get("drop_location", ""),
    )
    operator_payout = float(quote_data["quoted_price"])
    platform_fee = compute_platform_fee(operator_payout, fee_rule)

    # Urgency surcharge (time-to-departure based, admin-configurable)
    from services.dynamic_pricing_service import get_urgency_settings, get_urgency_percent
    urgency_settings = await get_urgency_settings(db)
    urgency_pct, urgency_label = get_urgency_percent(
        urgency_settings,
        booking.get("departure_date") or booking.get("travel_date") or "",
        booking.get("departure_time") or booking.get("travel_time"),
    )
    urgency_surcharge = round(operator_payout * urgency_pct / 100, 2)
    customer_total = round(operator_payout + platform_fee + urgency_surcharge, 2)
    
    quote_id = str(uuid.uuid4())
    quote = {
        "id": quote_id,
        "booking_id": quote_data["booking_id"],
        "operator_id": operator["id"],
        "aircraft_id": quote_data["aircraft_id"],
        "quoted_price": customer_total,
        "amount": customer_total,
        "operator_payout": operator_payout,
        "platform_fee": platform_fee,
        "platform_fee_rule": fee_rule.get("label"),
        "urgency_percent": urgency_pct,
        "urgency_surcharge": urgency_surcharge,
        "urgency_label": urgency_label,
        "validity_hours": quote_data.get("validity_hours", 24),
        "special_notes": quote_data.get("special_notes"),
        "is_accepted": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "expires_at": (datetime.now(timezone.utc) + timedelta(hours=quote_data.get("validity_hours", 24))).isoformat()
    }
    
    await db.quotes.insert_one(quote.copy())
    quote.pop("_id", None)

    # Update booking
    await db.bookings.update_one(
        {"id": quote_data["booking_id"]},
        {"$push": {"quote_ids": quote_id}, "$set": {"status": "quotes_received"}}
    )
    
    # Notify customer
    customer = await db.users.find_one({"id": booking["customer_id"]}, {"_id": 0})
    if customer:
        try:
            email_service.send_quote_notification(customer["email"], quote)
        except Exception as e:
            logger.error(f"Failed to send quote notification email: {e}")

    return {"message": "Quote created", "quote": quote}

@router.get("/operator/inquiries")
async def get_operator_inquiries(status: Optional[str] = None, user: dict = Depends(get_current_user)):
    """Get booking inquiries for operator (optional comma-separated status filter)"""
    db = get_database()
    
    if "operator" not in user["roles"]:
        raise HTTPException(status_code=403, detail="Operator access required")
    
    operator = await db.operators.find_one({"user_id": user["id"]}, {"_id": 0})
    if not operator:
        raise HTTPException(status_code=404, detail="Operator profile not found")
    
    query = {"operator_id": operator["id"]}
    if status:
        query["status"] = {"$in": [s.strip() for s in status.split(",") if s.strip()]}
    inquiries = await db.inquiries.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    # Enrich with booking details
    for inquiry in inquiries:
        booking = await db.bookings.find_one({"id": inquiry["booking_id"]}, {"_id": 0})
        if booking:
            inquiry["booking"] = booking
    
    return {"inquiries": inquiries}