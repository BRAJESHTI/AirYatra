from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, EmailStr
from typing import Optional
from uuid import uuid4
from datetime import datetime, timezone, timedelta
import random
import string
from database import get_database

router = APIRouter(prefix="/verification", tags=["Verification"])

class SendOTPRequest(BaseModel):
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    purpose: str = "registration"  # registration, login, password_reset

class VerifyOTPRequest(BaseModel):
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    otp: str
    purpose: str = "registration"

class TermsAgreementRequest(BaseModel):
    user_type: str  # customer, operator, pilot
    email: str
    phone: str
    full_name: str
    email_otp: str
    phone_otp: str
    agreed_terms: bool = True
    agreed_privacy: bool = True
    agreed_insurance: bool = False

def generate_otp(length: int = 6) -> str:
    """Generate a numeric OTP"""
    return ''.join(random.choices(string.digits, k=length))

@router.post("/send-otp")
async def send_otp(request: SendOTPRequest, db=Depends(get_database)):
    """Send OTP to email or phone"""
    if not request.email and not request.phone:
        raise HTTPException(status_code=400, detail="Email or phone required")
    
    otp = generate_otp()
    expiry = datetime.now(timezone.utc) + timedelta(minutes=10)
    
    otp_record = {
        "id": str(uuid4()),
        "email": request.email,
        "phone": request.phone,
        "otp": otp,
        "purpose": request.purpose,
        "verified": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "expires_at": expiry.isoformat()
    }
    
    # Store OTP
    await db.otp_records.insert_one(otp_record)
    
    # Get API keys to check if email/SMS service is configured
    api_keys = await db.api_keys_settings.find_one({"type": "api_keys"}, {"_id": 0})
    
    email_sent = False
    sms_sent = False
    
    if request.email:
        if api_keys and api_keys.get("sendgrid_api_key"):
            # TODO: Send actual email via SendGrid
            # For now, we'll mock it
            email_sent = True
        else:
            # Mock email sending - log OTP for testing
            print(f"[MOCK EMAIL] OTP for {request.email}: {otp}")
            email_sent = True
    
    if request.phone:
        if api_keys and api_keys.get("twilio_account_sid"):
            # TODO: Send actual SMS via Twilio
            sms_sent = True
        else:
            # Mock SMS sending - log OTP for testing
            print(f"[MOCK SMS] OTP for {request.phone}: {otp}")
            sms_sent = True
    
    return {
        "message": "OTP sent successfully",
        "email_sent": email_sent if request.email else None,
        "sms_sent": sms_sent if request.phone else None,
        "expires_in_minutes": 10,
        # Include OTP in response for testing (remove in production)
        "debug_otp": otp  # Remove this line in production
    }

@router.post("/verify-otp")
async def verify_otp(request: VerifyOTPRequest, db=Depends(get_database)):
    """Verify OTP"""
    if not request.email and not request.phone:
        raise HTTPException(status_code=400, detail="Email or phone required")
    
    query = {"purpose": request.purpose, "verified": False}
    if request.email:
        query["email"] = request.email
    if request.phone:
        query["phone"] = request.phone
    
    # Find latest OTP
    otp_record = await db.otp_records.find_one(
        query,
        sort=[("created_at", -1)]
    )
    
    if not otp_record:
        raise HTTPException(status_code=404, detail="No OTP found. Please request a new one.")
    
    # Check expiry
    expiry = datetime.fromisoformat(otp_record["expires_at"].replace("Z", "+00:00"))
    if datetime.now(timezone.utc) > expiry:
        raise HTTPException(status_code=400, detail="OTP expired. Please request a new one.")
    
    # Verify OTP
    if otp_record["otp"] != request.otp:
        raise HTTPException(status_code=400, detail="Invalid OTP")
    
    # Mark as verified
    await db.otp_records.update_one(
        {"id": otp_record["id"]},
        {"$set": {"verified": True, "verified_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {
        "message": "OTP verified successfully",
        "verified": True,
        "verification_id": otp_record["id"]
    }

@router.post("/agree-terms")
async def record_terms_agreement(request: TermsAgreementRequest, db=Depends(get_database)):
    """Record terms and conditions agreement with OTP verification"""
    
    # Verify email OTP
    email_otp = await db.otp_records.find_one({
        "email": request.email,
        "otp": request.email_otp,
        "verified": True,
        "purpose": "registration"
    })
    
    if not email_otp:
        raise HTTPException(status_code=400, detail="Email OTP not verified")
    
    # Verify phone OTP
    phone_otp = await db.otp_records.find_one({
        "phone": request.phone,
        "otp": request.phone_otp,
        "verified": True,
        "purpose": "registration"
    })
    
    if not phone_otp:
        raise HTTPException(status_code=400, detail="Phone OTP not verified")
    
    # Record agreement
    agreement = {
        "id": str(uuid4()),
        "user_type": request.user_type,
        "email": request.email,
        "phone": request.phone,
        "full_name": request.full_name,
        "email_verified": True,
        "email_verification_id": email_otp["id"],
        "phone_verified": True,
        "phone_verification_id": phone_otp["id"],
        "agreed_terms": request.agreed_terms,
        "agreed_privacy": request.agreed_privacy,
        "agreed_insurance": request.agreed_insurance,
        "agreed_at": datetime.now(timezone.utc).isoformat(),
        "ip_address": None,  # Can be captured from request
        "user_agent": None   # Can be captured from request
    }
    
    await db.terms_agreements.insert_one(agreement)
    
    return {
        "message": "Terms agreement recorded successfully",
        "agreement_id": agreement["id"],
        "email_verified": True,
        "phone_verified": True
    }

@router.get("/check-verification/{email}")
async def check_verification_status(email: str, db=Depends(get_database)):
    """Check if email/phone is already verified"""
    
    email_verified = await db.otp_records.find_one({
        "email": email,
        "verified": True,
        "purpose": "registration"
    })
    
    return {
        "email": email,
        "email_verified": email_verified is not None
    }
