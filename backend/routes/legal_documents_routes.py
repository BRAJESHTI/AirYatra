"""
AirYatra Legal Documents Management Routes
Admin can manage Terms & Conditions, Refund Policy, Privacy Policy, Operator Agreement etc.
Supports versioning (V1, V2, etc.) and draft/published states
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
from database import get_database
from middleware import require_roles, get_current_user
import logging
import uuid

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/legal-documents", tags=["Legal Documents"])


# ==================== DOCUMENT TYPES ====================

DOCUMENT_TYPES = {
    "terms_conditions": {
        "name": "Terms & Conditions",
        "description": "General terms and conditions for using AirYatra services",
        "required": True
    },
    "refund_policy": {
        "name": "Refund Policy",
        "description": "Cancellation and refund policy for bookings",
        "required": True
    },
    "privacy_policy": {
        "name": "Privacy Policy",
        "description": "How we collect, use, and protect customer data",
        "required": True
    },
    "operator_agreement": {
        "name": "Operator Agreement",
        "description": "Terms for helicopter operators partnering with AirYatra",
        "required": False
    },
    "booking_terms": {
        "name": "Booking Terms",
        "description": "Specific terms for helicopter bookings",
        "required": True
    },
    "safety_guidelines": {
        "name": "Safety Guidelines",
        "description": "Safety instructions for passengers",
        "required": False
    },
    "cookie_policy": {
        "name": "Cookie Policy",
        "description": "Information about cookies and tracking",
        "required": False
    }
}


# ==================== PYDANTIC MODELS ====================

class DocumentCreate(BaseModel):
    doc_type: str
    title: str
    content: str  # HTML or Markdown content
    version: str = "1.0"
    effective_date: Optional[str] = None
    is_draft: bool = True
    language: str = "en"

class DocumentUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    version: Optional[str] = None
    effective_date: Optional[str] = None
    is_draft: Optional[bool] = None


# ==================== PUBLIC ENDPOINTS ====================

@router.get("/types")
async def get_document_types():
    """Get all available document types"""
    return {
        "success": True,
        "types": [
            {"id": k, **v} for k, v in DOCUMENT_TYPES.items()
        ]
    }


@router.get("/public/{doc_type}")
async def get_public_document(doc_type: str, language: str = "en"):
    """Get published document for public viewing (no auth required)"""
    db = get_database()
    
    if doc_type not in DOCUMENT_TYPES:
        raise HTTPException(status_code=404, detail="Document type not found")
    
    # Get latest published version
    doc = await db.legal_documents.find_one(
        {"doc_type": doc_type, "is_draft": False, "language": language},
        {"_id": 0},
        sort=[("version", -1), ("published_at", -1)]
    )
    
    if not doc:
        # Try default language
        doc = await db.legal_documents.find_one(
            {"doc_type": doc_type, "is_draft": False, "language": "en"},
            {"_id": 0},
            sort=[("version", -1), ("published_at", -1)]
        )
    
    if not doc:
        return {
            "success": False,
            "message": f"{DOCUMENT_TYPES[doc_type]['name']} not yet published"
        }
    
    return {
        "success": True,
        "document": doc
    }


@router.get("/public/all")
async def get_all_public_documents(language: str = "en"):
    """Get all published documents for public viewing"""
    db = get_database()
    
    documents = {}
    for doc_type in DOCUMENT_TYPES.keys():
        doc = await db.legal_documents.find_one(
            {"doc_type": doc_type, "is_draft": False, "language": language},
            {"_id": 0},
            sort=[("version", -1), ("published_at", -1)]
        )
        if doc:
            documents[doc_type] = doc
    
    return {
        "success": True,
        "documents": documents,
        "types": DOCUMENT_TYPES
    }


# ==================== ADMIN ENDPOINTS ====================

@router.get("/admin/list")
async def list_all_documents(
    doc_type: Optional[str] = None,
    include_drafts: bool = True,
    limit: int = Query(100, le=500),
    current_user: dict = Depends(require_roles(["admin", "super_admin"]))
):
    """List all documents (Admin)"""
    db = get_database()
    
    query = {}
    if doc_type:
        query["doc_type"] = doc_type
    if not include_drafts:
        query["is_draft"] = False
    
    docs = await db.legal_documents.find(query, {"_id": 0}).sort([
        ("doc_type", 1),
        ("version", -1),
        ("created_at", -1)
    ]).to_list(limit)
    
    # Get stats
    stats = {}
    for dt in DOCUMENT_TYPES.keys():
        published = await db.legal_documents.count_documents({"doc_type": dt, "is_draft": False})
        drafts = await db.legal_documents.count_documents({"doc_type": dt, "is_draft": True})
        stats[dt] = {"published": published, "drafts": drafts}
    
    return {
        "success": True,
        "documents": docs,
        "stats": stats,
        "types": DOCUMENT_TYPES
    }


@router.get("/admin/{doc_id}")
async def get_document(
    doc_id: str,
    current_user: dict = Depends(require_roles(["admin", "super_admin"]))
):
    """Get specific document by ID (Admin)"""
    db = get_database()
    
    doc = await db.legal_documents.find_one({"id": doc_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    
    return {"success": True, "document": doc}


@router.post("/admin/create")
async def create_document(
    data: DocumentCreate,
    current_user: dict = Depends(require_roles(["admin", "super_admin"]))
):
    """Create a new legal document (Admin)"""
    db = get_database()
    
    if data.doc_type not in DOCUMENT_TYPES:
        raise HTTPException(status_code=400, detail="Invalid document type")
    
    # Check for existing version
    existing = await db.legal_documents.find_one({
        "doc_type": data.doc_type,
        "version": data.version,
        "language": data.language
    })
    if existing:
        raise HTTPException(status_code=400, detail=f"Version {data.version} already exists for this document type")
    
    doc = {
        "id": str(uuid.uuid4()),
        "doc_type": data.doc_type,
        "type_name": DOCUMENT_TYPES[data.doc_type]["name"],
        "title": data.title,
        "content": data.content,
        "version": data.version,
        "language": data.language,
        "effective_date": data.effective_date,
        "is_draft": data.is_draft,
        "created_by": current_user["id"],
        "created_by_name": current_user.get("full_name", current_user.get("name", "Admin")),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "published_at": None if data.is_draft else datetime.now(timezone.utc).isoformat()
    }
    
    await db.legal_documents.insert_one(doc.copy())
    
    return {
        "success": True,
        "message": "Document created",
        "document_id": doc["id"],
        "is_draft": doc["is_draft"]
    }


@router.put("/admin/{doc_id}")
async def update_document(
    doc_id: str,
    data: DocumentUpdate,
    current_user: dict = Depends(require_roles(["admin", "super_admin"]))
):
    """Update a document (Admin)"""
    db = get_database()
    
    doc = await db.legal_documents.find_one({"id": doc_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    
    update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
    
    if data.title is not None:
        update_data["title"] = data.title
    if data.content is not None:
        update_data["content"] = data.content
    if data.version is not None:
        update_data["version"] = data.version
    if data.effective_date is not None:
        update_data["effective_date"] = data.effective_date
    if data.is_draft is not None:
        update_data["is_draft"] = data.is_draft
        if not data.is_draft:
            update_data["published_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.legal_documents.update_one({"id": doc_id}, {"$set": update_data})
    
    return {"success": True, "message": "Document updated"}


@router.post("/admin/{doc_id}/publish")
async def publish_document(
    doc_id: str,
    current_user: dict = Depends(require_roles(["admin", "super_admin"]))
):
    """Publish a draft document (Admin)"""
    db = get_database()
    
    doc = await db.legal_documents.find_one({"id": doc_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    
    if not doc.get("is_draft"):
        raise HTTPException(status_code=400, detail="Document is already published")
    
    await db.legal_documents.update_one(
        {"id": doc_id},
        {"$set": {
            "is_draft": False,
            "published_at": datetime.now(timezone.utc).isoformat(),
            "published_by": current_user["id"]
        }}
    )
    
    return {"success": True, "message": "Document published"}


@router.post("/admin/{doc_id}/unpublish")
async def unpublish_document(
    doc_id: str,
    current_user: dict = Depends(require_roles(["admin", "super_admin"]))
):
    """Unpublish a document (move to draft) (Admin)"""
    db = get_database()
    
    doc = await db.legal_documents.find_one({"id": doc_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    
    await db.legal_documents.update_one(
        {"id": doc_id},
        {"$set": {"is_draft": True}}
    )
    
    return {"success": True, "message": "Document moved to drafts"}


@router.post("/admin/{doc_id}/new-version")
async def create_new_version(
    doc_id: str,
    new_version: str = Query(..., description="New version number e.g., 2.0"),
    current_user: dict = Depends(require_roles(["admin", "super_admin"]))
):
    """Create a new version of existing document (Admin)"""
    db = get_database()
    
    doc = await db.legal_documents.find_one({"id": doc_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Check if version already exists
    existing = await db.legal_documents.find_one({
        "doc_type": doc["doc_type"],
        "version": new_version,
        "language": doc["language"]
    })
    if existing:
        raise HTTPException(status_code=400, detail=f"Version {new_version} already exists")
    
    # Create new version as draft
    new_doc = {
        "id": str(uuid.uuid4()),
        "doc_type": doc["doc_type"],
        "type_name": doc["type_name"],
        "title": doc["title"],
        "content": doc["content"],
        "version": new_version,
        "language": doc["language"],
        "effective_date": None,
        "is_draft": True,
        "created_by": current_user["id"],
        "created_by_name": current_user.get("full_name", "Admin"),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "published_at": None,
        "previous_version": doc["version"],
        "previous_version_id": doc_id
    }
    
    await db.legal_documents.insert_one(new_doc.copy())
    
    return {
        "success": True,
        "message": f"Version {new_version} created as draft",
        "document_id": new_doc["id"]
    }


@router.delete("/admin/{doc_id}")
async def delete_document(
    doc_id: str,
    current_user: dict = Depends(require_roles(["super_admin"]))
):
    """Delete a document (Super Admin only)"""
    db = get_database()
    
    doc = await db.legal_documents.find_one({"id": doc_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    
    if not doc.get("is_draft"):
        raise HTTPException(status_code=400, detail="Cannot delete published documents. Unpublish first.")
    
    await db.legal_documents.delete_one({"id": doc_id})
    
    return {"success": True, "message": "Document deleted"}


# ==================== VERSION HISTORY ====================

@router.get("/admin/history/{doc_type}")
async def get_version_history(
    doc_type: str,
    language: str = "en",
    current_user: dict = Depends(require_roles(["admin", "super_admin"]))
):
    """Get version history for a document type"""
    db = get_database()
    
    if doc_type not in DOCUMENT_TYPES:
        raise HTTPException(status_code=404, detail="Document type not found")
    
    versions = await db.legal_documents.find(
        {"doc_type": doc_type, "language": language},
        {"_id": 0, "content": 0}  # Exclude content for lighter response
    ).sort("version", -1).to_list(100)
    
    return {
        "success": True,
        "doc_type": doc_type,
        "type_info": DOCUMENT_TYPES[doc_type],
        "versions": versions
    }
