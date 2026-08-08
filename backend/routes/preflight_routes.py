"""
Pre-flight Checklist Routes
Interactive checklist for passengers and aircraft readiness
"""
from fastapi import APIRouter, HTTPException, Depends, Body
from typing import List, Optional
from datetime import datetime, timezone
from uuid import uuid4
from database import get_database
from pydantic import BaseModel
from routes.auth_routes import get_current_user

router = APIRouter(prefix="/preflight", tags=["Pre-flight Checklist"])

STAFF_ROLES = {"admin", "super_admin", "operator", "pilot", "ceo"}


def _is_staff(user: dict) -> bool:
    return bool(set(user.get("roles", [])).intersection(STAFF_ROLES))


def _booking_owner_id(booking: dict):
    return booking.get("customer_id") or booking.get("user_id")


def _check_read_access(booking: dict, user: dict):
    if _booking_owner_id(booking) == user.get("id") or _is_staff(user):
        return
    raise HTTPException(status_code=403, detail="Not authorized for this booking")



class ChecklistItemUpdate(BaseModel):
    item_id: str
    checked: bool
    notes: Optional[str] = None


class ChecklistSubmission(BaseModel):
    booking_id: str
    checklist_type: str  # "passenger" or "aircraft"
    items: List[ChecklistItemUpdate]


# Default checklist templates
PASSENGER_CHECKLIST = [
    {"id": "p1", "category": "Identity", "item": "Valid Government ID (Aadhaar/Passport/DL)", "required": True, "description": "Original document required for verification"},
    {"id": "p2", "category": "Identity", "item": "Booking Confirmation", "required": True, "description": "Email/SMS confirmation or booking number"},
    {"id": "p3", "category": "Baggage", "item": "Cabin Baggage Verified", "required": True, "description": "Within weight limit (7kg for helicopter, 15kg for jet)"},
    {"id": "p4", "category": "Baggage", "item": "Check-in Baggage Tagged", "required": False, "description": "Luggage tagged and weighed"},
    {"id": "p5", "category": "Baggage", "item": "No Prohibited Items", "required": True, "description": "No weapons, explosives, flammables, or restricted items"},
    {"id": "p6", "category": "Health", "item": "Health Declaration Signed", "required": True, "description": "Confirm no COVID symptoms, fit to fly"},
    {"id": "p7", "category": "Health", "item": "Medical Clearance (if applicable)", "required": False, "description": "For pregnant, elderly, or medical condition passengers"},
    {"id": "p8", "category": "Safety", "item": "Safety Briefing Acknowledged", "required": True, "description": "Attended pre-flight safety briefing"},
    {"id": "p9", "category": "Safety", "item": "Emergency Procedures Understood", "required": True, "description": "Know emergency exit, life vest, oxygen mask"},
    {"id": "p10", "category": "Contact", "item": "Emergency Contact Provided", "required": True, "description": "Name and phone number of emergency contact"},
    {"id": "p11", "category": "Special", "item": "Special Assistance Arranged", "required": False, "description": "Wheelchair, medical equipment, child seat"},
    {"id": "p12", "category": "Special", "item": "Pet Travel Documents", "required": False, "description": "If traveling with pets - vaccination, carrier"}
]

AIRCRAFT_CHECKLIST = [
    {"id": "a1", "category": "Documentation", "item": "Aircraft Registration Valid", "required": True, "description": "DGCA registration certificate current"},
    {"id": "a2", "category": "Documentation", "item": "Airworthiness Certificate Valid", "required": True, "description": "Certificate of Airworthiness not expired"},
    {"id": "a3", "category": "Documentation", "item": "AOC (Air Operator Certificate)", "required": True, "description": "Operator's AOC verified and valid"},
    {"id": "a4", "category": "Documentation", "item": "Insurance Certificate Valid", "required": True, "description": "Third-party and passenger insurance active"},
    {"id": "a5", "category": "Crew", "item": "Pilot License Verified", "required": True, "description": "CPL/ATPL valid, medical current"},
    {"id": "a6", "category": "Crew", "item": "Pilot Rest Requirements Met", "required": True, "description": "DGCA duty time limits complied"},
    {"id": "a7", "category": "Crew", "item": "Co-Pilot/Crew Assigned", "required": False, "description": "For aircraft requiring co-pilot"},
    {"id": "a8", "category": "Technical", "item": "Pre-flight Inspection Complete", "required": True, "description": "Walk-around and systems check done"},
    {"id": "a9", "category": "Technical", "item": "Fuel Check Satisfactory", "required": True, "description": "Fuel quantity sufficient with reserve"},
    {"id": "a10", "category": "Technical", "item": "Oil & Fluid Levels OK", "required": True, "description": "Engine oil, hydraulic fluid checked"},
    {"id": "a11", "category": "Technical", "item": "Avionics & Instruments Working", "required": True, "description": "Navigation, communication systems tested"},
    {"id": "a12", "category": "Safety", "item": "Fire Extinguisher Accessible", "required": True, "description": "Fire extinguisher charged and accessible"},
    {"id": "a13", "category": "Safety", "item": "First Aid Kit Complete", "required": True, "description": "Medical supplies stocked and not expired"},
    {"id": "a14", "category": "Safety", "item": "Life Vests Available", "required": False, "description": "For over-water flights"},
    {"id": "a15", "category": "Weather", "item": "Weather Briefing Obtained", "required": True, "description": "MET report reviewed, conditions acceptable"},
    {"id": "a16", "category": "Weather", "item": "NOTAM Checked", "required": True, "description": "No airspace restrictions on route"},
    {"id": "a17", "category": "Clearance", "item": "ATC Clearance Obtained", "required": True, "description": "Departure clearance from ATC"},
    {"id": "a18", "category": "Clearance", "item": "Landing Permission Confirmed", "required": True, "description": "Destination helipad/airport confirmed"}
]


@router.get("/checklist/{booking_id}")
async def get_checklist(booking_id: str, checklist_type: str = "passenger",
                        current_user: dict = Depends(get_current_user)):
    """Get checklist for a booking"""
    db = get_database()
    
    # Check if booking exists
    booking = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not booking:
        booking = await db.inquiries.find_one({"id": booking_id}, {"_id": 0})
    
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    _check_read_access(booking, current_user)
    
    # Get existing checklist progress
    checklist_doc = await db.preflight_checklists.find_one(
        {"booking_id": booking_id, "type": checklist_type},
        {"_id": 0}
    )
    
    # Get template
    template = PASSENGER_CHECKLIST if checklist_type == "passenger" else AIRCRAFT_CHECKLIST
    
    # Merge with saved progress
    items = []
    saved_items = {item["item_id"]: item for item in (checklist_doc.get("items", []) if checklist_doc else [])}
    
    for item in template:
        merged = {**item}
        if item["id"] in saved_items:
            merged["checked"] = saved_items[item["id"]].get("checked", False)
            merged["checked_at"] = saved_items[item["id"]].get("checked_at")
            merged["checked_by"] = saved_items[item["id"]].get("checked_by")
            merged["notes"] = saved_items[item["id"]].get("notes")
        else:
            merged["checked"] = False
        items.append(merged)
    
    # Calculate progress
    total = len(items)
    required = len([i for i in items if i.get("required")])
    checked = len([i for i in items if i.get("checked")])
    required_checked = len([i for i in items if i.get("required") and i.get("checked")])
    
    return {
        "success": True,
        "booking_id": booking_id,
        "type": checklist_type,
        "items": items,
        "progress": {
            "total": total,
            "checked": checked,
            "required": required,
            "required_checked": required_checked,
            "percentage": round((checked / total) * 100) if total > 0 else 0,
            "required_complete": required_checked == required,
            "all_complete": checked == total
        },
        "status": "complete" if required_checked == required else "in_progress",
        "last_updated": checklist_doc.get("updated_at") if checklist_doc else None
    }


@router.post("/checklist/update")
async def update_checklist_item(
    booking_id: str = Body(...),
    checklist_type: str = Body(...),
    item_id: str = Body(...),
    checked: bool = Body(...),
    notes: str = Body(None),
    checked_by: str = Body(None),
    current_user: dict = Depends(get_current_user)
):
    """Update a single checklist item"""
    db = get_database()

    booking = await db.bookings.find_one({"id": booking_id}, {"_id": 0}) or \
              await db.inquiries.find_one({"id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if checklist_type == "aircraft":
        if not _is_staff(current_user):
            raise HTTPException(status_code=403, detail="Only operator/pilot/admin can update aircraft checklist")
    elif _booking_owner_id(booking) != current_user.get("id") and not _is_staff(current_user):
        raise HTTPException(status_code=403, detail="Only the booking owner can update the passenger checklist")
    checked_by = checked_by or current_user.get("email")
    
    now = datetime.now(timezone.utc)
    
    # Find or create checklist document
    checklist_doc = await db.preflight_checklists.find_one(
        {"booking_id": booking_id, "type": checklist_type}
    )
    
    if not checklist_doc:
        # Create new checklist
        checklist_doc = {
            "id": str(uuid4()),
            "booking_id": booking_id,
            "type": checklist_type,
            "items": [],
            "created_at": now,
            "updated_at": now
        }
        await db.preflight_checklists.insert_one(checklist_doc)
    
    # Update item
    item_update = {
        "item_id": item_id,
        "checked": checked,
        "checked_at": now.isoformat() if checked else None,
        "checked_by": checked_by,
        "notes": notes
    }
    
    # Remove old entry if exists
    await db.preflight_checklists.update_one(
        {"booking_id": booking_id, "type": checklist_type},
        {"$pull": {"items": {"item_id": item_id}}}
    )
    
    # Add updated entry
    await db.preflight_checklists.update_one(
        {"booking_id": booking_id, "type": checklist_type},
        {
            "$push": {"items": item_update},
            "$set": {"updated_at": now}
        }
    )
    
    return {
        "success": True,
        "message": f"Item {'checked' if checked else 'unchecked'}",
        "item_id": item_id
    }


@router.post("/checklist/submit")
async def submit_checklist(submission: ChecklistSubmission,
                           current_user: dict = Depends(get_current_user)):
    """Submit completed checklist"""
    db = get_database()

    booking = await db.bookings.find_one({"id": submission.booking_id}, {"_id": 0}) or \
              await db.inquiries.find_one({"id": submission.booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if submission.checklist_type == "aircraft":
        if not _is_staff(current_user):
            raise HTTPException(status_code=403, detail="Only operator/pilot/admin can submit aircraft checklist")
    elif _booking_owner_id(booking) != current_user.get("id") and not _is_staff(current_user):
        raise HTTPException(status_code=403, detail="Only the booking owner can submit the passenger checklist")
    
    now = datetime.now(timezone.utc)
    
    # Validate all required items are checked
    template = PASSENGER_CHECKLIST if submission.checklist_type == "passenger" else AIRCRAFT_CHECKLIST
    required_ids = {item["id"] for item in template if item.get("required")}
    checked_ids = {item.item_id for item in submission.items if item.checked}
    
    missing_required = required_ids - checked_ids
    if missing_required:
        raise HTTPException(
            status_code=400,
            detail=f"Missing required items: {', '.join(missing_required)}"
        )
    
    # Save all items
    items_to_save = [
        {
            "item_id": item.item_id,
            "checked": item.checked,
            "notes": item.notes,
            "checked_at": now.isoformat() if item.checked else None
        }
        for item in submission.items
    ]
    
    await db.preflight_checklists.update_one(
        {"booking_id": submission.booking_id, "type": submission.checklist_type},
        {
            "$set": {
                "items": items_to_save,
                "status": "submitted",
                "submitted_at": now,
                "updated_at": now
            }
        },
        upsert=True
    )
    
    # Update booking status
    update_field = f"{submission.checklist_type}_checklist_complete"
    await db.bookings.update_one(
        {"id": submission.booking_id},
        {"$set": {update_field: True, f"{update_field}_at": now}}
    )
    
    return {
        "success": True,
        "message": f"{submission.checklist_type.title()} checklist submitted successfully",
        "booking_id": submission.booking_id
    }


@router.get("/status/{booking_id}")
async def get_preflight_status(booking_id: str,
                               current_user: dict = Depends(get_current_user)):
    """Get overall pre-flight readiness status"""
    db = get_database()
    
    # Get booking
    booking = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not booking:
        booking = await db.inquiries.find_one({"id": booking_id}, {"_id": 0})
    
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    _check_read_access(booking, current_user)
    
    # Get both checklists
    passenger_checklist = await db.preflight_checklists.find_one(
        {"booking_id": booking_id, "type": "passenger"},
        {"_id": 0}
    )
    aircraft_checklist = await db.preflight_checklists.find_one(
        {"booking_id": booking_id, "type": "aircraft"},
        {"_id": 0}
    )
    
    # Calculate progress for each
    def calc_progress(checklist_doc, template):
        if not checklist_doc:
            return {"completed": 0, "required": len([t for t in template if t.get("required")]), "status": "not_started"}
        
        saved = {i["item_id"]: i for i in checklist_doc.get("items", [])}
        required = [t for t in template if t.get("required")]
        required_checked = len([r for r in required if saved.get(r["id"], {}).get("checked")])
        
        return {
            "completed": len([i for i in saved.values() if i.get("checked")]),
            "total": len(template),
            "required": len(required),
            "required_checked": required_checked,
            "status": "complete" if required_checked == len(required) else "in_progress"
        }
    
    passenger_progress = calc_progress(passenger_checklist, PASSENGER_CHECKLIST)
    aircraft_progress = calc_progress(aircraft_checklist, AIRCRAFT_CHECKLIST)
    
    # Overall readiness
    is_ready = (
        passenger_progress["status"] == "complete" and
        aircraft_progress["status"] == "complete"
    )
    
    return {
        "success": True,
        "booking_id": booking_id,
        "passenger_checklist": passenger_progress,
        "aircraft_checklist": aircraft_progress,
        "overall_ready": is_ready,
        "can_depart": is_ready,
        "booking": {
            "from": booking.get("from_location"),
            "to": booking.get("to_location"),
            "date": booking.get("travel_date") or booking.get("departure_date"),
            "status": booking.get("status")
        }
    }
