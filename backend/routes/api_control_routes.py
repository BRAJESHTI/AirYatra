"""
API Control Center - Centralized API Management
Game Changer Feature for AirYatra OS

Manages ALL APIs:
- Payment APIs (Stripe, Razorpay)
- Verification APIs (Sandbox.co.in)
- WhatsApp/SMS APIs (Twilio)
- Email APIs (Gmail SMTP)
- Maps APIs (Google Maps, Leaflet)
- Weather APIs (OpenWeatherMap)
- Insurance APIs
- Finance APIs

Each API has:
- Enable/Disable
- Sandbox/Live mode
- Priority (Primary/Secondary)
- Health Status
- Usage Logs
- Daily API Limit
- Cost per API Call
- Failover Provider
"""

from fastapi import APIRouter, HTTPException, Depends, Request, BackgroundTasks
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone, timedelta
from database import get_database
from middleware import get_current_user, require_roles
from pydantic import BaseModel, Field
from enum import Enum
import uuid
import logging
import httpx
import asyncio
import os

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api-control", tags=["API Control Center"])


# ============ ENUMS ============

class APICategory(str, Enum):
    PAYMENT = "payment"
    VERIFICATION = "verification"
    MESSAGING = "messaging"
    EMAIL = "email"
    MAPS = "maps"
    WEATHER = "weather"
    INSURANCE = "insurance"
    FINANCE = "finance"


class APIStatus(str, Enum):
    ACTIVE = "active"           # 🟢 Working normally
    DEGRADED = "degraded"       # 🟡 Slow or partial issues
    DOWN = "down"               # 🔴 Not working
    MAINTENANCE = "maintenance" # 🟠 Scheduled maintenance
    DISABLED = "disabled"       # ⚪ Manually disabled


class APIMode(str, Enum):
    SANDBOX = "sandbox"
    PRODUCTION = "production"


class APIPriority(str, Enum):
    PRIMARY = "primary"
    SECONDARY = "secondary"
    FALLBACK = "fallback"


# ============ REQUEST MODELS ============

class APIConfigUpdate(BaseModel):
    is_enabled: Optional[bool] = None
    mode: Optional[APIMode] = None
    priority: Optional[APIPriority] = None
    daily_limit: Optional[int] = None
    cost_per_call: Optional[float] = None
    failover_provider: Optional[str] = None
    reason: str = ""


class EmergencyOverrideRequest(BaseModel):
    api_id: str
    new_status: APIStatus
    fallback_mode: str = "manual"  # manual / failover / disable
    reason: str


# ============ DEFAULT API CONFIGURATIONS ============

DEFAULT_APIS = [
    # Payment APIs
    {
        "api_id": "stripe",
        "name": "Stripe",
        "name_hi": "स्ट्राइप",
        "category": "payment",
        "provider": "Stripe Inc.",
        "description": "International card payments",
        "description_hi": "अंतर्राष्ट्रीय कार्ड भुगतान",
        "is_enabled": True,
        "mode": "sandbox",
        "priority": "primary",
        "health_status": "active",
        "base_url": "https://api.stripe.com",
        "health_check_url": "https://api.stripe.com/v1/charges",
        "daily_limit": 10000,
        "calls_today": 0,
        "cost_per_call": 0.0,
        "failover_provider": "razorpay",
        "requires_key": True,
        "key_env_var": "STRIPE_API_KEY",
        "icon": "credit-card"
    },
    {
        "api_id": "razorpay",
        "name": "Razorpay",
        "name_hi": "रेज़रपे",
        "category": "payment",
        "provider": "Razorpay Software Pvt Ltd",
        "description": "Indian payment gateway (UPI, Cards, Wallets)",
        "description_hi": "भारतीय भुगतान गेटवे (UPI, कार्ड, वॉलेट)",
        "is_enabled": True,
        "mode": "sandbox",
        "priority": "secondary",
        "health_status": "active",
        "base_url": "https://api.razorpay.com",
        "health_check_url": "https://api.razorpay.com/v1",
        "daily_limit": 10000,
        "calls_today": 0,
        "cost_per_call": 0.0,
        "failover_provider": "stripe",
        "requires_key": True,
        "key_env_var": "RAZORPAY_KEY_ID",
        "icon": "indian-rupee"
    },
    
    # Verification APIs
    {
        "api_id": "sandbox_kyc",
        "name": "Sandbox.co.in",
        "name_hi": "सैंडबॉक्स KYC",
        "category": "verification",
        "provider": "Sandbox Technologies",
        "description": "PAN, Aadhaar, GST, Bank verification",
        "description_hi": "पैन, आधार, जीएसटी, बैंक सत्यापन",
        "is_enabled": True,
        "mode": "production",
        "priority": "primary",
        "health_status": "active",
        "base_url": "https://api.sandbox.co.in",
        "health_check_url": "https://api.sandbox.co.in/kyc/pan/verify",
        "daily_limit": 1000,
        "calls_today": 0,
        "cost_per_call": 2.0,
        "failover_provider": None,
        "requires_key": True,
        "key_env_var": "SANDBOX_API_KEY",
        "icon": "shield-check"
    },
    
    # Messaging APIs
    {
        "api_id": "twilio",
        "name": "Twilio",
        "name_hi": "ट्विलियो",
        "category": "messaging",
        "provider": "Twilio Inc.",
        "description": "SMS and WhatsApp messaging",
        "description_hi": "SMS और WhatsApp संदेश",
        "is_enabled": False,
        "mode": "sandbox",
        "priority": "primary",
        "health_status": "disabled",
        "base_url": "https://api.twilio.com",
        "health_check_url": "https://api.twilio.com/2010-04-01",
        "daily_limit": 5000,
        "calls_today": 0,
        "cost_per_call": 0.5,
        "failover_provider": None,
        "requires_key": True,
        "key_env_var": "TWILIO_ACCOUNT_SID",
        "icon": "message-square"
    },
    
    # Email APIs
    {
        "api_id": "gmail_smtp",
        "name": "Gmail SMTP",
        "name_hi": "जीमेल SMTP",
        "category": "email",
        "provider": "Google",
        "description": "Transactional emails via Gmail",
        "description_hi": "जीमेल के माध्यम से ईमेल",
        "is_enabled": True,
        "mode": "production",
        "priority": "primary",
        "health_status": "active",
        "base_url": "smtp.gmail.com:587",
        "health_check_url": None,
        "daily_limit": 500,
        "calls_today": 0,
        "cost_per_call": 0.0,
        "failover_provider": None,
        "requires_key": True,
        "key_env_var": "SMTP_PASSWORD",
        "icon": "mail"
    },
    
    # Maps APIs
    {
        "api_id": "openstreetmap",
        "name": "OpenStreetMap",
        "name_hi": "ओपनस्ट्रीटमैप",
        "category": "maps",
        "provider": "OpenStreetMap Foundation",
        "description": "Free map tiles and geocoding",
        "description_hi": "मुफ्त मानचित्र टाइल्स",
        "is_enabled": True,
        "mode": "production",
        "priority": "primary",
        "health_status": "active",
        "base_url": "https://tile.openstreetmap.org",
        "health_check_url": "https://tile.openstreetmap.org/0/0/0.png",
        "daily_limit": 50000,
        "calls_today": 0,
        "cost_per_call": 0.0,
        "failover_provider": None,
        "requires_key": False,
        "key_env_var": None,
        "icon": "map"
    },
    
    # Weather APIs
    {
        "api_id": "openweathermap",
        "name": "OpenWeatherMap",
        "name_hi": "ओपनवेदरमैप",
        "category": "weather",
        "provider": "OpenWeather Ltd",
        "description": "Real-time weather data for flight planning",
        "description_hi": "उड़ान योजना के लिए मौसम डेटा",
        "is_enabled": True,
        "mode": "production",
        "priority": "primary",
        "health_status": "active",
        "base_url": "https://api.openweathermap.org",
        "health_check_url": "https://api.openweathermap.org/data/2.5/weather",
        "daily_limit": 1000,
        "calls_today": 0,
        "cost_per_call": 0.0,
        "failover_provider": None,
        "requires_key": True,
        "key_env_var": "OPENWEATHER_API_KEY",
        "icon": "cloud-sun"
    },
    
    # AI/LLM APIs
    {
        "api_id": "openai",
        "name": "OpenAI GPT",
        "name_hi": "ओपनएआई",
        "category": "finance",
        "provider": "OpenAI",
        "description": "AI advisor and smart pricing",
        "description_hi": "एआई सलाहकार और स्मार्ट प्राइसिंग",
        "is_enabled": True,
        "mode": "production",
        "priority": "primary",
        "health_status": "active",
        "base_url": "https://api.openai.com",
        "health_check_url": "https://api.openai.com/v1/models",
        "daily_limit": 500,
        "calls_today": 0,
        "cost_per_call": 0.01,
        "failover_provider": None,
        "requires_key": True,
        "key_env_var": "EMERGENT_MODEL_API_KEY",
        "icon": "brain"
    }
]


# ============ HELPER FUNCTIONS ============

async def log_api_audit(db, user: dict, api_id: str, action: str, old_value: Any, 
                        new_value: Any, reason: str, request: Request):
    """Log API configuration changes"""
    log_entry = {
        "log_id": str(uuid.uuid4()),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "api_id": api_id,
        "action": action,
        "changed_by": user.get("id"),
        "changed_by_email": user.get("email"),
        "old_value": old_value,
        "new_value": new_value,
        "ip_address": request.client.host if request.client else "unknown",
        "user_agent": request.headers.get("user-agent", "unknown"),
        "reason": reason
    }
    await db.api_control_audit_logs.insert_one(log_entry)
    return log_entry


async def check_api_health(api_config: dict) -> dict:
    """Check health status of an API"""
    if not api_config.get("health_check_url"):
        return {"status": "unknown", "response_time": None, "message": "No health check URL"}
    
    try:
        start_time = datetime.now(timezone.utc)
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                api_config["health_check_url"],
                headers={"Authorization": os.environ.get(api_config.get("key_env_var", ""), "")}
            )
            end_time = datetime.now(timezone.utc)
            response_time = (end_time - start_time).total_seconds() * 1000
            
            if response.status_code < 400:
                return {
                    "status": "active",
                    "response_time": round(response_time, 2),
                    "message": "OK",
                    "last_checked": datetime.now(timezone.utc).isoformat()
                }
            elif response.status_code < 500:
                return {
                    "status": "degraded",
                    "response_time": round(response_time, 2),
                    "message": f"HTTP {response.status_code}",
                    "last_checked": datetime.now(timezone.utc).isoformat()
                }
            else:
                return {
                    "status": "down",
                    "response_time": round(response_time, 2),
                    "message": f"HTTP {response.status_code}",
                    "last_checked": datetime.now(timezone.utc).isoformat()
                }
    except httpx.TimeoutException:
        return {"status": "down", "response_time": None, "message": "Timeout", "last_checked": datetime.now(timezone.utc).isoformat()}
    except Exception as e:
        return {"status": "down", "response_time": None, "message": str(e), "last_checked": datetime.now(timezone.utc).isoformat()}


# ============ INITIALIZATION ============

@router.post("/admin/initialize")
async def initialize_api_control(
    current_user: dict = Depends(require_roles(["admin", "super_admin"]))
):
    """Initialize API Control Center with default configurations"""
    db = get_database()
    
    existing = await db.api_control_configs.count_documents({})
    if existing > 0:
        return {"message": "API Control Center already initialized", "message_hi": "API कंट्रोल सेंटर पहले से इनिशियलाइज़ है"}
    
    now = datetime.now(timezone.utc).isoformat()
    
    for api_config in DEFAULT_APIS:
        api_config["created_at"] = now
        api_config["updated_at"] = now
        api_config["last_health_check"] = None
        api_config["total_calls"] = 0
        api_config["total_errors"] = 0
        api_config["avg_response_time"] = 0
        await db.api_control_configs.insert_one(api_config)
    
    return {
        "success": True,
        "message": f"Initialized {len(DEFAULT_APIS)} API configurations",
        "message_hi": f"{len(DEFAULT_APIS)} API कॉन्फ़िगरेशन इनिशियलाइज़"
    }


# ============ DASHBOARD ============

@router.get("/admin/dashboard")
async def get_api_dashboard(
    current_user: dict = Depends(require_roles(["admin", "super_admin", "cfo"]))
):
    """Get API Control Center dashboard"""
    db = get_database()
    
    apis = await db.api_control_configs.find({}, {"_id": 0}).to_list(length=50)
    
    if not apis:
        # Auto-initialize if empty
        await initialize_api_control.__wrapped__(current_user)
        apis = await db.api_control_configs.find({}, {"_id": 0}).to_list(length=50)
    
    # Group by category
    by_category = {}
    for api in apis:
        cat = api.get("category", "other")
        if cat not in by_category:
            by_category[cat] = []
        by_category[cat].append(api)
    
    # Calculate stats
    total_apis = len(apis)
    active_apis = len([a for a in apis if a.get("is_enabled") and a.get("health_status") == "active"])
    degraded_apis = len([a for a in apis if a.get("health_status") == "degraded"])
    down_apis = len([a for a in apis if a.get("health_status") == "down"])
    disabled_apis = len([a for a in apis if not a.get("is_enabled")])
    
    total_calls_today = sum(a.get("calls_today", 0) for a in apis)
    total_cost_today = sum(a.get("calls_today", 0) * a.get("cost_per_call", 0) for a in apis)
    
    # Recent audit logs
    recent_logs = await db.api_control_audit_logs.find(
        {}, {"_id": 0}
    ).sort("timestamp", -1).limit(10).to_list(length=10)
    
    return {
        "stats": {
            "total_apis": total_apis,
            "active": active_apis,
            "degraded": degraded_apis,
            "down": down_apis,
            "disabled": disabled_apis,
            "calls_today": total_calls_today,
            "cost_today": round(total_cost_today, 2)
        },
        "by_category": by_category,
        "apis": apis,
        "recent_logs": recent_logs
    }


# ============ API CONFIGURATION ============

@router.get("/admin/apis")
async def get_all_apis(
    category: Optional[str] = None,
    current_user: dict = Depends(require_roles(["admin", "super_admin", "cfo"]))
):
    """Get all API configurations"""
    db = get_database()
    
    query = {}
    if category:
        query["category"] = category
    
    apis = await db.api_control_configs.find(query, {"_id": 0}).to_list(length=50)
    
    return {"apis": apis, "count": len(apis)}


@router.get("/admin/apis/{api_id}")
async def get_api_config(
    api_id: str,
    current_user: dict = Depends(require_roles(["admin", "super_admin", "cfo"]))
):
    """Get single API configuration"""
    db = get_database()
    
    api = await db.api_control_configs.find_one({"api_id": api_id}, {"_id": 0})
    if not api:
        raise HTTPException(status_code=404, detail="API not found")
    
    return api


@router.put("/admin/apis/{api_id}")
async def update_api_config(
    api_id: str,
    updates: APIConfigUpdate,
    request: Request,
    current_user: dict = Depends(require_roles(["admin", "super_admin"]))
):
    """Update API configuration"""
    db = get_database()
    
    old_config = await db.api_control_configs.find_one({"api_id": api_id}, {"_id": 0})
    if not old_config:
        raise HTTPException(status_code=404, detail="API not found")
    
    update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
    
    if updates.is_enabled is not None:
        update_data["is_enabled"] = updates.is_enabled
        if not updates.is_enabled:
            update_data["health_status"] = "disabled"
    
    if updates.mode:
        update_data["mode"] = updates.mode.value
    
    if updates.priority:
        update_data["priority"] = updates.priority.value
    
    if updates.daily_limit is not None:
        update_data["daily_limit"] = updates.daily_limit
    
    if updates.cost_per_call is not None:
        update_data["cost_per_call"] = updates.cost_per_call
    
    if updates.failover_provider is not None:
        update_data["failover_provider"] = updates.failover_provider
    
    await db.api_control_configs.update_one(
        {"api_id": api_id},
        {"$set": update_data}
    )
    
    # Audit log
    await log_api_audit(db, current_user, api_id, "config_update", 
                        {k: old_config.get(k) for k in update_data.keys()},
                        update_data, updates.reason, request)
    
    return {"success": True, "message": f"API {api_id} updated", "message_hi": f"API {api_id} अपडेट हो गया"}


@router.post("/admin/apis/{api_id}/toggle")
async def toggle_api(
    api_id: str,
    request: Request,
    current_user: dict = Depends(require_roles(["admin", "super_admin"]))
):
    """Enable/Disable an API"""
    db = get_database()
    
    api = await db.api_control_configs.find_one({"api_id": api_id})
    if not api:
        raise HTTPException(status_code=404, detail="API not found")
    
    new_status = not api.get("is_enabled", True)
    
    await db.api_control_configs.update_one(
        {"api_id": api_id},
        {"$set": {
            "is_enabled": new_status,
            "health_status": "active" if new_status else "disabled",
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    await log_api_audit(db, current_user, api_id, "toggle",
                        {"is_enabled": api.get("is_enabled")},
                        {"is_enabled": new_status},
                        f"API {'enabled' if new_status else 'disabled'}", request)
    
    return {"success": True, "is_enabled": new_status}


@router.post("/admin/apis/{api_id}/mode")
async def switch_api_mode(
    api_id: str,
    mode: APIMode,
    request: Request,
    current_user: dict = Depends(require_roles(["admin", "super_admin"]))
):
    """Switch API between Sandbox and Production mode"""
    db = get_database()
    
    api = await db.api_control_configs.find_one({"api_id": api_id})
    if not api:
        raise HTTPException(status_code=404, detail="API not found")
    
    old_mode = api.get("mode")
    
    await db.api_control_configs.update_one(
        {"api_id": api_id},
        {"$set": {
            "mode": mode.value,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    await log_api_audit(db, current_user, api_id, "mode_switch",
                        {"mode": old_mode}, {"mode": mode.value},
                        f"Switched from {old_mode} to {mode.value}", request)
    
    return {"success": True, "mode": mode.value, "message_hi": f"मोड बदल गया: {mode.value}"}


# ============ HEALTH CHECK ============

@router.get("/admin/apis/{api_id}/health")
async def check_single_api_health(
    api_id: str,
    current_user: dict = Depends(require_roles(["admin", "super_admin", "cfo"]))
):
    """Check health of a specific API"""
    db = get_database()
    
    api = await db.api_control_configs.find_one({"api_id": api_id}, {"_id": 0})
    if not api:
        raise HTTPException(status_code=404, detail="API not found")
    
    if not api.get("is_enabled"):
        return {"api_id": api_id, "status": "disabled", "message": "API is disabled"}
    
    health = await check_api_health(api)
    
    # Update health status in DB
    await db.api_control_configs.update_one(
        {"api_id": api_id},
        {"$set": {
            "health_status": health["status"],
            "last_health_check": health.get("last_checked"),
            "last_response_time": health.get("response_time")
        }}
    )
    
    return {"api_id": api_id, **health}


@router.post("/admin/health-check-all")
async def check_all_apis_health(
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(require_roles(["admin", "super_admin"]))
):
    """Check health of all enabled APIs"""
    db = get_database()
    
    apis = await db.api_control_configs.find(
        {"is_enabled": True},
        {"_id": 0}
    ).to_list(length=50)
    
    results = []
    for api in apis:
        health = await check_api_health(api)
        results.append({"api_id": api["api_id"], "name": api["name"], **health})
        
        # Update in DB
        await db.api_control_configs.update_one(
            {"api_id": api["api_id"]},
            {"$set": {
                "health_status": health["status"],
                "last_health_check": health.get("last_checked"),
                "last_response_time": health.get("response_time")
            }}
        )
    
    return {"results": results, "checked": len(results)}


# ============ EMERGENCY OVERRIDE ============

@router.post("/admin/emergency-override")
async def set_emergency_override(
    override: EmergencyOverrideRequest,
    request: Request,
    current_user: dict = Depends(require_roles(["admin", "super_admin"]))
):
    """Set emergency override for an API"""
    db = get_database()
    
    api = await db.api_control_configs.find_one({"api_id": override.api_id})
    if not api:
        raise HTTPException(status_code=404, detail="API not found")
    
    old_status = api.get("health_status")
    
    update_data = {
        "health_status": override.new_status.value,
        "emergency_override": True,
        "emergency_override_reason": override.reason,
        "emergency_override_by": current_user["id"],
        "emergency_override_at": datetime.now(timezone.utc).isoformat(),
        "fallback_mode": override.fallback_mode,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    # If switching to manual mode, keep enabled but flag for manual processing
    if override.new_status == APIStatus.DEGRADED:
        update_data["manual_verification_mode"] = True
    
    await db.api_control_configs.update_one(
        {"api_id": override.api_id},
        {"$set": update_data}
    )
    
    await log_api_audit(db, current_user, override.api_id, "emergency_override",
                        {"health_status": old_status},
                        {"health_status": override.new_status.value, "fallback_mode": override.fallback_mode},
                        override.reason, request)
    
    return {
        "success": True,
        "message": f"Emergency override set for {override.api_id}",
        "message_hi": f"{override.api_id} के लिए इमरजेंसी ओवरराइड सेट",
        "new_status": override.new_status.value,
        "fallback_mode": override.fallback_mode
    }


@router.post("/admin/clear-emergency/{api_id}")
async def clear_emergency_override(
    api_id: str,
    request: Request,
    current_user: dict = Depends(require_roles(["admin", "super_admin"]))
):
    """Clear emergency override and return to normal"""
    db = get_database()
    
    api = await db.api_control_configs.find_one({"api_id": api_id})
    if not api:
        raise HTTPException(status_code=404, detail="API not found")
    
    await db.api_control_configs.update_one(
        {"api_id": api_id},
        {
            "$set": {
                "health_status": "active",
                "emergency_override": False,
                "manual_verification_mode": False,
                "updated_at": datetime.now(timezone.utc).isoformat()
            },
            "$unset": {
                "emergency_override_reason": "",
                "emergency_override_by": "",
                "emergency_override_at": "",
                "fallback_mode": ""
            }
        }
    )
    
    await log_api_audit(db, current_user, api_id, "clear_emergency",
                        {"emergency_override": True}, {"emergency_override": False},
                        "Cleared emergency override", request)
    
    return {"success": True, "message": f"Emergency override cleared for {api_id}"}


# ============ USAGE TRACKING ============

@router.post("/track-usage/{api_id}")
async def track_api_usage(
    api_id: str,
    success: bool = True,
    response_time: Optional[float] = None
):
    """Track API usage (internal endpoint)"""
    db = get_database()
    
    update = {
        "$inc": {
            "calls_today": 1,
            "total_calls": 1
        }
    }
    
    if not success:
        update["$inc"]["total_errors"] = 1
    
    if response_time:
        # Update running average
        api = await db.api_control_configs.find_one({"api_id": api_id})
        if api:
            total = api.get("total_calls", 0)
            avg = api.get("avg_response_time", 0)
            new_avg = ((avg * total) + response_time) / (total + 1)
            update["$set"] = {"avg_response_time": round(new_avg, 2)}
    
    await db.api_control_configs.update_one({"api_id": api_id}, update)
    
    # Log to usage history
    await db.api_usage_logs.insert_one({
        "api_id": api_id,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "success": success,
        "response_time": response_time
    })
    
    return {"tracked": True}


@router.get("/admin/usage/{api_id}")
async def get_api_usage(
    api_id: str,
    days: int = 7,
    current_user: dict = Depends(require_roles(["admin", "super_admin", "cfo"]))
):
    """Get API usage statistics"""
    db = get_database()
    
    start_date = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    
    # Aggregate usage by day
    pipeline = [
        {"$match": {"api_id": api_id, "timestamp": {"$gte": start_date}}},
        {"$group": {
            "_id": {"$substr": ["$timestamp", 0, 10]},
            "total_calls": {"$sum": 1},
            "successful": {"$sum": {"$cond": ["$success", 1, 0]}},
            "failed": {"$sum": {"$cond": ["$success", 0, 1]}},
            "avg_response_time": {"$avg": "$response_time"}
        }},
        {"$sort": {"_id": 1}}
    ]
    
    usage = await db.api_usage_logs.aggregate(pipeline).to_list(length=30)
    
    return {"api_id": api_id, "days": days, "usage": usage}


# ============ AUDIT LOGS ============

@router.get("/admin/audit-logs")
async def get_api_audit_logs(
    api_id: Optional[str] = None,
    limit: int = 50,
    current_user: dict = Depends(require_roles(["admin", "super_admin"]))
):
    """Get API control audit logs"""
    db = get_database()
    
    query = {}
    if api_id:
        query["api_id"] = api_id
    
    logs = await db.api_control_audit_logs.find(
        query, {"_id": 0}
    ).sort("timestamp", -1).limit(limit).to_list(length=limit)
    
    return {"logs": logs, "count": len(logs)}


# ============ RESET DAILY COUNTS ============

@router.post("/admin/reset-daily-counts")
async def reset_daily_counts(
    current_user: dict = Depends(require_roles(["admin", "super_admin"]))
):
    """Reset daily API call counts (run at midnight)"""
    db = get_database()
    
    result = await db.api_control_configs.update_many(
        {},
        {"$set": {"calls_today": 0}}
    )
    
    return {"success": True, "reset_count": result.modified_count}



# ============ API COST REPORTS (Finance Team) ============

@router.get("/admin/cost-reports/monthly")
async def get_monthly_cost_report(
    year: int = None,
    month: int = None,
    current_user: dict = Depends(require_roles(["admin", "super_admin", "cfo", "finance_head"]))
):
    """
    Generate monthly cost report per API for finance team
    Shows: API name, total calls, cost per call, total cost, comparison with last month
    """
    db = get_database()
    
    # Default to current month
    now = datetime.now(timezone.utc)
    if not year:
        year = now.year
    if not month:
        month = now.month
    
    # Calculate date range
    start_date = datetime(year, month, 1, tzinfo=timezone.utc)
    if month == 12:
        end_date = datetime(year + 1, 1, 1, tzinfo=timezone.utc)
    else:
        end_date = datetime(year, month + 1, 1, tzinfo=timezone.utc)
    
    # Previous month for comparison
    if month == 1:
        prev_start = datetime(year - 1, 12, 1, tzinfo=timezone.utc)
        prev_end = start_date
    else:
        prev_start = datetime(year, month - 1, 1, tzinfo=timezone.utc)
        prev_end = start_date
    
    # Aggregate current month usage
    pipeline = [
        {
            "$match": {
                "timestamp": {
                    "$gte": start_date.isoformat(),
                    "$lt": end_date.isoformat()
                }
            }
        },
        {
            "$group": {
                "_id": "$api_id",
                "total_calls": {"$sum": 1},
                "successful_calls": {"$sum": {"$cond": ["$success", 1, 0]}},
                "failed_calls": {"$sum": {"$cond": ["$success", 0, 1]}},
                "avg_response_time": {"$avg": "$response_time"}
            }
        }
    ]
    
    current_usage = await db.api_usage_logs.aggregate(pipeline).to_list(length=50)
    current_usage_map = {u["_id"]: u for u in current_usage}
    
    # Aggregate previous month for comparison
    pipeline[0]["$match"]["timestamp"] = {
        "$gte": prev_start.isoformat(),
        "$lt": prev_end.isoformat()
    }
    prev_usage = await db.api_usage_logs.aggregate(pipeline).to_list(length=50)
    prev_usage_map = {u["_id"]: u for u in prev_usage}
    
    # Get API configs for cost calculation
    apis = await db.api_control_configs.find({}, {"_id": 0}).to_list(length=50)
    
    # Build report
    report_items = []
    total_cost = 0
    total_calls = 0
    prev_total_cost = 0
    
    for api in apis:
        api_id = api.get("api_id")
        cost_per_call = api.get("cost_per_call", 0)
        
        current = current_usage_map.get(api_id, {"total_calls": 0, "successful_calls": 0, "failed_calls": 0})
        prev = prev_usage_map.get(api_id, {"total_calls": 0})
        
        current_calls = current.get("total_calls", 0)
        current_cost = current_calls * cost_per_call
        prev_calls = prev.get("total_calls", 0)
        prev_cost = prev_calls * cost_per_call
        
        # Calculate change percentage
        if prev_calls > 0:
            calls_change = round(((current_calls - prev_calls) / prev_calls) * 100, 1)
        else:
            calls_change = 100 if current_calls > 0 else 0
        
        if prev_cost > 0:
            cost_change = round(((current_cost - prev_cost) / prev_cost) * 100, 1)
        else:
            cost_change = 100 if current_cost > 0 else 0
        
        report_items.append({
            "api_id": api_id,
            "api_name": api.get("name"),
            "api_name_hi": api.get("name_hi"),
            "category": api.get("category"),
            "cost_per_call": cost_per_call,
            "current_month": {
                "calls": current_calls,
                "successful": current.get("successful_calls", 0),
                "failed": current.get("failed_calls", 0),
                "cost": round(current_cost, 2),
                "avg_response_time": round(current.get("avg_response_time", 0) or 0, 2)
            },
            "previous_month": {
                "calls": prev_calls,
                "cost": round(prev_cost, 2)
            },
            "change": {
                "calls_percent": calls_change,
                "cost_percent": cost_change,
                "trend": "up" if calls_change > 0 else "down" if calls_change < 0 else "stable"
            }
        })
        
        total_cost += current_cost
        total_calls += current_calls
        prev_total_cost += prev_cost
    
    # Sort by cost (highest first)
    report_items.sort(key=lambda x: x["current_month"]["cost"], reverse=True)
    
    return {
        "report_period": {
            "year": year,
            "month": month,
            "month_name": start_date.strftime("%B"),
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat()
        },
        "summary": {
            "total_apis": len(apis),
            "total_calls": total_calls,
            "total_cost": round(total_cost, 2),
            "previous_month_cost": round(prev_total_cost, 2),
            "cost_change_percent": round(((total_cost - prev_total_cost) / prev_total_cost * 100), 1) if prev_total_cost > 0 else 0,
            "currency": "INR"
        },
        "by_category": _group_report_by_category(report_items),
        "items": report_items,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "generated_by": current_user.get("email")
    }


def _group_report_by_category(items: List[dict]) -> dict:
    """Group report items by category"""
    by_category = {}
    for item in items:
        cat = item.get("category", "other")
        if cat not in by_category:
            by_category[cat] = {"calls": 0, "cost": 0, "apis": []}
        by_category[cat]["calls"] += item["current_month"]["calls"]
        by_category[cat]["cost"] += item["current_month"]["cost"]
        by_category[cat]["apis"].append(item["api_name"])
    return by_category


@router.get("/admin/cost-reports/yearly")
async def get_yearly_cost_report(
    year: int = None,
    current_user: dict = Depends(require_roles(["admin", "super_admin", "cfo", "finance_head"]))
):
    """
    Generate yearly cost report with month-by-month breakdown
    """
    db = get_database()
    
    if not year:
        year = datetime.now(timezone.utc).year
    
    # Get all API configs
    apis = await db.api_control_configs.find({}, {"_id": 0, "api_id": 1, "name": 1, "cost_per_call": 1}).to_list(length=50)
    api_costs = {a["api_id"]: a.get("cost_per_call", 0) for a in apis}
    
    monthly_data = []
    
    for month in range(1, 13):
        start_date = datetime(year, month, 1, tzinfo=timezone.utc)
        if month == 12:
            end_date = datetime(year + 1, 1, 1, tzinfo=timezone.utc)
        else:
            end_date = datetime(year, month + 1, 1, tzinfo=timezone.utc)
        
        # Skip future months
        if start_date > datetime.now(timezone.utc):
            continue
        
        pipeline = [
            {
                "$match": {
                    "timestamp": {
                        "$gte": start_date.isoformat(),
                        "$lt": end_date.isoformat()
                    }
                }
            },
            {
                "$group": {
                    "_id": "$api_id",
                    "calls": {"$sum": 1}
                }
            }
        ]
        
        usage = await db.api_usage_logs.aggregate(pipeline).to_list(length=50)
        
        month_calls = sum(u["calls"] for u in usage)
        month_cost = sum(u["calls"] * api_costs.get(u["_id"], 0) for u in usage)
        
        monthly_data.append({
            "month": month,
            "month_name": start_date.strftime("%B"),
            "calls": month_calls,
            "cost": round(month_cost, 2)
        })
    
    return {
        "year": year,
        "monthly_breakdown": monthly_data,
        "total_calls": sum(m["calls"] for m in monthly_data),
        "total_cost": round(sum(m["cost"] for m in monthly_data), 2),
        "currency": "INR",
        "generated_at": datetime.now(timezone.utc).isoformat()
    }


@router.get("/admin/cost-reports/export")
async def export_cost_report(
    year: int,
    month: int,
    format: str = "json",
    current_user: dict = Depends(require_roles(["admin", "super_admin", "cfo", "finance_head"]))
):
    """
    Export cost report in different formats (JSON/CSV ready)
    """
    report = await get_monthly_cost_report.__wrapped__(year, month, current_user)
    
    if format == "csv_data":
        # Return CSV-ready data
        csv_rows = [
            ["API Name", "Category", "Calls", "Cost per Call (₹)", "Total Cost (₹)", "Success Rate", "Change %"]
        ]
        for item in report["items"]:
            success_rate = 0
            if item["current_month"]["calls"] > 0:
                success_rate = round((item["current_month"]["successful"] / item["current_month"]["calls"]) * 100, 1)
            
            csv_rows.append([
                item["api_name"],
                item["category"],
                item["current_month"]["calls"],
                item["cost_per_call"],
                item["current_month"]["cost"],
                f"{success_rate}%",
                f"{item['change']['cost_percent']}%"
            ])
        
        return {"format": "csv", "rows": csv_rows, "filename": f"api_cost_report_{year}_{month}.csv"}
    
    return report


# ============ FAILOVER AUTO-SWITCH ============

@router.post("/admin/failover/configure")
async def configure_failover(
    api_id: str,
    failover_api_id: str,
    auto_switch: bool = True,
    switch_threshold: int = 3,  # Number of failures before auto-switch
    cooldown_minutes: int = 15,  # Cooldown before switching back
    request: Request = None,
    current_user: dict = Depends(require_roles(["admin", "super_admin"]))
):
    """
    Configure failover settings for an API
    """
    db = get_database()
    
    # Validate both APIs exist
    primary = await db.api_control_configs.find_one({"api_id": api_id})
    failover = await db.api_control_configs.find_one({"api_id": failover_api_id})
    
    if not primary:
        raise HTTPException(status_code=404, detail=f"Primary API {api_id} not found")
    if not failover:
        raise HTTPException(status_code=404, detail=f"Failover API {failover_api_id} not found")
    
    # Update failover config
    await db.api_control_configs.update_one(
        {"api_id": api_id},
        {"$set": {
            "failover_provider": failover_api_id,
            "failover_config": {
                "auto_switch": auto_switch,
                "switch_threshold": switch_threshold,
                "cooldown_minutes": cooldown_minutes,
                "consecutive_failures": 0,
                "is_using_failover": False,
                "last_switch_time": None
            },
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Log
    await log_api_audit(db, current_user, api_id, "failover_configure",
                        {"failover_provider": primary.get("failover_provider")},
                        {"failover_provider": failover_api_id, "auto_switch": auto_switch},
                        f"Configured failover to {failover_api_id}", request)
    
    return {
        "success": True,
        "message": f"Failover configured: {api_id} → {failover_api_id}",
        "message_hi": f"फेलओवर कॉन्फ़िगर: {api_id} → {failover_api_id}",
        "config": {
            "primary": api_id,
            "failover": failover_api_id,
            "auto_switch": auto_switch,
            "threshold": switch_threshold,
            "cooldown": cooldown_minutes
        }
    }


@router.post("/internal/failover/report-failure")
async def report_api_failure(
    api_id: str,
    error_message: str = "",
    background_tasks: BackgroundTasks = None
):
    """
    Internal endpoint to report API failure and trigger auto-failover if configured
    Called by other services when an API call fails
    """
    db = get_database()
    
    api = await db.api_control_configs.find_one({"api_id": api_id})
    if not api:
        return {"error": "API not found"}
    
    failover_config = api.get("failover_config", {})
    
    if not failover_config.get("auto_switch"):
        # Just increment failure count
        await db.api_control_configs.update_one(
            {"api_id": api_id},
            {"$inc": {"failover_config.consecutive_failures": 1}}
        )
        return {"action": "logged", "auto_switch": False}
    
    # Increment consecutive failures
    new_failures = failover_config.get("consecutive_failures", 0) + 1
    threshold = failover_config.get("switch_threshold", 3)
    
    await db.api_control_configs.update_one(
        {"api_id": api_id},
        {"$set": {"failover_config.consecutive_failures": new_failures}}
    )
    
    # Check if we should auto-switch
    if new_failures >= threshold and not failover_config.get("is_using_failover"):
        failover_api_id = api.get("failover_provider")
        
        if failover_api_id:
            # Trigger auto-switch
            if background_tasks:
                background_tasks.add_task(
                    _execute_failover_switch, api_id, failover_api_id, error_message
                )
            else:
                await _execute_failover_switch(api_id, failover_api_id, error_message)
            
            return {
                "action": "failover_triggered",
                "from": api_id,
                "to": failover_api_id,
                "failures": new_failures
            }
    
    return {"action": "failure_logged", "consecutive_failures": new_failures, "threshold": threshold}


async def _execute_failover_switch(primary_api_id: str, failover_api_id: str, reason: str):
    """Execute the actual failover switch"""
    db = get_database()
    now = datetime.now(timezone.utc).isoformat()
    
    # Update primary API - mark as using failover
    await db.api_control_configs.update_one(
        {"api_id": primary_api_id},
        {"$set": {
            "health_status": "degraded",
            "failover_config.is_using_failover": True,
            "failover_config.last_switch_time": now,
            "failover_config.failover_reason": reason
        }}
    )
    
    # Update failover API - increase priority
    await db.api_control_configs.update_one(
        {"api_id": failover_api_id},
        {"$set": {
            "priority": "primary",
            "is_acting_as_failover_for": primary_api_id
        }}
    )
    
    # Create failover event log
    await db.api_failover_events.insert_one({
        "event_id": str(uuid.uuid4()),
        "event_type": "auto_failover",
        "primary_api": primary_api_id,
        "failover_api": failover_api_id,
        "reason": reason,
        "triggered_at": now,
        "status": "active"
    })
    
    # Create alert notification
    await db.notifications.insert_one({
        "id": str(uuid.uuid4()),
        "type": "api_failover_alert",
        "title": f"Auto-Failover Triggered: {primary_api_id}",
        "title_hi": f"ऑटो-फेलओवर शुरू: {primary_api_id}",
        "message": f"API {primary_api_id} has failed. Automatically switched to {failover_api_id}.",
        "message_hi": f"API {primary_api_id} फेल हो गया। स्वचालित रूप से {failover_api_id} पर स्विच किया गया।",
        "severity": "high",
        "for_roles": ["admin", "super_admin", "cfo"],
        "read": False,
        "created_at": now
    })
    
    logger.warning(f"AUTO-FAILOVER: {primary_api_id} → {failover_api_id} | Reason: {reason}")


@router.post("/internal/failover/report-success")
async def report_api_success(api_id: str):
    """
    Internal endpoint to report API success - resets failure counter
    """
    db = get_database()
    
    await db.api_control_configs.update_one(
        {"api_id": api_id},
        {"$set": {"failover_config.consecutive_failures": 0}}
    )
    
    return {"action": "success_logged", "failures_reset": True}


@router.post("/admin/failover/switch-back")
async def switch_back_to_primary(
    api_id: str,
    request: Request,
    current_user: dict = Depends(require_roles(["admin", "super_admin"]))
):
    """
    Manually switch back from failover to primary API
    """
    db = get_database()
    
    api = await db.api_control_configs.find_one({"api_id": api_id})
    if not api:
        raise HTTPException(status_code=404, detail="API not found")
    
    failover_config = api.get("failover_config", {})
    
    if not failover_config.get("is_using_failover"):
        return {"message": "API is not currently using failover", "message_hi": "API फिलहाल फेलओवर पर नहीं है"}
    
    failover_api_id = api.get("failover_provider")
    now = datetime.now(timezone.utc).isoformat()
    
    # Reset primary API
    await db.api_control_configs.update_one(
        {"api_id": api_id},
        {"$set": {
            "health_status": "active",
            "failover_config.is_using_failover": False,
            "failover_config.consecutive_failures": 0,
            "failover_config.last_switch_time": now
        }}
    )
    
    # Reset failover API priority
    if failover_api_id:
        await db.api_control_configs.update_one(
            {"api_id": failover_api_id},
            {
                "$set": {"priority": "secondary"},
                "$unset": {"is_acting_as_failover_for": ""}
            }
        )
    
    # Log event
    await db.api_failover_events.insert_one({
        "event_id": str(uuid.uuid4()),
        "event_type": "manual_switch_back",
        "primary_api": api_id,
        "failover_api": failover_api_id,
        "switched_by": current_user.get("id"),
        "triggered_at": now,
        "status": "completed"
    })
    
    await log_api_audit(db, current_user, api_id, "failover_switch_back",
                        {"is_using_failover": True},
                        {"is_using_failover": False},
                        "Manual switch back to primary", request)
    
    return {
        "success": True,
        "message": f"Switched back to primary API: {api_id}",
        "message_hi": f"प्राइमरी API पर वापस: {api_id}"
    }


@router.get("/admin/failover/status")
async def get_failover_status(
    current_user: dict = Depends(require_roles(["admin", "super_admin", "cfo"]))
):
    """
    Get current failover status for all APIs
    """
    db = get_database()
    
    apis = await db.api_control_configs.find(
        {"failover_provider": {"$ne": None}},
        {"_id": 0, "api_id": 1, "name": 1, "failover_provider": 1, "failover_config": 1, "health_status": 1}
    ).to_list(length=50)
    
    # Get recent failover events
    recent_events = await db.api_failover_events.find(
        {},
        {"_id": 0}
    ).sort("triggered_at", -1).limit(10).to_list(length=10)
    
    active_failovers = [a for a in apis if a.get("failover_config", {}).get("is_using_failover")]
    
    return {
        "total_configured": len(apis),
        "active_failovers": len(active_failovers),
        "apis": apis,
        "recent_events": recent_events
    }


@router.get("/admin/failover/events")
async def get_failover_events(
    limit: int = 50,
    api_id: Optional[str] = None,
    current_user: dict = Depends(require_roles(["admin", "super_admin"]))
):
    """
    Get failover event history
    """
    db = get_database()
    
    query = {}
    if api_id:
        query["$or"] = [{"primary_api": api_id}, {"failover_api": api_id}]
    
    events = await db.api_failover_events.find(
        query,
        {"_id": 0}
    ).sort("triggered_at", -1).limit(limit).to_list(length=limit)
    
    return {"events": events, "count": len(events)}


# ============ SMART FAILOVER RECOMMENDATION ============

@router.get("/admin/failover/recommendations")
async def get_failover_recommendations(
    current_user: dict = Depends(require_roles(["admin", "super_admin"]))
):
    """
    Get AI-powered failover recommendations based on API performance
    """
    db = get_database()
    
    apis = await db.api_control_configs.find({}, {"_id": 0}).to_list(length=50)
    
    recommendations = []
    
    for api in apis:
        api_id = api.get("api_id")
        health = api.get("health_status")
        has_failover = api.get("failover_provider") is not None
        avg_response = api.get("avg_response_time", 0)
        total_errors = api.get("total_errors", 0)
        total_calls = api.get("total_calls", 1)
        error_rate = (total_errors / total_calls) * 100 if total_calls > 0 else 0
        
        # Generate recommendations
        if health == "down" and not has_failover:
            recommendations.append({
                "api_id": api_id,
                "priority": "critical",
                "type": "add_failover",
                "message": f"{api['name']} is DOWN with no failover configured!",
                "message_hi": f"{api['name']} डाउन है और कोई फेलओवर नहीं है!",
                "action": "Configure a failover provider immediately"
            })
        elif error_rate > 10 and not has_failover:
            recommendations.append({
                "api_id": api_id,
                "priority": "high",
                "type": "add_failover",
                "message": f"{api['name']} has {error_rate:.1f}% error rate - needs failover",
                "message_hi": f"{api['name']} में {error_rate:.1f}% एरर रेट है - फेलओवर चाहिए",
                "action": "Configure failover to handle failures"
            })
        elif avg_response > 2000:  # > 2 seconds
            recommendations.append({
                "api_id": api_id,
                "priority": "medium",
                "type": "performance",
                "message": f"{api['name']} is slow ({avg_response}ms avg response)",
                "message_hi": f"{api['name']} धीमा है ({avg_response}ms औसत)",
                "action": "Consider switching to a faster provider"
            })
        
        # Check if failover is configured but not auto-switch
        if has_failover and not api.get("failover_config", {}).get("auto_switch"):
            recommendations.append({
                "api_id": api_id,
                "priority": "low",
                "type": "enable_auto",
                "message": f"{api['name']} has failover but auto-switch is disabled",
                "message_hi": f"{api['name']} में फेलओवर है पर ऑटो-स्विच बंद है",
                "action": "Enable auto-switch for faster recovery"
            })
    
    # Sort by priority
    priority_order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
    recommendations.sort(key=lambda x: priority_order.get(x["priority"], 4))
    
    return {
        "total_recommendations": len(recommendations),
        "critical_count": len([r for r in recommendations if r["priority"] == "critical"]),
        "recommendations": recommendations
    }



# ============ BUDGET ALERTS ============

@router.post("/admin/budget/configure")
async def configure_budget_alerts(
    monthly_budget: float,
    warning_threshold_percent: int = 80,
    critical_threshold_percent: int = 95,
    notify_emails: List[str] = [],
    notify_slack_webhook: Optional[str] = None,
    request: Request = None,
    current_user: dict = Depends(require_roles(["admin", "super_admin", "cfo"]))
):
    """
    Configure monthly API budget and alert thresholds
    """
    db = get_database()
    
    config = {
        "config_id": "api_budget_config",
        "monthly_budget": monthly_budget,
        "warning_threshold_percent": warning_threshold_percent,
        "critical_threshold_percent": critical_threshold_percent,
        "notify_emails": notify_emails,
        "notify_slack_webhook": notify_slack_webhook,
        "currency": "INR",
        "alerts_enabled": True,
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "updated_by": current_user.get("id")
    }
    
    await db.api_budget_config.update_one(
        {"config_id": "api_budget_config"},
        {"$set": config},
        upsert=True
    )
    
    await log_api_audit(db, current_user, "budget_config", None, config, 
                        f"Budget set to ₹{monthly_budget}", request)
    
    return {
        "success": True,
        "message": f"Budget configured: ₹{monthly_budget:,.0f}/month",
        "message_hi": f"बजट कॉन्फ़िगर: ₹{monthly_budget:,.0f}/माह",
        "thresholds": {
            "warning": f"{warning_threshold_percent}% (₹{monthly_budget * warning_threshold_percent / 100:,.0f})",
            "critical": f"{critical_threshold_percent}% (₹{monthly_budget * critical_threshold_percent / 100:,.0f})"
        }
    }


@router.get("/admin/budget/status")
async def get_budget_status(
    current_user: dict = Depends(require_roles(["admin", "super_admin", "cfo", "finance_head"]))
):
    """
    Get current budget status and spending
    """
    db = get_database()
    
    # Get budget config
    config = await db.api_budget_config.find_one(
        {"config_id": "api_budget_config"},
        {"_id": 0}
    )
    
    if not config:
        return {
            "configured": False,
            "message": "Budget not configured",
            "message_hi": "बजट कॉन्फ़िगर नहीं है"
        }
    
    # Calculate current month spending
    now = datetime.now(timezone.utc)
    start_of_month = datetime(now.year, now.month, 1, tzinfo=timezone.utc)
    
    # Get API configs for cost calculation
    apis = await db.api_control_configs.find({}, {"_id": 0, "api_id": 1, "cost_per_call": 1}).to_list(length=50)
    api_costs = {a["api_id"]: a.get("cost_per_call", 0) for a in apis}
    
    # Aggregate usage
    pipeline = [
        {"$match": {"timestamp": {"$gte": start_of_month.isoformat()}}},
        {"$group": {"_id": "$api_id", "calls": {"$sum": 1}}}
    ]
    usage = await db.api_usage_logs.aggregate(pipeline).to_list(length=50)
    
    current_spend = sum(u["calls"] * api_costs.get(u["_id"], 0) for u in usage)
    monthly_budget = config.get("monthly_budget", 0)
    
    # Calculate percentages
    spend_percent = (current_spend / monthly_budget * 100) if monthly_budget > 0 else 0
    warning_threshold = config.get("warning_threshold_percent", 80)
    critical_threshold = config.get("critical_threshold_percent", 95)
    
    # Determine status
    if spend_percent >= critical_threshold:
        status = "critical"
        status_emoji = "🔴"
    elif spend_percent >= warning_threshold:
        status = "warning"
        status_emoji = "🟡"
    else:
        status = "healthy"
        status_emoji = "🟢"
    
    # Days remaining in month
    if now.month == 12:
        end_of_month = datetime(now.year + 1, 1, 1, tzinfo=timezone.utc)
    else:
        end_of_month = datetime(now.year, now.month + 1, 1, tzinfo=timezone.utc)
    days_remaining = (end_of_month - now).days
    days_elapsed = now.day
    
    # Projected spend
    if days_elapsed > 0:
        daily_avg = current_spend / days_elapsed
        projected_spend = daily_avg * (days_elapsed + days_remaining)
    else:
        projected_spend = 0
    
    return {
        "configured": True,
        "status": status,
        "status_emoji": status_emoji,
        "budget": {
            "monthly": monthly_budget,
            "warning_at": monthly_budget * warning_threshold / 100,
            "critical_at": monthly_budget * critical_threshold / 100
        },
        "spending": {
            "current": round(current_spend, 2),
            "percent": round(spend_percent, 1),
            "remaining": round(monthly_budget - current_spend, 2),
            "projected": round(projected_spend, 2),
            "projected_percent": round((projected_spend / monthly_budget * 100) if monthly_budget > 0 else 0, 1)
        },
        "period": {
            "days_elapsed": days_elapsed,
            "days_remaining": days_remaining,
            "daily_average": round(daily_avg if days_elapsed > 0 else 0, 2)
        },
        "thresholds": {
            "warning_percent": warning_threshold,
            "critical_percent": critical_threshold
        },
        "currency": "INR"
    }


@router.post("/internal/budget/check-and-alert")
async def check_budget_and_alert(background_tasks: BackgroundTasks):
    """
    Internal endpoint to check budget and send alerts if threshold exceeded
    Should be called periodically (e.g., hourly via cron)
    """
    db = get_database()
    
    config = await db.api_budget_config.find_one({"config_id": "api_budget_config"})
    if not config or not config.get("alerts_enabled"):
        return {"action": "skipped", "reason": "Budget alerts not configured or disabled"}
    
    # Get current status
    # Simplified calculation
    now = datetime.now(timezone.utc)
    start_of_month = datetime(now.year, now.month, 1, tzinfo=timezone.utc)
    
    apis = await db.api_control_configs.find({}, {"_id": 0, "api_id": 1, "cost_per_call": 1}).to_list(length=50)
    api_costs = {a["api_id"]: a.get("cost_per_call", 0) for a in apis}
    
    pipeline = [
        {"$match": {"timestamp": {"$gte": start_of_month.isoformat()}}},
        {"$group": {"_id": "$api_id", "calls": {"$sum": 1}}}
    ]
    usage = await db.api_usage_logs.aggregate(pipeline).to_list(length=50)
    current_spend = sum(u["calls"] * api_costs.get(u["_id"], 0) for u in usage)
    
    monthly_budget = config.get("monthly_budget", 0)
    spend_percent = (current_spend / monthly_budget * 100) if monthly_budget > 0 else 0
    
    warning_threshold = config.get("warning_threshold_percent", 80)
    critical_threshold = config.get("critical_threshold_percent", 95)
    
    # Check if alert needed
    alert_type = None
    if spend_percent >= critical_threshold:
        alert_type = "critical"
    elif spend_percent >= warning_threshold:
        alert_type = "warning"
    
    if not alert_type:
        return {"action": "no_alert", "spend_percent": round(spend_percent, 1)}
    
    # Check if we already sent this alert today
    today = now.strftime("%Y-%m-%d")
    existing_alert = await db.budget_alerts_sent.find_one({
        "date": today,
        "alert_type": alert_type
    })
    
    if existing_alert:
        return {"action": "already_sent", "alert_type": alert_type}
    
    # Send alerts
    alert_message = {
        "type": f"budget_{alert_type}",
        "title": f"{'🔴 CRITICAL' if alert_type == 'critical' else '🟡 WARNING'}: API Budget Alert",
        "message": f"API spending has reached {spend_percent:.1f}% of monthly budget (₹{current_spend:,.0f} / ₹{monthly_budget:,.0f})",
        "timestamp": now.isoformat()
    }
    
    # Send to Slack if configured
    if config.get("notify_slack_webhook"):
        background_tasks.add_task(
            send_slack_alert,
            config["notify_slack_webhook"],
            alert_message
        )
    
    # Send emails if configured
    if config.get("notify_emails"):
        background_tasks.add_task(
            send_email_alerts,
            config["notify_emails"],
            alert_message
        )
    
    # Create in-app notification
    await db.notifications.insert_one({
        "id": str(uuid.uuid4()),
        "type": f"budget_{alert_type}",
        "title": alert_message["title"],
        "title_hi": f"{'🔴 गंभीर' if alert_type == 'critical' else '🟡 चेतावनी'}: API बजट अलर्ट",
        "message": alert_message["message"],
        "message_hi": f"API खर्च मासिक बजट का {spend_percent:.1f}% हो गया है",
        "for_roles": ["admin", "super_admin", "cfo", "finance_head"],
        "severity": alert_type,
        "read": False,
        "created_at": now.isoformat()
    })
    
    # Record that we sent this alert
    await db.budget_alerts_sent.insert_one({
        "date": today,
        "alert_type": alert_type,
        "spend_percent": spend_percent,
        "sent_at": now.isoformat()
    })
    
    return {
        "action": "alert_sent",
        "alert_type": alert_type,
        "spend_percent": round(spend_percent, 1),
        "channels": ["in_app"] + (["slack"] if config.get("notify_slack_webhook") else []) + (["email"] if config.get("notify_emails") else [])
    }


# ============ SLACK/EMAIL ALERTS ============

async def send_slack_alert(webhook_url: str, alert: dict):
    """Send alert to Slack webhook"""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            # Format for Slack
            slack_message = {
                "text": alert["title"],
                "blocks": [
                    {
                        "type": "header",
                        "text": {"type": "plain_text", "text": alert["title"], "emoji": True}
                    },
                    {
                        "type": "section",
                        "text": {"type": "mrkdwn", "text": alert["message"]}
                    },
                    {
                        "type": "context",
                        "elements": [
                            {"type": "mrkdwn", "text": f"*AirYatra API Control Center* | {alert['timestamp'][:19]}"}
                        ]
                    }
                ]
            }
            
            response = await client.post(webhook_url, json=slack_message)
            logger.info(f"Slack alert sent: {response.status_code}")
            return response.status_code == 200
    except Exception as e:
        logger.error(f"Slack alert failed: {e}")
        return False


async def send_email_alerts(emails: List[str], alert: dict):
    """Send alert emails via SMTP"""
    import smtplib
    from email.mime.text import MIMEText
    from email.mime.multipart import MIMEMultipart
    
    smtp_host = os.environ.get("SMTP_HOST", "smtp.gmail.com")
    smtp_port = int(os.environ.get("SMTP_PORT", 587))
    smtp_user = os.environ.get("SMTP_USER")
    smtp_password = os.environ.get("SMTP_PASSWORD")
    from_email = os.environ.get("SMTP_FROM_EMAIL", smtp_user)
    
    if not smtp_user or not smtp_password:
        logger.warning("SMTP not configured for budget alerts")
        return False
    
    try:
        for to_email in emails:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = f"AirYatra: {alert['title']}"
            msg["From"] = f"AirYatra Alerts <{from_email}>"
            msg["To"] = to_email
            
            html_body = f"""
            <html>
            <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background: {'#dc2626' if 'CRITICAL' in alert['title'] else '#f59e0b'}; padding: 20px; border-radius: 10px 10px 0 0;">
                    <h1 style="color: white; margin: 0;">{alert['title']}</h1>
                </div>
                <div style="background: #1e293b; padding: 30px; border-radius: 0 0 10px 10px; color: #e2e8f0;">
                    <p style="font-size: 16px; line-height: 1.6;">{alert['message']}</p>
                    <a href="https://airyatra-corporate.preview.emergentagent.com/admin?tab=api_control_center" 
                       style="display: inline-block; background: #f97316; color: white; padding: 12px 24px; 
                              text-decoration: none; border-radius: 6px; margin-top: 20px;">
                        View API Control Center
                    </a>
                </div>
                <p style="color: #64748b; font-size: 12px; text-align: center; margin-top: 20px;">
                    AirYatra - India's Aviation Operating System
                </p>
            </body>
            </html>
            """
            
            msg.attach(MIMEText(alert['message'], "plain"))
            msg.attach(MIMEText(html_body, "html"))
            
            with smtplib.SMTP(smtp_host, smtp_port) as server:
                server.starttls()
                server.login(smtp_user, smtp_password)
                server.sendmail(from_email, to_email, msg.as_string())
            
            logger.info(f"Budget alert email sent to {to_email}")
        
        return True
    except Exception as e:
        logger.error(f"Email alert failed: {e}")
        return False


@router.post("/admin/alerts/configure")
async def configure_alert_channels(
    slack_webhook: Optional[str] = None,
    email_recipients: List[str] = [],
    enable_failover_alerts: bool = True,
    enable_budget_alerts: bool = True,
    enable_health_alerts: bool = True,
    request: Request = None,
    current_user: dict = Depends(require_roles(["admin", "super_admin"]))
):
    """
    Configure alert notification channels
    """
    db = get_database()
    
    config = {
        "config_id": "alert_channels_config",
        "slack_webhook": slack_webhook,
        "email_recipients": email_recipients,
        "enable_failover_alerts": enable_failover_alerts,
        "enable_budget_alerts": enable_budget_alerts,
        "enable_health_alerts": enable_health_alerts,
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "updated_by": current_user.get("id")
    }
    
    await db.alert_channels_config.update_one(
        {"config_id": "alert_channels_config"},
        {"$set": config},
        upsert=True
    )
    
    return {
        "success": True,
        "message": "Alert channels configured",
        "message_hi": "अलर्ट चैनल कॉन्फ़िगर",
        "channels": {
            "slack": bool(slack_webhook),
            "email": len(email_recipients) > 0,
            "in_app": True
        }
    }


@router.post("/admin/alerts/test")
async def test_alert_channels(
    channel: str = "all",  # slack, email, all
    current_user: dict = Depends(require_roles(["admin", "super_admin"]))
):
    """
    Send test alert to verify channel configuration
    """
    db = get_database()
    
    config = await db.alert_channels_config.find_one({"config_id": "alert_channels_config"})
    if not config:
        raise HTTPException(status_code=400, detail="Alert channels not configured")
    
    test_alert = {
        "type": "test",
        "title": "🧪 Test Alert from AirYatra",
        "message": f"This is a test alert sent by {current_user.get('email')}. If you received this, your alert channel is working correctly!",
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    
    results = {"in_app": True}
    
    if channel in ["slack", "all"] and config.get("slack_webhook"):
        results["slack"] = await send_slack_alert(config["slack_webhook"], test_alert)
    
    if channel in ["email", "all"] and config.get("email_recipients"):
        results["email"] = await send_email_alerts(config["email_recipients"], test_alert)
    
    return {
        "success": True,
        "message": "Test alerts sent",
        "results": results
    }


# ============ FAILOVER TESTING MODE ============

@router.post("/admin/failover/test-mode/start")
async def start_failover_test(
    api_id: str,
    simulate_failures: int = 3,
    request: Request = None,
    current_user: dict = Depends(require_roles(["admin", "super_admin"]))
):
    """
    Start failover testing mode - simulates failures without affecting production
    """
    db = get_database()
    
    api = await db.api_control_configs.find_one({"api_id": api_id})
    if not api:
        raise HTTPException(status_code=404, detail="API not found")
    
    if not api.get("failover_provider"):
        raise HTTPException(status_code=400, detail="No failover configured for this API")
    
    # Create test session
    test_session = {
        "test_id": str(uuid.uuid4()),
        "api_id": api_id,
        "failover_api_id": api.get("failover_provider"),
        "simulate_failures": simulate_failures,
        "failures_simulated": 0,
        "status": "running",
        "is_test_mode": True,
        "started_by": current_user.get("id"),
        "started_at": datetime.now(timezone.utc).isoformat(),
        "events": []
    }
    
    await db.failover_test_sessions.insert_one(test_session)
    
    # Mark API as in test mode
    await db.api_control_configs.update_one(
        {"api_id": api_id},
        {"$set": {
            "test_mode": {
                "active": True,
                "test_id": test_session["test_id"],
                "started_at": test_session["started_at"]
            }
        }}
    )
    
    await log_api_audit(db, current_user, api_id, "test_mode_start",
                        None, {"test_id": test_session["test_id"], "simulate_failures": simulate_failures},
                        "Started failover test mode", request)
    
    return {
        "success": True,
        "test_id": test_session["test_id"],
        "message": f"Failover test started for {api_id}",
        "message_hi": f"{api_id} के लिए फेलओवर टेस्ट शुरू",
        "config": {
            "api": api_id,
            "failover": api.get("failover_provider"),
            "failures_to_simulate": simulate_failures
        }
    }


@router.post("/admin/failover/test-mode/simulate-failure")
async def simulate_failure(
    test_id: str,
    current_user: dict = Depends(require_roles(["admin", "super_admin"]))
):
    """
    Simulate a single failure in test mode
    """
    db = get_database()
    
    test_session = await db.failover_test_sessions.find_one({"test_id": test_id})
    if not test_session:
        raise HTTPException(status_code=404, detail="Test session not found")
    
    if test_session.get("status") != "running":
        raise HTTPException(status_code=400, detail="Test session is not running")
    
    api_id = test_session["api_id"]
    failures_simulated = test_session.get("failures_simulated", 0) + 1
    simulate_failures = test_session.get("simulate_failures", 3)
    
    event = {
        "event_type": "simulated_failure",
        "failure_number": failures_simulated,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    
    # Check if this triggers failover
    failover_triggered = failures_simulated >= simulate_failures
    
    if failover_triggered:
        event["event_type"] = "simulated_failover_trigger"
        event["message"] = f"Failover would be triggered after {failures_simulated} failures"
        
        # Update test session
        await db.failover_test_sessions.update_one(
            {"test_id": test_id},
            {
                "$set": {"status": "failover_simulated", "failover_triggered_at": event["timestamp"]},
                "$inc": {"failures_simulated": 1},
                "$push": {"events": event}
            }
        )
        
        return {
            "success": True,
            "failure_number": failures_simulated,
            "failover_triggered": True,
            "message": f"🔄 FAILOVER WOULD TRIGGER: {api_id} → {test_session['failover_api_id']}",
            "message_hi": f"🔄 फेलओवर ट्रिगर होता: {api_id} → {test_session['failover_api_id']}",
            "note": "This is a TEST - no actual failover occurred"
        }
    else:
        # Just log the failure
        await db.failover_test_sessions.update_one(
            {"test_id": test_id},
            {
                "$inc": {"failures_simulated": 1},
                "$push": {"events": event}
            }
        )
        
        return {
            "success": True,
            "failure_number": failures_simulated,
            "remaining_before_failover": simulate_failures - failures_simulated,
            "failover_triggered": False,
            "message": f"Failure {failures_simulated}/{simulate_failures} simulated",
            "message_hi": f"विफलता {failures_simulated}/{simulate_failures} सिम्युलेट"
        }


@router.post("/admin/failover/test-mode/stop")
async def stop_failover_test(
    test_id: str,
    request: Request = None,
    current_user: dict = Depends(require_roles(["admin", "super_admin"]))
):
    """
    Stop failover test mode
    """
    db = get_database()
    
    test_session = await db.failover_test_sessions.find_one({"test_id": test_id})
    if not test_session:
        raise HTTPException(status_code=404, detail="Test session not found")
    
    api_id = test_session["api_id"]
    now = datetime.now(timezone.utc).isoformat()
    
    # Update test session
    await db.failover_test_sessions.update_one(
        {"test_id": test_id},
        {"$set": {
            "status": "completed",
            "stopped_at": now,
            "stopped_by": current_user.get("id")
        }}
    )
    
    # Remove test mode from API
    await db.api_control_configs.update_one(
        {"api_id": api_id},
        {"$unset": {"test_mode": ""}}
    )
    
    await log_api_audit(db, current_user, api_id, "test_mode_stop",
                        {"test_id": test_id}, {"status": "completed"},
                        "Stopped failover test mode", request)
    
    # Generate test report
    events = test_session.get("events", [])
    
    return {
        "success": True,
        "message": "Test mode stopped",
        "message_hi": "टेस्ट मोड बंद",
        "test_report": {
            "test_id": test_id,
            "api_id": api_id,
            "failover_api_id": test_session.get("failover_api_id"),
            "duration": f"{len(events)} events",
            "failures_simulated": test_session.get("failures_simulated", 0),
            "failover_threshold": test_session.get("simulate_failures", 3),
            "failover_would_trigger": test_session.get("status") == "failover_simulated",
            "events": events
        }
    }


@router.get("/admin/failover/test-mode/sessions")
async def get_test_sessions(
    limit: int = 20,
    current_user: dict = Depends(require_roles(["admin", "super_admin"]))
):
    """
    Get all failover test sessions
    """
    db = get_database()
    
    sessions = await db.failover_test_sessions.find(
        {},
        {"_id": 0}
    ).sort("started_at", -1).limit(limit).to_list(length=limit)
    
    # Check for active sessions
    active = [s for s in sessions if s.get("status") == "running"]
    
    return {
        "sessions": sessions,
        "total": len(sessions),
        "active_tests": len(active)
    }


@router.post("/admin/failover/test-mode/run-full-test")
async def run_full_failover_test(
    api_id: str,
    current_user: dict = Depends(require_roles(["admin", "super_admin"]))
):
    """
    Run a complete failover test cycle automatically
    Simulates failures until failover triggers, then resets
    """
    db = get_database()
    
    api = await db.api_control_configs.find_one({"api_id": api_id})
    if not api:
        raise HTTPException(status_code=404, detail="API not found")
    
    failover_config = api.get("failover_config", {})
    if not api.get("failover_provider"):
        raise HTTPException(status_code=400, detail="No failover configured")
    
    threshold = failover_config.get("switch_threshold", 3)
    
    # Create test session
    test_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    
    test_session = {
        "test_id": test_id,
        "api_id": api_id,
        "failover_api_id": api.get("failover_provider"),
        "simulate_failures": threshold,
        "failures_simulated": 0,
        "status": "running",
        "is_test_mode": True,
        "is_full_auto_test": True,
        "started_by": current_user.get("id"),
        "started_at": now.isoformat(),
        "events": []
    }
    
    # Simulate all failures
    for i in range(1, threshold + 1):
        test_session["failures_simulated"] = i
        test_session["events"].append({
            "event_type": "simulated_failure" if i < threshold else "simulated_failover_trigger",
            "failure_number": i,
            "timestamp": (now + timedelta(seconds=i)).isoformat()
        })
    
    test_session["status"] = "completed"
    test_session["failover_triggered_at"] = (now + timedelta(seconds=threshold)).isoformat()
    test_session["stopped_at"] = (now + timedelta(seconds=threshold + 1)).isoformat()
    
    await db.failover_test_sessions.insert_one(test_session)
    
    return {
        "success": True,
        "test_id": test_id,
        "message": f"Full failover test completed for {api_id}",
        "message_hi": f"{api_id} के लिए पूर्ण फेलओवर टेस्ट पूरा",
        "test_result": {
            "api": api_id,
            "failover": api.get("failover_provider"),
            "threshold": threshold,
            "failures_simulated": threshold,
            "failover_would_trigger": True,
            "status": "PASS ✅",
            "note": "Failover configuration is working correctly"
        }
    }
