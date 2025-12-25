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

@router.post("/inquiry")
async def create_inquiry(
    inquiry_data: dict,
    background_tasks: BackgroundTasks,
    user: dict = Depends(get_current_user)
):
    """
    Create a new booking inquiry - New Flow
    इंक्वायरी बनाएं - नया फ्लो
    
    Steps after inquiry:
    1. Inquiry created with status 'pending_acceptance'
    2. Operators within 500km notified
    3. Operators can Accept/Reject/Revise Quote
    4. Customer receives quotes
    5. Customer accepts quote → fills passenger details → payment
    """
    db = get_database()
    from datetime import timezone
    
    inquiry_id = str(uuid.uuid4())
    inquiry_number = f"INQ{datetime.now(timezone.utc).strftime('%Y%m%d')}{inquiry_id[:6].upper()}"
    
    inquiry = {
        "id": inquiry_id,
        "inquiry_number": inquiry_number,
        "type": "booking_inquiry",
        
        # Customer info
        "customer_id": user["id"],
        "customer_name": inquiry_data.get("customer_name") or user.get("full_name", user.get("email")),
        "customer_email": inquiry_data.get("customer_email") or user.get("email"),
        "customer_phone": inquiry_data.get("customer_phone") or user.get("phone"),
        
        # Aircraft & Passengers (Step 1)
        "aircraft_type": inquiry_data.get("aircraft_type"),
        "total_passengers": inquiry_data.get("total_passengers", 1),
        "adults_male": inquiry_data.get("adults_male", 0),
        "adults_female": inquiry_data.get("adults_female", 0),
        "children_count": inquiry_data.get("children_count", 0),
        
        # Booking Type (Step 2)
        "udan_prakar": inquiry_data.get("udan_prakar"),
        "booking_for": inquiry_data.get("booking_for"),
        "booking_purpose": inquiry_data.get("booking_purpose"),
        "booking_purpose_other": inquiry_data.get("booking_purpose_other"),
        
        # Route Details (Step 3)
        "pickup_pincode": inquiry_data.get("pickup_pincode"),
        "pickup_location": inquiry_data.get("pickup_location"),
        "pickup_state": inquiry_data.get("pickup_state"),
        "pickup_district": inquiry_data.get("pickup_district"),
        "pickup_latitude": inquiry_data.get("pickup_latitude"),
        "pickup_longitude": inquiry_data.get("pickup_longitude"),
        "drop_pincode": inquiry_data.get("drop_pincode"),
        "drop_location": inquiry_data.get("drop_location"),
        "drop_state": inquiry_data.get("drop_state"),
        "drop_district": inquiry_data.get("drop_district"),
        "drop_latitude": inquiry_data.get("drop_latitude"),
        "drop_longitude": inquiry_data.get("drop_longitude"),
        "departure_date": inquiry_data.get("departure_date"),
        "pickup_time": inquiry_data.get("pickup_time"),
        
        # Price Info (Step 4)
        "distance_km": inquiry_data.get("distance_km", 0),
        "estimated_price": inquiry_data.get("estimated_price", 0),
        "price_breakdown": inquiry_data.get("price_breakdown"),
        
        # Special Requirements
        "special_requirements": inquiry_data.get("special_requirements"),
        
        # Status tracking
        "status": "pending_acceptance",  # pending_acceptance -> quote_received -> accepted -> passenger_details -> payment_pending -> confirmed
        "operator_responses": [],  # List of operator responses
        "accepted_operator_id": None,
        "accepted_quote": None,
        "passenger_details": [],  # Filled after quote accepted
        "payment_status": "pending",
        
        # Timestamps
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    
    await db.inquiries.insert_one(inquiry.copy())
    
    # Broadcast to operators within 500km
    pickup_lat = inquiry_data.get("pickup_latitude")
    pickup_lon = inquiry_data.get("pickup_longitude")
    
    broadcast_result = {"status": "pending", "operators_notified": 0}
    
    if pickup_lat and pickup_lon:
        try:
            from services.inquiry_broadcast_service import create_inquiry_broadcast
            
            # Run broadcast in background
            background_tasks.add_task(
                create_inquiry_broadcast,
                inquiry_id=inquiry_id,
                booking_data=inquiry,
                pickup_lat=pickup_lat,
                pickup_lon=pickup_lon
            )
            
            broadcast_result = {
                "status": "initiated",
                "message": "Operators within 500km will be notified / 500km के अंदर के ऑपरेटर्स को सूचित किया जाएगा"
            }
            
            logger.info(f"Inquiry broadcast initiated: {inquiry_number}")
            
        except Exception as e:
            logger.error(f"Broadcast error: {e}")
            broadcast_result = {"status": "error", "message": str(e)}
    else:
        # Fallback: notify all active operators
        operators = await db.operators.find({"status": "active"}, {"_id": 0, "id": 1}).to_list(50)
        for op in operators:
            await db.operator_inquiries.insert_one({
                "id": str(uuid.uuid4()),
                "inquiry_id": inquiry_id,
                "operator_id": op["id"],
                "status": "pending",
                "created_at": datetime.now(timezone.utc).isoformat()
            })
        broadcast_result = {"status": "fallback", "operators_notified": len(operators)}
    
    # Update inquiry with broadcast info
    await db.inquiries.update_one(
        {"id": inquiry_id},
        {"$set": {"broadcast_result": broadcast_result}}
    )
    
    return {
        "success": True,
        "message": "Inquiry submitted successfully! / इंक्वायरी जमा हो गई!",
        "inquiry_id": inquiry_id,
        "inquiry_number": inquiry_number,
        "status": "pending_acceptance",
        "broadcast": broadcast_result,
        "next_step": "Wait for operator quotes / ऑपरेटर कोट्स का इंतज़ार करें"
    }

@router.get("/inquiry/{inquiry_id}/status")
async def get_inquiry_status(inquiry_id: str, user: dict = Depends(get_current_user)):
    """Get inquiry status and operator responses"""
    db = get_database()
    
    inquiry = await db.inquiries.find_one({"id": inquiry_id}, {"_id": 0})
    if not inquiry:
        raise HTTPException(status_code=404, detail="Inquiry not found")
    
    if inquiry["customer_id"] != user["id"] and "admin" not in user.get("roles", []):
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Get operator quotes/responses - check both booking_id and inquiry_id fields
    operator_responses = await db.quotes.find(
        {"$or": [{"booking_id": inquiry_id}, {"inquiry_id": inquiry_id}]},
        {"_id": 0}
    ).to_list(50)
    
    # Enrich with operator info
    for response in operator_responses:
        op = await db.operators.find_one(
            {"id": response.get("operator_id")},
            {"_id": 0, "company_name": 1, "average_rating": 1, "base_city": 1}
        )
        response["operator"] = op
        # Add operator_name if not present
        if not response.get("operator_name") and op:
            response["operator_name"] = op.get("company_name")
    
    return {
        "inquiry": inquiry,
        "operator_responses": operator_responses,
        "status_message": get_status_message(inquiry["status"]),
        "can_fill_passengers": inquiry["status"] == "quote_accepted",
        "can_pay": inquiry["status"] == "passenger_details_filled"
    }

def get_status_message(status: str) -> dict:
    """Get user-friendly status message"""
    messages = {
        "pending_acceptance": {
            "en": "Please wait, your booking acceptance pending to operators",
            "hi": "कृपया प्रतीक्षा करें, आपकी बुकिंग ऑपरेटर्स की स्वीकृति के लिए लंबित है"
        },
        "quote_received": {
            "en": "Operators have sent quotes. Please review and accept.",
            "hi": "ऑपरेटर्स ने कोट्स भेजे हैं। कृपया समीक्षा करें और स्वीकार करें।"
        },
        "quote_accepted": {
            "en": "Booking Accepted! Please fill passenger details.",
            "hi": "बुकिंग स्वीकृत! कृपया यात्री विवरण भरें।"
        },
        "passenger_details_filled": {
            "en": "Passenger details submitted. Please complete payment.",
            "hi": "यात्री विवरण जमा। कृपया भुगतान पूरा करें।"
        },
        "payment_pending": {
            "en": "Payment pending. Complete 100% payment to confirm.",
            "hi": "भुगतान लंबित। पुष्टि के लिए 100% भुगतान करें।"
        },
        "confirmed": {
            "en": "Booking Confirmed!",
            "hi": "बुकिंग पुष्ट!"
        }
    }
    return messages.get(status, {"en": status, "hi": status})
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