from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone, timedelta
from uuid import uuid4
import qrcode
import io
import base64
from database import get_database
from routes.auth_routes import get_current_user

router = APIRouter(prefix="/boarding-pass", tags=["Digital Boarding Pass"])

# Models
class BoardingPassRequest(BaseModel):
    booking_id: str

class BoardingPassUpdate(BaseModel):
    gate: Optional[str] = None
    seat: Optional[str] = None
    boarding_time: Optional[str] = None
    special_instructions: Optional[str] = None

# Helper Functions
def generate_qr_code(data: str) -> str:
    """Generate QR code and return as base64"""
    qr = qrcode.QRCode(version=1, box_size=10, border=5)
    qr.add_data(data)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    
    buffer = io.BytesIO()
    img.save(buffer, format='PNG')
    buffer.seek(0)
    
    return base64.b64encode(buffer.getvalue()).decode()

def generate_pass_number():
    """Generate unique boarding pass number"""
    return f"BP{datetime.now().strftime('%Y%m%d')}{str(uuid4())[:6].upper()}"

# API Endpoints
@router.post("/generate")
async def generate_boarding_pass(request: BoardingPassRequest, current_user: dict = Depends(get_current_user)):
    """Generate digital boarding pass for a booking"""
    db = get_database()
    
    # Get booking
    booking = await db.bookings.find_one({"id": request.booking_id})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    # Check if pass already exists
    existing = await db.boarding_passes.find_one({"booking_id": request.booking_id})
    if existing:
        existing.pop("_id", None)
        return {"message": "Boarding pass already exists", "boarding_pass": existing}
    
    # Generate pass data
    pass_number = generate_pass_number()
    
    # QR code contains pass verification data
    qr_data = {
        "pass_number": pass_number,
        "booking_id": request.booking_id,
        "passenger": booking.get("customer_name", ""),
        "flight_date": booking.get("journey_date", ""),
        "verification_code": str(uuid4())[:8].upper()
    }
    
    qr_code_base64 = generate_qr_code(str(qr_data))
    
    boarding_pass = {
        "id": str(uuid4()),
        "pass_number": pass_number,
        "booking_id": request.booking_id,
        "user_id": current_user["id"],
        "passenger_name": booking.get("customer_name", ""),
        "passenger_phone": booking.get("customer_phone", ""),
        "origin": booking.get("origin", ""),
        "destination": booking.get("destination", ""),
        "flight_date": booking.get("journey_date", ""),
        "flight_time": booking.get("journey_time", ""),
        "aircraft_type": booking.get("aircraft_type", "Helicopter"),
        "aircraft_registration": booking.get("aircraft_registration", ""),
        "operator_name": booking.get("operator_name", ""),
        "seat": "1A",  # Default seat
        "gate": "H1",  # Default gate
        "boarding_time": None,
        "qr_code": qr_code_base64,
        "verification_code": qr_data["verification_code"],
        "status": "active",
        "special_instructions": None,
        "checked_in": False,
        "checked_in_at": None,
        "boarded": False,
        "boarded_at": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.boarding_passes.insert_one(boarding_pass)
    boarding_pass.pop("_id", None)
    
    return {"message": "Boarding pass generated", "boarding_pass": boarding_pass}

@router.get("/my-passes")
async def get_my_boarding_passes(current_user: dict = Depends(get_current_user)):
    """Get all boarding passes for current user"""
    db = get_database()
    
    passes = await db.boarding_passes.find(
        {"user_id": current_user["id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    
    return {"boarding_passes": passes}

@router.get("/{pass_id}")
async def get_boarding_pass(pass_id: str, current_user: dict = Depends(get_current_user)):
    """Get specific boarding pass"""
    db = get_database()
    
    boarding_pass = await db.boarding_passes.find_one(
        {"id": pass_id},
        {"_id": 0}
    )
    
    if not boarding_pass:
        raise HTTPException(status_code=404, detail="Boarding pass not found")
    
    # Check access
    is_admin = "admin" in current_user.get("roles", [])
    is_owner = boarding_pass["user_id"] == current_user["id"]
    
    if not (is_admin or is_owner):
        raise HTTPException(status_code=403, detail="Access denied")
    
    return boarding_pass

@router.get("/booking/{booking_id}")
async def get_pass_by_booking(booking_id: str, current_user: dict = Depends(get_current_user)):
    """Get boarding pass by booking ID"""
    db = get_database()
    
    boarding_pass = await db.boarding_passes.find_one(
        {"booking_id": booking_id},
        {"_id": 0}
    )
    
    if not boarding_pass:
        raise HTTPException(status_code=404, detail="No boarding pass for this booking")
    
    return boarding_pass

@router.post("/check-in/{pass_id}")
async def check_in(pass_id: str, current_user: dict = Depends(get_current_user)):
    """Online check-in for boarding pass"""
    db = get_database()
    
    boarding_pass = await db.boarding_passes.find_one({"id": pass_id})
    if not boarding_pass:
        raise HTTPException(status_code=404, detail="Boarding pass not found")
    
    if boarding_pass["checked_in"]:
        return {"message": "Already checked in", "checked_in_at": boarding_pass["checked_in_at"]}
    
    await db.boarding_passes.update_one(
        {"id": pass_id},
        {
            "$set": {
                "checked_in": True,
                "checked_in_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    return {"message": "Check-in successful", "checked_in_at": datetime.now(timezone.utc).isoformat()}

@router.post("/verify/{verification_code}")
async def verify_boarding_pass(verification_code: str, current_user: dict = Depends(get_current_user)):
    """Verify boarding pass by code (for gate staff)"""
    if "admin" not in current_user.get("roles", []) and "operator" not in current_user.get("roles", []):
        raise HTTPException(status_code=403, detail="Staff access required")
    
    db = get_database()
    
    boarding_pass = await db.boarding_passes.find_one(
        {"verification_code": verification_code},
        {"_id": 0}
    )
    
    if not boarding_pass:
        return {"valid": False, "message": "Invalid verification code"}
    
    if boarding_pass["status"] != "active":
        return {"valid": False, "message": f"Pass is {boarding_pass['status']}"}
    
    return {
        "valid": True,
        "boarding_pass": boarding_pass
    }

@router.post("/board/{pass_id}")
async def mark_boarded(pass_id: str, current_user: dict = Depends(get_current_user)):
    """Mark passenger as boarded (staff only)"""
    if "admin" not in current_user.get("roles", []) and "operator" not in current_user.get("roles", []):
        raise HTTPException(status_code=403, detail="Staff access required")
    
    db = get_database()
    
    await db.boarding_passes.update_one(
        {"id": pass_id},
        {
            "$set": {
                "boarded": True,
                "boarded_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    return {"message": "Passenger marked as boarded"}

@router.put("/{pass_id}")
async def update_boarding_pass(pass_id: str, update: BoardingPassUpdate, current_user: dict = Depends(get_current_user)):
    """Update boarding pass details (staff only)"""
    if "admin" not in current_user.get("roles", []) and "operator" not in current_user.get("roles", []):
        raise HTTPException(status_code=403, detail="Staff access required")
    
    db = get_database()
    
    update_data = {k: v for k, v in update.dict().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.boarding_passes.update_one(
        {"id": pass_id},
        {"$set": update_data}
    )
    
    return {"message": "Boarding pass updated"}

@router.get("/admin/dashboard")
async def get_boarding_dashboard(current_user: dict = Depends(get_current_user)):
    """Get boarding pass dashboard"""
    if "admin" not in current_user.get("roles", []) and "operator" not in current_user.get("roles", []):
        raise HTTPException(status_code=403, detail="Staff access required")
    
    db = get_database()
    
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    total_passes = await db.boarding_passes.count_documents({})
    today_passes = await db.boarding_passes.count_documents({"flight_date": today})
    checked_in_today = await db.boarding_passes.count_documents({"flight_date": today, "checked_in": True})
    boarded_today = await db.boarding_passes.count_documents({"flight_date": today, "boarded": True})
    
    # Today's flights
    today_flights = await db.boarding_passes.find(
        {"flight_date": today},
        {"_id": 0}
    ).sort("flight_time", 1).to_list(100)
    
    return {
        "total_passes_issued": total_passes,
        "today_flights": today_passes,
        "checked_in": checked_in_today,
        "boarded": boarded_today,
        "pending_checkin": today_passes - checked_in_today,
        "today_manifest": today_flights
    }
