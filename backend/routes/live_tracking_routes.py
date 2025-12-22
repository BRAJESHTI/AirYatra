from fastapi import APIRouter, HTTPException, Depends
from database import get_database
from middleware import get_current_user
import uuid
from datetime import datetime
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/live-tracking", tags=["Live Tracking"])

@router.post("/update-location")
async def update_flight_location(tracking_data: dict, user: dict = Depends(get_current_user)):
    """Update live flight location (Pilot/System can update)"""
    db = get_database()
    
    tracking_id = tracking_data.get("tracking_id")
    
    if not tracking_id:
        # Create new tracking session
        tracking_id = str(uuid.uuid4())
    
    tracking_update = {
        "tracking_id": tracking_id,
        "booking_id": tracking_data.get("booking_id"),
        "aircraft_id": tracking_data["aircraft_id"],
        "pilot_id": tracking_data.get("pilot_id"),
        "latitude": tracking_data["latitude"],
        "longitude": tracking_data["longitude"],
        "altitude_feet": tracking_data.get("altitude_feet"),
        "speed_kmh": tracking_data.get("speed_kmh"),
        "heading_degrees": tracking_data.get("heading_degrees"),
        "flight_status": tracking_data.get("flight_status", "in_flight"),
        "timestamp": datetime.utcnow().isoformat()
    }
    
    # Store in live_tracking collection (with TTL index for auto-cleanup)
    await db.live_tracking.insert_one(tracking_update.copy())
    
    # Update aircraft last known location
    await db.aircraft.update_one(
        {"id": tracking_data["aircraft_id"]},
        {"$set": {
            "last_known_location": {
                "latitude": tracking_data["latitude"],
                "longitude": tracking_data["longitude"],
                "timestamp": datetime.utcnow().isoformat()
            }
        }}
    )
    
    return {"message": "Location updated", "tracking_id": tracking_id}

@router.get("/aircraft/{aircraft_id}")
async def get_aircraft_live_location(aircraft_id: str, user: dict = Depends(get_current_user)):
    """Get current live location of aircraft"""
    db = get_database()
    
    # Get latest tracking data (within last 10 minutes)
    ten_minutes_ago = (datetime.utcnow().timestamp() - 600)
    
    tracking = await db.live_tracking.find_one(
        {"aircraft_id": aircraft_id},
        {"_id": 0},
        sort=[("timestamp", -1)]
    )
    
    if not tracking:
        return {"tracking": None, "is_active": False}
    
    # Check if tracking is recent (within 10 minutes)
    tracking_time = datetime.fromisoformat(tracking["timestamp"])
    is_active = (datetime.utcnow() - tracking_time).total_seconds() < 600
    
    return {
        "tracking": tracking,
        "is_active": is_active
    }

@router.get("/booking/{booking_id}")
async def get_booking_live_tracking(booking_id: str, user: dict = Depends(get_current_user)):
    """Get live tracking for a booking (Customer can track their flight)"""
    db = get_database()
    
    # Verify booking belongs to user or user is operator/pilot
    booking = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    if booking["customer_id"] != user["id"] and "operator" not in user["roles"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Get latest tracking
    tracking = await db.live_tracking.find_one(
        {"booking_id": booking_id},
        {"_id": 0},
        sort=[("timestamp", -1)]
    )
    
    if not tracking:
        return {"tracking": None, "flight_status": "not_started"}
    
    return {"tracking": tracking}

@router.get("/tracking-history/{tracking_id}")
async def get_tracking_history(tracking_id: str, user: dict = Depends(get_current_user)):
    """Get complete tracking history for a flight"""
    db = get_database()
    
    history = await db.live_tracking.find(
        {"tracking_id": tracking_id},
        {"_id": 0}
    ).sort("timestamp", 1).to_list(1000)
    
    return {"history": history, "total_points": len(history)}