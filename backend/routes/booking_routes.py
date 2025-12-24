from fastapi import APIRouter, HTTPException, Depends, status, Query, BackgroundTasks
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
async def create_booking(
    booking_data: dict,
    background_tasks: BackgroundTasks,
    user: dict = Depends(get_current_user)
):
    """Create a new booking request with auto-broadcast to operators within 500km radius"""
    db = get_database()
    
    booking_id = str(uuid.uuid4())
    booking_number = f"AIR{datetime.utcnow().strftime('%Y%m%d')}{booking_id[:6].upper()}"
    
    booking = {
        "id": booking_id,
        "booking_number": booking_number,
        "customer_id": user["id"],
        "from_location": booking_data.get("from_location"),
        "to_location": booking_data.get("to_location"),
        "from_pincode": booking_data.get("from_pincode"),
        "to_pincode": booking_data.get("to_pincode"),
        "from_state": booking_data.get("from_state"),
        "from_district": booking_data.get("from_district"),
        "from_latitude": booking_data.get("from_latitude"),
        "from_longitude": booking_data.get("from_longitude"),
        "to_state": booking_data.get("to_state"),
        "to_district": booking_data.get("to_district"),
        "to_latitude": booking_data.get("to_latitude"),
        "to_longitude": booking_data.get("to_longitude"),
        "trip_type": booking_data.get("trip_type", "one_way"),
        "flight_type": booking_data.get("flight_type"),
        "flight_type_details": booking_data.get("flight_type_details"),
        "departure_date": booking_data.get("departure_date"),
        "pickup_time": booking_data.get("pickup_time"),
        "return_date": booking_data.get("return_date"),
        "passengers": booking_data.get("passengers", 1),
        "passenger_details": booking_data.get("passenger_details", []),
        "booking_for": booking_data.get("booking_for", "self"),
        "booking_purpose": booking_data.get("booking_purpose", "general_tour"),
        "booking_type": booking_data.get("booking_type", "standard"),  # standard or custom_quote
        "include_insurance": booking_data.get("include_insurance", False),
        "gst_billing": booking_data.get("gst_billing", False),
        "gstin": booking_data.get("gstin"),
        "company_name": booking_data.get("company_name"),
        "billing_address": booking_data.get("billing_address"),
        "multi_location_stops": booking_data.get("multi_location_stops", []),
        "estimated_price": booking_data.get("estimated_price", 0),
        "status": "quote_requested" if booking_data.get("booking_type") == "custom_quote" else BookingStatus.PENDING_QUOTES.value,
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
    
    await db.bookings.insert_one(booking.copy())
    
    # BROADCAST TO OPERATORS WITHIN 500 KM RADIUS
    pickup_lat = booking_data.get("from_latitude")
    pickup_lon = booking_data.get("from_longitude")
    
    broadcast_result = None
    if pickup_lat and pickup_lon:
        try:
            from services.inquiry_broadcast_service import create_inquiry_broadcast
            
            # Run broadcast in background for faster response
            background_tasks.add_task(
                create_inquiry_broadcast,
                inquiry_id=booking_id,
                booking_data=booking,
                pickup_lat=pickup_lat,
                pickup_lon=pickup_lon
            )
            
            broadcast_result = {
                "status": "initiated",
                "message": "Operators within 500km will be notified"
            }
            
            logger.info(f"Inquiry broadcast initiated for booking {booking_number}")
            
        except Exception as e:
            logger.error(f"Error initiating inquiry broadcast: {e}")
            broadcast_result = {"status": "error", "message": str(e)}
    else:
        # Fallback to old method if no coordinates
        operators = await db.operators.find({"status": "active"}, {"_id": 0}).to_list(100)
        for operator in operators:
            inquiry = {
                "id": str(uuid.uuid4()),
                "booking_id": booking_id,
                "operator_id": operator["id"],
                "status": "pending",
                "created_at": datetime.utcnow().isoformat()
            }
            await db.inquiries.insert_one(inquiry.copy())
        
        broadcast_result = {"status": "legacy", "operators_notified": len(operators)}
    
    return {
        "message": "Booking request created",
        "booking": booking,
        "broadcast": broadcast_result
    }

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