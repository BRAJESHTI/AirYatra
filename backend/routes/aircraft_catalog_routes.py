"""
Aircraft Catalog & Verification System - AirYatra CMS (Compliance Management System)
Enterprise-level aircraft verification module with document management.

Sections:
- A: Operator Verification (Company Documents)
- B: DGCA & Operator Documents
- C: Aircraft Documents (Registration, Airworthiness, Insurance, Maintenance, Crew, Photos)
- D: Commercial Details (Pricing)
- E: Aircraft Features (Amenities)
- F: Availability Status
- G: Document Expiry Tracking

Verification Levels:
- pending (🔴)
- under_review (🟡)
- verified (🟢)
- premium_verified (🔵)
- suspended (⚫)
"""

from fastapi import APIRouter, HTTPException, Depends, Query, UploadFile, File, Form
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta, timezone
from bson import ObjectId
import uuid

from database import get_database
from middleware import get_current_user, require_roles

router = APIRouter(prefix="/aircraft", tags=["Aircraft Catalog"])


# ============ MODELS ============

class AircraftBasicInfo(BaseModel):
    """Section C - Basic Aircraft Info"""
    aircraft_type: str  # helicopter, light_jet, mid_jet, heavy_jet
    manufacturer: str  # Bell, Airbus, Cessna, etc.
    model: str  # 407, H145, Citation XLS
    year_of_manufacture: int
    registration_number: str  # VT-XXX
    serial_number: Optional[str] = None


class AircraftDocuments(BaseModel):
    """Section C - Aircraft Documents"""
    registration_certificate: Optional[str] = None  # File URL
    certificate_of_airworthiness: Optional[str] = None
    insurance_policy: Optional[str] = None
    insurance_expiry: Optional[str] = None  # YYYY-MM-DD
    maintenance_release: Optional[str] = None
    last_maintenance_date: Optional[str] = None
    next_maintenance_due: Optional[str] = None
    camo_provider: Optional[str] = None  # Maintenance provider


class CrewMember(BaseModel):
    """Flight Crew Info"""
    role: str  # pilot, co_pilot, crew
    name: str
    licence_number: Optional[str] = None
    experience_hours: Optional[int] = None
    medical_validity: Optional[str] = None  # YYYY-MM-DD
    status: str = "active"  # active, inactive, expired


class AircraftPricing(BaseModel):
    """Section D - Commercial Details"""
    one_way_price: Optional[float] = None
    return_price: Optional[float] = None
    hourly_price: Optional[float] = None
    daily_price: Optional[float] = None
    night_halt_charges: Optional[float] = None
    waiting_charges_per_hour: Optional[float] = None
    landing_charges: Optional[float] = None
    helipad_charges: Optional[float] = None
    crew_charges: Optional[float] = None
    currency: str = "INR"


class AircraftFeatures(BaseModel):
    """Section E - Aircraft Features & Amenities"""
    total_seats: int = 4
    vip_seats: int = 0
    cabin_size: Optional[str] = None  # small, medium, large
    air_conditioning: bool = True
    wifi: bool = False
    entertainment_system: bool = False
    charging_ports: bool = True
    refreshments: bool = False
    food_service: bool = False
    lavatory: bool = False
    baggage_capacity_kg: Optional[int] = None
    pet_friendly: bool = False
    wheelchair_accessible: bool = False


class SafetyEquipment(BaseModel):
    """Section C - Safety Equipment"""
    first_aid_kit: bool = True
    fire_extinguisher: bool = True
    elt: bool = True  # Emergency Locator Transmitter
    life_jackets: bool = False
    oxygen_kit: bool = False
    medical_equipment: bool = False  # For air ambulance


class AircraftPhotos(BaseModel):
    """Section C - Aircraft Photos"""
    front: Optional[str] = None
    rear: Optional[str] = None
    left: Optional[str] = None
    right: Optional[str] = None
    cockpit: Optional[str] = None
    cabin: Optional[str] = None
    interior: Optional[str] = None
    vip_cabin: Optional[str] = None
    emergency_equipment: Optional[str] = None
    safety_equipment: Optional[str] = None


class CreateAircraftRequest(BaseModel):
    """Full aircraft creation request"""
    # Basic Info
    basic_info: AircraftBasicInfo
    # Features & Amenities
    features: AircraftFeatures
    # Pricing
    pricing: AircraftPricing
    # Safety Equipment
    safety_equipment: Optional[SafetyEquipment] = None
    # Description
    description: Optional[str] = None
    highlights: Optional[List[str]] = None


class UpdateVerificationRequest(BaseModel):
    """Admin verification update"""
    verification_status: str  # pending, under_review, verified, premium_verified, suspended
    verification_notes: Optional[str] = None
    documents_verified: bool = False
    photos_verified: bool = False
    pricing_verified: bool = False
    publish: bool = False


# ============ CONSTANTS ============

VERIFICATION_STATUS = {
    "pending": {"label": "Pending", "emoji": "🔴", "color": "red"},
    "under_review": {"label": "Under Review", "emoji": "🟡", "color": "yellow"},
    "verified": {"label": "Verified", "emoji": "🟢", "color": "green"},
    "premium_verified": {"label": "Premium Verified", "emoji": "🔵", "color": "blue"},
    "suspended": {"label": "Suspended", "emoji": "⚫", "color": "gray"}
}

AVAILABILITY_STATUS = {
    "available": "Available",
    "busy": "Busy / In Flight",
    "maintenance": "Under Maintenance",
    "reserved": "Reserved",
    "blocked": "Blocked"
}

AIRCRAFT_TYPES = {
    "helicopter": "Helicopter / हेलीकॉप्टर",
    "light_jet": "Light Jet / लाइट जेट",
    "mid_jet": "Mid Jet / मिड जेट",
    "heavy_jet": "Heavy Jet / हैवी जेट",
    "turboprop": "Turboprop / टर्बोप्रॉप"
}

DOCUMENT_TYPES = [
    "registration_certificate",
    "certificate_of_airworthiness", 
    "insurance_policy",
    "maintenance_release",
    "operator_agreement"
]


# ============ HELPER FUNCTIONS ============

def calculate_expiry_status(expiry_date: str) -> dict:
    """Calculate document expiry status and days remaining"""
    if not expiry_date:
        return {"status": "unknown", "days_remaining": None}
    
    try:
        expiry = datetime.strptime(expiry_date, "%Y-%m-%d").date()
        today = datetime.now().date()
        days_remaining = (expiry - today).days
        
        if days_remaining < 0:
            return {"status": "expired", "days_remaining": days_remaining, "urgent": True}
        elif days_remaining <= 7:
            return {"status": "critical", "days_remaining": days_remaining, "urgent": True}
        elif days_remaining <= 15:
            return {"status": "urgent", "days_remaining": days_remaining, "urgent": True}
        elif days_remaining <= 30:
            return {"status": "warning", "days_remaining": days_remaining, "urgent": False}
        elif days_remaining <= 60:
            return {"status": "attention", "days_remaining": days_remaining, "urgent": False}
        elif days_remaining <= 90:
            return {"status": "notice", "days_remaining": days_remaining, "urgent": False}
        else:
            return {"status": "valid", "days_remaining": days_remaining, "urgent": False}
    except (ValueError, TypeError):
        return {"status": "unknown", "days_remaining": None}


def get_verification_badge(status: str) -> dict:
    """Get verification badge info for display"""
    config = VERIFICATION_STATUS.get(status, VERIFICATION_STATUS["pending"])
    return {
        "status": status,
        "label": config["label"],
        "emoji": config["emoji"],
        "color": config["color"],
        "is_verified": status in ["verified", "premium_verified"],
        "badge_text": "✅ Verified by AirYatra" if status in ["verified", "premium_verified"] else None
    }


# ============ OPERATOR ENDPOINTS ============

@router.post("/create")
async def create_aircraft(
    request: CreateAircraftRequest,
    current_user: dict = Depends(require_roles(["operator"]))
):
    """
    Operator creates new aircraft listing
    """
    db = get_database()
    
    # Check if registration number already exists
    existing = await db.aircraft_catalog.find_one({
        "basic_info.registration_number": request.basic_info.registration_number
    })
    if existing:
        raise HTTPException(status_code=400, detail="Aircraft with this registration number already exists")
    
    now = datetime.now(timezone.utc).isoformat()
    
    # Create aircraft document
    aircraft = {
        "id": str(uuid.uuid4()),
        "operator_id": current_user["id"],
        "operator_email": current_user.get("email"),
        
        # Basic Info (Section C)
        "basic_info": request.basic_info.dict(),
        
        # Features & Amenities (Section E)
        "features": request.features.dict(),
        
        # Pricing (Section D)
        "pricing": request.pricing.dict(),
        
        # Safety Equipment
        "safety_equipment": request.safety_equipment.dict() if request.safety_equipment else {
            "first_aid_kit": True,
            "fire_extinguisher": True,
            "elt": True,
            "life_jackets": False,
            "oxygen_kit": False,
            "medical_equipment": False
        },
        
        # Documents (initially empty)
        "documents": {
            "registration_certificate": None,
            "certificate_of_airworthiness": None,
            "insurance_policy": None,
            "insurance_expiry": None,
            "maintenance_release": None,
            "last_maintenance_date": None,
            "next_maintenance_due": None,
            "camo_provider": None
        },
        
        # Photos (initially empty)
        "photos": {
            "front": None,
            "rear": None,
            "left": None,
            "right": None,
            "cockpit": None,
            "cabin": None,
            "interior": None,
            "vip_cabin": None
        },
        
        # Crew (initially empty)
        "crew": [],
        
        # Description
        "description": request.description,
        "highlights": request.highlights or [],
        
        # Availability (Section F)
        "availability_status": "available",
        
        # Verification (Section G)
        "verification": {
            "status": "pending",
            "documents_verified": False,
            "photos_verified": False,
            "pricing_verified": False,
            "operator_verified": False,
            "last_reviewed_at": None,
            "reviewed_by": None,
            "notes": None
        },
        
        # Publishing
        "is_published": False,
        "published_at": None,
        
        # Metadata
        "created_at": now,
        "updated_at": now,
        "version": "1.0"
    }
    
    await db.aircraft_catalog.insert_one(aircraft)
    
    return {
        "success": True,
        "aircraft_id": aircraft["id"],
        "registration": request.basic_info.registration_number,
        "message": "Aircraft created! Please upload documents and photos for verification.",
        "next_steps": [
            "Upload Registration Certificate",
            "Upload Insurance Policy",
            "Upload Aircraft Photos",
            "Add Crew Information"
        ]
    }


@router.get("/my-fleet")
async def get_operator_fleet(
    status: Optional[str] = None,
    current_user: dict = Depends(require_roles(["operator"]))
):
    """
    Get all aircraft for current operator
    """
    db = get_database()
    
    query = {"operator_id": current_user["id"]}
    if status:
        query["verification.status"] = status
    
    aircraft_list = await db.aircraft_catalog.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    # Add expiry status for each aircraft
    for aircraft in aircraft_list:
        docs = aircraft.get("documents", {})
        aircraft["expiry_alerts"] = {
            "insurance": calculate_expiry_status(docs.get("insurance_expiry")),
            "maintenance": calculate_expiry_status(docs.get("next_maintenance_due"))
        }
        aircraft["verification_badge"] = get_verification_badge(
            aircraft.get("verification", {}).get("status", "pending")
        )
    
    return {
        "aircraft": aircraft_list,
        "count": len(aircraft_list),
        "stats": {
            "total": len(aircraft_list),
            "verified": len([a for a in aircraft_list if a.get("verification", {}).get("status") in ["verified", "premium_verified"]]),
            "pending": len([a for a in aircraft_list if a.get("verification", {}).get("status") == "pending"]),
            "published": len([a for a in aircraft_list if a.get("is_published")])
        }
    }


@router.get("/{aircraft_id}")
async def get_aircraft_details(
    aircraft_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Get detailed aircraft information
    """
    db = get_database()
    
    aircraft = await db.aircraft_catalog.find_one(
        {"id": aircraft_id},
        {"_id": 0}
    )
    
    if not aircraft:
        raise HTTPException(status_code=404, detail="Aircraft not found")
    
    # Check access - owner, admin, or published aircraft
    is_owner = aircraft["operator_id"] == current_user["id"]
    is_admin = "admin" in current_user.get("roles", [])
    is_published = aircraft.get("is_published", False)
    
    if not (is_owner or is_admin or is_published):
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Add computed fields
    aircraft["verification_badge"] = get_verification_badge(
        aircraft.get("verification", {}).get("status", "pending")
    )
    aircraft["expiry_alerts"] = {
        "insurance": calculate_expiry_status(aircraft.get("documents", {}).get("insurance_expiry")),
        "maintenance": calculate_expiry_status(aircraft.get("documents", {}).get("next_maintenance_due"))
    }
    
    return aircraft


@router.put("/{aircraft_id}")
async def update_aircraft(
    aircraft_id: str,
    request: CreateAircraftRequest,
    current_user: dict = Depends(require_roles(["operator"]))
):
    """
    Operator updates aircraft details
    """
    db = get_database()
    
    # Check ownership
    aircraft = await db.aircraft_catalog.find_one({"id": aircraft_id})
    if not aircraft:
        raise HTTPException(status_code=404, detail="Aircraft not found")
    
    if aircraft["operator_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="You can only edit your own aircraft")
    
    now = datetime.now(timezone.utc).isoformat()
    
    update_data = {
        "basic_info": request.basic_info.dict(),
        "features": request.features.dict(),
        "pricing": request.pricing.dict(),
        "description": request.description,
        "highlights": request.highlights or [],
        "updated_at": now
    }
    
    if request.safety_equipment:
        update_data["safety_equipment"] = request.safety_equipment.dict()
    
    # If already verified, mark for re-review
    if aircraft.get("verification", {}).get("status") in ["verified", "premium_verified"]:
        update_data["verification.status"] = "under_review"
        update_data["verification.notes"] = "Re-review required after update"
    
    await db.aircraft_catalog.update_one(
        {"id": aircraft_id},
        {"$set": update_data}
    )
    
    return {
        "success": True,
        "message": "Aircraft updated successfully"
    }


@router.put("/{aircraft_id}/documents")
async def update_aircraft_documents(
    aircraft_id: str,
    documents: AircraftDocuments,
    current_user: dict = Depends(require_roles(["operator"]))
):
    """
    Update aircraft documents (URLs from file upload)
    """
    db = get_database()
    
    aircraft = await db.aircraft_catalog.find_one({"id": aircraft_id})
    if not aircraft:
        raise HTTPException(status_code=404, detail="Aircraft not found")
    
    if aircraft["operator_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="You can only edit your own aircraft")
    
    now = datetime.now(timezone.utc).isoformat()
    
    await db.aircraft_catalog.update_one(
        {"id": aircraft_id},
        {
            "$set": {
                "documents": documents.dict(),
                "updated_at": now,
                "verification.documents_verified": False  # Needs re-verification
            }
        }
    )
    
    return {"success": True, "message": "Documents updated"}


@router.put("/{aircraft_id}/photos")
async def update_aircraft_photos(
    aircraft_id: str,
    photos: AircraftPhotos,
    current_user: dict = Depends(require_roles(["operator"]))
):
    """
    Update aircraft photos (URLs from file upload)
    """
    db = get_database()
    
    aircraft = await db.aircraft_catalog.find_one({"id": aircraft_id})
    if not aircraft:
        raise HTTPException(status_code=404, detail="Aircraft not found")
    
    if aircraft["operator_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="You can only edit your own aircraft")
    
    now = datetime.now(timezone.utc).isoformat()
    
    await db.aircraft_catalog.update_one(
        {"id": aircraft_id},
        {
            "$set": {
                "photos": photos.dict(),
                "updated_at": now,
                "verification.photos_verified": False
            }
        }
    )
    
    return {"success": True, "message": "Photos updated"}


@router.post("/{aircraft_id}/crew")
async def add_crew_member(
    aircraft_id: str,
    crew: CrewMember,
    current_user: dict = Depends(require_roles(["operator"]))
):
    """
    Add crew member to aircraft
    """
    db = get_database()
    
    aircraft = await db.aircraft_catalog.find_one({"id": aircraft_id})
    if not aircraft:
        raise HTTPException(status_code=404, detail="Aircraft not found")
    
    if aircraft["operator_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    crew_data = crew.dict()
    crew_data["id"] = str(uuid.uuid4())
    crew_data["added_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.aircraft_catalog.update_one(
        {"id": aircraft_id},
        {
            "$push": {"crew": crew_data},
            "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
        }
    )
    
    return {"success": True, "crew_id": crew_data["id"]}


@router.put("/{aircraft_id}/availability")
async def update_availability(
    aircraft_id: str,
    status: str = Query(..., description="available, busy, maintenance, reserved, blocked"),
    current_user: dict = Depends(require_roles(["operator"]))
):
    """
    Update aircraft availability status
    """
    db = get_database()
    
    if status not in AVAILABILITY_STATUS:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {list(AVAILABILITY_STATUS.keys())}")
    
    aircraft = await db.aircraft_catalog.find_one({"id": aircraft_id})
    if not aircraft:
        raise HTTPException(status_code=404, detail="Aircraft not found")
    
    if aircraft["operator_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    await db.aircraft_catalog.update_one(
        {"id": aircraft_id},
        {
            "$set": {
                "availability_status": status,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    return {"success": True, "status": status}


# ============ CUSTOMER ENDPOINTS ============

@router.get("/public/search")
async def search_aircraft(
    aircraft_type: Optional[str] = None,
    min_seats: Optional[int] = None,
    max_price: Optional[float] = None,
    features: Optional[str] = None,  # Comma-separated: wifi,lavatory,pet_friendly
    limit: int = Query(default=20, le=50)
):
    """
    Public search for verified aircraft
    """
    db = get_database()
    
    query = {
        "is_published": True,
        "verification.status": {"$in": ["verified", "premium_verified"]},
        "availability_status": {"$in": ["available", "reserved"]}
    }
    
    if aircraft_type:
        query["basic_info.aircraft_type"] = aircraft_type
    
    if min_seats:
        query["features.total_seats"] = {"$gte": min_seats}
    
    if max_price:
        query["pricing.hourly_price"] = {"$lte": max_price}
    
    if features:
        feature_list = features.split(",")
        for feature in feature_list:
            query[f"features.{feature.strip()}"] = True
    
    aircraft_list = await db.aircraft_catalog.find(
        query,
        {
            "_id": 0,
            "documents": 0,  # Don't expose document URLs
            "crew.licence_number": 0,  # Privacy
            "crew.medical_validity": 0
        }
    ).sort("verification.status", 1).to_list(limit)
    
    # Add verification badges
    for aircraft in aircraft_list:
        aircraft["verification_badge"] = get_verification_badge(
            aircraft.get("verification", {}).get("status", "pending")
        )
    
    return {
        "aircraft": aircraft_list,
        "count": len(aircraft_list)
    }


@router.get("/public/{aircraft_id}")
async def get_public_aircraft(aircraft_id: str):
    """
    Get public aircraft details (for customers)
    """
    db = get_database()
    
    aircraft = await db.aircraft_catalog.find_one(
        {
            "id": aircraft_id,
            "is_published": True,
            "verification.status": {"$in": ["verified", "premium_verified"]}
        },
        {
            "_id": 0,
            "documents": 0,
            "crew.licence_number": 0,
            "crew.medical_validity": 0
        }
    )
    
    if not aircraft:
        raise HTTPException(status_code=404, detail="Aircraft not found or not verified")
    
    aircraft["verification_badge"] = get_verification_badge(
        aircraft.get("verification", {}).get("status", "pending")
    )
    
    return aircraft


# ============ ADMIN ENDPOINTS ============

@router.get("/admin/verification-queue")
async def get_verification_queue(
    status: Optional[str] = None,
    limit: int = Query(default=50, le=100),
    current_user: dict = Depends(require_roles(["admin"]))
):
    """
    Admin: Get aircraft pending verification
    """
    db = get_database()
    
    query = {}
    if status:
        query["verification.status"] = status
    else:
        query["verification.status"] = {"$in": ["pending", "under_review"]}
    
    aircraft_list = await db.aircraft_catalog.find(
        query,
        {"_id": 0}
    ).sort("created_at", 1).to_list(limit)
    
    # Add operator info
    for aircraft in aircraft_list:
        operator = await db.users.find_one(
            {"id": aircraft["operator_id"]},
            {"_id": 0, "company_name": 1, "email": 1, "name": 1}
        )
        aircraft["operator_info"] = operator
        aircraft["verification_badge"] = get_verification_badge(
            aircraft.get("verification", {}).get("status", "pending")
        )
    
    return {
        "queue": aircraft_list,
        "count": len(aircraft_list)
    }


@router.put("/admin/{aircraft_id}/verify")
async def admin_verify_aircraft(
    aircraft_id: str,
    request: UpdateVerificationRequest,
    current_user: dict = Depends(require_roles(["admin"]))
):
    """
    Admin: Update aircraft verification status
    """
    db = get_database()
    
    aircraft = await db.aircraft_catalog.find_one({"id": aircraft_id})
    if not aircraft:
        raise HTTPException(status_code=404, detail="Aircraft not found")
    
    if request.verification_status not in VERIFICATION_STATUS:
        raise HTTPException(status_code=400, detail="Invalid verification status")
    
    now = datetime.now(timezone.utc).isoformat()
    
    update_data = {
        "verification.status": request.verification_status,
        "verification.documents_verified": request.documents_verified,
        "verification.photos_verified": request.photos_verified,
        "verification.pricing_verified": request.pricing_verified,
        "verification.last_reviewed_at": now,
        "verification.reviewed_by": current_user["id"],
        "verification.notes": request.verification_notes,
        "updated_at": now
    }
    
    # Auto-publish if verified and requested
    if request.publish and request.verification_status in ["verified", "premium_verified"]:
        update_data["is_published"] = True
        update_data["published_at"] = now
    
    # Auto-unpublish if suspended
    if request.verification_status == "suspended":
        update_data["is_published"] = False
    
    await db.aircraft_catalog.update_one(
        {"id": aircraft_id},
        {"$set": update_data}
    )
    
    # Log verification action
    await db.verification_logs.insert_one({
        "id": str(uuid.uuid4()),
        "aircraft_id": aircraft_id,
        "action": f"verification_{request.verification_status}",
        "performed_by": current_user["id"],
        "notes": request.verification_notes,
        "timestamp": now
    })
    
    return {
        "success": True,
        "message": f"Aircraft verification updated to: {request.verification_status}",
        "is_published": update_data.get("is_published", aircraft.get("is_published"))
    }


@router.get("/admin/stats")
async def get_aircraft_stats(
    current_user: dict = Depends(require_roles(["admin", "ceo"]))
):
    """
    Admin/CEO: Get aircraft catalog statistics
    """
    db = get_database()
    
    # Count by verification status
    total = await db.aircraft_catalog.count_documents({})
    verified = await db.aircraft_catalog.count_documents({"verification.status": "verified"})
    premium = await db.aircraft_catalog.count_documents({"verification.status": "premium_verified"})
    pending = await db.aircraft_catalog.count_documents({"verification.status": "pending"})
    under_review = await db.aircraft_catalog.count_documents({"verification.status": "under_review"})
    suspended = await db.aircraft_catalog.count_documents({"verification.status": "suspended"})
    published = await db.aircraft_catalog.count_documents({"is_published": True})
    
    # Expiring documents
    today = datetime.now().strftime("%Y-%m-%d")
    thirty_days = (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d")
    
    insurance_expiring = await db.aircraft_catalog.count_documents({
        "documents.insurance_expiry": {"$lte": thirty_days, "$gte": today}
    })
    
    maintenance_due = await db.aircraft_catalog.count_documents({
        "documents.next_maintenance_due": {"$lte": thirty_days, "$gte": today}
    })
    
    # By aircraft type
    type_pipeline = [
        {"$group": {"_id": "$basic_info.aircraft_type", "count": {"$sum": 1}}}
    ]
    by_type = await db.aircraft_catalog.aggregate(type_pipeline).to_list(10)
    
    return {
        "total": total,
        "by_status": {
            "verified": verified,
            "premium_verified": premium,
            "pending": pending,
            "under_review": under_review,
            "suspended": suspended
        },
        "published": published,
        "expiring_soon": {
            "insurance": insurance_expiring,
            "maintenance": maintenance_due
        },
        "by_type": {item["_id"]: item["count"] for item in by_type if item["_id"]}
    }


@router.get("/admin/expiring-documents")
async def get_expiring_documents(
    days: int = Query(default=30, le=90),
    current_user: dict = Depends(require_roles(["admin"]))
):
    """
    Admin: Get aircraft with expiring documents
    """
    db = get_database()
    
    cutoff_date = (datetime.now() + timedelta(days=days)).strftime("%Y-%m-%d")
    today = datetime.now().strftime("%Y-%m-%d")
    
    # Insurance expiring
    insurance_expiring = await db.aircraft_catalog.find(
        {"documents.insurance_expiry": {"$lte": cutoff_date, "$gte": today}},
        {"_id": 0, "id": 1, "basic_info": 1, "operator_id": 1, "documents.insurance_expiry": 1}
    ).to_list(100)
    
    # Maintenance due
    maintenance_due = await db.aircraft_catalog.find(
        {"documents.next_maintenance_due": {"$lte": cutoff_date, "$gte": today}},
        {"_id": 0, "id": 1, "basic_info": 1, "operator_id": 1, "documents.next_maintenance_due": 1}
    ).to_list(100)
    
    # Add expiry status
    for item in insurance_expiring:
        item["expiry_status"] = calculate_expiry_status(item.get("documents", {}).get("insurance_expiry"))
        item["document_type"] = "insurance"
    
    for item in maintenance_due:
        item["expiry_status"] = calculate_expiry_status(item.get("documents", {}).get("next_maintenance_due"))
        item["document_type"] = "maintenance"
    
    return {
        "insurance_expiring": insurance_expiring,
        "maintenance_due": maintenance_due,
        "total_alerts": len(insurance_expiring) + len(maintenance_due)
    }
