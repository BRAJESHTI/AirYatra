"""
Command Center Routes - 24×7 Monitoring Dashboard
Live Flights, Pending Approvals, SOS Alerts, AI Warnings
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone, timedelta
from bson import ObjectId
from database import get_database

router = APIRouter(prefix="/command-center", tags=["command-center"])

def serialize_doc(doc):
    if doc and "_id" in doc:
        doc["_id"] = str(doc["_id"])
    return doc

# Get live dashboard stats
@router.get("/dashboard")
async def get_command_center_dashboard():
    db = get_database()
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    yesterday = now - timedelta(hours=24)
    
    # Live Flights (in progress today)
    live_flights = await db.bookings.find({
        "status": {"$in": ["confirmed", "in_progress", "boarding"]},
        "flight_date": {"$gte": today_start.isoformat()[:10]}
    }).limit(20).to_list(length=20)
    
    # Pending Approvals
    pending_approvals = await db.approval_requests.find({
        "status": "pending"
    }).sort("created_at", -1).limit(20).to_list(length=20)
    
    # SOS Alerts (last 24 hours)
    sos_alerts = await db.sos_alerts.find({
        "created_at": {"$gte": yesterday}
    }).sort("created_at", -1).limit(10).to_list(length=10)
    
    # AI Warnings
    ai_warnings = await db.ai_warnings.find({
        "status": "active",
        "created_at": {"$gte": yesterday}
    }).sort("priority", -1).limit(10).to_list(length=10)
    
    # System Health
    system_health = {
        "database": "healthy",
        "api": "healthy",
        "payment_gateway": "healthy",
        "email_service": "healthy",
        "sms_service": "healthy"
    }
    
    # Quick Stats
    total_bookings_today = await db.bookings.count_documents({"created_at": {"$gte": today_start}})
    active_operators = await db.users.count_documents({"roles": "operator", "is_active": True})
    active_pilots = await db.users.count_documents({"roles": "pilot", "is_active": True})
    
    # Today's revenue
    today_payments = await db.payments.find({
        "status": "completed",
        "created_at": {"$gte": today_start}
    }).to_list(length=100)
    revenue_today = sum(p.get("amount", 0) for p in today_payments)
    
    stats = {
        "total_bookings_today": total_bookings_today,
        "active_flights": len(live_flights),
        "pending_approvals": len(pending_approvals),
        "sos_alerts_24h": len(sos_alerts),
        "active_operators": active_operators,
        "active_pilots": active_pilots,
        "revenue_today": revenue_today,
        "customers_online": 0
    }
    
    return {
        "live_flights": [serialize_doc(f) for f in live_flights],
        "pending_approvals": [serialize_doc(a) for a in pending_approvals],
        "sos_alerts": [serialize_doc(s) for s in sos_alerts],
        "ai_warnings": [serialize_doc(w) for w in ai_warnings],
        "system_health": system_health,
        "stats": stats,
        "last_updated": now.isoformat()
    }

# Get live flights
@router.get("/live-flights")
async def get_live_flights():
    db = get_database()
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    flights = await db.bookings.find({
        "status": {"$in": ["confirmed", "in_progress", "boarding", "departed"]},
        "flight_date": {"$gte": today}
    }).sort("flight_date", 1).limit(50).to_list(length=50)
    
    # Enrich with operator and pilot info
    for flight in flights:
        flight["_id"] = str(flight["_id"])
        if "operator_id" in flight and flight["operator_id"]:
            try:
                operator = await db.users.find_one({"_id": ObjectId(flight["operator_id"])}, {"name": 1, "company_name": 1})
                flight["operator_name"] = operator.get("company_name") or operator.get("name") if operator else "Unknown"
            except:
                flight["operator_name"] = "Unknown"
        if "pilot_id" in flight and flight["pilot_id"]:
            try:
                pilot = await db.users.find_one({"_id": ObjectId(flight["pilot_id"])}, {"name": 1})
                flight["pilot_name"] = pilot.get("name") if pilot else "Unassigned"
            except:
                flight["pilot_name"] = "Unassigned"
    
    return {"flights": flights, "count": len(flights)}

# Get pending approvals
@router.get("/pending-approvals")
async def get_pending_approvals():
    db = get_database()
    
    approvals = await db.approval_requests.find({
        "status": "pending"
    }).sort("created_at", -1).limit(50).to_list(length=50)
    
    # Enrich with requester info
    for approval in approvals:
        approval["_id"] = str(approval["_id"])
        if "requested_by" in approval and approval["requested_by"]:
            try:
                user = await db.users.find_one({"_id": ObjectId(approval["requested_by"])}, {"name": 1, "email": 1})
                approval["requester_name"] = user.get("name") if user else "Unknown"
            except:
                approval["requester_name"] = "Unknown"
    
    return {"approvals": approvals, "count": len(approvals)}

# Create SOS Alert
@router.post("/sos-alert")
async def create_sos_alert(
    alert_type: str,
    message: str,
    location: Optional[str] = None,
    flight_id: Optional[str] = None,
    pilot_id: Optional[str] = None,
    severity: str = "high"
):
    db = get_database()
    
    alert = {
        "type": alert_type,
        "message": message,
        "location": location,
        "flight_id": flight_id,
        "pilot_id": pilot_id,
        "severity": severity,
        "status": "active",
        "created_at": datetime.now(timezone.utc),
        "resolved_at": None,
        "resolved_by": None
    }
    
    result = await db.sos_alerts.insert_one(alert)
    alert["_id"] = str(result.inserted_id)
    
    # Also create urgent notification
    await db.notifications.insert_one({
        "type": "alert",
        "title": f"🚨 SOS Alert: {alert_type.upper()}",
        "message": message,
        "priority": "urgent",
        "metadata": {"alert_id": str(result.inserted_id), "location": location},
        "is_read": False,
        "is_archived": False,
        "created_at": datetime.now(timezone.utc)
    })
    
    return {"success": True, "alert": alert}

# Resolve SOS Alert
@router.put("/sos-alert/{alert_id}/resolve")
async def resolve_sos_alert(alert_id: str, resolved_by: str, resolution_notes: str = ""):
    db = get_database()
    
    result = await db.sos_alerts.update_one(
        {"_id": ObjectId(alert_id)},
        {
            "$set": {
                "status": "resolved",
                "resolved_at": datetime.now(timezone.utc),
                "resolved_by": resolved_by,
                "resolution_notes": resolution_notes
            }
        }
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Alert not found")
    
    return {"success": True, "message": "Alert resolved"}

# Create AI Warning
@router.post("/ai-warning")
async def create_ai_warning(
    warning_type: str,
    title: str,
    description: str,
    priority: int = 5,
    recommended_action: str = "",
    affected_entity: str = "",
    entity_id: str = ""
):
    db = get_database()
    
    warning = {
        "type": warning_type,
        "title": title,
        "description": description,
        "priority": priority,
        "recommended_action": recommended_action,
        "affected_entity": affected_entity,
        "entity_id": entity_id,
        "status": "active",
        "created_at": datetime.now(timezone.utc),
        "acknowledged_at": None,
        "acknowledged_by": None
    }
    
    result = await db.ai_warnings.insert_one(warning)
    warning["_id"] = str(result.inserted_id)
    
    return {"success": True, "warning": warning}

# Acknowledge AI Warning
@router.put("/ai-warning/{warning_id}/acknowledge")
async def acknowledge_ai_warning(warning_id: str, acknowledged_by: str):
    db = get_database()
    
    result = await db.ai_warnings.update_one(
        {"_id": ObjectId(warning_id)},
        {
            "$set": {
                "status": "acknowledged",
                "acknowledged_at": datetime.now(timezone.utc),
                "acknowledged_by": acknowledged_by
            }
        }
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Warning not found")
    
    return {"success": True, "message": "Warning acknowledged"}

# Get system health
@router.get("/system-health")
async def get_system_health():
    db = get_database()
    
    # Check database
    try:
        await db.command("ping")
        db_status = "healthy"
    except:
        db_status = "unhealthy"
    
    # Get collection stats
    collections = {
        "users": await db.users.count_documents({}),
        "bookings": await db.bookings.count_documents({}),
        "payments": await db.payments.count_documents({}),
        "notifications": await db.notifications.count_documents({})
    }
    
    return {
        "status": "operational" if db_status == "healthy" else "degraded",
        "database": db_status,
        "api": "healthy",
        "collections": collections,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }

# Get activity feed
@router.get("/activity-feed")
async def get_activity_feed(limit: int = 50):
    db = get_database()
    now = datetime.now(timezone.utc)
    since = now - timedelta(hours=24)
    
    activities = []
    
    # Recent bookings
    bookings = await db.bookings.find({
        "created_at": {"$gte": since}
    }).sort("created_at", -1).limit(20).to_list(length=20)
    
    for b in bookings:
        activities.append({
            "type": "booking",
            "action": "created",
            "title": f"New Booking #{str(b['_id'])[-6:]}",
            "description": f"{b.get('origin', 'N/A')} → {b.get('destination', 'N/A')}",
            "timestamp": b.get("created_at"),
            "entity_id": str(b["_id"])
        })
    
    # Recent payments
    payments = await db.payments.find({
        "created_at": {"$gte": since}
    }).sort("created_at", -1).limit(20).to_list(length=20)
    
    for p in payments:
        activities.append({
            "type": "payment",
            "action": p.get("status", "received"),
            "title": f"Payment ₹{p.get('amount', 0):,.0f}",
            "description": f"Status: {p.get('status', 'pending')}",
            "timestamp": p.get("created_at"),
            "entity_id": str(p["_id"])
        })
    
    # Sort by timestamp
    activities.sort(key=lambda x: x.get("timestamp") or datetime.min, reverse=True)
    
    return {"activities": activities[:limit]}

# Get operator status
@router.get("/operator-status")
async def get_operator_status():
    db = get_database()
    
    operators = await db.users.find(
        {"roles": "operator"},
        {"name": 1, "company_name": 1, "is_active": 1, "last_login": 1, "email": 1}
    ).to_list(length=100)
    
    active = []
    inactive = []
    
    for op in operators:
        op["_id"] = str(op["_id"])
        if op.get("is_active", True):
            active.append(op)
        else:
            inactive.append(op)
    
    return {
        "active_count": len(active),
        "inactive_count": len(inactive),
        "active_operators": active,
        "inactive_operators": inactive
    }
