from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from typing import Dict, List
from datetime import datetime, timezone
from uuid import uuid4
import json
import asyncio

router = APIRouter(tags=["WebSocket Chat"])

# Store active connections
class ConnectionManager:
    def __init__(self):
        # {booking_id: [websocket1, websocket2, ...]}
        self.active_connections: Dict[str, List[WebSocket]] = {}
        # {websocket: user_info}
        self.connection_users: Dict[WebSocket, dict] = {}
    
    async def connect(self, websocket: WebSocket, booking_id: str, user_info: dict):
        await websocket.accept()
        if booking_id not in self.active_connections:
            self.active_connections[booking_id] = []
        self.active_connections[booking_id].append(websocket)
        self.connection_users[websocket] = user_info
        print(f"[WS] User {user_info.get('name')} connected to booking {booking_id}")
    
    def disconnect(self, websocket: WebSocket, booking_id: str):
        if booking_id in self.active_connections:
            if websocket in self.active_connections[booking_id]:
                self.active_connections[booking_id].remove(websocket)
            if not self.active_connections[booking_id]:
                del self.active_connections[booking_id]
        if websocket in self.connection_users:
            user = self.connection_users[websocket]
            print(f"[WS] User {user.get('name')} disconnected from booking {booking_id}")
            del self.connection_users[websocket]
    
    async def send_personal_message(self, message: dict, websocket: WebSocket):
        try:
            await websocket.send_json(message)
        except Exception as e:
            print(f"[WS] Error sending message: {e}")
    
    async def broadcast_to_booking(self, booking_id: str, message: dict, exclude: WebSocket = None):
        """Send message to all users in a booking conversation"""
        if booking_id in self.active_connections:
            for connection in self.active_connections[booking_id]:
                if connection != exclude:
                    try:
                        await connection.send_json(message)
                    except Exception as e:
                        print(f"[WS] Broadcast error: {e}")
    
    def get_online_users(self, booking_id: str) -> List[dict]:
        """Get list of online users for a booking"""
        if booking_id not in self.active_connections:
            return []
        return [
            self.connection_users.get(ws, {})
            for ws in self.active_connections[booking_id]
            if ws in self.connection_users
        ]

manager = ConnectionManager()

@router.websocket("/ws/chat/{booking_id}")
async def websocket_chat(
    websocket: WebSocket,
    booking_id: str
):
    """
    WebSocket endpoint for real-time chat
    
    Connect with: ws://host/api/ws/chat/{booking_id}?token={jwt_token}&name={user_name}&type={user_type}
    """
    from database import get_database
    
    # Get query params
    token = websocket.query_params.get("token", "")
    user_name = websocket.query_params.get("name", "Anonymous")
    user_type = websocket.query_params.get("type", "customer")
    user_id = websocket.query_params.get("user_id", str(uuid4()))
    
    user_info = {
        "id": user_id,
        "name": user_name,
        "type": user_type,
        "connected_at": datetime.now(timezone.utc).isoformat()
    }
    
    try:
        await manager.connect(websocket, booking_id, user_info)
        
        # Send welcome message
        await manager.send_personal_message({
            "type": "system",
            "message": f"Connected to chat for booking {booking_id}",
            "online_users": manager.get_online_users(booking_id),
            "timestamp": datetime.now(timezone.utc).isoformat()
        }, websocket)
        
        # Notify others that user joined
        await manager.broadcast_to_booking(booking_id, {
            "type": "user_joined",
            "user": user_info,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }, exclude=websocket)
        
        # Listen for messages
        while True:
            data = await websocket.receive_text()
            
            try:
                message_data = json.loads(data)
            except json.JSONDecodeError:
                message_data = {"text": data}
            
            # Handle different message types
            msg_type = message_data.get("type", "chat")
            
            if msg_type == "chat":
                # Save message to database
                db = await get_database()
                chat_message = {
                    "id": str(uuid4()),
                    "booking_id": booking_id,
                    "sender_id": user_id,
                    "sender_name": user_name,
                    "sender_type": user_type,
                    "message": message_data.get("text", ""),
                    "message_type": message_data.get("message_type", "text"),
                    "attachment_url": message_data.get("attachment_url"),
                    "read": False,
                    "created_at": datetime.now(timezone.utc).isoformat()
                }
                await db.chat_messages.insert_one(chat_message)
                
                # Broadcast to all participants
                await manager.broadcast_to_booking(booking_id, {
                    "type": "chat",
                    "message": chat_message,
                    "timestamp": datetime.now(timezone.utc).isoformat()
                })
            
            elif msg_type == "typing":
                # Broadcast typing indicator
                await manager.broadcast_to_booking(booking_id, {
                    "type": "typing",
                    "user": user_info,
                    "is_typing": message_data.get("is_typing", True),
                    "timestamp": datetime.now(timezone.utc).isoformat()
                }, exclude=websocket)
            
            elif msg_type == "read":
                # Mark messages as read
                message_ids = message_data.get("message_ids", [])
                if message_ids:
                    db = await get_database()
                    await db.chat_messages.update_many(
                        {"id": {"$in": message_ids}},
                        {"$set": {"read": True, "read_at": datetime.now(timezone.utc).isoformat()}}
                    )
                    await manager.broadcast_to_booking(booking_id, {
                        "type": "read_receipt",
                        "message_ids": message_ids,
                        "read_by": user_info,
                        "timestamp": datetime.now(timezone.utc).isoformat()
                    })
            
            elif msg_type == "ping":
                await manager.send_personal_message({
                    "type": "pong",
                    "timestamp": datetime.now(timezone.utc).isoformat()
                }, websocket)
    
    except WebSocketDisconnect:
        manager.disconnect(websocket, booking_id)
        # Notify others that user left
        await manager.broadcast_to_booking(booking_id, {
            "type": "user_left",
            "user": user_info,
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
    except Exception as e:
        print(f"[WS] Error: {e}")
        manager.disconnect(websocket, booking_id)
