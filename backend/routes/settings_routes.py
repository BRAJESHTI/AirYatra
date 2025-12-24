from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, Dict, List
from datetime import datetime, timezone
from uuid import uuid4
from database import get_database
from middleware import get_current_user, require_roles
from models import UserRole

router = APIRouter(prefix="/settings", tags=["Global Settings"])

class PlatformSettings(BaseModel):
    platform_commission_percent: float = 10.0
    min_booking_amount: float = 5000.0
    max_booking_amount: float = 5000000.0
    cancellation_fee_percent: float = 10.0
    refund_processing_days: int = 7
    booking_advance_days_min: int = 1
    booking_advance_days_max: int = 90
    gst_percent: float = 18.0
    tds_percent: float = 2.0

class PricingSettings(BaseModel):
    base_price_upto_50km: float = 50000.0  # ₹50,000 minimum for up to 50km
    rate_per_km_after_50: float = 1000.0   # ₹1,000 per km after 50km
    waiting_charge_per_hour: float = 5000.0  # ₹5,000 per hour waiting
    gst_percent: float = 18.0
    advance_percent: float = 5.0  # 5% advance payment required

class RegionSettings(BaseModel):
    region_name: str
    region_code: str
    states: List[str]
    is_active: bool = True
    regional_manager_id: Optional[str] = None

class NotificationTemplate(BaseModel):
    template_name: str
    template_type: str  # email, whatsapp, sms
    subject: Optional[str] = None
    content: str
    variables: List[str] = []

@router.get("/platform")
async def get_platform_settings(
    current_user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN])),
    db=Depends(get_database)
):
    """Get platform-wide settings"""
    settings = await db.platform_settings.find_one({"type": "platform"}, {"_id": 0})
    if not settings:
        # Return defaults
        settings = PlatformSettings().dict()
        settings["type"] = "platform"
        settings["id"] = str(uuid4())
        settings["created_at"] = datetime.now(timezone.utc).isoformat()
        await db.platform_settings.insert_one(settings)
    return settings

@router.put("/platform")
async def update_platform_settings(
    settings: PlatformSettings,
    current_user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN])),
    db=Depends(get_database)
):
    """Update platform-wide settings"""
    settings_data = settings.dict()
    settings_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    settings_data["updated_by"] = current_user["id"]
    
    await db.platform_settings.update_one(
        {"type": "platform"},
        {"$set": settings_data},
        upsert=True
    )
    
    # Log audit
    await db.audit_logs.insert_one({
        "id": str(uuid4()),
        "action": "platform_settings_update",
        "entity_type": "settings",
        "entity_id": "platform",
        "user_id": current_user["id"],
        "user_name": current_user.get("full_name"),
        "changes": settings_data,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {"message": "Settings updated", "settings": settings_data}

@router.get("/regions")
async def get_regions(
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """Get all regions"""
    regions = await db.regions.find({}, {"_id": 0}).to_list(100)
    return {"regions": regions}

@router.post("/regions")
async def create_region(
    region: RegionSettings,
    current_user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN])),
    db=Depends(get_database)
):
    """Create a new region"""
    region_data = region.dict()
    region_data["id"] = str(uuid4())
    region_data["created_at"] = datetime.now(timezone.utc).isoformat()
    region_data["created_by"] = current_user["id"]
    
    await db.regions.insert_one(region_data)
    return {"message": "Region created", "region": region_data}

@router.put("/regions/{region_id}")
async def update_region(
    region_id: str,
    region: RegionSettings,
    current_user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN])),
    db=Depends(get_database)
):
    """Update a region"""
    region_data = region.dict()
    region_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.regions.update_one({"id": region_id}, {"$set": region_data})
    return {"message": "Region updated"}

@router.delete("/regions/{region_id}")
async def delete_region(
    region_id: str,
    current_user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN])),
    db=Depends(get_database)
):
    """Delete a region"""
    await db.regions.delete_one({"id": region_id})
    return {"message": "Region deleted"}

@router.get("/notification-templates")
async def get_notification_templates(
    template_type: Optional[str] = None,
    current_user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN])),
    db=Depends(get_database)
):
    """Get notification templates"""
    query = {}
    if template_type:
        query["template_type"] = template_type
    
    templates = await db.notification_templates.find(query, {"_id": 0}).to_list(100)
    return {"templates": templates}

@router.post("/notification-templates")
async def create_notification_template(
    template: NotificationTemplate,
    current_user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN])),
    db=Depends(get_database)
):
    """Create a notification template"""
    template_data = template.dict()
    template_data["id"] = str(uuid4())
    template_data["created_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.notification_templates.insert_one(template_data)
    return {"message": "Template created", "template": template_data}

@router.put("/notification-templates/{template_id}")
async def update_notification_template(
    template_id: str,
    template: NotificationTemplate,
    current_user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN])),
    db=Depends(get_database)
):
    """Update a notification template"""
    template_data = template.dict()
    template_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.notification_templates.update_one({"id": template_id}, {"$set": template_data})
    return {"message": "Template updated"}

@router.get("/commission-tiers")
async def get_commission_tiers(
    current_user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN])),
    db=Depends(get_database)
):
    """Get commission tiers for operators"""
    tiers = await db.commission_tiers.find({}, {"_id": 0}).to_list(100)
    if not tiers:
        # Default tiers
        tiers = [
            {"id": str(uuid4()), "tier_name": "Standard", "min_bookings": 0, "commission_percent": 15.0},
            {"id": str(uuid4()), "tier_name": "Silver", "min_bookings": 50, "commission_percent": 12.0},
            {"id": str(uuid4()), "tier_name": "Gold", "min_bookings": 100, "commission_percent": 10.0},
            {"id": str(uuid4()), "tier_name": "Platinum", "min_bookings": 250, "commission_percent": 8.0},
        ]
        for tier in tiers:
            await db.commission_tiers.insert_one(tier)
    return {"tiers": tiers}
