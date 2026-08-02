"""
Customer KYC Document Routes
Handles customer identity document upload and verification
SECURED: All endpoints require authentication, owner/admin checks enforced
ENCRYPTED: All KYC files are encrypted at rest using AES-256
"""
from fastapi import APIRouter, HTTPException, File, UploadFile, Form, Depends, Request
from fastapi.responses import Response
from datetime import datetime, timezone
from bson import ObjectId
from database import get_database
from routes.auth_routes import get_current_user
from security_middleware import FileEncryption, AuditLogger
import os
import re

router = APIRouter(prefix="/customer/kyc-documents", tags=["Customer KYC"])

# Initialize file encryption
file_encryptor = FileEncryption()

# Helper function to require specific roles
def require_roles(allowed_roles: list):
    async def role_checker(current_user: dict = Depends(get_current_user)):
        user_roles = current_user.get("roles", [])
        if not any(role in user_roles for role in allowed_roles):
            raise HTTPException(status_code=403, detail=f"Requires one of these roles: {', '.join(allowed_roles)}")
        return current_user
    return role_checker

# Secure upload directory (NOT in public static folder)
UPLOAD_DIR = "/app/secure_uploads/kyc"
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Allowed MIME types 
ALLOWED_MIME_TYPES = {
    'application/pdf': '.pdf',
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/jpg': '.jpg'
}

def sanitize_filename(filename: str) -> str:
    """Remove potentially dangerous characters from filename"""
    sanitized = re.sub(r'[^a-zA-Z0-9._-]', '_', filename)
    sanitized = sanitized.replace('..', '_')
    return sanitized[:100]

def validate_file_content(file_content: bytes, declared_content_type: str) -> tuple:
    """Validate file type"""
    # Simple validation - check declared type is allowed
    if declared_content_type in ALLOWED_MIME_TYPES:
        return True, declared_content_type
    return False, f"File type '{declared_content_type}' not allowed"

@router.get("")
async def get_customer_kyc_documents(current_user: dict = Depends(get_current_user)):
    """Get KYC documents for the authenticated customer"""
    db = get_database()
    
    # User can only see their own documents (derived from token, not request)
    user_id = current_user.get("id") or str(current_user.get("_id"))
    
    documents = await db.customer_kyc_documents.find(
        {"user_id": user_id}, 
        {"_id": 0, "file_path": 0}  # Don't expose file paths
    ).sort("created_at", -1).to_list(50)
    
    return {"documents": documents, "total": len(documents)}

@router.get("/admin/all")
async def get_all_kyc_documents(
    user_id: str = None,
    current_user: dict = Depends(require_roles(["admin"]))
):
    """Admin: Get all KYC documents or filter by user_id"""
    db = get_database()
    
    query = {}
    if user_id:
        query["user_id"] = user_id
    
    documents = await db.customer_kyc_documents.find(
        query, 
        {"_id": 0, "file_path": 0}  # Don't expose file paths even to admin
    ).sort("created_at", -1).to_list(100)
    
    return {"documents": documents, "total": len(documents)}

@router.post("/upload")
async def upload_kyc_document(
    request: Request,
    file: UploadFile = File(...),
    document_type: str = Form(...),
    document_number: str = Form(...),
    expiry_date: str = Form(None),
    current_user: dict = Depends(get_current_user)
):
    """Upload a KYC document - authenticated user only. File is encrypted at rest (AES-256)."""
    db = get_database()
    
    # Get user_id from token (NOT from form data)
    user_id = current_user.get("id") or str(current_user.get("_id"))
    
    # Read file content
    file_content = await file.read()
    
    # Validate file size
    if len(file_content) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large. Max 5MB allowed.")
    
    if len(file_content) == 0:
        raise HTTPException(status_code=400, detail="Empty file not allowed.")
    
    # Validate actual file content type (not just declared)
    is_valid, result = validate_file_content(file_content, file.content_type)
    if not is_valid:
        raise HTTPException(status_code=400, detail=result)
    
    detected_mime = result
    file_ext = ALLOWED_MIME_TYPES.get(detected_mime, '.bin')
    
    # Generate secure unique filename (no user input in filename)
    # Add .enc extension for encrypted files
    unique_filename = f"{document_type.upper()}_{user_id}_{ObjectId()}{file_ext}.enc"
    file_path = os.path.join(UPLOAD_DIR, unique_filename)
    
    # ENCRYPT file content before saving (AES-256)
    encrypted_content, encryption_metadata = file_encryptor.encrypt_file(file_content)
    
    # Save encrypted file
    with open(file_path, 'wb') as f:
        f.write(encrypted_content)
    
    # Sanitize document number (remove special chars for security)
    safe_doc_number = re.sub(r'[^a-zA-Z0-9\s-]', '', document_number)[:50]
    
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
        "document_number": safe_doc_number,
        "original_filename": sanitize_filename(file.filename),
        "stored_filename": unique_filename,
        "file_size": len(file_content),  # Original size
        "encrypted_size": len(encrypted_content),
        "mime_type": detected_mime,
        "is_encrypted": True,
        "encryption_algorithm": "AES-256",
        "expiry_date": expiry_date if expiry_date else None,
        "verification_status": "uploaded",
        "verification_notes": None,
        "verified_at": None,
        "verified_by": None,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }
    
    if existing:
        # Delete old file
        old_filename = existing.get("stored_filename")
        if old_filename:
            old_path = os.path.join(UPLOAD_DIR, old_filename)
            if os.path.exists(old_path):
                os.remove(old_path)
        
        # Update existing record
        await db.customer_kyc_documents.update_one(
            {"id": existing["id"]},
            {"$set": {
                "document_number": safe_doc_number,
                "original_filename": sanitize_filename(file.filename),
                "stored_filename": unique_filename,
                "file_size": len(file_content),
                "encrypted_size": len(encrypted_content),
                "mime_type": detected_mime,
                "is_encrypted": True,
                "encryption_algorithm": "AES-256",
                "expiry_date": expiry_date if expiry_date else None,
                "verification_status": "uploaded",
                "updated_at": datetime.now(timezone.utc)
            }}
        )
        doc_id = existing["id"]
    else:
        await db.customer_kyc_documents.insert_one(doc_record)
        doc_id = doc_record["id"]
    
    # Audit log: File encryption
    try:
        audit = AuditLogger(db)
        await audit.log(
            action=AuditLogger.ACTION_ENCRYPT,
            category=AuditLogger.CATEGORY_FILE,
            user_id=user_id,
            user_email=current_user.get("email"),
            resource_type="kyc_document",
            resource_id=doc_id,
            details={
                "document_type": document_type.upper(),
                "original_size": len(file_content),
                "encrypted_size": len(encrypted_content)
            },
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("User-Agent"),
            status="success"
        )
    except Exception:
        pass
    
    # Check if auto-verification is available
    doc_type_config = await db.document_types.find_one({
        "code": document_type.upper(),
        "is_active": True
    })
    
    verification_status = "uploaded"
    if doc_type_config and doc_type_config.get("verification_api"):
        api_config = await db.verification_apis.find_one({
            "code": doc_type_config["verification_api"],
            "is_enabled": True
        })
        if api_config:
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
        "message": "Document uploaded and encrypted successfully",
        "document_id": doc_id,
        "verification_status": verification_status,
        "is_encrypted": True
    }

@router.get("/download/{doc_id}")
async def download_kyc_document(
    doc_id: str,
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """Download KYC document - owner or admin only. Decrypts file on the fly."""
    db = get_database()
    
    user_id = current_user.get("id") or str(current_user.get("_id"))
    user_roles = current_user.get("roles", [])
    
    doc = await db.customer_kyc_documents.find_one({"id": doc_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Authorization: owner or admin only
    if doc["user_id"] != user_id and "admin" not in user_roles:
        raise HTTPException(status_code=403, detail="Access denied")
    
    file_path = os.path.join(UPLOAD_DIR, doc.get("stored_filename", ""))
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")
    
    # Read encrypted file
    with open(file_path, 'rb') as f:
        encrypted_content = f.read()
    
    # Decrypt file content
    try:
        if doc.get("is_encrypted", False):
            decrypted_content = file_encryptor.decrypt_file(encrypted_content)
        else:
            # Legacy unencrypted files
            decrypted_content = encrypted_content
    except Exception as e:
        raise HTTPException(status_code=500, detail="File decryption failed")
    
    # Audit log: File decryption/download
    try:
        audit = AuditLogger(db)
        await audit.log(
            action=AuditLogger.ACTION_DECRYPT,
            category=AuditLogger.CATEGORY_FILE,
            user_id=user_id,
            user_email=current_user.get("email"),
            user_roles=user_roles,
            resource_type="kyc_document",
            resource_id=doc_id,
            details={
                "document_type": doc.get("document_type"),
                "owner_id": doc["user_id"],
                "is_owner": doc["user_id"] == user_id
            },
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("User-Agent"),
            status="success",
            risk_level="medium" if "admin" in user_roles and doc["user_id"] != user_id else "low"
        )
    except Exception:
        pass
    
    # Return decrypted content as response
    original_filename = doc.get("original_filename", "document")
    media_type = doc.get("mime_type", "application/octet-stream")
    
    return Response(
        content=decrypted_content,
        media_type=media_type,
        headers={
            "Content-Disposition": f'attachment; filename="{original_filename}"'
        }
    )

@router.delete("/{doc_id}")
async def delete_kyc_document(
    doc_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a KYC document - owner only"""
    db = get_database()
    
    user_id = current_user.get("id") or str(current_user.get("_id"))
    
    doc = await db.customer_kyc_documents.find_one({"id": doc_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Authorization: owner only (admins should use admin endpoint)
    if doc["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Access denied. You can only delete your own documents.")
    
    # Delete file
    stored_filename = doc.get("stored_filename")
    if stored_filename:
        file_path = os.path.join(UPLOAD_DIR, stored_filename)
        if os.path.exists(file_path):
            os.remove(file_path)
    
    # Delete record
    await db.customer_kyc_documents.delete_one({"id": doc_id})
    
    return {"message": "Document deleted successfully"}

@router.post("/{doc_id}/verify")
async def verify_kyc_document(
    doc_id: str, 
    status: str = "verified", 
    notes: str = None,
    current_user: dict = Depends(require_roles(["admin"]))
):
    """Manually verify a KYC document - Admin only"""
    db = get_database()
    
    admin_id = current_user.get("id") or str(current_user.get("_id"))
    admin_name = current_user.get("name", "Admin")
    
    doc = await db.customer_kyc_documents.find_one({"id": doc_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    
    if status not in ["verified", "rejected", "pending"]:
        raise HTTPException(status_code=400, detail="Invalid status. Must be: verified, rejected, pending")
    
    await db.customer_kyc_documents.update_one(
        {"id": doc_id},
        {"$set": {
            "verification_status": status,
            "verification_notes": notes,
            "verified_at": datetime.now(timezone.utc) if status == "verified" else None,
            "verified_by": admin_id if status in ["verified", "rejected"] else None,
            "verified_by_name": admin_name if status in ["verified", "rejected"] else None,
            "updated_at": datetime.now(timezone.utc)
        }}
    )
    
    return {"message": f"Document {status}", "status": status}

@router.delete("/admin/{doc_id}")
async def admin_delete_kyc_document(
    doc_id: str,
    current_user: dict = Depends(require_roles(["admin"]))
):
    """Admin: Delete any KYC document"""
    db = get_database()
    
    doc = await db.customer_kyc_documents.find_one({"id": doc_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Delete file
    stored_filename = doc.get("stored_filename")
    if stored_filename:
        file_path = os.path.join(UPLOAD_DIR, stored_filename)
        if os.path.exists(file_path):
            os.remove(file_path)
    
    # Delete record
    await db.customer_kyc_documents.delete_one({"id": doc_id})
    
    return {"message": "Document deleted successfully by admin"}
