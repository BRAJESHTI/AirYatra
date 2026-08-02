"""
Admin Document Verification Routes
Endpoints for admin to view and verify all uploaded documents
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from typing import Optional, List
from datetime import datetime, timezone
from database import get_database
from middleware import require_roles

router = APIRouter(prefix="/admin/document-vault", tags=["Admin Document Verification"])


@router.get("/verification-queue")
async def get_verification_queue(
    status: Optional[str] = None,
    category: Optional[str] = None,
    limit: int = Query(default=100, le=500),
    current_user: dict = Depends(require_roles(["admin"]))
):
    """
    Get all documents pending verification (Admin only)
    Returns documents from all operators/users for admin review
    """
    db = get_database()
    
    # Build query
    query = {}
    if status:
        query["verification_status"] = status
    if category:
        query["category"] = category
    
    # Fetch documents from vault
    documents = await db.documents_vault.find(
        query,
        {"_id": 0, "file_hash": 0, "versions_history": 0}
    ).sort("created_at", -1).limit(limit).to_list(length=limit)
    
    # Enrich with owner information
    for doc in documents:
        owner_id = doc.get("owner_id")
        if owner_id:
            # Try to find user
            user = await db.users.find_one(
                {"id": owner_id},
                {"_id": 0, "name": 1, "email": 1, "company_name": 1}
            )
            if user:
                doc["owner_name"] = user.get("name") or user.get("company_name", "Unknown")
                doc["owner_email"] = user.get("email", "")
            
            # Try to find operator
            operator = await db.operators.find_one(
                {"user_id": owner_id},
                {"_id": 0, "company_name": 1}
            )
            if operator:
                doc["operator_name"] = operator.get("company_name", "")
    
    return {
        "success": True,
        "documents": documents,
        "total": len(documents)
    }


@router.get("/stats")
async def get_document_stats(
    current_user: dict = Depends(require_roles(["admin"]))
):
    """
    Get document verification statistics
    """
    db = get_database()
    
    # Count by verification status
    pending = await db.documents_vault.count_documents({"verification_status": "pending"})
    verified = await db.documents_vault.count_documents({"verification_status": "verified"})
    rejected = await db.documents_vault.count_documents({"verification_status": "rejected"})
    
    # Count by category
    category_pipeline = [
        {"$group": {"_id": "$category", "count": {"$sum": 1}}}
    ]
    by_category = await db.documents_vault.aggregate(category_pipeline).to_list(20)
    
    # Recent uploads (last 7 days)
    from datetime import timedelta
    week_ago = datetime.now(timezone.utc) - timedelta(days=7)
    recent_count = await db.documents_vault.count_documents({
        "created_at": {"$gte": week_ago}
    })
    
    return {
        "success": True,
        "stats": {
            "by_status": {
                "pending": pending,
                "verified": verified,
                "rejected": rejected
            },
            "by_category": {cat["_id"]: cat["count"] for cat in by_category},
            "recent_uploads_7d": recent_count,
            "total": pending + verified + rejected
        }
    }


@router.post("/bulk-verify")
async def bulk_verify_documents(
    document_ids: List[str],
    verification_status: str,
    notes: Optional[str] = None,
    current_user: dict = Depends(require_roles(["admin"]))
):
    """
    Bulk verify/reject multiple documents
    """
    if verification_status not in ["verified", "rejected"]:
        raise HTTPException(status_code=400, detail="Invalid verification status")
    
    db = get_database()
    
    result = await db.documents_vault.update_many(
        {"document_id": {"$in": document_ids}},
        {
            "$set": {
                "verification_status": verification_status,
                "verified_by": current_user["id"],
                "verification_notes": notes,
                "verified_at": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc)
            }
        }
    )
    
    return {
        "success": True,
        "message": f"{result.modified_count} documents {verification_status}",
        "modified_count": result.modified_count
    }


@router.get("/operator/{operator_id}")
async def get_operator_documents(
    operator_id: str,
    current_user: dict = Depends(require_roles(["admin"]))
):
    """
    Get all documents for a specific operator
    """
    db = get_database()
    
    documents = await db.documents_vault.find(
        {"owner_id": operator_id},
        {"_id": 0, "file_hash": 0}
    ).sort("created_at", -1).to_list(200)
    
    # Get operator info
    operator = await db.operators.find_one(
        {"user_id": operator_id},
        {"_id": 0, "company_name": 1, "status": 1}
    )
    
    return {
        "success": True,
        "operator": operator,
        "documents": documents,
        "total": len(documents)
    }
