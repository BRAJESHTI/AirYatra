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
    # Insurance settings
    insurance_enabled: bool = True
    insurance_coverage_amount: float = 10000000.0  # ₹1 Crore coverage
    insurance_rate_type: str = "fixed"  # "fixed" or "percentage"
    insurance_fixed_rate: float = 500.0  # ₹500 per passenger
    insurance_percentage_rate: float = 0.00001  # 0.00001% of coverage

class FlightTypePricingSettings(BaseModel):
    """Flight Type Pricing / उड़ान प्रकार मूल्य निर्धारण"""
    # 1 Hour Flight / 1 घंटे की उड़ान
    one_hour_flight_price: float = 75000.0
    one_hour_flight_enabled: bool = True
    # 2 Hour Flight / 2 घंटे की उड़ान
    two_hour_flight_price: float = 140000.0
    two_hour_flight_enabled: bool = True
    # Half Day Booking / आधे दिन की बुकिंग
    half_day_price: float = 250000.0
    half_day_duration_hours: int = 4
    half_day_enabled: bool = True
    # Full Day Single City / पूरे दिन - एक शहर से दूसरे शहर
    full_day_single_price: float = 450000.0
    full_day_single_duration_hours: int = 8
    full_day_single_enabled: bool = True
    # Full Day Multiple Locations / पूरे दिन - मल्टीपल लोकेशन
    full_day_multi_base_price: float = 500000.0
    full_day_multi_per_stop_price: float = 50000.0
    full_day_multi_max_stops: int = 5
    full_day_multi_enabled: bool = True
    # Point to Point / पॉइंट टू पॉइंट
    point_to_point_base_price: float = 50000.0
    point_to_point_rate_per_km: float = 800.0
    point_to_point_enabled: bool = True

class APIKeysSettings(BaseModel):
    # Email Service (SendGrid)
    sendgrid_api_key: str = ""
    sendgrid_from_email: str = ""
    sendgrid_from_name: str = "AirYatra"
    # SMS Service (Twilio)
    twilio_account_sid: str = ""
    twilio_auth_token: str = ""
    twilio_phone_number: str = ""
    # Payment Service (Razorpay)
    razorpay_key_id: str = ""
    razorpay_key_secret: str = ""
    razorpay_webhook_secret: str = ""
    # Location/Maps API
    google_maps_api_key: str = ""
    # AWS S3
    aws_access_key_id: str = ""
    aws_secret_access_key: str = ""
    aws_s3_bucket: str = ""
    aws_region: str = "ap-south-1"
    # Insurance Provider
    insurance_provider_api_key: str = ""
    insurance_provider_email: str = ""

class TermsConditionsSettings(BaseModel):
    customer_terms: str = ""
    operator_terms: str = ""
    pilot_terms: str = ""
    privacy_policy: str = ""
    insurance_terms: str = ""
    last_updated: str = ""

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

@router.get("/pricing")
async def get_pricing_settings(
    current_user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN])),
    db=Depends(get_database)
):
    """Get helicopter pricing settings"""
    pricing = await db.pricing_settings.find_one({"type": "helicopter_pricing"}, {"_id": 0})
    if not pricing:
        # Create default pricing
        pricing = PricingSettings().dict()
        pricing["type"] = "helicopter_pricing"
        pricing["id"] = str(uuid4())
        pricing["created_at"] = datetime.now(timezone.utc).isoformat()
        await db.pricing_settings.insert_one(pricing)
    return pricing

@router.put("/pricing")
async def update_pricing_settings(
    pricing: PricingSettings,
    current_user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN])),
    db=Depends(get_database)
):
    """Update helicopter pricing settings"""
    pricing_data = pricing.dict()
    pricing_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    pricing_data["updated_by"] = current_user["id"]
    
    await db.pricing_settings.update_one(
        {"type": "helicopter_pricing"},
        {"$set": pricing_data},
        upsert=True
    )
    
    # Log audit
    await db.audit_logs.insert_one({
        "id": str(uuid4()),
        "action": "pricing_settings_update",
        "entity_type": "settings",
        "entity_id": "pricing",
        "user_id": current_user["id"],
        "user_name": current_user.get("full_name"),
        "changes": pricing_data,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {"message": "Pricing settings updated", "pricing": pricing_data}

@router.get("/pricing/public")
async def get_public_pricing(db=Depends(get_database)):
    """Get pricing settings (public - for price calculator)"""
    pricing = await db.pricing_settings.find_one({"type": "helicopter_pricing"}, {"_id": 0})
    if not pricing:
        pricing = PricingSettings().dict()
    return {
        "base_price_upto_50km": pricing.get("base_price_upto_50km", 50000),
        "rate_per_km_after_50": pricing.get("rate_per_km_after_50", 1000),
        "waiting_charge_per_hour": pricing.get("waiting_charge_per_hour", 5000),
        "gst_percent": pricing.get("gst_percent", 18),
        "advance_percent": pricing.get("advance_percent", 5),
        "insurance_enabled": pricing.get("insurance_enabled", True),
        "insurance_coverage_amount": pricing.get("insurance_coverage_amount", 10000000),
        "insurance_rate_type": pricing.get("insurance_rate_type", "fixed"),
        "insurance_fixed_rate": pricing.get("insurance_fixed_rate", 500),
        "insurance_percentage_rate": pricing.get("insurance_percentage_rate", 0.00001)
    }

# API Keys Management
@router.get("/api-keys")
async def get_api_keys(
    current_user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN])),
    db=Depends(get_database)
):
    """Get API keys settings (masked)"""
    api_keys = await db.api_keys_settings.find_one({"type": "api_keys"}, {"_id": 0})
    if not api_keys:
        api_keys = APIKeysSettings().dict()
    
    # Mask sensitive keys for display
    masked_keys = {}
    for key, value in api_keys.items():
        if key in ["type", "id", "created_at", "updated_at"]:
            masked_keys[key] = value
        elif value and len(str(value)) > 8:
            masked_keys[key] = str(value)[:4] + "****" + str(value)[-4:]
        else:
            masked_keys[key] = "****" if value else ""
    
    return masked_keys

@router.put("/api-keys")
async def update_api_keys(
    api_keys: APIKeysSettings,
    current_user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN])),
    db=Depends(get_database)
):
    """Update API keys settings"""
    api_keys_data = api_keys.dict()
    api_keys_data["type"] = "api_keys"
    api_keys_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    api_keys_data["updated_by"] = current_user["id"]
    
    await db.api_keys_settings.update_one(
        {"type": "api_keys"},
        {"$set": api_keys_data},
        upsert=True
    )
    
    # Log audit (without actual key values)
    await db.audit_logs.insert_one({
        "id": str(uuid4()),
        "action": "api_keys_update",
        "entity_type": "settings",
        "entity_id": "api_keys",
        "user_id": current_user["id"],
        "user_name": current_user.get("full_name"),
        "changes": {"updated_fields": list(api_keys_data.keys())},
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {"message": "API keys updated successfully"}

# Terms & Conditions Management
@router.get("/terms-conditions")
async def get_terms_conditions(db=Depends(get_database)):
    """Get terms and conditions (public)"""
    terms = await db.terms_conditions.find_one({"type": "terms"}, {"_id": 0})
    if not terms:
        terms = TermsConditionsSettings().dict()
    return terms

@router.put("/terms-conditions")
async def update_terms_conditions(
    terms: TermsConditionsSettings,
    current_user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN])),
    db=Depends(get_database)
):
    """Update terms and conditions"""
    terms_data = terms.dict()
    terms_data["type"] = "terms"
    terms_data["last_updated"] = datetime.now(timezone.utc).isoformat()
    terms_data["updated_by"] = current_user["id"]
    
    await db.terms_conditions.update_one(
        {"type": "terms"},
        {"$set": terms_data},
        upsert=True
    )
    
    return {"message": "Terms and conditions updated"}

# Terms Agreement Records
@router.get("/terms-agreements")
async def get_terms_agreements(
    user_type: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    current_user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN])),
    db=Depends(get_database)
):
    """Get list of users who agreed to terms"""
    query = {}
    if user_type:
        query["user_type"] = user_type
    
    agreements = await db.terms_agreements.find(query, {"_id": 0}).sort("agreed_at", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.terms_agreements.count_documents(query)
    
    return {"agreements": agreements, "total": total}

# ============== FLIGHT TYPE PRICING ==============

@router.get("/flight-type-pricing")
async def get_flight_type_pricing(
    db=Depends(get_database)
):
    """
    Get flight type pricing (public - for booking page)
    उड़ान प्रकार मूल्य निर्धारण प्राप्त करें
    """
    pricing = await db.flight_type_pricing.find_one({"type": "flight_type_pricing"}, {"_id": 0})
    if not pricing:
        # Create default pricing
        pricing = FlightTypePricingSettings().dict()
        pricing["type"] = "flight_type_pricing"
        pricing["id"] = str(uuid4())
        pricing["created_at"] = datetime.now(timezone.utc).isoformat()
        await db.flight_type_pricing.insert_one(pricing)
    
    # Return only enabled flight types with prices
    flight_types = []
    
    if pricing.get("one_hour_flight_enabled", True):
        flight_types.append({
            "id": "one_hour",
            "name": "1 घंटे की उड़ान",
            "name_en": "1 Hour Flight",
            "description": "1 hour helicopter ride within city limits",
            "description_hi": "शहर की सीमा के भीतर 1 घंटे की हेलीकॉप्टर सवारी",
            "price": pricing.get("one_hour_flight_price", 75000),
            "duration_hours": 1,
            "type": "fixed",
            "icon": "🚁"
        })
    
    if pricing.get("two_hour_flight_enabled", True):
        flight_types.append({
            "id": "two_hour",
            "name": "2 घंटे की उड़ान",
            "name_en": "2 Hour Flight",
            "description": "2 hour helicopter ride for extended tours",
            "description_hi": "विस्तारित टूर के लिए 2 घंटे की हेलीकॉप्टर सवारी",
            "price": pricing.get("two_hour_flight_price", 140000),
            "duration_hours": 2,
            "type": "fixed",
            "icon": "🚁"
        })
    
    if pricing.get("half_day_enabled", True):
        flight_types.append({
            "id": "half_day",
            "name": "Half-Day बुकिंग",
            "name_en": "Half Day Booking",
            "description": f"{pricing.get('half_day_duration_hours', 4)} hours - Multiple short trips",
            "description_hi": f"{pricing.get('half_day_duration_hours', 4)} घंटे - कई छोटी यात्राएं",
            "price": pricing.get("half_day_price", 250000),
            "duration_hours": pricing.get("half_day_duration_hours", 4),
            "type": "fixed",
            "icon": "⏰"
        })
    
    if pricing.get("full_day_single_enabled", True):
        flight_types.append({
            "id": "full_day_single",
            "name": "Full-Day उड़ान (Single City)",
            "name_en": "Full Day Flight - Single City to City",
            "description": f"{pricing.get('full_day_single_duration_hours', 8)} hours - One city to another city",
            "description_hi": f"{pricing.get('full_day_single_duration_hours', 8)} घंटे - एक शहर से दूसरे शहर",
            "price": pricing.get("full_day_single_price", 450000),
            "duration_hours": pricing.get("full_day_single_duration_hours", 8),
            "type": "fixed",
            "icon": "🏙️"
        })
    
    if pricing.get("full_day_multi_enabled", True):
        flight_types.append({
            "id": "full_day_multi",
            "name": "Full-Day मल्टीपल लोकेशन",
            "name_en": "Full Day - Multiple Locations",
            "description": f"Visit up to {pricing.get('full_day_multi_max_stops', 5)} locations in one day",
            "description_hi": f"एक दिन में {pricing.get('full_day_multi_max_stops', 5)} स्थानों तक जाएं",
            "base_price": pricing.get("full_day_multi_base_price", 500000),
            "per_stop_price": pricing.get("full_day_multi_per_stop_price", 50000),
            "max_stops": pricing.get("full_day_multi_max_stops", 5),
            "type": "multi_location",
            "icon": "📍"
        })
    
    if pricing.get("point_to_point_enabled", True):
        flight_types.append({
            "id": "point_to_point",
            "name": "Point-to-Point उड़ान",
            "name_en": "Point to Point Flight",
            "description": "Direct flight from pickup to drop location",
            "description_hi": "पिकअप से ड्रॉप लोकेशन तक सीधी उड़ान",
            "base_price": pricing.get("point_to_point_base_price", 50000),
            "rate_per_km": pricing.get("point_to_point_rate_per_km", 800),
            "type": "distance_based",
            "icon": "📍"
        })
    
    return {
        "flight_types": flight_types,
        "gst_percent": 18,
        "currency": "INR"
    }

@router.get("/flight-type-pricing/admin")
async def get_flight_type_pricing_admin(
    current_user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN])),
    db=Depends(get_database)
):
    """Get flight type pricing settings (admin)"""
    pricing = await db.flight_type_pricing.find_one({"type": "flight_type_pricing"}, {"_id": 0})
    if not pricing:
        pricing = FlightTypePricingSettings().dict()
        pricing["type"] = "flight_type_pricing"
    return pricing

@router.put("/flight-type-pricing")
async def update_flight_type_pricing(
    pricing: FlightTypePricingSettings,
    current_user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN])),
    db=Depends(get_database)
):
    """Update flight type pricing settings"""
    pricing_data = pricing.dict()
    pricing_data["type"] = "flight_type_pricing"
    pricing_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    pricing_data["updated_by"] = current_user["id"]
    
    await db.flight_type_pricing.update_one(
        {"type": "flight_type_pricing"},
        {"$set": pricing_data},
        upsert=True
    )
    
    # Audit log
    await db.audit_logs.insert_one({
        "id": str(uuid4()),
        "action": "flight_type_pricing_update",
        "entity_type": "settings",
        "entity_id": "flight_type_pricing",
        "user_id": current_user["id"],
        "user_name": current_user.get("full_name"),
        "changes": pricing_data,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {"message": "Flight type pricing updated", "pricing": pricing_data}

# ============== PAYMENT RULES BY PURPOSE ==============

DEFAULT_PAYMENT_RULES = [
    {"purpose": "wedding", "label": "Wedding / शादी", "icon": "💒", "advance_percent": 50, "can_pay_later": True},
    {"purpose": "temple_yatra", "label": "Temple Yatra / मंदिर यात्रा", "icon": "🛕", "advance_percent": 50, "can_pay_later": True},
    {"purpose": "company_tour", "label": "Corporate Tour / कॉर्पोरेट टूर", "icon": "🏢", "advance_percent": 50, "can_pay_later": True},
    {"purpose": "election_tour", "label": "Election Campaign / चुनाव प्रचार", "icon": "🗳️", "advance_percent": 100, "can_pay_later": False},
    {"purpose": "medical_emergency", "label": "Medical Emergency / मेडिकल", "icon": "🏥", "advance_percent": 100, "can_pay_later": False},
    {"purpose": "film_shooting", "label": "Film Shooting / फिल्म शूटिंग", "icon": "🎬", "advance_percent": 50, "can_pay_later": True},
    {"purpose": "general_tour", "label": "General Tour / सामान्य यात्रा", "icon": "✈️", "advance_percent": 50, "can_pay_later": True},
    {"purpose": "pilgrimage", "label": "Pilgrimage / तीर्थ यात्रा", "icon": "🙏", "advance_percent": 50, "can_pay_later": True},
    {"purpose": "business", "label": "Business Meeting / बिज़नेस", "icon": "💼", "advance_percent": 50, "can_pay_later": True},
    {"purpose": "other", "label": "Other / अन्य", "icon": "📝", "advance_percent": 100, "can_pay_later": False},
]

DEFAULT_GLOBAL_PAYMENT_SETTINGS = {
    "default_advance_percent": 50,
    "allow_partial_payment": True,
    "minimum_advance_percent": 25,
    "payment_deadline_hours": 24,
}

@router.get("/payment-rules")
async def get_payment_rules(
    current_user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN])),
    db=Depends(get_database)
):
    """Get payment rules by booking purpose"""
    settings = await db.payment_rules_settings.find_one({"type": "payment_rules"}, {"_id": 0})
    
    if not settings:
        return {
            "payment_rules": DEFAULT_PAYMENT_RULES,
            "global_settings": DEFAULT_GLOBAL_PAYMENT_SETTINGS
        }
    
    return {
        "payment_rules": settings.get("payment_rules", DEFAULT_PAYMENT_RULES),
        "global_settings": settings.get("global_settings", DEFAULT_GLOBAL_PAYMENT_SETTINGS)
    }

@router.get("/payment-rules/public")
async def get_payment_rules_public(db=Depends(get_database)):
    """Get payment rules (public - for booking page)"""
    settings = await db.payment_rules_settings.find_one({"type": "payment_rules"}, {"_id": 0})
    
    if not settings:
        return {
            "payment_rules": DEFAULT_PAYMENT_RULES,
            "global_settings": DEFAULT_GLOBAL_PAYMENT_SETTINGS
        }
    
    return {
        "payment_rules": settings.get("payment_rules", DEFAULT_PAYMENT_RULES),
        "global_settings": settings.get("global_settings", DEFAULT_GLOBAL_PAYMENT_SETTINGS)
    }

@router.put("/payment-rules")
async def update_payment_rules(
    data: dict,
    current_user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN])),
    db=Depends(get_database)
):
    """Update payment rules by booking purpose"""
    settings_data = {
        "type": "payment_rules",
        "payment_rules": data.get("payment_rules", DEFAULT_PAYMENT_RULES),
        "global_settings": data.get("global_settings", DEFAULT_GLOBAL_PAYMENT_SETTINGS),
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "updated_by": current_user["id"]
    }
    
    await db.payment_rules_settings.update_one(
        {"type": "payment_rules"},
        {"$set": settings_data},
        upsert=True
    )
    
    # Audit log
    await db.audit_logs.insert_one({
        "id": str(uuid4()),
        "action": "payment_rules_update",
        "entity_type": "settings",
        "entity_id": "payment_rules",
        "user_id": current_user["id"],
        "user_name": current_user.get("full_name"),
        "changes": settings_data,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {"message": "Payment rules updated successfully / भुगतान नियम अपडेट हो गए", "settings": settings_data}
