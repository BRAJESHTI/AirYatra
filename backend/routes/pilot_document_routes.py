from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from database import get_database
from s3_service import s3_service
from middleware import get_current_user
from ai_service import ai_service
from datetime import datetime, timedelta
import uuid
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/pilot-documents", tags=["Pilot Documents"])

@router.post("/upload-url")
async def generate_pilot_document_upload_url(data: dict, user: dict = Depends(get_current_user)):
    """Generate presigned URL for pilot document upload"""
    db = get_database()
    
    if "operator" not in user["roles"]:
        raise HTTPException(status_code=403, detail="Operator access required")
    
    operator = await db.operators.find_one({"user_id": user["id"]}, {"_id": 0})
    if not operator:
        raise HTTPException(status_code=404, detail="Operator profile not found")
    
    # Validate file type
    allowed_types = ['pdf', 'jpg', 'jpeg', 'png']
    file_extension = data['file_name'].split('.')[-1].lower()
    if file_extension not in allowed_types:
        raise HTTPException(status_code=400, detail=f"File type {file_extension} not allowed")
    
    # Generate S3 key
    s3_key = s3_service.generate_s3_key(
        operator["id"],
        f"pilot_{data['pilot_id']}_{data['document_type']}",
        data['file_name']
    )
    
    # Create document record
    document_id = str(uuid.uuid4())
    document = {
        "id": document_id,
        "pilot_id": data['pilot_id'],
        "operator_id": operator["id"],
        "document_type": data['document_type'],
        "file_name": data['file_name'],
        "file_size": data['file_size'],
        "content_type": data['content_type'],
        "s3_key": s3_key,
        "status": "uploading",
        "expiry_date": data.get('expiry_date'),
        "issue_date": data.get('issue_date'),
        "created_at": datetime.utcnow().isoformat()
    }
    
    await db.pilot_documents.insert_one(document.copy())
    
    # Generate presigned URL
    upload_url = s3_service.generate_presigned_upload_url(s3_key, data['content_type'])
    
    return {
        "upload_url": upload_url,
        "document_id": document_id,
        "s3_key": s3_key,
        "expires_in": 600
    }

@router.post("/{document_id}/confirm")
async def confirm_pilot_document_upload(document_id: str, user: dict = Depends(get_current_user)):
    """Confirm pilot document upload and trigger AI verification"""
    db = get_database()
    
    if "operator" not in user["roles"]:
        raise HTTPException(status_code=403, detail="Operator access required")
    
    document = await db.pilot_documents.find_one({"id": document_id}, {"_id": 0})
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Verify S3 upload
    if not s3_service.verify_object_exists(document['s3_key']):
        raise HTTPException(status_code=400, detail="File not found in storage")
    
    # Update pilot with document reference
    await db.pilots.update_one(
        {"id": document['pilot_id']},
        {"$push": {"documents": {
            "id": document_id,
            "type": document['document_type'],
            "file_name": document['file_name'],
            "s3_key": document['s3_key'],
            "expiry_date": document.get('expiry_date'),
            "issue_date": document.get('issue_date'),
            "uploaded_at": datetime.utcnow().isoformat()
        }}}
    )
    
    # Update document status
    await db.pilot_documents.update_one(
        {"id": document_id},
        {"$set": {"status": "completed", "confirmed_at": datetime.utcnow().isoformat()}}
    )
    
    # AI verification for license documents
    if document['document_type'] == 'license_copy':
        try:
            pilot = await db.pilots.find_one({"id": document['pilot_id']}, {"_id": 0})
            verification = await ai_service.verify_document({
                "document_id": document_id,
                "document_type": "pilot_license",
                "file_name": document['file_name'],
                "uploaded_by": user["full_name"],
                "pilot_license_number": pilot.get('license_number')
            })
            
            await db.pilot_documents.update_one(
                {"id": document_id},
                {"$set": {"ai_verification": verification}}
            )
        except Exception as e:
            logger.error(f"AI verification failed: {e}")
    
    return {"message": "Document uploaded successfully", "document_id": document_id}

@router.get("/pilot/{pilot_id}")
async def get_pilot_documents(pilot_id: str, user: dict = Depends(get_current_user)):
    """Get all documents for a pilot"""
    db = get_database()
    
    if "operator" not in user["roles"]:
        raise HTTPException(status_code=403, detail="Operator access required")
    
    documents = await db.pilot_documents.find(
        {"pilot_id": pilot_id, "status": "completed"},
        {"_id": 0}
    ).to_list(100)
    
    # Generate download URLs
    for doc in documents:
        if doc.get('s3_key'):
            doc['download_url'] = s3_service.generate_presigned_download_url(doc['s3_key'])
    
    return {"documents": documents}

@router.delete("/{document_id}")
async def delete_pilot_document(document_id: str, user: dict = Depends(get_current_user)):
    """Delete pilot document"""
    db = get_database()
    
    if "operator" not in user["roles"]:
        raise HTTPException(status_code=403, detail="Operator access required")
    
    document = await db.pilot_documents.find_one({"id": document_id}, {"_id": 0})
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Delete from S3
    s3_service.delete_object(document['s3_key'])
    
    # Remove from pilot
    await db.pilots.update_one(
        {"id": document['pilot_id']},
        {"$pull": {"documents": {"id": document_id}}}
    )
    
    # Delete document record
    await db.pilot_documents.delete_one({"id": document_id})
    
    return {"message": "Document deleted"}

@router.get("/expiring-soon")
async def get_expiring_documents(user: dict = Depends(get_current_user)):
    """Get pilot documents expiring within 30 days"""
    db = get_database()
    
    if "operator" not in user["roles"]:
        raise HTTPException(status_code=403, detail="Operator access required")
    
    operator = await db.operators.find_one({"user_id": user["id"]}, {"_id": 0})
    if not operator:
        return {"expiring_documents": []}
    
    thirty_days_later = (datetime.utcnow() + timedelta(days=30)).isoformat()
    
    expiring_docs = await db.pilot_documents.find({
        "operator_id": operator["id"],
        "status": "completed",
        "expiry_date": {"$lte": thirty_days_later, "$gte": datetime.utcnow().isoformat()}
    }, {"_id": 0}).to_list(100)
    
    return {"expiring_documents": expiring_docs}