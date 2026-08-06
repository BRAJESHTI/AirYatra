"""
Verification Rule Engine (VRE) Routes
Complete 18-point configurable verification system
"""

from fastapi import APIRouter, HTTPException, Depends, Query, Request, BackgroundTasks
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone, timedelta
from database import get_database
from middleware import get_current_user, require_roles
from pydantic import BaseModel, Field
from enum import Enum
from services.sandbox_kyc_service import get_sandbox_service
import uuid
import logging
import re

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/vre", tags=["Verification Rule Engine"])


# ============ INLINE MODELS ============

class VerificationMode(str, Enum):
    DISABLED = "disabled"
    OPTIONAL = "optional"
    MANDATORY = "mandatory"

class VerificationType(str, Enum):
    MOBILE_OTP = "mobile_otp"
    EMAIL_OTP = "email_otp"
    PAN = "pan"
    AADHAAR = "aadhaar"
    FACE = "face"
    DIGILOCKER = "digilocker"
    BANK_ACCOUNT = "bank_account"
    GST = "gst"
    CIN = "cin"
    MSME = "msme"
    PENNY_DROP = "penny_drop"
    PASSPORT = "passport"
    DRIVING_LICENCE = "driving_licence"

class ServiceStatus(str, Enum):
    NORMAL = "normal"
    MANUAL_MODE = "manual_mode"
    DISABLED = "disabled"

class AutoRuleTrigger(str, Enum):
    GST_CANCELLED = "gst_cancelled"
    BANK_VERIFICATION_FAILED = "bank_verification_failed"
    INSURANCE_EXPIRED = "insurance_expired"
    PILOT_MEDICAL_EXPIRED = "pilot_medical_expired"

class AutoRuleAction(str, Enum):
    SUSPEND_OPERATOR = "suspend_operator"
    HIDE_AIRCRAFT = "hide_aircraft"
    HOLD_PAYOUT = "hold_payout"
    NOTIFY_FINANCE = "notify_finance"
    NOTIFY_COMPLIANCE = "notify_compliance"
    NOTIFY_OPERATOR = "notify_operator"

class VREConfigUpdateRequest(BaseModel):
    service_type: Optional[str] = None
    mode: Optional[VerificationMode] = None
    score_weight: Optional[int] = None
    reason: str
    otp: Optional[str] = None

class BookingRuleUpdateRequest(BaseModel):
    rule_id: str
    min_amount: Optional[float] = None
    max_amount: Optional[float] = None
    required_verifications: Optional[List[str]] = None
    is_active: Optional[bool] = None
    reason: str
    otp: Optional[str] = None

class AutoRuleCreateRequest(BaseModel):
    name: str
    name_hi: str
    trigger: AutoRuleTrigger
    trigger_conditions: Dict[str, Any] = {}
    actions: List[AutoRuleAction]
    notification_recipients: List[str] = []

class EmergencyOverrideRequest(BaseModel):
    service_type: VerificationType
    new_status: ServiceStatus
    reason: str
    otp: Optional[str] = None


# ============ DEFAULT CONFIGURATIONS ============

DEFAULT_CUSTOMER_SERVICES = [
    {"service_type": "mobile_otp", "mode": "mandatory", "score_weight": 15, "description": "Mobile OTP Verification", "description_hi": "मोबाइल OTP सत्यापन"},
    {"service_type": "email_otp", "mode": "optional", "score_weight": 10, "description": "Email OTP Verification", "description_hi": "ईमेल OTP सत्यापन"},
    {"service_type": "pan", "mode": "optional", "score_weight": 20, "description": "PAN Card Verification", "description_hi": "पैन कार्ड सत्यापन"},
    {"service_type": "aadhaar", "mode": "optional", "score_weight": 20, "description": "Aadhaar eKYC", "description_hi": "आधार ई-केवाईसी"},
    {"service_type": "bank_account", "mode": "disabled", "score_weight": 15, "description": "Bank Account Verification", "description_hi": "बैंक खाता सत्यापन"},
    {"service_type": "face", "mode": "disabled", "score_weight": 10, "description": "Face Verification", "description_hi": "चेहरा सत्यापन"},
    {"service_type": "digilocker", "mode": "disabled", "score_weight": 10, "description": "DigiLocker Verification", "description_hi": "डिजीलॉकर सत्यापन"},
]

DEFAULT_OPERATOR_SERVICES = [
    {"service_type": "mobile_otp", "mode": "mandatory", "score_weight": 10, "description": "Mobile OTP", "description_hi": "मोबाइल OTP"},
    {"service_type": "email_otp", "mode": "mandatory", "score_weight": 10, "description": "Email OTP", "description_hi": "ईमेल OTP"},
    {"service_type": "pan", "mode": "mandatory", "score_weight": 20, "description": "Business PAN", "description_hi": "व्यापार पैन"},
    {"service_type": "gst", "mode": "mandatory", "score_weight": 20, "description": "GST Verification", "description_hi": "जीएसटी सत्यापन"},
    {"service_type": "bank_account", "mode": "mandatory", "score_weight": 20, "description": "Bank Account", "description_hi": "बैंक खाता"},
    {"service_type": "cin", "mode": "optional", "score_weight": 10, "description": "Company CIN", "description_hi": "कंपनी CIN"},
    {"service_type": "msme", "mode": "disabled", "score_weight": 10, "description": "MSME Registration", "description_hi": "एमएसएमई पंजीकरण"},
]

DEFAULT_BOOKING_RULES = [
    {
        "rule_id": "rule_1",
        "min_amount": 0,
        "max_amount": 50000,
        "required_verifications": ["mobile_otp"],
        "description": "Basic booking ≤ ₹50,000",
        "description_hi": "₹50,000 तक की बुकिंग - केवल मोबाइल OTP"
    },
    {
        "rule_id": "rule_2",
        "min_amount": 50000,
        "max_amount": 200000,
        "required_verifications": ["mobile_otp", "pan"],
        "description": "Medium booking ₹50K - ₹2L",
        "description_hi": "₹50K से ₹2L की बुकिंग - PAN + OTP अनिवार्य"
    },
    {
        "rule_id": "rule_3",
        "min_amount": 200000,
        "max_amount": None,
        "required_verifications": ["mobile_otp", "pan", "aadhaar"],
        "description": "High value booking > ₹2L",
        "description_hi": "₹2L से अधिक की बुकिंग - पूर्ण KYC अनिवार्य"
    },
    {
        "rule_id": "rule_corporate",
        "min_amount": 0,
        "max_amount": None,
        "required_verifications": ["gst", "pan", "cin"],
        "description": "Corporate booking",
        "description_hi": "कॉर्पोरेट बुकिंग - GST + PAN + CIN"
    }
]

DEFAULT_AUTO_RULES = [
    {
        "rule_id": "auto_1",
        "name": "GST Cancelled → Suspend Operator",
        "name_hi": "GST रद्द → ऑपरेटर सस्पेंड",
        "trigger": "gst_cancelled",
        "trigger_conditions": {"gst_status": "CANCELLED"},
        "actions": ["suspend_operator", "hide_aircraft", "notify_compliance"],
        "is_active": True
    },
    {
        "rule_id": "auto_2",
        "name": "Bank Verification Failed → Hold Payout",
        "name_hi": "बैंक वेरिफिकेशन फेल → पेआउट होल्ड",
        "trigger": "bank_verification_failed",
        "trigger_conditions": {},
        "actions": ["hold_payout", "notify_finance"],
        "is_active": True
    },
    {
        "rule_id": "auto_3",
        "name": "Insurance Expired → Hide Aircraft",
        "name_hi": "बीमा समाप्त → विमान छुपाएं",
        "trigger": "insurance_expired",
        "trigger_conditions": {},
        "actions": ["hide_aircraft", "notify_operator"],
        "is_active": True
    },
    {
        "rule_id": "auto_4",
        "name": "Pilot Medical Expired → Remove Availability",
        "name_hi": "पायलट मेडिकल समाप्त → उपलब्धता हटाएं",
        "trigger": "pilot_medical_expired",
        "trigger_conditions": {},
        "actions": ["remove_from_available", "notify_operator"],
        "is_active": True
    }
]

DEFAULT_ROLE_PERMISSIONS = {
    "super_admin": {
        "can_view_config": True, "can_edit_config": True, "can_enable_services": True,
        "can_disable_services": True, "can_change_rules": True, "can_override": True,
        "can_approve": True, "can_reject": True, "can_view_audit": True, "can_view_sensitive_data": True
    },
    "admin": {
        "can_view_config": True, "can_edit_config": True, "can_enable_services": True,
        "can_disable_services": True, "can_change_rules": True, "can_override": True,
        "can_approve": True, "can_reject": True, "can_view_audit": True, "can_view_sensitive_data": False
    },
    "cfo": {
        "can_view_config": True, "can_edit_config": True, "can_enable_services": True,
        "can_disable_services": True, "can_change_rules": True, "can_override": False,
        "can_approve": False, "can_reject": False, "can_view_audit": True, "can_view_sensitive_data": False
    },
    "finance_head": {
        "can_view_config": True, "can_edit_config": False, "can_enable_services": False,
        "can_disable_services": False, "can_change_rules": False, "can_override": False,
        "can_approve": True, "can_reject": True, "can_view_audit": True, "can_view_sensitive_data": False
    },
    "compliance": {
        "can_view_config": True, "can_edit_config": False, "can_enable_services": False,
        "can_disable_services": False, "can_change_rules": False, "can_override": False,
        "can_approve": True, "can_reject": True, "can_view_audit": True, "can_view_sensitive_data": False
    }
}


# ============ HELPER FUNCTIONS ============

def calculate_badge(score: int, thresholds: dict) -> str:
    """Calculate badge based on score"""
    if score >= thresholds.get("gold", 90):
        return "gold"
    elif score >= thresholds.get("silver", 80):
        return "silver"
    elif score >= thresholds.get("basic", 60):
        return "basic"
    return "pending"


def get_badge_display(badge: str) -> dict:
    """Get badge display info"""
    badges = {
        "gold": {"emoji": "🟢", "label": "Gold Verified", "label_hi": "गोल्ड वेरिफाइड", "color": "#FFD700"},
        "silver": {"emoji": "🔵", "label": "Silver Verified", "label_hi": "सिल्वर वेरिफाइड", "color": "#C0C0C0"},
        "basic": {"emoji": "🟡", "label": "Basic Verified", "label_hi": "बेसिक वेरिफाइड", "color": "#FFFF00"},
        "pending": {"emoji": "🔴", "label": "Pending", "label_hi": "पेंडिंग", "color": "#FF0000"}
    }
    return badges.get(badge, badges["pending"])


async def log_audit(db, user: dict, service_or_setting: str, old_value: Any, new_value: Any, 
                    reason: str, request: Request, otp_verified: bool = False):
    """Create immutable audit log entry"""
    log_entry = {
        "log_id": str(uuid.uuid4()),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "changed_by": user.get("id"),
        "changed_by_email": user.get("email"),
        "service_or_setting": service_or_setting,
        "old_value": old_value,
        "new_value": new_value,
        "ip_address": request.client.host if request.client else "unknown",
        "user_agent": request.headers.get("user-agent", "unknown"),
        "otp_verified": otp_verified,
        "reason": reason,
        "risk_level": "high" if "disable" in str(new_value).lower() else "medium"
    }
    await db.vre_audit_logs.insert_one(log_entry)
    return log_entry


# ============ INITIALIZATION ============

@router.post("/admin/initialize")
async def initialize_vre_config(
    current_user: dict = Depends(require_roles(["admin", "super_admin"]))
):
    """Initialize VRE with default configuration"""
    db = get_database()
    
    # Check if already initialized
    existing = await db.vre_global_config.find_one({"config_id": "vre_global_config"})
    if existing:
        return {"message": "VRE already initialized", "message_hi": "VRE पहले से इनिशियलाइज़ है"}
    
    # Create global config
    global_config = {
        "config_id": "vre_global_config",
        "sandbox_mode": True,
        "production_mode": False,
        "default_api_provider": "sandbox",
        "gold_threshold": 90,
        "silver_threshold": 80,
        "basic_threshold": 60,
        "default_scores": {"pan": 20, "gst": 20, "bank_account": 20, "aadhaar": 20, "face": 20},
        "require_otp_for_changes": True,
        "global_service_status": "normal",
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "updated_by": current_user["id"]
    }
    await db.vre_global_config.insert_one(global_config)
    
    # Create category configs
    await db.vre_category_configs.insert_one({
        "category": "customer",
        "services": DEFAULT_CUSTOMER_SERVICES,
        "minimum_score": 50,
        "required_for_registration": False,
        "required_for_booking": True
    })
    
    await db.vre_category_configs.insert_one({
        "category": "operator",
        "services": DEFAULT_OPERATOR_SERVICES,
        "minimum_score": 70,
        "required_for_registration": True,
        "required_for_booking": False
    })
    
    # Create booking rules
    for rule in DEFAULT_BOOKING_RULES:
        rule["is_active"] = True
        rule["created_at"] = datetime.now(timezone.utc).isoformat()
        await db.vre_booking_rules.insert_one(rule)
    
    # Create auto rules
    for rule in DEFAULT_AUTO_RULES:
        rule["created_at"] = datetime.now(timezone.utc).isoformat()
        rule["created_by"] = current_user["id"]
        await db.vre_auto_rules.insert_one(rule)
    
    # Create role permissions
    for role, perms in DEFAULT_ROLE_PERMISSIONS.items():
        await db.vre_role_permissions.insert_one({"role": role, **perms})
    
    return {
        "success": True,
        "message": "VRE initialized with default configuration",
        "message_hi": "VRE डिफॉल्ट कॉन्फ़िगरेशन के साथ इनिशियलाइज़ हो गया"
    }


# ============ GLOBAL CONFIG ============

@router.get("/admin/global-config")
async def get_global_config(
    current_user: dict = Depends(require_roles(["admin", "super_admin", "cfo", "finance_head", "compliance"]))
):
    """Get global VRE configuration"""
    db = get_database()
    
    config = await db.vre_global_config.find_one({"config_id": "vre_global_config"}, {"_id": 0})
    
    if not config:
        # Auto-initialize if not exists
        await initialize_vre_config.__wrapped__(current_user)
        config = await db.vre_global_config.find_one({"config_id": "vre_global_config"}, {"_id": 0})
    
    return config


@router.put("/admin/global-config")
async def update_global_config(
    updates: dict,
    request: Request,
    current_user: dict = Depends(require_roles(["admin", "super_admin"]))
):
    """Update global VRE configuration"""
    db = get_database()
    
    old_config = await db.vre_global_config.find_one({"config_id": "vre_global_config"}, {"_id": 0})
    
    allowed_fields = ["sandbox_mode", "production_mode", "gold_threshold", "silver_threshold", 
                      "basic_threshold", "require_otp_for_changes", "default_api_provider"]
    
    update_data = {k: v for k, v in updates.items() if k in allowed_fields}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    update_data["updated_by"] = current_user["id"]
    
    await db.vre_global_config.update_one(
        {"config_id": "vre_global_config"},
        {"$set": update_data}
    )
    
    # Audit log
    await log_audit(db, current_user, "global_config", old_config, update_data, 
                    updates.get("reason", "Config update"), request)
    
    return {"success": True, "message": "Configuration updated / कॉन्फ़िगरेशन अपडेट हो गया"}


# ============ SERVICE CONFIGURATION ============

@router.get("/admin/services/{category}")
async def get_category_services(
    category: str,
    current_user: dict = Depends(require_roles(["admin", "super_admin", "cfo", "compliance"]))
):
    """Get verification services for a category"""
    db = get_database()
    
    config = await db.vre_category_configs.find_one({"category": category}, {"_id": 0})
    
    if not config:
        raise HTTPException(status_code=404, detail=f"Category {category} not found")
    
    return config


@router.get("/admin/services")
async def get_all_services(
    current_user: dict = Depends(require_roles(["admin", "super_admin", "cfo", "compliance"]))
):
    """Get all verification services"""
    db = get_database()
    
    configs = await db.vre_category_configs.find({}, {"_id": 0}).to_list(length=20)
    
    return {"categories": configs}


@router.put("/admin/services/{category}/{service_type}")
async def update_service_config(
    category: str,
    service_type: str,
    updates: VREConfigUpdateRequest,
    request: Request,
    current_user: dict = Depends(require_roles(["admin", "super_admin"]))
):
    """Update a specific verification service configuration"""
    db = get_database()
    
    config = await db.vre_category_configs.find_one({"category": category})
    if not config:
        raise HTTPException(status_code=404, detail="Category not found")
    
    services = config.get("services", [])
    old_service = None
    
    for i, service in enumerate(services):
        if service.get("service_type") == service_type:
            old_service = service.copy()
            if updates.mode:
                services[i]["mode"] = updates.mode.value
            if updates.score_weight is not None:
                services[i]["score_weight"] = updates.score_weight
            break
    
    if not old_service:
        raise HTTPException(status_code=404, detail="Service not found")
    
    await db.vre_category_configs.update_one(
        {"category": category},
        {"$set": {"services": services}}
    )
    
    # Audit log
    await log_audit(db, current_user, f"{category}.{service_type}", old_service, 
                    {"mode": updates.mode.value if updates.mode else old_service.get("mode")},
                    updates.reason, request, otp_verified=bool(updates.otp))
    
    return {
        "success": True,
        "message": f"Service {service_type} updated",
        "message_hi": f"सेवा {service_type} अपडेट हो गई"
    }


# ============ BOOKING RULES ============

@router.get("/admin/booking-rules")
async def get_booking_rules(
    current_user: dict = Depends(require_roles(["admin", "super_admin", "cfo", "compliance"]))
):
    """Get all booking-based verification rules"""
    db = get_database()
    
    rules = await db.vre_booking_rules.find({}, {"_id": 0}).to_list(length=50)
    
    return {"rules": rules}


@router.post("/admin/booking-rules")
async def create_booking_rule(
    rule: dict,
    request: Request,
    current_user: dict = Depends(require_roles(["admin", "super_admin"]))
):
    """Create a new booking rule"""
    db = get_database()
    
    rule["rule_id"] = str(uuid.uuid4())
    rule["is_active"] = True
    rule["created_at"] = datetime.now(timezone.utc).isoformat()
    rule["created_by"] = current_user["id"]
    
    await db.vre_booking_rules.insert_one(rule)
    
    await log_audit(db, current_user, "booking_rule_create", None, rule, 
                    rule.get("reason", "New rule"), request)
    
    return {"success": True, "rule_id": rule["rule_id"]}


@router.put("/admin/booking-rules/{rule_id}")
async def update_booking_rule(
    rule_id: str,
    updates: BookingRuleUpdateRequest,
    request: Request,
    current_user: dict = Depends(require_roles(["admin", "super_admin"]))
):
    """Update a booking rule"""
    db = get_database()
    
    old_rule = await db.vre_booking_rules.find_one({"rule_id": rule_id}, {"_id": 0})
    if not old_rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    
    update_data = {}
    if updates.min_amount is not None:
        update_data["min_amount"] = updates.min_amount
    if updates.max_amount is not None:
        update_data["max_amount"] = updates.max_amount
    if updates.required_verifications:
        update_data["required_verifications"] = [v.value if hasattr(v, 'value') else v for v in updates.required_verifications]
    if updates.is_active is not None:
        update_data["is_active"] = updates.is_active
    
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.vre_booking_rules.update_one({"rule_id": rule_id}, {"$set": update_data})
    
    await log_audit(db, current_user, f"booking_rule.{rule_id}", old_rule, update_data, 
                    updates.reason, request)
    
    return {"success": True, "message": "Rule updated / नियम अपडेट"}


# ============ AUTO RULES ============

@router.get("/admin/auto-rules")
async def get_auto_rules(
    current_user: dict = Depends(require_roles(["admin", "super_admin", "compliance"]))
):
    """Get all auto-trigger rules"""
    db = get_database()
    
    rules = await db.vre_auto_rules.find({}, {"_id": 0}).to_list(length=50)
    
    return {"rules": rules}


@router.post("/admin/auto-rules")
async def create_auto_rule(
    rule: AutoRuleCreateRequest,
    request: Request,
    current_user: dict = Depends(require_roles(["admin", "super_admin"]))
):
    """Create a new auto rule"""
    db = get_database()
    
    rule_data = {
        "rule_id": str(uuid.uuid4()),
        "name": rule.name,
        "name_hi": rule.name_hi,
        "trigger": rule.trigger.value,
        "trigger_conditions": rule.trigger_conditions,
        "actions": [a.value for a in rule.actions],
        "notification_recipients": rule.notification_recipients,
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": current_user["id"]
    }
    
    await db.vre_auto_rules.insert_one(rule_data)
    
    await log_audit(db, current_user, "auto_rule_create", None, rule_data, "New auto rule", request)
    
    return {"success": True, "rule_id": rule_data["rule_id"]}


@router.put("/admin/auto-rules/{rule_id}/toggle")
async def toggle_auto_rule(
    rule_id: str,
    request: Request,
    current_user: dict = Depends(require_roles(["admin", "super_admin"]))
):
    """Enable/disable an auto rule"""
    db = get_database()
    
    rule = await db.vre_auto_rules.find_one({"rule_id": rule_id})
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    
    new_status = not rule.get("is_active", True)
    
    await db.vre_auto_rules.update_one(
        {"rule_id": rule_id},
        {"$set": {"is_active": new_status}}
    )
    
    await log_audit(db, current_user, f"auto_rule.{rule_id}", 
                    {"is_active": rule.get("is_active")}, {"is_active": new_status}, 
                    "Rule toggled", request)
    
    return {"success": True, "is_active": new_status}


# ============ EMERGENCY OVERRIDE ============

@router.get("/admin/emergency-status")
async def get_emergency_status(
    current_user: dict = Depends(require_roles(["admin", "super_admin", "compliance"]))
):
    """Get emergency override status for all services"""
    db = get_database()
    
    overrides = await db.vre_emergency_overrides.find({}, {"_id": 0}).to_list(length=50)
    global_config = await db.vre_global_config.find_one({"config_id": "vre_global_config"}, {"_id": 0})
    
    return {
        "global_status": global_config.get("global_service_status", "normal") if global_config else "normal",
        "service_overrides": overrides
    }


@router.post("/admin/emergency-override")
async def set_emergency_override(
    override: EmergencyOverrideRequest,
    request: Request,
    current_user: dict = Depends(require_roles(["admin", "super_admin"]))
):
    """Set emergency override for a service"""
    db = get_database()
    
    override_data = {
        "service_type": override.service_type.value,
        "current_status": override.new_status.value,
        "override_reason": override.reason,
        "override_by": current_user["id"],
        "override_at": datetime.now(timezone.utc).isoformat(),
        "auto_detected": False
    }
    
    await db.vre_emergency_overrides.update_one(
        {"service_type": override.service_type.value},
        {"$set": override_data},
        upsert=True
    )
    
    await log_audit(db, current_user, f"emergency_override.{override.service_type.value}",
                    None, override_data, override.reason, request, otp_verified=bool(override.otp))
    
    return {
        "success": True,
        "message": f"Emergency override set for {override.service_type.value}",
        "message_hi": f"{override.service_type.value} के लिए इमरजेंसी ओवरराइड सेट"
    }


# ============ ROLE PERMISSIONS ============

@router.get("/admin/permissions")
async def get_role_permissions(
    current_user: dict = Depends(require_roles(["admin", "super_admin"]))
):
    """Get role permissions for VRE"""
    db = get_database()
    
    permissions = await db.vre_role_permissions.find({}, {"_id": 0}).to_list(length=20)
    
    return {"permissions": permissions}


@router.put("/admin/permissions/{role}")
async def update_role_permissions(
    role: str,
    permissions: dict,
    request: Request,
    current_user: dict = Depends(require_roles(["super_admin"]))
):
    """Update role permissions (super_admin only)"""
    db = get_database()
    
    old_perms = await db.vre_role_permissions.find_one({"role": role}, {"_id": 0})
    
    await db.vre_role_permissions.update_one(
        {"role": role},
        {"$set": permissions},
        upsert=True
    )
    
    await log_audit(db, current_user, f"permissions.{role}", old_perms, permissions, 
                    "Permissions update", request)
    
    return {"success": True}


# ============ AUDIT LOGS ============

@router.get("/admin/audit-logs")
async def get_audit_logs(
    limit: int = Query(50, le=500),
    service: Optional[str] = None,
    user_id: Optional[str] = None,
    current_user: dict = Depends(require_roles(["admin", "super_admin"]))
):
    """Get immutable audit logs"""
    db = get_database()
    
    query = {}
    if service:
        query["service_or_setting"] = {"$regex": service, "$options": "i"}
    if user_id:
        query["changed_by"] = user_id
    
    logs = await db.vre_audit_logs.find(query, {"_id": 0}).sort("timestamp", -1).limit(limit).to_list(length=limit)
    
    return {"logs": logs, "total": len(logs)}


# ============ VERIFICATION ENDPOINTS ============

@router.post("/verify/pan")
async def verify_pan(
    pan_number: str,
    name: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Verify PAN card using sandbox.co.in"""
    db = get_database()
    
    # Validate PAN format
    pan_pattern = r'^[A-Z]{5}[0-9]{4}[A-Z]{1}$'
    if not re.match(pan_pattern, pan_number.upper()):
        raise HTTPException(status_code=400, detail="Invalid PAN format / अमान्य PAN प्रारूप")
    
    # Check if already verified
    existing = await db.user_verifications.find_one({
        "user_id": current_user["id"],
        "verification_type": "pan",
        "status": "verified"
    })
    
    if existing:
        return {
            "success": True,
            "already_verified": True,
            "verified_data": existing.get("verified_data", {}),
            "message": "PAN already verified",
            "message_hi": "PAN पहले से सत्यापित है"
        }
    
    # Call sandbox API
    sandbox = get_sandbox_service()
    result = await sandbox.verify_pan(pan_number, name)
    
    # Store verification result
    verification_record = {
        "verification_id": str(uuid.uuid4()),
        "user_id": current_user["id"],
        "verification_type": "pan",
        "document_number": pan_number[:4] + "****" + pan_number[-1],  # Masked
        "status": "verified" if result["success"] else "failed",
        "api_provider": "sandbox",
        "api_response": result.get("raw_response", {}),
        "verified_data": result.get("verified_data", {}),
        "score_earned": 20 if result["success"] else 0,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.user_verifications.insert_one(verification_record)
    
    # Update user verification score
    if result["success"]:
        await update_user_score(db, current_user["id"])
    
    return {
        "success": result["success"],
        "reference_id": result.get("reference_id"),
        "status": result.get("status"),
        "verified_data": result.get("verified_data", {}),
        "score_earned": 20 if result["success"] else 0,
        "message": "PAN verified successfully" if result["success"] else result.get("error"),
        "message_hi": "PAN सफलतापूर्वक सत्यापित" if result["success"] else "PAN सत्यापन विफल"
    }


@router.post("/verify/gst")
async def verify_gst(
    gstin: str,
    current_user: dict = Depends(get_current_user)
):
    """Verify GSTIN using sandbox.co.in"""
    db = get_database()
    
    # Validate GSTIN format (15 characters)
    if len(gstin) != 15:
        raise HTTPException(status_code=400, detail="Invalid GSTIN format / अमान्य GSTIN प्रारूप")
    
    sandbox = get_sandbox_service()
    result = await sandbox.verify_gst(gstin)
    
    verification_record = {
        "verification_id": str(uuid.uuid4()),
        "user_id": current_user["id"],
        "verification_type": "gst",
        "document_number": gstin,
        "status": "verified" if result["success"] else "failed",
        "api_provider": "sandbox",
        "verified_data": result.get("verified_data", {}),
        "score_earned": 20 if result["success"] else 0,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.user_verifications.insert_one(verification_record)
    
    if result["success"]:
        await update_user_score(db, current_user["id"])
    
    return {
        "success": result["success"],
        "reference_id": result.get("reference_id"),
        "verified_data": result.get("verified_data", {}),
        "score_earned": 20 if result["success"] else 0,
        "message": "GST verified" if result["success"] else result.get("error"),
        "message_hi": "GST सत्यापित" if result["success"] else "GST सत्यापन विफल"
    }


@router.post("/verify/bank")
async def verify_bank_account(
    account_number: str,
    ifsc: str,
    name: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Verify bank account using sandbox.co.in penny drop"""
    db = get_database()
    
    sandbox = get_sandbox_service()
    result = await sandbox.verify_bank_account(account_number, ifsc, name)
    
    verification_record = {
        "verification_id": str(uuid.uuid4()),
        "user_id": current_user["id"],
        "verification_type": "bank_account",
        "document_number": account_number[-4:].rjust(len(account_number), '*'),  # Masked
        "status": "verified" if result["success"] else "failed",
        "api_provider": "sandbox",
        "verified_data": result.get("verified_data", {}),
        "score_earned": 20 if result["success"] else 0,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.user_verifications.insert_one(verification_record)
    
    if result["success"]:
        await update_user_score(db, current_user["id"])
    
    return {
        "success": result["success"],
        "reference_id": result.get("reference_id"),
        "verified_data": result.get("verified_data", {}),
        "score_earned": 20 if result["success"] else 0,
        "message": "Bank account verified" if result["success"] else result.get("error"),
        "message_hi": "बैंक खाता सत्यापित" if result["success"] else "बैंक सत्यापन विफल"
    }


@router.post("/verify/aadhaar/send-otp")
async def send_aadhaar_otp(
    aadhaar_number: str,
    current_user: dict = Depends(get_current_user)
):
    """Step 1: Send OTP for Aadhaar verification"""
    db = get_database()
    
    # Validate Aadhaar format (12 digits)
    if not re.match(r'^\d{12}$', aadhaar_number):
        raise HTTPException(status_code=400, detail="Invalid Aadhaar format (12 digits required)")
    
    sandbox = get_sandbox_service()
    result = await sandbox.verify_aadhaar_generate_otp(aadhaar_number)
    
    if result["success"]:
        # Store pending verification
        await db.pending_aadhaar_verifications.update_one(
            {"user_id": current_user["id"]},
            {"$set": {
                "reference_id": result["reference_id"],
                "aadhaar_masked": aadhaar_number[:4] + "****" + aadhaar_number[-4:],
                "created_at": datetime.now(timezone.utc).isoformat()
            }},
            upsert=True
        )
    
    return result


@router.post("/verify/aadhaar/verify-otp")
async def verify_aadhaar_otp(
    otp: str,
    current_user: dict = Depends(get_current_user)
):
    """Step 2: Verify OTP for Aadhaar"""
    db = get_database()
    
    pending = await db.pending_aadhaar_verifications.find_one({"user_id": current_user["id"]})
    if not pending:
        raise HTTPException(status_code=400, detail="No pending Aadhaar verification. Send OTP first.")
    
    sandbox = get_sandbox_service()
    result = await sandbox.verify_aadhaar_submit_otp(pending["reference_id"], otp)
    
    if result["success"]:
        verification_record = {
            "verification_id": str(uuid.uuid4()),
            "user_id": current_user["id"],
            "verification_type": "aadhaar",
            "document_number": pending["aadhaar_masked"],
            "status": "verified",
            "api_provider": "sandbox",
            "verified_data": result.get("verified_data", {}),
            "score_earned": 20,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.user_verifications.insert_one(verification_record)
        await db.pending_aadhaar_verifications.delete_one({"user_id": current_user["id"]})
        await update_user_score(db, current_user["id"])
    
    return {
        "success": result["success"],
        "verified_data": result.get("verified_data", {}),
        "score_earned": 20 if result["success"] else 0,
        "message": "Aadhaar verified" if result["success"] else result.get("error"),
        "message_hi": "आधार सत्यापित" if result["success"] else "आधार सत्यापन विफल"
    }


@router.get("/verify/ifsc/{ifsc}")
async def verify_ifsc(ifsc: str):
    """Verify IFSC code (public endpoint)"""
    sandbox = get_sandbox_service()
    result = await sandbox.verify_ifsc(ifsc)
    return result


# ============ USER SCORE & BADGE ============

async def update_user_score(db, user_id: str):
    """Recalculate user verification score"""
    verifications = await db.user_verifications.find({
        "user_id": user_id,
        "status": "verified"
    }, {"_id": 0}).to_list(length=50)
    
    total_score = sum(v.get("score_earned", 0) for v in verifications)
    max_score = 100
    percentage = (total_score / max_score) * 100 if max_score > 0 else 0
    
    global_config = await db.vre_global_config.find_one({"config_id": "vre_global_config"})
    thresholds = {
        "gold": global_config.get("gold_threshold", 90) if global_config else 90,
        "silver": global_config.get("silver_threshold", 80) if global_config else 80,
        "basic": global_config.get("basic_threshold", 60) if global_config else 60
    }
    
    badge = calculate_badge(percentage, thresholds)
    
    score_record = {
        "user_id": user_id,
        "total_score": total_score,
        "max_possible_score": max_score,
        "percentage": percentage,
        "badge": badge,
        "verifications_completed": [v["verification_type"] for v in verifications],
        "last_updated": datetime.now(timezone.utc).isoformat()
    }
    
    await db.user_verification_scores.update_one(
        {"user_id": user_id},
        {"$set": score_record},
        upsert=True
    )
    
    # Update user document with badge
    await db.users.update_one(
        {"id": user_id},
        {"$set": {
            "verification_badge": badge,
            "verification_score": percentage
        }}
    )
    
    return score_record


@router.get("/user/verification-status")
async def get_user_verification_status(
    current_user: dict = Depends(get_current_user)
):
    """Get current user's verification status and badge"""
    db = get_database()
    
    score = await db.user_verification_scores.find_one(
        {"user_id": current_user["id"]},
        {"_id": 0}
    )
    
    verifications = await db.user_verifications.find(
        {"user_id": current_user["id"]},
        {"_id": 0, "api_response": 0}
    ).to_list(length=50)
    
    if not score:
        score = {
            "total_score": 0,
            "percentage": 0,
            "badge": "pending",
            "verifications_completed": []
        }
    
    badge_info = get_badge_display(score.get("badge", "pending"))
    
    return {
        "score": score,
        "badge": badge_info,
        "verifications": verifications,
        "requirements": {
            "booking_50k": ["mobile_otp"],
            "booking_2l": ["mobile_otp", "pan"],
            "booking_above_2l": ["mobile_otp", "pan", "aadhaar"]
        }
    }


@router.get("/booking/required-verifications")
async def get_required_verifications_for_booking(
    booking_amount: float,
    is_corporate: bool = False,
    current_user: dict = Depends(get_current_user)
):
    """Get required verifications for a booking amount"""
    db = get_database()
    
    # Get applicable rules
    query = {"is_active": True}
    rules = await db.vre_booking_rules.find(query, {"_id": 0}).to_list(length=20)
    
    applicable_rule = None
    
    # Check corporate rule first
    if is_corporate:
        for rule in rules:
            if rule.get("rule_id") == "rule_corporate":
                applicable_rule = rule
                break
    
    # Find amount-based rule
    if not applicable_rule:
        for rule in rules:
            if rule.get("rule_id", "").startswith("rule_corporate"):
                continue
            min_amt = rule.get("min_amount", 0)
            max_amt = rule.get("max_amount")
            if booking_amount >= min_amt and (max_amt is None or booking_amount < max_amt):
                applicable_rule = rule
                break
    
    if not applicable_rule:
        applicable_rule = {"required_verifications": ["mobile_otp"]}
    
    # Get user's completed verifications
    user_verifications = await db.user_verifications.find({
        "user_id": current_user["id"],
        "status": "verified"
    }, {"_id": 0, "verification_type": 1}).to_list(length=50)
    
    completed = [v["verification_type"] for v in user_verifications]
    required = applicable_rule.get("required_verifications", [])
    pending = [v for v in required if v not in completed]
    
    return {
        "booking_amount": booking_amount,
        "is_corporate": is_corporate,
        "rule_applied": applicable_rule,
        "required_verifications": required,
        "completed_verifications": completed,
        "pending_verifications": pending,
        "can_proceed": len(pending) == 0,
        "message": "All verifications complete" if len(pending) == 0 else f"{len(pending)} verification(s) pending",
        "message_hi": "सभी सत्यापन पूर्ण" if len(pending) == 0 else f"{len(pending)} सत्यापन बाकी"
    }


# ============ ADMIN DASHBOARD STATS ============

@router.get("/admin/dashboard")
async def get_vre_dashboard(
    current_user: dict = Depends(require_roles(["admin", "super_admin", "compliance"]))
):
    """Get VRE dashboard statistics"""
    db = get_database()
    
    # Verification stats
    total_verifications = await db.user_verifications.count_documents({})
    verified_count = await db.user_verifications.count_documents({"status": "verified"})
    failed_count = await db.user_verifications.count_documents({"status": "failed"})
    
    # Badge distribution
    gold_users = await db.user_verification_scores.count_documents({"badge": "gold"})
    silver_users = await db.user_verification_scores.count_documents({"badge": "silver"})
    basic_users = await db.user_verification_scores.count_documents({"badge": "basic"})
    pending_users = await db.user_verification_scores.count_documents({"badge": "pending"})
    
    # Service usage
    service_stats = await db.user_verifications.aggregate([
        {"$group": {"_id": "$verification_type", "count": {"$sum": 1}, "verified": {"$sum": {"$cond": [{"$eq": ["$status", "verified"]}, 1, 0]}}}}
    ]).to_list(length=20)
    
    # Global config
    global_config = await db.vre_global_config.find_one({"config_id": "vre_global_config"}, {"_id": 0})
    
    # Recent audit logs
    recent_logs = await db.vre_audit_logs.find({}, {"_id": 0}).sort("timestamp", -1).limit(10).to_list(length=10)
    
    return {
        "stats": {
            "total_verifications": total_verifications,
            "verified": verified_count,
            "failed": failed_count,
            "success_rate": round((verified_count / total_verifications * 100), 1) if total_verifications > 0 else 0
        },
        "badge_distribution": {
            "gold": gold_users,
            "silver": silver_users,
            "basic": basic_users,
            "pending": pending_users
        },
        "service_usage": service_stats,
        "global_config": global_config,
        "recent_audit_logs": recent_logs
    }
