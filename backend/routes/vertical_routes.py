"""Multi-Vertical Business Lines: Helipad, Yacht, Cruise
Assets, availability, bookings, payments, invoices, payouts, revenue reports."""
from fastapi import APIRouter, HTTPException, Depends, Body
from typing import Optional, List, Dict, Any
from pydantic import BaseModel
from datetime import datetime, timezone, timedelta
import uuid
import logging

from database import get_database
from middleware import get_current_user, require_roles

router = APIRouter(prefix="/verticals", tags=["Verticals: Helipad/Yacht/Cruise"])
logger = logging.getLogger(__name__)

VERTICALS = {"helipad", "yacht", "cruise"}
OWNER_ROLE_MAP = {"helipad": "helipad_owner", "yacht": "yacht_owner", "cruise": "cruise_operator"}
OWNER_ROLES = set(OWNER_ROLE_MAP.values()) | {"operator"}
STAFF_ROLES = {"admin", "super_admin", "ceo"}
FINANCE_ROLES = {"finance", "accounts"} | STAFF_ROLES
PLATFORM_FEE_PCT = 10.0
PHOTO_ROLES = STAFF_ROLES | {"sales", "support"}
UNIT_LABEL = {"helipad": "landing", "yacht": "hour", "cruise": "cabin/night"}


def _now():
    return datetime.now(timezone.utc)


def _is_owner_or_staff(user):
    return (OWNER_ROLES | STAFF_ROLES) & set(user.get("roles", []))


IST = timezone(timedelta(hours=5, minutes=30))


async def _todays_deal_id(db):
    """Deterministic daily deal pick among top-6 photographed active vertical assets (IST day)"""
    assets = await db.vertical_assets.find(
        {"status": "active"}, {"_id": 0, "id": 1, "images": 1}).to_list(200)
    assets.sort(key=lambda a: (-len(a.get("images", [])), a["id"]))
    pool = assets[:6]
    if not pool:
        return None
    return pool[datetime.now(IST).date().toordinal() % len(pool)]["id"]


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
    start_time: Optional[str] = None
    guests: Optional[int] = None
    package: Optional[str] = None


DEFAULT_SERVICE_CATEGORIES = {"helicopter": True, "private_jet": True,
                              "yacht": True, "cruise": True, "helipad": True}


@router.get("/service-categories")
async def get_service_categories(user: dict = Depends(get_current_user)):
    """Customer booking dropdown ke liye admin-enabled service categories"""
    db = get_database()
    doc = await db.platform_settings.find_one({"key": "service_categories"}, {"_id": 0})
    return {"categories": {**DEFAULT_SERVICE_CATEGORIES, **((doc or {}).get("categories") or {})}}


@router.put("/admin/service-categories")
async def update_service_categories(data: Dict[str, Any] = Body(...),
                                    user: dict = Depends(require_roles(["admin", "super_admin"]))):
    db = get_database()
    cats = {k: bool(v) for k, v in (data.get("categories") or {}).items()
            if k in DEFAULT_SERVICE_CATEGORIES}
    if not cats:
        raise HTTPException(status_code=400, detail="No valid categories provided")
    await db.platform_settings.update_one(
        {"key": "service_categories"},
        {"$set": {"categories": cats, "updated_by": user["id"],
                  "updated_at": datetime.now(timezone.utc).isoformat()}}, upsert=True)
    try:
        from routes.audit_trail_routes import audit_event
        await audit_event(db, "service_categories_updated", user, details=cats,
                          resource_type="platform_settings", risk_level="medium")
    except Exception:
        pass
    return {"message": "Service categories updated", "categories": cats}


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
    q = {} if PHOTO_ROLES & set(user.get("roles", [])) else {"owner_user_id": user["id"]}
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
    allowed = {"name", "city", "location", "description", "base_price", "details", "images", "status",
               "blocked_dates", "crew", "seasonal_rules", "available_slots", "min_duration",
               "max_capacity", "packages", "additional_charges", "facilities", "special_conditions"}
    updates = {k: v for k, v in updates.items() if k in allowed}
    await db.vertical_assets.update_one({"id": asset_id}, {"$set": updates})
    return {"message": "Asset updated"}


@router.get("/assets/{asset_id}/availability")
async def asset_availability(asset_id: str, user: dict = Depends(get_current_user)):
    db = get_database()
    asset = await db.vertical_assets.find_one(
        {"id": asset_id},
        {"_id": 0, "blocked_dates": 1, "id": 1, "available_slots": 1, "min_duration": 1,
         "max_capacity": 1, "packages": 1, "additional_charges": 1, "facilities": 1,
         "special_conditions": 1, "vertical": 1})
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    booked = await db.vertical_bookings.find(
        {"asset_id": asset_id, "status": {"$in": ["confirmed", "paid", "pending"]}},
        {"_id": 0, "start_date": 1, "end_date": 1}).to_list(200)
    max_cap = int(asset.get("max_capacity") or 1)
    day_counts = {}
    for b in booked:
        s, e = b["start_date"], b.get("end_date") or b["start_date"]
        try:
            cur = datetime.fromisoformat(s)
            end = datetime.fromisoformat(e)
            while cur <= end:
                d = cur.strftime("%Y-%m-%d")
                day_counts[d] = day_counts.get(d, 0) + 1
                cur += timedelta(days=1)
        except Exception:
            day_counts[s] = day_counts.get(s, 0) + 1
    full_dates = [d for d, c in day_counts.items() if c >= max_cap]
    return {"blocked_dates": asset.get("blocked_dates", []), "booked_ranges": booked,
            "fully_booked_dates": full_dates, "max_capacity": max_cap,
            "available_slots": asset.get("available_slots", []),
            "min_duration": asset.get("min_duration"),
            "packages": asset.get("packages", []),
            "additional_charges": asset.get("additional_charges", []),
            "facilities": asset.get("facilities", []),
            "special_conditions": asset.get("special_conditions")}


async def _check_asset_availability(db, asset, start_date: str, end_date: str):
    """Server-side authoritative availability check (double-booking lock)"""
    end_date = end_date or start_date
    try:
        cur = datetime.fromisoformat(start_date)
        end = datetime.fromisoformat(end_date)
    except Exception:
        return False, "Invalid date"
    blocked = set(asset.get("blocked_dates", []))
    max_cap = int(asset.get("max_capacity") or 1)
    dates = []
    while cur <= end:
        dates.append(cur.strftime("%Y-%m-%d"))
        cur += timedelta(days=1)
    for d in dates:
        if d in blocked:
            return False, f"{d} is blocked by the operator"
    overlapping = await db.vertical_bookings.find(
        {"asset_id": asset["id"], "status": {"$in": ["confirmed", "paid", "pending"]},
         "start_date": {"$lte": end_date}},
        {"_id": 0, "start_date": 1, "end_date": 1}).to_list(300)
    day_counts = {}
    for b in overlapping:
        be = b.get("end_date") or b["start_date"]
        if be < start_date:
            continue
        try:
            c2 = datetime.fromisoformat(b["start_date"])
            e2 = datetime.fromisoformat(be)
            while c2 <= e2:
                d = c2.strftime("%Y-%m-%d")
                day_counts[d] = day_counts.get(d, 0) + 1
                c2 += timedelta(days=1)
        except Exception:
            continue
    for d in dates:
        if day_counts.get(d, 0) >= max_cap:
            return False, f"{d} is fully booked"
    return True, None


@router.get("/assets/{asset_id}/check-availability")
async def check_availability(asset_id: str, start_date: str, end_date: Optional[str] = None,
                             user: dict = Depends(get_current_user)):
    """Real-time availability check before booking"""
    db = get_database()
    asset = await db.vertical_assets.find_one({"id": asset_id, "status": "active"}, {"_id": 0})
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    ok, reason = await _check_asset_availability(db, asset, start_date, end_date or start_date)
    return {"available": ok, "reason": reason,
            "message": "Available – Book Now" if ok else "Not Available"}


async def _compute_price_breakup(db, asset, start_date: str, quantity: int, package: Optional[str] = None):
    """Complete transparent price breakup (operator + package + additional + platform fee + taxes)"""
    qty = max(1, quantity)
    operator_charges = round(asset["base_price"] * qty, 2)
    applied_rule, seasonal_adj = None, 0.0
    for rule in asset.get("seasonal_rules", []):
        if rule.get("start_date") <= start_date <= rule.get("end_date"):
            seasonal_adj = round(operator_charges * float(rule.get("multiplier_pct", 0)) / 100, 2)
            applied_rule = rule.get("name")
            break
    subtotal = operator_charges + seasonal_adj
    deal_applied, deal_discount = False, 0.0
    if asset["id"] == await _todays_deal_id(db):
        deal_applied = True
        deal_discount = round(subtotal * 0.10, 2)
        subtotal = round(subtotal - deal_discount, 2)
    package_price, package_name = 0.0, None
    if package:
        for p in asset.get("packages", []):
            if p.get("name") == package:
                package_price = round(float(p.get("price") or 0), 2)
                package_name = p.get("name")
                break
    additional = [{"label": c.get("label"), "amount": round(float(c.get("amount") or 0), 2)}
                  for c in asset.get("additional_charges", [])]
    additional_total = round(sum(c["amount"] for c in additional), 2)
    cfg = await db.platform_settings.find_one({"key": "vertical_pricing"}, {"_id": 0}) or {}
    fee_pct = float(cfg.get("platform_fee_pct") or 0)
    tax_pct = float(cfg.get("tax_pct") or 0)
    pre_fee = round(subtotal + package_price + additional_total, 2)
    platform_fee = round(pre_fee * fee_pct / 100, 2)
    taxes = round((pre_fee + platform_fee) * tax_pct / 100, 2)
    total = round(pre_fee + platform_fee + taxes, 2)
    return {
        "operator_charges": operator_charges,
        "seasonal_adjustment": seasonal_adj, "seasonal_rule": applied_rule,
        "deal_discount": -deal_discount if deal_applied else 0.0, "deal_applied": deal_applied,
        "package": package_name, "package_price": package_price,
        "additional_charges": additional, "additional_total": additional_total,
        "platform_fee": platform_fee, "platform_fee_pct": fee_pct,
        "taxes": taxes, "tax_pct": tax_pct,
        "total": total,
    }


@router.get("/assets/{asset_id}/quote")
async def asset_quote(asset_id: str, start_date: str, quantity: int = 1,
                      package: Optional[str] = None, user: dict = Depends(get_current_user)):
    """Booking se pehle complete price breakup"""
    db = get_database()
    asset = await db.vertical_assets.find_one({"id": asset_id, "status": "active"}, {"_id": 0})
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    breakup = await _compute_price_breakup(db, asset, start_date, quantity, package)
    return {"breakup": breakup, "asset_name": asset["name"], "unit": asset["price_unit"]}


# ==================== BOOKINGS ====================

SEED_VERTICAL_USERS = [
    ("yachtowner@airyatra.co.in", "Yacht@123456", "yacht_owner", "Marina Yachts Pvt Ltd"),
    ("cruiseop@airyatra.co.in", "Cruise@123456", "cruise_operator", "BlueWave Cruises Ltd"),
    ("helipadowner@airyatra.co.in", "Helipad@123456", "helipad_owner", "SkyPad Helipads"),
]
SEED_VERTICAL_ASSETS = [
    ("helipad", "Juhu Beach Helipad", "Mumbai", "Juhu Beach, Near Airport", 25000, "helipad_owner", "DGCA-approved rooftop helipad with night landing"),
    ("helipad", "Aravalli Hills Helipad", "Gurugram", "Sector 59, Aravalli Edge", 18000, "helipad_owner", "Corporate helipad with lounge"),
    ("yacht", "Ocean Pearl 55ft", "Goa", "Mandovi Marina", 15000, "yacht_owner", "Luxury 55ft yacht, 12 guests, crew included"),
    ("yacht", "Sea Breeze Catamaran", "Mumbai", "Gateway of India Jetty", 12000, "yacht_owner", "Catamaran for parties, 20 guests"),
    ("cruise", "BlueWave Explorer", "Kochi", "Kochi Port Terminal 2", 8500, "cruise_operator", "3-night Lakshadweep cruise, luxury cabins"),
    ("cruise", "Ganga Vilas Deluxe", "Varanasi", "Ravidas Ghat", 12500, "cruise_operator", "River cruise with heritage tours"),
]


@router.post("/admin/seed")
async def seed_vertical_data(current_user: dict = Depends(require_roles(["admin", "super_admin"]))):
    """Idempotent seed: marine/helipad owner accounts + assets (for fresh production DB)"""
    from auth import get_password_hash
    db = get_database()
    now = datetime.now(timezone.utc).isoformat()
    uids, created_users, created_assets = {}, 0, 0
    for email, pwd, role, name in SEED_VERTICAL_USERS:
        existing = await db.users.find_one({"email": email})
        if existing:
            uids[role] = existing["id"]
            continue
        uid = str(uuid.uuid4())
        await db.users.insert_one({"id": uid, "email": email, "password_hash": get_password_hash(pwd),
                                   "full_name": name, "roles": [role], "is_active": True, "email_verified": True,
                                   "phone": "+919000000001", "created_at": now})
        uids[role] = uid
        created_users += 1
    prefix = {"helipad": "HLP", "yacht": "YCT", "cruise": "CRZ"}
    unit = {"helipad": "landing", "yacht": "hour", "cruise": "cabin/night"}
    for v, name, city, loc, price, role, desc in SEED_VERTICAL_ASSETS:
        if await db.vertical_assets.find_one({"name": name}):
            continue
        count = await db.vertical_assets.count_documents({"vertical": v})
        owner = await db.users.find_one({"id": uids[role]}, {"full_name": 1})
        await db.vertical_assets.insert_one({
            "id": str(uuid.uuid4()), "asset_code": f"{prefix[v]}-{count+1:04d}", "vertical": v,
            "name": name, "city": city, "location": loc, "description": desc,
            "base_price": price, "price_unit": unit[v], "details": {}, "images": [],
            "owner_user_id": uids[role], "owner_name": (owner or {}).get("full_name"), "status": "active",
            "blocked_dates": [], "created_at": now})
        created_assets += 1
    try:
        from routes.audit_trail_routes import audit_event
        await audit_event(db, "vertical_seed_executed", current_user,
                          details={"created_users": created_users, "created_assets": created_assets},
                          resource_type="seed", risk_level="high")
    except Exception:
        pass
    total = await db.vertical_assets.count_documents({})
    return {"message": f"Seed complete: {created_users} new owner accounts, {created_assets} new assets (total assets: {total})",
            "created_users": created_users, "created_assets": created_assets, "total_assets": total}


@router.post("/bookings")
async def create_booking(data: BookingCreate, user: dict = Depends(get_current_user)):
    db = get_database()
    asset = await db.vertical_assets.find_one({"id": data.asset_id, "status": "active"}, {"_id": 0})
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not available")
    end_date = data.end_date or data.start_date
    ok, reason = await _check_asset_availability(db, asset, data.start_date, end_date)
    if not ok:
        raise HTTPException(status_code=400, detail=f"Not Available — {reason}")
    if data.guests and asset.get("details", {}).get("max_guests"):
        pass
    qty = max(1, data.quantity)
    if asset.get("min_duration") and qty < int(asset["min_duration"]):
        raise HTTPException(status_code=400,
                            detail=f"Minimum booking duration is {asset['min_duration']} {asset['price_unit']}(s)")
    breakup = await _compute_price_breakup(db, asset, data.start_date, qty, data.package)
    amount = breakup["total"]
    applied_rule = breakup["seasonal_rule"]
    deal_applied = breakup["deal_applied"]
    original_amount = round(amount - breakup["deal_discount"], 2) if deal_applied else amount
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
        "start_time": data.start_time,
        "guests": data.guests,
        "package": data.package,
        "quantity": qty,
        "unit": asset["price_unit"],
        "amount": amount,
        "price_breakup": breakup,
        "seasonal_rule_applied": applied_rule,
        "deal_discount_applied": deal_applied,
        "original_amount": original_amount if deal_applied else None,
        "deal_discount_amount": round(original_amount - amount, 2) if deal_applied else None,
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
    """Create REAL Razorpay order for vertical booking (mock fallback only if gateway unavailable)"""
    db = get_database()
    booking = await db.vertical_bookings.find_one({"id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if booking["customer_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Not your booking")
    if booking["payment_status"] == "paid":
        raise HTTPException(status_code=400, detail="Already paid")
    if booking["status"] != "confirmed":
        raise HTTPException(status_code=400, detail="Booking must be confirmed by owner before payment")

    import routes.razorpay_routes as rzp
    if rzp.razorpay_client is None:
        # Gateway not configured — mock fallback (preview/demo only)
        order_id = f"order_vt_{uuid.uuid4().hex[:12]}"
        payment_id = f"pay_vt_{uuid.uuid4().hex[:12]}"
        await db.payment_orders.insert_one({
            "id": str(uuid.uuid4()), "order_id": order_id, "payment_id": payment_id,
            "booking_id": booking_id, "amount": booking["amount"], "currency": "INR",
            "status": "paid", "mock": True, "vertical": booking["vertical"],
            "created_at": _now().isoformat(), "verified_at": _now().isoformat(),
        })
        return await _complete_vertical_payment(db, booking, order_id, payment_id, mock=True)

    rz_order = rzp.razorpay_client.order.create({
        "amount": int(round(booking["amount"] * 100)),
        "currency": "INR",
        "receipt": booking["booking_number"][:38],
        "notes": {"booking_id": booking_id, "vertical": booking["vertical"], "type": "vertical_booking"},
    })
    await db.payment_orders.insert_one({
        "id": str(uuid.uuid4()), "order_id": rz_order["id"], "payment_id": None,
        "booking_id": booking_id, "amount": booking["amount"], "currency": "INR",
        "status": "created", "mock": False, "vertical": booking["vertical"],
        "created_at": _now().isoformat(),
    })
    return {"gateway": "razorpay", "order_id": rz_order["id"], "key_id": rzp.RAZORPAY_KEY_ID,
            "amount": booking["amount"], "amount_paise": int(round(booking["amount"] * 100)),
            "currency": "INR", "mode": rzp.GATEWAY_MODE,
            "prefill": {"name": booking.get("customer_name") or user.get("full_name", ""),
                        "email": user.get("email", ""), "contact": user.get("phone") or "9999999999"},
            "description": f"{booking['vertical'].title()} Booking {booking['booking_number']}"}


@router.post("/bookings/{booking_id}/verify-payment")
async def verify_vertical_payment(booking_id: str, data: dict = Body(...),
                                  user: dict = Depends(get_current_user)):
    """Verify Razorpay signature -> mark paid + settlement + invoice"""
    db = get_database()
    booking = await db.vertical_bookings.find_one({"id": booking_id}, {"_id": 0})
    if not booking or booking["customer_id"] != user["id"]:
        raise HTTPException(status_code=404, detail="Booking not found")
    if booking["payment_status"] == "paid":
        return {"message": "Already paid", "already_paid": True}
    order_id = data.get("razorpay_order_id")
    payment_id = data.get("razorpay_payment_id")
    signature = data.get("razorpay_signature")
    order = await db.payment_orders.find_one({"order_id": order_id, "booking_id": booking_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Payment order not found")
    import routes.razorpay_routes as rzp
    try:
        rzp.razorpay_client.utility.verify_payment_signature({
            "razorpay_order_id": order_id,
            "razorpay_payment_id": payment_id,
            "razorpay_signature": signature,
        })
    except Exception:
        raise HTTPException(status_code=400, detail="Payment signature verification failed")
    await db.payment_orders.update_one(
        {"order_id": order_id},
        {"$set": {"payment_id": payment_id, "status": "paid", "verified_at": _now().isoformat()}})
    return await _complete_vertical_payment(db, booking, order_id, payment_id, mock=False)


async def _complete_vertical_payment(db, booking, order_id, payment_id, mock=False):
    booking_id = booking["id"]
    now = _now().isoformat()
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
            "order_id": order_id, "payment_id": payment_id, "amount": booking["amount"], "mock": mock}


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


# ==================== CREW / MANIFEST / SEASONAL ====================

async def _own_asset(db, asset_id, user):
    asset = await db.vertical_assets.find_one({"id": asset_id}, {"_id": 0})
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    if asset["owner_user_id"] != user["id"] and not STAFF_ROLES & set(user.get("roles", [])):
        raise HTTPException(status_code=403, detail="Not your asset")
    return asset


@router.put("/assets/{asset_id}/crew")
async def set_crew(asset_id: str, crew: List[Dict[str, Any]] = Body(..., embed=True),
                   user: dict = Depends(get_current_user)):
    """Crew management: [{name, role, license_no, phone}]"""
    db = get_database()
    await _own_asset(db, asset_id, user)
    for c in crew:
        if not c.get("name") or not c.get("role"):
            raise HTTPException(status_code=400, detail="Each crew member needs name and role")
        c.setdefault("id", str(uuid.uuid4()))
    await db.vertical_assets.update_one({"id": asset_id}, {"$set": {"crew": crew}})
    return {"message": f"Crew updated ({len(crew)} members)", "crew": crew}


@router.put("/assets/{asset_id}/seasonal-rules")
async def set_seasonal_rules(asset_id: str, rules: List[Dict[str, Any]] = Body(..., embed=True),
                             user: dict = Depends(get_current_user)):
    """Seasonal pricing: [{name, start_date, end_date, multiplier_pct}]"""
    db = get_database()
    await _own_asset(db, asset_id, user)
    for r in rules:
        if not all(r.get(k) for k in ("name", "start_date", "end_date")) or r.get("multiplier_pct") is None:
            raise HTTPException(status_code=400, detail="Each rule needs name, start_date, end_date, multiplier_pct")
        r.setdefault("id", str(uuid.uuid4()))
    await db.vertical_assets.update_one({"id": asset_id}, {"$set": {"seasonal_rules": rules}})
    return {"message": f"{len(rules)} seasonal rule(s) saved", "rules": rules}


@router.put("/bookings/{booking_id}/manifest")
async def set_manifest(booking_id: str, passengers: List[Dict[str, Any]] = Body(..., embed=True),
                       user: dict = Depends(get_current_user)):
    """Passenger manifest: [{name, age, gender, id_proof}]"""
    db = get_database()
    booking = await db.vertical_bookings.find_one({"id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    allowed = booking["customer_id"] == user["id"] or booking["owner_user_id"] == user["id"] \
        or STAFF_ROLES & set(user.get("roles", []))
    if not allowed:
        raise HTTPException(status_code=403, detail="Access denied")
    for p in passengers:
        if not p.get("name"):
            raise HTTPException(status_code=400, detail="Each passenger needs a name")
    await db.vertical_bookings.update_one(
        {"id": booking_id},
        {"$set": {"passengers": passengers, "manifest_updated_at": _now().isoformat()}})
    return {"message": f"Manifest saved ({len(passengers)} passengers)"}


@router.post("/assets/{asset_id}/photos")
async def add_photos(asset_id: str, images: List[str] = Body(..., embed=True),
                     user: dict = Depends(get_current_user)):
    """Upload photos (base64 data URLs) — owner / Admin / CEO / Sales / Support"""
    db = get_database()
    asset = await db.vertical_assets.find_one({"id": asset_id}, {"_id": 0, "images": 1, "owner_user_id": 1})
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    if asset["owner_user_id"] != user["id"] and not PHOTO_ROLES & set(user.get("roles", [])):
        raise HTTPException(status_code=403, detail="Owner/Admin/Sales/Support access required")
    for img in images:
        if not img.startswith("data:image/"):
            raise HTTPException(status_code=400, detail="Only image data URLs allowed")
        if len(img) > 2_000_000:
            raise HTTPException(status_code=400, detail="Image too large (max ~1.5MB each)")
    existing = asset.get("images", [])
    if len(existing) + len(images) > 6:
        raise HTTPException(status_code=400, detail="Maximum 6 photos per asset")
    await db.vertical_assets.update_one({"id": asset_id}, {"$push": {"images": {"$each": images}}})
    return {"message": f"{len(images)} photo(s) uploaded", "total": len(existing) + len(images)}


@router.delete("/assets/{asset_id}/photos/{index}")
async def delete_photo(asset_id: str, index: int, user: dict = Depends(get_current_user)):
    db = get_database()
    asset = await db.vertical_assets.find_one({"id": asset_id}, {"_id": 0, "images": 1, "owner_user_id": 1})
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    if asset["owner_user_id"] != user["id"] and not PHOTO_ROLES & set(user.get("roles", [])):
        raise HTTPException(status_code=403, detail="Access denied")
    images = asset.get("images", [])
    if index < 0 or index >= len(images):
        raise HTTPException(status_code=404, detail="Photo not found")
    images.pop(index)
    await db.vertical_assets.update_one({"id": asset_id}, {"$set": {"images": images}})
    return {"message": "Photo deleted", "total": len(images)}


@router.get("/featured")
async def featured_assets(user: dict = Depends(get_current_user)):
    """Best-photographed assets + top aircraft for customer home page"""
    db = get_database()
    assets = await db.vertical_assets.find(
        {"status": "active"}, {"_id": 0, "id": 1, "vertical": 1, "name": 1, "city": 1,
                               "base_price": 1, "price_unit": 1, "images": 1}).to_list(200)
    assets.sort(key=lambda a: (-len(a.get("images", [])), a["id"]))
    deal_id = await _todays_deal_id(db)
    featured = []
    for a in assets[:6]:
        featured.append({"id": a["id"], "type": a["vertical"], "name": a["name"], "city": a["city"],
                         "price": a["base_price"], "unit": a["price_unit"],
                         "cover": (a.get("images") or [None])[0], "photo_count": len(a.get("images", []))})
    aircraft = await db.aircraft.find(
        {"is_available": True},
        {"_id": 0, "id": 1, "aircraft_type": 1, "registration_number": 1,
         "hourly_rate": 1, "capacity": 1, "base_location": 1}).sort("hourly_rate", -1).to_list(4)
    for a in aircraft:
        kind = "jet" if any(k in (a.get("aircraft_type") or "").lower() for k in ("citation", "hawker", "king air", "jet", "falcon", "gulfstream", "legacy", "phenom", "challenger", "global")) else "helicopter"
        featured.append({"id": a["id"], "type": kind,
                         "name": a.get("aircraft_type") or a.get("registration_number"),
                         "city": a.get("base_location") or f"{a.get('capacity') or '—'} seats",
                         "price": a.get("hourly_rate") or 0, "unit": "hour", "cover": None, "photo_count": 0})
    for i, item in enumerate(featured):
        if item["id"] == deal_id:
            item["deal_of_the_day"] = True
            item["deal_price"] = round(float(item["price"]) * 0.9)
            featured.insert(0, featured.pop(i))
            break
    return {"featured": featured}


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
