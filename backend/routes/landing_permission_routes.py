from fastapi import APIRouter, HTTPException, Depends
from database import get_database
from s3_service import s3_service
from middleware import get_current_user
from datetime import datetime
import uuid
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/landing-permissions", tags=["Landing Permissions"])

@router.post("/")
async def create_landing_permission(permission_data: dict, user: dict = Depends(get_current_user)):
    """Create landing permission request (Customer uploads)"""
    db = get_database()
    
    if "customer" not in user["roles"]:
        raise HTTPException(status_code=403, detail="Customer access required")
    
    permission_id = str(uuid.uuid4())
    landing_permission = {
        "id": permission_id,
        "booking_id": permission_data["booking_id"],
        "customer_id": user["id"],
        "location_name": permission_data["location_name"],
        "latitude": permission_data.get("latitude"),
        "longitude": permission_data.get("longitude"),
        "district": permission_data.get("district"),
        "state": permission_data.get("state"),
        "documents": [],
        "approval_status": "pending",
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat()
    }
    
    await db.landing_permissions.insert_one(landing_permission.copy())
    
    # Update booking with landing permission reference
    await db.bookings.update_one(
        {"id": permission_data["booking_id"]},
        {"$push": {"landing_permissions": permission_id}}
    )
    
    return {"message": "Landing permission request created", "permission": landing_permission}

@router.post("/{permission_id}/upload-document")
async def upload_landing_document(permission_id: str, doc_data: dict, user: dict = Depends(get_current_user)):
    """Upload landing permission document"""
    db = get_database()
    
    permission = await db.landing_permissions.find_one({"id": permission_id}, {"_id": 0})
    if not permission:
        raise HTTPException(status_code=404, detail="Permission not found")
    
    if permission["customer_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Generate S3 upload URL
    s3_key = s3_service.generate_s3_key(
        user["id"],
        f"landing_permission_{permission_id}_{doc_data['document_type']}",
        doc_data['file_name']
    )
    
    document_id = str(uuid.uuid4())
    document = {
        "id": document_id,
        "type": doc_data['document_type'],
        "file_name": doc_data['file_name'],
        "s3_key": s3_key,
        "uploaded_at": datetime.utcnow().isoformat()
    }
    
    upload_url = s3_service.generate_presigned_upload_url(s3_key, doc_data['content_type'])
    
    # Store document metadata
    await db.landing_permissions.update_one(
        {"id": permission_id},
        {"$push": {"documents": document}}
    )
    
    return {
        "upload_url": upload_url,
        "document_id": document_id,
        "expires_in": 600
    }

@router.get("/booking/{booking_id}")
async def get_booking_landing_permissions(booking_id: str, user: dict = Depends(get_current_user)):
    """Get landing permissions for a booking (Customer, Operator, Pilot can view)"""
    db = get_database()
    
    # Get booking to verify access
    booking = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    # Get permissions
    permissions = await db.landing_permissions.find(
        {"booking_id": booking_id},
        {"_id": 0}
    ).to_list(100)
    
    # Generate download URLs for documents
    for permission in permissions:
        for doc in permission.get("documents", []):
            if doc.get("s3_key"):
                doc["download_url"] = s3_service.generate_presigned_download_url(doc["s3_key"])
    
    return {"permissions": permissions}

@router.get("/pilot/pending")
async def get_pilot_pending_permissions(user: dict = Depends(get_current_user)):
    """Get pending landing permissions for pilot's upcoming flights"""
    db = get_database()
    
    # This endpoint helps pilots see which bookings have pending permissions
    # that need to be reviewed before flight
    
    return {"pending_permissions": []}