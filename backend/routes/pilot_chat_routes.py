"""
Pilot Chat Routes
Real-time messaging between pilots and operations team
"""
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from datetime import datetime, timezone
from database import get_database
from middleware import get_current_user
from bson import ObjectId
from typing import Optional
from pydantic import BaseModel

router = APIRouter(prefix="/chat", tags=["Pilot Chat"])


class ChatMessage(BaseModel):
    content: str
    recipient_id: Optional[str] = None  # None = broadcast to ops team


@router.get("/conversations")
async def get_conversations(
    current_user: dict = Depends(get_current_user)
):
    """Get all chat conversations for the user"""
    db = get_database()
    
    user_id = current_user.get("id") or str(current_user.get("_id"))
    user_roles = current_user.get("roles", [])
    
    # For pilots: get their conversations with ops
    # For operators/admins: get all pilot conversations
    if "pilot" in user_roles:
        conversations = await db.chat_conversations.find(
            {"$or": [{"pilot_id": user_id}, {"participants": user_id}]},
            {"_id": 0}
        ).sort("last_message_at", -1).to_list(50)
    else:
        # Operators see all conversations
        conversations = await db.chat_conversations.find(
            {},
            {"_id": 0}
        ).sort("last_message_at", -1).to_list(100)
    
    # Add unread count for each conversation
    for conv in conversations:
        unread = await db.chat_messages.count_documents({
            "conversation_id": conv["id"],
            "read_by": {"$ne": user_id}
        })
        conv["unread_count"] = unread
    
    return {"conversations": conversations}


@router.get("/messages/{conversation_id}")
async def get_messages(
    conversation_id: str,
    limit: int = 50,
    before_timestamp: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get messages in a conversation"""
    db = get_database()
    
    user_id = current_user.get("id") or str(current_user.get("_id"))
    
    # Build query
    query = {"conversation_id": conversation_id}
    if before_timestamp:
        query["created_at"] = {"$lt": before_timestamp}
    
    messages = await db.chat_messages.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    # Mark messages as read
    await db.chat_messages.update_many(
        {
            "conversation_id": conversation_id,
            "sender_id": {"$ne": user_id},
            "read_by": {"$ne": user_id}
        },
        {"$addToSet": {"read_by": user_id}}
    )
    
    # Return in chronological order
    messages.reverse()
    
    return {"messages": messages}


@router.post("/messages/send")
async def send_message(
    message: ChatMessage,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    """Send a chat message"""
    db = get_database()
    
    user_id = current_user.get("id") or str(current_user.get("_id"))
    user_name = current_user.get("full_name", "User")
    user_roles = current_user.get("roles", [])
    now = datetime.now(timezone.utc)
    
    # Determine sender type
    is_pilot = "pilot" in user_roles
    sender_type = "pilot" if is_pilot else "operations"
    
    # Find or create conversation
    if is_pilot:
        # Pilots send to ops team (general channel)
        conversation = await db.chat_conversations.find_one(
            {"pilot_id": user_id, "type": "pilot_ops"},
            {"_id": 0}
        )
        
        if not conversation:
            conv_id = f"conv_{ObjectId()}"
            conversation = {
                "id": conv_id,
                "pilot_id": user_id,
                "pilot_name": user_name,
                "type": "pilot_ops",
                "participants": [user_id],
                "created_at": now.isoformat(),
                "last_message_at": now.isoformat(),
                "last_message_preview": message.content[:50]
            }
            await db.chat_conversations.insert_one(conversation)
    else:
        # Ops reply to specific pilot
        if not message.recipient_id:
            raise HTTPException(status_code=400, detail="Recipient ID required for ops messages")
        
        conversation = await db.chat_conversations.find_one(
            {"pilot_id": message.recipient_id, "type": "pilot_ops"},
            {"_id": 0}
        )
        
        if not conversation:
            raise HTTPException(status_code=404, detail="Conversation not found")
    
    # Create message
    msg_id = f"msg_{ObjectId()}"
    chat_message = {
        "id": msg_id,
        "conversation_id": conversation["id"],
        "sender_id": user_id,
        "sender_name": user_name,
        "sender_type": sender_type,
        "content": message.content,
        "read_by": [user_id],
        "created_at": now.isoformat()
    }
    
    await db.chat_messages.insert_one(chat_message)
    
    # Update conversation
    await db.chat_conversations.update_one(
        {"id": conversation["id"]},
        {
            "$set": {
                "last_message_at": now.isoformat(),
                "last_message_preview": message.content[:50],
                "last_sender_name": user_name
            },
            "$addToSet": {"participants": user_id}
        }
    )
    
    return {
        "message": "Message sent",
        "message_id": msg_id,
        "conversation_id": conversation["id"],
        "timestamp": now.isoformat()
    }


@router.get("/unread-count")
async def get_unread_count(
    current_user: dict = Depends(get_current_user)
):
    """Get total unread message count"""
    db = get_database()
    
    user_id = current_user.get("id") or str(current_user.get("_id"))
    user_roles = current_user.get("roles", [])
    
    # Get conversations this user is part of
    if "pilot" in user_roles:
        conversations = await db.chat_conversations.find(
            {"pilot_id": user_id},
            {"id": 1}
        ).to_list(100)
    else:
        conversations = await db.chat_conversations.find(
            {},
            {"id": 1}
        ).to_list(100)
    
    conv_ids = [c["id"] for c in conversations]
    
    unread_count = await db.chat_messages.count_documents({
        "conversation_id": {"$in": conv_ids},
        "sender_id": {"$ne": user_id},
        "read_by": {"$ne": user_id}
    })
    
    return {"unread_count": unread_count}


@router.delete("/messages/{message_id}")
async def delete_message(
    message_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a message (only sender can delete)"""
    db = get_database()
    
    user_id = current_user.get("id") or str(current_user.get("_id"))
    
    message = await db.chat_messages.find_one({"id": message_id})
    
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")
    
    if message.get("sender_id") != user_id:
        raise HTTPException(status_code=403, detail="Can only delete your own messages")
    
    await db.chat_messages.delete_one({"id": message_id})
    
    return {"message": "Message deleted"}
