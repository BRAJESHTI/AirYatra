"""
Document Master & Verification API Settings Routes
Admin panel for managing document types and government verification APIs
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, timezone
from bson import ObjectId
from database import get_database
import os

router = APIRouter(prefix="/admin/documents", tags=["Document Master"])

# ============== MODELS ==============

class DocumentTypeCreate(BaseModel):
    name: str = Field(..., description="Document type name (e.g., Aadhar Card)")
    name_hi: Optional[str] = Field(None, description="Hindi name")
    category: str = Field(..., description="pilot, aircraft, customer, employee")
    code: str = Field(..., description="Unique code like AADHAR, PAN, DGCA_LICENSE")
    description: Optional[str] = None
    required_fields: List[str] = Field(default=["document_number"], description="Required fields for this doc type")
    has_expiry: bool = Field(default=False, description="Does this document expire?")
    expiry_alert_days: int = Field(default=30, description="Days before expiry to send alert")
    verification_api: Optional[str] = Field(None, description="API code for auto-verification")
    is_mandatory: bool = Field(default=False, description="Is this document mandatory?")
    is_active: bool = Field(default=True)
    display_order: int = Field(default=100)

class DocumentTypeUpdate(BaseModel):
    name: Optional[str] = None
    name_hi: Optional[str] = None
    description: Optional[str] = None
    required_fields: Optional[List[str]] = None
    has_expiry: Optional[bool] = None
    expiry_alert_days: Optional[int] = None
    verification_api: Optional[str] = None
    is_mandatory: Optional[bool] = None
    is_active: Optional[bool] = None
    display_order: Optional[int] = None

class VerificationAPICreate(BaseModel):
    name: str = Field(..., description="API name (e.g., Aadhar KYC)")
    code: str = Field(..., description="Unique code like AADHAR_KYC, PAN_VERIFY")
    provider: str = Field(..., description="Provider name (e.g., Surepass, Digio, UIDAI)")
    api_endpoint: Optional[str] = Field(None, description="Base API URL")
    api_key: Optional[str] = Field(None, description="API Key (will be masked)")
    api_secret: Optional[str] = Field(None, description="API Secret (will be masked)")
    sandbox_mode: bool = Field(default=True, description="Is in test/sandbox mode?")
    is_enabled: bool = Field(default=False, description="Is this API enabled?")
    verification_fields: List[str] = Field(default=[], description="Fields required for verification")
    response_mapping: dict = Field(default={}, description="How to map API response to our fields")
    rate_limit: int = Field(default=100, description="API calls per day limit")
    cost_per_call: float = Field(default=0, description="Cost per API call in INR")
    notes: Optional[str] = None

class VerificationAPIUpdate(BaseModel):
    name: Optional[str] = None
    provider: Optional[str] = None
    api_endpoint: Optional[str] = None
    api_key: Optional[str] = None
    api_secret: Optional[str] = None
    sandbox_mode: Optional[bool] = None
    is_enabled: Optional[bool] = None
    verification_fields: Optional[List[str]] = None
    response_mapping: Optional[dict] = None
    rate_limit: Optional[int] = None
    cost_per_call: Optional[float] = None
    notes: Optional[str] = None

# ============== DOCUMENT TYPE MASTER ==============

@router.get("/types")
async def get_document_types(category: Optional[str] = None, active_only: bool = True):
    """Get all document types, optionally filtered by category"""
    db = get_database()
    
    query = {}
    if category:
        query["category"] = category
    if active_only:
        query["is_active"] = True
    
    types = await db.document_types.find(query, {"_id": 0}).sort("display_order", 1).to_list(500)
    
    return {"document_types": types, "total": len(types)}

@router.get("/types/{type_id}")
async def get_document_type(type_id: str):
    """Get single document type by ID"""
    db = get_database()
    
    doc_type = await db.document_types.find_one({"id": type_id}, {"_id": 0})
    if not doc_type:
        raise HTTPException(status_code=404, detail="Document type not found")
    
    return doc_type

@router.post("/types")
async def create_document_type(data: DocumentTypeCreate):
    """Create new document type (Admin only)"""
    db = get_database()
    
    # Check if code already exists
    existing = await db.document_types.find_one({"code": data.code.upper()})
    if existing:
        raise HTTPException(status_code=400, detail=f"Document type with code '{data.code}' already exists")
    
    doc_type = {
        **data.dict(),
        "id": f"doctype_{ObjectId()}",
        "code": data.code.upper(),
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }
    
    await db.document_types.insert_one(doc_type)
    
    return {
        "message": "Document type created successfully",
        "id": doc_type["id"],
        "code": doc_type["code"]
    }

@router.put("/types/{type_id}")
async def update_document_type(type_id: str, data: DocumentTypeUpdate):
    """Update document type"""
    db = get_database()
    
    update_data = {k: v for k, v in data.dict().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No data to update")
    
    update_data["updated_at"] = datetime.now(timezone.utc)
    
    result = await db.document_types.update_one(
        {"id": type_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Document type not found")
    
    return {"message": "Document type updated successfully"}

@router.delete("/types/{type_id}")
async def delete_document_type(type_id: str):
    """Delete document type (soft delete - set inactive)"""
    db = get_database()
    
    # Check if exists
    doc_type = await db.document_types.find_one({"id": type_id})
    if not doc_type:
        raise HTTPException(status_code=404, detail="Document type not found")
    
    # Soft delete
    await db.document_types.update_one(
        {"id": type_id},
        {"$set": {"is_active": False, "deleted_at": datetime.now(timezone.utc)}}
    )
    
    return {"message": "Document type deactivated successfully"}

# ============== VERIFICATION API SETTINGS ==============

@router.get("/verification-apis")
async def get_verification_apis():
    """Get all verification API configurations"""
    db = get_database()
    
    apis = await db.verification_apis.find({}, {"_id": 0}).to_list(100)
    
    for api in apis:
        # Mask sensitive data
        if api.get("api_key"):
            api["api_key"] = "***" + api["api_key"][-4:] if len(api["api_key"]) > 4 else "****"
        if api.get("api_secret"):
            api["api_secret"] = "***" + api["api_secret"][-4:] if len(api["api_secret"]) > 4 else "****"
    
    return {"verification_apis": apis, "total": len(apis)}

@router.get("/verification-apis/{api_id}")
async def get_verification_api(api_id: str):
    """Get single verification API config"""
    db = get_database()
    
    api = await db.verification_apis.find_one({"id": api_id}, {"_id": 0})
    if not api:
        raise HTTPException(status_code=404, detail="Verification API not found")
    
    # Mask sensitive data for display
    if api.get("api_key"):
        api["api_key_masked"] = "***" + api["api_key"][-4:] if len(api["api_key"]) > 4 else "****"
    if api.get("api_secret"):
        api["api_secret_masked"] = "***" + api["api_secret"][-4:] if len(api["api_secret"]) > 4 else "****"
    
    return api

@router.post("/verification-apis")
async def create_verification_api(data: VerificationAPICreate):
    """Create new verification API configuration"""
    db = get_database()
    
    # Check if code already exists
    existing = await db.verification_apis.find_one({"code": data.code.upper()})
    if existing:
        raise HTTPException(status_code=400, detail=f"Verification API with code '{data.code}' already exists")
    
    api_config = {
        **data.dict(),
        "id": f"vapi_{ObjectId()}",
        "code": data.code.upper(),
        "total_calls": 0,
        "successful_calls": 0,
        "failed_calls": 0,
        "last_used": None,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }
    
    await db.verification_apis.insert_one(api_config)
    
    return {
        "message": "Verification API created successfully",
        "id": api_config["id"],
        "code": api_config["code"]
    }

@router.put("/verification-apis/{api_id}")
async def update_verification_api(api_id: str, data: VerificationAPIUpdate):
    """Update verification API configuration"""
    db = get_database()
    
    update_data = {k: v for k, v in data.dict().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No data to update")
    
    update_data["updated_at"] = datetime.now(timezone.utc)
    
    result = await db.verification_apis.update_one(
        {"id": api_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Verification API not found")
    
    return {"message": "Verification API updated successfully"}

@router.delete("/verification-apis/{api_id}")
async def delete_verification_api(api_id: str):
    """Delete verification API configuration"""
    db = get_database()
    
    result = await db.verification_apis.delete_one({"id": api_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Verification API not found")
    
    return {"message": "Verification API deleted successfully"}

@router.post("/verification-apis/{api_id}/test")
async def test_verification_api(api_id: str):
    """Test verification API connection"""
    db = get_database()
    
    api = await db.verification_apis.find_one({"id": api_id})
    if not api:
        raise HTTPException(status_code=404, detail="Verification API not found")
    
    # For now, return mock test result
    # In production, this would actually call the API
    return {
        "success": True,
        "message": f"Connection to {api['name']} successful (Sandbox Mode: {api.get('sandbox_mode', True)})",
        "latency_ms": 120,
        "api_status": "active",
        "note": "Real API integration requires valid credentials. Currently showing mock response."
    }

@router.post("/verification-apis/{api_id}/toggle")
async def toggle_verification_api(api_id: str):
    """Toggle verification API enabled/disabled"""
    db = get_database()
    
    api = await db.verification_apis.find_one({"id": api_id})
    if not api:
        raise HTTPException(status_code=404, detail="Verification API not found")
    
    new_status = not api.get("is_enabled", False)
    
    await db.verification_apis.update_one(
        {"id": api_id},
        {"$set": {"is_enabled": new_status, "updated_at": datetime.now(timezone.utc)}}
    )
    
    return {
        "message": f"Verification API {'enabled' if new_status else 'disabled'}",
        "is_enabled": new_status
    }

# ============== VERIFY DOCUMENT ==============

@router.post("/verify")
async def verify_document(document_type: str, document_number: str, additional_data: dict = {}):
    """
    Verify a document using configured API
    This is a placeholder - actual implementation requires real API credentials
    """
    db = get_database()
    
    # Find the document type
    doc_type = await db.document_types.find_one({"code": document_type.upper(), "is_active": True})
    if not doc_type:
        raise HTTPException(status_code=404, detail="Document type not found")
    
    verification_api_code = doc_type.get("verification_api")
    if not verification_api_code:
        return {
            "verified": False,
            "status": "no_api",
            "message": "No verification API configured for this document type"
        }
    
    # Find the verification API
    api = await db.verification_apis.find_one({"code": verification_api_code, "is_enabled": True})
    if not api:
        return {
            "verified": False,
            "status": "api_disabled",
            "message": "Verification API is not enabled"
        }
    
    # Log verification attempt
    verification_log = {
        "id": f"vlog_{ObjectId()}",
        "document_type": document_type,
        "document_number": document_number[:4] + "****" + document_number[-4:] if len(document_number) > 8 else "****",
        "api_code": verification_api_code,
        "sandbox_mode": api.get("sandbox_mode", True),
        "timestamp": datetime.now(timezone.utc),
        "status": "pending"
    }
    
    # In sandbox/demo mode, return mock success
    if api.get("sandbox_mode", True):
        verification_log["status"] = "success"
        verification_log["response"] = {"mock": True, "verified": True}
        await db.verification_logs.insert_one(verification_log)
        
        # Update API stats
        await db.verification_apis.update_one(
            {"id": api["id"]},
            {
                "$inc": {"total_calls": 1, "successful_calls": 1},
                "$set": {"last_used": datetime.now(timezone.utc)}
            }
        )
        
        return {
            "verified": True,
            "status": "success",
            "message": f"Document verified successfully (Sandbox Mode)",
            "sandbox_mode": True,
            "details": {
                "document_type": doc_type["name"],
                "verification_api": api["name"],
                "verified_at": datetime.now(timezone.utc).isoformat()
            }
        }
    
    # Real API call would go here
    return {
        "verified": False,
        "status": "not_implemented",
        "message": "Real API verification not yet implemented. Please configure API credentials and contact support."
    }

# ============== SEED DEFAULT DOCUMENT TYPES ==============

@router.post("/seed-defaults")
async def seed_default_document_types():
    """Seed default document types and verification APIs"""
    db = get_database()
    
    # Default Document Types
    default_types = [
        # Customer Documents
        {"name": "Aadhar Card", "name_hi": "आधार कार्ड", "category": "customer", "code": "AADHAR", "has_expiry": False, "is_mandatory": True, "verification_api": "AADHAR_KYC", "required_fields": ["document_number"], "display_order": 1},
        {"name": "PAN Card", "name_hi": "पैन कार्ड", "category": "customer", "code": "PAN", "has_expiry": False, "is_mandatory": True, "verification_api": "PAN_VERIFY", "required_fields": ["document_number", "name"], "display_order": 2},
        {"name": "Passport", "name_hi": "पासपोर्ट", "category": "customer", "code": "PASSPORT", "has_expiry": True, "expiry_alert_days": 90, "verification_api": "PASSPORT_VERIFY", "required_fields": ["document_number", "expiry_date"], "display_order": 3},
        {"name": "Driving License", "name_hi": "ड्राइविंग लाइसेंस", "category": "customer", "code": "DL", "has_expiry": True, "expiry_alert_days": 30, "verification_api": "DL_VERIFY", "required_fields": ["document_number", "expiry_date"], "display_order": 4},
        {"name": "Voter ID", "name_hi": "मतदाता पहचान पत्र", "category": "customer", "code": "VOTER_ID", "has_expiry": False, "required_fields": ["document_number"], "display_order": 5},
        {"name": "Bank Account", "name_hi": "बैंक खाता", "category": "customer", "code": "BANK_ACCOUNT", "has_expiry": False, "verification_api": "BANK_VERIFY", "required_fields": ["account_number", "ifsc_code", "account_holder_name"], "display_order": 6},
        
        # Pilot Documents
        {"name": "Pilot License (CPL/ATPL)", "name_hi": "पायलट लाइसेंस", "category": "pilot", "code": "PILOT_LICENSE", "has_expiry": True, "expiry_alert_days": 60, "is_mandatory": True, "verification_api": "DGCA_LICENSE", "required_fields": ["document_number", "expiry_date", "license_type"], "display_order": 1},
        {"name": "Medical Certificate", "name_hi": "चिकित्सा प्रमाणपत्र", "category": "pilot", "code": "MEDICAL_CERT", "has_expiry": True, "expiry_alert_days": 30, "is_mandatory": True, "required_fields": ["document_number", "expiry_date", "medical_class"], "display_order": 2},
        {"name": "Type Rating", "name_hi": "टाइप रेटिंग", "category": "pilot", "code": "TYPE_RATING", "has_expiry": True, "expiry_alert_days": 60, "required_fields": ["document_number", "aircraft_type", "expiry_date"], "display_order": 3},
        {"name": "Instrument Rating", "name_hi": "इंस्ट्रूमेंट रेटिंग", "category": "pilot", "code": "IR", "has_expiry": True, "expiry_alert_days": 60, "required_fields": ["document_number", "expiry_date"], "display_order": 4},
        {"name": "English Proficiency (ICAO)", "name_hi": "अंग्रेजी दक्षता", "category": "pilot", "code": "ELP", "has_expiry": True, "expiry_alert_days": 90, "required_fields": ["level", "expiry_date"], "display_order": 5},
        {"name": "Security Clearance", "name_hi": "सुरक्षा मंजूरी", "category": "pilot", "code": "SECURITY_CLEARANCE", "has_expiry": True, "expiry_alert_days": 30, "required_fields": ["document_number", "expiry_date"], "display_order": 6},
        {"name": "FRTO License", "name_hi": "FRTO लाइसेंस", "category": "pilot", "code": "FRTO", "has_expiry": True, "expiry_alert_days": 30, "required_fields": ["document_number", "expiry_date"], "display_order": 7},
        
        # Aircraft Documents
        {"name": "Certificate of Airworthiness", "name_hi": "उड़ान योग्यता प्रमाणपत्र", "category": "aircraft", "code": "C_OF_A", "has_expiry": True, "expiry_alert_days": 45, "is_mandatory": True, "required_fields": ["document_number", "expiry_date"], "display_order": 1},
        {"name": "Aircraft Insurance", "name_hi": "विमान बीमा", "category": "aircraft", "code": "INSURANCE", "has_expiry": True, "expiry_alert_days": 30, "is_mandatory": True, "required_fields": ["policy_number", "expiry_date", "insurer"], "display_order": 2},
        {"name": "Registration Certificate", "name_hi": "पंजीकरण प्रमाणपत्र", "category": "aircraft", "code": "REGISTRATION", "has_expiry": False, "is_mandatory": True, "required_fields": ["registration_number"], "display_order": 3},
        {"name": "Airworthiness Review Certificate", "name_hi": "ARC", "category": "aircraft", "code": "ARC", "has_expiry": True, "expiry_alert_days": 30, "required_fields": ["document_number", "expiry_date"], "display_order": 4},
        {"name": "Radio Station License", "name_hi": "रेडियो लाइसेंस", "category": "aircraft", "code": "RADIO_LICENSE", "has_expiry": True, "expiry_alert_days": 30, "required_fields": ["document_number", "expiry_date"], "display_order": 5},
        {"name": "Noise Certificate", "name_hi": "शोर प्रमाणपत्र", "category": "aircraft", "code": "NOISE_CERT", "has_expiry": False, "required_fields": ["document_number"], "display_order": 6},
        {"name": "Flight Manual", "name_hi": "फ्लाइट मैनुअल", "category": "aircraft", "code": "FLIGHT_MANUAL", "has_expiry": False, "required_fields": ["revision_number"], "display_order": 7},
        
        # Employee Documents
        {"name": "Aadhar Card", "name_hi": "आधार कार्ड", "category": "employee", "code": "EMP_AADHAR", "has_expiry": False, "is_mandatory": True, "verification_api": "AADHAR_KYC", "required_fields": ["document_number"], "display_order": 1},
        {"name": "PAN Card", "name_hi": "पैन कार्ड", "category": "employee", "code": "EMP_PAN", "has_expiry": False, "is_mandatory": True, "verification_api": "PAN_VERIFY", "required_fields": ["document_number"], "display_order": 2},
        {"name": "Bank Account Details", "name_hi": "बैंक खाता विवरण", "category": "employee", "code": "EMP_BANK", "has_expiry": False, "is_mandatory": True, "verification_api": "BANK_VERIFY", "required_fields": ["account_number", "ifsc_code"], "display_order": 3},
        {"name": "Resume/CV", "name_hi": "बायोडाटा", "category": "employee", "code": "RESUME", "has_expiry": False, "required_fields": [], "display_order": 4},
        {"name": "Offer Letter", "name_hi": "ऑफर लेटर", "category": "employee", "code": "OFFER_LETTER", "has_expiry": False, "required_fields": ["date_of_joining"], "display_order": 5},
        {"name": "Educational Certificates", "name_hi": "शैक्षिक प्रमाणपत्र", "category": "employee", "code": "EDUCATION", "has_expiry": False, "required_fields": ["degree", "institution"], "display_order": 6},
        {"name": "Experience Letters", "name_hi": "अनुभव प्रमाणपत्र", "category": "employee", "code": "EXPERIENCE", "has_expiry": False, "required_fields": ["company", "duration"], "display_order": 7},
    ]
    
    # Default Verification APIs
    default_apis = [
        {
            "name": "Aadhar eKYC", "code": "AADHAR_KYC", "provider": "UIDAI / Surepass / Digio",
            "api_endpoint": "https://api.surepass.io/api/v1/aadhaar-v2/",
            "verification_fields": ["aadhaar_number", "otp"],
            "sandbox_mode": True, "is_enabled": False,
            "rate_limit": 1000, "cost_per_call": 3.5,
            "notes": "Requires UIDAI license or third-party provider. Configure API key from provider dashboard."
        },
        {
            "name": "PAN Verification", "code": "PAN_VERIFY", "provider": "NSDL / Surepass / Karza",
            "api_endpoint": "https://api.surepass.io/api/v1/pan/verify",
            "verification_fields": ["pan_number", "name"],
            "sandbox_mode": True, "is_enabled": False,
            "rate_limit": 1000, "cost_per_call": 2.0,
            "notes": "Verifies PAN number and name match"
        },
        {
            "name": "Bank Account Verification", "code": "BANK_VERIFY", "provider": "Cashfree / Razorpay / Surepass",
            "api_endpoint": "https://api.surepass.io/api/v1/bank-verification/",
            "verification_fields": ["account_number", "ifsc_code", "account_holder_name"],
            "sandbox_mode": True, "is_enabled": False,
            "rate_limit": 500, "cost_per_call": 5.0,
            "notes": "Penny drop verification for bank accounts"
        },
        {
            "name": "Passport Verification", "code": "PASSPORT_VERIFY", "provider": "Surepass / Karza",
            "api_endpoint": "https://api.surepass.io/api/v1/passport/verify",
            "verification_fields": ["passport_number", "dob", "name"],
            "sandbox_mode": True, "is_enabled": False,
            "rate_limit": 200, "cost_per_call": 10.0,
            "notes": "Verifies Indian passport details"
        },
        {
            "name": "Driving License Verification", "code": "DL_VERIFY", "provider": "Surepass / Signzy",
            "api_endpoint": "https://api.surepass.io/api/v1/driving-license/verify",
            "verification_fields": ["dl_number", "dob"],
            "sandbox_mode": True, "is_enabled": False,
            "rate_limit": 500, "cost_per_call": 3.0,
            "notes": "Verifies driving license from MoRTH database"
        },
        {
            "name": "DGCA License Verification", "code": "DGCA_LICENSE", "provider": "DGCA / Custom Integration",
            "api_endpoint": "https://dgca.gov.in/api/verify",
            "verification_fields": ["license_number", "license_type"],
            "sandbox_mode": True, "is_enabled": False,
            "rate_limit": 100, "cost_per_call": 0,
            "notes": "DGCA pilot license verification. May require special access/MOU with DGCA."
        },
        {
            "name": "GST Verification", "code": "GST_VERIFY", "provider": "GSTN / Surepass",
            "api_endpoint": "https://api.surepass.io/api/v1/gst/verify",
            "verification_fields": ["gst_number"],
            "sandbox_mode": True, "is_enabled": False,
            "rate_limit": 500, "cost_per_call": 2.0,
            "notes": "Verifies GST registration details"
        },
        {
            "name": "Company Verification (CIN/LLP)", "code": "COMPANY_VERIFY", "provider": "MCA / Karza",
            "api_endpoint": "https://api.surepass.io/api/v1/company/verify",
            "verification_fields": ["cin_number"],
            "sandbox_mode": True, "is_enabled": False,
            "rate_limit": 200, "cost_per_call": 5.0,
            "notes": "Verifies company registration from MCA"
        },
    ]
    
    # Insert document types
    types_created = 0
    for doc_type in default_types:
        existing = await db.document_types.find_one({"code": doc_type["code"]})
        if not existing:
            doc_type["id"] = f"doctype_{ObjectId()}"
            doc_type["is_active"] = True
            doc_type["created_at"] = datetime.now(timezone.utc)
            doc_type["updated_at"] = datetime.now(timezone.utc)
            await db.document_types.insert_one(doc_type)
            types_created += 1
    
    # Insert verification APIs
    apis_created = 0
    for api in default_apis:
        existing = await db.verification_apis.find_one({"code": api["code"]})
        if not existing:
            api["id"] = f"vapi_{ObjectId()}"
            api["total_calls"] = 0
            api["successful_calls"] = 0
            api["failed_calls"] = 0
            api["last_used"] = None
            api["created_at"] = datetime.now(timezone.utc)
            api["updated_at"] = datetime.now(timezone.utc)
            await db.verification_apis.insert_one(api)
            apis_created += 1
    
    return {
        "message": "Default data seeded successfully",
        "document_types_created": types_created,
        "verification_apis_created": apis_created
    }

# ============== VERIFICATION LOGS ==============

@router.get("/verification-logs")
async def get_verification_logs(limit: int = 50, api_code: Optional[str] = None):
    """Get verification logs"""
    db = get_database()
    
    query = {}
    if api_code:
        query["api_code"] = api_code.upper()
    
    logs = await db.verification_logs.find(query, {"_id": 0}).sort("timestamp", -1).limit(limit).to_list(limit)
    
    return {"logs": logs, "total": len(logs)}

# ============== STATISTICS ==============

@router.get("/stats")
async def get_document_stats():
    """Get document and verification statistics"""
    db = get_database()
    
    # Document type counts by category
    type_counts = {}
    for category in ["customer", "pilot", "aircraft", "employee"]:
        type_counts[category] = await db.document_types.count_documents({"category": category, "is_active": True})
    
    # Verification API stats
    apis = await db.verification_apis.find({}).to_list(100)
    total_apis = len(apis)
    enabled_apis = sum(1 for a in apis if a.get("is_enabled"))
    total_verifications = sum(a.get("total_calls", 0) for a in apis)
    successful_verifications = sum(a.get("successful_calls", 0) for a in apis)
    
    return {
        "document_types": {
            "total": sum(type_counts.values()),
            "by_category": type_counts
        },
        "verification_apis": {
            "total": total_apis,
            "enabled": enabled_apis,
            "disabled": total_apis - enabled_apis
        },
        "verifications": {
            "total": total_verifications,
            "successful": successful_verifications,
            "success_rate": round(successful_verifications / total_verifications * 100, 1) if total_verifications > 0 else 0
        }
    }
