from fastapi import APIRouter, HTTPException, Depends, status, Query
from database import get_database
from models import Booking, BookingStatus, Quote
from middleware import get_current_user, require_roles
from models import UserRole
import uuid
from datetime import datetime, timedelta
from email_service import email_service
from ai_service import ai_service
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/bookings", tags=["Bookings"])

@router.post("/")
async def create_booking(booking_data: dict, user: dict = Depends(get_current_user)):
    """Create a new booking request"""
    db = get_database()
    
    booking_id = str(uuid.uuid4())
    booking_number = f"AIR{datetime.utcnow().strftime('%Y%m%d')}{booking_id[:6].upper()}"
    
    booking = {
        "id": booking_id,
        "booking_number": booking_number,
        "customer_id": user["id"],
        "from_location": booking_data["from_location"],
        "to_location": booking_data["to_location"],
        "trip_type": booking_data.get("trip_type", "one_way"),
        "departure_date": booking_data["departure_date"],
        "return_date": booking_data.get("return_date"),
        "passengers": booking_data["passengers"],
        "status": BookingStatus.PENDING_QUOTES.value,
        "quote_ids": [],
        "landing_permissions": [],
        "special_requirements": booking_data.get("special_requirements"),
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat()
    }
    
    # Get AI price suggestion
    try:
        price_suggestion = await ai_service.get_price_suggestion({
            "booking_id": booking_id,
            "from_location": booking["from_location"],
            "to_location": booking["to_location"],
            "passengers": booking["passengers"],
            "trip_type": booking["trip_type"]
        })
        booking["ai_price_suggestion"] = price_suggestion
    except Exception as e:
        logger.error(f"Error getting price suggestion: {e}")
    
    await db.bookings.insert_one(booking)
    
    # Notify operators
    operators = await db.operators.find({"status": "active"}, {"_id": 0}).to_list(100)
    for operator in operators:
        # Create inquiry for each operator
        inquiry = {
            "id": str(uuid.uuid4()),
            "booking_id": booking_id,
            "operator_id": operator["id"],
            "status": "pending",
            "created_at": datetime.utcnow().isoformat()
        }
        await db.inquiries.insert_one(inquiry)
    
    return {"message": "Booking request created", "booking": booking}

@router.get("/")
async def get_bookings(user: dict = Depends(get_current_user), status: str = Query(None)):
    """Get bookings for current user"""
    db = get_database()
    
    query = {}
    if "customer" in user["roles"]:
        query["customer_id"] = user["id"]
    elif "operator" in user["roles"]:
        operator = await db.operators.find_one({"user_id": user["id"]}, {"_id": 0})
        if operator:
            query["operator_id"] = operator["id"]
    
    if status:
        query["status"] = status
    
    bookings = await db.bookings.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    return {"bookings": bookings}

@router.get("/{booking_id}")
async def get_booking(booking_id: str, user: dict = Depends(get_current_user)):
    """Get booking details"""
    db = get_database()
    
    booking = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    # Get quotes for this booking
    quotes = await db.quotes.find({"booking_id": booking_id}, {"_id": 0}).to_list(100)
    booking["quotes"] = quotes
    
    return booking

@router.post("/{booking_id}/accept-quote")
async def accept_quote(booking_id: str, data: dict, user: dict = Depends(get_current_user)):
    """Accept a quote for a booking"""
    db = get_database()
    
    booking = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    if booking["customer_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    quote = await db.quotes.find_one({"id": data["quote_id"]}, {"_id": 0})
    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found")
    
    # Update booking
    await db.bookings.update_one(
        {"id": booking_id},
        {"$set": {
            "accepted_quote_id": data["quote_id"],
            "operator_id": quote["operator_id"],
            "aircraft_id": quote["aircraft_id"],
            "total_amount": quote["quoted_price"],
            "status": BookingStatus.QUOTE_ACCEPTED.value,
            "updated_at": datetime.utcnow().isoformat()
        }}
    )
    
    # Mark quote as accepted
    await db.quotes.update_one(
        {"id": data["quote_id"]},
        {"$set": {"is_accepted": True}}
    )
    
    return {"message": "Quote accepted", "booking_id": booking_id}

@router.post("/{booking_id}/cancel")
async def cancel_booking(booking_id: str, user: dict = Depends(get_current_user)):
    """Cancel a booking"""
    db = get_database()
    
    booking = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    if booking["customer_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.bookings.update_one(
        {"id": booking_id},
        {"$set": {
            "status": BookingStatus.CANCELLED.value,
            "updated_at": datetime.utcnow().isoformat()
        }}
    )
    
    return {"message": "Booking cancelled"}