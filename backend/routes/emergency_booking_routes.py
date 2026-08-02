"""
Emergency Booking Priority System
Handles priority queue and instant operator notifications for emergency bookings
"""

from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks, Query
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone, timedelta
from database import get_database
from middleware import get_current_user, require_roles
import uuid
import asyncio
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/emergency", tags=["Emergency Bookings"])


# ============ MODELS ============

class EmergencyBookingRequest(BaseModel):
    """Emergency booking request - gets priority processing"""
    # Location
    from_location: str
    from_latitude: float
    from_longitude: float
    to_location: str
    to_latitude: float
    to_longitude: float
    
    # Urgency
    urgency_level: str = "high"  # critical, high, medium
    urgency_reason: str  # medical_emergency, time_critical, vip_travel, disaster_relief
    required_by: Optional[str] = None  # ISO datetime - when flight must happen
    
    # Flight details
    passengers: int = 1
    aircraft_type: Optional[str] = None  # helicopter, light_jet, any
    special_requirements: Optional[str] = None
    
    # Contact
    emergency_contact_name: str
    emergency_contact_phone: str


class EmergencyResponse(BaseModel):
    """Response from operator to emergency request"""
    emergency_booking_id: str
    can_fulfill: bool
    aircraft_id: Optional[str] = None
    estimated_arrival_minutes: Optional[int] = None
    price: Optional[float] = None
    notes: Optional[str] = None


# ============ CONSTANTS ============

URGENCY_LEVELS = {
    "critical": {
        "label": "Critical / अत्यंत जरूरी",
        "priority": 1,
        "surcharge_percent": 50,
        "max_response_minutes": 5,
        "broadcast_radius_km": 500,
        "color": "red"
    },
    "high": {
        "label": "High / उच्च",
        "priority": 2,
        "surcharge_percent": 25,
        "max_response_minutes": 15,
        "broadcast_radius_km": 300,
        "color": "orange"
    },
    "medium": {
        "label": "Medium / मध्यम",
        "priority": 3,
        "surcharge_percent": 10,
        "max_response_minutes": 30,
        "broadcast_radius_km": 200,
        "color": "yellow"
    }
}

URGENCY_REASONS = {
    "medical_emergency": {
        "label": "Medical Emergency / चिकित्सा आपातकाल",
        "icon": "🏥",
        "priority_boost": 1
    },
    "time_critical": {
        "label": "Time Critical / समय-महत्वपूर्ण",
        "icon": "⏰",
        "priority_boost": 0
    },
    "vip_travel": {
        "label": "VIP Travel / वीआईपी यात्रा",
        "icon": "👔",
        "priority_boost": 0
    },
    "disaster_relief": {
        "label": "Disaster Relief / आपदा राहत",
        "icon": "🆘",
        "priority_boost": 1
    },
    "organ_transport": {
        "label": "Organ Transport / अंग परिवहन",
        "icon": "❤️",
        "priority_boost": 2
    }
}


# ============ HELPER FUNCTIONS ============

def calculate_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate distance between two points using Haversine formula"""
    import math
    R = 6371  # Earth's radius in km
    
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    delta_lat = math.radians(lat2 - lat1)
    delta_lon = math.radians(lon2 - lon1)
    
    a = math.sin(delta_lat/2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lon/2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    
    return R * c


async def notify_operator_emergency(db, operator_id: str, emergency: dict, aircraft: dict):
    """Send instant notification to operator about emergency booking"""
    now = datetime.now(timezone.utc).isoformat()
    
    notification = {
        "id": str(uuid.uuid4()),
        "user_id": operator_id,
        "type": "emergency_booking",
        "title": f"🚨 EMERGENCY: {emergency['urgency_reason'].replace('_', ' ').title()}",
        "message": f"Urgent flight needed from {emergency['from_location']} to {emergency['to_location']}. {emergency['passengers']} passengers. Respond ASAP!",
        "data": {
            "emergency_booking_id": emergency["id"],
            "urgency_level": emergency["urgency_level"],
            "aircraft_id": aircraft.get("id") if aircraft else None,
            "from_location": emergency["from_location"],
            "to_location": emergency["to_location"]
        },
        "priority": "critical",
        "is_read": False,
        "requires_action": True,
        "action_deadline": (datetime.now(timezone.utc) + timedelta(
            minutes=URGENCY_LEVELS[emergency["urgency_level"]]["max_response_minutes"]
        )).isoformat(),
        "created_at": now
    }
    
    await db.notifications.insert_one(notification)
    
    # Also add to emergency_alerts collection for faster querying
    await db.emergency_alerts.insert_one({
        "id": str(uuid.uuid4()),
        "emergency_booking_id": emergency["id"],
        "operator_id": operator_id,
        "aircraft_id": aircraft.get("id") if aircraft else None,
        "status": "pending",
        "notified_at": now,
        "expires_at": notification["action_deadline"]
    })
    
    return notification


async def find_available_operators(db, emergency: dict) -> list:
    """Find operators with available aircraft within broadcast radius"""
    urgency_config = URGENCY_LEVELS.get(emergency["urgency_level"], URGENCY_LEVELS["high"])
    radius_km = urgency_config["broadcast_radius_km"]
    
    # Find all published, verified aircraft
    query = {
        "is_published": True,
        "is_archived": {"$ne": True},
        "availability_status": "available",
        "verification.status": {"$in": ["verified", "premium_verified"]}
    }
    
    if emergency.get("aircraft_type") and emergency["aircraft_type"] != "any":
        query["basic_info.aircraft_type"] = emergency["aircraft_type"]
    
    aircraft_list = await db.aircraft_catalog.find(query, {"_id": 0}).to_list(100)
    
    # Filter by distance (if operator has base location)
    matching_operators = []
    
    for aircraft in aircraft_list:
        operator = await db.operators.find_one({"user_id": aircraft["operator_id"]}, {"_id": 0})
        if not operator:
            continue
        
        # Get operator's base coordinates
        base_lat = operator.get("base_latitude") or emergency["from_latitude"]  # Fallback
        base_lng = operator.get("base_longitude") or emergency["from_longitude"]
        
        # Calculate distance from emergency origin
        distance = calculate_distance(
            emergency["from_latitude"],
            emergency["from_longitude"],
            base_lat,
            base_lng
        )
        
        if distance <= radius_km:
            matching_operators.append({
                "operator_id": aircraft["operator_id"],
                "operator_email": aircraft.get("operator_email"),
                "aircraft": aircraft,
                "distance_km": round(distance, 1),
                "estimated_arrival_minutes": round(distance / 4)  # ~240 km/h avg
            })
    
    # Sort by distance
    matching_operators.sort(key=lambda x: x["distance_km"])
    
    return matching_operators


# ============ ENDPOINTS ============

@router.get("/config")
async def get_emergency_config():
    """Get emergency booking configuration for frontend"""
    return {
        "urgency_levels": URGENCY_LEVELS,
        "urgency_reasons": URGENCY_REASONS,
        "surcharge_note": "Emergency bookings include a priority surcharge based on urgency level"
    }


@router.post("/create")
async def create_emergency_booking(
    request: EmergencyBookingRequest,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    """
    Create an emergency booking with priority queue.
    Instantly notifies all available operators within range.
    """
    db = get_database()
    now = datetime.now(timezone.utc).isoformat()
    
    # Validate urgency level
    if request.urgency_level not in URGENCY_LEVELS:
        raise HTTPException(status_code=400, detail="Invalid urgency level")
    
    urgency_config = URGENCY_LEVELS[request.urgency_level]
    reason_config = URGENCY_REASONS.get(request.urgency_reason, {"priority_boost": 0})
    
    # Calculate final priority (lower = more urgent)
    final_priority = urgency_config["priority"] - reason_config.get("priority_boost", 0)
    final_priority = max(0, final_priority)  # Don't go below 0
    
    emergency_id = str(uuid.uuid4())
    emergency_number = f"EMR{datetime.now(timezone.utc).strftime('%Y%m%d%H%M')}{emergency_id[:4].upper()}"
    
    emergency_booking = {
        "id": emergency_id,
        "emergency_number": emergency_number,
        "customer_id": current_user["id"],
        "customer_email": current_user.get("email"),
        "customer_phone": current_user.get("phone"),
        
        # Location
        "from_location": request.from_location,
        "from_latitude": request.from_latitude,
        "from_longitude": request.from_longitude,
        "to_location": request.to_location,
        "to_latitude": request.to_latitude,
        "to_longitude": request.to_longitude,
        
        # Urgency
        "urgency_level": request.urgency_level,
        "urgency_reason": request.urgency_reason,
        "urgency_reason_label": reason_config.get("label", request.urgency_reason),
        "required_by": request.required_by,
        "priority_score": final_priority,
        "surcharge_percent": urgency_config["surcharge_percent"],
        
        # Flight details
        "passengers": request.passengers,
        "aircraft_type": request.aircraft_type,
        "special_requirements": request.special_requirements,
        
        # Contact
        "emergency_contact_name": request.emergency_contact_name,
        "emergency_contact_phone": request.emergency_contact_phone,
        
        # Status
        "status": "broadcasting",
        "responses": [],
        "selected_operator_id": None,
        "selected_aircraft_id": None,
        
        # Timestamps
        "created_at": now,
        "updated_at": now,
        "broadcast_expires_at": (datetime.now(timezone.utc) + timedelta(
            minutes=urgency_config["max_response_minutes"] * 2
        )).isoformat()
    }
    
    await db.emergency_bookings.insert_one(emergency_booking)
    
    # Find and notify operators
    matching_operators = await find_available_operators(db, emergency_booking)
    
    notified_count = 0
    for op in matching_operators[:20]:  # Notify up to 20 operators
        try:
            await notify_operator_emergency(db, op["operator_id"], emergency_booking, op["aircraft"])
            notified_count += 1
        except Exception as e:
            logger.error(f"Failed to notify operator {op['operator_id']}: {e}")
    
    # Update booking with broadcast info
    await db.emergency_bookings.update_one(
        {"id": emergency_id},
        {
            "$set": {
                "operators_notified": notified_count,
                "broadcast_radius_km": urgency_config["broadcast_radius_km"],
                "status": "awaiting_responses" if notified_count > 0 else "no_operators_found"
            }
        }
    )
    
    # Prepare response based on whether operators were found
    if notified_count > 0:
        return {
            "success": True,
            "emergency_booking_id": emergency_id,
            "emergency_number": emergency_number,
            "priority_score": final_priority,
            "operators_notified": notified_count,
            "broadcast_radius_km": urgency_config["broadcast_radius_km"],
            "response_deadline_minutes": urgency_config["max_response_minutes"],
            "surcharge_percent": urgency_config["surcharge_percent"],
            "status": "awaiting_responses",
            "message": f"Emergency broadcast sent to {notified_count} operators. Responses expected within {urgency_config['max_response_minutes']} minutes.",
            "message_hi": f"आपातकालीन प्रसारण {notified_count} ऑपरेटरों को भेजा गया। {urgency_config['max_response_minutes']} मिनट में जवाब अपेक्षित।"
        }
    else:
        # No operators found - provide helpful guidance
        return {
            "success": True,
            "emergency_booking_id": emergency_id,
            "emergency_number": emergency_number,
            "priority_score": final_priority,
            "operators_notified": 0,
            "broadcast_radius_km": urgency_config["broadcast_radius_km"],
            "response_deadline_minutes": urgency_config["max_response_minutes"],
            "surcharge_percent": urgency_config["surcharge_percent"],
            "status": "no_operators_found",
            "no_operators_found": True,
            "message": f"No operators available within {urgency_config['broadcast_radius_km']} km radius. Try increasing urgency level for wider reach or contact admin directly.",
            "message_hi": f"{urgency_config['broadcast_radius_km']} किमी दायरे में कोई ऑपरेटर उपलब्ध नहीं। अधिक दायरे के लिए आवश्यकता स्तर बढ़ाएं या सीधे एडमिन से संपर्क करें।",
            "suggestions": [
                "Increase urgency level to 'Critical' for 500km radius",
                "Contact AirYatra helpline: 1800-XXX-XXXX",
                "Admin will be notified to manually assign operators"
            ]
        }


@router.post("/respond")
async def respond_to_emergency(
    response: EmergencyResponse,
    current_user: dict = Depends(require_roles(["operator"]))
):
    """Operator responds to an emergency booking request"""
    db = get_database()
    now = datetime.now(timezone.utc).isoformat()
    
    # Get emergency booking
    emergency = await db.emergency_bookings.find_one(
        {"id": response.emergency_booking_id},
        {"_id": 0}
    )
    
    if not emergency:
        raise HTTPException(status_code=404, detail="Emergency booking not found")
    
    if emergency["status"] not in ["broadcasting", "awaiting_responses"]:
        raise HTTPException(status_code=400, detail="Emergency booking is no longer accepting responses")
    
    # Validation: aircraft_id required when can_fulfill is True
    if response.can_fulfill and not response.aircraft_id:
        raise HTTPException(
            status_code=400, 
            detail="aircraft_id is required when can_fulfill is True / जब आप पूर्ति कर सकते हैं तो aircraft_id आवश्यक है"
        )
    
    # Validate aircraft belongs to operator
    if response.can_fulfill and response.aircraft_id:
        aircraft = await db.aircraft_catalog.find_one({
            "id": response.aircraft_id,
            "operator_id": current_user["id"]
        })
        if not aircraft:
            raise HTTPException(status_code=403, detail="Aircraft not found or doesn't belong to you")
    
    # Add response
    operator_response = {
        "operator_id": current_user["id"],
        "operator_email": current_user.get("email"),
        "can_fulfill": response.can_fulfill,
        "aircraft_id": response.aircraft_id,
        "estimated_arrival_minutes": response.estimated_arrival_minutes,
        "price": response.price,
        "notes": response.notes,
        "responded_at": now
    }
    
    await db.emergency_bookings.update_one(
        {"id": response.emergency_booking_id},
        {
            "$push": {"responses": operator_response},
            "$set": {"updated_at": now}
        }
    )
    
    # Update emergency alert status
    await db.emergency_alerts.update_one(
        {
            "emergency_booking_id": response.emergency_booking_id,
            "operator_id": current_user["id"]
        },
        {"$set": {"status": "responded", "responded_at": now}}
    )
    
    # Notify customer about new response
    await db.notifications.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": emergency["customer_id"],
        "type": "emergency_response",
        "title": "New Response to Your Emergency Request",
        "message": f"An operator has responded to your emergency booking. {'They can fulfill your request!' if response.can_fulfill else 'They are unable to fulfill at this time.'}",
        "data": {
            "emergency_booking_id": response.emergency_booking_id,
            "can_fulfill": response.can_fulfill,
            "price": response.price
        },
        "priority": "high",
        "is_read": False,
        "created_at": now
    })
    
    return {
        "success": True,
        "message": "Response submitted successfully"
    }


@router.post("/{emergency_id}/select-operator")
async def select_emergency_operator(
    emergency_id: str,
    operator_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Customer selects an operator for their emergency booking"""
    db = get_database()
    now = datetime.now(timezone.utc).isoformat()
    
    emergency = await db.emergency_bookings.find_one({"id": emergency_id}, {"_id": 0})
    
    if not emergency:
        raise HTTPException(status_code=404, detail="Emergency booking not found")
    
    if emergency["customer_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not your emergency booking")
    
    # Find the response
    selected_response = None
    for resp in emergency.get("responses", []):
        if resp["operator_id"] == operator_id and resp["can_fulfill"]:
            selected_response = resp
            break
    
    if not selected_response:
        raise HTTPException(status_code=400, detail="No valid response from this operator")
    
    # Update emergency booking
    await db.emergency_bookings.update_one(
        {"id": emergency_id},
        {
            "$set": {
                "status": "operator_selected",
                "selected_operator_id": operator_id,
                "selected_aircraft_id": selected_response.get("aircraft_id"),
                "confirmed_price": selected_response.get("price"),
                "selected_at": now,
                "updated_at": now
            }
        }
    )
    
    # Notify selected operator
    await db.notifications.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": operator_id,
        "type": "emergency_confirmed",
        "title": "🎉 Emergency Booking Confirmed!",
        "message": f"Your response has been accepted for emergency booking {emergency['emergency_number']}. Please prepare for immediate dispatch.",
        "data": {"emergency_booking_id": emergency_id},
        "priority": "critical",
        "is_read": False,
        "created_at": now
    })
    
    return {
        "success": True,
        "message": "Operator selected. They have been notified.",
        "confirmed_price": selected_response.get("price")
    }


@router.get("/my-requests")
async def get_my_emergency_requests(
    current_user: dict = Depends(get_current_user),
    status: Optional[str] = None,
    limit: int = Query(default=20, le=50)
):
    """Get customer's emergency booking requests"""
    db = get_database()
    
    query = {"customer_id": current_user["id"]}
    if status:
        query["status"] = status
    
    emergencies = await db.emergency_bookings.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).to_list(limit)
    
    return {
        "emergency_bookings": emergencies,
        "count": len(emergencies)
    }


@router.get("/operator/pending")
async def get_operator_pending_emergencies(
    current_user: dict = Depends(require_roles(["operator"]))
):
    """Get pending emergency requests for operator"""
    db = get_database()
    
    # Get alerts for this operator
    alerts = await db.emergency_alerts.find(
        {
            "operator_id": current_user["id"],
            "status": "pending",
            "expires_at": {"$gt": datetime.now(timezone.utc).isoformat()}
        },
        {"_id": 0}
    ).sort("notified_at", -1).to_list(20)
    
    # Get full emergency details
    emergencies = []
    for alert in alerts:
        emergency = await db.emergency_bookings.find_one(
            {"id": alert["emergency_booking_id"]},
            {"_id": 0}
        )
        if emergency and emergency["status"] in ["broadcasting", "awaiting_responses"]:
            emergencies.append({
                **emergency,
                "alert_aircraft_id": alert.get("aircraft_id"),
                "alert_expires_at": alert.get("expires_at")
            })
    
    return {
        "pending_emergencies": emergencies,
        "count": len(emergencies)
    }


@router.get("/queue")
async def get_emergency_queue(
    current_user: dict = Depends(require_roles(["admin"]))
):
    """Admin view of the emergency priority queue"""
    db = get_database()
    
    # Get all active emergencies, sorted by priority
    emergencies = await db.emergency_bookings.find(
        {"status": {"$in": ["broadcasting", "awaiting_responses"]}},
        {"_id": 0}
    ).sort([
        ("priority_score", 1),  # Lower = more urgent
        ("created_at", 1)  # FIFO for same priority
    ]).to_list(50)
    
    return {
        "emergency_queue": emergencies,
        "count": len(emergencies),
        "priority_levels": URGENCY_LEVELS
    }
