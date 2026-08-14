from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
from uuid import uuid4
from database import get_database
from middleware import get_current_user

router = APIRouter(prefix="/chat", tags=["Chat"])

class SendMessageRequest(BaseModel):
    booking_id: str
    message: str
    message_type: str = "text"  # text, image, file
    attachment_url: Optional[str] = None

@router.get("/conversations")
async def get_conversations(
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """Get all chat conversations for current user"""
    user_id = current_user["id"]
    roles = current_user.get("roles", [])
    
    # Find conversations where user is participant
    if {"support", "admin", "super_admin"} & set(roles):
        # Support/Admin: all bookings that have chat messages
        booking_ids = await db.chat_messages.distinct("booking_id")
        bookings = await db.bookings.find(
            {"id": {"$in": booking_ids}},
            {"_id": 0, "id": 1, "booking_number": 1, "customer_id": 1, "from_location": 1, "to_location": 1}
        ).to_list(100)
    elif "operator" in roles:
        # Get operator's bookings
        operator = await db.operators.find_one({"user_id": user_id}, {"_id": 0})
        if operator:
            bookings = await db.bookings.find(
                {"operator_id": operator["id"]},
                {"_id": 0, "id": 1, "booking_number": 1, "customer_id": 1, "from_location": 1, "to_location": 1}
            ).to_list(100)
        else:
            bookings = []
    else:
        # Customer's bookings
        bookings = await db.bookings.find(
            {"customer_id": user_id},
            {"_id": 0, "id": 1, "booking_number": 1, "operator_id": 1, "from_location": 1, "to_location": 1}
        ).to_list(100)
    
    # Get conversations with last message and unread count
    conversations = []
    for booking in bookings:
        last_message = await db.chat_messages.find_one(
            {"booking_id": booking["id"]},
            {"_id": 0},
            sort=[("created_at", -1)]
        )
        
        unread_count = await db.chat_messages.count_documents({
            "booking_id": booking["id"],
            "sender_id": {"$ne": user_id},
            "read": False
        })
        
        conversations.append({
            "booking_id": booking["id"],
            "booking_number": booking.get("booking_number"),
            "route": f"{booking.get('from_location')} → {booking.get('to_location')}",
            "last_message": last_message,
            "unread_count": unread_count
        })
    
    return {"conversations": conversations}

@router.get("/messages/{booking_id}")
async def get_messages(
    booking_id: str,
    limit: int = 50,
    before: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """Get chat messages for a booking"""
    # Verify user has access to this booking
    booking = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    user_id = current_user["id"]
    roles = current_user.get("roles", [])
    
    # Check access
    has_access = False
    if booking.get("customer_id") == user_id:
        has_access = True
    elif "operator" in roles:
        operator = await db.operators.find_one({"user_id": user_id}, {"_id": 0})
        if operator and operator["id"] == booking.get("operator_id"):
            has_access = True
    elif {"admin", "super_admin", "support"} & set(roles):
        has_access = True
    
    if not has_access:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Get messages
    query = {"booking_id": booking_id}
    if before:
        query["created_at"] = {"$lt": before}
    
    messages = await db.chat_messages.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    # Mark messages as read
    await db.chat_messages.update_many(
        {"booking_id": booking_id, "sender_id": {"$ne": user_id}, "read": False},
        {"$set": {"read": True, "read_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"messages": list(reversed(messages)), "booking": booking}

@router.post("/send")
async def send_message(
    request: SendMessageRequest,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """Send a chat message"""
    # Verify booking exists and user has access
    booking = await db.bookings.find_one({"id": request.booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    user_id = current_user["id"]
    
    # Determine sender type
    sender_type = "customer"
    if "operator" in current_user.get("roles", []):
        sender_type = "operator"
    elif "admin" in current_user.get("roles", []):
        sender_type = "admin"
    
    message = {
        "id": str(uuid4()),
        "booking_id": request.booking_id,
        "sender_id": user_id,
        "sender_name": current_user.get("full_name"),
        "sender_type": sender_type,
        "message": request.message,
        "message_type": request.message_type,
        "attachment_url": request.attachment_url,
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.chat_messages.insert_one(message)
    
    # Create notification for recipient
    recipient_id = None
    if sender_type == "customer":
        # Notify operator
        operator = await db.operators.find_one({"id": booking.get("operator_id")}, {"_id": 0})
        if operator:
            recipient_id = operator.get("user_id")
    else:
        # Notify customer
        recipient_id = booking.get("customer_id")
    
    if recipient_id:
        await db.in_app_notifications.insert_one({
            "id": str(uuid4()),
            "user_id": recipient_id,
            "type": "chat_message",
            "title": "New Message",
            "message": f"New message for booking {booking.get('booking_number', '')}",
            "data": {"booking_id": request.booking_id},
            "read": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
    
    return {"message": "Message sent", "chat_message": message}

@router.post("/messages/{message_id}/read")
async def mark_message_read(
    message_id: str,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """Mark a message as read"""
    await db.chat_messages.update_one(
        {"id": message_id},
        {"$set": {"read": True, "read_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"message": "Marked as read"}
