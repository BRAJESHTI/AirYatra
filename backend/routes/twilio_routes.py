from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
from uuid import uuid4
from database import get_database
from routes.auth_routes import get_current_user
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/twilio", tags=["Twilio Call Recording"])

# Models
class TwilioConfig(BaseModel):
    account_sid: Optional[str] = None
    auth_token: Optional[str] = None
    phone_number: Optional[str] = None
    recording_enabled: bool = True
    webhook_url: Optional[str] = None

class CallRequest(BaseModel):
    to_number: str
    from_number: Optional[str] = None
    record: bool = True
    customer_id: Optional[str] = None
    booking_id: Optional[str] = None
    call_type: str = "outbound"  # outbound, support, sales

class CallLog(BaseModel):
    call_sid: str
    from_number: str
    to_number: str
    duration: int
    status: str
    recording_url: Optional[str] = None
    notes: Optional[str] = None

# Dashboard
@router.get("/dashboard")
async def get_twilio_dashboard(current_user: dict = Depends(get_current_user)):
    """Get Twilio call dashboard"""
    db = get_database()
    
    # Get config status
    config = await db.twilio_config.find_one({}, {"_id": 0})
    
    # Get call stats
    total_calls = await db.call_logs.count_documents({})
    today_calls = await db.call_logs.count_documents({
        "created_at": {"$gte": datetime.now(timezone.utc).replace(hour=0, minute=0, second=0)}
    })
    
    # Get recent calls
    recent_calls = await db.call_logs.find({}, {"_id": 0}).sort("created_at", -1).limit(10).to_list(10)
    
    # Calculate total duration
    pipeline = [{"$group": {"_id": None, "total_duration": {"$sum": "$duration"}}}]
    duration_result = await db.call_logs.aggregate(pipeline).to_list(1)
    total_duration = duration_result[0]["total_duration"] if duration_result else 0
    
    return {
        "is_configured": config is not None and config.get("account_sid"),
        "recording_enabled": config.get("recording_enabled", False) if config else False,
        "stats": {
            "total_calls": total_calls,
            "today_calls": today_calls,
            "total_duration_minutes": round(total_duration / 60, 1),
            "recordings_count": await db.call_logs.count_documents({"recording_url": {"$ne": None}})
        },
        "recent_calls": recent_calls
    }

# Configuration
@router.get("/config")
async def get_twilio_config(current_user: dict = Depends(get_current_user)):
    """Get Twilio configuration (masked)"""
    db = get_database()
    config = await db.twilio_config.find_one({}, {"_id": 0})
    
    if config:
        # Mask sensitive data
        if config.get("account_sid"):
            config["account_sid"] = config["account_sid"][:8] + "*" * 20
        if config.get("auth_token"):
            config["auth_token"] = "*" * 32
    
    return config or {"is_configured": False}

@router.post("/config")
async def update_twilio_config(
    config: TwilioConfig,
    current_user: dict = Depends(get_current_user)
):
    """Update Twilio configuration"""
    if "admin" not in current_user.get("roles", []):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    db = get_database()
    
    config_data = config.dict()
    config_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    config_data["updated_by"] = current_user["id"]
    
    await db.twilio_config.update_one(
        {},
        {"$set": config_data},
        upsert=True
    )
    
    return {"message": "Twilio configuration updated", "recording_enabled": config.recording_enabled}

# Make Call
@router.post("/call")
async def initiate_call(
    call_request: CallRequest,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    """Initiate an outbound call"""
    db = get_database()
    
    # Get config
    config = await db.twilio_config.find_one({}, {"_id": 0})
    if not config or not config.get("account_sid"):
        # Mock response for demo
        call_log = {
            "id": str(uuid4()),
            "call_sid": f"CA{uuid4().hex[:32]}",
            "from_number": call_request.from_number or "+919876543210",
            "to_number": call_request.to_number,
            "status": "initiated",
            "duration": 0,
            "call_type": call_request.call_type,
            "customer_id": call_request.customer_id,
            "booking_id": call_request.booking_id,
            "recording_enabled": call_request.record,
            "initiated_by": current_user["id"],
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.call_logs.insert_one(call_log)
        
        return {
            "message": "Call initiated (Demo Mode)",
            "call_sid": call_log["call_sid"],
            "status": "initiated",
            "demo_mode": True
        }
    
    # Real Twilio integration would go here
    # For now, return mock response
    return {"message": "Twilio not configured", "demo_mode": True}

# Call Logs
@router.get("/calls")
async def get_call_logs(
    page: int = 1,
    limit: int = 20,
    call_type: Optional[str] = None,
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get call logs with pagination"""
    db = get_database()
    
    query = {}
    if call_type:
        query["call_type"] = call_type
    if status:
        query["status"] = status
    
    total = await db.call_logs.count_documents(query)
    calls = await db.call_logs.find(query, {"_id": 0}).sort("created_at", -1).skip((page - 1) * limit).limit(limit).to_list(limit)
    
    return {
        "calls": calls,
        "total": total,
        "page": page,
        "pages": (total + limit - 1) // limit
    }

@router.get("/calls/{call_sid}")
async def get_call_details(
    call_sid: str,
    current_user: dict = Depends(get_current_user)
):
    """Get details of a specific call"""
    db = get_database()
    call = await db.call_logs.find_one({"call_sid": call_sid}, {"_id": 0})
    
    if not call:
        raise HTTPException(status_code=404, detail="Call not found")
    
    return call

# Recording
@router.get("/calls/{call_sid}/recording")
async def get_call_recording(
    call_sid: str,
    current_user: dict = Depends(get_current_user)
):
    """Get recording URL for a call"""
    db = get_database()
    call = await db.call_logs.find_one({"call_sid": call_sid}, {"_id": 0})
    
    if not call:
        raise HTTPException(status_code=404, detail="Call not found")
    
    if not call.get("recording_url"):
        return {"message": "No recording available", "recording_url": None}
    
    return {"recording_url": call["recording_url"]}

# Webhook for Twilio callbacks
@router.post("/webhook/call-status")
async def twilio_call_status_webhook(call_data: dict):
    """Webhook to receive call status updates from Twilio"""
    db = get_database()
    
    call_sid = call_data.get("CallSid")
    if call_sid:
        await db.call_logs.update_one(
            {"call_sid": call_sid},
            {"$set": {
                "status": call_data.get("CallStatus", "unknown"),
                "duration": int(call_data.get("CallDuration", 0)),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
    
    return {"status": "received"}

@router.post("/webhook/recording")
async def twilio_recording_webhook(recording_data: dict):
    """Webhook to receive recording status from Twilio"""
    db = get_database()
    
    call_sid = recording_data.get("CallSid")
    recording_url = recording_data.get("RecordingUrl")
    
    if call_sid and recording_url:
        await db.call_logs.update_one(
            {"call_sid": call_sid},
            {"$set": {
                "recording_url": recording_url,
                "recording_sid": recording_data.get("RecordingSid"),
                "recording_duration": int(recording_data.get("RecordingDuration", 0)),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
    
    return {"status": "received"}

# Add notes to call
@router.post("/calls/{call_sid}/notes")
async def add_call_notes(
    call_sid: str,
    notes: str,
    current_user: dict = Depends(get_current_user)
):
    """Add notes to a call log"""
    db = get_database()
    
    result = await db.call_logs.update_one(
        {"call_sid": call_sid},
        {"$set": {
            "notes": notes,
            "notes_by": current_user["id"],
            "notes_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Call not found")
    
    return {"message": "Notes added successfully"}
