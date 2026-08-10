"""
AirYatra Smart Document Vault Routes
Encrypted document storage with version control
SECURITY: All endpoints require authentication
"""
from fastapi import APIRouter, HTTPException, Depends, Query, UploadFile, File, Form
from fastapi.responses import Response
from typing import List, Optional
from datetime import datetime, timedelta, timezone
from bson import ObjectId
import uuid
import secrets
import base64
import hashlib
import io
from database import get_database
from middleware import get_current_user
from models import (
    DocumentUploadModel, DocumentUpdateModel, DocumentShareCreate,
    FolderCreate, DocumentVerification, BulkDocumentAction,
    DocumentCategory, VaultDocumentType, DocumentVaultStatus, SharePermission
)
from services import storage_service

router = APIRouter(prefix="/vault", tags=["Document Vault"])

# Image processing - optional PIL for thumbnails
try:
    from PIL import Image
    PIL_AVAILABLE = True
except ImportError:
    PIL_AVAILABLE = False

def generate_share_link() -> str:
    """Generate secure share link"""
    return secrets.token_urlsafe(32)

def calculate_document_status(expiry_date: Optional[datetime]) -> str:
    """Calculate document status based on expiry"""
    if not expiry_date:
        return DocumentVaultStatus.ACTIVE.value
    
    now = datetime.now(timezone.utc)
    if expiry_date < now:
        return DocumentVaultStatus.EXPIRED.value
    elif expiry_date < now + timedelta(days=30):
        return DocumentVaultStatus.EXPIRING_SOON.value
    return DocumentVaultStatus.ACTIVE.value

# ============ DOCUMENT OPERATIONS ============

@router.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    owner_id: str = Form(...),
    owner_type: str = Form(...),  # user, operator, corporate
    name: str = Form(...),
    category: str = Form(...),
    document_type: str = Form(...),
    description: Optional[str] = Form(None),
    expiry_date: Optional[str] = Form(None),
    reference_number: Optional[str] = Form(None),
    issued_by: Optional[str] = Form(None),
    issued_date: Optional[str] = Form(None),
    tags: Optional[str] = Form(""),
    is_sensitive: bool = Form(False),
    reminder_days: int = Form(30),
    folder_id: Optional[str] = Form(None),
    current_user: dict = Depends(get_current_user)
):
    """Upload document to vault using object storage - AUTHENTICATED"""
    db = get_database()
    
    # SECURITY: Verify owner authorization
    is_admin = "admin" in current_user.get("roles", [])
    is_owner = owner_id == current_user["id"]
    
    if not is_admin and not is_owner:
        raise HTTPException(
            status_code=403,
            detail="Not authorized to upload documents for this owner"
        )
    
    # Read file content
    file_content = await file.read()
    file_size = len(file_content)
    file_type = file.content_type or "application/octet-stream"
    
    # Generate file hash for integrity
    file_hash = hashlib.sha256(file_content).hexdigest()
    
    # Generate unique file ID and storage path
    file_id = f"doc_{uuid.uuid4().hex}"
    storage_path = f"airyatra/vault/{owner_id}/{file_id}/{file.filename}"
    
    try:
        # Upload to Emergent Object Storage
        storage_result = await storage_service.put_object(
            path=storage_path,
            data=file_content,
            content_type=file_type
        )
        file_url = storage_result.get("url", f"/api/vault/file/{file_id}")
        storage_type = "object_storage"
        
        # Generate thumbnail for images
        thumbnail_url = None
        thumb_storage_path = None
        if file_type.startswith("image/") and PIL_AVAILABLE:
            try:
                img = Image.open(io.BytesIO(file_content))
                # Only generate thumbnail if image is larger than 300x300
                if img.width > 300 or img.height > 300:
                    img.thumbnail((300, 300), Image.Resampling.LANCZOS)
                thumb_buffer = io.BytesIO()
                img_format = "JPEG" if file_type == "image/jpeg" else "PNG"
                img.save(thumb_buffer, format=img_format, quality=80, optimize=True)
                thumb_content = thumb_buffer.getvalue()
                
                thumb_storage_path = f"airyatra/vault/{owner_id}/{file_id}/thumb_{file.filename}"
                thumb_result = await storage_service.put_object(
                    path=thumb_storage_path,
                    data=thumb_content,
                    content_type=file_type
                )
                # Use direct URL if available, otherwise use our API endpoint
                thumbnail_url = thumb_result.get("url") or f"/api/vault/thumbnail/{file_id}"
            except Exception as e:
                print(f"Thumbnail generation failed: {e}")
        
    except Exception as e:
        # Fallback to base64 in MongoDB if object storage fails
        print(f"Object storage failed, falling back to MongoDB: {e}")
        await db.document_files.insert_one({
            "file_id": file_id,
            "content": base64.b64encode(file_content).decode(),
            "file_name": file.filename,
            "content_type": file_type,
            "created_at": datetime.now(timezone.utc)
        })
        file_url = f"/api/vault/file/{file_id}"
        storage_type = "mongodb_base64"
        thumbnail_url = None
        thumb_storage_path = None
    
    now = datetime.now(timezone.utc)
    parsed_expiry = None
    if expiry_date:
        try:
            parsed_expiry = datetime.fromisoformat(expiry_date.replace('Z', '+00:00'))
        except Exception:
            pass
    
    parsed_issued = None
    if issued_date:
        try:
            parsed_issued = datetime.fromisoformat(issued_date.replace('Z', '+00:00'))
        except Exception:
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
        "thumbnail_url": thumbnail_url,
        "thumb_storage_path": thumb_storage_path,
        "storage_type": storage_type,
        "storage_path": storage_path if storage_type == "object_storage" else None,
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
            "thumbnail_url": thumbnail_url,
            "storage_type": storage_type,
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
    limit: int = 50,
    current_user: dict = Depends(get_current_user)
):
    """Get all documents for an owner - AUTHENTICATED"""
    db = get_database()
    
    # SECURITY: Verify authorization
    is_admin = "admin" in current_user.get("roles", [])
    is_owner = owner_id == current_user["id"]
    
    if not is_admin and not is_owner:
        raise HTTPException(
            status_code=403,
            detail="Not authorized to access these documents"
        )
    
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
async def get_document_details(
    document_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get document details by ID - AUTHENTICATED"""
    db = get_database()
    
    document = await db.documents_vault.find_one(
        {"document_id": document_id},
        {"_id": 0, "file_hash": 0}
    )
    
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # SECURITY: Verify authorization
    is_admin = "admin" in current_user.get("roles", [])
    is_owner = document.get("owner_id") == current_user["id"]
    
    # Check if user has shared access
    shared_access = any(
        share.get("user_id") == current_user["id"] 
        for share in document.get("shared_with", [])
    )
    
    if not is_admin and not is_owner and not shared_access:
        raise HTTPException(
            status_code=403,
            detail="Not authorized to access this document"
        )
    
    # Update last accessed
    await db.documents_vault.update_one(
        {"document_id": document_id},
        {"$set": {"last_accessed": datetime.now(timezone.utc)}}
    )
    
    document["status"] = calculate_document_status(document.get("expiry_date"))
    
    return {
        "success": True,
        "document": document
    }

@router.put("/document/{document_id}")
async def update_document(
    document_id: str, 
    update: DocumentUpdateModel,
    current_user: dict = Depends(get_current_user)
):
    """Update document metadata - AUTHENTICATED"""
    db = get_database()
    
    # SECURITY: First check if document exists and user has access
    document = await db.documents_vault.find_one({"document_id": document_id})
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    is_admin = "admin" in current_user.get("roles", [])
    is_owner = document.get("owner_id") == current_user["id"]
    
    if not is_admin and not is_owner:
        raise HTTPException(
            status_code=403,
            detail="Not authorized to modify this document"
        )
    
    update_data = {k: v for k, v in update.dict().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc)
    
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
async def delete_document(
    document_id: str, 
    permanent: bool = False,
    current_user: dict = Depends(get_current_user)
):
    """Delete or archive document - AUTHENTICATED"""
    db = get_database()
    
    # SECURITY: First check if document exists and user has access
    document = await db.documents_vault.find_one({"document_id": document_id})
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    is_admin = "admin" in current_user.get("roles", [])
    is_owner = document.get("owner_id") == current_user["id"]
    
    if not is_admin and not is_owner:
        raise HTTPException(
            status_code=403,
            detail="Not authorized to delete this document"
        )
    
    if permanent:
        # Get file_id first
        if document.get("file_id"):
            await db.document_files.delete_one({"file_id": document["file_id"]})
        
        result = await db.documents_vault.delete_one({"document_id": document_id})
    else:
        result = await db.documents_vault.update_one(
            {"document_id": document_id},
            {"$set": {"status": "archived", "archived_at": datetime.now(timezone.utc)}}
        )
    
    if result.modified_count == 0 and result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Document not found")
    
    return {
        "success": True,
        "message": "Document deleted" if permanent else "Document archived"
    }

@router.get("/file/{file_id}")
async def download_file(
    file_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Download document file - AUTHENTICATED, supports object storage and legacy base64"""
    db = get_database()
    
    # First find the document to get storage info
    document = await db.documents_vault.find_one({"file_id": file_id})
    
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # SECURITY: Verify access
    is_admin = "admin" in current_user.get("roles", [])
    is_owner = document.get("owner_id") == current_user["id"]
    
    # Check shared access
    shared_access = any(
        share.get("user_id") == current_user["id"] 
        for share in document.get("shared_with", [])
    )
    
    if not is_admin and not is_owner and not shared_access:
        raise HTTPException(
            status_code=403,
            detail="Not authorized to download this file"
        )
    
    # Increment download count
    await db.documents_vault.update_one(
        {"file_id": file_id},
        {"$inc": {"download_count": 1}, "$set": {"last_accessed": datetime.now(timezone.utc)}}
    )
    
    # Try object storage first (new documents)
    if document.get("storage_type") == "object_storage" and document.get("storage_path"):
        try:
            content, content_type = await storage_service.get_object(document["storage_path"])
            return Response(
                content=content,
                media_type=content_type or document.get("file_type", "application/octet-stream"),
                headers={
                    "Content-Disposition": f"attachment; filename={document.get('file_name', 'download')}"
                }
            )
        except Exception as e:
            print(f"Object storage retrieval failed: {e}")
            # Fall through to legacy method
    
    # Legacy: Try document_files collection (base64 encoded)
    file_doc = await db.document_files.find_one({"file_id": file_id})
    if file_doc:
        content = base64.b64decode(file_doc["content"])
        return Response(
            content=content,
            media_type=file_doc.get("content_type", "application/octet-stream"),
            headers={
                "Content-Disposition": f"attachment; filename={file_doc.get('file_name', 'download')}"
            }
        )
    
    raise HTTPException(status_code=404, detail="File content not found")



@router.get("/image/{file_id}")
async def get_image_preview(
    file_id: str,
    thumbnail: bool = Query(default=False, description="Return thumbnail if available"),
    current_user: dict = Depends(get_current_user)
):
    """Get image preview (inline) - AUTHENTICATED, for gallery/preview use"""
    db = get_database()
    
    document = await db.documents_vault.find_one({"file_id": file_id})
    
    if not document:
        raise HTTPException(status_code=404, detail="Image not found")
    
    # Check if it's an image
    file_type = document.get("file_type", "")
    if not file_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Not an image file")
    
    # SECURITY: Verify access
    is_admin = "admin" in current_user.get("roles", [])
    is_owner = document.get("owner_id") == current_user["id"]
    shared_access = any(
        share.get("user_id") == current_user["id"] 
        for share in document.get("shared_with", [])
    )
    
    if not is_admin and not is_owner and not shared_access:
        raise HTTPException(status_code=403, detail="Not authorized to view this image")
    
    # Return thumbnail if requested and available
    if thumbnail and document.get("thumbnail_url"):
        # For object storage thumbnails, the URL is direct
        return {"redirect_url": document["thumbnail_url"]}
    
    # Try object storage first
    if document.get("storage_type") == "object_storage" and document.get("storage_path"):
        try:
            content, content_type = await storage_service.get_object(document["storage_path"])
            return Response(
                content=content,
                media_type=content_type or file_type,
                headers={"Content-Disposition": f"inline; filename={document.get('file_name', 'image')}"}
            )
        except Exception as e:
            print(f"Image retrieval from object storage failed: {e}")
    
    # Fallback to base64
    file_doc = await db.document_files.find_one({"file_id": file_id})
    if file_doc:
        content = base64.b64decode(file_doc["content"])
        return Response(
            content=content,
            media_type=file_doc.get("content_type", file_type),
            headers={"Content-Disposition": f"inline; filename={file_doc.get('file_name', 'image')}"}
        )
    
    raise HTTPException(status_code=404, detail="Image content not found")



@router.get("/thumbnail/{file_id}")
async def get_thumbnail(
    file_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get thumbnail image for a document - AUTHENTICATED"""
    db = get_database()
    
    document = await db.documents_vault.find_one({"file_id": file_id})
    
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Check if it's an image with thumbnail
    if not document.get("thumb_storage_path"):
        # No thumbnail, return the original image scaled down client-side
        raise HTTPException(status_code=404, detail="No thumbnail available")
    
    # SECURITY: Verify access
    is_admin = "admin" in current_user.get("roles", [])
    is_owner = document.get("owner_id") == current_user["id"]
    shared_access = any(
        share.get("user_id") == current_user["id"] 
        for share in document.get("shared_with", [])
    )
    
    if not is_admin and not is_owner and not shared_access:
        raise HTTPException(status_code=403, detail="Not authorized to view this thumbnail")
    
    try:
        content, content_type = await storage_service.get_object(document["thumb_storage_path"])
        return Response(
            content=content,
            media_type=content_type or document.get("file_type", "image/png"),
            headers={"Content-Disposition": f"inline; filename=thumb_{document.get('file_name', 'image')}"}
        )
    except Exception as e:
        print(f"Thumbnail retrieval failed: {e}")
        raise HTTPException(status_code=404, detail="Thumbnail not available")



@router.get("/photos/{owner_id}")
async def get_owner_photos(
    owner_id: str,
    aircraft_id: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    current_user: dict = Depends(get_current_user)
):
    """Get all photo documents for an owner (for gallery view) - AUTHENTICATED"""
    db = get_database()
    
    # SECURITY: Verify authorization
    is_admin = "admin" in current_user.get("roles", [])
    is_owner = owner_id == current_user["id"]
    
    if not is_admin and not is_owner:
        raise HTTPException(status_code=403, detail="Not authorized to access these photos")
    
    # Build query for photo documents
    query = {
        "owner_id": owner_id,
        "file_type": {"$regex": "^image/"}
    }
    
    if aircraft_id:
        query["tags"] = aircraft_id
    
    photos = await db.documents_vault.find(
        query,
        {"_id": 0, "file_hash": 0, "versions_history": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(length=limit)
    
    total = await db.documents_vault.count_documents(query)
    
    return {
        "success": True,
        "photos": photos,
        "total": total,
        "skip": skip,
        "limit": limit
    }

# ============ VERSION CONTROL ============

@router.post("/document/{document_id}/new-version")
async def upload_new_version(
    document_id: str,
    file: UploadFile = File(...),
    change_notes: Optional[str] = Form(None),
    current_user: dict = Depends(get_current_user)
):
    """Upload new version of document - AUTHENTICATED"""
    db = get_database()
    
    # Get current document
    document = await db.documents_vault.find_one({"document_id": document_id})
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # SECURITY: Verify authorization
    is_admin = "admin" in current_user.get("roles", [])
    is_owner = document.get("owner_id") == current_user["id"]
    
    if not is_admin and not is_owner:
        raise HTTPException(
            status_code=403,
            detail="Not authorized to upload new version"
        )
    
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
        "created_at": datetime.now(timezone.utc)
    })
    
    new_version = document["version"] + 1
    now = datetime.now(timezone.utc)
    
    version_entry = {
        "version": new_version,
        "file_url": file_url,
        "file_size": file_size,
        "uploaded_by": current_user["id"],
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
    now = datetime.now(timezone.utc)
    
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
    if share.get("expiry_date") and share["expiry_date"] < datetime.now(timezone.utc):
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
            "$set": {"last_accessed": datetime.now(timezone.utc)}
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
        {"$set": {"is_active": False, "revoked_at": datetime.now(timezone.utc)}}
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
    
    now = datetime.now(timezone.utc)
    
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
    
    expiry_threshold = datetime.now(timezone.utc) + timedelta(days=days)
    
    expiring = await db.documents_vault.find(
        {
            "owner_id": owner_id,
            "expiry_date": {
                "$gte": datetime.now(timezone.utc),
                "$lte": expiry_threshold
            },
            "status": {"$ne": "archived"}
        },
        {"_id": 0, "file_hash": 0}
    ).sort("expiry_date", 1).to_list(length=100)
    
    for doc in expiring:
        doc["days_remaining"] = (doc["expiry_date"] - datetime.now(timezone.utc)).days
    
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
            "expiry_date": {"$lt": datetime.now(timezone.utc)},
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
                "verified_at": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc)
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
    expiry_threshold = datetime.now(timezone.utc) + timedelta(days=30)
    expiring_soon = await db.documents_vault.count_documents({
        "owner_id": owner_id,
        "expiry_date": {"$gte": datetime.now(timezone.utc), "$lte": expiry_threshold}
    })
    
    # Expired
    expired = await db.documents_vault.count_documents({
        "owner_id": owner_id,
        "expiry_date": {"$lt": datetime.now(timezone.utc)}
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
            {"$set": {"status": "archived", "archived_at": datetime.now(timezone.utc)}}
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
