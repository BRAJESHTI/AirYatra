"""Multi-Vertical Business Lines: Helipad, Yacht, Cruise
Assets, availability, bookings, payments, invoices, payouts, revenue reports."""
from fastapi import APIRouter, HTTPException, Depends, Body
from typing import Optional, List, Dict, Any
from pydantic import BaseModel
from datetime import datetime, timezone
import uuid
import logging

from database import get_database
from middleware import get_current_user

router = APIRouter(prefix="/verticals", tags=["Verticals: Helipad/Yacht/Cruise"])
logger = logging.getLogger(__name__)

VERTICALS = {"helipad", "yacht", "cruise"}
OWNER_ROLE_MAP = {"helipad": "helipad_owner", "yacht": "yacht_owner", "cruise": "cruise_operator"}
OWNER_ROLES = set(OWNER_ROLE_MAP.values()) | {"operator"}
STAFF_ROLES = {"admin", "super_admin", "ceo"}
FINANCE_ROLES = {"finance", "accounts"} | STAFF_ROLES
PLATFORM_FEE_PCT = 10.0
UNIT_LABEL = {"helipad": "landing", "yacht": "hour", "cruise": "cabin/night"}


def _now():
    return datetime.now(timezone.utc)


def _is_owner_or_staff(user):
    return (OWNER_ROLES | STAFF_ROLES) & set(user.get("roles", []))


class AssetCreate(BaseModel):
    vertical: str
    name: str
    city: str
    location: Optional[str] = None
    description: Optional[str] = None
    base_price: float
    details: Dict[str, Any] = {}
    images: List[str] = []


class BookingCreate(BaseModel):
    asset_id: str
    start_date: str
    end_date: Optional[str] = None
    quantity: int = 1
    notes: Optional[str] = None
    passengers: List[Dict[str, Any]] = []


# ==================== ASSETS ====================

@router.post("/assets")
async def register_asset(data: AssetCreate, user: dict = Depends(get_current_user)):
    if not _is_owner_or_staff(user):
        raise HTTPException(status_code=403, detail="Owner/Operator access required")
    if data.vertical not in VERTICALS:
        raise HTTPException(status_code=400, detail="vertical must be helipad, yacht or cruise")
    db = get_database()
    prefix = {"helipad": "HLP", "yacht": "YCT", "cruise": "CRZ"}[data.vertical]
    count = await db.vertical_assets.count_documents({"vertical": data.vertical})
    asset = {
        "id": str(uuid.uuid4()),
        "asset_code": f"{prefix}-{count + 1:04d}",
        "vertical": data.vertical,
        "name": data.name,
        "city": data.city,
        "location": data.location,
        "description": data.description,
        "base_price": data.base_price,
        "price_unit": UNIT_LABEL[data.vertical],
        "details": data.details,
        "images": data.images,
        "owner_user_id": user["id"],
        "owner_name": user.get("full_name") or user["email"],
        "status": "active",
        "blocked_dates": [],
        "created_at": _now().isoformat(),
    }
    await db.vertical_assets.insert_one({**asset})
    return {"message": f"{data.vertical.title()} registered", "asset": asset}


@router.get("/assets/my")
async def my_assets(user: dict = Depends(get_current_user)):
    db = get_database()
    q = {} if STAFF_ROLES & set(user.get("roles", [])) else {"owner_user_id": user["id"]}
    assets = await db.vertical_assets.find(q, {"_id": 0}).sort("created_at", -1).to_list(200)
    return {"assets": assets}


@router.get("/assets/browse")
async def browse_assets(vertical: str, city: Optional[str] = None,
                        user: dict = Depends(get_current_user)):
    if vertical not in VERTICALS:
        raise HTTPException(status_code=400, detail="Invalid vertical")
    db = get_database()
    q = {"vertical": vertical, "status": "active"}
    if city:
        q["city"] = {"$regex": city, "$options": "i"}
    assets = await db.vertical_assets.find(q, {"_id": 0}).sort("base_price", 1).to_list(100)
    return {"assets": assets}


@router.put("/assets/{asset_id}")
async def update_asset(asset_id: str, updates: Dict[str, Any] = Body(...),
                       user: dict = Depends(get_current_user)):
    db = get_database()
    asset = await db.vertical_assets.find_one({"id": asset_id}, {"_id": 0})
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    if asset["owner_user_id"] != user["id"] and not STAFF_ROLES & set(user.get("roles", [])):
        raise HTTPException(status_code=403, detail="Not your asset")
    allowed = {"name", "city", "location", "description", "base_price", "details", "images", "status", "blocked_dates"}
    updates = {k: v for k, v in updates.items() if k in allowed}
    await db.vertical_assets.update_one({"id": asset_id}, {"$set": updates})
    return {"message": "Asset updated"}


@router.get("/assets/{asset_id}/availability")
async def asset_availability(asset_id: str, user: dict = Depends(get_current_user)):
    db = get_database()
    asset = await db.vertical_assets.find_one({"id": asset_id}, {"_id": 0, "blocked_dates": 1, "id": 1})
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    booked = await db.vertical_bookings.find(
        {"asset_id": asset_id, "status": {"$in": ["confirmed", "paid"]}},
        {"_id": 0, "start_date": 1, "end_date": 1}).to_list(200)
    return {"blocked_dates": asset.get("blocked_dates", []), "booked_ranges": booked}


# ==================== BOOKINGS ====================

@router.post("/bookings")
async def create_booking(data: BookingCreate, user: dict = Depends(get_current_user)):
    db = get_database()
    asset = await db.vertical_assets.find_one({"id": data.asset_id, "status": "active"}, {"_id": 0})
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not available")
    if data.start_date in asset.get("blocked_dates", []):
        raise HTTPException(status_code=400, detail="Selected date is not available")
    qty = max(1, data.quantity)
    amount = round(asset["base_price"] * qty, 2)
    prefix = {"helipad": "HB", "yacht": "YB", "cruise": "CB"}[asset["vertical"]]
    count = await db.vertical_bookings.count_documents({"vertical": asset["vertical"]})
    booking = {
        "id": str(uuid.uuid4()),
        "booking_number": f"{prefix}{_now().strftime('%Y%m')}{count + 1:04d}",
        "vertical": asset["vertical"],
        "asset_id": asset["id"],
        "asset_code": asset["asset_code"],
        "asset_name": asset["name"],
        "city": asset["city"],
        "owner_user_id": asset["owner_user_id"],
        "customer_id": user["id"],
        "customer_name": user.get("full_name") or user["email"],
        "customer_email": user["email"],
        "start_date": data.start_date,
        "end_date": data.end_date or data.start_date,
        "quantity": qty,
        "unit": asset["price_unit"],
        "amount": amount,
        "notes": data.notes,
        "passengers": data.passengers,
        "status": "pending",
        "payment_status": "unpaid",
        "created_at": _now().isoformat(),
    }
    await db.vertical_bookings.insert_one({**booking})
    return {"message": f"{asset['vertical'].title()} booking created. Awaiting owner confirmation.",
            "booking": booking}


@router.get("/bookings/my")
async def my_bookings(user: dict = Depends(get_current_user)):
    db = get_database()
    bookings = await db.vertical_bookings.find(
        {"customer_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return {"bookings": bookings}


@router.get("/bookings/owner")
async def owner_bookings(user: dict = Depends(get_current_user)):
    db = get_database()
    q = {} if STAFF_ROLES & set(user.get("roles", [])) else {"owner_user_id": user["id"]}
    bookings = await db.vertical_bookings.find(q, {"_id": 0}).sort("created_at", -1).to_list(200)
    return {"bookings": bookings}


@router.put("/bookings/{booking_id}/decision")
async def booking_decision(booking_id: str, action: str = Body(..., embed=True),
                           user: dict = Depends(get_current_user)):
    if action not in ("confirm", "reject"):
        raise HTTPException(status_code=400, detail="action must be confirm or reject")
    db = get_database()
    booking = await db.vertical_bookings.find_one({"id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if booking["owner_user_id"] != user["id"] and not STAFF_ROLES & set(user.get("roles", [])):
        raise HTTPException(status_code=403, detail="Not your booking")
    if booking["status"] != "pending":
        raise HTTPException(status_code=400, detail="Booking already processed")
    new_status = "confirmed" if action == "confirm" else "rejected"
    await db.vertical_bookings.update_one({"id": booking_id}, {"$set": {"status": new_status}})
    return {"message": f"Booking {new_status}"}


@router.post("/bookings/{booking_id}/pay")
async def pay_booking(booking_id: str, user: dict = Depends(get_current_user)):
    """Payment + auto invoice email + ledger + owner payout settlement"""
    db = get_database()
    booking = await db.vertical_bookings.find_one({"id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if booking["customer_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Not your booking")
    if booking["status"] != "confirmed":
        raise HTTPException(status_code=400, detail="Booking must be confirmed by owner before payment")
    if booking["payment_status"] == "paid":
        raise HTTPException(status_code=400, detail="Already paid")

    order_id = f"order_vt_{uuid.uuid4().hex[:12]}"
    payment_id = f"pay_vt_{uuid.uuid4().hex[:12]}"
    now = _now().isoformat()
    await db.payment_orders.insert_one({
        "id": str(uuid.uuid4()), "order_id": order_id, "payment_id": payment_id,
        "booking_id": booking_id, "amount": booking["amount"], "currency": "INR",
        "status": "paid", "mock": True, "vertical": booking["vertical"],
        "created_at": now, "verified_at": now,
    })
    await db.vertical_bookings.update_one(
        {"id": booking_id},
        {"$set": {"payment_status": "paid", "status": "paid", "paid_at": now,
                  "order_id": order_id, "payment_id": payment_id}})

    commission = round(booking["amount"] * PLATFORM_FEE_PCT / 100, 2)
    payout = round(booking["amount"] - commission, 2)
    scount = await db.settlements.count_documents({})
    await db.settlements.insert_one({
        "id": str(uuid.uuid4()),
        "settlement_number": f"STL-VT-{scount + 1:05d}",
        "operator_id": booking["owner_user_id"],
        "operator_name": f"{booking['asset_name']} ({booking['vertical'].title()} Owner)",
        "booking_ids": [booking_id],
        "total_booking_amount": booking["amount"],
        "commission_amount": commission,
        "payout_amount": payout,
        "vertical": booking["vertical"],
        "status": "pending",
        "created_at": now,
    })
    await db.ledger_entries.insert_one({
        "id": str(uuid.uuid4()), "type": f"{booking['vertical']}_booking_payment",
        "booking_id": booking_id, "booking_number": booking["booking_number"],
        "amount": booking["amount"], "commission": commission, "payout": payout,
        "created_at": now,
    })
    try:
        await _send_vertical_invoice(db, booking, order_id)
    except Exception as e:
        logger.error(f"Vertical invoice email failed: {e}")
    return {"message": f"Payment successful! Invoice emailed. Booking {booking['booking_number']} is confirmed & paid.",
            "order_id": order_id, "payment_id": payment_id, "amount": booking["amount"]}


async def _send_vertical_invoice(db, booking, order_id):
    from services.email_service import email_service
    gst = round(booking["amount"] - booking["amount"] / 1.05, 2)
    html = f"""
<div style="font-family:'Segoe UI',Arial,sans-serif;background:#1a1a2e;color:#fff;padding:20px;">
  <div style="max-width:600px;margin:0 auto;background:#16213e;border-radius:16px;overflow:hidden;">
    <div style="background:linear-gradient(135deg,#0ea5e9,#0369a1);padding:26px;text-align:center;">
      <h1 style="margin:0;font-size:22px;">Tax Invoice — {booking['vertical'].title()} Booking</h1>
      <p style="margin:8px 0 0;opacity:.9;">Invoice INV-{booking['booking_number']}</p>
    </div>
    <div style="padding:26px;">
      <p>Dear {booking['customer_name']},</p>
      <p>Your {booking['vertical']} booking is confirmed and paid. Details:</p>
      <div style="background:#1a1a2e;border-radius:12px;padding:18px;margin:16px 0;">
        <p style="margin:4px 0;color:#94a3b8;">Booking: <b style="color:#fff;">{booking['booking_number']}</b></p>
        <p style="margin:4px 0;color:#94a3b8;">Asset: <b style="color:#fff;">{booking['asset_name']} ({booking['asset_code']})</b></p>
        <p style="margin:4px 0;color:#94a3b8;">City: <b style="color:#fff;">{booking['city']}</b></p>
        <p style="margin:4px 0;color:#94a3b8;">Dates: <b style="color:#fff;">{booking['start_date']} → {booking['end_date']}</b></p>
        <p style="margin:4px 0;color:#94a3b8;">Quantity: <b style="color:#fff;">{booking['quantity']} {booking['unit']}(s)</b></p>
        <p style="margin:4px 0;color:#94a3b8;">GST (incl. 5%): <b style="color:#fff;">₹{gst:,.2f}</b></p>
        <p style="margin:10px 0 0;font-size:18px;color:#4ade80;"><b>Total Paid: ₹{booking['amount']:,.2f}</b></p>
      </div>
      <p style="color:#94a3b8;font-size:13px;">Payment Ref: {order_id}</p>
      <p style="margin-top:18px;">Team AirYatra ⚓✈️</p>
    </div>
  </div>
</div>"""
    await email_service.send_email(
        to_email=booking["customer_email"],
        subject=f"🧾 Invoice INV-{booking['booking_number']} — {booking['vertical'].title()} Booking Paid | AirYatra",
        html_body=html)
    await db.invoice_email_log.insert_one({
        "id": str(uuid.uuid4()), "booking_id": booking["id"], "stage": "vertical_payment",
        "invoice_number": f"INV-{booking['booking_number']}", "status": "sent",
        "sent_at": _now().isoformat(), "to_email": booking["customer_email"]})


# ==================== REPORTS ====================

@router.get("/reports/revenue")
async def vertical_revenue(user: dict = Depends(get_current_user)):
    if not FINANCE_ROLES & set(user.get("roles", [])):
        raise HTTPException(status_code=403, detail="Finance/Admin access required")
    db = get_database()
    out = {}
    for v in VERTICALS:
        paid = await db.vertical_bookings.find(
            {"vertical": v, "payment_status": "paid"}, {"_id": 0}).to_list(500)
        total = sum(b["amount"] for b in paid)
        commission = round(total * PLATFORM_FEE_PCT / 100, 2)
        out[v] = {
            "bookings": await db.vertical_bookings.count_documents({"vertical": v}),
            "paid_bookings": len(paid),
            "gross_revenue": round(total, 2),
            "platform_commission": commission,
            "owner_payouts": round(total - commission, 2),
            "assets": await db.vertical_assets.count_documents({"vertical": v, "status": "active"}),
        }
    recent = await db.vertical_bookings.find({}, {"_id": 0}).sort("created_at", -1).to_list(50)
    return {"verticals": out, "recent_bookings": recent, "platform_fee_pct": PLATFORM_FEE_PCT}
