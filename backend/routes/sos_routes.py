from fastapi import APIRouter, HTTPException, Depends, Query, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, timezone, timedelta
from uuid import uuid4
import json
from database import get_database
from routes.auth_routes import get_current_user

router = APIRouter(prefix="/sos", tags=["Emergency SOS"])

# Active WebSocket connections for real-time alerts
active_connections: dict = {}  # {alert_id: [websocket_connections]}

# Models
class SOSAlert(BaseModel):
    booking_id: Optional[str] = None
    location_lat: float
    location_lon: float
    emergency_type: str = "general"  # general, medical, mechanical, weather, security
    message: Optional[str] = None
    contact_name: Optional[str] = None
    contact_phone: Optional[str] = None

class SOSUpdate(BaseModel):
    status: str  # active, acknowledged, responding, resolved, false_alarm
    notes: Optional[str] = None
    responder_id: Optional[str] = None

class LocationUpdate(BaseModel):
    alert_id: str
    lat: float
    lon: float

# API Endpoints
@router.post("/alert")
async def create_sos_alert(alert: SOSAlert, current_user: dict = Depends(get_current_user)):
    """Create emergency SOS alert"""
    db = get_database()
    
    # Get booking details if provided
    booking_info = None
    if alert.booking_id:
        booking = await db.bookings.find_one({"id": alert.booking_id})
        if booking:
            booking_info = {
                "booking_number": booking.get("booking_number"),
                "origin": booking.get("origin"),
                "destination": booking.get("destination"),
                "aircraft": booking.get("aircraft_registration"),
                "pilot": booking.get("pilot_name")
            }
    
    alert_data = {
        "id": str(uuid4()),
        "alert_number": f"SOS{datetime.now().strftime('%Y%m%d%H%M%S')}",
        "user_id": current_user["id"],
        "user_name": current_user.get("full_name"),
        "user_phone": current_user.get("phone"),
        "user_email": current_user.get("email"),
        "booking_id": alert.booking_id,
        "booking_info": booking_info,
        "emergency_type": alert.emergency_type,
        "message": alert.message,
        "emergency_contact_name": alert.contact_name,
        "emergency_contact_phone": alert.contact_phone,
        "initial_location": {
            "lat": alert.location_lat,
            "lon": alert.location_lon,
            "timestamp": datetime.now(timezone.utc).isoformat()
        },
        "current_location": {
            "lat": alert.location_lat,
            "lon": alert.location_lon,
            "timestamp": datetime.now(timezone.utc).isoformat()
        },
        "location_history": [{
            "lat": alert.location_lat,
            "lon": alert.location_lon,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }],
        "status": "active",
        "priority": "critical",
        "acknowledged_by": None,
        "acknowledged_at": None,
        "responders": [],
        "notes": [],
        "resolved_at": None,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.sos_alerts.insert_one(alert_data)
    alert_data.pop("_id", None)
    
    # Create notification for all admins
    admins = await db.users.find({"roles": "admin"}, {"_id": 0, "id": 1}).to_list(100)
    for admin in admins:
        await db.notifications.insert_one({
            "id": str(uuid4()),
            "user_id": admin["id"],
            "type": "sos_alert",
            "title": f"🚨 EMERGENCY SOS ALERT",
            "message": f"{current_user.get('full_name')} has triggered an SOS alert. Type: {alert.emergency_type}",
            "reference_id": alert_data["id"],
            "priority": "critical",
            "read": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
    
    return {
        "message": "SOS Alert sent! Help is on the way.",
        "alert": alert_data,
        "instructions": [
            "Stay calm and stay in a safe location if possible",
            "Keep your phone charged and within reach",
            "Our team has been notified and will contact you shortly",
            "If possible, send location updates using the app"
        ]
    }

@router.post("/alert/{alert_id}/location")
async def update_location(alert_id: str, location: LocationUpdate, current_user: dict = Depends(get_current_user)):
    """Update location for active alert"""
    db = get_database()
    
    alert = await db.sos_alerts.find_one({"id": alert_id})
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    
    if alert["user_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    location_data = {
        "lat": location.lat,
        "lon": location.lon,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    
    await db.sos_alerts.update_one(
        {"id": alert_id},
        {
            "$set": {"current_location": location_data},
            "$push": {"location_history": location_data}
        }
    )
    
    return {"message": "Location updated"}

@router.get("/my-alerts")
async def get_my_alerts(current_user: dict = Depends(get_current_user)):
    """Get user's SOS alerts"""
    db = get_database()
    
    alerts = await db.sos_alerts.find(
        {"user_id": current_user["id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(20)
    
    return {"alerts": alerts}

@router.post("/alert/{alert_id}/cancel")
async def cancel_alert(alert_id: str, reason: str = "false_alarm", current_user: dict = Depends(get_current_user)):
    """Cancel SOS alert"""
    db = get_database()
    
    alert = await db.sos_alerts.find_one({"id": alert_id})
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    
    if alert["user_id"] != current_user["id"] and "admin" not in current_user.get("roles", []):
        raise HTTPException(status_code=403, detail="Access denied")
    
    await db.sos_alerts.update_one(
        {"id": alert_id},
        {"$set": {
            "status": "cancelled",
            "cancel_reason": reason,
            "cancelled_at": datetime.now(timezone.utc).isoformat(),
            "cancelled_by": current_user["id"]
        }}
    )
    
    return {"message": "Alert cancelled"}

# Admin Endpoints
@router.get("/admin/active")
async def get_active_alerts(current_user: dict = Depends(get_current_user)):
    """Get all active SOS alerts"""
    if "admin" not in current_user.get("roles", []):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    db = get_database()
    
    alerts = await db.sos_alerts.find(
        {"status": {"$in": ["active", "acknowledged", "responding"]}},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    return {"alerts": alerts, "count": len(alerts)}

@router.get("/admin/dashboard")
async def get_sos_dashboard(current_user: dict = Depends(get_current_user)):
    """Get SOS dashboard"""
    if "admin" not in current_user.get("roles", []):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    db = get_database()
    
    # Active alerts
    active_count = await db.sos_alerts.count_documents({"status": {"$in": ["active", "acknowledged", "responding"]}})
    
    # Total alerts
    total_alerts = await db.sos_alerts.count_documents({})
    
    # Resolved today
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0).isoformat()
    resolved_today = await db.sos_alerts.count_documents({
        "status": "resolved",
        "resolved_at": {"$gte": today_start}
    })
    
    # By type
    pipeline = [
        {"$group": {"_id": "$emergency_type", "count": {"$sum": 1}}}
    ]
    type_breakdown = {}
    async for doc in db.sos_alerts.aggregate(pipeline):
        type_breakdown[doc["_id"]] = doc["count"]
    
    # Recent alerts
    recent_alerts = await db.sos_alerts.find(
        {},
        {"_id": 0, "alert_number": 1, "user_name": 1, "emergency_type": 1, "status": 1, "created_at": 1}
    ).sort("created_at", -1).limit(10).to_list(10)
    
    # Average response time
    pipeline = [
        {"$match": {"acknowledged_at": {"$ne": None}}},
        {"$limit": 100}
    ]
    # Simplified - would need proper date math in real implementation
    
    return {
        "active_alerts": active_count,
        "total_alerts": total_alerts,
        "resolved_today": resolved_today,
        "type_breakdown": type_breakdown,
        "recent_alerts": recent_alerts
    }

@router.get("/admin/alert/{alert_id}")
async def get_alert_details(alert_id: str, current_user: dict = Depends(get_current_user)):
    """Get detailed alert info"""
    if "admin" not in current_user.get("roles", []):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    db = get_database()
    
    alert = await db.sos_alerts.find_one({"id": alert_id}, {"_id": 0})
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    
    return alert

@router.put("/admin/alert/{alert_id}")
async def update_alert(alert_id: str, update: SOSUpdate, current_user: dict = Depends(get_current_user)):
    """Update SOS alert status"""
    if "admin" not in current_user.get("roles", []):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    db = get_database()
    
    update_data = {
        "status": update.status,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    if update.status == "acknowledged" and not update.responder_id:
        update_data["acknowledged_by"] = current_user["id"]
        update_data["acknowledged_at"] = datetime.now(timezone.utc).isoformat()
    
    if update.status == "resolved":
        update_data["resolved_at"] = datetime.now(timezone.utc).isoformat()
        update_data["resolved_by"] = current_user["id"]
    
    if update.notes:
        note_entry = {
            "text": update.notes,
            "by": current_user["id"],
            "by_name": current_user.get("full_name"),
            "at": datetime.now(timezone.utc).isoformat()
        }
        await db.sos_alerts.update_one(
            {"id": alert_id},
            {"$push": {"notes": note_entry}}
        )
    
    result = await db.sos_alerts.update_one({"id": alert_id}, {"$set": update_data})
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Alert not found")
    
    # Notify user
    alert = await db.sos_alerts.find_one({"id": alert_id})
    if alert:
        status_messages = {
            "acknowledged": "Your SOS alert has been acknowledged. Help is being coordinated.",
            "responding": "Emergency responders are on their way to your location.",
            "resolved": "Your emergency has been marked as resolved. Stay safe!"
        }
        
        if update.status in status_messages:
            await db.notifications.insert_one({
                "id": str(uuid4()),
                "user_id": alert["user_id"],
                "type": "sos_update",
                "title": f"SOS Alert Update",
                "message": status_messages[update.status],
                "reference_id": alert_id,
                "read": False,
                "created_at": datetime.now(timezone.utc).isoformat()
            })
    
    return {"message": f"Alert status updated to {update.status}"}

@router.get("/emergency-contacts")
async def get_emergency_contacts():
    """Get emergency contact numbers"""
    return {
        "contacts": [
            {"name": "AirYatra Emergency", "number": "1800-XXX-XXXX", "available": "24x7"},
            {"name": "Police", "number": "100", "available": "24x7"},
            {"name": "Ambulance", "number": "102", "available": "24x7"},
            {"name": "DGCA Helpline", "number": "011-2461-0243", "available": "Office hours"},
            {"name": "Airport Emergency", "number": "Varies by airport", "available": "24x7"}
        ]
    }
