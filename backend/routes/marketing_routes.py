from fastapi import APIRouter, HTTPException, Depends, Query, BackgroundTasks
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, timezone, timedelta
from uuid import uuid4
from database import get_database
from routes.auth_routes import get_current_user

router = APIRouter(prefix="/marketing", tags=["Marketing & Campaigns"])

# Models
class CampaignCreate(BaseModel):
    name: str
    description: Optional[str] = None
    type: str = "email"  # email, sms, push, whatsapp
    target_audience: str = "all"  # all, tier_gold, tier_platinum, inactive, new_users, corporate
    subject: Optional[str] = None
    content: str
    scheduled_at: Optional[str] = None
    promo_code: Optional[str] = None
    discount_percent: Optional[float] = None
    discount_amount: Optional[float] = None
    min_booking_value: Optional[float] = None
    max_discount: Optional[float] = None
    valid_from: Optional[str] = None
    valid_until: Optional[str] = None

class PromoCodeCreate(BaseModel):
    code: str
    description: Optional[str] = None
    discount_type: str = "percent"  # percent, fixed
    discount_value: float
    min_booking_value: float = 0
    max_discount: Optional[float] = None
    max_uses: Optional[int] = None
    max_uses_per_user: int = 1
    valid_from: str
    valid_until: str
    applicable_routes: List[str] = []  # empty = all routes
    applicable_aircraft: List[str] = []  # empty = all aircraft
    target_users: List[str] = []  # empty = all users

class NotificationCreate(BaseModel):
    title: str
    message: str
    type: str = "info"  # info, promo, alert, update
    target_audience: str = "all"
    action_url: Optional[str] = None
    image_url: Optional[str] = None
    scheduled_at: Optional[str] = None

# Campaign Endpoints
@router.post("/campaigns")
async def create_campaign(campaign: CampaignCreate, current_user: dict = Depends(get_current_user)):
    """Create a marketing campaign"""
    if "admin" not in current_user.get("roles", []):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    db = get_database()
    
    campaign_data = {
        "id": str(uuid4()),
        "campaign_code": f"CAMP{datetime.now().strftime('%Y%m%d')}{str(uuid4())[:4].upper()}",
        **campaign.dict(),
        "status": "draft",  # draft, scheduled, running, paused, completed
        "stats": {
            "total_sent": 0,
            "delivered": 0,
            "opened": 0,
            "clicked": 0,
            "converted": 0,
            "unsubscribed": 0
        },
        "created_by": current_user["id"],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.campaigns.insert_one(campaign_data)
    campaign_data.pop("_id", None)
    
    return {"message": "Campaign created", "campaign": campaign_data}

@router.get("/campaigns")
async def get_campaigns(
    status: Optional[str] = None,
    type: Optional[str] = None,
    skip: int = 0,
    limit: int = 20,
    current_user: dict = Depends(get_current_user)
):
    """Get all campaigns"""
    if "admin" not in current_user.get("roles", []):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    db = get_database()
    
    query = {}
    if status:
        query["status"] = status
    if type:
        query["type"] = type
    
    campaigns = await db.campaigns.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.campaigns.count_documents(query)
    
    return {"campaigns": campaigns, "total": total}

@router.get("/campaigns/{campaign_id}")
async def get_campaign(campaign_id: str, current_user: dict = Depends(get_current_user)):
    """Get campaign details"""
    db = get_database()
    campaign = await db.campaigns.find_one({"id": campaign_id}, {"_id": 0})
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return campaign

@router.put("/campaigns/{campaign_id}/status")
async def update_campaign_status(
    campaign_id: str,
    status: str = Query(..., regex="^(draft|scheduled|running|paused|completed)$"),
    current_user: dict = Depends(get_current_user)
):
    """Update campaign status"""
    if "admin" not in current_user.get("roles", []):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    db = get_database()
    
    result = await db.campaigns.update_one(
        {"id": campaign_id},
        {"$set": {"status": status, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    return {"message": f"Campaign status updated to {status}"}

@router.get("/dashboard")
async def get_marketing_dashboard(current_user: dict = Depends(get_current_user)):
    """Get marketing dashboard stats"""
    if "admin" not in current_user.get("roles", []):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    db = get_database()
    
    # Campaign stats
    active_campaigns = await db.campaigns.count_documents({"status": "running"})
    total_campaigns = await db.campaigns.count_documents({})
    
    # Promo code stats
    active_promos = await db.promo_codes.count_documents({
        "status": "active",
        "valid_until": {"$gte": datetime.now(timezone.utc).isoformat()}
    })
    
    # Total promo usage
    pipeline = [
        {"$group": {"_id": None, "total_uses": {"$sum": "$used_count"}, "total_discount": {"$sum": "$total_discount_given"}}}
    ]
    promo_stats = await db.promo_codes.aggregate(pipeline).to_list(1)
    promo_usage = promo_stats[0] if promo_stats else {"total_uses": 0, "total_discount": 0}
    
    # Recent campaign performance
    recent_campaigns = await db.campaigns.find(
        {"status": {"$in": ["running", "completed"]}},
        {"_id": 0, "name": 1, "type": 1, "stats": 1, "status": 1}
    ).sort("created_at", -1).limit(5).to_list(5)
    
    return {
        "active_campaigns": active_campaigns,
        "total_campaigns": total_campaigns,
        "active_promo_codes": active_promos,
        "promo_usage": {
            "total_uses": promo_usage.get("total_uses", 0),
            "total_discount_given": promo_usage.get("total_discount", 0)
        },
        "recent_campaigns": recent_campaigns
    }

# Promo Codes
@router.post("/promo-codes")
async def create_promo_code(promo: PromoCodeCreate, current_user: dict = Depends(get_current_user)):
    """Create a promotional code"""
    if "admin" not in current_user.get("roles", []):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    db = get_database()
    
    # Check if code exists
    existing = await db.promo_codes.find_one({"code": promo.code.upper()})
    if existing:
        raise HTTPException(status_code=400, detail="Promo code already exists")
    
    promo_data = {
        "id": str(uuid4()),
        "code": promo.code.upper(),
        "description": promo.description,
        "discount_type": promo.discount_type,
        "discount_value": promo.discount_value,
        "min_booking_value": promo.min_booking_value,
        "max_discount": promo.max_discount,
        "max_uses": promo.max_uses,
        "max_uses_per_user": promo.max_uses_per_user,
        "valid_from": promo.valid_from,
        "valid_until": promo.valid_until,
        "applicable_routes": promo.applicable_routes,
        "applicable_aircraft": promo.applicable_aircraft,
        "target_users": promo.target_users,
        "status": "active",
        "used_count": 0,
        "total_discount_given": 0,
        "created_by": current_user["id"],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.promo_codes.insert_one(promo_data)
    promo_data.pop("_id", None)
    
    return {"message": "Promo code created", "promo": promo_data}

@router.get("/promo-codes")
async def get_promo_codes(
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get all promo codes"""
    if "admin" not in current_user.get("roles", []):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    db = get_database()
    
    query = {}
    if status:
        query["status"] = status
    
    promos = await db.promo_codes.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    return {"promo_codes": promos}

@router.post("/promo-codes/validate")
async def validate_promo_code(
    code: str,
    booking_value: float,
    current_user: dict = Depends(get_current_user)
):
    """Validate a promo code for booking"""
    db = get_database()
    
    promo = await db.promo_codes.find_one({"code": code.upper(), "status": "active"})
    if not promo:
        raise HTTPException(status_code=404, detail="Invalid or expired promo code")
    
    now = datetime.now(timezone.utc).isoformat()
    
    # Check validity period
    if promo["valid_from"] > now or promo["valid_until"] < now:
        raise HTTPException(status_code=400, detail="Promo code is not valid at this time")
    
    # Check max uses
    if promo.get("max_uses") and promo["used_count"] >= promo["max_uses"]:
        raise HTTPException(status_code=400, detail="Promo code usage limit reached")
    
    # Check min booking value
    if booking_value < promo["min_booking_value"]:
        raise HTTPException(status_code=400, detail=f"Minimum booking value ₹{promo['min_booking_value']} required")
    
    # Check per-user limit
    user_usage = await db.promo_usage.count_documents({
        "promo_id": promo["id"],
        "user_id": current_user["id"]
    })
    if user_usage >= promo["max_uses_per_user"]:
        raise HTTPException(status_code=400, detail="You have already used this promo code")
    
    # Calculate discount
    if promo["discount_type"] == "percent":
        discount = booking_value * (promo["discount_value"] / 100)
        if promo.get("max_discount"):
            discount = min(discount, promo["max_discount"])
    else:
        discount = promo["discount_value"]
    
    return {
        "valid": True,
        "code": promo["code"],
        "discount": round(discount, 2),
        "final_amount": round(booking_value - discount, 2),
        "description": promo.get("description")
    }

@router.put("/promo-codes/{promo_id}/status")
async def update_promo_status(
    promo_id: str,
    status: str = Query(..., regex="^(active|paused|expired)$"),
    current_user: dict = Depends(get_current_user)
):
    """Update promo code status"""
    if "admin" not in current_user.get("roles", []):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    db = get_database()
    
    result = await db.promo_codes.update_one(
        {"id": promo_id},
        {"$set": {"status": status}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Promo code not found")
    
    return {"message": f"Promo code status updated to {status}"}

# Push Notifications
@router.post("/notifications")
async def create_notification(notification: NotificationCreate, current_user: dict = Depends(get_current_user)):
    """Create a push notification"""
    if "admin" not in current_user.get("roles", []):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    db = get_database()
    
    notif_data = {
        "id": str(uuid4()),
        **notification.dict(),
        "status": "scheduled" if notification.scheduled_at else "pending",
        "sent_count": 0,
        "read_count": 0,
        "click_count": 0,
        "created_by": current_user["id"],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.push_notifications.insert_one(notif_data)
    notif_data.pop("_id", None)
    
    return {"message": "Notification created", "notification": notif_data}

@router.get("/notifications")
async def get_notifications(
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get all push notifications"""
    if "admin" not in current_user.get("roles", []):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    db = get_database()
    
    query = {}
    if status:
        query["status"] = status
    
    notifications = await db.push_notifications.find(query, {"_id": 0}).sort("created_at", -1).to_list(50)
    return {"notifications": notifications}

@router.post("/notifications/{notif_id}/send")
async def send_notification(notif_id: str, current_user: dict = Depends(get_current_user)):
    """Send a notification immediately"""
    if "admin" not in current_user.get("roles", []):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    db = get_database()
    
    notification = await db.push_notifications.find_one({"id": notif_id})
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    # In real implementation, this would send to push notification service
    # For now, we'll just update status
    
    await db.push_notifications.update_one(
        {"id": notif_id},
        {"$set": {
            "status": "sent",
            "sent_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"message": "Notification sent"}
