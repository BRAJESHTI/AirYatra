"""
Template Management Routes - AirYatra Aviation Platform
Manage SMS, WhatsApp, Email, and Payment notification templates
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from typing import Optional, List
from datetime import datetime, timezone
from pydantic import BaseModel, Field
import uuid

from database import get_database
from middleware import require_roles

router = APIRouter(prefix="/templates", tags=["Template Management"])


# ==================== MODELS ====================

class TemplateBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    category: str = Field(..., pattern="^(sms|whatsapp|email|payment)$")
    subject: Optional[str] = None  # For email templates
    content: str = Field(..., min_length=10)
    content_hindi: Optional[str] = None  # Hindi version
    variables: List[str] = []  # Available placeholders like {{customer_name}}, {{booking_id}}
    trigger_event: Optional[str] = None  # booking_confirmed, payment_success, etc.
    is_active: bool = True
    priority: int = 0  # Higher priority = used first


class TemplateCreate(TemplateBase):
    pass


class TemplateUpdate(BaseModel):
    name: Optional[str] = None
    subject: Optional[str] = None
    content: Optional[str] = None
    content_hindi: Optional[str] = None
    variables: Optional[List[str]] = None
    trigger_event: Optional[str] = None
    is_active: Optional[bool] = None
    priority: Optional[int] = None


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
    """Get all available template variables grouped by category"""
    return {
        "success": True,
        "variables": TEMPLATE_VARIABLES,
        "trigger_events": TRIGGER_EVENTS
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
        "variables": template.variables,
        "trigger_event": template.trigger_event,
        "is_active": template.is_active,
        "priority": template.priority,
        "usage_count": 0,
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
