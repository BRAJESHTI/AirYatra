"""
Inquiry Broadcast Service - Auto distribute inquiries to operators within radius
"""
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Optional
from uuid import uuid4
import math
import logging
from database import get_database

logger = logging.getLogger(__name__)

# Default settings
DEFAULT_BROADCAST_RADIUS_KM = 500
DEFAULT_EXPIRE_MINUTES = 30
DEFAULT_MAX_OPERATORS = 50

def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculate distance between two points using Haversine formula
    Returns distance in kilometers
    """
    R = 6371  # Earth's radius in kilometers
    
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    delta_lat = math.radians(lat2 - lat1)
    delta_lon = math.radians(lon2 - lon1)
    
    a = math.sin(delta_lat / 2) ** 2 + \
        math.cos(lat1_rad) * math.cos(lat2_rad) * \
        math.sin(delta_lon / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    
    return R * c

async def get_broadcast_settings() -> dict:
    """Get admin configured broadcast settings"""
    db = get_database()
    
    settings = await db.settings.find_one(
        {"type": "inquiry_broadcast"},
        {"_id": 0}
    )
    
    if not settings:
        # Return defaults
        return {
            "broadcast_radius_km": DEFAULT_BROADCAST_RADIUS_KM,
            "whatsapp_enabled": True,
            "in_app_enabled": True,
            "max_operators_per_inquiry": DEFAULT_MAX_OPERATORS,
            "auto_expire_minutes": DEFAULT_EXPIRE_MINUTES,
            "enabled": True
        }
    
    return settings

async def find_operators_in_radius(
    pickup_lat: float,
    pickup_lon: float,
    radius_km: float = DEFAULT_BROADCAST_RADIUS_KM,
    max_operators: int = DEFAULT_MAX_OPERATORS
) -> List[dict]:
    """
    Find all eligible operators within radius of pickup location
    Uses operator base location OR aircraft location
    """
    try:
        db = get_database()
        if db is None:
            logger.error("Database connection not available in find_operators_in_radius")
            return []
    except Exception as e:
        logger.error(f"Database error in find_operators_in_radius: {e}")
        return []
    
    # Get all active, verified operators
    operators = await db.operators.find(
        {
            "status": "active",
            "verification_status": {"$in": ["verified", "approved"]}
        },
        {"_id": 0}
    ).to_list(1000)
    
    logger.info(f"Found {len(operators)} active operators to check")
    
    eligible_operators = []
    
    for operator in operators:
        # Check operator base location
        base_lat = operator.get("base_latitude")
        base_lon = operator.get("base_longitude")
        
        logger.debug(f"Checking operator: {operator.get('company_name')} - lat: {base_lat}, lon: {base_lon}")
        
        if base_lat and base_lon:
            try:
                distance = haversine_distance(pickup_lat, pickup_lon, float(base_lat), float(base_lon))
                logger.debug(f"  Distance: {distance} km (max: {radius_km})")
                if distance <= radius_km:
                    eligible_operators.append({
                        **operator,
                        "distance_km": round(distance, 2),
                        "match_type": "base_location"
                    })
                    logger.info(f"  ✅ Eligible: {operator.get('company_name')} ({distance:.1f} km)")
                    continue
            except Exception as e:
                logger.error(f"  Distance calc error for {operator.get('company_name')}: {e}")
        
        # Check aircraft locations for this operator
        aircraft_list = await db.aircraft.find(
            {
                "operator_id": operator["id"],
                "status": "active"
            },
            {"_id": 0, "current_latitude": 1, "current_longitude": 1, "registration_number": 1}
        ).to_list(50)
        
        for aircraft in aircraft_list:
            ac_lat = aircraft.get("current_latitude")
            ac_lon = aircraft.get("current_longitude")
            
            if ac_lat and ac_lon:
                distance = haversine_distance(pickup_lat, pickup_lon, ac_lat, ac_lon)
                if distance <= radius_km:
                    eligible_operators.append({
                        **operator,
                        "distance_km": round(distance, 2),
                        "match_type": "aircraft_location",
                        "matched_aircraft": aircraft.get("registration_number")
                    })
                    break  # Don't add same operator multiple times
    
    # Sort by distance and limit
    eligible_operators.sort(key=lambda x: x["distance_km"])
    return eligible_operators[:max_operators]

async def create_inquiry_broadcast(
    inquiry_id: str,
    booking_data: dict,
    pickup_lat: float,
    pickup_lon: float
) -> dict:
    """
    Main function to broadcast inquiry to all eligible operators
    """
    db = get_database()
    
    # Get broadcast settings
    settings = await get_broadcast_settings()
    
    if not settings.get("enabled", True):
        logger.info(f"Inquiry broadcast disabled, skipping for {inquiry_id}")
        return {"status": "disabled", "operators_notified": 0}
    
    radius_km = settings.get("broadcast_radius_km", DEFAULT_BROADCAST_RADIUS_KM)
    max_operators = settings.get("max_operators_per_inquiry", DEFAULT_MAX_OPERATORS)
    expire_minutes = settings.get("auto_expire_minutes", DEFAULT_EXPIRE_MINUTES)
    
    # Find eligible operators
    eligible_operators = await find_operators_in_radius(
        pickup_lat, pickup_lon, radius_km, max_operators
    )
    
    if not eligible_operators:
        logger.warning(f"No eligible operators found within {radius_km}km for inquiry {inquiry_id}")
        return {"status": "no_operators", "operators_notified": 0}
    
    broadcast_id = str(uuid4())
    expire_at = datetime.now(timezone.utc) + timedelta(minutes=expire_minutes)
    
    # Create broadcast record
    broadcast = {
        "id": broadcast_id,
        "inquiry_id": inquiry_id,
        "booking_id": booking_data.get("id"),
        "pickup_location": booking_data.get("from_location"),
        "pickup_lat": pickup_lat,
        "pickup_lon": pickup_lon,
        "drop_location": booking_data.get("to_location"),
        "radius_km": radius_km,
        "total_operators_found": len(eligible_operators),
        "status": "active",
        "expire_at": expire_at.isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.inquiry_broadcasts.insert_one(broadcast.copy())
    
    # Create operator mappings and notifications
    notifications_sent = 0
    
    for operator in eligible_operators:
        mapping_id = str(uuid4())
        
        # Create inquiry-operator mapping
        mapping = {
            "id": mapping_id,
            "broadcast_id": broadcast_id,
            "inquiry_id": inquiry_id,
            "booking_id": booking_data.get("id"),
            "operator_id": operator["id"],
            "operator_name": operator.get("company_name"),
            "distance_km": operator["distance_km"],
            "match_type": operator["match_type"],
            "status": "pending",  # pending, accepted, rejected, expired
            "whatsapp_sent": False,
            "in_app_sent": False,
            "action_taken_at": None,
            "action_ip": None,
            "action_device": None,
            "rejection_reason": None,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "expire_at": expire_at.isoformat()
        }
        
        await db.inquiry_operator_mappings.insert_one(mapping.copy())
        
        # Prepare notification data (hide customer contact)
        notification_data = prepare_operator_notification(booking_data, operator["distance_km"])
        
        # Send In-App Notification
        if settings.get("in_app_enabled", True):
            await send_in_app_notification(operator, notification_data, inquiry_id, mapping_id)
            mapping["in_app_sent"] = True
        
        # Send WhatsApp Notification
        if settings.get("whatsapp_enabled", True) and operator.get("whatsapp_number"):
            whatsapp_sent = await send_whatsapp_notification(operator, notification_data, inquiry_id, mapping_id)
            if whatsapp_sent:
                mapping["whatsapp_sent"] = True
                await db.inquiry_operator_mappings.update_one(
                    {"id": mapping_id},
                    {"$set": {"whatsapp_sent": True}}
                )
        
        notifications_sent += 1
    
    # Update broadcast with final count
    await db.inquiry_broadcasts.update_one(
        {"id": broadcast_id},
        {"$set": {"notifications_sent": notifications_sent}}
    )
    
    logger.info(f"Broadcast {broadcast_id}: {notifications_sent} operators notified for inquiry {inquiry_id}")
    
    return {
        "status": "success",
        "broadcast_id": broadcast_id,
        "operators_notified": notifications_sent,
        "radius_km": radius_km,
        "expire_at": expire_at.isoformat()
    }

def prepare_operator_notification(booking_data: dict, distance_km: float) -> dict:
    """
    Prepare notification data for operator
    IMPORTANT: Customer contact details are NOT included
    """
    
    # Map booking_for to readable format
    customer_type_map = {
        "self": "Individual",
        "friend_family": "Individual (Family)",
        "company": "Corporate",
        "political": "Political / VIP",
        "other": "Other"
    }
    
    # Map booking_purpose to readable format
    purpose_map = {
        "wedding": "Wedding / शादी",
        "temple_yatra": "Temple / Pilgrimage",
        "company_tour": "Corporate Tour",
        "election_tour": "Election / Political",
        "general_tour": "General Tour",
        "medical_emergency": "Medical / Air Ambulance",
        "business_meeting": "Business Meeting",
        "pilgrimage": "Pilgrimage / तीर्थ यात्रा",
        "film_shooting": "Film/Media Shooting",
        "survey_inspection": "Survey/Inspection",
        "other": "Other"
    }
    
    # Map flight_type to readable format
    trip_type_map = {
        "one_hour": "Hourly (1 Hr)",
        "two_hour": "Hourly (2 Hr)",
        "half_day": "Half Day",
        "full_day_single": "Full Day",
        "full_day_multi": "Multi-City Tour",
        "point_to_point": "One Way"
    }
    
    return {
        "booking_number": booking_data.get("inquiry_number") or booking_data.get("booking_number", "N/A"),
        "customer_type": customer_type_map.get(booking_data.get("booking_for"), "Individual"),
        "generated_by": booking_data.get("company_name") if booking_data.get("booking_for") == "company" else "Customer",
        "booking_date": booking_data.get("departure_date"),
        "booking_time": booking_data.get("pickup_time"),
        "pickup_location": booking_data.get("pickup_location") or booking_data.get("from_location"),
        "pickup_district": booking_data.get("pickup_district") or booking_data.get("from_district"),
        "pickup_state": booking_data.get("pickup_state") or booking_data.get("from_state"),
        "drop_location": booking_data.get("drop_location") or booking_data.get("to_location"),
        "drop_district": booking_data.get("drop_district") or booking_data.get("to_district"),
        "drop_state": booking_data.get("drop_state") or booking_data.get("to_state"),
        "passengers": booking_data.get("total_passengers") or booking_data.get("passengers", 1),
        "purpose": purpose_map.get(booking_data.get("booking_purpose"), "General"),
        "trip_type": trip_type_map.get(booking_data.get("udan_prakar") or booking_data.get("flight_type"), "One Way"),
        "estimated_amount": booking_data.get("estimated_price", 0),
        "special_instructions": booking_data.get("special_requirements", ""),
        "distance_from_operator": distance_km,
        # DO NOT include customer phone, email, or full name
    }

async def send_in_app_notification(operator: dict, notification_data: dict, inquiry_id: str, mapping_id: str):
    """Send in-app notification to operator"""
    db = get_database()
    
    notification = {
        "id": str(uuid4()),
        "user_id": operator.get("user_id"),
        "type": "inquiry_broadcast",
        "title": "🚁 New Booking Inquiry - AirYatra",
        "message": f"New inquiry from {notification_data['pickup_location']} to {notification_data['drop_location']}",
        "data": {
            "inquiry_id": inquiry_id,
            "mapping_id": mapping_id,
            "notification_data": notification_data
        },
        "read": False,
        "action_url": f"/operator/inquiries/{inquiry_id}",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.notifications.insert_one(notification.copy())
    
    # TODO: Send real-time WebSocket notification if operator is online
    
    return True

async def send_whatsapp_notification(operator: dict, notification_data: dict, inquiry_id: str, mapping_id: str) -> bool:
    """Send WhatsApp notification to operator"""
    db = get_database()
    
    # Get API settings
    api_settings = await db.settings.find_one({"type": "api_keys"}, {"_id": 0})
    
    if not api_settings or not api_settings.get("twilio_account_sid"):
        logger.warning("WhatsApp (Twilio) not configured, skipping notification")
        return False
    
    whatsapp_number = operator.get("whatsapp_number") or operator.get("phone")
    if not whatsapp_number:
        return False
    
    # Format WhatsApp message
    message = f"""📢 *New Helicopter Booking Inquiry – AirYatra*

📍 *Pickup:* {notification_data['pickup_location']}, {notification_data['pickup_state']}
📍 *Drop:* {notification_data['drop_location']}
📅 *Date:* {notification_data['booking_date']}
⏰ *Time:* {notification_data['booking_time']}
👥 *Passengers:* {notification_data['passengers']}
🎯 *Purpose:* {notification_data['purpose']}
✈️ *Trip Type:* {notification_data['trip_type']}
💰 *Estimated Amount:* ₹{notification_data['estimated_amount']:,.0f}
📏 *Distance from you:* {notification_data['distance_from_operator']} km

🔔 Please accept or reject this inquiry from your AirYatra Operator App.

▶️ Open App: https://airyatra.com/operator/inquiries/{inquiry_id}"""

    try:
        # Use notification service
        from services.notification_service import send_whatsapp_message
        
        result = await send_whatsapp_message(
            to_number=whatsapp_number,
            message=message
        )
        
        # Log the notification
        await db.whatsapp_logs.insert_one({
            "id": str(uuid4()),
            "type": "inquiry_broadcast",
            "inquiry_id": inquiry_id,
            "mapping_id": mapping_id,
            "operator_id": operator["id"],
            "to_number": whatsapp_number,
            "message_preview": message[:200],
            "status": "sent" if result else "failed",
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        
        return result
        
    except Exception as e:
        logger.error(f"WhatsApp notification failed for operator {operator['id']}: {e}")
        return False

async def operator_accept_inquiry(
    mapping_id: str,
    operator_id: str,
    ip_address: str = None,
    device_info: str = None,
    remark: str = None
) -> dict:
    """Operator accepts an inquiry"""
    db = get_database()
    
    # Verify mapping exists and belongs to operator
    mapping = await db.inquiry_operator_mappings.find_one(
        {"id": mapping_id, "operator_id": operator_id},
        {"_id": 0}
    )
    
    if not mapping:
        return {"error": "Inquiry not found"}
    
    if mapping["status"] != "pending":
        return {"error": f"Inquiry already {mapping['status']}"}
    
    # Check if expired
    expire_at = datetime.fromisoformat(mapping["expire_at"].replace("Z", "+00:00"))
    if datetime.now(timezone.utc) > expire_at:
        await db.inquiry_operator_mappings.update_one(
            {"id": mapping_id},
            {"$set": {"status": "expired"}}
        )
        return {"error": "Inquiry has expired"}
    
    # Update mapping
    update_data = {
        "status": "accepted",
        "action_taken_at": datetime.now(timezone.utc).isoformat(),
        "action_ip": ip_address,
        "action_device": device_info,
        "remark": remark
    }
    
    await db.inquiry_operator_mappings.update_one(
        {"id": mapping_id},
        {"$set": update_data}
    )
    
    # Update booking with operator assignment
    await db.bookings.update_one(
        {"id": mapping["booking_id"]},
        {"$set": {
            "operator_id": operator_id,
            "operator_accepted_at": datetime.now(timezone.utc).isoformat(),
            "status": "operator_assigned"
        }}
    )
    
    # Log the action
    await db.inquiry_action_logs.insert_one({
        "id": str(uuid4()),
        "mapping_id": mapping_id,
        "inquiry_id": mapping["inquiry_id"],
        "operator_id": operator_id,
        "action": "accept",
        "ip_address": ip_address,
        "device_info": device_info,
        "remark": remark,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    # TODO: Notify customer that operator accepted
    # TODO: Notify admin
    
    return {"status": "accepted", "message": "Inquiry accepted successfully"}

async def operator_reject_inquiry(
    mapping_id: str,
    operator_id: str,
    reason: str = None,
    ip_address: str = None,
    device_info: str = None
) -> dict:
    """Operator rejects an inquiry"""
    db = get_database()
    
    # Verify mapping exists and belongs to operator
    mapping = await db.inquiry_operator_mappings.find_one(
        {"id": mapping_id, "operator_id": operator_id},
        {"_id": 0}
    )
    
    if not mapping:
        return {"error": "Inquiry not found"}
    
    if mapping["status"] != "pending":
        return {"error": f"Inquiry already {mapping['status']}"}
    
    # Update mapping
    update_data = {
        "status": "rejected",
        "rejection_reason": reason,
        "action_taken_at": datetime.now(timezone.utc).isoformat(),
        "action_ip": ip_address,
        "action_device": device_info
    }
    
    await db.inquiry_operator_mappings.update_one(
        {"id": mapping_id},
        {"$set": update_data}
    )
    
    # Log the action
    await db.inquiry_action_logs.insert_one({
        "id": str(uuid4()),
        "mapping_id": mapping_id,
        "inquiry_id": mapping["inquiry_id"],
        "operator_id": operator_id,
        "action": "reject",
        "reason": reason,
        "ip_address": ip_address,
        "device_info": device_info,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {"status": "rejected", "message": "Inquiry rejected"}

async def get_operator_pending_inquiries(operator_id: str) -> List[dict]:
    """Get all pending inquiries for an operator"""
    db = get_database()
    
    mappings = await db.inquiry_operator_mappings.find(
        {
            "operator_id": operator_id,
            "status": "pending"
        },
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    # Enrich with inquiry/booking details
    result = []
    for mapping in mappings:
        # Try inquiries first (new flow), then bookings (old flow)
        inquiry = await db.inquiries.find_one(
            {"id": mapping.get("inquiry_id") or mapping.get("booking_id")},
            {"_id": 0}
        )
        if not inquiry:
            inquiry = await db.bookings.find_one(
                {"id": mapping.get("booking_id")},
                {"_id": 0}
            )
        
        if inquiry:
            mapping["booking_details"] = prepare_operator_notification(inquiry, mapping.get("distance_km", 0))
            mapping["inquiry_number"] = inquiry.get("inquiry_number") or inquiry.get("booking_number")
            result.append(mapping)
    
    return result

async def expire_old_inquiries():
    """Background task to expire old pending inquiries"""
    db = get_database()
    
    now = datetime.now(timezone.utc).isoformat()
    
    result = await db.inquiry_operator_mappings.update_many(
        {
            "status": "pending",
            "expire_at": {"$lt": now}
        },
        {"$set": {"status": "expired"}}
    )
    
    if result.modified_count > 0:
        logger.info(f"Expired {result.modified_count} old inquiry mappings")
