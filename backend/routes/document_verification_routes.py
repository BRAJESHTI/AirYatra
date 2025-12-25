from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, timezone, timedelta
from uuid import uuid4
import os
import re
from database import get_database
from routes.auth_routes import get_current_user

router = APIRouter(prefix="/document-verify", tags=["Document Verification"])

# Document Types
DOCUMENT_TYPES = {
    "pilot_license": {
        "name": "Pilot License (CPL/ATPL)",
        "issuer": "DGCA",
        "validity_years": 5,
        "required_fields": ["license_number", "holder_name", "issue_date", "expiry_date", "ratings"]
    },
    "medical_certificate": {
        "name": "Medical Certificate",
        "issuer": "DGCA Approved AME",
        "validity_years": 1,
        "required_fields": ["certificate_number", "holder_name", "class", "issue_date", "expiry_date"]
    },
    "aircraft_registration": {
        "name": "Certificate of Registration",
        "issuer": "DGCA",
        "validity_years": None,  # No expiry
        "required_fields": ["registration_mark", "aircraft_type", "owner_name", "issue_date"]
    },
    "airworthiness_certificate": {
        "name": "Certificate of Airworthiness",
        "issuer": "DGCA",
        "validity_years": 1,
        "required_fields": ["certificate_number", "aircraft_registration", "category", "issue_date", "expiry_date"]
    },
    "insurance": {
        "name": "Aircraft Insurance",
        "issuer": "Insurance Company",
        "validity_years": 1,
        "required_fields": ["policy_number", "aircraft_registration", "insurer", "start_date", "end_date", "coverage_amount"]
    },
    "operator_permit": {
        "name": "NSOP/Scheduled Operator Permit",
        "issuer": "DGCA",
        "validity_years": 2,
        "required_fields": ["permit_number", "operator_name", "issue_date", "expiry_date", "permitted_operations"]
    },
    "aoc": {
        "name": "Air Operator Certificate",
        "issuer": "DGCA",
        "validity_years": 2,
        "required_fields": ["aoc_number", "operator_name", "issue_date", "expiry_date"]
    }
}

# DGCA License Pattern (Example: CPL-XXXX-YYYY)
DGCA_LICENSE_PATTERN = r'^(CPL|ATPL|PPL)-\d{4,6}(-[A-Z]{2,4})?$'
REGISTRATION_PATTERN = r'^VT-[A-Z]{3}$'  # Indian aircraft registration

# Models
class DocumentSubmission(BaseModel):
    document_type: str
    entity_type: str  # pilot, aircraft, operator
    entity_id: str
    document_number: str
    holder_name: str
    issue_date: str
    expiry_date: Optional[str] = None
    issuer: Optional[str] = None
    additional_data: dict = {}
    document_url: Optional[str] = None

class VerificationResult(BaseModel):
    document_id: str
    status: str  # pending, verified, rejected, expired
    verified_by: Optional[str] = None
    verification_notes: Optional[str] = None
    verified_at: Optional[str] = None

class ManualVerification(BaseModel):
    status: str  # verified, rejected
    notes: str
    verified_fields: dict = {}

# Helper Functions
def validate_dgca_license(license_number: str) -> dict:
    """Validate DGCA license format"""
    if re.match(DGCA_LICENSE_PATTERN, license_number.upper()):
        return {"valid": True, "format": "DGCA Standard"}
    return {"valid": False, "error": "Invalid license format. Expected: CPL-XXXX or ATPL-XXXX"}

def validate_aircraft_registration(reg: str) -> dict:
    """Validate Indian aircraft registration"""
    if re.match(REGISTRATION_PATTERN, reg.upper()):
        return {"valid": True, "format": "Indian Civil Aviation"}
    return {"valid": False, "error": "Invalid registration. Expected format: VT-XXX"}

def check_expiry(expiry_date: str) -> dict:
    """Check document expiry status"""
    try:
        expiry = datetime.fromisoformat(expiry_date.replace('Z', '+00:00'))
        now = datetime.now(timezone.utc)
        days_until_expiry = (expiry - now).days
        
        if days_until_expiry < 0:
            return {"status": "expired", "days": abs(days_until_expiry), "message": f"Expired {abs(days_until_expiry)} days ago"}
        elif days_until_expiry <= 30:
            return {"status": "expiring_soon", "days": days_until_expiry, "message": f"Expires in {days_until_expiry} days"}
        elif days_until_expiry <= 90:
            return {"status": "warning", "days": days_until_expiry, "message": f"Expires in {days_until_expiry} days"}
        else:
            return {"status": "valid", "days": days_until_expiry, "message": "Valid"}
    except:
        return {"status": "unknown", "message": "Could not parse expiry date"}

async def auto_verify_document(doc_data: dict, db) -> dict:
    """Automated verification checks"""
    checks = []
    overall_status = "verified"
    
    doc_type = doc_data.get("document_type")
    
    # Check 1: Document number format
    if doc_type == "pilot_license":
        license_check = validate_dgca_license(doc_data.get("document_number", ""))
        checks.append({"check": "License Format", **license_check})
        if not license_check["valid"]:
            overall_status = "pending_review"
    
    elif doc_type == "aircraft_registration":
        reg_check = validate_aircraft_registration(doc_data.get("document_number", ""))
        checks.append({"check": "Registration Format", **reg_check})
        if not reg_check["valid"]:
            overall_status = "pending_review"
    
    # Check 2: Expiry date
    if doc_data.get("expiry_date"):
        expiry_check = check_expiry(doc_data["expiry_date"])
        checks.append({"check": "Expiry Status", **expiry_check})
        if expiry_check["status"] == "expired":
            overall_status = "expired"
        elif expiry_check["status"] == "expiring_soon" and overall_status == "verified":
            overall_status = "verified_expiring_soon"
    
    # Check 3: Duplicate check
    existing = await db.verified_documents.find_one({
        "document_number": doc_data.get("document_number"),
        "document_type": doc_type,
        "status": {"$in": ["verified", "pending"]}
    })
    if existing and existing.get("entity_id") != doc_data.get("entity_id"):
        checks.append({"check": "Duplicate Check", "valid": False, "error": "Document already registered to another entity"})
        overall_status = "rejected"
    else:
        checks.append({"check": "Duplicate Check", "valid": True})
    
    # Check 4: Required fields
    doc_config = DOCUMENT_TYPES.get(doc_type, {})
    required = doc_config.get("required_fields", [])
    missing = [f for f in required if not doc_data.get(f) and not doc_data.get("additional_data", {}).get(f)]
    if missing:
        checks.append({"check": "Required Fields", "valid": False, "missing": missing})
        if overall_status == "verified":
            overall_status = "pending_review"
    else:
        checks.append({"check": "Required Fields", "valid": True})
    
    return {
        "auto_status": overall_status,
        "checks": checks,
        "requires_manual_review": overall_status in ["pending_review", "rejected"]
    }

# API Endpoints
@router.get("/types")
async def get_document_types():
    """Get all supported document types"""
    return {"document_types": DOCUMENT_TYPES}

@router.post("/submit")
async def submit_document(doc: DocumentSubmission, current_user: dict = Depends(get_current_user)):
    """Submit a document for verification"""
    db = get_database()
    
    if doc.document_type not in DOCUMENT_TYPES:
        raise HTTPException(status_code=400, detail=f"Invalid document type. Supported: {list(DOCUMENT_TYPES.keys())}")
    
    doc_data = {
        "id": str(uuid4()),
        "document_type": doc.document_type,
        "document_type_name": DOCUMENT_TYPES[doc.document_type]["name"],
        "entity_type": doc.entity_type,
        "entity_id": doc.entity_id,
        "document_number": doc.document_number.upper(),
        "holder_name": doc.holder_name,
        "issue_date": doc.issue_date,
        "expiry_date": doc.expiry_date,
        "issuer": doc.issuer or DOCUMENT_TYPES[doc.document_type]["issuer"],
        "additional_data": doc.additional_data,
        "document_url": doc.document_url,
        "submitted_by": current_user["id"],
        "submitted_at": datetime.now(timezone.utc).isoformat(),
        "status": "pending",
        "verification_history": []
    }
    
    # Run auto verification
    auto_result = await auto_verify_document(doc_data, db)
    doc_data["auto_verification"] = auto_result
    doc_data["status"] = auto_result["auto_status"]
    
    if auto_result["auto_status"] == "verified":
        doc_data["verified_at"] = datetime.now(timezone.utc).isoformat()
        doc_data["verified_by"] = "system_auto"
    
    await db.verified_documents.insert_one(doc_data)
    doc_data.pop("_id", None)
    
    return {
        "message": "Document submitted",
        "document": doc_data,
        "auto_verification": auto_result
    }

@router.get("/entity/{entity_type}/{entity_id}")
async def get_entity_documents(entity_type: str, entity_id: str, current_user: dict = Depends(get_current_user)):
    """Get all documents for an entity"""
    db = get_database()
    
    docs = await db.verified_documents.find(
        {"entity_type": entity_type, "entity_id": entity_id},
        {"_id": 0}
    ).sort("submitted_at", -1).to_list(100)
    
    # Check expiry for each
    for doc in docs:
        if doc.get("expiry_date"):
            doc["expiry_status"] = check_expiry(doc["expiry_date"])
    
    return {"documents": docs}

@router.get("/pending")
async def get_pending_verifications(current_user: dict = Depends(get_current_user)):
    """Get documents pending manual verification"""
    if "admin" not in current_user.get("roles", []):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    db = get_database()
    
    docs = await db.verified_documents.find(
        {"status": {"$in": ["pending", "pending_review"]}},
        {"_id": 0}
    ).sort("submitted_at", 1).to_list(100)
    
    return {"pending_documents": docs, "count": len(docs)}

@router.post("/verify/{document_id}")
async def manual_verify_document(document_id: str, verification: ManualVerification, current_user: dict = Depends(get_current_user)):
    """Manually verify a document"""
    if "admin" not in current_user.get("roles", []):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    db = get_database()
    
    doc = await db.verified_documents.find_one({"id": document_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    
    history_entry = {
        "action": verification.status,
        "by": current_user["id"],
        "by_name": current_user.get("full_name"),
        "notes": verification.notes,
        "at": datetime.now(timezone.utc).isoformat()
    }
    
    update_data = {
        "status": verification.status,
        "verified_by": current_user["id"],
        "verified_at": datetime.now(timezone.utc).isoformat(),
        "verification_notes": verification.notes,
        "verified_fields": verification.verified_fields
    }
    
    await db.verified_documents.update_one(
        {"id": document_id},
        {
            "$set": update_data,
            "$push": {"verification_history": history_entry}
        }
    )
    
    return {"message": f"Document {verification.status}", "document_id": document_id}

@router.get("/expiring")
async def get_expiring_documents(days: int = 30, current_user: dict = Depends(get_current_user)):
    """Get documents expiring within N days"""
    if "admin" not in current_user.get("roles", []) and "operator" not in current_user.get("roles", []):
        raise HTTPException(status_code=403, detail="Access denied")
    
    db = get_database()
    
    cutoff_date = (datetime.now(timezone.utc) + timedelta(days=days)).isoformat()
    today = datetime.now(timezone.utc).isoformat()
    
    docs = await db.verified_documents.find(
        {
            "status": "verified",
            "expiry_date": {"$lte": cutoff_date, "$gte": today}
        },
        {"_id": 0}
    ).sort("expiry_date", 1).to_list(100)
    
    for doc in docs:
        doc["expiry_status"] = check_expiry(doc["expiry_date"])
    
    return {"expiring_documents": docs, "count": len(docs), "within_days": days}

@router.get("/dashboard")
async def get_verification_dashboard(current_user: dict = Depends(get_current_user)):
    """Get document verification dashboard"""
    if "admin" not in current_user.get("roles", []):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    db = get_database()
    
    total = await db.verified_documents.count_documents({})
    verified = await db.verified_documents.count_documents({"status": "verified"})
    pending = await db.verified_documents.count_documents({"status": {"$in": ["pending", "pending_review"]}})
    rejected = await db.verified_documents.count_documents({"status": "rejected"})
    expired = await db.verified_documents.count_documents({"status": "expired"})
    
    # Expiring soon (30 days)
    cutoff = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
    expiring_soon = await db.verified_documents.count_documents({
        "status": "verified",
        "expiry_date": {"$lte": cutoff}
    })
    
    # By type
    pipeline = [
        {"$group": {"_id": "$document_type", "count": {"$sum": 1}}}
    ]
    by_type = {}
    async for doc in db.verified_documents.aggregate(pipeline):
        by_type[doc["_id"]] = doc["count"]
    
    return {
        "total_documents": total,
        "verified": verified,
        "pending": pending,
        "rejected": rejected,
        "expired": expired,
        "expiring_within_30_days": expiring_soon,
        "by_type": by_type,
        "verification_rate": round((verified / total * 100) if total > 0 else 0, 1)
    }
