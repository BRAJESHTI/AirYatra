"""
Verification Rule Engine Routes
Admin-configurable verification system
From Document [2] & [5]
"""

from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks, Query, Request
from typing import Optional, List
from datetime import datetime, timezone, timedelta
from database import get_database
from middleware import get_current_user, require_roles
from models import (
    VerificationRuleEngine, VerificationRuleUpdate, EmergencyOverrideRequest,
    VerificationAuditLog, VerificationResult, EntityVerificationStatus,
    VerificationMode, VerificationProvider, VerificationBadge, VerificationType,
    ServiceStatus, AutoRuleAction, VerificationScoreConfig, BookingVerificationRule,
    AutoVerificationRule, ProviderConfig
)
import uuid
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/verification-engine", tags=["Verification Rule Engine"])


# ============ DEFAULT CONFIG ============

DEFAULT_ENGINE_CONFIG = {
    "id": "default_verification_engine",
    "verification_mode": "optional",
    "service_status": "normal",
    "production_mode": False,
    "sandbox_mode": True,
    "primary_provider": "sandbox",
    "fallback_provider": None,
    "scoring_config": {
        "pan_score": 20,
        "gst_score": 20,
        "bank_score": 20,
        "aadhaar_score": 20,
        "face_score": 20,
        "company_reg_score": 15,
        "aoc_score": 25,
        "insurance_score": 20,
        "pilot_license_score": 15,
        "gold_threshold": 90,
        "silver_threshold": 70,
        "basic_threshold": 50
    },
    "booking_rules": [
        {"min_amount": 0, "max_amount": 50000, "required_verifications": ["email"], "description": "Basic"},
        {"min_amount": 50000, "max_amount": 200000, "required_verifications": ["email", "otp"], "description": "OTP required"},
        {"min_amount": 200000, "max_amount": 500000, "required_verifications": ["email", "otp", "pan"], "description": "PAN required"},
        {"min_amount": 500000, "max_amount": None, "required_verifications": ["email", "otp", "pan", "aadhaar"], "description": "Full KYC"}
    ],
    "auto_rules": [
        {
            "rule_id": "gst_cancelled",
            "rule_name": "GST Cancellation Check",
            "condition_type": "gst_status",
            "condition_value": "cancelled",
            "action": "suspend_operator",
            "notify_roles": ["admin", "compliance"],
            "grace_period_days": 0,
            "is_active": True
        },
        {
            "rule_id": "insurance_expired",
            "rule_name": "Insurance Expiry Check",
            "condition_type": "insurance_expiry",
            "condition_value": "expired",
            "action": "block_bookings",
            "notify_roles": ["admin", "operator"],
            "grace_period_days": 7,
            "is_active": True
        }
    ],
    "daily_gst_check": True,
    "daily_insurance_check": True,
    "expiry_alert_days": [30, 15, 7, 3, 1],
    "role_permissions": {
        "super_admin": ["view", "edit", "override", "audit"],
        "admin": ["view", "edit", "override"],
        "compliance": ["view", "edit", "verify"],
        "finance": ["view", "verify"],
        "cfo": ["view", "override"],
        "operator": ["view"]
    },
    "override_enabled": False,
    "audit_all_changes": True,
    "require_otp_for_changes": True,
    "created_at": datetime.now(timezone.utc).isoformat(),
    "updated_at": datetime.now(timezone.utc).isoformat()
}


# ============ HELPER FUNCTIONS ============

async def get_verification_engine():
    """Get current verification engine config"""
    db = get_database()
    engine = await db.verification_engine.find_one(
        {"id": "default_verification_engine"},
        {"_id": 0}
    )
    if not engine:
        # Initialize with defaults
        engine = DEFAULT_ENGINE_CONFIG.copy()
        await db.verification_engine.insert_one(engine)
    return engine


async def log_audit(
    action: str,
    changed_by: str,
    old_value: dict = None,
    new_value: dict = None,
    ip_address: str = None,
    otp_verified: bool = False,
    reason: str = None
):
    """Log verification engine changes"""
    db = get_database()
    audit_log = {
        "id": str(uuid.uuid4()),
        "action": action,
        "changed_by": changed_by,
        "changed_at": datetime.now(timezone.utc).isoformat(),
        "old_value": old_value,
        "new_value": new_value,
        "ip_address": ip_address,
        "otp_verified": otp_verified,
        "reason": reason
    }
    await db.verification_audit_logs.insert_one(audit_log)
    return audit_log


def calculate_verification_badge(score: int, config: dict) -> str:
    """Calculate badge based on score"""
    if score >= config.get("gold_threshold", 90):
        return "gold"
    elif score >= config.get("silver_threshold", 70):
        return "silver"
    elif score >= config.get("basic_threshold", 50):
        return "basic"
    else:
        return "pending"


def get_required_verifications_for_amount(amount: float, booking_rules: list) -> list:
    """Get required verifications based on booking amount"""
    for rule in sorted(booking_rules, key=lambda x: x.get("min_amount", 0), reverse=True):
        min_amt = rule.get("min_amount", 0)
        max_amt = rule.get("max_amount")
        if amount >= min_amt and (max_amt is None or amount < max_amt):
            return rule.get("required_verifications", [])
    return ["email"]  # Default


# ============ PUBLIC ENDPOINTS ============

@router.get("/config")
async def get_engine_config():
    """
    Get current verification engine configuration (public view)
    """
    engine = await get_verification_engine()
    
    # Return safe public config (no API keys)
    return {
        "verification_mode": engine.get("verification_mode", "optional"),
        "service_status": engine.get("service_status", "normal"),
        "sandbox_mode": engine.get("sandbox_mode", True),
        "primary_provider": engine.get("primary_provider", "sandbox"),
        "scoring_config": engine.get("scoring_config", {}),
        "booking_rules": engine.get("booking_rules", []),
        "badge_thresholds": {
            "gold": engine.get("scoring_config", {}).get("gold_threshold", 90),
            "silver": engine.get("scoring_config", {}).get("silver_threshold", 70),
            "basic": engine.get("scoring_config", {}).get("basic_threshold", 50)
        },
        "override_enabled": engine.get("override_enabled", False)
    }


@router.get("/required-for-booking")
async def get_required_verifications(
    amount: float = Query(..., description="Booking amount in INR")
):
    """
    Get required verifications for a booking amount
    From Document [5]: ₹50k→OTP, ₹2L→PAN+Aadhaar
    """
    engine = await get_verification_engine()
    booking_rules = engine.get("booking_rules", DEFAULT_ENGINE_CONFIG["booking_rules"])
    
    required = get_required_verifications_for_amount(amount, booking_rules)
    
    # Find matching rule for description
    description = "Basic verification"
    for rule in booking_rules:
        min_amt = rule.get("min_amount", 0)
        max_amt = rule.get("max_amount")
        if amount >= min_amt and (max_amt is None or amount < max_amt):
            description = rule.get("description", "")
            break
    
    return {
        "booking_amount": amount,
        "required_verifications": required,
        "description": description,
        "description_hi": get_hindi_description(required)
    }


def get_hindi_description(verifications: list) -> str:
    """Get Hindi description for required verifications"""
    hindi_map = {
        "email": "Email",
        "otp": "OTP Verification",
        "phone": "Phone Number",
        "pan": "PAN Card",
        "aadhaar": "Aadhaar Card",
        "gst": "GST Certificate",
        "bank": "Bank Account"
    }
    items = [hindi_map.get(v, v) for v in verifications]
    return " + ".join(items) + " required"


# ============ ADMIN ENDPOINTS ============

@router.get("/admin/full-config")
async def get_full_config(
    current_user: dict = Depends(require_roles(["admin", "super_admin", "compliance"]))
):
    """
    Get full verification engine configuration (admin only)
    """
    engine = await get_verification_engine()
    return engine


@router.put("/admin/update")
async def update_engine_config(
    update: VerificationRuleUpdate,
    request: Request,
    current_user: dict = Depends(require_roles(["admin", "super_admin"]))
):
    """
    Update verification engine configuration
    Requires admin role
    """
    db = get_database()
    engine = await get_verification_engine()
    
    # Build update dict
    update_data = {}
    old_values = {}
    
    if update.verification_mode is not None:
        old_values["verification_mode"] = engine.get("verification_mode")
        update_data["verification_mode"] = update.verification_mode.value
        
    if update.service_status is not None:
        old_values["service_status"] = engine.get("service_status")
        update_data["service_status"] = update.service_status.value
        
    if update.production_mode is not None:
        old_values["production_mode"] = engine.get("production_mode")
        update_data["production_mode"] = update.production_mode
        
    if update.sandbox_mode is not None:
        old_values["sandbox_mode"] = engine.get("sandbox_mode")
        update_data["sandbox_mode"] = update.sandbox_mode
        
    if update.primary_provider is not None:
        old_values["primary_provider"] = engine.get("primary_provider")
        update_data["primary_provider"] = update.primary_provider.value
        
    if update.fallback_provider is not None:
        old_values["fallback_provider"] = engine.get("fallback_provider")
        update_data["fallback_provider"] = update.fallback_provider.value
        
    if update.scoring_config is not None:
        old_values["scoring_config"] = engine.get("scoring_config")
        update_data["scoring_config"] = update.scoring_config.dict()
        
    if update.daily_gst_check is not None:
        old_values["daily_gst_check"] = engine.get("daily_gst_check")
        update_data["daily_gst_check"] = update.daily_gst_check
        
    if update.daily_insurance_check is not None:
        old_values["daily_insurance_check"] = engine.get("daily_insurance_check")
        update_data["daily_insurance_check"] = update.daily_insurance_check
        
    if update.expiry_alert_days is not None:
        old_values["expiry_alert_days"] = engine.get("expiry_alert_days")
        update_data["expiry_alert_days"] = update.expiry_alert_days
    
    if not update_data:
        return {"message": "No changes provided"}
    
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    update_data["updated_by"] = current_user["id"]
    
    # Update in DB
    await db.verification_engine.update_one(
        {"id": "default_verification_engine"},
        {"$set": update_data}
    )
    
    # Log audit
    await log_audit(
        action="config_updated",
        changed_by=current_user["id"],
        old_value=old_values,
        new_value=update_data,
        ip_address=request.client.host if request.client else None
    )
    
    return {
        "success": True,
        "message": "Verification engine configuration updated",
        "changes": list(update_data.keys())
    }


@router.post("/admin/set-mode/{mode}")
async def set_verification_mode(
    mode: str,
    request: Request,
    current_user: dict = Depends(require_roles(["admin", "super_admin"]))
):
    """
    Quick set verification mode: disabled/optional/mandatory
    """
    if mode not in ["disabled", "optional", "mandatory"]:
        raise HTTPException(status_code=400, detail="Invalid mode. Use: disabled, optional, mandatory")
    
    db = get_database()
    engine = await get_verification_engine()
    old_mode = engine.get("verification_mode")
    
    await db.verification_engine.update_one(
        {"id": "default_verification_engine"},
        {
            "$set": {
                "verification_mode": mode,
                "updated_at": datetime.now(timezone.utc).isoformat(),
                "updated_by": current_user["id"]
            }
        }
    )
    
    await log_audit(
        action="mode_changed",
        changed_by=current_user["id"],
        old_value={"verification_mode": old_mode},
        new_value={"verification_mode": mode},
        ip_address=request.client.host if request.client else None
    )
    
    return {
        "success": True,
        "message": f"Verification mode changed to: {mode}",
        "old_mode": old_mode,
        "new_mode": mode,
        "message_hi": f"सत्यापन मोड बदलकर {mode} किया गया"
    }


@router.post("/admin/set-provider/{provider}")
async def set_provider(
    provider: str,
    request: Request,
    current_user: dict = Depends(require_roles(["admin", "super_admin"]))
):
    """
    Set verification API provider: sandbox/surepass/signzy/idfy/hyperverge/custom
    """
    valid_providers = ["sandbox", "surepass", "signzy", "idfy", "hyperverge", "digilocker", "custom"]
    if provider not in valid_providers:
        raise HTTPException(
            status_code=400, 
            detail=f"Invalid provider. Use: {', '.join(valid_providers)}"
        )
    
    db = get_database()
    engine = await get_verification_engine()
    old_provider = engine.get("primary_provider")
    
    await db.verification_engine.update_one(
        {"id": "default_verification_engine"},
        {
            "$set": {
                "primary_provider": provider,
                "updated_at": datetime.now(timezone.utc).isoformat(),
                "updated_by": current_user["id"]
            }
        }
    )
    
    await log_audit(
        action="provider_changed",
        changed_by=current_user["id"],
        old_value={"primary_provider": old_provider},
        new_value={"primary_provider": provider},
        ip_address=request.client.host if request.client else None
    )
    
    return {
        "success": True,
        "message": f"Verification provider changed to: {provider}",
        "old_provider": old_provider,
        "new_provider": provider
    }


# ============ SCORING ENDPOINTS ============

@router.put("/admin/scoring")
async def update_scoring_config(
    config: VerificationScoreConfig,
    request: Request,
    current_user: dict = Depends(require_roles(["admin", "super_admin"]))
):
    """
    Update verification scoring weights
    From Document [2]: PAN 20, GST 20, Bank 20, Aadhaar 20, Face 20
    """
    db = get_database()
    engine = await get_verification_engine()
    old_config = engine.get("scoring_config", {})
    
    await db.verification_engine.update_one(
        {"id": "default_verification_engine"},
        {
            "$set": {
                "scoring_config": config.dict(),
                "updated_at": datetime.now(timezone.utc).isoformat(),
                "updated_by": current_user["id"]
            }
        }
    )
    
    await log_audit(
        action="scoring_updated",
        changed_by=current_user["id"],
        old_value={"scoring_config": old_config},
        new_value={"scoring_config": config.dict()},
        ip_address=request.client.host if request.client else None
    )
    
    return {
        "success": True,
        "message": "Scoring configuration updated",
        "new_config": config.dict()
    }


# ============ BOOKING RULES ENDPOINTS ============

@router.get("/admin/booking-rules")
async def get_booking_rules(
    current_user: dict = Depends(require_roles(["admin", "super_admin", "compliance"]))
):
    """
    Get all booking-based verification rules
    """
    engine = await get_verification_engine()
    return {
        "rules": engine.get("booking_rules", []),
        "description": "Verification requirements based on booking amount"
    }


@router.post("/admin/booking-rules")
async def add_booking_rule(
    rule: BookingVerificationRule,
    request: Request,
    current_user: dict = Depends(require_roles(["admin", "super_admin"]))
):
    """
    Add new booking verification rule
    """
    db = get_database()
    engine = await get_verification_engine()
    rules = engine.get("booking_rules", [])
    
    # Add new rule
    rules.append(rule.dict())
    rules = sorted(rules, key=lambda x: x.get("min_amount", 0))
    
    await db.verification_engine.update_one(
        {"id": "default_verification_engine"},
        {
            "$set": {
                "booking_rules": rules,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    await log_audit(
        action="booking_rule_added",
        changed_by=current_user["id"],
        new_value=rule.dict(),
        ip_address=request.client.host if request.client else None
    )
    
    return {
        "success": True,
        "message": "Booking rule added",
        "total_rules": len(rules)
    }


# ============ AUTO RULES ENDPOINTS ============

@router.get("/admin/auto-rules")
async def get_auto_rules(
    current_user: dict = Depends(require_roles(["admin", "super_admin", "compliance"]))
):
    """
    Get all auto verification rules
    From Document [2]: If GST cancelled → Suspend Operator
    """
    engine = await get_verification_engine()
    return {
        "rules": engine.get("auto_rules", []),
        "description": "Automatic actions based on verification status changes"
    }


@router.post("/admin/auto-rules")
async def add_auto_rule(
    rule: AutoVerificationRule,
    request: Request,
    current_user: dict = Depends(require_roles(["admin", "super_admin"]))
):
    """
    Add new auto verification rule
    """
    db = get_database()
    engine = await get_verification_engine()
    rules = engine.get("auto_rules", [])
    
    # Check for duplicate rule_id
    if any(r.get("rule_id") == rule.rule_id for r in rules):
        raise HTTPException(status_code=400, detail="Rule ID already exists")
    
    rules.append(rule.dict())
    
    await db.verification_engine.update_one(
        {"id": "default_verification_engine"},
        {
            "$set": {
                "auto_rules": rules,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    await log_audit(
        action="auto_rule_added",
        changed_by=current_user["id"],
        new_value=rule.dict(),
        ip_address=request.client.host if request.client else None
    )
    
    return {
        "success": True,
        "message": f"Auto rule '{rule.rule_name}' added",
        "rule_id": rule.rule_id
    }


@router.put("/admin/auto-rules/{rule_id}/toggle")
async def toggle_auto_rule(
    rule_id: str,
    request: Request,
    current_user: dict = Depends(require_roles(["admin", "super_admin"]))
):
    """
    Enable/disable an auto rule
    """
    db = get_database()
    engine = await get_verification_engine()
    rules = engine.get("auto_rules", [])
    
    rule_found = False
    for rule in rules:
        if rule.get("rule_id") == rule_id:
            rule["is_active"] = not rule.get("is_active", True)
            rule_found = True
            break
    
    if not rule_found:
        raise HTTPException(status_code=404, detail="Rule not found")
    
    await db.verification_engine.update_one(
        {"id": "default_verification_engine"},
        {"$set": {"auto_rules": rules, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {
        "success": True,
        "message": f"Rule {rule_id} toggled",
        "is_active": rule.get("is_active")
    }


# ============ EMERGENCY OVERRIDE ============

@router.post("/admin/emergency-override")
async def enable_emergency_override(
    override_request: EmergencyOverrideRequest,
    request: Request,
    current_user: dict = Depends(require_roles(["admin", "super_admin", "cfo"]))
):
    """
    Enable emergency override mode (manual verification)
    From Document [2]: When APIs fail, allow manual verification
    """
    db = get_database()
    
    # TODO: Verify OTP in production
    # For now, accept any OTP in sandbox mode
    engine = await get_verification_engine()
    if not engine.get("sandbox_mode", True):
        # Verify OTP here
        pass
    
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(hours=override_request.duration_hours)
    
    await db.verification_engine.update_one(
        {"id": "default_verification_engine"},
        {
            "$set": {
                "override_enabled": True,
                "override_reason": override_request.reason,
                "override_by": current_user["id"],
                "override_at": now.isoformat(),
                "override_expires_at": expires_at.isoformat(),
                "service_status": "manual",
                "updated_at": now.isoformat()
            }
        }
    )
    
    await log_audit(
        action="emergency_override_enabled",
        changed_by=current_user["id"],
        new_value={
            "reason": override_request.reason,
            "duration_hours": override_request.duration_hours,
            "expires_at": expires_at.isoformat()
        },
        ip_address=request.client.host if request.client else None,
        otp_verified=True,
        reason=override_request.reason
    )
    
    return {
        "success": True,
        "message": "Emergency override enabled",
        "message_hi": "आपातकालीन ओवरराइड सक्षम",
        "expires_at": expires_at.isoformat(),
        "duration_hours": override_request.duration_hours,
        "service_status": "manual"
    }


@router.post("/admin/disable-override")
async def disable_emergency_override(
    request: Request,
    current_user: dict = Depends(require_roles(["admin", "super_admin"]))
):
    """
    Disable emergency override and return to normal mode
    """
    db = get_database()
    
    await db.verification_engine.update_one(
        {"id": "default_verification_engine"},
        {
            "$set": {
                "override_enabled": False,
                "override_reason": None,
                "service_status": "normal",
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    await log_audit(
        action="emergency_override_disabled",
        changed_by=current_user["id"],
        ip_address=request.client.host if request.client else None
    )
    
    return {
        "success": True,
        "message": "Emergency override disabled, service status: normal"
    }


# ============ AUDIT LOGS ============

@router.get("/admin/audit-logs")
async def get_audit_logs(
    limit: int = Query(50, le=200),
    offset: int = 0,
    action: Optional[str] = None,
    current_user: dict = Depends(require_roles(["admin", "super_admin", "compliance"]))
):
    """
    Get verification engine audit logs
    """
    db = get_database()
    
    query = {}
    if action:
        query["action"] = action
    
    logs = await db.verification_audit_logs.find(
        query,
        {"_id": 0}
    ).sort("changed_at", -1).skip(offset).limit(limit).to_list(length=limit)
    
    total = await db.verification_audit_logs.count_documents(query)
    
    return {
        "logs": logs,
        "total": total,
        "limit": limit,
        "offset": offset
    }


# ============ ENTITY VERIFICATION STATUS ============

@router.get("/entity/{entity_type}/{entity_id}")
async def get_entity_verification_status(
    entity_type: str,
    entity_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Get verification status for an entity (user/operator)
    """
    if entity_type not in ["user", "operator"]:
        raise HTTPException(status_code=400, detail="Invalid entity type")
    
    db = get_database()
    engine = await get_verification_engine()
    scoring_config = engine.get("scoring_config", {})
    
    # Get entity verifications
    collection = "users" if entity_type == "user" else "operators"
    entity = await db[collection].find_one({"id": entity_id}, {"_id": 0})
    
    if not entity:
        raise HTTPException(status_code=404, detail=f"{entity_type.title()} not found")
    
    # Calculate score
    verifications = entity.get("verifications", {})
    total_score = 0
    verification_results = []
    
    score_map = {
        "pan": scoring_config.get("pan_score", 20),
        "gst": scoring_config.get("gst_score", 20),
        "bank": scoring_config.get("bank_score", 20),
        "aadhaar": scoring_config.get("aadhaar_score", 20),
        "face": scoring_config.get("face_score", 20),
        "company_reg": scoring_config.get("company_reg_score", 15),
        "aoc": scoring_config.get("aoc_score", 25),
        "insurance": scoring_config.get("insurance_score", 20)
    }
    
    for v_type, score in score_map.items():
        v_data = verifications.get(v_type, {})
        if v_data.get("verified", False):
            total_score += score
            verification_results.append({
                "type": v_type,
                "status": "verified",
                "score": score,
                "verified_at": v_data.get("verified_at")
            })
        else:
            verification_results.append({
                "type": v_type,
                "status": "pending",
                "score": 0
            })
    
    badge = calculate_verification_badge(total_score, scoring_config)
    
    return {
        "entity_id": entity_id,
        "entity_type": entity_type,
        "total_score": total_score,
        "max_score": sum(score_map.values()),
        "badge": badge,
        "verifications": verification_results,
        "is_compliant": total_score >= scoring_config.get("basic_threshold", 50)
    }


# ============ SANDBOX VERIFICATION (TEST MODE) ============

@router.post("/sandbox/verify/{verification_type}")
async def sandbox_verify(
    verification_type: str,
    data: dict,
    current_user: dict = Depends(get_current_user)
):
    """
    Sandbox verification - always succeeds for testing
    Only works when sandbox_mode is enabled
    """
    engine = await get_verification_engine()
    
    if not engine.get("sandbox_mode", True):
        raise HTTPException(
            status_code=400, 
            detail="Sandbox mode is disabled. Use production verification."
        )
    
    valid_types = ["pan", "gst", "bank", "aadhaar", "face", "company_reg"]
    if verification_type not in valid_types:
        raise HTTPException(status_code=400, detail=f"Invalid type. Use: {', '.join(valid_types)}")
    
    # Simulate verification
    return {
        "success": True,
        "verification_type": verification_type,
        "status": "verified",
        "provider": "sandbox",
        "message": "Sandbox verification successful (test mode)",
        "message_hi": "सैंडबॉक्स सत्यापन सफल (परीक्षण मोड)",
        "data": {
            "verified": True,
            "verified_at": datetime.now(timezone.utc).isoformat(),
            "reference_id": f"SBX-{str(uuid.uuid4())[:8].upper()}"
        }
    }
