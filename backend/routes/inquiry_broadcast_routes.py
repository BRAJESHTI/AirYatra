"""
Inquiry Broadcast Routes - API endpoints for inquiry distribution
"""
from fastapi import APIRouter, Depends, HTTPException, Request
from typing import Optional
from datetime import datetime, timezone
from uuid import uuid4
from database import get_database
from middleware import get_current_user, require_roles
from models import UserRole
from services.inquiry_broadcast_service import (
    get_broadcast_settings,
    find_operators_in_radius,
    create_inquiry_broadcast,
    operator_accept_inquiry,
    operator_reject_inquiry,
    get_operator_pending_inquiries,
    expire_old_inquiries
)

router = APIRouter(prefix="/inquiry-broadcast", tags=["Inquiry Broadcast"])

# ============== ADMIN SETTINGS ==============

@router.get("/settings")
async def get_inquiry_broadcast_settings(
    user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN]))
):
    """Get inquiry broadcast settings"""
    settings = await get_broadcast_settings()
    return settings

@router.put("/settings")
async def update_inquiry_broadcast_settings(
    settings_data: dict,
    user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN]))
):
    """Update inquiry broadcast settings"""
    db = get_database()
    
    update_data = {
        "type": "inquiry_broadcast",
        "broadcast_radius_km": settings_data.get("broadcast_radius_km", 500),
        "whatsapp_enabled": settings_data.get("whatsapp_enabled", True),
        "in_app_enabled": settings_data.get("in_app_enabled", True),
        "max_operators_per_inquiry": settings_data.get("max_operators_per_inquiry", 50),
        "auto_expire_minutes": settings_data.get("auto_expire_minutes", 30),
        "enabled": settings_data.get("enabled", True),
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "updated_by": user["id"]
    }
    
    await db.settings.update_one(
        {"type": "inquiry_broadcast"},
        {"$set": update_data},
        upsert=True
    )
    
    return {"message": "Settings updated successfully", "settings": update_data}

# ============== OPERATOR ENDPOINTS ==============

@router.get("/operator/pending")
async def get_pending_inquiries_for_operator(
    user: dict = Depends(get_current_user)
):
    """Get all pending inquiries for the current operator"""
    db = get_database()
    
    if "operator" not in user.get("roles", []):
        raise HTTPException(status_code=403, detail="Operator role required")
    
    operator = await db.operators.find_one({"user_id": user["id"]}, {"_id": 0, "id": 1})
    if not operator:
        raise HTTPException(status_code=404, detail="Operator profile not found")
    
    inquiries = await get_operator_pending_inquiries(operator["id"])
    
    return {"inquiries": inquiries, "count": len(inquiries)}

@router.get("/operator/inquiry/{mapping_id}")
async def get_inquiry_details_for_operator(
    mapping_id: str,
    user: dict = Depends(get_current_user)
):
    """Get detailed inquiry information for operator"""
    db = get_database()
    
    if "operator" not in user.get("roles", []):
        raise HTTPException(status_code=403, detail="Operator role required")
    
    operator = await db.operators.find_one({"user_id": user["id"]}, {"_id": 0, "id": 1})
    if not operator:
        raise HTTPException(status_code=404, detail="Operator profile not found")
    
    # Get mapping
    mapping = await db.inquiry_operator_mappings.find_one(
        {"id": mapping_id, "operator_id": operator["id"]},
        {"_id": 0}
    )
    
    if not mapping:
        raise HTTPException(status_code=404, detail="Inquiry not found")
    
    # Get booking details
    booking = await db.bookings.find_one({"id": mapping["booking_id"]}, {"_id": 0})
    
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    # Prepare response WITHOUT customer contact details
    from services.inquiry_broadcast_service import prepare_operator_notification
    
    inquiry_details = prepare_operator_notification(booking, mapping["distance_km"])
    inquiry_details["mapping_id"] = mapping_id
    inquiry_details["status"] = mapping["status"]
    inquiry_details["expire_at"] = mapping["expire_at"]
    inquiry_details["created_at"] = mapping["created_at"]
    
    return inquiry_details

@router.post("/operator/accept/{mapping_id}")
async def accept_inquiry(
    mapping_id: str,
    request: Request,
    data: dict = None,
    user: dict = Depends(get_current_user)
):
    """Operator accepts an inquiry"""
    db = get_database()
    
    if "operator" not in user.get("roles", []):
        raise HTTPException(status_code=403, detail="Operator role required")
    
    operator = await db.operators.find_one({"user_id": user["id"]}, {"_id": 0, "id": 1})
    if not operator:
        raise HTTPException(status_code=404, detail="Operator profile not found")
    
    # Get client info
    ip_address = request.client.host if request.client else None
    device_info = request.headers.get("User-Agent", "")
    remark = data.get("remark") if data else None
    
    result = await operator_accept_inquiry(
        mapping_id=mapping_id,
        operator_id=operator["id"],
        ip_address=ip_address,
        device_info=device_info,
        remark=remark
    )
    
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    
    return result

@router.post("/operator/reject/{mapping_id}")
async def reject_inquiry(
    mapping_id: str,
    request: Request,
    data: dict = None,
    user: dict = Depends(get_current_user)
):
    """Operator rejects an inquiry"""
    db = get_database()
    
    if "operator" not in user.get("roles", []):
        raise HTTPException(status_code=403, detail="Operator role required")
    
    operator = await db.operators.find_one({"user_id": user["id"]}, {"_id": 0, "id": 1})
    if not operator:
        raise HTTPException(status_code=404, detail="Operator profile not found")
    
    # Get client info
    ip_address = request.client.host if request.client else None
    device_info = request.headers.get("User-Agent", "")
    reason = data.get("reason") if data else None
    
    result = await operator_reject_inquiry(
        mapping_id=mapping_id,
        operator_id=operator["id"],
        reason=reason,
        ip_address=ip_address,
        device_info=device_info
    )
    
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    
    return result

@router.get("/operator/history")
async def get_inquiry_history_for_operator(
    status: Optional[str] = None,
    user: dict = Depends(get_current_user)
):
    """Get inquiry history for operator"""
    db = get_database()
    
    if "operator" not in user.get("roles", []):
        raise HTTPException(status_code=403, detail="Operator role required")
    
    operator = await db.operators.find_one({"user_id": user["id"]}, {"_id": 0, "id": 1})
    if not operator:
        raise HTTPException(status_code=404, detail="Operator profile not found")
    
    query = {"operator_id": operator["id"]}
    if status:
        query["status"] = status
    
    mappings = await db.inquiry_operator_mappings.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    return {"history": mappings}

# ============== ADMIN ENDPOINTS ==============

@router.get("/admin/broadcasts")
async def get_all_broadcasts(
    status: Optional[str] = None,
    user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN]))
):
    """Get all inquiry broadcasts"""
    db = get_database()
    
    query = {}
    if status:
        query["status"] = status
    
    broadcasts = await db.inquiry_broadcasts.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    # Enrich with operator response stats
    for broadcast in broadcasts:
        stats = await db.inquiry_operator_mappings.aggregate([
            {"$match": {"broadcast_id": broadcast["id"]}},
            {"$group": {"_id": "$status", "count": {"$sum": 1}}}
        ]).to_list(10)
        
        broadcast["response_stats"] = {s["_id"]: s["count"] for s in stats}
    
    return {"broadcasts": broadcasts}

@router.get("/admin/broadcast/{broadcast_id}")
async def get_broadcast_details(
    broadcast_id: str,
    user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN]))
):
    """Get detailed broadcast information including all operator responses"""
    db = get_database()
    
    broadcast = await db.inquiry_broadcasts.find_one(
        {"id": broadcast_id},
        {"_id": 0}
    )
    
    if not broadcast:
        raise HTTPException(status_code=404, detail="Broadcast not found")
    
    # Get all operator mappings
    mappings = await db.inquiry_operator_mappings.find(
        {"broadcast_id": broadcast_id},
        {"_id": 0}
    ).sort("distance_km", 1).to_list(100)
    
    # Get action logs
    action_logs = await db.inquiry_action_logs.find(
        {"inquiry_id": broadcast["inquiry_id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    return {
        "broadcast": broadcast,
        "operator_mappings": mappings,
        "action_logs": action_logs
    }

@router.post("/admin/test-broadcast")
async def test_broadcast(
    data: dict,
    user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN]))
):
    """Test broadcast to find eligible operators without actually sending notifications"""
    pickup_lat = data.get("pickup_lat")
    pickup_lon = data.get("pickup_lon")
    radius_km = data.get("radius_km", 500)
    
    if not pickup_lat or not pickup_lon:
        raise HTTPException(status_code=400, detail="pickup_lat and pickup_lon required")
    
    operators = await find_operators_in_radius(
        pickup_lat, pickup_lon, radius_km
    )
    
    return {
        "pickup_coordinates": {"lat": pickup_lat, "lon": pickup_lon},
        "radius_km": radius_km,
        "eligible_operators": len(operators),
        "operators": [
            {
                "id": op["id"],
                "company_name": op.get("company_name"),
                "distance_km": op["distance_km"],
                "match_type": op["match_type"]
            }
            for op in operators
        ]
    }

@router.post("/admin/expire-old")
async def trigger_expire_old_inquiries(
    user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN]))
):
    """Manually trigger expiration of old inquiries"""
    await expire_old_inquiries()
    return {"message": "Expiration task completed"}

# ============== OPERATOR REVISE QUOTE ==============

@router.post("/operator/revise-quote/{mapping_id}")
async def operator_revise_quote(
    mapping_id: str,
    data: dict,
    user: dict = Depends(require_roles([UserRole.OPERATOR]))
):
    """
    Operator sends a revised quote to customer
    ऑपरेटर ग्राहक को संशोधित कोट भेजता है
    """
    db = get_database()
    
    # Get mapping
    mapping = await db.inquiry_operator_mappings.find_one(
        {"id": mapping_id, "operator_id": user["id"]},
        {"_id": 0}
    )
    
    if not mapping:
        raise HTTPException(status_code=404, detail="Inquiry mapping not found")
    
    if mapping.get("status") not in ["pending", "sent"]:
        raise HTTPException(status_code=400, detail="Cannot revise quote - inquiry already processed")
    
    amount = data.get("amount")
    notes = data.get("notes", "")
    
    if not amount or amount <= 0:
        raise HTTPException(status_code=400, detail="Valid amount required")
    
    inquiry_id = mapping["inquiry_id"]
    
    # Get inquiry details
    inquiry = await db.inquiries.find_one({"id": inquiry_id}, {"_id": 0})
    if not inquiry:
        inquiry = await db.bookings.find_one({"id": inquiry_id}, {"_id": 0})
    
    # Create quote record
    quote_id = str(uuid4())
    quote = {
        "id": quote_id,
        "booking_id": inquiry_id,
        "inquiry_id": inquiry_id,
        "operator_id": user["id"],
        "operator_name": user.get("company_name") or user.get("full_name"),
        "amount": float(amount),
        "original_amount": inquiry.get("estimated_price", 0) if inquiry else 0,
        "notes": notes,
        "status": "sent",
        "revision_count": 1,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.quotes.insert_one(quote.copy())
    
    # Update mapping status
    await db.inquiry_operator_mappings.update_one(
        {"id": mapping_id},
        {"$set": {
            "status": "quote_sent",
            "quote_id": quote_id,
            "quote_amount": float(amount),
            "quote_sent_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Update inquiry status
    if inquiry:
        await db.inquiries.update_one(
            {"id": inquiry_id},
            {"$set": {
                "status": "quote_received",
                "updated_at": datetime.now(timezone.utc).isoformat()
            },
            "$push": {
                "operator_responses": {
                    "operator_id": user["id"],
                    "operator_name": quote["operator_name"],
                    "response_type": "revised_quote",
                    "amount": float(amount),
                    "notes": notes,
                    "timestamp": datetime.now(timezone.utc).isoformat()
                }
            }}
        )
    
    # Log the action
    await db.inquiry_action_logs.insert_one({
        "id": str(uuid4()),
        "inquiry_id": inquiry_id,
        "mapping_id": mapping_id,
        "operator_id": user["id"],
        "action": "revised_quote",
        "amount": float(amount),
        "notes": notes,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    # TODO: Send notification to customer
    
    return {
        "success": True,
        "message": "Revised quote sent to customer / संशोधित कोट ग्राहक को भेजा गया",
        "quote_id": quote_id,
        "amount": float(amount)
    }
