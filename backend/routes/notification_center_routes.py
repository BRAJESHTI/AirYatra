"""
Global Notification Center Routes
All notifications (Email, SMS, WhatsApp, Push, Approvals) in one place
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone, timedelta
from bson import ObjectId
from database import get_database

router = APIRouter(prefix="/notifications", tags=["notifications"])

# Models
class NotificationCreate(BaseModel):
    type: str
    title: str
    message: str
    priority: str = "normal"
    recipient_id: Optional[str] = None
    recipient_email: Optional[str] = None
    recipient_phone: Optional[str] = None
    metadata: Optional[dict] = {}
    action_url: Optional[str] = None
    action_label: Optional[str] = None

def serialize_notification(notif):
    notif["_id"] = str(notif["_id"])
    if "recipient_id" in notif and notif["recipient_id"]:
        notif["recipient_id"] = str(notif["recipient_id"])
    return notif

# Create notification
@router.post("/create")
async def create_notification(notification: NotificationCreate):
    db = get_database()
    
    notif_doc = {
        "type": notification.type,
        "title": notification.title,
        "message": notification.message,
        "priority": notification.priority,
        "recipient_id": notification.recipient_id,
        "recipient_email": notification.recipient_email,
        "recipient_phone": notification.recipient_phone,
        "metadata": notification.metadata,
        "action_url": notification.action_url,
        "action_label": notification.action_label,
        "is_read": False,
        "is_archived": False,
        "created_at": datetime.now(timezone.utc),
        "read_at": None
    }
    
    result = await db.notifications.insert_one(notif_doc)
    notif_doc["_id"] = str(result.inserted_id)
    
    return {"success": True, "notification": notif_doc}

# Get all notifications for a user
@router.get("/user/{user_id}")
async def get_user_notifications(
    user_id: str,
    type: Optional[str] = None,
    priority: Optional[str] = None,
    is_read: Optional[bool] = None,
    limit: int = 50,
    skip: int = 0
):
    db = get_database()
    
    query = {"recipient_id": user_id, "is_archived": False}
    
    if type:
        query["type"] = type
    if priority:
        query["priority"] = priority
    if is_read is not None:
        query["is_read"] = is_read
    
    notifications = await db.notifications.find(query).sort("created_at", -1).skip(skip).limit(limit).to_list(length=limit)
    
    # Get counts
    total = await db.notifications.count_documents({"recipient_id": user_id, "is_archived": False})
    unread = await db.notifications.count_documents({"recipient_id": user_id, "is_read": False, "is_archived": False})
    
    # Count by type
    type_counts = {}
    for t in ["email", "sms", "whatsapp", "push", "approval", "system", "alert"]:
        type_counts[t] = await db.notifications.count_documents({
            "recipient_id": user_id, 
            "type": t, 
            "is_archived": False,
            "is_read": False
        })
    
    return {
        "notifications": [serialize_notification(n) for n in notifications],
        "total": total,
        "unread": unread,
        "type_counts": type_counts
    }

# Get all notifications (admin)
@router.get("/all")
async def get_all_notifications(
    type: Optional[str] = None,
    priority: Optional[str] = None,
    limit: int = 100,
    skip: int = 0
):
    db = get_database()
    
    query = {"is_archived": False}
    if type:
        query["type"] = type
    if priority:
        query["priority"] = priority
    
    notifications = await db.notifications.find(query).sort("created_at", -1).skip(skip).limit(limit).to_list(length=limit)
    
    total = await db.notifications.count_documents(query)
    unread = await db.notifications.count_documents({**query, "is_read": False})
    
    return {
        "notifications": [serialize_notification(n) for n in notifications],
        "total": total,
        "unread": unread
    }

# Mark notification as read
@router.put("/{notification_id}/read")
async def mark_as_read(notification_id: str):
    db = get_database()
    
    result = await db.notifications.update_one(
        {"_id": ObjectId(notification_id)},
        {"$set": {"is_read": True, "read_at": datetime.now(timezone.utc)}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    return {"success": True, "message": "Marked as read"}

# Mark all as read for user
@router.put("/user/{user_id}/read-all")
async def mark_all_as_read(user_id: str):
    db = get_database()
    
    result = await db.notifications.update_many(
        {"recipient_id": user_id, "is_read": False},
        {"$set": {"is_read": True, "read_at": datetime.now(timezone.utc)}}
    )
    
    return {"success": True, "updated": result.modified_count}

# Archive notification
@router.put("/{notification_id}/archive")
async def archive_notification(notification_id: str):
    db = get_database()
    
    result = await db.notifications.update_one(
        {"_id": ObjectId(notification_id)},
        {"$set": {"is_archived": True}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    return {"success": True, "message": "Archived"}

# Delete notification
@router.delete("/{notification_id}")
async def delete_notification(notification_id: str):
    db = get_database()
    
    result = await db.notifications.delete_one({"_id": ObjectId(notification_id)})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    return {"success": True, "message": "Deleted"}

# Get notification stats
@router.get("/stats")
async def get_notification_stats():
    db = get_database()
    
    # Overall stats
    total = await db.notifications.count_documents({})
    unread = await db.notifications.count_documents({"is_read": False})
    
    # By type
    types = ["email", "sms", "whatsapp", "push", "approval", "system", "alert"]
    type_stats = {}
    for t in types:
        type_stats[t] = {
            "total": await db.notifications.count_documents({"type": t}),
            "unread": await db.notifications.count_documents({"type": t, "is_read": False})
        }
    
    # By priority
    priorities = ["low", "normal", "high", "urgent"]
    priority_stats = {}
    for p in priorities:
        priority_stats[p] = await db.notifications.count_documents({"priority": p, "is_read": False})
    
    # Recent (last 24 hours)
    yesterday = datetime.now(timezone.utc) - timedelta(hours=24)
    recent = await db.notifications.count_documents({"created_at": {"$gte": yesterday}})
    
    return {
        "total": total,
        "unread": unread,
        "recent_24h": recent,
        "by_type": type_stats,
        "by_priority": priority_stats
    }
