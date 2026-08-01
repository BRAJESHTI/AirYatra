"""
AirYatra Smart Document Vault Routes
Encrypted document storage with version control
"""
from fastapi import APIRouter, HTTPException, Depends, Query, UploadFile, File, Form
from typing import List, Optional
from datetime import datetime, timedelta
from bson import ObjectId
import uuid
import secrets
import base64
import hashlib
from database import get_database
from models import (
    DocumentUploadModel, DocumentUpdateModel, DocumentShareCreate,
    FolderCreate, DocumentVerification, BulkDocumentAction,
    DocumentCategory, VaultDocumentType, DocumentVaultStatus, SharePermission
)

router = APIRouter(prefix="/vault", tags=["Document Vault"])

def generate_share_link() -> str:
    """Generate secure share link"""
    return secrets.token_urlsafe(32)

def calculate_document_status(expiry_date: Optional[datetime]) -> str:
    """Calculate document status based on expiry"""
    if not expiry_date:
        return DocumentVaultStatus.ACTIVE.value
    
    now = datetime.utcnow()
    if expiry_date < now:
        return DocumentVaultStatus.EXPIRED.value
    elif expiry_date < now + timedelta(days=30):
        return DocumentVaultStatus.EXPIRING_SOON.value
    return DocumentVaultStatus.ACTIVE.value

# ============ DOCUMENT OPERATIONS ============

@router.post("/upload")
async def upload_document(
    owner_id: str = Form(...),
    owner_type: str = Form(...),  # user, operator, corporate
    name: str = Form(...),
    category: str = Form(...),
    document_type: str = Form(...),
    file: UploadFile = File(...),
    description: Optional[str] = Form(None),
    expiry_date: Optional[str] = Form(None),
    reference_number: Optional[str] = Form(None),
    issued_by: Optional[str] = Form(None),
    issued_date: Optional[str] = Form(None),
    tags: Optional[str] = Form(""),
    is_sensitive: bool = Form(False),
    reminder_days: int = Form(30),
    folder_id: Optional[str] = Form(None)
):
    """Upload document to vault"""
    db = get_database()
    
    # Read file content
    file_content = await file.read()
    file_size = len(file_content)
    file_type = file.content_type
    
    # Generate file hash for integrity
    file_hash = hashlib.sha256(file_content).hexdigest()
    
    # Store file (in production, use S3 or similar)
    file_id = f"doc_{uuid.uuid4().hex}"
    file_url = f"/api/vault/file/{file_id}"
    
    # Store file content in database (for demo, use object storage in production)
    await db.document_files.insert_one({
        "file_id": file_id,
        "content": base64.b64encode(file_content).decode(),
        "file_name": file.filename,
        "content_type": file_type,
        "created_at": datetime.utcnow()
    })
    
    now = datetime.utcnow()
    parsed_expiry = None
    if expiry_date:
        try:
            parsed_expiry = datetime.fromisoformat(expiry_date.replace('Z', '+00:00'))
        except:
            pass
    
    parsed_issued = None
    if issued_date:
        try:
            parsed_issued = datetime.fromisoformat(issued_date.replace('Z', '+00:00'))
        except:
            pass
    
    document_doc = {
        "document_id": f"DOC-{uuid.uuid4().hex[:8].upper()}",
        "owner_id": owner_id,
        "owner_type": owner_type,
        "name": name,
        "category": category,
        "document_type": document_type,
        "description": description,
        "file_id": file_id,
        "file_url": file_url,
        "file_name": file.filename,
        "file_size": file_size,
        "file_type": file_type,
        "file_hash": file_hash,
        "expiry_date": parsed_expiry,
        "reference_number": reference_number,
        "issued_by": issued_by,
        "issued_date": parsed_issued,
        "status": calculate_document_status(parsed_expiry),
        "tags": [t.strip() for t in tags.split(",") if t.strip()] if tags else [],
        "is_sensitive": is_sensitive,
        "reminder_days": reminder_days,
        "folder_id": folder_id,
        "version": 1,
        "versions_history": [{
            "version": 1,
            "file_url": file_url,
            "file_size": file_size,
            "uploaded_by": owner_id,
            "uploaded_at": now
        }],
        "shared_with": [],
        "verification_status": "pending",
        "verified_by": None,
        "verified_at": None,
        "download_count": 0,
        "last_accessed": None,
        "created_at": now,
        "updated_at": now
    }
    
    result = await db.documents_vault.insert_one(document_doc)
    document_doc["id"] = str(result.inserted_id)
    
    return {
        "success": True,
        "message": "Document uploaded successfully",
        "document": {
            "id": document_doc["id"],
            "document_id": document_doc["document_id"],
            "name": name,
            "file_url": file_url,
            "status": document_doc["status"]
        }
    }

@router.get("/documents/{owner_id}")
async def get_owner_documents(
    owner_id: str,
    category: Optional[str] = None,
    document_type: Optional[str] = None,
    status: Optional[str] = None,
    folder_id: Optional[str] = None,
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = 50
):
    """Get all documents for an owner"""
    db = get_database()
    
    query = {"owner_id": owner_id}
    if category:
        query["category"] = category
    if document_type:
        query["document_type"] = document_type
    if status:
        query["status"] = status
    if folder_id:
        query["folder_id"] = folder_id
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}},
            {"reference_number": {"$regex": search, "$options": "i"}}
        ]
    
    documents = await db.documents_vault.find(
        query,
        {"_id": 0, "file_hash": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(length=limit)
    
    # Update status based on expiry
    for doc in documents:
        if doc.get("expiry_date"):
            doc["status"] = calculate_document_status(doc["expiry_date"])
    
    total = await db.documents_vault.count_documents(query)
    
    return {
        "success": True,
        "total": total,
        "documents": documents
    }

@router.get("/document/{document_id}")
async def get_document_details(document_id: str):
    """Get document details by ID"""
    db = get_database()
    
    document = await db.documents_vault.find_one(
        {"document_id": document_id},
        {"_id": 0, "file_hash": 0}
    )
    
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Update last accessed
    await db.documents_vault.update_one(
        {"document_id": document_id},
        {"$set": {"last_accessed": datetime.utcnow()}}
    )
    
    document["status"] = calculate_document_status(document.get("expiry_date"))
    
    return {
        "success": True,
        "document": document
    }

@router.put("/document/{document_id}")
async def update_document(document_id: str, update: DocumentUpdateModel):
    """Update document metadata"""
    db = get_database()
    
    update_data = {k: v for k, v in update.dict().items() if v is not None}
    update_data["updated_at"] = datetime.utcnow()
    
    if "expiry_date" in update_data and update_data["expiry_date"]:
        update_data["status"] = calculate_document_status(update_data["expiry_date"])
    
    result = await db.documents_vault.update_one(
        {"document_id": document_id},
        {"$set": update_data}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Document not found")
    
    return {
        "success": True,
        "message": "Document updated successfully"
    }

@router.delete("/document/{document_id}")
async def delete_document(document_id: str, permanent: bool = False):
    """Delete or archive document"""
    db = get_database()
    
    if permanent:
        # Get file_id first
        doc = await db.documents_vault.find_one({"document_id": document_id})
        if doc:
            await db.document_files.delete_one({"file_id": doc["file_id"]})
        
        result = await db.documents_vault.delete_one({"document_id": document_id})
    else:
        result = await db.documents_vault.update_one(
            {"document_id": document_id},
            {"$set": {"status": "archived", "archived_at": datetime.utcnow()}}
        )
    
    if result.modified_count == 0 and result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Document not found")
    
    return {
        "success": True,
        "message": "Document deleted" if permanent else "Document archived"
    }

@router.get("/file/{file_id}")
async def download_file(file_id: str):
    """Download document file"""
    from fastapi.responses import Response
    
    db = get_database()
    
    file_doc = await db.document_files.find_one({"file_id": file_id})
    
    if not file_doc:
        raise HTTPException(status_code=404, detail="File not found")
    
    # Increment download count
    await db.documents_vault.update_one(
        {"file_id": file_id},
        {"$inc": {"download_count": 1}}
    )
    
    if file_doc.get("storage_path"):
        from services.storage_service import get_object
        content, _ct = await get_object(file_doc["storage_path"])
    else:
        content = base64.b64decode(file_doc["content"])  # legacy documents
    
    return Response(
        content=content,
        media_type=file_doc["content_type"],
        headers={
            "Content-Disposition": f"attachment; filename={file_doc['file_name']}"
        }
    )

# ============ VERSION CONTROL ============

@router.post("/document/{document_id}/new-version")
async def upload_new_version(
    document_id: str,
    file: UploadFile = File(...),
    change_notes: Optional[str] = Form(None),
    uploaded_by: str = Form(...)
):
    """Upload new version of document"""
    db = get_database()
    
    # Get current document
    document = await db.documents_vault.find_one({"document_id": document_id})
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Read file
    file_content = await file.read()
    file_size = len(file_content)
    
    file_id = f"doc_{uuid.uuid4().hex}"
    file_url = f"/api/vault/file/{file_id}"
    
    # Store new file in object storage
    ext = file.filename.split(".")[-1].lower() if "." in (file.filename or "") else "bin"
    storage_path = f"airyatra/vault/{document['owner_id']}/{uuid.uuid4().hex}.{ext}"
    from services.storage_service import put_object
    stored = await put_object(storage_path, file_content, file.content_type or "application/octet-stream")
    
    await db.document_files.insert_one({
        "file_id": file_id,
        "storage_path": stored["path"],
        "file_name": file.filename,
        "content_type": file.content_type,
        "size": file_size,
        "is_deleted": False,
        "created_at": datetime.utcnow()
    })
    
    new_version = document["version"] + 1
    now = datetime.utcnow()
    
    version_entry = {
        "version": new_version,
        "file_url": file_url,
        "file_size": file_size,
        "uploaded_by": uploaded_by,
        "uploaded_at": now,
        "change_notes": change_notes
    }
    
    await db.documents_vault.update_one(
        {"document_id": document_id},
        {
            "$set": {
                "version": new_version,
                "file_id": file_id,
                "file_url": file_url,
                "file_size": file_size,
                "file_name": file.filename,
                "updated_at": now
            },
            "$push": {"versions_history": version_entry}
        }
    )
    
    return {
        "success": True,
        "message": f"New version {new_version} uploaded",
        "version": new_version,
        "file_url": file_url
    }

# ============ DOCUMENT SHARING ============

@router.post("/share")
async def share_document(share: DocumentShareCreate):
    """Share document with someone"""
    db = get_database()
    
    # Verify document exists
    document = await db.documents_vault.find_one({"document_id": share.document_id})
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    share_link = generate_share_link()
    now = datetime.utcnow()
    
    share_doc = {
        "share_id": f"SHR-{uuid.uuid4().hex[:8].upper()}",
        "document_id": share.document_id,
        "document_name": document["name"],
        "shared_by": document["owner_id"],
        "shared_with_email": share.shared_with_email,
        "permission": share.permission.value,
        "share_link": share_link,
        "expiry_date": share.expiry_date,
        "message": share.message,
        "requires_otp": share.requires_otp,
        "is_active": True,
        "access_count": 0,
        "last_accessed": None,
        "created_at": now
    }
    
    await db.document_shares.insert_one(share_doc)
    
    # Update document's shared_with
    await db.documents_vault.update_one(
        {"document_id": share.document_id},
        {
            "$push": {
                "shared_with": {
                    "email": share.shared_with_email,
                    "permission": share.permission.value,
                    "shared_at": now
                }
            }
        }
    )
    
    return {
        "success": True,
        "message": f"Document shared with {share.shared_with_email}",
        "share_link": f"/vault/shared/{share_link}"
    }

@router.get("/shared/{share_link}")
async def access_shared_document(share_link: str):
    """Access shared document via link"""
    db = get_database()
    
    share = await db.document_shares.find_one({
        "share_link": share_link,
        "is_active": True
    })
    
    if not share:
        raise HTTPException(status_code=404, detail="Share link not found or expired")
    
    # Check expiry
    if share.get("expiry_date") and share["expiry_date"] < datetime.utcnow():
        await db.document_shares.update_one(
            {"share_link": share_link},
            {"$set": {"is_active": False}}
        )
        raise HTTPException(status_code=410, detail="Share link has expired")
    
    # Get document
    document = await db.documents_vault.find_one(
        {"document_id": share["document_id"]},
        {"_id": 0, "file_hash": 0}
    )
    
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Update access count
    await db.document_shares.update_one(
        {"share_link": share_link},
        {
            "$inc": {"access_count": 1},
            "$set": {"last_accessed": datetime.utcnow()}
        }
    )
    
    return {
        "success": True,
        "permission": share["permission"],
        "document": document
    }

@router.delete("/share/{share_link}")
async def revoke_share(share_link: str):
    """Revoke document share"""
    db = get_database()
    
    result = await db.document_shares.update_one(
        {"share_link": share_link},
        {"$set": {"is_active": False, "revoked_at": datetime.utcnow()}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Share not found")
    
    return {
        "success": True,
        "message": "Share link revoked"
    }

# ============ FOLDERS ============

@router.post("/folder")
async def create_folder(folder: FolderCreate, owner_id: str = Query(...)):
    """Create document folder"""
    db = get_database()
    
    now = datetime.utcnow()
    
    folder_doc = {
        "folder_id": f"FLD-{uuid.uuid4().hex[:8].upper()}",
        "owner_id": owner_id,
        "name": folder.name,
        "parent_id": folder.parent_id,
        "description": folder.description,
        "color": folder.color,
        "icon": folder.icon,
        "created_at": now,
        "updated_at": now
    }
    
    await db.document_folders.insert_one(folder_doc)
    
    return {
        "success": True,
        "message": "Folder created",
        "folder": folder_doc
    }

@router.get("/folders/{owner_id}")
async def get_folders(owner_id: str, parent_id: Optional[str] = None):
    """Get folders for an owner"""
    db = get_database()
    
    query = {"owner_id": owner_id}
    if parent_id:
        query["parent_id"] = parent_id
    else:
        query["parent_id"] = None
    
    folders = await db.document_folders.find(
        query,
        {"_id": 0}
    ).to_list(length=100)
    
    # Get document counts for each folder
    for folder in folders:
        folder["documents_count"] = await db.documents_vault.count_documents({
            "folder_id": folder["folder_id"]
        })
        folder["subfolders_count"] = await db.document_folders.count_documents({
            "parent_id": folder["folder_id"]
        })
    
    return {
        "success": True,
        "folders": folders
    }

# ============ EXPIRY ALERTS ============

@router.get("/expiring/{owner_id}")
async def get_expiring_documents(owner_id: str, days: int = 30):
    """Get documents expiring within specified days"""
    db = get_database()
    
    expiry_threshold = datetime.utcnow() + timedelta(days=days)
    
    expiring = await db.documents_vault.find(
        {
            "owner_id": owner_id,
            "expiry_date": {
                "$gte": datetime.utcnow(),
                "$lte": expiry_threshold
            },
            "status": {"$ne": "archived"}
        },
        {"_id": 0, "file_hash": 0}
    ).sort("expiry_date", 1).to_list(length=100)
    
    for doc in expiring:
        doc["days_remaining"] = (doc["expiry_date"] - datetime.utcnow()).days
    
    return {
        "success": True,
        "count": len(expiring),
        "expiring_documents": expiring
    }

@router.get("/expired/{owner_id}")
async def get_expired_documents(owner_id: str):
    """Get expired documents"""
    db = get_database()
    
    expired = await db.documents_vault.find(
        {
            "owner_id": owner_id,
            "expiry_date": {"$lt": datetime.utcnow()},
            "status": {"$ne": "archived"}
        },
        {"_id": 0, "file_hash": 0}
    ).sort("expiry_date", -1).to_list(length=100)
    
    return {
        "success": True,
        "count": len(expired),
        "expired_documents": expired
    }

# ============ VERIFICATION ============

@router.post("/verify/{document_id}")
async def verify_document(document_id: str, verification: DocumentVerification):
    """Verify document (Admin/Operator)"""
    db = get_database()
    
    result = await db.documents_vault.update_one(
        {"document_id": document_id},
        {
            "$set": {
                "verification_status": verification.verification_status,
                "verified_by": verification.verified_by,
                "verification_notes": verification.verification_notes,
                "verified_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            }
        }
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Document not found")
    
    return {
        "success": True,
        "message": f"Document {verification.verification_status}"
    }

# ============ STATISTICS ============

@router.get("/statistics/{owner_id}")
async def get_vault_statistics(owner_id: str):
    """Get vault statistics for owner"""
    db = get_database()
    
    # Total documents
    total = await db.documents_vault.count_documents({
        "owner_id": owner_id,
        "status": {"$ne": "archived"}
    })
    
    # By category
    category_pipeline = [
        {"$match": {"owner_id": owner_id, "status": {"$ne": "archived"}}},
        {"$group": {"_id": "$category", "count": {"$sum": 1}}}
    ]
    by_category = await db.documents_vault.aggregate(category_pipeline).to_list(length=20)
    
    # By status
    status_pipeline = [
        {"$match": {"owner_id": owner_id}},
        {"$group": {"_id": "$status", "count": {"$sum": 1}}}
    ]
    by_status = await db.documents_vault.aggregate(status_pipeline).to_list(length=10)
    
    # Expiring soon
    expiry_threshold = datetime.utcnow() + timedelta(days=30)
    expiring_soon = await db.documents_vault.count_documents({
        "owner_id": owner_id,
        "expiry_date": {"$gte": datetime.utcnow(), "$lte": expiry_threshold}
    })
    
    # Expired
    expired = await db.documents_vault.count_documents({
        "owner_id": owner_id,
        "expiry_date": {"$lt": datetime.utcnow()}
    })
    
    # Total size
    size_pipeline = [
        {"$match": {"owner_id": owner_id}},
        {"$group": {"_id": None, "total_size": {"$sum": "$file_size"}}}
    ]
    size_result = await db.documents_vault.aggregate(size_pipeline).to_list(length=1)
    total_size = size_result[0]["total_size"] if size_result else 0
    
    # Recent uploads
    recent = await db.documents_vault.find(
        {"owner_id": owner_id},
        {"_id": 0, "name": 1, "category": 1, "created_at": 1}
    ).sort("created_at", -1).limit(5).to_list(length=5)
    
    return {
        "success": True,
        "statistics": {
            "total_documents": total,
            "total_size_bytes": total_size,
            "total_size_mb": round(total_size / (1024 * 1024), 2),
            "documents_by_category": {c["_id"]: c["count"] for c in by_category},
            "documents_by_status": {s["_id"]: s["count"] for s in by_status},
            "expiring_soon_count": expiring_soon,
            "expired_count": expired,
            "recent_uploads": recent
        }
    }

# ============ BULK OPERATIONS ============

@router.post("/bulk-action")
async def bulk_document_action(action: BulkDocumentAction, owner_id: str = Query(...)):
    """Perform bulk action on documents"""
    db = get_database()
    
    if action.action == "archive":
        result = await db.documents_vault.update_many(
            {"document_id": {"$in": action.document_ids}, "owner_id": owner_id},
            {"$set": {"status": "archived", "archived_at": datetime.utcnow()}}
        )
    elif action.action == "delete":
        result = await db.documents_vault.delete_many(
            {"document_id": {"$in": action.document_ids}, "owner_id": owner_id}
        )
    elif action.action == "move" and action.destination_folder_id:
        result = await db.documents_vault.update_many(
            {"document_id": {"$in": action.document_ids}, "owner_id": owner_id},
            {"$set": {"folder_id": action.destination_folder_id}}
        )
    elif action.action == "tag" and action.tags:
        result = await db.documents_vault.update_many(
            {"document_id": {"$in": action.document_ids}, "owner_id": owner_id},
            {"$addToSet": {"tags": {"$each": action.tags}}}
        )
    else:
        raise HTTPException(status_code=400, detail="Invalid action or missing parameters")
    
    return {
        "success": True,
        "message": f"Bulk {action.action} completed",
        "affected_count": result.modified_count if hasattr(result, 'modified_count') else result.deleted_count
    }
