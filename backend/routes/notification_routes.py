from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
from uuid import uuid4
from database import get_database
from middleware import get_current_user
from services.notification_service import notification_service

router = APIRouter(prefix="/notifications", tags=["Notifications"])

@router.get("/my")
async def get_my_notifications(
    unread_only: bool = False,
    limit: int = 50,
    user: dict = Depends(get_current_user)
):
    """Get current user's notifications"""
    db = get_database()
    
    query = {"user_id": user["id"]}
    if unread_only:
        query["read"] = False
    
    notifications = await db.notifications.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    unread_count = await db.notifications.count_documents({"user_id": user["id"], "read": False})
    
    return {
        "notifications": notifications,
        "unread_count": unread_count,
        "total": len(notifications)
    }

@router.put("/mark-read/{notification_id}")
async def mark_notification_as_read(notification_id: str, user: dict = Depends(get_current_user)):
    """Mark a notification as read"""
    db = get_database()
    
    result = await db.notifications.update_one(
        {"id": notification_id, "user_id": user["id"]},
        {"$set": {"read": True, "read_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    return {"message": "Notification marked as read"}

class SendEmailRequest(BaseModel):
    to_email: str
    subject: str
    html_content: str

class SendWhatsAppRequest(BaseModel):
    to_number: str
    message: str

class NotificationPreferences(BaseModel):
    email_enabled: bool = True
    whatsapp_enabled: bool = True
    booking_updates: bool = True
    promotional: bool = False
    document_alerts: bool = True

@router.post("/send-email")
async def send_email(
    request: SendEmailRequest,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """Send email notification (admin only)"""
    if "admin" not in current_user.get("roles", []):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    result = await notification_service.send_email(
        to_email=request.to_email,
        subject=request.subject,
        html_content=request.html_content
    )
    
    # Log notification
    await db.notification_logs.insert_one({
        "id": str(uuid4()),
        "type": "email",
        "to": request.to_email,
        "subject": request.subject,
        "sent_by": current_user["id"],
        "result": result,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return result

@router.post("/send-whatsapp")
async def send_whatsapp(
    request: SendWhatsAppRequest,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """Send WhatsApp notification (admin only)"""
    if "admin" not in current_user.get("roles", []):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    result = await notification_service.send_whatsapp(
        to_number=request.to_number,
        message=request.message
    )
    
    # Log notification
    await db.notification_logs.insert_one({
        "id": str(uuid4()),
        "type": "whatsapp",
        "to": request.to_number,
        "sent_by": current_user["id"],
        "result": result,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return result

@router.get("/preferences")
async def get_notification_preferences(
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """Get user's notification preferences"""
    prefs = await db.notification_preferences.find_one(
        {"user_id": current_user["id"]},
        {"_id": 0}
    )
    
    if not prefs:
        prefs = {
            "user_id": current_user["id"],
            "email_enabled": True,
            "whatsapp_enabled": True,
            "booking_updates": True,
            "promotional": False,
            "document_alerts": True
        }
    
    return prefs

@router.put("/preferences")
async def update_notification_preferences(
    preferences: NotificationPreferences,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """Update user's notification preferences"""
    
    prefs_data = preferences.dict()
    prefs_data["user_id"] = current_user["id"]
    prefs_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.notification_preferences.update_one(
        {"user_id": current_user["id"]},
        {"$set": prefs_data},
        upsert=True
    )
    
    return {"message": "Preferences updated", "preferences": prefs_data}

@router.get("/history")
async def get_notification_history(
    limit: int = 50,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """Get user's notification history"""
    
    # For regular users, show their notifications
    # For admins, show all
    query = {} if "admin" in current_user.get("roles", []) else {
        "$or": [
            {"to": current_user.get("email")},
            {"to": current_user.get("phone")}
        ]
    }
    
    notifications = await db.notification_logs.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    return {"notifications": notifications}

@router.get("/in-app")
async def get_in_app_notifications(
    unread_only: bool = False,
    limit: int = 20,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """Get in-app notifications for user"""
    
    query = {"user_id": current_user["id"]}
    if unread_only:
        query["read"] = False
    
    notifications = await db.in_app_notifications.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    unread_count = await db.in_app_notifications.count_documents({
        "user_id": current_user["id"],
        "read": False
    })
    
    return {
        "notifications": notifications,
        "unread_count": unread_count
    }

@router.post("/in-app/{notification_id}/read")
async def mark_notification_read(
    notification_id: str,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """Mark an in-app notification as read"""
    
    await db.in_app_notifications.update_one(
        {"id": notification_id, "user_id": current_user["id"]},
        {"$set": {"read": True, "read_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"message": "Notification marked as read"}

@router.post("/in-app/mark-all-read")
async def mark_all_notifications_read(
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """Mark all in-app notifications as read"""
    
    await db.in_app_notifications.update_many(
        {"user_id": current_user["id"], "read": False},
        {"$set": {"read": True, "read_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"message": "All notifications marked as read"}
