from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from pydantic import BaseModel, Field
from typing import Optional, List, Dict
from datetime import datetime, timezone, timedelta
from uuid import uuid4
import json
from database import get_database
from routes.auth_routes import get_current_user

router = APIRouter(prefix="/notifications", tags=["Push Notifications"])

# Models
class NotificationCreate(BaseModel):
    user_id: Optional[str] = None  # None = broadcast to all
    title: str
    body: str
    notification_type: str = "general"  # booking, payment, alert, promo, reminder
    action_url: Optional[str] = None
    data: dict = {}
    scheduled_for: Optional[str] = None  # ISO datetime for scheduled notifications
    priority: str = "normal"  # low, normal, high, urgent

class DeviceRegistration(BaseModel):
    device_token: str
    platform: str  # ios, android, web
    device_name: Optional[str] = None

class NotificationPreferences(BaseModel):
    booking_updates: bool = True
    payment_alerts: bool = True
    promotional: bool = True
    reminders: bool = True
    security_alerts: bool = True
    email_notifications: bool = True
    sms_notifications: bool = False
    push_notifications: bool = True

# Helper Functions
async def send_push_notification(db, notification: dict, user_ids: List[str] = None):
    """Send push notification to users"""
    # Get device tokens
    query = {}
    if user_ids:
        query["user_id"] = {"$in": user_ids}
    
    devices = await db.device_tokens.find(query).to_list(1000)
    
    sent_count = 0
    for device in devices:
        # In production, integrate with FCM/APNs
        # For now, store in notification queue
        notification_record = {
            "id": str(uuid4()),
            "device_token": device["device_token"],
            "platform": device["platform"],
            "user_id": device["user_id"],
            "title": notification["title"],
            "body": notification["body"],
            "data": notification.get("data", {}),
            "status": "queued",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.notification_queue.insert_one(notification_record)
        sent_count += 1
    
    return sent_count

# API Endpoints
@router.post("/register-device")
async def register_device(device: DeviceRegistration, current_user: dict = Depends(get_current_user)):
    """Register device for push notifications"""
    db = get_database()
    
    # Check if already registered
    existing = await db.device_tokens.find_one({
        "user_id": current_user["id"],
        "device_token": device.device_token
    })
    
    if existing:
        return {"message": "Device already registered", "device_id": existing.get("id")}
    
    device_data = {
        "id": str(uuid4()),
        "user_id": current_user["id"],
        "device_token": device.device_token,
        "platform": device.platform,
        "device_name": device.device_name,
        "is_active": True,
        "registered_at": datetime.now(timezone.utc).isoformat(),
        "last_active": datetime.now(timezone.utc).isoformat()
    }
    
    await db.device_tokens.insert_one(device_data)
    
    return {"message": "Device registered successfully", "device_id": device_data["id"]}

@router.delete("/unregister-device/{device_token}")
async def unregister_device(device_token: str, current_user: dict = Depends(get_current_user)):
    """Unregister device from push notifications"""
    db = get_database()
    
    result = await db.device_tokens.delete_one({
        "user_id": current_user["id"],
        "device_token": device_token
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Device not found")
    
    return {"message": "Device unregistered successfully"}

@router.post("/send")
async def send_notification(notification: NotificationCreate, background_tasks: BackgroundTasks, current_user: dict = Depends(get_current_user)):
    """Send a push notification (admin only)"""
    if "admin" not in current_user.get("roles", []):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    db = get_database()
    
    notification_record = {
        "id": str(uuid4()),
        "title": notification.title,
        "body": notification.body,
        "notification_type": notification.notification_type,
        "action_url": notification.action_url,
        "data": notification.data,
        "priority": notification.priority,
        "target_user_id": notification.user_id,
        "is_broadcast": notification.user_id is None,
        "scheduled_for": notification.scheduled_for,
        "sent_by": current_user["id"],
        "status": "scheduled" if notification.scheduled_for else "sending",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "sent_at": None,
        "sent_count": 0
    }
    
    await db.notifications.insert_one(notification_record)
    
    if not notification.scheduled_for:
        # Send immediately
        user_ids = [notification.user_id] if notification.user_id else None
        sent_count = await send_push_notification(db, notification_record, user_ids)
        
        await db.notifications.update_one(
            {"id": notification_record["id"]},
            {"$set": {"status": "sent", "sent_at": datetime.now(timezone.utc).isoformat(), "sent_count": sent_count}}
        )
        notification_record["sent_count"] = sent_count
    
    notification_record.pop("_id", None)
    return {"message": "Notification sent", "notification": notification_record}

@router.get("/my-notifications")
async def get_my_notifications(skip: int = 0, limit: int = 50, current_user: dict = Depends(get_current_user)):
    """Get user's notifications"""
    db = get_database()
    
    notifications = await db.user_notifications.find(
        {"user_id": current_user["id"]},
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    unread_count = await db.user_notifications.count_documents({
        "user_id": current_user["id"],
        "is_read": False
    })
    
    return {
        "notifications": notifications,
        "unread_count": unread_count
    }

@router.put("/mark-read/{notification_id}")
async def mark_notification_read(notification_id: str, current_user: dict = Depends(get_current_user)):
    """Mark notification as read"""
    db = get_database()
    
    await db.user_notifications.update_one(
        {"id": notification_id, "user_id": current_user["id"]},
        {"$set": {"is_read": True, "read_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"message": "Notification marked as read"}

@router.put("/mark-all-read")
async def mark_all_notifications_read(current_user: dict = Depends(get_current_user)):
    """Mark all notifications as read"""
    db = get_database()
    
    result = await db.user_notifications.update_many(
        {"user_id": current_user["id"], "is_read": False},
        {"$set": {"is_read": True, "read_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"message": f"Marked {result.modified_count} notifications as read"}

@router.get("/preferences")
async def get_notification_preferences(current_user: dict = Depends(get_current_user)):
    """Get user's notification preferences"""
    db = get_database()
    
    prefs = await db.notification_preferences.find_one(
        {"user_id": current_user["id"]},
        {"_id": 0}
    )
    
    if not prefs:
        # Return defaults
        prefs = NotificationPreferences().dict()
        prefs["user_id"] = current_user["id"]
    
    return prefs

@router.put("/preferences")
async def update_notification_preferences(preferences: NotificationPreferences, current_user: dict = Depends(get_current_user)):
    """Update notification preferences"""
    db = get_database()
    
    prefs_data = {
        "user_id": current_user["id"],
        **preferences.dict(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.notification_preferences.update_one(
        {"user_id": current_user["id"]},
        {"$set": prefs_data},
        upsert=True
    )
    
    return {"message": "Preferences updated", "preferences": prefs_data}

@router.get("/admin/dashboard")
async def get_notification_dashboard(current_user: dict = Depends(get_current_user)):
    """Get notification dashboard stats"""
    if "admin" not in current_user.get("roles", []):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    db = get_database()
    
    total_sent = await db.notifications.count_documents({"status": "sent"})
    today_sent = await db.notifications.count_documents({
        "status": "sent",
        "sent_at": {"$gte": datetime.now(timezone.utc).replace(hour=0, minute=0, second=0).isoformat()}
    })
    scheduled = await db.notifications.count_documents({"status": "scheduled"})
    registered_devices = await db.device_tokens.count_documents({"is_active": True})
    
    # Platform breakdown
    pipeline = [
        {"$match": {"is_active": True}},
        {"$group": {"_id": "$platform", "count": {"$sum": 1}}}
    ]
    platforms = {}
    async for doc in db.device_tokens.aggregate(pipeline):
        platforms[doc["_id"]] = doc["count"]
    
    # Recent notifications
    recent = await db.notifications.find(
        {"status": "sent"},
        {"_id": 0}
    ).sort("sent_at", -1).limit(10).to_list(10)
    
    return {
        "total_sent": total_sent,
        "sent_today": today_sent,
        "scheduled": scheduled,
        "registered_devices": registered_devices,
        "platform_breakdown": platforms,
        "recent_notifications": recent
    }

@router.get("/admin/history")
async def get_notification_history(skip: int = 0, limit: int = 50, current_user: dict = Depends(get_current_user)):
    """Get notification history"""
    if "admin" not in current_user.get("roles", []):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    db = get_database()
    
    notifications = await db.notifications.find(
        {},
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    return {"notifications": notifications}
