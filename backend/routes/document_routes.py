from fastapi import APIRouter, HTTPException, Depends
from database import get_database
from s3_service import s3_service
from middleware import get_current_user
from datetime import datetime, timedelta, timezone
import uuid
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/documents", tags=["Documents"])

@router.post("/generate-upload-url")
async def generate_upload_url(data: dict, user: dict = Depends(get_current_user)):
    """Generate presigned URL for document upload"""
    db = get_database()
    
    # Validate file type
    allowed_types = ['pdf', 'jpg', 'jpeg', 'png']
    file_extension = data['file_name'].split('.')[-1].lower()
    if file_extension not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail=f"File type {file_extension} not allowed"
        )
    
    # Generate S3 key
    s3_key = s3_service.generate_s3_key(
        user["id"],
        data['document_type'],
        data['file_name']
    )
    
    # Create document record
    document_id = str(uuid.uuid4())
    document = {
        "id": document_id,
        "user_id": user["id"],
        "document_type": data['document_type'],
        "file_name": data['file_name'],
        "file_size": data['file_size'],
        "content_type": data['content_type'],
        "s3_key": s3_key,
        "status": "uploading",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=90)).isoformat()
    }
    
    await db.documents.insert_one(document)
    
    # Generate presigned URL
    upload_url = s3_service.generate_presigned_upload_url(s3_key, data['content_type'])
    
    return {
        "upload_url": upload_url,
        "document_id": document_id,
        "expires_in": 600
    }

@router.post("/{document_id}/confirm-upload")
async def confirm_upload(document_id: str, user: dict = Depends(get_current_user)):
    """Confirm document was uploaded successfully"""
    db = get_database()
    
    document = await db.documents.find_one({"id": document_id}, {"_id": 0})
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    if document["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Verify object exists in S3
    if not s3_service.verify_object_exists(document['s3_key']):
        raise HTTPException(status_code=400, detail="File not found in storage")
    
    # Update status
    await db.documents.update_one(
        {"id": document_id},
        {"$set": {"status": "completed", "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"message": "Document uploaded successfully", "document_id": document_id}

@router.get("/{document_id}/download-url")
async def get_download_url(document_id: str, user: dict = Depends(get_current_user)):
    """Generate presigned download URL"""
    db = get_database()
    
    document = await db.documents.find_one({"id": document_id}, {"_id": 0})
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    download_url = s3_service.generate_presigned_download_url(document['s3_key'])
    
    return {
        "download_url": download_url,
        "file_name": document['file_name'],
        "expires_in": 3600
    }

@router.get("/")
async def list_documents(user: dict = Depends(get_current_user)):
    """List user's documents"""
    db = get_database()
    
    documents = await db.documents.find(
        {"user_id": user["id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    return {"documents": documents}

@router.delete("/{document_id}")
async def delete_document(document_id: str, user: dict = Depends(get_current_user)):
    """Delete a document"""
    db = get_database()
    
    document = await db.documents.find_one({"id": document_id}, {"_id": 0})
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    if document["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Delete from S3
    s3_service.delete_object(document['s3_key'])
    
    # Delete from database
    await db.documents.delete_one({"id": document_id})
    
    return {"message": "Document deleted"}