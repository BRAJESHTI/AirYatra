"""
Template Management Routes - AirYatra Aviation Platform
Manage SMS, WhatsApp, Email, and Payment notification templates
Features: Scheduling, A/B Testing, Multi-Language, Usage Analytics,
          Auto-Send, Approval Workflow, Version History, AI Suggestions
"""

from fastapi import APIRouter, HTTPException, Depends, Query, BackgroundTasks
from typing import Optional, List, Dict
from datetime import datetime, timezone, timedelta
from pydantic import BaseModel, Field
import uuid
import random
import copy
import hashlib
import os

from database import get_database
from middleware import require_roles

router = APIRouter(prefix="/templates", tags=["Template Management"])

# Try to import AI integration
try:
    from emergentintegrations.llm.chat import chat, Message
    AI_AVAILABLE = True
except ImportError:
    AI_AVAILABLE = False
    print("AI suggestions disabled - emergentintegrations not available")


# ==================== MODELS ====================

# Approval Status
APPROVAL_STATUS = {
    "draft": {"label": "Draft", "color": "gray", "can_activate": False},
    "pending_approval": {"label": "Pending Approval", "color": "yellow", "can_activate": False},
    "approved": {"label": "Approved", "color": "green", "can_activate": True},
    "rejected": {"label": "Rejected", "color": "red", "can_activate": False},
    "changes_requested": {"label": "Changes Requested", "color": "orange", "can_activate": False}
}

class TemplateBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    category: str = Field(..., pattern="^(sms|whatsapp|email|payment)$")
    subject: Optional[str] = None  # For email templates
    content: str = Field(..., min_length=10)
    # Multi-language support
    content_hindi: Optional[str] = None
    content_marathi: Optional[str] = None
    content_gujarati: Optional[str] = None
    content_tamil: Optional[str] = None
    variables: List[str] = []
    trigger_event: Optional[str] = None
    is_active: bool = True
    priority: int = 0
    # Scheduling
    schedule_type: Optional[str] = None  # immediate, before_event, after_event, fixed_time
    schedule_offset: Optional[int] = None  # offset value
    schedule_unit: Optional[str] = None  # minutes, hours, days
    schedule_time: Optional[str] = None  # HH:MM for fixed_time


class TemplateCreate(TemplateBase):
    pass


class TemplateUpdate(BaseModel):
    name: Optional[str] = None
    subject: Optional[str] = None
    content: Optional[str] = None
    content_hindi: Optional[str] = None
    content_marathi: Optional[str] = None
    content_gujarati: Optional[str] = None
    content_tamil: Optional[str] = None
    variables: Optional[List[str]] = None
    trigger_event: Optional[str] = None
    is_active: Optional[bool] = None
    priority: Optional[int] = None
    schedule_type: Optional[str] = None
    schedule_offset: Optional[int] = None
    schedule_unit: Optional[str] = None
    schedule_time: Optional[str] = None


# Supported languages
SUPPORTED_LANGUAGES = [
    {"code": "en", "name": "English", "native": "English", "field": "content"},
    {"code": "hi", "name": "Hindi", "native": "हिंदी", "field": "content_hindi"},
    {"code": "mr", "name": "Marathi", "native": "मराठी", "field": "content_marathi"},
    {"code": "gu", "name": "Gujarati", "native": "ગુજરાતી", "field": "content_gujarati"},
    {"code": "ta", "name": "Tamil", "native": "தமிழ்", "field": "content_tamil"},
]

# Schedule types
SCHEDULE_TYPES = [
    {"id": "immediate", "name": "Send Immediately", "description": "Send as soon as event triggers"},
    {"id": "before_event", "name": "Before Event", "description": "Send X hours/days before event (e.g., flight reminder)"},
    {"id": "after_event", "name": "After Event", "description": "Send X hours/days after event (e.g., feedback request)"},
    {"id": "fixed_time", "name": "Fixed Time", "description": "Send at specific time of day"},
]

# Predefined template variables by category
TEMPLATE_VARIABLES = {
    "common": [
        "{{customer_name}}", "{{customer_email}}", "{{customer_phone}}",
        "{{booking_id}}", "{{booking_date}}", "{{booking_status}}",
        "{{operator_name}}", "{{aircraft_name}}", "{{aircraft_registration}}"
    ],
    "booking": [
        "{{departure_city}}", "{{arrival_city}}", "{{departure_date}}",
        "{{departure_time}}", "{{passenger_count}}", "{{trip_type}}"
    ],
    "payment": [
        "{{amount}}", "{{payment_id}}", "{{payment_status}}", "{{payment_date}}",
        "{{total_amount}}", "{{advance_amount}}", "{{balance_amount}}",
        "{{discount_amount}}", "{{gst_amount}}", "{{voucher_code}}"
    ],
    "complaint": [
        "{{complaint_id}}", "{{complaint_status}}", "{{complaint_category}}",
        "{{resolution_date}}", "{{compensation_amount}}"
    ],
    "discount": [
        "{{discount_code}}", "{{discount_value}}", "{{discount_type}}",
        "{{valid_from}}", "{{valid_until}}", "{{min_booking_amount}}"
    ]
}

# Predefined trigger events
TRIGGER_EVENTS = [
    {"id": "booking_inquiry", "name": "Booking Inquiry Received", "category": ["sms", "whatsapp", "email"]},
    {"id": "booking_confirmed", "name": "Booking Confirmed", "category": ["sms", "whatsapp", "email"]},
    {"id": "booking_cancelled", "name": "Booking Cancelled", "category": ["sms", "whatsapp", "email"]},
    {"id": "payment_pending", "name": "Payment Pending Reminder", "category": ["sms", "whatsapp", "email"]},
    {"id": "payment_success", "name": "Payment Successful", "category": ["sms", "whatsapp", "email", "payment"]},
    {"id": "payment_failed", "name": "Payment Failed", "category": ["sms", "whatsapp", "email"]},
    {"id": "payment_refund", "name": "Refund Processed", "category": ["sms", "whatsapp", "email", "payment"]},
    {"id": "balance_reminder", "name": "Balance Payment Reminder", "category": ["sms", "whatsapp", "email"]},
    {"id": "flight_reminder", "name": "Flight Reminder (24h)", "category": ["sms", "whatsapp", "email"]},
    {"id": "flight_departure", "name": "Flight Departure Alert", "category": ["sms", "whatsapp"]},
    {"id": "complaint_received", "name": "Complaint Received", "category": ["sms", "whatsapp", "email"]},
    {"id": "complaint_resolved", "name": "Complaint Resolved", "category": ["sms", "whatsapp", "email"]},
    {"id": "discount_created", "name": "New Discount Code", "category": ["sms", "whatsapp", "email"]},
    {"id": "discount_expiring", "name": "Discount Expiring Soon", "category": ["sms", "whatsapp", "email"]},
    {"id": "welcome_customer", "name": "Welcome New Customer", "category": ["email"]},
    {"id": "kyc_verified", "name": "KYC Verification Complete", "category": ["sms", "email"]},
    {"id": "document_expiry", "name": "Document Expiry Alert", "category": ["sms", "whatsapp", "email"]},
    {"id": "otp_verification", "name": "OTP Verification", "category": ["sms", "whatsapp"]},
    {"id": "password_reset", "name": "Password Reset", "category": ["email"]},
]


# ==================== ENDPOINTS ====================

@router.get("/variables")
async def get_template_variables():
    """Get all available template variables, languages, schedule types"""
    return {
        "success": True,
        "variables": TEMPLATE_VARIABLES,
        "trigger_events": TRIGGER_EVENTS,
        "languages": SUPPORTED_LANGUAGES,
        "schedule_types": SCHEDULE_TYPES
    }


@router.get("/list")
async def list_templates(
    category: Optional[str] = Query(None, description="sms, whatsapp, email, payment"),
    is_active: Optional[bool] = None,
    search: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(require_roles(["admin", "super_admin"]))
):
    """List all templates with filters"""
    
    db = get_database()
    query = {}
    
    if category:
        query["category"] = category
    
    if is_active is not None:
        query["is_active"] = is_active
    
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"content": {"$regex": search, "$options": "i"}},
            {"trigger_event": {"$regex": search, "$options": "i"}}
        ]
    
    total = await db.notification_templates.count_documents(query)
    
    templates = await db.notification_templates.find(query)\
        .sort([("category", 1), ("priority", -1), ("name", 1)])\
        .skip((page - 1) * limit)\
        .limit(limit)\
        .to_list(limit)
    
    # Serialize
    for t in templates:
        t["_id"] = str(t["_id"])
        # Convert datetime fields
        for field in ["created_at", "updated_at"]:
            if field in t and isinstance(t[field], datetime):
                t[field] = t[field].isoformat()
    
    return {
        "success": True,
        "templates": templates,
        "total": total,
        "page": page,
        "pages": (total + limit - 1) // limit
    }


@router.get("/stats")
async def get_template_stats(
    current_user: dict = Depends(require_roles(["admin", "super_admin"]))
):
    """Get template statistics by category"""
    
    db = get_database()
    
    pipeline = [
        {
            "$group": {
                "_id": "$category",
                "total": {"$sum": 1},
                "active": {"$sum": {"$cond": ["$is_active", 1, 0]}},
                "inactive": {"$sum": {"$cond": ["$is_active", 0, 1]}}
            }
        }
    ]
    
    stats_raw = await db.notification_templates.aggregate(pipeline).to_list(10)
    
    stats = {
        "sms": {"total": 0, "active": 0, "inactive": 0},
        "whatsapp": {"total": 0, "active": 0, "inactive": 0},
        "email": {"total": 0, "active": 0, "inactive": 0},
        "payment": {"total": 0, "active": 0, "inactive": 0}
    }
    
    for s in stats_raw:
        if s["_id"] in stats:
            stats[s["_id"]] = {
                "total": s["total"],
                "active": s["active"],
                "inactive": s["inactive"]
            }
    
    total_all = sum(s["total"] for s in stats.values())
    active_all = sum(s["active"] for s in stats.values())
    
    return {
        "success": True,
        "stats": stats,
        "total": total_all,
        "active": active_all
    }


@router.get("/scheduled")
async def get_scheduled_templates(
    current_user: dict = Depends(require_roles(["admin", "super_admin"]))
):
    """Get all templates with scheduling configured"""
    
    db = get_database()
    
    templates = await db.notification_templates.find({
        "schedule_type": {"$nin": [None, "immediate"]},
        "is_active": True
    }).to_list(100)
    
    for t in templates:
        t["_id"] = str(t["_id"])
        for field in ["created_at", "updated_at", "last_used_at"]:
            if field in t and isinstance(t[field], datetime):
                t[field] = t[field].isoformat()
    
    # Group by schedule type
    grouped = {
        "immediate": [],
        "before_event": [],
        "after_event": [],
        "fixed_time": []
    }
    
    for t in templates:
        schedule_type = t.get("schedule_type", "immediate")
        if schedule_type in grouped:
            grouped[schedule_type].append(t)
    
    return {
        "success": True,
        "scheduled_templates": grouped,
        "total": len(templates)
    }


# ==================== QUEUE ROUTES (Before /{template_id}) ====================

@router.get("/queue/pending")
async def get_pending_notifications_route(
    category: str = None,
    limit: int = Query(50, ge=1, le=200),
    current_user: dict = Depends(require_roles(["admin", "super_admin"]))
):
    """Get pending notifications in queue"""
    
    db = get_database()
    
    query = {"status": "queued"}
    if category:
        query["category"] = category
    
    pending = await db.notification_queue.find(query)\
        .sort("scheduled_time", 1)\
        .limit(limit)\
        .to_list(limit)
    
    for p in pending:
        p["_id"] = str(p["_id"])
        for field in ["scheduled_time", "created_at"]:
            if isinstance(p.get(field), datetime):
                p[field] = p[field].isoformat()
    
    return {
        "success": True,
        "pending": pending,
        "total": len(pending)
    }


@router.get("/queue/history")
async def get_send_history_route(
    template_id: str = None,
    status: str = None,
    days: int = Query(7, ge=1, le=30),
    limit: int = Query(100, ge=1, le=500),
    current_user: dict = Depends(require_roles(["admin", "super_admin"]))
):
    """Get notification send history"""
    
    db = get_database()
    
    query = {
        "created_at": {"$gte": datetime.now(timezone.utc) - timedelta(days=days)}
    }
    if template_id:
        query["template_id"] = template_id
    if status:
        query["status"] = status
    
    history = await db.notification_queue.find(query)\
        .sort("created_at", -1)\
        .limit(limit)\
        .to_list(limit)
    
    for h in history:
        h["_id"] = str(h["_id"])
        for field in ["scheduled_time", "created_at", "sent_at"]:
            if isinstance(h.get(field), datetime):
                h[field] = h[field].isoformat()
    
    # Stats
    stats = {
        "total": len(history),
        "sent": sum(1 for h in history if h.get("status") == "sent"),
        "failed": sum(1 for h in history if h.get("status") == "failed"),
        "queued": sum(1 for h in history if h.get("status") == "queued")
    }
    
    return {
        "success": True,
        "history": history,
        "stats": stats
    }


# ==================== APPROVALS ROUTES (Before /{template_id}) ====================

@router.get("/approvals/pending")
async def get_pending_approvals_route(
    current_user: dict = Depends(require_roles(["admin", "super_admin"]))
):
    """Get all templates pending approval"""
    
    db = get_database()
    
    pending = await db.template_approvals.find(
        {"status": "pending"}
    ).sort("submitted_at", -1).to_list(100)
    
    for p in pending:
        p["_id"] = str(p["_id"])
        if isinstance(p.get("submitted_at"), datetime):
            p["submitted_at"] = p["submitted_at"].isoformat()
    
    return {
        "success": True,
        "pending_approvals": pending,
        "total": len(pending)
    }


# ==================== AI ROUTES (Before /{template_id}) ====================

@router.get("/ai/best-practices")
async def get_best_practices_route(
    category: str = Query("sms", pattern="^(sms|whatsapp|email|payment)$")
):
    """Get best practices for template creation"""
    
    best_practices = {
        "sms": {
            "max_length": 160,
            "tips": [
                "Keep under 160 characters for single SMS",
                "Start with brand name (AirYatra)",
                "Include booking ID for reference",
                "End with contact info or action",
                "Avoid special characters that may not render",
                "Use simple, clear language"
            ],
            "do_not": [
                "Don't use ALL CAPS",
                "Don't include long URLs",
                "Don't use excessive punctuation!!!",
                "Don't send at odd hours"
            ],
            "examples": {
                "good": "AirYatra: Booking {{booking_id}} confirmed! {{departure_city}}→{{arrival_city}} on {{departure_date}}. Query: 1800-AIR-YATRA",
                "bad": "YOUR BOOKING HAS BEEN CONFIRMED!!! CLICK HERE: https://very-long-url.com/booking/details?id=123456789&ref=abc"
            }
        },
        "whatsapp": {
            "max_length": 4096,
            "tips": [
                "Use formatting: *bold*, _italic_, ~strikethrough~",
                "Include emojis for visual appeal",
                "Structure with clear sections",
                "Add interactive buttons if supported",
                "Include images/documents when relevant"
            ],
            "do_not": [
                "Don't send too many messages",
                "Don't use excessive emojis",
                "Don't include sensitive data in media"
            ],
            "examples": {
                "good": "🎉 *Booking Confirmed!*\n\n📋 ID: {{booking_id}}\n✈️ {{departure_city}} → {{arrival_city}}\n📅 {{departure_date}}"
            }
        },
        "email": {
            "max_length": None,
            "tips": [
                "Use responsive HTML design",
                "Include preheader text",
                "Add clear CTA buttons",
                "Include unsubscribe link",
                "Test across email clients",
                "Optimize images for fast loading"
            ],
            "do_not": [
                "Don't use image-only emails",
                "Don't hide important info in images",
                "Don't use too many fonts/colors"
            ]
        },
        "payment": {
            "max_length": None,
            "tips": [
                "Include transaction ID prominently",
                "Show itemized breakdown",
                "Include GST/tax details",
                "Add payment method info",
                "Include support contact"
            ],
            "do_not": [
                "Don't include full card numbers",
                "Don't show CVV or security codes"
            ]
        }
    }
    
    return {
        "success": True,
        "category": category,
        "best_practices": best_practices.get(category, {}),
        "all_categories": list(best_practices.keys())
    }


# ==================== LIBRARY ROUTES (Before /{template_id}) ====================

@router.get("/library/browse")
async def browse_template_library_route(
    category: str = None,
    tag: str = None,
    search: str = None,
    featured_only: bool = False,
    sort_by: str = Query("popularity", pattern="^(popularity|downloads|rating|name)$")
):
    """Browse the template library/marketplace"""
    
    # Pre-built template library
    library = [
        {
            "library_id": "LIB-001",
            "name": "Welcome SMS - Professional",
            "category": "sms",
            "tags": ["welcome", "onboarding", "customer"],
            "description": "Professional welcome message for new customers",
            "content": "Welcome to AirYatra, {{customer_name}}! Your journey to the skies begins now. Book your first helicopter ride. Help: 1800-AIR-YATRA",
            "popularity": 95,
            "downloads": 1250,
            "rating": 4.8,
            "is_featured": True
        },
        {
            "library_id": "LIB-002",
            "name": "Booking Confirmation - Detailed",
            "category": "whatsapp",
            "tags": ["booking", "confirmation"],
            "description": "Comprehensive booking confirmation with all flight details",
            "content": "🎉 *Booking Confirmed!* {{customer_name}}, Booking {{booking_id}} confirmed. {{departure_city}}→{{arrival_city}} on {{departure_date}}",
            "popularity": 98,
            "downloads": 2340,
            "rating": 4.9,
            "is_featured": True
        },
        {
            "library_id": "LIB-003",
            "name": "Payment Receipt - Tax Compliant",
            "category": "email",
            "tags": ["payment", "receipt", "gst"],
            "description": "GST-compliant payment receipt email template",
            "content": "Payment receipt with GST details",
            "popularity": 92,
            "downloads": 1890,
            "rating": 4.7,
            "is_featured": True
        },
        {
            "library_id": "LIB-004",
            "name": "Flight Reminder - 24 Hours",
            "category": "sms",
            "tags": ["reminder", "flight"],
            "description": "Reminder SMS sent 24 hours before flight",
            "content": "✈️ AirYatra Reminder: Your flight {{booking_id}} departs TOMORROW at {{departure_time}} from {{departure_city}}.",
            "popularity": 88,
            "downloads": 1560,
            "rating": 4.6,
            "is_featured": False
        },
        {
            "library_id": "LIB-005",
            "name": "OTP Verification - Secure",
            "category": "sms",
            "tags": ["otp", "security"],
            "description": "Secure OTP message with expiry warning",
            "content": "{{otp}} is your AirYatra OTP. Valid for 10 minutes. DO NOT share with anyone.",
            "popularity": 99,
            "downloads": 3200,
            "rating": 4.9,
            "is_featured": True
        }
    ]
    
    templates = library.copy()
    
    if category:
        templates = [t for t in templates if t["category"] == category]
    if tag:
        templates = [t for t in templates if tag.lower() in [x.lower() for x in t.get("tags", [])]]
    if search:
        search_lower = search.lower()
        templates = [t for t in templates if search_lower in t["name"].lower() or search_lower in t.get("description", "").lower()]
    if featured_only:
        templates = [t for t in templates if t.get("is_featured")]
    
    if sort_by == "popularity":
        templates.sort(key=lambda x: x.get("popularity", 0), reverse=True)
    elif sort_by == "downloads":
        templates.sort(key=lambda x: x.get("downloads", 0), reverse=True)
    elif sort_by == "rating":
        templates.sort(key=lambda x: x.get("rating", 0), reverse=True)
    
    all_tags = set()
    for t in library:
        all_tags.update(t.get("tags", []))
    
    return {
        "success": True,
        "templates": templates,
        "total": len(templates),
        "filters": {
            "categories": ["sms", "whatsapp", "email", "payment"],
            "tags": sorted(list(all_tags))
        }
    }


# ==================== ALERTS ROUTES (Before /{template_id}) ====================

@router.get("/alerts/list")
async def list_alerts_route(
    template_id: str = None,
    is_active: bool = None,
    current_user: dict = Depends(require_roles(["admin", "super_admin"]))
):
    """List all configured alerts"""
    
    db = get_database()
    
    query = {}
    if template_id:
        query["template_id"] = template_id
    if is_active is not None:
        query["is_active"] = is_active
    
    alerts = await db.template_alerts.find(query).sort("created_at", -1).to_list(100)
    
    for a in alerts:
        a["_id"] = str(a["_id"])
        for field in ["created_at", "updated_at", "last_triggered_at"]:
            if isinstance(a.get(field), datetime):
                a[field] = a[field].isoformat()
        
        if a.get("template_id"):
            template = await db.notification_templates.find_one({"template_id": a["template_id"]}, {"name": 1})
            a["template_name"] = template.get("name") if template else "Unknown"
        else:
            a["template_name"] = "All Templates (Global)"
    
    return {"success": True, "alerts": alerts, "total": len(alerts)}


@router.get("/alerts/history")
async def get_alert_history_route(
    alert_id: str = None,
    days: int = Query(7, ge=1, le=30),
    current_user: dict = Depends(require_roles(["admin", "super_admin"]))
):
    """Get alert trigger history"""
    
    db = get_database()
    
    query = {"triggered_at": {"$gte": datetime.now(timezone.utc) - timedelta(days=days)}}
    if alert_id:
        query["alert_id"] = alert_id
    
    history = await db.alert_history.find(query).sort("triggered_at", -1).to_list(200)
    
    for h in history:
        h["_id"] = str(h["_id"])
        if isinstance(h.get("triggered_at"), datetime):
            h["triggered_at"] = h["triggered_at"].isoformat()
    
    return {"success": True, "history": history, "total": len(history)}


# ==================== DELIVERY REPORTS ROUTE (Before /{template_id}) ====================

@router.get("/delivery-reports")
async def get_delivery_reports_route(
    status: str = None,
    provider: str = None,
    days: int = Query(7, ge=1, le=30),
    limit: int = Query(100, ge=1, le=500),
    current_user: dict = Depends(require_roles(["admin", "super_admin"]))
):
    """Get delivery reports with filters"""
    
    db = get_database()
    
    query = {"received_at": {"$gte": datetime.now(timezone.utc) - timedelta(days=days)}}
    if status:
        query["status"] = status
    if provider:
        query["provider"] = provider
    
    reports = await db.delivery_reports.find(query).sort("received_at", -1).limit(limit).to_list(limit)
    
    for r in reports:
        r["_id"] = str(r["_id"])
        if isinstance(r.get("received_at"), datetime):
            r["received_at"] = r["received_at"].isoformat()
    
    pipeline = [{"$match": query}, {"$group": {"_id": "$status", "count": {"$sum": 1}}}]
    stats_raw = await db.delivery_reports.aggregate(pipeline).to_list(20)
    stats = {s["_id"]: s["count"] for s in stats_raw}
    total = sum(stats.values())
    
    return {
        "success": True,
        "reports": reports,
        "stats": {
            "total": total,
            "delivered": stats.get("delivered", 0),
            "opened": stats.get("opened", 0),
            "failed": stats.get("failed", 0),
            "delivery_rate": round((stats.get("delivered", 0) / total * 100) if total > 0 else 0, 2)
        }
    }


@router.get("/{template_id}")
async def get_template(
    template_id: str,
    current_user: dict = Depends(require_roles(["admin", "super_admin"]))
):
    """Get a single template by ID"""
    
    db = get_database()
    
    template = await db.notification_templates.find_one({"template_id": template_id})
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    template["_id"] = str(template["_id"])
    for field in ["created_at", "updated_at"]:
        if field in template and isinstance(template[field], datetime):
            template[field] = template[field].isoformat()
    
    return {"success": True, "template": template}


@router.post("/create")
async def create_template(
    template: TemplateCreate,
    current_user: dict = Depends(require_roles(["admin", "super_admin"]))
):
    """Create a new notification template"""
    
    db = get_database()
    
    # Check for duplicate name in same category
    existing = await db.notification_templates.find_one({
        "name": template.name,
        "category": template.category
    })
    if existing:
        raise HTTPException(
            status_code=400, 
            detail=f"Template '{template.name}' already exists in {template.category} category"
        )
    
    template_doc = {
        "template_id": f"TPL-{uuid.uuid4().hex[:8].upper()}",
        "name": template.name,
        "category": template.category,
        "subject": template.subject,
        "content": template.content,
        "content_hindi": template.content_hindi,
        "content_marathi": template.content_marathi,
        "content_gujarati": template.content_gujarati,
        "content_tamil": template.content_tamil,
        "variables": template.variables,
        "trigger_event": template.trigger_event,
        "is_active": template.is_active,
        "priority": template.priority,
        "schedule_type": template.schedule_type,
        "schedule_offset": template.schedule_offset,
        "schedule_unit": template.schedule_unit,
        "schedule_time": template.schedule_time,
        "usage_count": 0,
        "usage_history": [],
        "ab_stats": {
            "sent_count": 0,
            "delivered_count": 0,
            "opened_count": 0,
            "clicked_count": 0,
            "converted_count": 0
        },
        "last_used_at": None,
        "created_by": current_user.get("id"),
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }
    
    await db.notification_templates.insert_one(template_doc)
    template_doc["_id"] = str(template_doc["_id"])
    
    return {
        "success": True,
        "template": template_doc,
        "message": f"Template '{template.name}' created successfully"
    }


@router.put("/{template_id}")
async def update_template(
    template_id: str,
    updates: TemplateUpdate,
    current_user: dict = Depends(require_roles(["admin", "super_admin"]))
):
    """Update an existing template"""
    
    db = get_database()
    
    template = await db.notification_templates.find_one({"template_id": template_id})
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    update_data = {k: v for k, v in updates.dict().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc)
    update_data["updated_by"] = current_user.get("id")
    
    await db.notification_templates.update_one(
        {"template_id": template_id},
        {"$set": update_data}
    )
    
    return {
        "success": True,
        "message": f"Template updated successfully"
    }


@router.patch("/{template_id}/toggle")
async def toggle_template_status(
    template_id: str,
    current_user: dict = Depends(require_roles(["admin", "super_admin"]))
):
    """Toggle template active/inactive status"""
    
    db = get_database()
    
    template = await db.notification_templates.find_one({"template_id": template_id})
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    new_status = not template.get("is_active", True)
    
    await db.notification_templates.update_one(
        {"template_id": template_id},
        {"$set": {
            "is_active": new_status,
            "updated_at": datetime.now(timezone.utc),
            "updated_by": current_user.get("id")
        }}
    )
    
    status_text = "activated" if new_status else "deactivated"
    return {
        "success": True,
        "is_active": new_status,
        "message": f"Template {status_text} successfully"
    }


@router.delete("/{template_id}")
async def delete_template(
    template_id: str,
    current_user: dict = Depends(require_roles(["admin", "super_admin"]))
):
    """Delete a template"""
    
    db = get_database()
    
    result = await db.notification_templates.delete_one({"template_id": template_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Template not found")
    
    return {"success": True, "message": "Template deleted successfully"}


@router.post("/preview")
async def preview_template(
    template_id: str,
    sample_data: dict = None,
    current_user: dict = Depends(require_roles(["admin", "super_admin"]))
):
    """Preview template with sample data"""
    
    db = get_database()
    
    template = await db.notification_templates.find_one({"template_id": template_id})
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    # Default sample data
    default_data = {
        "customer_name": "Rahul Sharma",
        "customer_email": "rahul@example.com",
        "customer_phone": "+91 98765 43210",
        "booking_id": "AIR2025-12345",
        "booking_date": "15 Aug 2026",
        "booking_status": "Confirmed",
        "departure_city": "Mumbai",
        "arrival_city": "Shirdi",
        "departure_date": "20 Aug 2026",
        "departure_time": "09:30 AM",
        "passenger_count": "4",
        "amount": "₹85,000",
        "total_amount": "₹1,00,000",
        "advance_amount": "₹50,000",
        "balance_amount": "₹50,000",
        "payment_id": "PAY-789456",
        "payment_status": "Success",
        "discount_code": "SUMMER20",
        "discount_value": "20%",
        "operator_name": "BlueSky Aviation",
        "aircraft_name": "Bell 407",
        "complaint_id": "CMP-2026-001"
    }
    
    # Merge with provided sample data
    if sample_data:
        default_data.update(sample_data)
    
    # Replace variables in content
    content = template.get("content", "")
    subject = template.get("subject", "")
    
    for key, value in default_data.items():
        placeholder = "{{" + key + "}}"
        content = content.replace(placeholder, str(value))
        if subject:
            subject = subject.replace(placeholder, str(value))
    
    return {
        "success": True,
        "preview": {
            "subject": subject,
            "content": content,
            "category": template.get("category"),
            "name": template.get("name")
        }
    }


@router.post("/duplicate/{template_id}")
async def duplicate_template(
    template_id: str,
    new_name: str = Query(..., min_length=2),
    current_user: dict = Depends(require_roles(["admin", "super_admin"]))
):
    """Duplicate an existing template"""
    
    db = get_database()
    
    template = await db.notification_templates.find_one({"template_id": template_id})
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    # Check if new name exists
    existing = await db.notification_templates.find_one({
        "name": new_name,
        "category": template["category"]
    })
    if existing:
        raise HTTPException(status_code=400, detail=f"Template '{new_name}' already exists")
    
    new_template = {
        "template_id": f"TPL-{uuid.uuid4().hex[:8].upper()}",
        "name": new_name,
        "category": template["category"],
        "subject": template.get("subject"),
        "content": template["content"],
        "content_hindi": template.get("content_hindi"),
        "variables": template.get("variables", []),
        "trigger_event": template.get("trigger_event"),
        "is_active": False,  # Duplicates start inactive
        "priority": template.get("priority", 0),
        "usage_count": 0,
        "last_used_at": None,
        "created_by": current_user.get("id"),
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }
    
    await db.notification_templates.insert_one(new_template)
    new_template["_id"] = str(new_template["_id"])
    
    return {
        "success": True,
        "template": new_template,
        "message": f"Template duplicated as '{new_name}'"
    }


@router.post("/seed-defaults")
async def seed_default_templates(
    current_user: dict = Depends(require_roles(["admin", "super_admin"]))
):
    """Seed default notification templates"""
    
    db = get_database()
    
    default_templates = [
        # SMS Templates
        {
            "name": "Booking Confirmation SMS",
            "category": "sms",
            "content": "🎉 AirYatra: Your booking {{booking_id}} is confirmed! {{departure_city}} → {{arrival_city}} on {{departure_date}} at {{departure_time}}. For queries: 1800-AIR-YATRA",
            "content_hindi": "🎉 AirYatra: आपकी बुकिंग {{booking_id}} कन्फर्म है! {{departure_city}} → {{arrival_city}}, {{departure_date}} को {{departure_time}} बजे। सवाल के लिए: 1800-AIR-YATRA",
            "variables": ["booking_id", "departure_city", "arrival_city", "departure_date", "departure_time"],
            "trigger_event": "booking_confirmed",
            "is_active": True,
            "priority": 10
        },
        {
            "name": "Payment Success SMS",
            "category": "sms",
            "content": "✅ AirYatra: Payment of {{amount}} received for booking {{booking_id}}. Thank you! Balance: {{balance_amount}}",
            "content_hindi": "✅ AirYatra: {{amount}} का भुगतान {{booking_id}} के लिए प्राप्त। धन्यवाद! शेष: {{balance_amount}}",
            "variables": ["amount", "booking_id", "balance_amount"],
            "trigger_event": "payment_success",
            "is_active": True,
            "priority": 10
        },
        {
            "name": "OTP Verification SMS",
            "category": "sms",
            "content": "{{otp}} is your AirYatra verification code. Valid for 10 minutes. Do not share with anyone.",
            "content_hindi": "{{otp}} आपका AirYatra सत्यापन कोड है। 10 मिनट के लिए वैध। किसी के साथ साझा न करें।",
            "variables": ["otp"],
            "trigger_event": "otp_verification",
            "is_active": True,
            "priority": 20
        },
        {
            "name": "Flight Reminder SMS",
            "category": "sms",
            "content": "✈️ AirYatra Reminder: Your flight {{booking_id}} departs tomorrow at {{departure_time}} from {{departure_city}}. Be at helipad 30 mins early.",
            "variables": ["booking_id", "departure_time", "departure_city"],
            "trigger_event": "flight_reminder",
            "is_active": True,
            "priority": 10
        },
        
        # WhatsApp Templates
        {
            "name": "Booking Confirmation WhatsApp",
            "category": "whatsapp",
            "content": """🎉 *Booking Confirmed!*

Dear {{customer_name}},

Your AirYatra booking is confirmed:

📋 *Booking ID:* {{booking_id}}
✈️ *Route:* {{departure_city}} → {{arrival_city}}
📅 *Date:* {{departure_date}}
⏰ *Time:* {{departure_time}}
👥 *Passengers:* {{passenger_count}}
🚁 *Aircraft:* {{aircraft_name}}

💰 *Total:* {{total_amount}}
✅ *Paid:* {{advance_amount}}
⏳ *Balance:* {{balance_amount}}

For any queries, reply to this message.

Safe travels! 🙏
*Team AirYatra*""",
            "variables": ["customer_name", "booking_id", "departure_city", "arrival_city", "departure_date", "departure_time", "passenger_count", "aircraft_name", "total_amount", "advance_amount", "balance_amount"],
            "trigger_event": "booking_confirmed",
            "is_active": True,
            "priority": 10
        },
        {
            "name": "Payment Reminder WhatsApp",
            "category": "whatsapp",
            "content": """⚠️ *Payment Reminder*

Dear {{customer_name}},

Your balance payment of *{{balance_amount}}* for booking {{booking_id}} is pending.

📅 Flight Date: {{departure_date}}
✈️ Route: {{departure_city}} → {{arrival_city}}

💳 Pay now: {{payment_link}}

Ignore if already paid.

*Team AirYatra*""",
            "variables": ["customer_name", "balance_amount", "booking_id", "departure_date", "departure_city", "arrival_city", "payment_link"],
            "trigger_event": "balance_reminder",
            "is_active": True,
            "priority": 10
        },
        {
            "name": "Complaint Resolution WhatsApp",
            "category": "whatsapp",
            "content": """✅ *Complaint Resolved*

Dear {{customer_name}},

Your complaint {{complaint_id}} has been resolved.

*Category:* {{complaint_category}}
*Resolution:* {{resolution_summary}}
*Compensation:* {{compensation_amount}}

Thank you for your patience. Your feedback helps us improve.

Rate your experience: ⭐⭐⭐⭐⭐

*Team AirYatra*""",
            "variables": ["customer_name", "complaint_id", "complaint_category", "resolution_summary", "compensation_amount"],
            "trigger_event": "complaint_resolved",
            "is_active": True,
            "priority": 10
        },
        {
            "name": "Discount Code WhatsApp",
            "category": "whatsapp",
            "content": """🎁 *Special Offer for You!*

Dear {{customer_name}},

Use code *{{discount_code}}* to get *{{discount_value}}* off on your next booking!

📅 Valid till: {{valid_until}}
💰 Min booking: {{min_booking_amount}}

Book now: https://airyatra.com/booking

T&C apply.

*Team AirYatra*""",
            "variables": ["customer_name", "discount_code", "discount_value", "valid_until", "min_booking_amount"],
            "trigger_event": "discount_created",
            "is_active": True,
            "priority": 5
        },
        
        # Email Templates
        {
            "name": "Booking Confirmation Email",
            "category": "email",
            "subject": "✈️ Booking Confirmed - {{booking_id}} | AirYatra",
            "content": """<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #f97316, #ea580c); padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .header h1 { color: white; margin: 0; font-size: 28px; }
        .content { background: #fff; padding: 30px; border: 1px solid #e5e7eb; }
        .booking-card { background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
        .label { color: #64748b; }
        .value { font-weight: 600; color: #1e293b; }
        .amount-section { background: #fef3c7; padding: 15px; border-radius: 8px; margin-top: 20px; }
        .cta-button { display: inline-block; background: #f97316; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin-top: 20px; }
        .footer { text-align: center; padding: 20px; color: #64748b; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>✈️ Booking Confirmed!</h1>
        </div>
        <div class="content">
            <p>Dear <strong>{{customer_name}}</strong>,</p>
            <p>Great news! Your AirYatra booking has been confirmed. Here are your flight details:</p>
            
            <div class="booking-card">
                <div class="detail-row">
                    <span class="label">Booking ID</span>
                    <span class="value">{{booking_id}}</span>
                </div>
                <div class="detail-row">
                    <span class="label">Route</span>
                    <span class="value">{{departure_city}} → {{arrival_city}}</span>
                </div>
                <div class="detail-row">
                    <span class="label">Date & Time</span>
                    <span class="value">{{departure_date}} at {{departure_time}}</span>
                </div>
                <div class="detail-row">
                    <span class="label">Passengers</span>
                    <span class="value">{{passenger_count}}</span>
                </div>
                <div class="detail-row">
                    <span class="label">Aircraft</span>
                    <span class="value">{{aircraft_name}}</span>
                </div>
            </div>
            
            <div class="amount-section">
                <div class="detail-row">
                    <span class="label">Total Amount</span>
                    <span class="value">{{total_amount}}</span>
                </div>
                <div class="detail-row">
                    <span class="label">Advance Paid</span>
                    <span class="value" style="color: #16a34a;">{{advance_amount}}</span>
                </div>
                <div class="detail-row" style="border: none;">
                    <span class="label">Balance Due</span>
                    <span class="value" style="color: #ea580c;">{{balance_amount}}</span>
                </div>
            </div>
            
            <center>
                <a href="{{booking_link}}" class="cta-button">View Booking Details</a>
            </center>
            
            <p style="margin-top: 30px;">For any queries, contact us at <a href="mailto:support@airyatra.com">support@airyatra.com</a> or call 1800-AIR-YATRA.</p>
            
            <p>Safe travels! 🙏</p>
            <p><strong>Team AirYatra</strong></p>
        </div>
        <div class="footer">
            <p>© 2026 AirYatra Aviation Pvt. Ltd. All rights reserved.</p>
            <p>This is an automated email. Please do not reply directly.</p>
        </div>
    </div>
</body>
</html>""",
            "variables": ["customer_name", "booking_id", "departure_city", "arrival_city", "departure_date", "departure_time", "passenger_count", "aircraft_name", "total_amount", "advance_amount", "balance_amount", "booking_link"],
            "trigger_event": "booking_confirmed",
            "is_active": True,
            "priority": 10
        },
        {
            "name": "Complaint Resolution Email",
            "category": "email",
            "subject": "✅ Complaint {{complaint_id}} Resolved | AirYatra",
            "content": """<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #22c55e, #16a34a); padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .header h1 { color: white; margin: 0; }
        .content { background: #fff; padding: 30px; border: 1px solid #e5e7eb; }
        .resolution-card { background: #f0fdf4; padding: 20px; border-radius: 8px; border-left: 4px solid #22c55e; margin: 20px 0; }
        .compensation { background: #fef3c7; padding: 15px; border-radius: 8px; text-align: center; margin: 20px 0; }
        .footer { text-align: center; padding: 20px; color: #64748b; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>✅ Complaint Resolved</h1>
        </div>
        <div class="content">
            <p>Dear <strong>{{customer_name}}</strong>,</p>
            <p>Your complaint has been reviewed and resolved. We sincerely apologize for any inconvenience caused.</p>
            
            <div class="resolution-card">
                <p><strong>Complaint ID:</strong> {{complaint_id}}</p>
                <p><strong>Category:</strong> {{complaint_category}}</p>
                <p><strong>Resolution:</strong> {{resolution_summary}}</p>
            </div>
            
            <div class="compensation">
                <p style="margin: 0; color: #92400e;"><strong>Compensation Credited: {{compensation_amount}}</strong></p>
            </div>
            
            <p>Your feedback helps us improve our services. We hope to serve you better in your future journeys.</p>
            
            <p>Warm regards,<br><strong>Team AirYatra</strong></p>
        </div>
        <div class="footer">
            <p>© 2026 AirYatra Aviation Pvt. Ltd.</p>
        </div>
    </div>
</body>
</html>""",
            "variables": ["customer_name", "complaint_id", "complaint_category", "resolution_summary", "compensation_amount"],
            "trigger_event": "complaint_resolved",
            "is_active": True,
            "priority": 10
        },
        {
            "name": "Discount Code Announcement Email",
            "category": "email",
            "subject": "🎁 Exclusive {{discount_value}} Off - Use Code {{discount_code}} | AirYatra",
            "content": """<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; }
        .container { max-width: 600px; margin: 0 auto; }
        .header { background: linear-gradient(135deg, #f97316, #dc2626); padding: 40px; text-align: center; }
        .header h1 { color: white; font-size: 32px; margin: 0; }
        .discount-box { background: #fef3c7; border: 3px dashed #f97316; padding: 30px; margin: 30px; text-align: center; border-radius: 10px; }
        .code { font-size: 36px; font-weight: bold; color: #ea580c; letter-spacing: 4px; }
        .value { font-size: 24px; color: #16a34a; margin-top: 10px; }
        .content { padding: 20px 30px; }
        .cta-button { display: inline-block; background: #f97316; color: white; padding: 15px 40px; text-decoration: none; border-radius: 8px; font-size: 18px; }
        .terms { font-size: 12px; color: #64748b; padding: 20px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎁 Special Offer!</h1>
        </div>
        
        <div class="discount-box">
            <div class="code">{{discount_code}}</div>
            <div class="value">Get {{discount_value}} OFF</div>
        </div>
        
        <div class="content">
            <p>Dear {{customer_name}},</p>
            <p>We have an exclusive offer just for you! Use the code above on your next helicopter booking.</p>
            
            <p><strong>📅 Valid Until:</strong> {{valid_until}}<br>
            <strong>💰 Min Booking:</strong> {{min_booking_amount}}</p>
            
            <center>
                <a href="https://airyatra.com/booking" class="cta-button">Book Now ✈️</a>
            </center>
        </div>
        
        <div class="terms">
            <p>*Terms & Conditions apply. Cannot be combined with other offers.</p>
        </div>
    </div>
</body>
</html>""",
            "variables": ["customer_name", "discount_code", "discount_value", "valid_until", "min_booking_amount"],
            "trigger_event": "discount_created",
            "is_active": True,
            "priority": 5
        },
        
        # Payment Templates
        {
            "name": "Payment Receipt",
            "category": "payment",
            "subject": "Payment Receipt - {{payment_id}} | AirYatra",
            "content": """<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; }
        .receipt { max-width: 500px; margin: 0 auto; border: 1px solid #e5e7eb; }
        .header { background: #1e293b; color: white; padding: 20px; text-align: center; }
        .header img { height: 40px; }
        .success-badge { background: #22c55e; color: white; padding: 10px 20px; display: inline-block; border-radius: 20px; margin: 20px 0; }
        .content { padding: 20px; }
        .row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #f1f5f9; }
        .total { background: #f8fafc; padding: 15px; font-size: 18px; font-weight: bold; }
        .footer { text-align: center; padding: 15px; background: #f1f5f9; font-size: 12px; color: #64748b; }
    </style>
</head>
<body>
    <div class="receipt">
        <div class="header">
            <h2>✈️ AirYatra</h2>
            <div class="success-badge">✓ Payment Successful</div>
        </div>
        
        <div class="content">
            <div class="row">
                <span>Receipt No</span>
                <strong>{{payment_id}}</strong>
            </div>
            <div class="row">
                <span>Booking ID</span>
                <strong>{{booking_id}}</strong>
            </div>
            <div class="row">
                <span>Date</span>
                <span>{{payment_date}}</span>
            </div>
            <div class="row">
                <span>Payment Type</span>
                <span>{{payment_type}}</span>
            </div>
            <div class="row">
                <span>Amount</span>
                <span>{{amount}}</span>
            </div>
            <div class="row">
                <span>GST (18%)</span>
                <span>{{gst_amount}}</span>
            </div>
            
            <div class="total">
                <div class="row" style="border: none;">
                    <span>Total Paid</span>
                    <span style="color: #22c55e;">{{total_paid}}</span>
                </div>
            </div>
        </div>
        
        <div class="footer">
            <p>Thank you for flying with AirYatra!</p>
            <p>GSTIN: 27AAAAA0000A1Z5</p>
        </div>
    </div>
</body>
</html>""",
            "variables": ["payment_id", "booking_id", "payment_date", "payment_type", "amount", "gst_amount", "total_paid"],
            "trigger_event": "payment_success",
            "is_active": True,
            "priority": 10
        },
        {
            "name": "Refund Confirmation",
            "category": "payment",
            "subject": "Refund Processed - {{payment_id}} | AirYatra",
            "content": """<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; }
        .container { max-width: 500px; margin: 0 auto; padding: 20px; }
        .header { background: #3b82f6; color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #fff; padding: 20px; border: 1px solid #e5e7eb; }
        .refund-box { background: #eff6ff; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0; }
        .amount { font-size: 28px; color: #3b82f6; font-weight: bold; }
        .row { display: flex; justify-content: space-between; padding: 10px 0; }
        .note { background: #fef3c7; padding: 15px; border-radius: 8px; font-size: 14px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2>💰 Refund Processed</h2>
        </div>
        <div class="content">
            <p>Dear {{customer_name}},</p>
            <p>Your refund has been processed successfully.</p>
            
            <div class="refund-box">
                <div class="amount">{{refund_amount}}</div>
                <p>Refund Amount</p>
            </div>
            
            <div class="row">
                <span>Original Booking</span>
                <strong>{{booking_id}}</strong>
            </div>
            <div class="row">
                <span>Refund ID</span>
                <strong>{{payment_id}}</strong>
            </div>
            <div class="row">
                <span>Processing Date</span>
                <span>{{payment_date}}</span>
            </div>
            
            <div class="note">
                <strong>Note:</strong> Refund will be credited to your original payment method within 5-7 business days.
            </div>
            
            <p style="margin-top: 20px;">Thank you for your patience.</p>
            <p><strong>Team AirYatra</strong></p>
        </div>
    </div>
</body>
</html>""",
            "variables": ["customer_name", "refund_amount", "booking_id", "payment_id", "payment_date"],
            "trigger_event": "payment_refund",
            "is_active": True,
            "priority": 10
        }
    ]
    
    created_count = 0
    skipped_count = 0
    
    for template in default_templates:
        existing = await db.notification_templates.find_one({
            "name": template["name"],
            "category": template["category"]
        })
        
        if existing:
            skipped_count += 1
            continue
        
        template["template_id"] = f"TPL-{uuid.uuid4().hex[:8].upper()}"
        template["usage_count"] = 0
        template["last_used_at"] = None
        template["created_by"] = current_user.get("id")
        template["created_at"] = datetime.now(timezone.utc)
        template["updated_at"] = datetime.now(timezone.utc)
        
        await db.notification_templates.insert_one(template)
        created_count += 1
    
    return {
        "success": True,
        "message": f"Seeded {created_count} templates, skipped {skipped_count} existing",
        "created": created_count,
        "skipped": skipped_count
    }



# ==================== A/B TESTING ENDPOINTS ====================

@router.post("/{template_id}/create-variant")
async def create_ab_variant(
    template_id: str,
    variant_name: str = Query(..., min_length=2),
    current_user: dict = Depends(require_roles(["admin", "super_admin"]))
):
    """Create an A/B test variant of an existing template"""
    
    db = get_database()
    
    # Get original template
    original = await db.notification_templates.find_one({"template_id": template_id})
    if not original:
        raise HTTPException(status_code=404, detail="Original template not found")
    
    if original.get("is_variant"):
        raise HTTPException(status_code=400, detail="Cannot create variant of a variant")
    
    # Create variant
    variant = {
        "template_id": f"TPL-{uuid.uuid4().hex[:8].upper()}",
        "name": variant_name,
        "category": original["category"],
        "subject": original.get("subject"),
        "content": original["content"],
        "content_hindi": original.get("content_hindi"),
        "content_marathi": original.get("content_marathi"),
        "content_gujarati": original.get("content_gujarati"),
        "content_tamil": original.get("content_tamil"),
        "variables": original.get("variables", []),
        "trigger_event": original.get("trigger_event"),
        "is_active": False,  # Variant starts inactive
        "priority": original.get("priority", 0),
        "schedule_type": original.get("schedule_type"),
        "schedule_offset": original.get("schedule_offset"),
        "schedule_unit": original.get("schedule_unit"),
        "schedule_time": original.get("schedule_time"),
        # A/B Test fields
        "is_variant": True,
        "parent_template_id": template_id,
        "ab_test_active": False,
        "ab_test_percentage": 50,  # 50% traffic to variant
        "ab_stats": {
            "sent_count": 0,
            "delivered_count": 0,
            "opened_count": 0,
            "clicked_count": 0,
            "converted_count": 0
        },
        "usage_count": 0,
        "usage_history": [],
        "last_used_at": None,
        "created_by": current_user.get("id"),
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }
    
    await db.notification_templates.insert_one(variant)
    
    # Update original to mark it has variants
    await db.notification_templates.update_one(
        {"template_id": template_id},
        {"$set": {
            "has_variants": True,
            "updated_at": datetime.now(timezone.utc)
        }}
    )
    
    variant["_id"] = str(variant["_id"])
    
    return {
        "success": True,
        "variant": variant,
        "message": f"A/B variant '{variant_name}' created"
    }


@router.get("/{template_id}/variants")
async def get_template_variants(
    template_id: str,
    current_user: dict = Depends(require_roles(["admin", "super_admin"]))
):
    """Get all variants of a template"""
    
    db = get_database()
    
    variants = await db.notification_templates.find({
        "parent_template_id": template_id
    }).to_list(50)
    
    for v in variants:
        v["_id"] = str(v["_id"])
        for field in ["created_at", "updated_at", "last_used_at"]:
            if field in v and isinstance(v[field], datetime):
                v[field] = v[field].isoformat()
    
    return {"success": True, "variants": variants}


@router.patch("/{template_id}/ab-test/toggle")
async def toggle_ab_test(
    template_id: str,
    percentage: int = Query(50, ge=10, le=90),
    current_user: dict = Depends(require_roles(["admin", "super_admin"]))
):
    """Toggle A/B test on/off for a variant"""
    
    db = get_database()
    
    template = await db.notification_templates.find_one({"template_id": template_id})
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    if not template.get("is_variant"):
        raise HTTPException(status_code=400, detail="A/B testing only works on variants")
    
    new_status = not template.get("ab_test_active", False)
    
    await db.notification_templates.update_one(
        {"template_id": template_id},
        {"$set": {
            "ab_test_active": new_status,
            "ab_test_percentage": percentage,
            "is_active": new_status,  # Activate variant when A/B test starts
            "updated_at": datetime.now(timezone.utc)
        }}
    )
    
    status_text = "started" if new_status else "stopped"
    return {
        "success": True,
        "ab_test_active": new_status,
        "percentage": percentage,
        "message": f"A/B test {status_text}"
    }


@router.get("/{template_id}/ab-stats")
async def get_ab_test_stats(
    template_id: str,
    current_user: dict = Depends(require_roles(["admin", "super_admin"]))
):
    """Get A/B test statistics comparing original and variant"""
    
    db = get_database()
    
    # Get original template
    original = await db.notification_templates.find_one({"template_id": template_id})
    if not original:
        raise HTTPException(status_code=404, detail="Template not found")
    
    # Get all variants
    variants = await db.notification_templates.find({
        "parent_template_id": template_id
    }).to_list(10)
    
    def get_stats(template):
        stats = template.get("ab_stats", {})
        sent = stats.get("sent_count", template.get("usage_count", 0))
        delivered = stats.get("delivered_count", sent)
        opened = stats.get("opened_count", 0)
        clicked = stats.get("clicked_count", 0)
        converted = stats.get("converted_count", 0)
        
        return {
            "template_id": template["template_id"],
            "name": template["name"],
            "is_variant": template.get("is_variant", False),
            "ab_test_active": template.get("ab_test_active", False),
            "sent_count": sent,
            "delivered_count": delivered,
            "opened_count": opened,
            "clicked_count": clicked,
            "converted_count": converted,
            "delivery_rate": round((delivered / sent * 100) if sent > 0 else 0, 2),
            "open_rate": round((opened / delivered * 100) if delivered > 0 else 0, 2),
            "click_rate": round((clicked / opened * 100) if opened > 0 else 0, 2),
            "conversion_rate": round((converted / sent * 100) if sent > 0 else 0, 2)
        }
    
    original_stats = get_stats(original)
    variant_stats = [get_stats(v) for v in variants]
    
    # Determine winner
    winner = None
    if variant_stats:
        all_stats = [original_stats] + variant_stats
        best = max(all_stats, key=lambda x: x["conversion_rate"])
        if best["sent_count"] >= 100:  # Minimum sample size
            winner = best["template_id"]
    
    return {
        "success": True,
        "original": original_stats,
        "variants": variant_stats,
        "winner": winner,
        "recommendation": f"Use template {winner}" if winner else "Need more data for recommendation"
    }


# ==================== USAGE ANALYTICS ENDPOINTS ====================

@router.post("/{template_id}/track-usage")
async def track_template_usage(
    template_id: str,
    event_type: str = Query("sent", pattern="^(sent|delivered|opened|clicked|converted)$"),
    language: str = Query("en"),
    metadata: dict = None
):
    """Track template usage for analytics"""
    
    db = get_database()
    
    template = await db.notification_templates.find_one({"template_id": template_id})
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    now = datetime.now(timezone.utc)
    
    # Update usage count
    update_fields = {
        "last_used_at": now,
        "updated_at": now
    }
    
    if event_type == "sent":
        update_fields["usage_count"] = template.get("usage_count", 0) + 1
    
    # Update A/B stats
    ab_stats_field = f"ab_stats.{event_type}_count"
    
    await db.notification_templates.update_one(
        {"template_id": template_id},
        {
            "$set": update_fields,
            "$inc": {ab_stats_field: 1},
            "$push": {
                "usage_history": {
                    "$each": [{
                        "event": event_type,
                        "language": language,
                        "timestamp": now,
                        "metadata": metadata or {}
                    }],
                    "$slice": -1000  # Keep last 1000 events
                }
            }
        }
    )
    
    return {"success": True, "message": "Usage tracked"}


@router.get("/analytics/overview")
async def get_analytics_overview(
    days: int = Query(30, ge=7, le=365),
    current_user: dict = Depends(require_roles(["admin", "super_admin"]))
):
    """Get overall template usage analytics"""
    
    db = get_database()
    
    start_date = datetime.now(timezone.utc) - timedelta(days=days)
    
    # Aggregate usage by category
    pipeline = [
        {
            "$group": {
                "_id": "$category",
                "total_templates": {"$sum": 1},
                "active_templates": {"$sum": {"$cond": ["$is_active", 1, 0]}},
                "total_usage": {"$sum": "$usage_count"},
                "templates": {"$push": {
                    "name": "$name",
                    "usage_count": "$usage_count",
                    "template_id": "$template_id"
                }}
            }
        }
    ]
    
    category_stats = await db.notification_templates.aggregate(pipeline).to_list(10)
    
    # Get top performing templates
    top_templates = await db.notification_templates.find(
        {"usage_count": {"$gt": 0}},
        {"_id": 0, "template_id": 1, "name": 1, "category": 1, "usage_count": 1, "ab_stats": 1}
    ).sort("usage_count", -1).limit(10).to_list(10)
    
    # Get usage trend (mock data for now, would need usage_history aggregation)
    usage_trend = []
    for i in range(days):
        date = (datetime.now(timezone.utc) - timedelta(days=days-i-1)).strftime("%Y-%m-%d")
        usage_trend.append({
            "date": date,
            "sms": random.randint(50, 200),
            "whatsapp": random.randint(30, 150),
            "email": random.randint(20, 100),
            "payment": random.randint(10, 50)
        })
    
    # Language distribution (mock)
    language_stats = {
        "en": {"name": "English", "percentage": 45, "count": 4500},
        "hi": {"name": "Hindi", "percentage": 35, "count": 3500},
        "mr": {"name": "Marathi", "percentage": 10, "count": 1000},
        "gu": {"name": "Gujarati", "percentage": 7, "count": 700},
        "ta": {"name": "Tamil", "percentage": 3, "count": 300}
    }
    
    return {
        "success": True,
        "period_days": days,
        "category_stats": {s["_id"]: s for s in category_stats},
        "top_templates": top_templates,
        "usage_trend": usage_trend,
        "language_stats": language_stats,
        "total_sent": sum(t.get("usage_count", 0) for t in top_templates)
    }


@router.get("/analytics/template/{template_id}")
async def get_template_analytics(
    template_id: str,
    days: int = Query(30, ge=7, le=365),
    current_user: dict = Depends(require_roles(["admin", "super_admin"]))
):
    """Get detailed analytics for a specific template"""
    
    db = get_database()
    
    template = await db.notification_templates.find_one({"template_id": template_id})
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    # Get usage history
    usage_history = template.get("usage_history", [])
    
    # Aggregate by day
    daily_usage = {}
    language_breakdown = {}
    event_breakdown = {}
    
    for event in usage_history:
        ts = event.get("timestamp")
        if isinstance(ts, datetime):
            date_key = ts.strftime("%Y-%m-%d")
            daily_usage[date_key] = daily_usage.get(date_key, 0) + 1
        
        lang = event.get("language", "en")
        language_breakdown[lang] = language_breakdown.get(lang, 0) + 1
        
        evt = event.get("event", "sent")
        event_breakdown[evt] = event_breakdown.get(evt, 0) + 1
    
    # Get A/B stats if available
    ab_stats = template.get("ab_stats", {})
    
    # Performance metrics
    sent = ab_stats.get("sent_count", template.get("usage_count", 0))
    delivered = ab_stats.get("delivered_count", sent)
    opened = ab_stats.get("opened_count", 0)
    clicked = ab_stats.get("clicked_count", 0)
    
    return {
        "success": True,
        "template_id": template_id,
        "name": template["name"],
        "category": template["category"],
        "total_usage": template.get("usage_count", 0),
        "daily_usage": daily_usage,
        "language_breakdown": language_breakdown,
        "event_breakdown": event_breakdown,
        "performance": {
            "sent": sent,
            "delivered": delivered,
            "opened": opened,
            "clicked": clicked,
            "delivery_rate": round((delivered / sent * 100) if sent > 0 else 0, 2),
            "open_rate": round((opened / delivered * 100) if delivered > 0 else 0, 2),
            "click_rate": round((clicked / opened * 100) if opened > 0 else 0, 2)
        },
        "last_used": template.get("last_used_at").isoformat() if template.get("last_used_at") else None
    }


@router.post("/{template_id}/schedule")
async def update_template_schedule(
    template_id: str,
    schedule_type: str = Query(..., pattern="^(immediate|before_event|after_event|fixed_time)$"),
    schedule_offset: int = Query(None, ge=1, le=168),  # Max 168 hours (1 week)
    schedule_unit: str = Query(None, pattern="^(minutes|hours|days)$"),
    schedule_time: str = Query(None, pattern="^[0-2][0-9]:[0-5][0-9]$"),
    current_user: dict = Depends(require_roles(["admin", "super_admin"]))
):
    """Configure scheduling for a template"""
    
    db = get_database()
    
    template = await db.notification_templates.find_one({"template_id": template_id})
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    # Validate schedule configuration
    if schedule_type in ["before_event", "after_event"]:
        if not schedule_offset or not schedule_unit:
            raise HTTPException(
                status_code=400, 
                detail="schedule_offset and schedule_unit required for event-based scheduling"
            )
    
    if schedule_type == "fixed_time" and not schedule_time:
        raise HTTPException(
            status_code=400,
            detail="schedule_time required for fixed_time scheduling"
        )
    
    await db.notification_templates.update_one(
        {"template_id": template_id},
        {"$set": {
            "schedule_type": schedule_type,
            "schedule_offset": schedule_offset,
            "schedule_unit": schedule_unit,
            "schedule_time": schedule_time,
            "updated_at": datetime.now(timezone.utc)
        }}
    )
    
    return {
        "success": True,
        "message": f"Schedule configured: {schedule_type}",
        "schedule": {
            "type": schedule_type,
            "offset": schedule_offset,
            "unit": schedule_unit,
            "time": schedule_time
        }
    }



# ==================== VERSION HISTORY ENDPOINTS ====================

@router.get("/{template_id}/history")
async def get_template_history(
    template_id: str,
    limit: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(require_roles(["admin", "super_admin"]))
):
    """Get version history of a template"""
    
    db = get_database()
    
    template = await db.notification_templates.find_one({"template_id": template_id})
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    # Get version history
    history = await db.template_versions.find(
        {"template_id": template_id}
    ).sort("version", -1).limit(limit).to_list(limit)
    
    for h in history:
        h["_id"] = str(h["_id"])
        if isinstance(h.get("created_at"), datetime):
            h["created_at"] = h["created_at"].isoformat()
    
    return {
        "success": True,
        "template_id": template_id,
        "current_version": template.get("version", 1),
        "history": history,
        "total_versions": len(history)
    }


@router.post("/{template_id}/save-version")
async def save_template_version(
    template_id: str,
    change_note: str = Query(None, max_length=500),
    current_user: dict = Depends(require_roles(["admin", "super_admin"]))
):
    """Manually save current state as a version"""
    
    db = get_database()
    
    template = await db.notification_templates.find_one({"template_id": template_id})
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    # Get current version number
    current_version = template.get("version", 0)
    new_version = current_version + 1
    
    # Create version snapshot
    version_doc = {
        "version_id": f"VER-{uuid.uuid4().hex[:8].upper()}",
        "template_id": template_id,
        "version": new_version,
        "snapshot": {
            "name": template.get("name"),
            "content": template.get("content"),
            "content_hindi": template.get("content_hindi"),
            "content_marathi": template.get("content_marathi"),
            "content_gujarati": template.get("content_gujarati"),
            "content_tamil": template.get("content_tamil"),
            "subject": template.get("subject"),
            "variables": template.get("variables"),
            "trigger_event": template.get("trigger_event"),
            "schedule_type": template.get("schedule_type"),
            "schedule_offset": template.get("schedule_offset"),
            "schedule_unit": template.get("schedule_unit"),
            "priority": template.get("priority")
        },
        "change_note": change_note or "Manual version save",
        "created_by": current_user.get("id"),
        "created_by_email": current_user.get("email"),
        "created_at": datetime.now(timezone.utc)
    }
    
    await db.template_versions.insert_one(version_doc)
    
    # Update template version number
    await db.notification_templates.update_one(
        {"template_id": template_id},
        {"$set": {"version": new_version, "updated_at": datetime.now(timezone.utc)}}
    )
    
    return {
        "success": True,
        "version": new_version,
        "version_id": version_doc["version_id"],
        "message": f"Version {new_version} saved"
    }


@router.post("/{template_id}/rollback/{version}")
async def rollback_template(
    template_id: str,
    version: int,
    current_user: dict = Depends(require_roles(["admin", "super_admin"]))
):
    """Rollback template to a previous version"""
    
    db = get_database()
    
    template = await db.notification_templates.find_one({"template_id": template_id})
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    # Get the version to rollback to
    version_doc = await db.template_versions.find_one({
        "template_id": template_id,
        "version": version
    })
    if not version_doc:
        raise HTTPException(status_code=404, detail=f"Version {version} not found")
    
    # Save current state as new version before rollback
    current_version = template.get("version", 0)
    new_version = current_version + 1
    
    # Save current state
    pre_rollback_doc = {
        "version_id": f"VER-{uuid.uuid4().hex[:8].upper()}",
        "template_id": template_id,
        "version": new_version,
        "snapshot": {
            "name": template.get("name"),
            "content": template.get("content"),
            "content_hindi": template.get("content_hindi"),
            "content_marathi": template.get("content_marathi"),
            "content_gujarati": template.get("content_gujarati"),
            "content_tamil": template.get("content_tamil"),
            "subject": template.get("subject"),
            "variables": template.get("variables"),
            "trigger_event": template.get("trigger_event"),
            "schedule_type": template.get("schedule_type"),
            "schedule_offset": template.get("schedule_offset"),
            "schedule_unit": template.get("schedule_unit"),
            "priority": template.get("priority")
        },
        "change_note": f"Auto-saved before rollback to version {version}",
        "created_by": current_user.get("id"),
        "created_by_email": current_user.get("email"),
        "created_at": datetime.now(timezone.utc)
    }
    await db.template_versions.insert_one(pre_rollback_doc)
    
    # Apply rollback
    snapshot = version_doc.get("snapshot", {})
    
    await db.notification_templates.update_one(
        {"template_id": template_id},
        {"$set": {
            "content": snapshot.get("content"),
            "content_hindi": snapshot.get("content_hindi"),
            "content_marathi": snapshot.get("content_marathi"),
            "content_gujarati": snapshot.get("content_gujarati"),
            "content_tamil": snapshot.get("content_tamil"),
            "subject": snapshot.get("subject"),
            "variables": snapshot.get("variables", []),
            "trigger_event": snapshot.get("trigger_event"),
            "schedule_type": snapshot.get("schedule_type"),
            "schedule_offset": snapshot.get("schedule_offset"),
            "schedule_unit": snapshot.get("schedule_unit"),
            "priority": snapshot.get("priority", 0),
            "version": new_version + 1,
            "rollback_from_version": version,
            "updated_at": datetime.now(timezone.utc),
            "updated_by": current_user.get("id")
        }}
    )
    
    return {
        "success": True,
        "message": f"Rolled back to version {version}",
        "new_version": new_version + 1,
        "rollback_from": version
    }


@router.get("/{template_id}/compare/{version1}/{version2}")
async def compare_versions(
    template_id: str,
    version1: int,
    version2: int,
    current_user: dict = Depends(require_roles(["admin", "super_admin"]))
):
    """Compare two versions of a template"""
    
    db = get_database()
    
    v1 = await db.template_versions.find_one({"template_id": template_id, "version": version1})
    v2 = await db.template_versions.find_one({"template_id": template_id, "version": version2})
    
    if not v1 or not v2:
        raise HTTPException(status_code=404, detail="One or both versions not found")
    
    # Compare snapshots
    s1 = v1.get("snapshot", {})
    s2 = v2.get("snapshot", {})
    
    differences = []
    fields_to_compare = ["content", "content_hindi", "content_marathi", "content_gujarati", 
                         "content_tamil", "subject", "trigger_event", "schedule_type", "priority"]
    
    for field in fields_to_compare:
        val1 = s1.get(field)
        val2 = s2.get(field)
        if val1 != val2:
            differences.append({
                "field": field,
                "version1_value": val1,
                "version2_value": val2
            })
    
    return {
        "success": True,
        "version1": {"version": version1, "created_at": v1.get("created_at"), "note": v1.get("change_note")},
        "version2": {"version": version2, "created_at": v2.get("created_at"), "note": v2.get("change_note")},
        "differences": differences,
        "total_changes": len(differences)
    }


# ==================== APPROVAL WORKFLOW ENDPOINTS ====================

@router.post("/{template_id}/submit-for-approval")
async def submit_for_approval(
    template_id: str,
    note: str = Query(None, max_length=500),
    current_user: dict = Depends(require_roles(["admin", "super_admin"]))
):
    """Submit template for approval"""
    
    db = get_database()
    
    template = await db.notification_templates.find_one({"template_id": template_id})
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    current_status = template.get("approval_status", "draft")
    if current_status == "pending_approval":
        raise HTTPException(status_code=400, detail="Template already pending approval")
    
    # Create approval request
    approval_doc = {
        "approval_id": f"APR-{uuid.uuid4().hex[:8].upper()}",
        "template_id": template_id,
        "template_name": template.get("name"),
        "category": template.get("category"),
        "submitted_by": current_user.get("id"),
        "submitted_by_email": current_user.get("email"),
        "submitted_at": datetime.now(timezone.utc),
        "status": "pending",
        "note": note,
        "content_snapshot": template.get("content")[:200] + "..." if len(template.get("content", "")) > 200 else template.get("content"),
        "reviewed_by": None,
        "reviewed_at": None,
        "review_note": None
    }
    
    await db.template_approvals.insert_one(approval_doc)
    
    # Update template status
    await db.notification_templates.update_one(
        {"template_id": template_id},
        {"$set": {
            "approval_status": "pending_approval",
            "approval_submitted_at": datetime.now(timezone.utc),
            "approval_submitted_by": current_user.get("id"),
            "updated_at": datetime.now(timezone.utc)
        }}
    )
    
    return {
        "success": True,
        "approval_id": approval_doc["approval_id"],
        "message": "Template submitted for approval"
    }


@router.get("/approvals/pending")
async def get_pending_approvals(
    current_user: dict = Depends(require_roles(["admin", "super_admin"]))
):
    """Get all templates pending approval"""
    
    db = get_database()
    
    pending = await db.template_approvals.find(
        {"status": "pending"}
    ).sort("submitted_at", -1).to_list(100)
    
    for p in pending:
        p["_id"] = str(p["_id"])
        if isinstance(p.get("submitted_at"), datetime):
            p["submitted_at"] = p["submitted_at"].isoformat()
    
    return {
        "success": True,
        "pending_approvals": pending,
        "total": len(pending)
    }


@router.post("/{template_id}/approve")
async def approve_template(
    template_id: str,
    note: str = Query(None, max_length=500),
    current_user: dict = Depends(require_roles(["super_admin"]))
):
    """Approve a template (super_admin only)"""
    
    db = get_database()
    
    template = await db.notification_templates.find_one({"template_id": template_id})
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    if template.get("approval_status") != "pending_approval":
        raise HTTPException(status_code=400, detail="Template not pending approval")
    
    # Check maker-checker (approver cannot be submitter)
    if template.get("approval_submitted_by") == current_user.get("id"):
        raise HTTPException(
            status_code=400, 
            detail="Maker-Checker violation: You cannot approve your own submission"
        )
    
    # Update approval record
    await db.template_approvals.update_one(
        {"template_id": template_id, "status": "pending"},
        {"$set": {
            "status": "approved",
            "reviewed_by": current_user.get("id"),
            "reviewed_by_email": current_user.get("email"),
            "reviewed_at": datetime.now(timezone.utc),
            "review_note": note
        }}
    )
    
    # Update template
    await db.notification_templates.update_one(
        {"template_id": template_id},
        {"$set": {
            "approval_status": "approved",
            "approved_by": current_user.get("id"),
            "approved_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        }}
    )
    
    return {
        "success": True,
        "message": "Template approved",
        "can_activate": True
    }


@router.post("/{template_id}/reject")
async def reject_template(
    template_id: str,
    reason: str = Query(..., min_length=10, max_length=500),
    current_user: dict = Depends(require_roles(["super_admin"]))
):
    """Reject a template (super_admin only)"""
    
    db = get_database()
    
    template = await db.notification_templates.find_one({"template_id": template_id})
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    if template.get("approval_status") != "pending_approval":
        raise HTTPException(status_code=400, detail="Template not pending approval")
    
    # Update approval record
    await db.template_approvals.update_one(
        {"template_id": template_id, "status": "pending"},
        {"$set": {
            "status": "rejected",
            "reviewed_by": current_user.get("id"),
            "reviewed_by_email": current_user.get("email"),
            "reviewed_at": datetime.now(timezone.utc),
            "review_note": reason
        }}
    )
    
    # Update template
    await db.notification_templates.update_one(
        {"template_id": template_id},
        {"$set": {
            "approval_status": "rejected",
            "rejection_reason": reason,
            "rejected_by": current_user.get("id"),
            "rejected_at": datetime.now(timezone.utc),
            "is_active": False,  # Deactivate rejected templates
            "updated_at": datetime.now(timezone.utc)
        }}
    )
    
    return {
        "success": True,
        "message": "Template rejected",
        "reason": reason
    }


@router.post("/{template_id}/request-changes")
async def request_changes(
    template_id: str,
    changes: str = Query(..., min_length=10, max_length=1000),
    current_user: dict = Depends(require_roles(["super_admin"]))
):
    """Request changes on a template"""
    
    db = get_database()
    
    template = await db.notification_templates.find_one({"template_id": template_id})
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    # Update approval record
    await db.template_approvals.update_one(
        {"template_id": template_id, "status": "pending"},
        {"$set": {
            "status": "changes_requested",
            "reviewed_by": current_user.get("id"),
            "reviewed_by_email": current_user.get("email"),
            "reviewed_at": datetime.now(timezone.utc),
            "review_note": changes
        }}
    )
    
    # Update template
    await db.notification_templates.update_one(
        {"template_id": template_id},
        {"$set": {
            "approval_status": "changes_requested",
            "requested_changes": changes,
            "changes_requested_by": current_user.get("id"),
            "changes_requested_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        }}
    )
    
    return {
        "success": True,
        "message": "Changes requested",
        "requested_changes": changes
    }


@router.get("/{template_id}/approval-history")
async def get_approval_history(
    template_id: str,
    current_user: dict = Depends(require_roles(["admin", "super_admin"]))
):
    """Get approval history for a template"""
    
    db = get_database()
    
    history = await db.template_approvals.find(
        {"template_id": template_id}
    ).sort("submitted_at", -1).to_list(50)
    
    for h in history:
        h["_id"] = str(h["_id"])
        for field in ["submitted_at", "reviewed_at"]:
            if isinstance(h.get(field), datetime):
                h[field] = h[field].isoformat()
    
    return {
        "success": True,
        "template_id": template_id,
        "history": history
    }


# ==================== AUTO-SEND / NOTIFICATION QUEUE ENDPOINTS ====================

@router.post("/{template_id}/queue-notification")
async def queue_notification(
    template_id: str,
    recipient_data: dict,
    scheduled_time: datetime = None,
    language: str = Query("en"),
    current_user: dict = Depends(require_roles(["admin", "super_admin"]))
):
    """Queue a notification to be sent"""
    
    db = get_database()
    
    template = await db.notification_templates.find_one({"template_id": template_id})
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    if not template.get("is_active"):
        raise HTTPException(status_code=400, detail="Template is not active")
    
    # Get content based on language
    lang_field_map = {
        "en": "content",
        "hi": "content_hindi",
        "mr": "content_marathi",
        "gu": "content_gujarati",
        "ta": "content_tamil"
    }
    content_field = lang_field_map.get(language, "content")
    content = template.get(content_field) or template.get("content")
    
    # Replace variables in content
    for key, value in recipient_data.items():
        placeholder = "{{" + key + "}}"
        content = content.replace(placeholder, str(value))
    
    # Create queue entry
    queue_doc = {
        "queue_id": f"QUE-{uuid.uuid4().hex[:8].upper()}",
        "template_id": template_id,
        "template_name": template.get("name"),
        "category": template.get("category"),
        "recipient": recipient_data.get("recipient_email") or recipient_data.get("recipient_phone"),
        "recipient_data": recipient_data,
        "content": content,
        "subject": template.get("subject"),
        "language": language,
        "status": "queued",  # queued, sending, sent, failed
        "scheduled_time": scheduled_time or datetime.now(timezone.utc),
        "sent_at": None,
        "error": None,
        "retries": 0,
        "created_by": current_user.get("id"),
        "created_at": datetime.now(timezone.utc)
    }
    
    await db.notification_queue.insert_one(queue_doc)
    
    return {
        "success": True,
        "queue_id": queue_doc["queue_id"],
        "scheduled_time": queue_doc["scheduled_time"].isoformat(),
        "message": "Notification queued"
    }


@router.get("/queue/pending")
async def get_pending_notifications(
    category: str = None,
    limit: int = Query(50, ge=1, le=200),
    current_user: dict = Depends(require_roles(["admin", "super_admin"]))
):
    """Get pending notifications in queue"""
    
    db = get_database()
    
    query = {"status": "queued"}
    if category:
        query["category"] = category
    
    pending = await db.notification_queue.find(query)\
        .sort("scheduled_time", 1)\
        .limit(limit)\
        .to_list(limit)
    
    for p in pending:
        p["_id"] = str(p["_id"])
        for field in ["scheduled_time", "created_at"]:
            if isinstance(p.get(field), datetime):
                p[field] = p[field].isoformat()
    
    return {
        "success": True,
        "pending": pending,
        "total": len(pending)
    }


@router.get("/queue/history")
async def get_send_history(
    template_id: str = None,
    status: str = None,
    days: int = Query(7, ge=1, le=30),
    limit: int = Query(100, ge=1, le=500),
    current_user: dict = Depends(require_roles(["admin", "super_admin"]))
):
    """Get notification send history"""
    
    db = get_database()
    
    query = {
        "created_at": {"$gte": datetime.now(timezone.utc) - timedelta(days=days)}
    }
    if template_id:
        query["template_id"] = template_id
    if status:
        query["status"] = status
    
    history = await db.notification_queue.find(query)\
        .sort("created_at", -1)\
        .limit(limit)\
        .to_list(limit)
    
    for h in history:
        h["_id"] = str(h["_id"])
        for field in ["scheduled_time", "created_at", "sent_at"]:
            if isinstance(h.get(field), datetime):
                h[field] = h[field].isoformat()
    
    # Stats
    stats = {
        "total": len(history),
        "sent": sum(1 for h in history if h.get("status") == "sent"),
        "failed": sum(1 for h in history if h.get("status") == "failed"),
        "queued": sum(1 for h in history if h.get("status") == "queued")
    }
    
    return {
        "success": True,
        "history": history,
        "stats": stats
    }


@router.post("/queue/{queue_id}/send-now")
async def send_notification_now(
    queue_id: str,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(require_roles(["admin", "super_admin"]))
):
    """Manually trigger sending a queued notification"""
    
    db = get_database()
    
    queue_item = await db.notification_queue.find_one({"queue_id": queue_id})
    if not queue_item:
        raise HTTPException(status_code=404, detail="Queue item not found")
    
    if queue_item.get("status") != "queued":
        raise HTTPException(status_code=400, detail=f"Cannot send - status is {queue_item.get('status')}")
    
    # Mark as sending
    await db.notification_queue.update_one(
        {"queue_id": queue_id},
        {"$set": {"status": "sending"}}
    )
    
    # Simulate sending (in production, this would call actual notification service)
    async def send_notification():
        try:
            # Simulated delay
            import asyncio
            await asyncio.sleep(1)
            
            # Mark as sent
            await db.notification_queue.update_one(
                {"queue_id": queue_id},
                {"$set": {
                    "status": "sent",
                    "sent_at": datetime.now(timezone.utc)
                }}
            )
            
            # Update template usage
            if queue_item.get("template_id"):
                await db.notification_templates.update_one(
                    {"template_id": queue_item["template_id"]},
                    {
                        "$inc": {"usage_count": 1},
                        "$set": {"last_used_at": datetime.now(timezone.utc)}
                    }
                )
        except Exception as e:
            await db.notification_queue.update_one(
                {"queue_id": queue_id},
                {"$set": {
                    "status": "failed",
                    "error": str(e),
                    "retries": queue_item.get("retries", 0) + 1
                }}
            )
    
    background_tasks.add_task(send_notification)
    
    return {
        "success": True,
        "queue_id": queue_id,
        "message": "Notification sending initiated"
    }


@router.post("/queue/{queue_id}/cancel")
async def cancel_queued_notification(
    queue_id: str,
    current_user: dict = Depends(require_roles(["admin", "super_admin"]))
):
    """Cancel a queued notification"""
    
    db = get_database()
    
    result = await db.notification_queue.update_one(
        {"queue_id": queue_id, "status": "queued"},
        {"$set": {
            "status": "cancelled",
            "cancelled_by": current_user.get("id"),
            "cancelled_at": datetime.now(timezone.utc)
        }}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=400, detail="Could not cancel - item not found or not queued")
    
    return {"success": True, "message": "Notification cancelled"}


# ==================== AI SUGGESTIONS ENDPOINTS ====================

@router.post("/{template_id}/ai-suggestions")
async def get_ai_suggestions(
    template_id: str,
    suggestion_type: str = Query("improve", pattern="^(improve|shorten|translate|emoji|formal|casual)$"),
    target_language: str = Query(None),
    current_user: dict = Depends(require_roles(["admin", "super_admin"]))
):
    """Get AI-powered suggestions for template improvement"""
    
    if not AI_AVAILABLE:
        # Return mock suggestions if AI not available
        return {
            "success": True,
            "ai_available": False,
            "suggestions": [
                {
                    "type": "tip",
                    "title": "Add Personalization",
                    "suggestion": "Include customer's name at the beginning for better engagement",
                    "example": "Hi {{customer_name}}, ..."
                },
                {
                    "type": "tip",
                    "title": "Add Call-to-Action",
                    "suggestion": "End with a clear action for the customer to take",
                    "example": "Reply CONFIRM to book now!"
                },
                {
                    "type": "tip",
                    "title": "Keep it Concise",
                    "suggestion": "SMS should be under 160 characters for single message",
                    "example": None
                }
            ],
            "message": "AI suggestions unavailable - showing best practices"
        }
    
    db = get_database()
    
    template = await db.notification_templates.find_one({"template_id": template_id})
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    content = template.get("content", "")
    category = template.get("category", "sms")
    
    # Build prompt based on suggestion type
    prompts = {
        "improve": f"""Analyze this {category} notification template and suggest 3 specific improvements:

Template: {content}

Focus on:
1. Engagement and clarity
2. Call-to-action effectiveness  
3. Professional tone

Provide specific rewritten examples for each suggestion.""",
        
        "shorten": f"""Shorten this {category} message while keeping all important information:

Original: {content}

Provide 2-3 shorter versions, with character counts.""",
        
        "translate": f"""Translate this notification to {target_language or 'Hindi'}:

Original (English): {content}

Provide:
1. Direct translation
2. Culturally adapted version""",
        
        "emoji": f"""Add appropriate emojis to this {category} notification:

Original: {content}

Provide version with tasteful, professional emojis.""",
        
        "formal": f"""Make this message more formal and professional:

Original: {content}""",
        
        "casual": f"""Make this message more friendly and conversational:

Original: {content}"""
    }
    
    try:
        llm_api_key = os.environ.get("LLM_API_KEY")
        
        response = await chat(
            api_key=llm_api_key,
            model="gpt-4o",
            messages=[
                Message(role="system", content="You are an expert in crafting notification messages for aviation booking services. Provide practical, actionable suggestions."),
                Message(role="user", content=prompts.get(suggestion_type, prompts["improve"]))
            ]
        )
        
        return {
            "success": True,
            "ai_available": True,
            "suggestion_type": suggestion_type,
            "original_content": content,
            "ai_response": response,
            "generated_at": datetime.now(timezone.utc).isoformat()
        }
    except Exception as e:
        return {
            "success": False,
            "ai_available": True,
            "error": str(e),
            "message": "AI suggestion failed"
        }


@router.get("/ai/best-practices")
async def get_best_practices(
    category: str = Query("sms", pattern="^(sms|whatsapp|email|payment)$")
):
    """Get best practices for template creation"""
    
    best_practices = {
        "sms": {
            "max_length": 160,
            "tips": [
                "Keep under 160 characters for single SMS",
                "Start with brand name (AirYatra)",
                "Include booking ID for reference",
                "End with contact info or action",
                "Avoid special characters that may not render",
                "Use simple, clear language"
            ],
            "do_not": [
                "Don't use ALL CAPS",
                "Don't include long URLs",
                "Don't use excessive punctuation!!!",
                "Don't send at odd hours"
            ],
            "examples": {
                "good": "AirYatra: Booking {{booking_id}} confirmed! {{departure_city}}→{{arrival_city}} on {{departure_date}}. Query: 1800-AIR-YATRA",
                "bad": "YOUR BOOKING HAS BEEN CONFIRMED!!! CLICK HERE: https://very-long-url.com/booking/details?id=123456789&ref=abc"
            }
        },
        "whatsapp": {
            "max_length": 4096,
            "tips": [
                "Use formatting: *bold*, _italic_, ~strikethrough~",
                "Include emojis for visual appeal",
                "Structure with clear sections",
                "Add interactive buttons if supported",
                "Include images/documents when relevant"
            ],
            "do_not": [
                "Don't send too many messages",
                "Don't use excessive emojis",
                "Don't include sensitive data in media"
            ],
            "examples": {
                "good": "🎉 *Booking Confirmed!*\n\n📋 ID: {{booking_id}}\n✈️ {{departure_city}} → {{arrival_city}}\n📅 {{departure_date}}"
            }
        },
        "email": {
            "max_length": None,
            "tips": [
                "Use responsive HTML design",
                "Include preheader text",
                "Add clear CTA buttons",
                "Include unsubscribe link",
                "Test across email clients",
                "Optimize images for fast loading"
            ],
            "do_not": [
                "Don't use image-only emails",
                "Don't hide important info in images",
                "Don't use too many fonts/colors"
            ]
        },
        "payment": {
            "max_length": None,
            "tips": [
                "Include transaction ID prominently",
                "Show itemized breakdown",
                "Include GST/tax details",
                "Add payment method info",
                "Include support contact"
            ],
            "do_not": [
                "Don't include full card numbers",
                "Don't show CVV or security codes"
            ]
        }
    }
    
    return {
        "success": True,
        "category": category,
        "best_practices": best_practices.get(category, {}),
        "all_categories": list(best_practices.keys())
    }


@router.post("/ai/generate-template")
async def generate_template_with_ai(
    category: str = Query(..., pattern="^(sms|whatsapp|email|payment)$"),
    trigger_event: str = Query(...),
    tone: str = Query("professional", pattern="^(professional|friendly|urgent|casual)$"),
    include_hindi: bool = Query(True),
    current_user: dict = Depends(require_roles(["admin", "super_admin"]))
):
    """Generate a new template using AI"""
    
    if not AI_AVAILABLE:
        return {
            "success": False,
            "ai_available": False,
            "message": "AI generation not available"
        }
    
    prompt = f"""Generate a {category} notification template for an aviation/helicopter booking service.

Event: {trigger_event}
Tone: {tone}
Brand: AirYatra

Requirements:
1. Include relevant variables like {{{{customer_name}}}}, {{{{booking_id}}}}, etc.
2. {'Generate both English and Hindi versions' if include_hindi else 'English only'}
3. Follow {category} best practices
4. Keep it concise and actionable

Provide the template in this format:
ENGLISH:
[template content]

{'HINDI:' if include_hindi else ''}
{'[Hindi translation]' if include_hindi else ''}

VARIABLES USED:
[list of variables]"""
    
    try:
        llm_api_key = os.environ.get("LLM_API_KEY")
        
        response = await chat(
            api_key=llm_api_key,
            model="gpt-4o",
            messages=[
                Message(role="system", content="You are an expert in crafting notification templates for aviation services in India. Create professional, engaging messages."),
                Message(role="user", content=prompt)
            ]
        )
        
        return {
            "success": True,
            "ai_available": True,
            "generated_template": response,
            "category": category,
            "trigger_event": trigger_event,
            "tone": tone
        }
    except Exception as e:
        return {
            "success": False,
            "ai_available": True,
            "error": str(e)
        }



# ==================== DELIVERY REPORTS INTEGRATION ====================

@router.post("/webhook/delivery-report")
async def receive_delivery_report(
    provider: str = Query(..., pattern="^(sms|email|whatsapp)$"),
    report_data: dict = None
):
    """
    Webhook endpoint for receiving delivery reports from SMS/Email/WhatsApp providers.
    This is called by external providers (Twilio, SendGrid, MSG91, etc.)
    """
    
    db = get_database()
    
    # Parse report based on provider
    delivery_report = {
        "report_id": f"DLR-{uuid.uuid4().hex[:8].upper()}",
        "provider": provider,
        "raw_data": report_data,
        "received_at": datetime.now(timezone.utc)
    }
    
    # Common fields to extract
    message_id = report_data.get("message_id") or report_data.get("MessageSid") or report_data.get("sg_message_id")
    status = report_data.get("status") or report_data.get("MessageStatus") or report_data.get("event")
    
    # Normalize status
    status_map = {
        # Twilio SMS statuses
        "queued": "queued", "sent": "sent", "delivered": "delivered", 
        "undelivered": "failed", "failed": "failed",
        # SendGrid email statuses
        "processed": "sent", "dropped": "failed", "deferred": "queued",
        "bounce": "bounced", "open": "opened", "click": "clicked",
        "spam_report": "spam", "unsubscribe": "unsubscribed",
        # WhatsApp statuses
        "read": "read", "accepted": "sent"
    }
    
    normalized_status = status_map.get(status, status)
    
    delivery_report["message_id"] = message_id
    delivery_report["status"] = normalized_status
    delivery_report["original_status"] = status
    delivery_report["timestamp"] = report_data.get("timestamp") or datetime.now(timezone.utc).isoformat()
    
    # Additional data
    if provider == "email":
        delivery_report["email"] = report_data.get("email")
        delivery_report["ip"] = report_data.get("ip")
        delivery_report["user_agent"] = report_data.get("useragent")
    elif provider == "sms":
        delivery_report["phone"] = report_data.get("To") or report_data.get("phone")
        delivery_report["error_code"] = report_data.get("ErrorCode")
    
    # Store report
    await db.delivery_reports.insert_one(delivery_report)
    
    # Update notification queue if we have message_id
    if message_id:
        await db.notification_queue.update_one(
            {"external_message_id": message_id},
            {"$set": {
                "delivery_status": normalized_status,
                "delivery_updated_at": datetime.now(timezone.utc),
                "delivery_raw": report_data
            }}
        )
    
    # Update template stats if status is opened/clicked
    if normalized_status in ["opened", "clicked", "converted"]:
        queue_item = await db.notification_queue.find_one({"external_message_id": message_id})
        if queue_item and queue_item.get("template_id"):
            stat_field = f"ab_stats.{normalized_status}_count"
            await db.notification_templates.update_one(
                {"template_id": queue_item["template_id"]},
                {"$inc": {stat_field: 1}}
            )
    
    return {"success": True, "report_id": delivery_report["report_id"]}


@router.get("/delivery-reports")
async def get_delivery_reports(
    template_id: str = None,
    status: str = None,
    provider: str = None,
    days: int = Query(7, ge=1, le=30),
    limit: int = Query(100, ge=1, le=500),
    current_user: dict = Depends(require_roles(["admin", "super_admin"]))
):
    """Get delivery reports with filters"""
    
    db = get_database()
    
    query = {
        "received_at": {"$gte": datetime.now(timezone.utc) - timedelta(days=days)}
    }
    if status:
        query["status"] = status
    if provider:
        query["provider"] = provider
    
    reports = await db.delivery_reports.find(query)\
        .sort("received_at", -1)\
        .limit(limit)\
        .to_list(limit)
    
    for r in reports:
        r["_id"] = str(r["_id"])
        if isinstance(r.get("received_at"), datetime):
            r["received_at"] = r["received_at"].isoformat()
    
    # Calculate stats
    pipeline = [
        {"$match": query},
        {"$group": {
            "_id": "$status",
            "count": {"$sum": 1}
        }}
    ]
    stats_raw = await db.delivery_reports.aggregate(pipeline).to_list(20)
    stats = {s["_id"]: s["count"] for s in stats_raw}
    
    total = sum(stats.values())
    
    return {
        "success": True,
        "reports": reports,
        "stats": {
            "total": total,
            "delivered": stats.get("delivered", 0),
            "opened": stats.get("opened", 0),
            "clicked": stats.get("clicked", 0),
            "failed": stats.get("failed", 0),
            "bounced": stats.get("bounced", 0),
            "delivery_rate": round((stats.get("delivered", 0) / total * 100) if total > 0 else 0, 2),
            "open_rate": round((stats.get("opened", 0) / stats.get("delivered", 1) * 100) if stats.get("delivered", 0) > 0 else 0, 2)
        }
    }


@router.get("/{template_id}/delivery-stats")
async def get_template_delivery_stats(
    template_id: str,
    days: int = Query(30, ge=1, le=90),
    current_user: dict = Depends(require_roles(["admin", "super_admin"]))
):
    """Get delivery statistics for a specific template"""
    
    db = get_database()
    
    template = await db.notification_templates.find_one({"template_id": template_id})
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    start_date = datetime.now(timezone.utc) - timedelta(days=days)
    
    # Get queue items for this template
    pipeline = [
        {"$match": {
            "template_id": template_id,
            "created_at": {"$gte": start_date}
        }},
        {"$group": {
            "_id": "$status",
            "count": {"$sum": 1}
        }}
    ]
    
    status_stats = await db.notification_queue.aggregate(pipeline).to_list(20)
    stats = {s["_id"]: s["count"] for s in status_stats}
    
    # Daily breakdown
    daily_pipeline = [
        {"$match": {
            "template_id": template_id,
            "created_at": {"$gte": start_date}
        }},
        {"$group": {
            "_id": {
                "$dateToString": {"format": "%Y-%m-%d", "date": "$created_at"}
            },
            "sent": {"$sum": 1},
            "delivered": {"$sum": {"$cond": [{"$eq": ["$delivery_status", "delivered"]}, 1, 0]}},
            "opened": {"$sum": {"$cond": [{"$eq": ["$delivery_status", "opened"]}, 1, 0]}}
        }},
        {"$sort": {"_id": 1}}
    ]
    
    daily_stats = await db.notification_queue.aggregate(daily_pipeline).to_list(90)
    
    total_sent = stats.get("sent", 0) + stats.get("queued", 0)
    total_delivered = sum(1 for _ in await db.notification_queue.find({"template_id": template_id, "delivery_status": "delivered"}).to_list(10000))
    
    return {
        "success": True,
        "template_id": template_id,
        "template_name": template.get("name"),
        "period_days": days,
        "stats": {
            "total_sent": total_sent,
            "delivered": total_delivered,
            "opened": template.get("ab_stats", {}).get("opened_count", 0),
            "clicked": template.get("ab_stats", {}).get("clicked_count", 0),
            "failed": stats.get("failed", 0),
            "delivery_rate": round((total_delivered / total_sent * 100) if total_sent > 0 else 0, 2),
            "open_rate": round((template.get("ab_stats", {}).get("opened_count", 0) / total_delivered * 100) if total_delivered > 0 else 0, 2)
        },
        "daily_breakdown": daily_stats
    }


# ==================== PERFORMANCE ALERTS ====================

@router.post("/alerts/configure")
async def configure_alert(
    template_id: str = None,  # None = global alert
    metric: str = Query(..., pattern="^(delivery_rate|open_rate|click_rate|bounce_rate)$"),
    threshold: float = Query(..., ge=0, le=100),
    comparison: str = Query("below", pattern="^(below|above)$"),
    notify_emails: List[str] = None,
    is_active: bool = True,
    current_user: dict = Depends(require_roles(["admin", "super_admin"]))
):
    """Configure performance alerts for templates"""
    
    db = get_database()
    
    alert_doc = {
        "alert_id": f"ALT-{uuid.uuid4().hex[:8].upper()}",
        "template_id": template_id,  # None means global
        "metric": metric,
        "threshold": threshold,
        "comparison": comparison,  # below or above
        "notify_emails": notify_emails or [current_user.get("email")],
        "is_active": is_active,
        "last_triggered_at": None,
        "trigger_count": 0,
        "created_by": current_user.get("id"),
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }
    
    # Check if similar alert exists
    existing = await db.template_alerts.find_one({
        "template_id": template_id,
        "metric": metric,
        "is_active": True
    })
    
    if existing:
        # Update existing alert
        await db.template_alerts.update_one(
            {"alert_id": existing["alert_id"]},
            {"$set": {
                "threshold": threshold,
                "comparison": comparison,
                "notify_emails": alert_doc["notify_emails"],
                "is_active": is_active,
                "updated_at": datetime.now(timezone.utc)
            }}
        )
        return {
            "success": True,
            "alert_id": existing["alert_id"],
            "message": "Alert updated"
        }
    
    await db.template_alerts.insert_one(alert_doc)
    
    return {
        "success": True,
        "alert_id": alert_doc["alert_id"],
        "message": f"Alert configured: Notify when {metric} goes {comparison} {threshold}%"
    }


@router.get("/alerts/list")
async def list_alerts(
    template_id: str = None,
    is_active: bool = None,
    current_user: dict = Depends(require_roles(["admin", "super_admin"]))
):
    """List all configured alerts"""
    
    db = get_database()
    
    query = {}
    if template_id:
        query["template_id"] = template_id
    if is_active is not None:
        query["is_active"] = is_active
    
    alerts = await db.template_alerts.find(query).sort("created_at", -1).to_list(100)
    
    for a in alerts:
        a["_id"] = str(a["_id"])
        for field in ["created_at", "updated_at", "last_triggered_at"]:
            if isinstance(a.get(field), datetime):
                a[field] = a[field].isoformat()
        
        # Get template name if template_id exists
        if a.get("template_id"):
            template = await db.notification_templates.find_one(
                {"template_id": a["template_id"]},
                {"name": 1}
            )
            a["template_name"] = template.get("name") if template else "Unknown"
        else:
            a["template_name"] = "All Templates (Global)"
    
    return {
        "success": True,
        "alerts": alerts,
        "total": len(alerts)
    }


@router.delete("/alerts/{alert_id}")
async def delete_alert(
    alert_id: str,
    current_user: dict = Depends(require_roles(["admin", "super_admin"]))
):
    """Delete an alert"""
    
    db = get_database()
    
    result = await db.template_alerts.delete_one({"alert_id": alert_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Alert not found")
    
    return {"success": True, "message": "Alert deleted"}


@router.post("/alerts/check")
async def check_alerts_manual(
    current_user: dict = Depends(require_roles(["admin", "super_admin"]))
):
    """Manually trigger alert check (usually run by scheduler)"""
    
    db = get_database()
    
    alerts = await db.template_alerts.find({"is_active": True}).to_list(100)
    triggered_alerts = []
    
    for alert in alerts:
        template_id = alert.get("template_id")
        metric = alert["metric"]
        threshold = alert["threshold"]
        comparison = alert["comparison"]
        
        # Get current metric value
        if template_id:
            # Per-template metric
            template = await db.notification_templates.find_one({"template_id": template_id})
            if not template:
                continue
            
            ab_stats = template.get("ab_stats", {})
            sent = ab_stats.get("sent_count", 0) or template.get("usage_count", 0)
            delivered = ab_stats.get("delivered_count", sent)
            opened = ab_stats.get("opened_count", 0)
            clicked = ab_stats.get("clicked_count", 0)
        else:
            # Global metric - aggregate all templates
            pipeline = [
                {"$group": {
                    "_id": None,
                    "total_sent": {"$sum": "$usage_count"},
                    "total_opened": {"$sum": "$ab_stats.opened_count"},
                    "total_clicked": {"$sum": "$ab_stats.clicked_count"}
                }}
            ]
            result = await db.notification_templates.aggregate(pipeline).to_list(1)
            if result:
                sent = result[0].get("total_sent", 0)
                delivered = sent  # Assume delivered = sent for global
                opened = result[0].get("total_opened", 0)
                clicked = result[0].get("total_clicked", 0)
            else:
                continue
        
        # Calculate metric value
        if metric == "delivery_rate":
            current_value = (delivered / sent * 100) if sent > 0 else 100
        elif metric == "open_rate":
            current_value = (opened / delivered * 100) if delivered > 0 else 0
        elif metric == "click_rate":
            current_value = (clicked / opened * 100) if opened > 0 else 0
        elif metric == "bounce_rate":
            bounced = sent - delivered
            current_value = (bounced / sent * 100) if sent > 0 else 0
        else:
            continue
        
        # Check if alert should trigger
        should_trigger = False
        if comparison == "below" and current_value < threshold:
            should_trigger = True
        elif comparison == "above" and current_value > threshold:
            should_trigger = True
        
        if should_trigger:
            triggered_alerts.append({
                "alert_id": alert["alert_id"],
                "template_id": template_id,
                "metric": metric,
                "threshold": threshold,
                "current_value": round(current_value, 2),
                "comparison": comparison,
                "notify_emails": alert.get("notify_emails", [])
            })
            
            # Update alert
            await db.template_alerts.update_one(
                {"alert_id": alert["alert_id"]},
                {"$set": {
                    "last_triggered_at": datetime.now(timezone.utc),
                    "last_value": current_value
                },
                "$inc": {"trigger_count": 1}}
            )
    
    # Store triggered alerts
    if triggered_alerts:
        for ta in triggered_alerts:
            ta["triggered_at"] = datetime.now(timezone.utc)
            await db.alert_history.insert_one(ta)
    
    return {
        "success": True,
        "checked": len(alerts),
        "triggered": len(triggered_alerts),
        "triggered_alerts": triggered_alerts
    }


@router.get("/alerts/history")
async def get_alert_history(
    alert_id: str = None,
    days: int = Query(7, ge=1, le=30),
    current_user: dict = Depends(require_roles(["admin", "super_admin"]))
):
    """Get alert trigger history"""
    
    db = get_database()
    
    query = {
        "triggered_at": {"$gte": datetime.now(timezone.utc) - timedelta(days=days)}
    }
    if alert_id:
        query["alert_id"] = alert_id
    
    history = await db.alert_history.find(query).sort("triggered_at", -1).to_list(200)
    
    for h in history:
        h["_id"] = str(h["_id"])
        if isinstance(h.get("triggered_at"), datetime):
            h["triggered_at"] = h["triggered_at"].isoformat()
    
    return {
        "success": True,
        "history": history,
        "total": len(history)
    }


# ==================== TESTING SANDBOX ====================

@router.post("/{template_id}/sandbox/test")
async def test_template_sandbox(
    template_id: str,
    test_recipient: str = Query(..., description="Phone number or email to send test to"),
    language: str = Query("en"),
    test_data: dict = None,
    current_user: dict = Depends(require_roles(["admin", "super_admin"]))
):
    """Send a test notification using sandbox mode"""
    
    db = get_database()
    
    template = await db.notification_templates.find_one({"template_id": template_id})
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    # Get content based on language
    lang_field_map = {
        "en": "content",
        "hi": "content_hindi",
        "mr": "content_marathi",
        "gu": "content_gujarati",
        "ta": "content_tamil"
    }
    content_field = lang_field_map.get(language, "content")
    content = template.get(content_field) or template.get("content")
    subject = template.get("subject", "")
    
    # Default test data
    default_test_data = {
        "customer_name": "Test User",
        "customer_email": test_recipient if "@" in test_recipient else "test@example.com",
        "customer_phone": test_recipient if "@" not in test_recipient else "+919876543210",
        "booking_id": "TEST-2026-SANDBOX",
        "booking_date": datetime.now().strftime("%d %b %Y"),
        "booking_status": "Confirmed",
        "departure_city": "Mumbai",
        "arrival_city": "Pune",
        "departure_date": (datetime.now() + timedelta(days=7)).strftime("%d %b %Y"),
        "departure_time": "10:30 AM",
        "passenger_count": "2",
        "aircraft_name": "Bell 407 (Test)",
        "operator_name": "AirYatra Test Operator",
        "amount": "₹25,000",
        "total_amount": "₹50,000",
        "advance_amount": "₹25,000",
        "balance_amount": "₹25,000",
        "payment_id": "PAY-TEST-123",
        "discount_code": "TESTCODE",
        "discount_value": "10%",
        "otp": "123456",
        "complaint_id": "CMP-TEST-001"
    }
    
    # Merge with provided test data
    if test_data:
        default_test_data.update(test_data)
    
    # Replace variables in content
    rendered_content = content
    rendered_subject = subject
    
    for key, value in default_test_data.items():
        placeholder = "{{" + key + "}}"
        rendered_content = rendered_content.replace(placeholder, str(value))
        if rendered_subject:
            rendered_subject = rendered_subject.replace(placeholder, str(value))
    
    # Create sandbox test record
    test_record = {
        "test_id": f"TST-{uuid.uuid4().hex[:8].upper()}",
        "template_id": template_id,
        "template_name": template.get("name"),
        "category": template.get("category"),
        "test_recipient": test_recipient,
        "language": language,
        "rendered_content": rendered_content,
        "rendered_subject": rendered_subject,
        "test_data": default_test_data,
        "status": "sent",  # In real implementation, would actually send
        "tested_by": current_user.get("id"),
        "tested_by_email": current_user.get("email"),
        "tested_at": datetime.now(timezone.utc)
    }
    
    await db.template_sandbox_tests.insert_one(test_record)
    
    # Simulate sending (in production, would integrate with actual providers)
    # For now, just mark as sent
    
    return {
        "success": True,
        "test_id": test_record["test_id"],
        "message": f"Test {template.get('category')} sent to {test_recipient}",
        "preview": {
            "subject": rendered_subject,
            "content": rendered_content,
            "language": language,
            "recipient": test_recipient
        }
    }


@router.get("/{template_id}/sandbox/history")
async def get_sandbox_test_history(
    template_id: str,
    limit: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(require_roles(["admin", "super_admin"]))
):
    """Get sandbox test history for a template"""
    
    db = get_database()
    
    history = await db.template_sandbox_tests.find(
        {"template_id": template_id}
    ).sort("tested_at", -1).limit(limit).to_list(limit)
    
    for h in history:
        h["_id"] = str(h["_id"])
        if isinstance(h.get("tested_at"), datetime):
            h["tested_at"] = h["tested_at"].isoformat()
    
    return {
        "success": True,
        "template_id": template_id,
        "history": history,
        "total": len(history)
    }


@router.post("/sandbox/bulk-test")
async def bulk_test_templates(
    template_ids: List[str],
    test_recipient: str = Query(...),
    language: str = Query("en"),
    current_user: dict = Depends(require_roles(["admin", "super_admin"]))
):
    """Test multiple templates at once"""
    
    db = get_database()
    results = []
    
    for template_id in template_ids[:10]:  # Limit to 10
        template = await db.notification_templates.find_one({"template_id": template_id})
        if not template:
            results.append({
                "template_id": template_id,
                "success": False,
                "error": "Template not found"
            })
            continue
        
        # Get content
        lang_field_map = {"en": "content", "hi": "content_hindi", "mr": "content_marathi", "gu": "content_gujarati", "ta": "content_tamil"}
        content = template.get(lang_field_map.get(language, "content")) or template.get("content")
        
        results.append({
            "template_id": template_id,
            "template_name": template.get("name"),
            "category": template.get("category"),
            "success": True,
            "content_preview": content[:100] + "..." if len(content) > 100 else content
        })
    
    return {
        "success": True,
        "tested": len(results),
        "results": results
    }


# ==================== TEMPLATE LIBRARY / MARKETPLACE ====================

# Pre-built template library
TEMPLATE_LIBRARY = [
    {
        "library_id": "LIB-001",
        "name": "Welcome SMS - Professional",
        "category": "sms",
        "tags": ["welcome", "onboarding", "customer"],
        "description": "Professional welcome message for new customers",
        "content": "Welcome to AirYatra, {{customer_name}}! Your journey to the skies begins now. Book your first helicopter ride and experience India like never before. Help: 1800-AIR-YATRA",
        "content_hindi": "AirYatra में आपका स्वागत है, {{customer_name}}! आकाश की यात्रा अब शुरू होती है। अपनी पहली हेलीकॉप्टर राइड बुक करें। सहायता: 1800-AIR-YATRA",
        "variables": ["customer_name"],
        "trigger_event": "welcome_customer",
        "popularity": 95,
        "downloads": 1250,
        "rating": 4.8,
        "is_featured": True
    },
    {
        "library_id": "LIB-002",
        "name": "Booking Confirmation - Detailed",
        "category": "whatsapp",
        "tags": ["booking", "confirmation", "detailed"],
        "description": "Comprehensive booking confirmation with all flight details",
        "content": """🎉 *Booking Confirmed!*

Dear {{customer_name}},

Your AirYatra booking is confirmed:

📋 *Booking ID:* {{booking_id}}
✈️ *Route:* {{departure_city}} → {{arrival_city}}
📅 *Date:* {{departure_date}}
⏰ *Time:* {{departure_time}}
👥 *Passengers:* {{passenger_count}}
🚁 *Aircraft:* {{aircraft_name}}

💰 *Payment Summary:*
• Total: {{total_amount}}
• Paid: {{advance_amount}}
• Balance: {{balance_amount}}

📍 Arrive at helipad 30 mins before departure.

Safe travels! 🙏
*Team AirYatra*""",
        "variables": ["customer_name", "booking_id", "departure_city", "arrival_city", "departure_date", "departure_time", "passenger_count", "aircraft_name", "total_amount", "advance_amount", "balance_amount"],
        "trigger_event": "booking_confirmed",
        "popularity": 98,
        "downloads": 2340,
        "rating": 4.9,
        "is_featured": True
    },
    {
        "library_id": "LIB-003",
        "name": "Payment Receipt - Tax Compliant",
        "category": "email",
        "tags": ["payment", "receipt", "tax", "gst"],
        "description": "GST-compliant payment receipt email template",
        "subject": "Payment Receipt - {{payment_id}} | AirYatra",
        "content": """<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; }
        .receipt { max-width: 600px; margin: 0 auto; border: 1px solid #ddd; }
        .header { background: #f97316; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; }
        .row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; }
        .total { background: #f8f8f8; padding: 15px; font-size: 18px; }
        .footer { text-align: center; padding: 15px; color: #666; font-size: 12px; }
    </style>
</head>
<body>
    <div class="receipt">
        <div class="header">
            <h2>AirYatra Payment Receipt</h2>
        </div>
        <div class="content">
            <div class="row"><span>Receipt No</span><strong>{{payment_id}}</strong></div>
            <div class="row"><span>Booking ID</span><strong>{{booking_id}}</strong></div>
            <div class="row"><span>Date</span><span>{{payment_date}}</span></div>
            <div class="row"><span>Customer</span><span>{{customer_name}}</span></div>
            <div class="row"><span>Amount</span><span>{{amount}}</span></div>
            <div class="row"><span>GST (18%)</span><span>{{gst_amount}}</span></div>
            <div class="total"><div class="row" style="border:none;"><span>Total</span><strong>{{total_amount}}</strong></div></div>
        </div>
        <div class="footer">
            <p>AirYatra Aviation Pvt. Ltd. | GSTIN: 27AAAAA0000A1Z5</p>
            <p>This is a computer-generated receipt.</p>
        </div>
    </div>
</body>
</html>""",
        "variables": ["payment_id", "booking_id", "payment_date", "customer_name", "amount", "gst_amount", "total_amount"],
        "trigger_event": "payment_success",
        "popularity": 92,
        "downloads": 1890,
        "rating": 4.7,
        "is_featured": True
    },
    {
        "library_id": "LIB-004",
        "name": "Flight Reminder - 24 Hours",
        "category": "sms",
        "tags": ["reminder", "flight", "24h"],
        "description": "Reminder SMS sent 24 hours before flight",
        "content": "✈️ AirYatra Reminder: Your flight {{booking_id}} departs TOMORROW at {{departure_time}} from {{departure_city}}. Be at helipad 30 mins early. Safe travels!",
        "content_hindi": "✈️ AirYatra: आपकी फ्लाइट {{booking_id}} कल {{departure_time}} बजे {{departure_city}} से है। 30 मिनट पहले हेलीपैड पहुंचें।",
        "variables": ["booking_id", "departure_time", "departure_city"],
        "trigger_event": "flight_reminder",
        "schedule_type": "before_event",
        "schedule_offset": 24,
        "schedule_unit": "hours",
        "popularity": 88,
        "downloads": 1560,
        "rating": 4.6,
        "is_featured": False
    },
    {
        "library_id": "LIB-005",
        "name": "Complaint Acknowledgment",
        "category": "whatsapp",
        "tags": ["complaint", "support", "acknowledgment"],
        "description": "Acknowledge customer complaint with tracking details",
        "content": """📝 *Complaint Received*

Dear {{customer_name}},

We've received your complaint and apologize for the inconvenience.

🔖 *Complaint ID:* {{complaint_id}}
📋 *Category:* {{complaint_category}}
📅 *Registered:* {{complaint_date}}

Our team will review and respond within 48 hours.

For urgent queries, call: 1800-AIR-YATRA

*Team AirYatra*""",
        "variables": ["customer_name", "complaint_id", "complaint_category", "complaint_date"],
        "trigger_event": "complaint_received",
        "popularity": 85,
        "downloads": 980,
        "rating": 4.5,
        "is_featured": False
    },
    {
        "library_id": "LIB-006",
        "name": "Special Offer - Festival",
        "category": "email",
        "tags": ["offer", "discount", "festival", "marketing"],
        "description": "Festival special offer email with discount code",
        "subject": "🎉 Festival Special: {{discount_value}} OFF on Helicopter Bookings!",
        "content": """<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; }
        .hero { background: linear-gradient(135deg, #f97316, #dc2626); padding: 40px; text-align: center; color: white; }
        .code-box { background: #fef3c7; border: 3px dashed #f97316; padding: 30px; margin: 20px; text-align: center; }
        .code { font-size: 36px; font-weight: bold; color: #ea580c; letter-spacing: 4px; }
        .cta { display: inline-block; background: #f97316; color: white; padding: 15px 40px; text-decoration: none; border-radius: 8px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="hero">
            <h1>🎊 Festival Special Offer!</h1>
            <p>Celebrate with AirYatra</p>
        </div>
        <div class="code-box">
            <div class="code">{{discount_code}}</div>
            <p style="font-size:24px;color:#16a34a;margin-top:10px;">Get {{discount_value}} OFF!</p>
        </div>
        <div style="padding:20px;text-align:center;">
            <p>Dear {{customer_name}},</p>
            <p>Book your helicopter ride this festive season and save big!</p>
            <p><strong>Valid Until:</strong> {{valid_until}}</p>
            <p><strong>Min Booking:</strong> {{min_booking_amount}}</p>
            <br>
            <a href="https://airyatra.com/booking" class="cta">Book Now ✈️</a>
        </div>
    </div>
</body>
</html>""",
        "variables": ["customer_name", "discount_code", "discount_value", "valid_until", "min_booking_amount"],
        "trigger_event": "discount_created",
        "popularity": 90,
        "downloads": 1420,
        "rating": 4.8,
        "is_featured": True
    },
    {
        "library_id": "LIB-007",
        "name": "OTP Verification - Secure",
        "category": "sms",
        "tags": ["otp", "verification", "security"],
        "description": "Secure OTP message with expiry warning",
        "content": "{{otp}} is your AirYatra OTP. Valid for 10 minutes. DO NOT share with anyone. If you didn't request this, call 1800-AIR-YATRA.",
        "content_hindi": "{{otp}} आपका AirYatra OTP है। 10 मिनट तक वैध। किसी को न बताएं। अगर आपने नहीं मांगा, कॉल करें: 1800-AIR-YATRA",
        "variables": ["otp"],
        "trigger_event": "otp_verification",
        "popularity": 99,
        "downloads": 3200,
        "rating": 4.9,
        "is_featured": True
    },
    {
        "library_id": "LIB-008",
        "name": "Refund Processed",
        "category": "email",
        "tags": ["refund", "payment", "cancellation"],
        "description": "Refund confirmation email with timeline",
        "subject": "Refund Processed - {{payment_id}} | AirYatra",
        "content": """<!DOCTYPE html>
<html>
<body style="font-family:Arial;max-width:600px;margin:0 auto;">
    <div style="background:#3b82f6;color:white;padding:30px;text-align:center;">
        <h2>💰 Refund Processed</h2>
    </div>
    <div style="padding:20px;">
        <p>Dear {{customer_name}},</p>
        <p>Your refund has been successfully processed.</p>
        <div style="background:#eff6ff;padding:20px;border-radius:8px;text-align:center;margin:20px 0;">
            <div style="font-size:32px;color:#3b82f6;font-weight:bold;">{{refund_amount}}</div>
            <p>Refund Amount</p>
        </div>
        <p><strong>Booking ID:</strong> {{booking_id}}</p>
        <p><strong>Refund ID:</strong> {{payment_id}}</p>
        <p><strong>Processing Date:</strong> {{payment_date}}</p>
        <div style="background:#fef3c7;padding:15px;border-radius:8px;margin:20px 0;">
            <strong>Note:</strong> Amount will be credited within 5-7 business days.
        </div>
        <p>Thank you for your patience.</p>
        <p><strong>Team AirYatra</strong></p>
    </div>
</body>
</html>""",
        "variables": ["customer_name", "refund_amount", "booking_id", "payment_id", "payment_date"],
        "trigger_event": "payment_refund",
        "popularity": 86,
        "downloads": 890,
        "rating": 4.6,
        "is_featured": False
    }
]


@router.get("/library/browse")
async def browse_template_library(
    category: str = None,
    tag: str = None,
    search: str = None,
    featured_only: bool = False,
    sort_by: str = Query("popularity", pattern="^(popularity|downloads|rating|name)$")
):
    """Browse the template library/marketplace"""
    
    templates = TEMPLATE_LIBRARY.copy()
    
    # Filter by category
    if category:
        templates = [t for t in templates if t["category"] == category]
    
    # Filter by tag
    if tag:
        templates = [t for t in templates if tag.lower() in [x.lower() for x in t.get("tags", [])]]
    
    # Filter by search
    if search:
        search_lower = search.lower()
        templates = [t for t in templates if 
                    search_lower in t["name"].lower() or 
                    search_lower in t.get("description", "").lower()]
    
    # Filter featured only
    if featured_only:
        templates = [t for t in templates if t.get("is_featured")]
    
    # Sort
    if sort_by == "popularity":
        templates.sort(key=lambda x: x.get("popularity", 0), reverse=True)
    elif sort_by == "downloads":
        templates.sort(key=lambda x: x.get("downloads", 0), reverse=True)
    elif sort_by == "rating":
        templates.sort(key=lambda x: x.get("rating", 0), reverse=True)
    elif sort_by == "name":
        templates.sort(key=lambda x: x.get("name", ""))
    
    # Get all unique tags
    all_tags = set()
    for t in TEMPLATE_LIBRARY:
        all_tags.update(t.get("tags", []))
    
    return {
        "success": True,
        "templates": templates,
        "total": len(templates),
        "filters": {
            "categories": ["sms", "whatsapp", "email", "payment"],
            "tags": sorted(list(all_tags)),
            "sort_options": ["popularity", "downloads", "rating", "name"]
        }
    }


@router.get("/library/{library_id}")
async def get_library_template(library_id: str):
    """Get details of a specific library template"""
    
    template = next((t for t in TEMPLATE_LIBRARY if t["library_id"] == library_id), None)
    
    if not template:
        raise HTTPException(status_code=404, detail="Template not found in library")
    
    return {
        "success": True,
        "template": template
    }


@router.post("/library/{library_id}/import")
async def import_library_template(
    library_id: str,
    custom_name: str = None,
    current_user: dict = Depends(require_roles(["admin", "super_admin"]))
):
    """Import a template from the library"""
    
    db = get_database()
    
    # Find library template
    lib_template = next((t for t in TEMPLATE_LIBRARY if t["library_id"] == library_id), None)
    
    if not lib_template:
        raise HTTPException(status_code=404, detail="Template not found in library")
    
    # Check if already imported
    existing = await db.notification_templates.find_one({
        "imported_from": library_id
    })
    
    if existing:
        return {
            "success": False,
            "message": "Template already imported",
            "existing_template_id": existing.get("template_id")
        }
    
    # Create new template from library
    new_template = {
        "template_id": f"TPL-{uuid.uuid4().hex[:8].upper()}",
        "name": custom_name or lib_template["name"],
        "category": lib_template["category"],
        "subject": lib_template.get("subject"),
        "content": lib_template["content"],
        "content_hindi": lib_template.get("content_hindi"),
        "variables": lib_template.get("variables", []),
        "trigger_event": lib_template.get("trigger_event"),
        "is_active": False,  # Imported templates start inactive
        "priority": 0,
        "schedule_type": lib_template.get("schedule_type"),
        "schedule_offset": lib_template.get("schedule_offset"),
        "schedule_unit": lib_template.get("schedule_unit"),
        "imported_from": library_id,
        "imported_at": datetime.now(timezone.utc),
        "approval_status": "draft",  # Need approval before use
        "usage_count": 0,
        "usage_history": [],
        "ab_stats": {
            "sent_count": 0,
            "delivered_count": 0,
            "opened_count": 0,
            "clicked_count": 0,
            "converted_count": 0
        },
        "created_by": current_user.get("id"),
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }
    
    await db.notification_templates.insert_one(new_template)
    
    return {
        "success": True,
        "template_id": new_template["template_id"],
        "message": f"Template '{new_template['name']}' imported successfully. Please review and approve before activating."
    }


@router.post("/library/import-bulk")
async def import_multiple_templates(
    library_ids: List[str],
    current_user: dict = Depends(require_roles(["admin", "super_admin"]))
):
    """Import multiple templates from library"""
    
    db = get_database()
    
    imported = []
    skipped = []
    
    for library_id in library_ids[:20]:  # Limit to 20
        lib_template = next((t for t in TEMPLATE_LIBRARY if t["library_id"] == library_id), None)
        
        if not lib_template:
            skipped.append({"library_id": library_id, "reason": "Not found"})
            continue
        
        # Check if already imported
        existing = await db.notification_templates.find_one({"imported_from": library_id})
        if existing:
            skipped.append({"library_id": library_id, "reason": "Already imported"})
            continue
        
        # Create new template
        new_template = {
            "template_id": f"TPL-{uuid.uuid4().hex[:8].upper()}",
            "name": lib_template["name"],
            "category": lib_template["category"],
            "subject": lib_template.get("subject"),
            "content": lib_template["content"],
            "content_hindi": lib_template.get("content_hindi"),
            "variables": lib_template.get("variables", []),
            "trigger_event": lib_template.get("trigger_event"),
            "is_active": False,
            "priority": 0,
            "imported_from": library_id,
            "imported_at": datetime.now(timezone.utc),
            "approval_status": "draft",
            "usage_count": 0,
            "ab_stats": {"sent_count": 0, "delivered_count": 0, "opened_count": 0, "clicked_count": 0, "converted_count": 0},
            "created_by": current_user.get("id"),
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        }
        
        await db.notification_templates.insert_one(new_template)
        imported.append({
            "library_id": library_id,
            "template_id": new_template["template_id"],
            "name": new_template["name"]
        })
    
    return {
        "success": True,
        "imported": len(imported),
        "skipped": len(skipped),
        "imported_templates": imported,
        "skipped_templates": skipped
    }
