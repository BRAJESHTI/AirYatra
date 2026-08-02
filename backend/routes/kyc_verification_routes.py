"""
KYC Verification Service Routes
Sandbox/Mock verification for Aadhar, PAN, DL, Passport, Bank Account
Real API format but simulated responses for testing
"""
from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from datetime import datetime, timezone
from bson import ObjectId
from database import get_database
from middleware import get_current_user
from security_middleware import AuditLogger
import re
import random
import string

router = APIRouter(prefix="/kyc", tags=["KYC Verification"])

# ============== REQUEST MODELS ==============

class AadharVerifyRequest(BaseModel):
    aadhaar_number: str = Field(..., description="12-digit Aadhar number")
    name: Optional[str] = Field(None, description="Name for matching (optional)")
    
class PANVerifyRequest(BaseModel):
    pan_number: str = Field(..., description="10-character PAN")
    name: Optional[str] = Field(None, description="Name for matching")
    
class DLVerifyRequest(BaseModel):
    dl_number: str = Field(..., description="Driving License number")
    dob: str = Field(..., description="Date of birth (YYYY-MM-DD)")

class PassportVerifyRequest(BaseModel):
    passport_number: str = Field(..., description="Passport number")
    dob: str = Field(..., description="Date of birth (YYYY-MM-DD)")
    name: Optional[str] = Field(None, description="Name for matching")

class BankVerifyRequest(BaseModel):
    account_number: str = Field(..., description="Bank account number")
    ifsc_code: str = Field(..., description="IFSC code")
    account_holder_name: str = Field(..., description="Account holder name")

class GenericVerifyRequest(BaseModel):
    document_type: str = Field(..., description="Document type code")
    document_number: str = Field(..., description="Document number")
    additional_data: Optional[Dict[str, Any]] = Field(default_factory=dict)

# ============== HELPER FUNCTIONS ==============

def generate_reference_id():
    """Generate unique reference ID for verification"""
    return f"VRF{datetime.now().strftime('%Y%m%d%H%M%S')}{random.randint(1000, 9999)}"

def validate_aadhaar(number: str) -> tuple:
    """Validate Aadhar number format"""
    clean = re.sub(r'[\s-]', '', number)
    if len(clean) != 12 or not clean.isdigit():
        return False, "Invalid Aadhar format. Must be 12 digits."
    # First digit cannot be 0 or 1
    if clean[0] in '01':
        return False, "Invalid Aadhar. First digit cannot be 0 or 1."
    return True, clean

def validate_pan(pan: str) -> tuple:
    """Validate PAN format"""
    pan = pan.upper().strip()
    # PAN format: AAAAA9999A
    pattern = r'^[A-Z]{5}[0-9]{4}[A-Z]$'
    if not re.match(pattern, pan):
        return False, "Invalid PAN format. Must be like ABCDE1234F"
    return True, pan

def validate_ifsc(ifsc: str) -> tuple:
    """Validate IFSC code format"""
    ifsc = ifsc.upper().strip()
    pattern = r'^[A-Z]{4}0[A-Z0-9]{6}$'
    if not re.match(pattern, ifsc):
        return False, "Invalid IFSC format. Must be like SBIN0001234"
    return True, ifsc

def generate_mock_name():
    """Generate realistic Indian name for mock data"""
    first_names = ["Rahul", "Priya", "Amit", "Sneha", "Vijay", "Anita", "Suresh", "Kavita", "Rajesh", "Meera"]
    last_names = ["Sharma", "Patel", "Singh", "Kumar", "Verma", "Gupta", "Joshi", "Rao", "Reddy", "Mehta"]
    return f"{random.choice(first_names)} {random.choice(last_names)}"

def mask_number(number: str, visible_start: int = 4, visible_end: int = 4) -> str:
    """Mask middle portion of a number"""
    if len(number) <= visible_start + visible_end:
        return number
    return number[:visible_start] + '*' * (len(number) - visible_start - visible_end) + number[-visible_end:]

# ============== VERIFICATION ENDPOINTS ==============

@router.post("/verify/aadhaar")
async def verify_aadhaar(
    request: Request,
    data: AadharVerifyRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Verify Aadhar Card (SANDBOX MODE)
    Returns mock success response in format similar to real KYC providers
    """
    db = get_database()
    
    # Validate format
    is_valid, result = validate_aadhaar(data.aadhaar_number)
    if not is_valid:
        raise HTTPException(status_code=400, detail=result)
    
    clean_aadhaar = result
    ref_id = generate_reference_id()
    
    # Create verification log
    log_entry = {
        "id": f"vlog_{ObjectId()}",
        "reference_id": ref_id,
        "document_type": "AADHAR",
        "document_number_masked": mask_number(clean_aadhaar),
        "user_id": current_user.get("id"),
        "api_code": "AADHAR_KYC",
        "sandbox_mode": True,
        "status": "success",
        "timestamp": datetime.now(timezone.utc),
        "ip_address": request.client.host if request.client else None
    }
    
    # Generate mock response
    mock_name = data.name or generate_mock_name()
    mock_response = {
        "verified": True,
        "reference_id": ref_id,
        "status": "success",
        "status_code": 200,
        "sandbox_mode": True,
        "data": {
            "aadhaar_number": mask_number(clean_aadhaar, 8, 4),
            "full_name": mock_name,
            "gender": random.choice(["M", "F"]),
            "dob": f"19{random.randint(70, 99)}-{random.randint(1,12):02d}-{random.randint(1,28):02d}",
            "address": {
                "house": f"{random.randint(1, 500)}",
                "street": f"{random.choice(['Main', 'Park', 'Gandhi', 'Nehru'])} Road",
                "locality": f"{random.choice(['Sector', 'Phase', 'Block'])} {random.randint(1, 50)}",
                "city": random.choice(["Mumbai", "Delhi", "Bangalore", "Chennai", "Hyderabad"]),
                "state": random.choice(["Maharashtra", "Delhi", "Karnataka", "Tamil Nadu", "Telangana"]),
                "pincode": f"{random.randint(100, 800)}0{random.randint(10, 99)}"
            },
            "split_address": True,
            "photo_available": True,
            "aadhaar_linked_mobile": True
        },
        "message": "Aadhar verification successful (Sandbox Mode)",
        "message_hi": "आधार सत्यापन सफल (सैंडबॉक्स मोड)"
    }
    
    log_entry["response_summary"] = {"verified": True, "name_matched": True}
    await db.verification_logs.insert_one(log_entry)
    
    # Update API stats
    await db.verification_apis.update_one(
        {"code": "AADHAR_KYC"},
        {
            "$inc": {"total_calls": 1, "successful_calls": 1},
            "$set": {"last_used": datetime.now(timezone.utc)}
        }
    )
    
    # Audit log
    try:
        audit = AuditLogger(db)
        await audit.log(
            action="verify_document",
            category=AuditLogger.CATEGORY_DATA_ACCESS,
            user_id=current_user.get("id"),
            user_email=current_user.get("email"),
            resource_type="aadhaar_verification",
            resource_id=ref_id,
            details={"document_type": "AADHAR", "sandbox": True},
            ip_address=request.client.host if request.client else None,
            status="success"
        )
    except Exception:
        pass
    
    return mock_response


@router.post("/verify/pan")
async def verify_pan(
    request: Request,
    data: PANVerifyRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Verify PAN Card (SANDBOX MODE)
    """
    db = get_database()
    
    # Validate format
    is_valid, result = validate_pan(data.pan_number)
    if not is_valid:
        raise HTTPException(status_code=400, detail=result)
    
    clean_pan = result
    ref_id = generate_reference_id()
    
    # Determine PAN holder type from 4th character
    pan_types = {'P': 'Individual', 'C': 'Company', 'H': 'HUF', 'F': 'Firm', 'A': 'AOP', 'T': 'Trust'}
    pan_type = pan_types.get(clean_pan[3], 'Individual')
    
    # Create verification log
    log_entry = {
        "id": f"vlog_{ObjectId()}",
        "reference_id": ref_id,
        "document_type": "PAN",
        "document_number_masked": clean_pan[:2] + "****" + clean_pan[-2:],
        "user_id": current_user.get("id"),
        "api_code": "PAN_VERIFY",
        "sandbox_mode": True,
        "status": "success",
        "timestamp": datetime.now(timezone.utc)
    }
    
    mock_name = data.name or generate_mock_name()
    mock_response = {
        "verified": True,
        "reference_id": ref_id,
        "status": "success",
        "status_code": 200,
        "sandbox_mode": True,
        "data": {
            "pan_number": clean_pan,
            "full_name": mock_name.upper(),
            "pan_type": pan_type,
            "name_match_score": 95 if data.name else None,
            "pan_status": "Active",
            "aadhaar_seeding_status": random.choice(["Linked", "Not Linked"]),
            "last_updated": datetime.now(timezone.utc).strftime("%d-%m-%Y")
        },
        "message": "PAN verification successful (Sandbox Mode)",
        "message_hi": "पैन सत्यापन सफल (सैंडबॉक्स मोड)"
    }
    
    log_entry["response_summary"] = {"verified": True, "pan_status": "Active"}
    await db.verification_logs.insert_one(log_entry)
    
    await db.verification_apis.update_one(
        {"code": "PAN_VERIFY"},
        {
            "$inc": {"total_calls": 1, "successful_calls": 1},
            "$set": {"last_used": datetime.now(timezone.utc)}
        }
    )
    
    return mock_response


@router.post("/verify/dl")
async def verify_driving_license(
    request: Request,
    data: DLVerifyRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Verify Driving License (SANDBOX MODE)
    """
    db = get_database()
    ref_id = generate_reference_id()
    
    mock_response = {
        "verified": True,
        "reference_id": ref_id,
        "status": "success",
        "status_code": 200,
        "sandbox_mode": True,
        "data": {
            "dl_number": data.dl_number.upper(),
            "full_name": generate_mock_name().upper(),
            "dob": data.dob,
            "gender": random.choice(["M", "F"]),
            "blood_group": random.choice(["A+", "B+", "O+", "AB+", "A-", "B-"]),
            "issue_date": "2020-05-15",
            "validity": {
                "non_transport": "2040-05-14",
                "transport": "2025-05-14"
            },
            "vehicle_classes": random.sample(["LMV", "MCWG", "MCWOG", "TRANS"], k=random.randint(1,3)),
            "issuing_authority": f"RTO {random.choice(['Mumbai', 'Delhi', 'Bangalore', 'Chennai'])}",
            "state": random.choice(["MH", "DL", "KA", "TN"])
        },
        "message": "Driving License verification successful (Sandbox Mode)",
        "message_hi": "ड्राइविंग लाइसेंस सत्यापन सफल (सैंडबॉक्स मोड)"
    }
    
    # Log and update stats
    await db.verification_logs.insert_one({
        "id": f"vlog_{ObjectId()}",
        "reference_id": ref_id,
        "document_type": "DL",
        "user_id": current_user.get("id"),
        "api_code": "DL_VERIFY",
        "sandbox_mode": True,
        "status": "success",
        "timestamp": datetime.now(timezone.utc)
    })
    
    await db.verification_apis.update_one(
        {"code": "DL_VERIFY"},
        {"$inc": {"total_calls": 1, "successful_calls": 1}, "$set": {"last_used": datetime.now(timezone.utc)}}
    )
    
    return mock_response


@router.post("/verify/passport")
async def verify_passport(
    request: Request,
    data: PassportVerifyRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Verify Passport (SANDBOX MODE)
    """
    db = get_database()
    ref_id = generate_reference_id()
    
    mock_response = {
        "verified": True,
        "reference_id": ref_id,
        "status": "success",
        "status_code": 200,
        "sandbox_mode": True,
        "data": {
            "passport_number": data.passport_number.upper(),
            "full_name": data.name or generate_mock_name().upper(),
            "dob": data.dob,
            "gender": random.choice(["M", "F"]),
            "nationality": "INDIAN",
            "place_of_birth": random.choice(["Mumbai", "Delhi", "Kolkata", "Chennai"]),
            "issue_date": "2022-01-15",
            "expiry_date": "2032-01-14",
            "type": "P",
            "passport_office": random.choice(["Mumbai", "Delhi", "Kolkata", "Chennai"]) + " Passport Office"
        },
        "message": "Passport verification successful (Sandbox Mode)",
        "message_hi": "पासपोर्ट सत्यापन सफल (सैंडबॉक्स मोड)"
    }
    
    await db.verification_logs.insert_one({
        "id": f"vlog_{ObjectId()}",
        "reference_id": ref_id,
        "document_type": "PASSPORT",
        "user_id": current_user.get("id"),
        "api_code": "PASSPORT_VERIFY",
        "sandbox_mode": True,
        "status": "success",
        "timestamp": datetime.now(timezone.utc)
    })
    
    await db.verification_apis.update_one(
        {"code": "PASSPORT_VERIFY"},
        {"$inc": {"total_calls": 1, "successful_calls": 1}, "$set": {"last_used": datetime.now(timezone.utc)}}
    )
    
    return mock_response


@router.post("/verify/bank")
async def verify_bank_account(
    request: Request,
    data: BankVerifyRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Verify Bank Account via Penny Drop (SANDBOX MODE)
    """
    db = get_database()
    
    # Validate IFSC
    is_valid, result = validate_ifsc(data.ifsc_code)
    if not is_valid:
        raise HTTPException(status_code=400, detail=result)
    
    ref_id = generate_reference_id()
    
    # Bank name mapping from IFSC prefix
    bank_codes = {
        'SBIN': 'State Bank of India',
        'HDFC': 'HDFC Bank',
        'ICIC': 'ICICI Bank',
        'UTIB': 'Axis Bank',
        'KKBK': 'Kotak Mahindra Bank',
        'PUNB': 'Punjab National Bank',
        'BARB': 'Bank of Baroda',
        'IOBA': 'Indian Overseas Bank',
        'CNRB': 'Canara Bank'
    }
    bank_name = bank_codes.get(data.ifsc_code[:4], "Demo Bank")
    
    mock_response = {
        "verified": True,
        "reference_id": ref_id,
        "status": "success",
        "status_code": 200,
        "sandbox_mode": True,
        "data": {
            "account_number": mask_number(data.account_number, 4, 4),
            "ifsc_code": data.ifsc_code.upper(),
            "account_holder_name": data.account_holder_name.upper(),
            "bank_name": bank_name,
            "branch_name": f"{random.choice(['Main', 'City', 'Central'])} Branch",
            "account_type": random.choice(["Savings", "Current"]),
            "name_match_score": 92,
            "penny_drop_status": "SUCCESS",
            "utr_number": f"UTRNP{random.randint(100000000000, 999999999999)}"
        },
        "message": "Bank account verification successful (Sandbox Mode)",
        "message_hi": "बैंक खाता सत्यापन सफल (सैंडबॉक्स मोड)"
    }
    
    await db.verification_logs.insert_one({
        "id": f"vlog_{ObjectId()}",
        "reference_id": ref_id,
        "document_type": "BANK_ACCOUNT",
        "user_id": current_user.get("id"),
        "api_code": "BANK_VERIFY",
        "sandbox_mode": True,
        "status": "success",
        "timestamp": datetime.now(timezone.utc)
    })
    
    await db.verification_apis.update_one(
        {"code": "BANK_VERIFY"},
        {"$inc": {"total_calls": 1, "successful_calls": 1}, "$set": {"last_used": datetime.now(timezone.utc)}}
    )
    
    return mock_response


@router.post("/verify/generic")
async def verify_generic_document(
    request: Request,
    data: GenericVerifyRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Generic document verification endpoint
    Routes to appropriate verification based on document_type
    """
    doc_type = data.document_type.upper()
    
    if doc_type == "AADHAR":
        return await verify_aadhaar(
            request,
            AadharVerifyRequest(aadhaar_number=data.document_number, name=data.additional_data.get("name")),
            current_user
        )
    elif doc_type == "PAN":
        return await verify_pan(
            request,
            PANVerifyRequest(pan_number=data.document_number, name=data.additional_data.get("name")),
            current_user
        )
    elif doc_type == "DL":
        return await verify_driving_license(
            request,
            DLVerifyRequest(dl_number=data.document_number, dob=data.additional_data.get("dob", "1990-01-01")),
            current_user
        )
    elif doc_type == "PASSPORT":
        return await verify_passport(
            request,
            PassportVerifyRequest(
                passport_number=data.document_number,
                dob=data.additional_data.get("dob", "1990-01-01"),
                name=data.additional_data.get("name")
            ),
            current_user
        )
    elif doc_type == "BANK_ACCOUNT":
        return await verify_bank_account(
            request,
            BankVerifyRequest(
                account_number=data.document_number,
                ifsc_code=data.additional_data.get("ifsc_code", "SBIN0001234"),
                account_holder_name=data.additional_data.get("account_holder_name", "Account Holder")
            ),
            current_user
        )
    else:
        # Generic mock verification
        ref_id = generate_reference_id()
        return {
            "verified": True,
            "reference_id": ref_id,
            "status": "success",
            "sandbox_mode": True,
            "data": {
                "document_type": doc_type,
                "document_number": mask_number(data.document_number),
                "verification_status": "VERIFIED"
            },
            "message": f"{doc_type} verification successful (Sandbox Mode)"
        }


# ============== AUTO-VERIFY KYC DOCUMENT ==============

@router.post("/auto-verify/{kyc_doc_id}")
async def auto_verify_kyc_document(
    kyc_doc_id: str,
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """
    Automatically verify an uploaded KYC document
    Calls appropriate verification API based on document type
    """
    db = get_database()
    
    # Get KYC document
    kyc_doc = await db.customer_kyc_documents.find_one({"id": kyc_doc_id})
    if not kyc_doc:
        raise HTTPException(status_code=404, detail="KYC document not found")
    
    # Check ownership
    user_id = current_user.get("id") or str(current_user.get("_id"))
    if kyc_doc["user_id"] != user_id and "admin" not in current_user.get("roles", []):
        raise HTTPException(status_code=403, detail="Access denied")
    
    doc_type = kyc_doc.get("document_type", "").upper()
    doc_number = kyc_doc.get("document_number", "")
    
    # Call generic verification
    try:
        result = await verify_generic_document(
            request,
            GenericVerifyRequest(
                document_type=doc_type,
                document_number=doc_number,
                additional_data={"name": current_user.get("full_name")}
            ),
            current_user
        )
        
        # Update KYC document status
        if result.get("verified"):
            await db.customer_kyc_documents.update_one(
                {"id": kyc_doc_id},
                {"$set": {
                    "verification_status": "verified",
                    "verification_reference": result.get("reference_id"),
                    "verified_at": datetime.now(timezone.utc),
                    "verification_notes": f"Auto-verified (Sandbox Mode) - Ref: {result.get('reference_id')}",
                    "updated_at": datetime.now(timezone.utc)
                }}
            )
            
            return {
                "success": True,
                "document_id": kyc_doc_id,
                "verification_status": "verified",
                "reference_id": result.get("reference_id"),
                "message": f"{doc_type} verified successfully",
                "message_hi": f"{doc_type} सत्यापन सफल",
                "sandbox_mode": True
            }
        else:
            await db.customer_kyc_documents.update_one(
                {"id": kyc_doc_id},
                {"$set": {
                    "verification_status": "failed",
                    "verification_notes": result.get("message", "Verification failed"),
                    "updated_at": datetime.now(timezone.utc)
                }}
            )
            
            return {
                "success": False,
                "document_id": kyc_doc_id,
                "verification_status": "failed",
                "message": result.get("message", "Verification failed")
            }
            
    except Exception as e:
        return {
            "success": False,
            "document_id": kyc_doc_id,
            "verification_status": "error",
            "message": str(e)
        }


# ============== VERIFICATION HISTORY ==============

@router.get("/history")
async def get_verification_history(
    limit: int = 20,
    current_user: dict = Depends(get_current_user)
):
    """Get user's verification history"""
    db = get_database()
    
    user_id = current_user.get("id") or str(current_user.get("_id"))
    
    logs = await db.verification_logs.find(
        {"user_id": user_id},
        {"_id": 0}
    ).sort("timestamp", -1).limit(limit).to_list(limit)
    
    return {"verifications": logs, "total": len(logs)}
