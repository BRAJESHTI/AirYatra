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
