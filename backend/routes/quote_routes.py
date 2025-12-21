from fastapi import APIRouter, HTTPException, Depends
from database import get_database
from models import Quote
from middleware import get_current_user
import uuid
from datetime import datetime, timedelta
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
    
    quote_id = str(uuid.uuid4())
    quote = {
        "id": quote_id,
        "booking_id": quote_data["booking_id"],
        "operator_id": operator["id"],
        "aircraft_id": quote_data["aircraft_id"],
        "quoted_price": quote_data["quoted_price"],
        "validity_hours": quote_data.get("validity_hours", 24),
        "special_notes": quote_data.get("special_notes"),
        "is_accepted": False,
        "created_at": datetime.utcnow().isoformat(),
        "expires_at": (datetime.utcnow() + timedelta(hours=quote_data.get("validity_hours", 24))).isoformat()
    }
    
    await db.quotes.insert_one(quote)
    
    # Update booking
    await db.bookings.update_one(
        {"id": quote_data["booking_id"]},
        {"$push": {"quote_ids": quote_id}, "$set": {"status": "quotes_received"}}
    )
    
    # Notify customer
    customer = await db.users.find_one({"id": booking["customer_id"]}, {"_id": 0})
    if customer:
        email_service.send_quote_notification(customer["email"], quote)
    
    return {"message": "Quote created", "quote": quote}

@router.get("/operator/inquiries")
async def get_operator_inquiries(user: dict = Depends(get_current_user)):
    """Get booking inquiries for operator"""
    db = get_database()
    
    if "operator" not in user["roles"]:
        raise HTTPException(status_code=403, detail="Operator access required")
    
    operator = await db.operators.find_one({"user_id": user["id"]}, {"_id": 0})
    if not operator:
        raise HTTPException(status_code=404, detail="Operator profile not found")
    
    inquiries = await db.inquiries.find(
        {"operator_id": operator["id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    # Enrich with booking details
    for inquiry in inquiries:
        booking = await db.bookings.find_one({"id": inquiry["booking_id"]}, {"_id": 0})
        if booking:
            inquiry["booking"] = booking
    
    return {"inquiries": inquiries}