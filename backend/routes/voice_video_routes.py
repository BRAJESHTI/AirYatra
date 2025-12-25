from fastapi import APIRouter, HTTPException, Depends, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from typing import Optional, List, Dict
from datetime import datetime, timezone
from uuid import uuid4
import json
import asyncio
from database import get_database
from routes.auth_routes import get_current_user

router = APIRouter(prefix="/voice-video", tags=["Voice/Video Calling"])

# Active calls
ACTIVE_CALLS: Dict[str, dict] = {}
CALL_CONNECTIONS: Dict[str, List[WebSocket]] = {}

# Models
class CallInitiate(BaseModel):
    target_user_id: str
    call_type: str  # voice, video
    booking_id: Optional[str] = None
    subject: Optional[str] = None

class CallResponse(BaseModel):
    call_id: str
    action: str  # accept, reject, busy

class CallEnd(BaseModel):
    call_id: str
    reason: Optional[str] = None

# Helper Functions
async def broadcast_to_call(call_id: str, message: dict, exclude_ws: WebSocket = None):
    """Broadcast message to all participants in a call"""
    if call_id in CALL_CONNECTIONS:
        for ws in CALL_CONNECTIONS[call_id]:
            if ws != exclude_ws:
                try:
                    await ws.send_json(message)
                except:
                    pass

# API Endpoints
@router.post("/initiate")
async def initiate_call(call: CallInitiate, current_user: dict = Depends(get_current_user)):
    """Initiate a voice/video call"""
    db = get_database()
    
    # Check if target user exists
    target_user = await db.users.find_one({"id": call.target_user_id})
    if not target_user:
        raise HTTPException(status_code=404, detail="Target user not found")
    
    # Check if either party is already in a call
    for call_id, active_call in ACTIVE_CALLS.items():
        if current_user["id"] in [active_call["caller_id"], active_call["callee_id"]]:
            raise HTTPException(status_code=400, detail="You are already in a call")
        if call.target_user_id in [active_call["caller_id"], active_call["callee_id"]]:
            raise HTTPException(status_code=400, detail="Target user is busy")
    
    call_id = str(uuid4())
    
    call_record = {
        "id": call_id,
        "caller_id": current_user["id"],
        "caller_name": current_user.get("full_name", ""),
        "callee_id": call.target_user_id,
        "callee_name": target_user.get("full_name", ""),
        "call_type": call.call_type,
        "booking_id": call.booking_id,
        "subject": call.subject,
        "status": "ringing",
        "initiated_at": datetime.now(timezone.utc).isoformat(),
        "answered_at": None,
        "ended_at": None,
        "duration_seconds": 0,
        "end_reason": None
    }
    
    ACTIVE_CALLS[call_id] = call_record
    CALL_CONNECTIONS[call_id] = []
    
    # Store in DB
    await db.call_logs.insert_one(call_record)
    
    # In production: Send push notification to target user
    # await send_push_notification(call.target_user_id, "Incoming call", ...)
    
    return {
        "message": "Call initiated",
        "call_id": call_id,
        "call": call_record
    }

@router.post("/respond")
async def respond_to_call(response: CallResponse, current_user: dict = Depends(get_current_user)):
    """Respond to an incoming call"""
    db = get_database()
    
    if response.call_id not in ACTIVE_CALLS:
        raise HTTPException(status_code=404, detail="Call not found or expired")
    
    call = ACTIVE_CALLS[response.call_id]
    
    if call["callee_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not your call to answer")
    
    if response.action == "accept":
        call["status"] = "connected"
        call["answered_at"] = datetime.now(timezone.utc).isoformat()
        
        await db.call_logs.update_one(
            {"id": response.call_id},
            {"$set": {"status": "connected", "answered_at": call["answered_at"]}}
        )
        
        # Broadcast to caller
        await broadcast_to_call(response.call_id, {
            "type": "call_accepted",
            "call_id": response.call_id
        })
        
        return {"message": "Call accepted", "call": call}
    
    elif response.action == "reject":
        call["status"] = "rejected"
        call["ended_at"] = datetime.now(timezone.utc).isoformat()
        call["end_reason"] = "rejected"
        
        await db.call_logs.update_one(
            {"id": response.call_id},
            {"$set": {"status": "rejected", "ended_at": call["ended_at"], "end_reason": "rejected"}}
        )
        
        # Broadcast to caller
        await broadcast_to_call(response.call_id, {
            "type": "call_rejected",
            "call_id": response.call_id
        })
        
        del ACTIVE_CALLS[response.call_id]
        
        return {"message": "Call rejected"}
    
    elif response.action == "busy":
        call["status"] = "busy"
        call["ended_at"] = datetime.now(timezone.utc).isoformat()
        call["end_reason"] = "busy"
        
        await db.call_logs.update_one(
            {"id": response.call_id},
            {"$set": {"status": "busy", "ended_at": call["ended_at"], "end_reason": "busy"}}
        )
        
        del ACTIVE_CALLS[response.call_id]
        
        return {"message": "Marked as busy"}
    
    raise HTTPException(status_code=400, detail="Invalid action")

@router.post("/end")
async def end_call(end_request: CallEnd, current_user: dict = Depends(get_current_user)):
    """End an active call"""
    db = get_database()
    
    if end_request.call_id not in ACTIVE_CALLS:
        raise HTTPException(status_code=404, detail="Call not found")
    
    call = ACTIVE_CALLS[end_request.call_id]
    
    # Calculate duration
    duration = 0
    if call["answered_at"]:
        answered = datetime.fromisoformat(call["answered_at"].replace('Z', '+00:00'))
        duration = int((datetime.now(timezone.utc) - answered).total_seconds())
    
    call["status"] = "ended"
    call["ended_at"] = datetime.now(timezone.utc).isoformat()
    call["duration_seconds"] = duration
    call["end_reason"] = end_request.reason or "normal"
    
    await db.call_logs.update_one(
        {"id": end_request.call_id},
        {"$set": {
            "status": "ended",
            "ended_at": call["ended_at"],
            "duration_seconds": duration,
            "end_reason": call["end_reason"]
        }}
    )
    
    # Broadcast to other participant
    await broadcast_to_call(end_request.call_id, {
        "type": "call_ended",
        "call_id": end_request.call_id,
        "duration": duration,
        "reason": call["end_reason"]
    })
    
    del ACTIVE_CALLS[end_request.call_id]
    
    return {"message": "Call ended", "duration_seconds": duration}

@router.get("/active")
async def get_active_calls(current_user: dict = Depends(get_current_user)):
    """Get user's active calls"""
    user_calls = []
    for call_id, call in ACTIVE_CALLS.items():
        if current_user["id"] in [call["caller_id"], call["callee_id"]]:
            user_calls.append(call)
    
    return {"active_calls": user_calls}

@router.get("/history")
async def get_call_history(skip: int = 0, limit: int = 50, current_user: dict = Depends(get_current_user)):
    """Get call history"""
    db = get_database()
    
    calls = await db.call_logs.find(
        {"$or": [{"caller_id": current_user["id"]}, {"callee_id": current_user["id"]}]},
        {"_id": 0}
    ).sort("initiated_at", -1).skip(skip).limit(limit).to_list(limit)
    
    return {"calls": calls}

@router.get("/stats")
async def get_call_stats(current_user: dict = Depends(get_current_user)):
    """Get call statistics"""
    db = get_database()
    
    total_calls = await db.call_logs.count_documents({
        "$or": [{"caller_id": current_user["id"]}, {"callee_id": current_user["id"]}]
    })
    
    # Aggregate total duration
    pipeline = [
        {"$match": {"$or": [{"caller_id": current_user["id"]}, {"callee_id": current_user["id"]}]}},
        {"$group": {"_id": None, "total_duration": {"$sum": "$duration_seconds"}}}
    ]
    
    result = await db.call_logs.aggregate(pipeline).to_list(1)
    total_duration = result[0]["total_duration"] if result else 0
    
    return {
        "total_calls": total_calls,
        "total_duration_seconds": total_duration,
        "total_duration_formatted": f"{total_duration // 3600}h {(total_duration % 3600) // 60}m"
    }

@router.websocket("/ws/{call_id}")
async def call_websocket(websocket: WebSocket, call_id: str):
    """WebSocket for real-time call signaling"""
    await websocket.accept()
    
    if call_id not in CALL_CONNECTIONS:
        CALL_CONNECTIONS[call_id] = []
    CALL_CONNECTIONS[call_id].append(websocket)
    
    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            
            # Forward signaling messages to other participant
            await broadcast_to_call(call_id, message, exclude_ws=websocket)
    
    except WebSocketDisconnect:
        if call_id in CALL_CONNECTIONS:
            CALL_CONNECTIONS[call_id].remove(websocket)

@router.get("/admin/dashboard")
async def get_call_dashboard(current_user: dict = Depends(get_current_user)):
    """Get call center dashboard"""
    if "admin" not in current_user.get("roles", []):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    db = get_database()
    
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0).isoformat()
    
    active_count = len(ACTIVE_CALLS)
    today_calls = await db.call_logs.count_documents({"initiated_at": {"$gte": today}})
    
    # Average duration
    pipeline = [
        {"$match": {"status": "ended", "initiated_at": {"$gte": today}}},
        {"$group": {"_id": None, "avg_duration": {"$avg": "$duration_seconds"}}}
    ]
    result = await db.call_logs.aggregate(pipeline).to_list(1)
    avg_duration = result[0]["avg_duration"] if result else 0
    
    return {
        "active_calls": active_count,
        "calls_today": today_calls,
        "average_duration_seconds": round(avg_duration, 0),
        "active_call_details": list(ACTIVE_CALLS.values())
    }
