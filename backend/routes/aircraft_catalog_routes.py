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
    aircraft_type: str  # helicopter, light_jet, mid_jet, heavy_jet, turboprop
    manufacturer: str  # Bell, Airbus, Cessna, etc.
    model: str  # 407, H145, Citation XLS
    year_of_manufacture: int
    registration_number: str  # VT-XXX
    serial_number: Optional[str] = None
    
    # NEW: Technical Specifications / तकनीकी विवरण
    engine_type: Optional[str] = None  # turbine, piston, twin_turbine
    engine_model: Optional[str] = None  # PT6A, Rolls-Royce etc.
    cruise_speed_kmh: Optional[int] = None  # Cruise speed in km/h
    max_range_km: Optional[int] = None  # Maximum range in km
    max_altitude_ft: Optional[int] = None  # Service ceiling in feet
    fuel_capacity_liters: Optional[int] = None  # Fuel tank capacity


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
    role: str  # pilot, co_pilot, cabin_crew, flight_engineer
    name: str
    licence_number: Optional[str] = None
    licence_type: Optional[str] = None  # ATPL, CPL, PPL
    experience_hours: Optional[int] = None
    medical_validity: Optional[str] = None  # YYYY-MM-DD
    type_rating: Optional[str] = None  # Aircraft type rated for
    languages: Optional[List[str]] = None  # Spoken languages
    status: str = "active"  # active, inactive, expired


class CrewConfiguration(BaseModel):
    """Aircraft Crew Configuration / क्रू विन्यास"""
    pilot_count: int = 1  # Number of pilots required
    copilot_required: bool = False  # Whether co-pilot is mandatory
    cabin_crew_count: int = 0  # Number of cabin crew
    flight_engineer_required: bool = False  # For complex aircraft
    min_pilot_experience_hours: Optional[int] = None  # Minimum PIC hours
    crew_rest_facility: bool = False  # For long-range flights


class AircraftPricing(BaseModel):
    """Section D - Commercial Details / व्यावसायिक विवरण"""
    # Base Pricing
    one_way_price: Optional[float] = None
    return_price: Optional[float] = None  # Round trip discount
    hourly_price: Optional[float] = None
    daily_price: Optional[float] = None
    multi_day_price_per_day: Optional[float] = None  # Discounted for 3+ days
    
    # Additional Charges
    night_halt_charges: Optional[float] = None
    waiting_charges_per_hour: Optional[float] = None
    landing_charges: Optional[float] = None
    helipad_charges: Optional[float] = None
    crew_charges: Optional[float] = None
    
    # NEW: Booking Type Specific Pricing / बुकिंग प्रकार
    multi_city_per_leg_discount: Optional[float] = None  # % discount per leg
    group_booking_discount: Optional[float] = None  # For 5+ pax
    emergency_surcharge_percent: Optional[float] = None  # Urgent bookings
    event_package_price: Optional[float] = None  # Wedding/Corporate events
    
    # Fuel
    fuel_included: bool = True
    fuel_surcharge_percent: Optional[float] = None  # If fuel prices spike
    
    # Taxes
    currency: str = "INR"
    gst_included: bool = False  # Is GST included in prices?
    
    # Minimum Booking
    minimum_booking_hours: Optional[float] = None  # e.g., 2 hours min
    minimum_booking_amount: Optional[float] = None  # e.g., ₹50,000 min


class AircraftFeatures(BaseModel):
    """Section E - Aircraft Features & Amenities / सुविधाएं"""
    total_seats: int = 4
    vip_seats: int = 0
    cabin_size: Optional[str] = None  # small, medium, large
    cabin_height_cm: Optional[int] = None  # Interior cabin height
    cabin_width_cm: Optional[int] = None  # Interior cabin width
    
    # Climate & Comfort
    air_conditioning: bool = True
    heating: bool = True
    pressurized_cabin: bool = False  # For jets
    noise_cancelling: bool = False
    
    # Connectivity & Entertainment
    wifi: bool = False
    wifi_type: Optional[str] = None  # satellite, air-to-ground
    entertainment_system: bool = False
    individual_screens: bool = False
    charging_ports: bool = True
    usb_ports: bool = True
    power_outlets: bool = False  # 220V outlets
    
    # Food & Beverages / भोजन
    refreshments: bool = False
    hot_beverages: bool = False  # Tea/Coffee
    cold_beverages: bool = False
    snacks: bool = False
    meals_available: bool = False  # Full meal service
    catering_partner: Optional[str] = None  # Catering company name
    vegetarian_options: bool = True
    special_diet_options: bool = False  # Jain, Halal, Vegan
    
    # Facilities
    lavatory: bool = False
    lavatory_type: Optional[str] = None  # enclosed, curtain, none
    baggage_capacity_kg: Optional[int] = None
    baggage_compartment: Optional[str] = None  # internal, external, both
    
    # Accessibility
    pet_friendly: bool = False
    pet_cabin_allowed: bool = False  # Pets in cabin vs cargo
    wheelchair_accessible: bool = False
    child_seat_compatible: bool = True
    
    # Luxury Features
    leather_seats: bool = False
    reclining_seats: bool = True
    conference_table: bool = False  # For business jets
    sleeping_arrangement: bool = False  # For long-range jets


class SafetyEquipment(BaseModel):
    """Section C - Safety Equipment / सुरक्षा उपकरण"""
    first_aid_kit: bool = True
    fire_extinguisher: bool = True
    elt: bool = True  # Emergency Locator Transmitter
    life_jackets: bool = False
    
    # NEW: Advanced Safety Systems / उन्नत सुरक्षा प्रणाली
    oxygen_kit: bool = False  # Required for flights >10,000 ft
    oxygen_kit_type: Optional[str] = None  # portable, fixed, diluter_demand
    tcas: bool = False  # Traffic Collision Avoidance System
    tcas_version: Optional[str] = None  # TCAS I, TCAS II, ACAS X
    terrain_awareness: bool = False  # TAWS/GPWS
    weather_radar: bool = False
    autopilot: bool = False
    
    # Single-engine specific
    parachute_system: bool = False  # Ballistic Recovery System (BRS)
    parachute_type: Optional[str] = None  # CAPS, BRS, Galaxy GRS
    
    # Air Ambulance / Medical
    medical_equipment: bool = False
    defibrillator: bool = False
    stretcher_compatible: bool = False


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
    # Crew Configuration / क्रू विन्यास
    crew_configuration: Optional[CrewConfiguration] = None
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

# Booking Types / बुकिंग प्रकार
BOOKING_TYPES = {
    "one_way": {
        "label": "One Way / एकतरफा",
        "description": "Single journey from A to B",
        "icon": "arrow_right"
    },
    "round_trip": {
        "label": "Round Trip / वापसी यात्रा",
        "description": "Return journey A to B to A",
        "discount_hint": "Save 5-10% on round trips",
        "icon": "refresh"
    },
    "multi_city": {
        "label": "Multi-City / बहु-शहर",
        "description": "Multiple destinations in one trip",
        "discount_hint": "Per-leg discounts available",
        "icon": "route"
    },
    "hourly_charter": {
        "label": "Hourly Charter / प्रति घंटा",
        "description": "Book by the hour",
        "min_hours": 1,
        "icon": "clock"
    },
    "daily_charter": {
        "label": "Daily Charter / दैनिक",
        "description": "Full day aircraft at your disposal",
        "icon": "calendar_today"
    },
    "multi_day": {
        "label": "Multi-Day / बहु-दिवसीय",
        "description": "3+ days charter with discounts",
        "discount_hint": "10-15% off for 3+ days",
        "min_days": 3,
        "icon": "date_range"
    },
    "group_booking": {
        "label": "Group Booking / समूह बुकिंग",
        "description": "5+ passengers, special rates",
        "discount_hint": "Group discounts available",
        "min_passengers": 5,
        "icon": "groups"
    },
    "emergency": {
        "label": "Emergency / आपातकालीन",
        "description": "Urgent medical or time-critical",
        "surcharge_hint": "Priority booking surcharge may apply",
        "priority": True,
        "icon": "emergency"
    },
    "event_based": {
        "label": "Event Package / इवेंट पैकेज",
        "description": "Weddings, Corporate events, Film shoots",
        "custom_quote": True,
        "icon": "celebration"
    }
}

# Verification Status
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


def calculate_safety_score(safety_equipment: dict) -> dict:
    """Calculate aircraft safety score for comparison"""
    score = 0
    max_score = 100
    
    # Core safety (40 points)
    if safety_equipment.get("first_aid_kit"): score += 5
    if safety_equipment.get("fire_extinguisher"): score += 5
    if safety_equipment.get("elt"): score += 10
    if safety_equipment.get("life_jackets"): score += 10
    if safety_equipment.get("oxygen_kit"): score += 10
    
    # Advanced systems (40 points)
    if safety_equipment.get("tcas"): score += 15
    if safety_equipment.get("terrain_awareness"): score += 10
    if safety_equipment.get("weather_radar"): score += 10
    if safety_equipment.get("autopilot"): score += 5
    
    # Emergency systems (20 points)
    if safety_equipment.get("parachute_system"): score += 15
    if safety_equipment.get("defibrillator"): score += 5
    
    rating = "Excellent" if score >= 80 else "Good" if score >= 60 else "Standard" if score >= 40 else "Basic"
    
    return {
        "score": score,
        "max_score": max_score,
        "percentage": round((score / max_score) * 100),
        "rating": rating,
        "has_tcas": safety_equipment.get("tcas", False),
        "has_oxygen": safety_equipment.get("oxygen_kit", False),
        "has_parachute": safety_equipment.get("parachute_system", False)
    }


def calculate_amenity_score(features: dict) -> dict:
    """Calculate amenity/comfort score for comparison"""
    score = 0
    max_score = 100
    
    # Connectivity (25 points)
    if features.get("wifi"): score += 15
    if features.get("entertainment_system"): score += 5
    if features.get("charging_ports"): score += 3
    if features.get("power_outlets"): score += 2
    
    # Comfort (35 points)
    if features.get("air_conditioning"): score += 10
    if features.get("pressurized_cabin"): score += 10
    if features.get("leather_seats"): score += 5
    if features.get("reclining_seats"): score += 5
    if features.get("noise_cancelling"): score += 5
    
    # Food & Beverage (25 points)
    if features.get("meals_available"): score += 15
    if features.get("hot_beverages"): score += 5
    if features.get("refreshments"): score += 5
    
    # Facilities (15 points)
    if features.get("lavatory"): score += 10
    if features.get("conference_table"): score += 5
    
    rating = "Luxury" if score >= 80 else "Premium" if score >= 60 else "Comfortable" if score >= 40 else "Basic"
    
    return {
        "score": score,
        "max_score": max_score,
        "percentage": round((score / max_score) * 100),
        "rating": rating,
        "has_wifi": features.get("wifi", False),
        "has_meals": features.get("meals_available", False),
        "has_lavatory": features.get("lavatory", False)
    }


# ============ BOOKING TYPES ENDPOINT ============

@router.get("/booking-types")
async def get_booking_types():
    """
    Get all available booking types with details
    """
    return {
        "booking_types": BOOKING_TYPES,
        "count": len(BOOKING_TYPES)
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
            "oxygen_kit_type": None,
            "tcas": False,
            "tcas_version": None,
            "terrain_awareness": False,
            "weather_radar": False,
            "autopilot": False,
            "parachute_system": False,
            "parachute_type": None,
            "medical_equipment": False,
            "defibrillator": False,
            "stretcher_compatible": False
        },
        
        # Crew Configuration / क्रू विन्यास
        "crew_configuration": request.crew_configuration.dict() if request.crew_configuration else {
            "pilot_count": 1,
            "copilot_required": False,
            "cabin_crew_count": 0,
            "flight_engineer_required": False,
            "min_pilot_experience_hours": None,
            "crew_rest_facility": False
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
        
        # Crew Members (initially empty)
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
        "version": "2.0"
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


# ============ SOFT DELETE / ARCHIVE ENDPOINTS ============

@router.delete("/{aircraft_id}")
async def soft_delete_aircraft(
    aircraft_id: str,
    current_user: dict = Depends(require_roles(["operator", "admin"]))
):
    """
    Soft delete (archive) an aircraft - does NOT permanently delete.
    Aircraft can be restored later. All bookings and history preserved.
    """
    db = get_database()
    
    aircraft = await db.aircraft_catalog.find_one({"id": aircraft_id})
    if not aircraft:
        raise HTTPException(status_code=404, detail="Aircraft not found")
    
    # Check ownership (unless admin)
    is_admin = "admin" in current_user.get("roles", [])
    if not is_admin and aircraft["operator_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="You can only archive your own aircraft")
    
    # Check if already archived
    if aircraft.get("is_archived", False):
        raise HTTPException(status_code=400, detail="Aircraft is already archived")
    
    now = datetime.now(timezone.utc).isoformat()
    
    # Soft delete - set archived flag
    await db.aircraft_catalog.update_one(
        {"id": aircraft_id},
        {
            "$set": {
                "is_archived": True,
                "archived_at": now,
                "archived_by": current_user["id"],
                "is_published": False,  # Unpublish when archived
                "availability_status": "archived",
                "updated_at": now
            }
        }
    )
    
    return {
        "success": True,
        "message": "Aircraft archived successfully. You can restore it anytime from the archive.",
        "message_hi": "विमान संग्रहीत हो गया। आप इसे कभी भी पुनर्स्थापित कर सकते हैं।",
        "aircraft_id": aircraft_id
    }


@router.post("/{aircraft_id}/restore")
async def restore_aircraft(
    aircraft_id: str,
    current_user: dict = Depends(require_roles(["operator", "admin"]))
):
    """
    Restore a soft-deleted (archived) aircraft
    """
    db = get_database()
    
    aircraft = await db.aircraft_catalog.find_one({"id": aircraft_id})
    if not aircraft:
        raise HTTPException(status_code=404, detail="Aircraft not found")
    
    # Check ownership (unless admin)
    is_admin = "admin" in current_user.get("roles", [])
    if not is_admin and aircraft["operator_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="You can only restore your own aircraft")
    
    # Check if actually archived
    if not aircraft.get("is_archived", False):
        raise HTTPException(status_code=400, detail="Aircraft is not archived")
    
    now = datetime.now(timezone.utc).isoformat()
    
    # Restore aircraft
    await db.aircraft_catalog.update_one(
        {"id": aircraft_id},
        {
            "$set": {
                "is_archived": False,
                "restored_at": now,
                "restored_by": current_user["id"],
                "availability_status": "available",
                "updated_at": now
            },
            "$unset": {
                "archived_at": "",
                "archived_by": ""
            }
        }
    )
    
    return {
        "success": True,
        "message": "Aircraft restored successfully!",
        "message_hi": "विमान सफलतापूर्वक पुनर्स्थापित हो गया!",
        "aircraft_id": aircraft_id
    }


@router.get("/archived")
async def get_archived_aircraft(
    current_user: dict = Depends(require_roles(["operator", "admin"]))
):
    """
    Get list of archived aircraft for the current operator
    """
    db = get_database()
    
    is_admin = "admin" in current_user.get("roles", [])
    
    query = {"is_archived": True}
    if not is_admin:
        query["operator_id"] = current_user["id"]
    
    aircraft_list = await db.aircraft_catalog.find(
        query,
        {"_id": 0}
    ).sort("archived_at", -1).to_list(100)
    
    return {
        "archived_aircraft": aircraft_list,
        "count": len(aircraft_list)
    }


@router.delete("/{aircraft_id}/permanent")
async def permanently_delete_aircraft(
    aircraft_id: str,
    confirm: bool = Query(default=False, description="Must be True to permanently delete"),
    current_user: dict = Depends(require_roles(["admin"]))
):
    """
    PERMANENTLY delete an aircraft (Admin only).
    WARNING: This cannot be undone!
    """
    db = get_database()
    
    if not confirm:
        raise HTTPException(
            status_code=400, 
            detail="Must set confirm=true to permanently delete. This cannot be undone!"
        )
    
    aircraft = await db.aircraft_catalog.find_one({"id": aircraft_id})
    if not aircraft:
        raise HTTPException(status_code=404, detail="Aircraft not found")
    
    # Check if archived first (must archive before permanent delete)
    if not aircraft.get("is_archived", False):
        raise HTTPException(
            status_code=400, 
            detail="Aircraft must be archived first before permanent deletion"
        )
    
    # Permanently delete
    await db.aircraft_catalog.delete_one({"id": aircraft_id})
    
    # Log the permanent deletion
    await db.audit_logs.insert_one({
        "action": "aircraft_permanent_delete",
        "user_id": current_user["id"],
        "resource_type": "aircraft",
        "resource_id": aircraft_id,
        "details": {
            "registration": aircraft.get("basic_info", {}).get("registration_number"),
            "operator_id": aircraft.get("operator_id")
        },
        "timestamp": datetime.now(timezone.utc).isoformat()
    })
    
    return {
        "success": True,
        "message": "Aircraft permanently deleted",
        "warning": "This action cannot be undone"
    }


# ============ CUSTOMER ENDPOINTS ============

@router.get("/public/featured")
async def get_featured_aircraft(
    limit: int = Query(default=6, le=12)
):
    """
    Get featured verified aircraft for homepage/search
    """
    db = get_database()
    
    aircraft_list = await db.aircraft_catalog.find(
        {
            "is_published": True,
            "verification.status": {"$in": ["verified", "premium_verified"]},
            "availability_status": "available"
        },
        {
            "_id": 0,
            "documents": 0,
            "operator_email": 0,  # Hide PII from public endpoint
            "operator_id": 0,     # Hide operator ID from public
            "crew.licence_number": 0,
            "crew.medical_validity": 0
        }
    ).sort([("verification.status", 1), ("created_at", -1)]).to_list(limit)
    
    # Enrich with scores and badges
    for aircraft in aircraft_list:
        aircraft["verification_badge"] = get_verification_badge(
            aircraft.get("verification", {}).get("status", "pending")
        )
        aircraft["safety_score"] = calculate_safety_score(aircraft.get("safety_equipment", {}))
        aircraft["amenity_score"] = calculate_amenity_score(aircraft.get("features", {}))
    
    return {
        "aircraft": aircraft_list,
        "count": len(aircraft_list)
    }


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
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    thirty_days = (datetime.now(timezone.utc) + timedelta(days=30)).strftime("%Y-%m-%d")
    
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
    
    cutoff_date = (datetime.now(timezone.utc) + timedelta(days=days)).strftime("%Y-%m-%d")
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
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



# ============ AI SMART COMPARISON ENDPOINTS ============

@router.post("/compare")
async def compare_aircraft(
    aircraft_ids: List[str],
    current_user: dict = Depends(get_current_user)
):
    """
    AI Smart Comparison - Compare multiple aircraft side-by-side
    Used by customers to make informed decisions
    """
    db = get_database()
    
    if len(aircraft_ids) < 2:
        raise HTTPException(status_code=400, detail="Need at least 2 aircraft to compare")
    
    if len(aircraft_ids) > 4:
        raise HTTPException(status_code=400, detail="Maximum 4 aircraft can be compared at once")
    
    # Fetch all aircraft
    aircraft_list = await db.aircraft_catalog.find(
        {
            "id": {"$in": aircraft_ids},
            "$or": [
                {"is_published": True},
                {"operator_id": current_user["id"]}  # Operator can compare own
            ]
        },
        {"_id": 0}
    ).to_list(4)
    
    if len(aircraft_list) < 2:
        raise HTTPException(status_code=404, detail="Not enough aircraft found for comparison")
    
    comparison_data = []
    
    for aircraft in aircraft_list:
        basic = aircraft.get("basic_info", {})
        features = aircraft.get("features", {})
        pricing = aircraft.get("pricing", {})
        safety = aircraft.get("safety_equipment", {})
        crew_config = aircraft.get("crew_configuration", {})
        verification = aircraft.get("verification", {})
        
        # Calculate scores
        safety_score = calculate_safety_score(safety)
        amenity_score = calculate_amenity_score(features)
        
        comparison_data.append({
            "id": aircraft["id"],
            "name": f"{basic.get('manufacturer', '')} {basic.get('model', '')}",
            "registration": basic.get("registration_number"),
            "type": AIRCRAFT_TYPES.get(basic.get("aircraft_type"), basic.get("aircraft_type")),
            "year": basic.get("year_of_manufacture"),
            "photo": aircraft.get("photos", {}).get("front"),
            
            # Technical Specs
            "specs": {
                "engine_type": basic.get("engine_type", "N/A"),
                "cruise_speed": f"{basic.get('cruise_speed_kmh', 'N/A')} km/h" if basic.get('cruise_speed_kmh') else "N/A",
                "range": f"{basic.get('max_range_km', 'N/A')} km" if basic.get('max_range_km') else "N/A",
                "max_altitude": f"{basic.get('max_altitude_ft', 'N/A'):,} ft" if basic.get('max_altitude_ft') else "N/A"
            },
            
            # Capacity
            "capacity": {
                "total_seats": features.get("total_seats", 0),
                "vip_seats": features.get("vip_seats", 0),
                "baggage_kg": features.get("baggage_capacity_kg", "N/A"),
                "cabin_size": features.get("cabin_size", "N/A")
            },
            
            # Crew
            "crew": {
                "pilots": crew_config.get("pilot_count", 1),
                "copilot_required": crew_config.get("copilot_required", False),
                "cabin_crew": crew_config.get("cabin_crew_count", 0)
            },
            
            # Safety Score
            "safety": {
                "score": safety_score["percentage"],
                "rating": safety_score["rating"],
                "tcas": safety_score["has_tcas"],
                "oxygen_kit": safety_score["has_oxygen"],
                "parachute": safety_score["has_parachute"]
            },
            
            # Amenities Score
            "amenities": {
                "score": amenity_score["percentage"],
                "rating": amenity_score["rating"],
                "wifi": amenity_score["has_wifi"],
                "meals": amenity_score["has_meals"],
                "lavatory": amenity_score["has_lavatory"]
            },
            
            # Key Features (Quick glance)
            "key_features": {
                "wifi": features.get("wifi", False),
                "ac": features.get("air_conditioning", False),
                "entertainment": features.get("entertainment_system", False),
                "meals": features.get("meals_available", False),
                "lavatory": features.get("lavatory", False),
                "pet_friendly": features.get("pet_friendly", False),
                "wheelchair": features.get("wheelchair_accessible", False),
                "leather_seats": features.get("leather_seats", False),
                "charging": features.get("charging_ports", False)
            },
            
            # Pricing (HIDE commission from customer view)
            "pricing": {
                "hourly": pricing.get("hourly_price"),
                "one_way": pricing.get("one_way_price"),
                "daily": pricing.get("daily_price"),
                "currency": pricing.get("currency", "INR"),
                "formatted_hourly": f"₹{pricing.get('hourly_price', 0):,.0f}/hr" if pricing.get('hourly_price') else "Quote",
                "formatted_daily": f"₹{pricing.get('daily_price', 0):,.0f}/day" if pricing.get('daily_price') else "Quote"
            },
            
            # Verification Status
            "verification": {
                "status": verification.get("status", "pending"),
                "is_verified": verification.get("status") in ["verified", "premium_verified"],
                "badge": get_verification_badge(verification.get("status", "pending"))
            },
            
            # Availability
            "availability": aircraft.get("availability_status", "unknown")
        })
    
    # Find best in each category
    best_safety = max(comparison_data, key=lambda x: x["safety"]["score"])
    best_amenities = max(comparison_data, key=lambda x: x["amenities"]["score"])
    best_value = min(comparison_data, key=lambda x: x["pricing"]["hourly"] or float('inf'))
    
    return {
        "comparison": comparison_data,
        "count": len(comparison_data),
        "highlights": {
            "best_safety": {
                "id": best_safety["id"],
                "name": best_safety["name"],
                "score": best_safety["safety"]["score"]
            },
            "best_amenities": {
                "id": best_amenities["id"],
                "name": best_amenities["name"],
                "score": best_amenities["amenities"]["score"]
            },
            "best_value": {
                "id": best_value["id"],
                "name": best_value["name"],
                "price": best_value["pricing"]["formatted_hourly"]
            }
        },
        "comparison_categories": [
            {"key": "specs", "label": "Technical Specifications / तकनीकी विवरण"},
            {"key": "capacity", "label": "Capacity / क्षमता"},
            {"key": "crew", "label": "Crew / क्रू"},
            {"key": "safety", "label": "Safety / सुरक्षा"},
            {"key": "amenities", "label": "Amenities / सुविधाएं"},
            {"key": "pricing", "label": "Pricing / मूल्य"}
        ]
    }
