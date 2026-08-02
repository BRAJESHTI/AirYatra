"""
Customer KYC Document Routes
Handles customer identity document upload and verification
"""
from fastapi import APIRouter, HTTPException, File, UploadFile, Form
from datetime import datetime, timezone
from bson import ObjectId
from database import get_database
import os
import base64

router = APIRouter(prefix="/customer/kyc-documents", tags=["Customer KYC"])

UPLOAD_DIR = "/app/uploads/kyc"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.get("")
async def get_customer_kyc_documents(user_id: str = None):
    """Get all KYC documents for customer"""
    db = get_database()
    
    # In real app, get user_id from token
    # For now, we'll handle this in frontend
    query = {}
    if user_id:
        query["user_id"] = user_id
    
    documents = await db.customer_kyc_documents.find(query, {"_id": 0}).sort("created_at", -1).to_list(50)
    
    return {"documents": documents, "total": len(documents)}

@router.post("/upload")
async def upload_kyc_document(
    file: UploadFile = File(...),
    document_type: str = Form(...),
    document_number: str = Form(...),
    expiry_date: str = Form(None),
    user_id: str = Form(None)
):
    """Upload a KYC document"""
    db = get_database()
    
    # Validate file
    allowed_types = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg']
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Invalid file type. Only PDF and images allowed.")
    
    # Read file
    file_content = await file.read()
    if len(file_content) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large. Max 5MB allowed.")
    
    # Generate unique filename
    file_ext = file.filename.split('.')[-1] if '.' in file.filename else 'pdf'
    unique_filename = f"{document_type}_{ObjectId()}.{file_ext}"
    file_path = os.path.join(UPLOAD_DIR, unique_filename)
    
    # Save file
    with open(file_path, 'wb') as f:
        f.write(file_content)
    
    # Check if document type already exists for user
    existing = await db.customer_kyc_documents.find_one({
        "user_id": user_id,
        "document_type": document_type.upper()
    })
    
    # Create document record
    doc_record = {
        "id": f"kyc_{ObjectId()}",
        "user_id": user_id,
        "document_type": document_type.upper(),
        "document_number": document_number,
        "file_name": file.filename,
        "file_path": file_path,
        "file_size": len(file_content),
        "expiry_date": expiry_date if expiry_date else None,
        "verification_status": "uploaded",  # uploaded, pending, verified, rejected
        "verification_notes": None,
        "verified_at": None,
        "verified_by": None,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }
    
    if existing:
        # Update existing
        await db.customer_kyc_documents.update_one(
            {"id": existing["id"]},
            {"$set": {
                "document_number": document_number,
                "file_name": file.filename,
                "file_path": file_path,
                "file_size": len(file_content),
                "expiry_date": expiry_date if expiry_date else None,
                "verification_status": "uploaded",
                "updated_at": datetime.now(timezone.utc)
            }}
        )
        doc_id = existing["id"]
    else:
        await db.customer_kyc_documents.insert_one(doc_record)
        doc_id = doc_record["id"]
    
    # Check if auto-verification is available
    doc_type_config = await db.document_types.find_one({
        "code": document_type.upper(),
        "is_active": True
    })
    
    verification_status = "uploaded"
    if doc_type_config and doc_type_config.get("verification_api"):
        # Check if API is enabled
        api_config = await db.verification_apis.find_one({
            "code": doc_type_config["verification_api"],
            "is_enabled": True
        })
        if api_config:
            # In sandbox mode, auto-verify
            if api_config.get("sandbox_mode", True):
                verification_status = "verified"
                await db.customer_kyc_documents.update_one(
                    {"id": doc_id},
                    {"$set": {
                        "verification_status": "verified",
                        "verified_at": datetime.now(timezone.utc),
                        "verification_notes": "Auto-verified (Sandbox Mode)"
                    }}
                )
            else:
                verification_status = "pending"
                await db.customer_kyc_documents.update_one(
                    {"id": doc_id},
                    {"$set": {"verification_status": "pending"}}
                )
    
    return {
        "message": "Document uploaded successfully",
        "document_id": doc_id,
        "verification_status": verification_status
    }

@router.delete("/{doc_id}")
async def delete_kyc_document(doc_id: str):
    """Delete a KYC document"""
    db = get_database()
    
    doc = await db.customer_kyc_documents.find_one({"id": doc_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Delete file
    if doc.get("file_path") and os.path.exists(doc["file_path"]):
        os.remove(doc["file_path"])
    
    # Delete record
    await db.customer_kyc_documents.delete_one({"id": doc_id})
    
    return {"message": "Document deleted successfully"}

@router.post("/{doc_id}/verify")
async def verify_kyc_document(doc_id: str, status: str = "verified", notes: str = None):
    """Manually verify a KYC document (Admin only)"""
    db = get_database()
    
    doc = await db.customer_kyc_documents.find_one({"id": doc_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    
    if status not in ["verified", "rejected", "pending"]:
        raise HTTPException(status_code=400, detail="Invalid status")
    
    await db.customer_kyc_documents.update_one(
        {"id": doc_id},
        {"$set": {
            "verification_status": status,
            "verification_notes": notes,
            "verified_at": datetime.now(timezone.utc) if status == "verified" else None,
            "updated_at": datetime.now(timezone.utc)
        }}
    )
    
    return {"message": f"Document {status}", "status": status}
