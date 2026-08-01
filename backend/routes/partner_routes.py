import secrets
import hmac
import hashlib
import json
from fastapi import APIRouter, HTTPException, Depends, Header, Query, BackgroundTasks
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
from uuid import uuid4
from database import get_database
from routes.auth_routes import get_current_user

router = APIRouter(prefix="/partners", tags=["Partner Management"])
api_router = APIRouter(prefix="/partner/v1", tags=["Partner API v1"])


class PartnerCreate(BaseModel):
    name: str
    company: str
    partner_type: str = "hotel"  # hotel, travel_agency, corporate, other
    contact_email: str
    webhook_url: Optional[str] = None


class WebhookConfig(BaseModel):
    webhook_url: str


class PartnerBookingCreate(BaseModel):
    customer_name: str
    customer_phone: str
    customer_email: Optional[str] = None
    from_location: str
    to_location: str
    departure_date: str
    passengers: int = 1
    notes: str = ""


def _require_admin(user):
    if "admin" not in user.get("roles", []):
        raise HTTPException(status_code=403, detail="Admin access required")


async def _dispatch_webhook(partner: dict, event: str, payload: dict):
    """POST signed event to partner's webhook_url and log the delivery"""
    import httpx
    from database import get_database as _gdb
    db = _gdb()
    url = partner.get("webhook_url")
    if not url:
        return
    body = json.dumps({
        "event": event,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "data": payload,
    })
    signature = hmac.new(partner["api_key"].encode(), body.encode(), hashlib.sha256).hexdigest()
    status_code, success, error = None, False, None
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(url, content=body, headers={
                "Content-Type": "application/json",
                "X-AirYatra-Signature": signature,
                "X-AirYatra-Event": event,
            })
            status_code = resp.status_code
            success = 200 <= resp.status_code < 300
    except Exception as e:
        error = str(e)[:200]
    await db.partner_webhook_logs.insert_one({
        "id": str(uuid4()),
        "partner_id": partner["id"],
        "event": event,
        "url": url,
        "booking_id": payload.get("booking_id"),
        "status_code": status_code,
        "success": success,
        "error": error,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })


# ---------- Admin: Partner Management ----------

@router.post("")
async def create_partner(partner: PartnerCreate, current_user: dict = Depends(get_current_user)):
    _require_admin(current_user)
    db = get_database()
    api_key = "ayk_" + secrets.token_hex(24)
    doc = {
        "id": f"ptr-{uuid4().hex[:8]}",
        **partner.dict(),
        "api_key": api_key,
        "status": "active",
        "request_count": 0,
        "last_used_at": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.partners.insert_one(dict(doc))
    return {"message": "Partner created. Share the API key securely — it is shown in full only here.", "partner": doc}


@router.get("")
async def list_partners(current_user: dict = Depends(get_current_user)):
    _require_admin(current_user)
    db = get_database()
    partners = await db.partners.find({}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return {"partners": partners}


@router.patch("/{partner_id}/status")
async def update_partner_status(partner_id: str, status: str = Query(...), current_user: dict = Depends(get_current_user)):
    _require_admin(current_user)
    if status not in ["active", "revoked"]:
        raise HTTPException(status_code=400, detail="Invalid status")
    db = get_database()
    r = await db.partners.update_one({"id": partner_id}, {"$set": {"status": status}})
    if r.matched_count == 0:
        raise HTTPException(status_code=404, detail="Partner not found")
    return {"message": f"Partner {status}"}


@router.patch("/{partner_id}/webhook")
async def set_partner_webhook(partner_id: str, cfg: WebhookConfig, current_user: dict = Depends(get_current_user)):
    _require_admin(current_user)
    url = cfg.webhook_url.strip()
    if url and not url.startswith(("http://", "https://")):
        raise HTTPException(status_code=400, detail="Webhook URL must start with http:// or https://")
    db = get_database()
    r = await db.partners.update_one({"id": partner_id}, {"$set": {"webhook_url": url or None}})
    if r.matched_count == 0:
        raise HTTPException(status_code=404, detail="Partner not found")
    return {"message": "Webhook URL saved" if url else "Webhook removed"}


@router.get("/{partner_id}/webhook-logs")
async def get_webhook_logs(partner_id: str, current_user: dict = Depends(get_current_user)):
    _require_admin(current_user)
    db = get_database()
    logs = await db.partner_webhook_logs.find({"partner_id": partner_id}, {"_id": 0}).sort("created_at", -1).to_list(20)
    return {"logs": logs}


@router.post("/{partner_id}/regenerate-key")
async def regenerate_key(partner_id: str, current_user: dict = Depends(get_current_user)):
    _require_admin(current_user)
    db = get_database()
    new_key = "ayk_" + secrets.token_hex(24)
    r = await db.partners.update_one({"id": partner_id}, {"$set": {"api_key": new_key}})
    if r.matched_count == 0:
        raise HTTPException(status_code=404, detail="Partner not found")
    return {"message": "API key regenerated — old key is now invalid", "api_key": new_key}


@router.get("/bookings")
async def admin_partner_bookings(current_user: dict = Depends(get_current_user)):
    _require_admin(current_user)
    db = get_database()
    bookings = await db.partner_bookings.find({}, {"_id": 0}).sort("created_at", -1).to_list(300)
    return {"bookings": bookings, "new_count": sum(1 for b in bookings if b.get("status") == "received")}


@router.patch("/bookings/{booking_id}/status")
async def update_partner_booking_status(booking_id: str, background_tasks: BackgroundTasks, status: str = Query(...), current_user: dict = Depends(get_current_user)):
    _require_admin(current_user)
    if status not in ["received", "processing", "confirmed", "cancelled"]:
        raise HTTPException(status_code=400, detail="Invalid status")
    db = get_database()
    booking = await db.partner_bookings.find_one({"id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    previous_status = booking.get("status")
    await db.partner_bookings.update_one({"id": booking_id}, {"$set": {"status": status, "updated_at": datetime.now(timezone.utc).isoformat()}})
    partner = await db.partners.find_one({"id": booking.get("partner_id")}, {"_id": 0})
    if partner and partner.get("webhook_url"):
        payload = {
            "booking_id": booking_id,
            "status": status,
            "previous_status": previous_status,
            "customer_name": booking.get("customer_name"),
            "from_location": booking.get("from_location"),
            "to_location": booking.get("to_location"),
            "departure_date": booking.get("departure_date"),
            "passengers": booking.get("passengers"),
        }
        background_tasks.add_task(_dispatch_webhook, partner, "booking.status_updated", payload)
    return {"message": f"Booking marked {status}" + (" — partner webhook notified" if partner and partner.get("webhook_url") else "")}


# ---------- Partner API v1 (X-API-Key auth) ----------

async def get_partner(x_api_key: str = Header(..., alias="X-API-Key")):
    db = get_database()
    partner = await db.partners.find_one({"api_key": x_api_key}, {"_id": 0})
    if not partner:
        raise HTTPException(status_code=401, detail="Invalid API key")
    if partner.get("status") != "active":
        raise HTTPException(status_code=403, detail="API key revoked — contact AirYatra partnerships team")
    await db.partners.update_one({"id": partner["id"]}, {"$inc": {"request_count": 1}, "$set": {"last_used_at": datetime.now(timezone.utc).isoformat()}})
    return partner


@api_router.get("/ping")
async def partner_ping(partner: dict = Depends(get_partner)):
    """Validate your API key"""
    return {"status": "ok", "partner": partner["company"], "message": "Welcome to AirYatra Partner API v1"}


@api_router.get("/aircraft")
async def partner_aircraft(partner: dict = Depends(get_partner)):
    """Available aircraft fleet for charter bookings"""
    db = get_database()
    aircraft = await db.aircraft.find({"is_available": True}, {"_id": 0, "id": 1, "aircraft_type": 1, "capacity": 1, "base_location": 1, "operator_id": 1}).to_list(100)
    ops = {o["id"]: o.get("company_name") for o in await db.operators.find({"status": "active"}, {"_id": 0, "id": 1, "company_name": 1}).to_list(200)}
    for a in aircraft:
        a["operator"] = ops.get(a.pop("operator_id", None), "AirYatra Partner Operator")
    return {"aircraft": aircraft, "total": len(aircraft)}


@api_router.post("/bookings")
async def partner_create_booking(req: PartnerBookingCreate, partner: dict = Depends(get_partner)):
    """Create a charter booking request on behalf of your customer"""
    db = get_database()
    doc = {
        "id": f"pb-{uuid4().hex[:10]}",
        "partner_id": partner["id"],
        "partner_company": partner["company"],
        **req.dict(),
        "status": "received",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": None,
    }
    await db.partner_bookings.insert_one(dict(doc))
    return {
        "booking_id": doc["id"],
        "status": "received",
        "message": "Booking request received. AirYatra team will process and confirm within 4 business hours.",
    }


@api_router.get("/bookings/{booking_id}")
async def partner_booking_status(booking_id: str, partner: dict = Depends(get_partner)):
    """Check status of your booking request"""
    db = get_database()
    booking = await db.partner_bookings.find_one({"id": booking_id, "partner_id": partner["id"]}, {"_id": 0, "partner_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    return booking
