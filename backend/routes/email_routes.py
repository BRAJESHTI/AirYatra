"""
AirYatra Email Routes
API endpoints for sending and managing emails
"""

from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from typing import Optional, Dict, Any
from pydantic import BaseModel, EmailStr
import logging

from database import get_database
from middleware import get_current_user, require_roles
from models import UserRole
from services.email_service import email_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/email", tags=["Email"])

# ==================== REQUEST MODELS ====================

class TestEmailRequest(BaseModel):
    to_email: EmailStr
    template: str = "inquiry_customer"

class SendEmailRequest(BaseModel):
    to_email: EmailStr
    subject: str
    body: str
    cc: Optional[list] = None

# ==================== ENDPOINTS ====================

@router.get("/templates")
async def list_email_templates(
    user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN]))
):
    """List all available email templates"""
    templates = list(email_service.templates.keys())
    
    template_info = []
    for name in templates:
        template = email_service.templates[name]
        template_info.append({
            "name": name,
            "subject_preview": template["subject"][:50] + "..." if len(template["subject"]) > 50 else template["subject"],
            "type": name.split("_")[0],  # inquiry, quote, booking, etc.
            "recipient": name.split("_")[-1],  # customer, operator, admin
        })
    
    return {
        "total": len(templates),
        "templates": template_info
    }


@router.post("/test")
async def send_test_email(
    request: TestEmailRequest,
    background_tasks: BackgroundTasks,
    user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN]))
):
    """Send a test email using a template"""
    
    # Sample data for testing
    test_data = {
        "inquiry_id": "TEST1234",
        "booking_id": "BOOK5678",
        "customer_name": "Test Customer",
        "customer_email": request.to_email,
        "customer_phone": "+91-9876543210",
        "pickup_location": "Mumbai, Maharashtra",
        "drop_location": "Pune, Maharashtra",
        "departure_date": "2025-01-20",
        "departure_time": "10:00 AM",
        "passenger_count": 4,
        "flight_type": "One Way",
        "booking_purpose": "Wedding",
        "distance_km": 150,
        "estimated_price": "5,50,000",
        "total_amount": "5,50,000",
        "amount_paid": "5,50,000",
        "quoted_price": "5,25,000",
        "base_price": "4,50,000",
        "taxes": "75,000",
        "operator_name": "SkyHigh Aviation",
        "operator_company": "SkyHigh Aviation Pvt Ltd",
        "operator_rating": "4.8",
        "operator_phone": "+91-9876543210",
        "operator_email": "operator@test.com",
        "operator_payout": "4,84,000",
        "operator_earning": "4,84,000",
        "platform_commission": "66,000",
        "helicopter_model": "Bell 407",
        "pilot_name": "Capt. Rajesh Kumar",
        "payment_method": "UPI",
        "transaction_id": "TXN123456789",
        "payment_date": "26 Dec 2025, 02:30 PM",
        "receipt_no": "RCP-2025-001234",
        "quote_validity": "24 hours",
        "original_amount": "5,50,000",
        "cancellation_charge": "55,000",
        "refund_amount": "4,95,000",
        "payout_amount": "4,84,000",
        "status": "pending_acceptance",
        "operators_notified": 5,
        "tracking_url": "https://airyatra.co.in/inquiry/TEST1234",
        "booking_url": "https://airyatra.co.in/booking/BOOK5678",
        "quote_url": "https://airyatra.co.in/operator/quote/TEST1234",
        "accept_url": "https://airyatra.co.in/quote/accept/QT1234",
        "compare_url": "https://airyatra.co.in/inquiry/TEST1234",
        "dashboard_url": "https://airyatra.co.in/operator/dashboard",
        "admin_url": "https://airyatra.co.in/admin/inquiries",
        "review_url": "https://airyatra.co.in/review/BOOK5678",
    }
    
    # Send in background
    result = await email_service.send_template_email(
        request.template,
        request.to_email,
        test_data
    )
    
    return {
        "message": "Test email sent" if result.get("success") else "Failed to send email",
        "template": request.template,
        "to": request.to_email,
        "result": result
    }


@router.post("/send")
async def send_custom_email(
    request: SendEmailRequest,
    user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN]))
):
    """Send a custom email"""
    
    result = await email_service.send_email(
        request.to_email,
        request.subject,
        request.body,
        request.cc
    )
    
    return {
        "message": "Email sent" if result.get("success") else "Failed to send email",
        "result": result
    }


@router.post("/trigger/inquiry/{inquiry_id}")
async def trigger_inquiry_emails(
    inquiry_id: str,
    background_tasks: BackgroundTasks,
    user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN]))
):
    """Manually trigger inquiry emails for an inquiry"""
    db = get_database()
    
    # Get inquiry
    inquiry = await db.inquiries.find_one({"id": inquiry_id}, {"_id": 0})
    if not inquiry:
        raise HTTPException(status_code=404, detail="Inquiry not found")
    
    # Get assigned operators
    mappings = await db.inquiry_operator_mappings.find(
        {"inquiry_id": inquiry_id},
        {"_id": 0}
    ).to_list(50)
    
    operators = []
    for mapping in mappings:
        operator = await db.operators.find_one(
            {"id": mapping.get("operator_id")},
            {"_id": 0, "company_name": 1, "email": 1}
        )
        if operator:
            operators.append(operator)
    
    # Send emails
    result = await email_service.send_inquiry_emails(inquiry, operators)
    
    return {
        "message": "Inquiry emails triggered",
        "inquiry_id": inquiry_id,
        "emails_sent": result
    }


@router.post("/trigger/booking/{booking_id}")
async def trigger_booking_emails(
    booking_id: str,
    email_type: str = "confirmed",  # confirmed, cancelled, completed
    background_tasks: BackgroundTasks = None,
    user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN]))
):
    """Manually trigger booking emails"""
    db = get_database()
    
    # Get booking
    booking = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    # Get operator details
    if booking.get("operator_id"):
        operator = await db.operators.find_one(
            {"id": booking["operator_id"]},
            {"_id": 0, "company_name": 1, "email": 1, "contact_phone": 1}
        )
        if operator:
            booking["operator_name"] = operator.get("company_name")
            booking["operator_email"] = operator.get("email")
            booking["operator_phone"] = operator.get("contact_phone")
    
    # Send appropriate emails
    if email_type == "confirmed":
        result = await email_service.send_booking_confirmed_emails(booking)
    elif email_type == "cancelled":
        result = await email_service.send_cancellation_emails(booking)
    elif email_type == "completed":
        result = await email_service.send_flight_completed_emails(booking)
    else:
        raise HTTPException(status_code=400, detail=f"Invalid email type: {email_type}")
    
    return {
        "message": f"Booking {email_type} emails triggered",
        "booking_id": booking_id,
        "emails_sent": result
    }


@router.get("/status")
async def get_email_status(
    user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN]))
):
    """Check email service status and configuration"""
    
    # Check SMTP config
    smtp_configured = bool(
        email_service.config.get("host") and 
        email_service.config.get("username") and 
        email_service.config.get("password")
    )
    
    return {
        "status": "configured" if smtp_configured else "not_configured",
        "smtp_host": email_service.config.get("host"),
        "smtp_port": email_service.config.get("port"),
        "from_email": email_service.config.get("from_email"),
        "from_name": email_service.config.get("from_name"),
        "templates_available": len(email_service.templates),
        "template_types": list(set([t.split("_")[0] for t in email_service.templates.keys()]))
    }
