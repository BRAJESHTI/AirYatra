from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List
from uuid import uuid4
from datetime import datetime, timezone, timedelta
import random
import string
from database import get_database
from middleware import require_roles
from models import UserRole

router = APIRouter(prefix="/journey", tags=["Journey Management"])

class StartPickupRequest(BaseModel):
    booking_id: str
    pilot_id: str

class VerifyOTPRequest(BaseModel):
    booking_id: str
    otp: str
    otp_type: str  # pickup, start_journey, complete_journey

class PilotRestrictionRequest(BaseModel):
    pilot_id: str
    restricted: bool
    restriction_reason: Optional[str] = None
    restriction_hours: Optional[int] = 12  # Default 12 hours rest

def generate_otp(length: int = 6) -> str:
    """Generate a numeric OTP"""
    return ''.join(random.choices(string.digits, k=length))

@router.post("/pickup/initiate")
async def initiate_pickup(
    request: StartPickupRequest,
    current_user: dict = Depends(require_roles([UserRole.OPERATOR, UserRole.ADMIN])),
    db=Depends(get_database)
):
    """
    Pilot initiates pickup - sends OTP to customer
    """
    # Get booking
    booking = await db.bookings.find_one({"id": request.booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    # Get pilot
    pilot = await db.pilots.find_one({"id": request.pilot_id}, {"_id": 0})
    if not pilot:
        raise HTTPException(status_code=404, detail="Pilot not found")
    
    # Check if pilot is restricted
    if pilot.get("is_restricted"):
        restriction_until = pilot.get("restriction_until", "")
        if restriction_until:
            restriction_time = datetime.fromisoformat(restriction_until.replace("Z", "+00:00"))
            if datetime.now(timezone.utc) < restriction_time:
                raise HTTPException(
                    status_code=403, 
                    detail=f"Pilot is restricted until {restriction_until}. Reason: {pilot.get('restriction_reason', 'Duty hour limit exceeded')}"
                )
    
    # Generate pickup OTP
    otp = generate_otp()
    
    # Store OTP
    journey_otp = {
        "id": str(uuid4()),
        "booking_id": request.booking_id,
        "pilot_id": request.pilot_id,
        "otp": otp,
        "otp_type": "pickup",
        "verified": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "expires_at": (datetime.now(timezone.utc) + timedelta(minutes=30)).isoformat()
    }
    await db.journey_otps.insert_one(journey_otp)
    
    # Update booking status
    await db.bookings.update_one(
        {"id": request.booking_id},
        {"$set": {
            "journey_status": "pilot_enroute",
            "pilot_id": request.pilot_id,
            "pickup_initiated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Get customer details for notification
    customer = await db.users.find_one({"id": booking.get("customer_id")}, {"_id": 0})
    customer_phone = customer.get("phone") if customer else None
    customer_email = customer.get("email") if customer else None
    
    # Get passenger phone if available
    passenger_phone = None
    if booking.get("passenger_details"):
        for p in booking["passenger_details"]:
            if p.get("phone"):
                passenger_phone = p["phone"]
                break
    
    # Send actual SMS/WhatsApp OTP notification
    from services.notification_service import notification_service
    
    notification_phone = passenger_phone or customer_phone
    notification_result = {"mock": True}
    
    if notification_phone:
        notification_result = await notification_service.send_journey_otp_notification(
            phone_number=notification_phone,
            otp=otp,
            otp_type="pickup",
            booking_info={
                "booking_number": booking.get("booking_number", booking.get("id", "")[:8]),
                "from_location": booking.get("from_location"),
                "to_location": booking.get("to_location")
            },
            db=db
        )
    
    print(f"[JOURNEY OTP] Pickup OTP for booking {request.booking_id}: {otp}")
    print(f"[JOURNEY OTP] Notification result: {notification_result}")
    
    return {
        "message": "Pickup initiated. OTP sent to customer.",
        "booking_id": request.booking_id,
        "otp_type": "pickup",
        "customer_notified": notification_result.get("success", True),
        "notification_mock": notification_result.get("mock", True),
        "debug_otp": otp  # Remove in production
    }

@router.post("/pickup/verify")
async def verify_pickup_otp(
    request: VerifyOTPRequest,
    current_user: dict = Depends(require_roles([UserRole.OPERATOR, UserRole.ADMIN])),
    db=Depends(get_database)
):
    """
    Pilot verifies pickup OTP from customer
    """
    # Find OTP record
    otp_record = await db.journey_otps.find_one({
        "booking_id": request.booking_id,
        "otp_type": "pickup",
        "verified": False
    }, sort=[("created_at", -1)])
    
    if not otp_record:
        raise HTTPException(status_code=404, detail="No pending pickup OTP found")
    
    # Check expiry
    expiry = datetime.fromisoformat(otp_record["expires_at"].replace("Z", "+00:00"))
    if datetime.now(timezone.utc) > expiry:
        raise HTTPException(status_code=400, detail="OTP expired. Please initiate pickup again.")
    
    # Verify OTP
    if otp_record["otp"] != request.otp:
        raise HTTPException(status_code=400, detail="Invalid OTP")
    
    # Mark as verified
    await db.journey_otps.update_one(
        {"id": otp_record["id"]},
        {"$set": {"verified": True, "verified_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    # Update booking
    await db.bookings.update_one(
        {"id": request.booking_id},
        {"$set": {
            "journey_status": "pickup_verified",
            "pickup_verified_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Generate start journey OTP
    start_otp = generate_otp()
    start_otp_record = {
        "id": str(uuid4()),
        "booking_id": request.booking_id,
        "pilot_id": otp_record["pilot_id"],
        "otp": start_otp,
        "otp_type": "start_journey",
        "verified": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "expires_at": (datetime.now(timezone.utc) + timedelta(minutes=30)).isoformat()
    }
    await db.journey_otps.insert_one(start_otp_record)
    
    print(f"[JOURNEY OTP] Start Journey OTP for booking {request.booking_id}: {start_otp}")
    
    return {
        "message": "Pickup verified! Start journey OTP sent to customer.",
        "booking_id": request.booking_id,
        "next_step": "start_journey",
        "debug_otp": start_otp  # Remove in production
    }

@router.post("/start")
async def verify_start_journey(
    request: VerifyOTPRequest,
    current_user: dict = Depends(require_roles([UserRole.OPERATOR, UserRole.ADMIN])),
    db=Depends(get_database)
):
    """
    Pilot verifies start journey OTP from customer to begin flight
    """
    # Find OTP record
    otp_record = await db.journey_otps.find_one({
        "booking_id": request.booking_id,
        "otp_type": "start_journey",
        "verified": False
    }, sort=[("created_at", -1)])
    
    if not otp_record:
        raise HTTPException(status_code=404, detail="No pending start journey OTP found")
    
    # Check expiry
    expiry = datetime.fromisoformat(otp_record["expires_at"].replace("Z", "+00:00"))
    if datetime.now(timezone.utc) > expiry:
        raise HTTPException(status_code=400, detail="OTP expired")
    
    # Verify OTP
    if otp_record["otp"] != request.otp:
        raise HTTPException(status_code=400, detail="Invalid OTP")
    
    # Mark as verified
    await db.journey_otps.update_one(
        {"id": otp_record["id"]},
        {"$set": {"verified": True, "verified_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    # Update booking
    await db.bookings.update_one(
        {"id": request.booking_id},
        {"$set": {
            "journey_status": "in_flight",
            "journey_started_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Create flight record
    flight_record = {
        "id": str(uuid4()),
        "booking_id": request.booking_id,
        "pilot_id": otp_record["pilot_id"],
        "flight_date": datetime.now(timezone.utc).isoformat(),
        "departure_time": datetime.now(timezone.utc).isoformat(),
        "status": "in_progress",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.flight_records.insert_one(flight_record)
    
    return {
        "message": "Journey started! Flight in progress.",
        "booking_id": request.booking_id,
        "flight_record_id": flight_record["id"],
        "journey_status": "in_flight"
    }

@router.post("/complete/initiate")
async def initiate_journey_completion(
    booking_id: str,
    current_user: dict = Depends(require_roles([UserRole.OPERATOR, UserRole.ADMIN])),
    db=Depends(get_database)
):
    """
    Pilot initiates journey completion - sends final OTP to customer
    """
    booking = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    if booking.get("journey_status") != "in_flight":
        raise HTTPException(status_code=400, detail="Journey must be in flight to complete")
    
    # Generate completion OTP
    otp = generate_otp()
    otp_record = {
        "id": str(uuid4()),
        "booking_id": booking_id,
        "pilot_id": booking.get("pilot_id"),
        "otp": otp,
        "otp_type": "complete_journey",
        "verified": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "expires_at": (datetime.now(timezone.utc) + timedelta(minutes=30)).isoformat()
    }
    await db.journey_otps.insert_one(otp_record)
    
    # Update booking status
    await db.bookings.update_one(
        {"id": booking_id},
        {"$set": {"journey_status": "awaiting_completion_otp"}}
    )
    
    print(f"[JOURNEY OTP] Completion OTP for booking {booking_id}: {otp}")
    
    return {
        "message": "Completion OTP sent to customer",
        "booking_id": booking_id,
        "debug_otp": otp  # Remove in production
    }

@router.post("/complete/verify")
async def verify_journey_completion(
    request: VerifyOTPRequest,
    current_user: dict = Depends(require_roles([UserRole.OPERATOR, UserRole.ADMIN])),
    db=Depends(get_database)
):
    """
    Pilot verifies completion OTP to finish journey
    """
    # Find OTP record
    otp_record = await db.journey_otps.find_one({
        "booking_id": request.booking_id,
        "otp_type": "complete_journey",
        "verified": False
    }, sort=[("created_at", -1)])
    
    if not otp_record:
        raise HTTPException(status_code=404, detail="No pending completion OTP found")
    
    # Check expiry
    expiry = datetime.fromisoformat(otp_record["expires_at"].replace("Z", "+00:00"))
    if datetime.now(timezone.utc) > expiry:
        raise HTTPException(status_code=400, detail="OTP expired")
    
    # Verify OTP
    if otp_record["otp"] != request.otp:
        raise HTTPException(status_code=400, detail="Invalid OTP")
    
    # Mark as verified
    await db.journey_otps.update_one(
        {"id": otp_record["id"]},
        {"$set": {"verified": True, "verified_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    # Get booking for flight duration calculation
    booking = await db.bookings.find_one({"id": request.booking_id}, {"_id": 0})
    journey_started = booking.get("journey_started_at")
    
    flight_duration_hours = 0
    if journey_started:
        start_time = datetime.fromisoformat(journey_started.replace("Z", "+00:00"))
        end_time = datetime.now(timezone.utc)
        flight_duration_hours = (end_time - start_time).total_seconds() / 3600
    
    # Update booking to completed
    await db.bookings.update_one(
        {"id": request.booking_id},
        {"$set": {
            "status": "completed",
            "journey_status": "completed",
            "journey_completed_at": datetime.now(timezone.utc).isoformat(),
            "completed_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Update flight record
    await db.flight_records.update_one(
        {"booking_id": request.booking_id, "status": "in_progress"},
        {"$set": {
            "arrival_time": datetime.now(timezone.utc).isoformat(),
            "flight_duration_hours": round(flight_duration_hours, 2),
            "status": "completed"
        }}
    )
    
    # Update pilot total hours
    pilot_id = otp_record.get("pilot_id")
    if pilot_id:
        await db.pilots.update_one(
            {"id": pilot_id},
            {"$inc": {"total_flight_hours": round(flight_duration_hours, 2)}}
        )
    
    return {
        "message": "Journey completed successfully!",
        "booking_id": request.booking_id,
        "flight_duration_hours": round(flight_duration_hours, 2),
        "journey_status": "completed"
    }

@router.get("/status/{booking_id}")
async def get_journey_status(
    booking_id: str,
    db=Depends(get_database)
):
    """Get current journey status for a booking"""
    booking = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    return {
        "booking_id": booking_id,
        "booking_status": booking.get("status"),
        "journey_status": booking.get("journey_status"),
        "pilot_id": booking.get("pilot_id"),
        "pickup_initiated_at": booking.get("pickup_initiated_at"),
        "pickup_verified_at": booking.get("pickup_verified_at"),
        "journey_started_at": booking.get("journey_started_at"),
        "journey_completed_at": booking.get("journey_completed_at")
    }

# Pilot restriction endpoints
@router.post("/pilot/restrict")
async def restrict_pilot(
    request: PilotRestrictionRequest,
    current_user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN])),
    db=Depends(get_database)
):
    """Restrict a pilot from flying (e.g., due to duty hour limits)"""
    pilot = await db.pilots.find_one({"id": request.pilot_id}, {"_id": 0})
    if not pilot:
        raise HTTPException(status_code=404, detail="Pilot not found")
    
    restriction_until = None
    if request.restricted and request.restriction_hours:
        restriction_until = (datetime.now(timezone.utc) + timedelta(hours=request.restriction_hours)).isoformat()
    
    await db.pilots.update_one(
        {"id": request.pilot_id},
        {"$set": {
            "is_restricted": request.restricted,
            "restriction_reason": request.restriction_reason,
            "restriction_until": restriction_until,
            "restricted_by": current_user["id"],
            "restricted_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Log audit
    await db.audit_logs.insert_one({
        "id": str(uuid4()),
        "action": "pilot_restriction" if request.restricted else "pilot_unrestriction",
        "entity_type": "pilot",
        "entity_id": request.pilot_id,
        "user_id": current_user["id"],
        "user_name": current_user.get("full_name"),
        "details": {
            "restricted": request.restricted,
            "reason": request.restriction_reason,
            "restriction_hours": request.restriction_hours
        },
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {
        "message": f"Pilot {'restricted' if request.restricted else 'unrestricted'} successfully",
        "pilot_id": request.pilot_id,
        "is_restricted": request.restricted,
        "restriction_until": restriction_until
    }

@router.get("/pilot/restrictions")
async def get_restricted_pilots(
    current_user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.OPERATOR])),
    db=Depends(get_database)
):
    """Get list of currently restricted pilots"""
    restricted_pilots = await db.pilots.find(
        {"is_restricted": True},
        {"_id": 0}
    ).to_list(100)
    
    return {"restricted_pilots": restricted_pilots}
