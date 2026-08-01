from fastapi import APIRouter, HTTPException, Depends, Query, UploadFile, File, BackgroundTasks
from fastapi.responses import Response
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, timezone
from uuid import uuid4
from database import get_database
from routes.auth_routes import get_current_user

router = APIRouter(prefix="/exchange", tags=["Aviation Exchange"])

IMG_BELL = "https://static.prod-images.emergentagent.com/jobs/7cbb201b-7d99-400c-9d07-153d4db9b2b4/images/d263bcf812cd8874b1cab66212ab282a0faff996cc45e9710836192a73b7102f.jpeg"
IMG_H125 = "https://static.prod-images.emergentagent.com/jobs/7cbb201b-7d99-400c-9d07-153d4db9b2b4/images/3564f65a20ca832971fc633523a3a1546532ff0a0dd5234235fc955009bd2ce2.jpeg"
IMG_JET = "https://static.prod-images.emergentagent.com/jobs/7cbb201b-7d99-400c-9d07-153d4db9b2b4/images/d315c93626d86a1e8bad12b3ffe48c01cd22997f268984a08510cf97045fb232.jpeg"
IMG_KINGAIR = "https://static.prod-images.emergentagent.com/jobs/7cbb201b-7d99-400c-9d07-153d4db9b2b4/images/b735769dc0f26f0e5d7a3941fe8a2329a60566638bc607c86bd478de4261eae7.jpeg"

SEED_LISTINGS = [
    {"id": "exl-bell407", "title": "Bell 407GXi", "manufacturer": "Bell", "model": "407GXi", "category": "helicopter", "year": 2019, "price_inr": 285000000, "flight_hours": 1250, "seats": 7, "location": "Mumbai, Maharashtra", "image": IMG_BELL, "seller_name": "SkyLine Aviation Pvt Ltd", "seller_type": "operator", "verified": True, "description": "Immaculately maintained Bell 407GXi with Garmin G1000H NXi avionics. Single owner, hangar-kept, full service records with Bell authorized center. Fresh 12-year inspection completed.", "features": ["Garmin G1000H NXi", "Air Conditioning", "Leather Interior", "Cargo Hook Provision", "Wire Strike Kit", "Full Records"]},
    {"id": "exl-h125", "title": "Airbus H125 (AS350 B3e)", "manufacturer": "Airbus", "model": "H125", "category": "helicopter", "year": 2021, "price_inr": 340000000, "flight_hours": 800, "seats": 6, "location": "Delhi NCR", "image": IMG_H125, "seller_name": "Himalayan Heli Services", "seller_type": "operator", "verified": True, "description": "Low-time H125 with high-altitude performance kit. Ideal for charter, pilgrimage and utility ops. DGCA registered, currently on active AOC with complete maintenance history.", "features": ["High Altitude Kit", "Dual Controls", "VEMD", "Sand Filters", "Cargo Swing", "Active AOC"]},
    {"id": "exl-r44", "title": "Robinson R44 Raven II", "manufacturer": "Robinson", "model": "R44 Raven II", "category": "helicopter", "year": 2017, "price_inr": 68000000, "flight_hours": 2100, "seats": 4, "location": "Bengaluru, Karnataka", "image": IMG_BELL, "seller_name": "Private Owner", "seller_type": "private", "verified": False, "description": "Well-maintained R44 Raven II, perfect entry-level helicopter for training or private use. Overhaul due in 100 hours - price negotiable considering overhaul cost.", "features": ["Hydraulic Controls", "Leather Seats", "Bubble Windows", "Garmin GTR 225"]},
    {"id": "exl-citation", "title": "Cessna Citation XLS+", "manufacturer": "Cessna", "model": "Citation XLS+", "category": "jet", "year": 2015, "price_inr": 520000000, "flight_hours": 3400, "seats": 9, "location": "Delhi NCR", "image": IMG_JET, "seller_name": "Rajputana Air Charters", "seller_type": "operator", "verified": True, "description": "Midsize jet with transcontinental range. ProParts & PowerAdvantage+ enrolled. Recently refurbished interior with 9-passenger executive configuration. NDT and Doc 8 complete.", "features": ["Collins Pro Line 21", "WiFi Connectivity", "Refurbished Interior 2023", "Engines on Program", "RVSM Certified", "Enclosed Lavatory"]},
    {"id": "exl-kingair", "title": "Beechcraft King Air 250", "manufacturer": "Beechcraft", "model": "King Air 250", "category": "turboprop", "year": 2018, "price_inr": 380000000, "flight_hours": 2650, "seats": 8, "location": "Hyderabad, Telangana", "image": IMG_KINGAIR, "seller_name": "Deccan AirWorks", "seller_type": "operator", "verified": True, "description": "Versatile King Air 250 with Pro Line Fusion avionics. Excellent short-field performance, ideal for regional charter and air ambulance conversion. Fresh Phase 1-4 inspections.", "features": ["Pro Line Fusion", "BLR Winglets", "Ram Air Recovery", "Air Ambulance Provision", "Fresh Inspections"]},
    {"id": "exl-aw109", "title": "AgustaWestland AW109 Power", "manufacturer": "Leonardo", "model": "AW109 Power", "category": "helicopter", "year": 2016, "price_inr": 220000000, "flight_hours": 1900, "seats": 7, "location": "Chennai, Tamil Nadu", "image": IMG_H125, "seller_name": "Private Owner", "seller_type": "private", "verified": False, "description": "Twin-engine AW109 Power with VIP interior. Twin-engine safety for corporate travel. Both engines mid-time, fully IFR equipped with weather radar.", "features": ["Twin Engine", "VIP Interior", "IFR Equipped", "Weather Radar", "Autopilot"]},
]


class ListingCreate(BaseModel):
    title: str
    manufacturer: str
    model: str
    category: str  # helicopter, jet, turboprop
    year: int
    price_inr: float
    flight_hours: int
    seats: int
    location: str
    description: str = ""
    features: List[str] = []
    image: Optional[str] = None
    enable_auction: bool = False
    auction_starting_bid_inr: Optional[float] = None
    auction_reserve_price_inr: Optional[float] = None


class InquiryCreate(BaseModel):
    message: str
    phone: Optional[str] = None


async def _ensure_seed(db):
    if await db.exchange_listings.count_documents({}) == 0:
        now = datetime.now(timezone.utc).isoformat()
        docs = [{**l, "status": "active", "views": 0, "created_at": now} for l in SEED_LISTINGS]
        await db.exchange_listings.insert_many(docs)


@router.get("/listings")
async def get_listings(
    category: Optional[str] = None,
    search: Optional[str] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    sort: str = "newest",
):
    """Public: browse active aircraft listings"""
    db = get_database()
    await _ensure_seed(db)
    
    query = {"status": "active"}
    if category and category != "all":
        query["category"] = category
    if search:
        query["$or"] = [
            {"title": {"$regex": search, "$options": "i"}},
            {"manufacturer": {"$regex": search, "$options": "i"}},
            {"location": {"$regex": search, "$options": "i"}},
        ]
    if min_price is not None or max_price is not None:
        price_q = {}
        if min_price is not None:
            price_q["$gte"] = min_price
        if max_price is not None:
            price_q["$lte"] = max_price
        query["price_inr"] = price_q
    
    sort_map = {"newest": [("created_at", -1)], "price_low": [("price_inr", 1)], "price_high": [("price_inr", -1)], "hours_low": [("flight_hours", 1)]}
    listings = await db.exchange_listings.find(query, {"_id": 0}).sort(sort_map.get(sort, sort_map["newest"])).to_list(100)
    
    return {"listings": listings, "total": len(listings)}


@router.get("/listings/{listing_id}")
async def get_listing_detail(listing_id: str):
    """Public: listing detail (increments views)"""
    db = get_database()
    listing = await db.exchange_listings.find_one({"id": listing_id}, {"_id": 0})
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    await db.exchange_listings.update_one({"id": listing_id}, {"$inc": {"views": 1}})
    return listing


@router.post("/listings")
async def create_listing(listing: ListingCreate, current_user: dict = Depends(get_current_user)):
    """Sell your aircraft: create a listing (goes to admin review)"""
    db = get_database()
    data = listing.dict()
    if not data.get("image"):
        defaults = {"helicopter": IMG_BELL, "jet": IMG_JET, "turboprop": IMG_KINGAIR}
        data["image"] = defaults.get(data.get("category"), IMG_BELL)
    doc = {
        "id": f"exl-{uuid4().hex[:8]}",
        **data,
        "seller_id": current_user["id"],
        "seller_name": current_user.get("full_name", "Private Seller"),
        "seller_type": "operator" if "operator" in current_user.get("roles", []) else "private",
        "verified": False,
        "status": "pending_review",
        "views": 0,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.exchange_listings.insert_one(dict(doc))
    return {"message": "Listing submitted for review. Our team will verify and publish it within 48 hours.", "listing_id": doc["id"]}


@router.post("/listings/{listing_id}/inquire")
async def inquire_listing(listing_id: str, inquiry: InquiryCreate, current_user: dict = Depends(get_current_user)):
    """Buyer inquiry on a listing"""
    db = get_database()
    listing = await db.exchange_listings.find_one({"id": listing_id}, {"_id": 0, "title": 1, "seller_name": 1})
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    
    await db.exchange_inquiries.insert_one({
        "id": str(uuid4()),
        "listing_id": listing_id,
        "listing_title": listing["title"],
        "buyer_id": current_user["id"],
        "buyer_name": current_user.get("full_name"),
        "buyer_email": current_user.get("email"),
        "buyer_phone": inquiry.phone,
        "message": inquiry.message,
        "status": "new",
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"message": "Inquiry sent! The seller's team will contact you within 24 hours."}


@router.post("/upload-image")
async def upload_listing_image(file: UploadFile = File(...), current_user: dict = Depends(get_current_user)):
    """Upload aircraft photo for a listing (object storage)"""
    if not (file.content_type or "").startswith("image/"):
        raise HTTPException(status_code=400, detail="Only image files allowed")
    content = await file.read()
    if len(content) > 8 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Image must be under 8MB")
    
    db = get_database()
    image_id = f"exi-{uuid4().hex}"
    ext = file.filename.split(".")[-1].lower() if "." in (file.filename or "") else "jpg"
    from services.storage_service import put_object
    stored = await put_object(f"airyatra/exchange/{image_id}.{ext}", content, file.content_type)
    
    await db.exchange_images.insert_one({
        "id": image_id,
        "storage_path": stored["path"],
        "content_type": file.content_type,
        "uploaded_by": current_user["id"],
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"image_url": f"/api/exchange/image/{image_id}"}


@router.get("/image/{image_id}")
async def serve_listing_image(image_id: str):
    """Public: serve listing image from object storage"""
    db = get_database()
    img = await db.exchange_images.find_one({"id": image_id}, {"_id": 0})
    if not img:
        raise HTTPException(status_code=404, detail="Image not found")
    from services.storage_service import get_object
    content, ct = await get_object(img["storage_path"])
    return Response(content=content, media_type=img.get("content_type") or ct, headers={"Cache-Control": "public, max-age=86400"})


@router.get("/admin/listings")
async def admin_get_listings(status: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    """Admin: all listings, pending first"""
    if "admin" not in current_user.get("roles", []):
        raise HTTPException(status_code=403, detail="Admin access required")
    db = get_database()
    query = {"status": status} if status else {}
    listings = await db.exchange_listings.find(query, {"_id": 0}).sort("created_at", -1).to_list(200)
    order = {"pending_review": 0, "active": 1, "sold": 2, "rejected": 3}
    listings.sort(key=lambda l: order.get(l.get("status"), 4))
    return {"listings": listings, "pending_count": sum(1 for l in listings if l.get("status") == "pending_review")}


@router.get("/admin/inquiries")
async def admin_get_inquiries(current_user: dict = Depends(get_current_user)):
    """Admin: all buyer inquiries"""
    if "admin" not in current_user.get("roles", []):
        raise HTTPException(status_code=403, detail="Admin access required")
    db = get_database()
    inquiries = await db.exchange_inquiries.find({}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return {"inquiries": inquiries, "new_count": sum(1 for i in inquiries if i.get("status") == "new")}


@router.patch("/admin/inquiries/{inquiry_id}/status")
async def update_inquiry_status(inquiry_id: str, status: str = Query(...), current_user: dict = Depends(get_current_user)):
    """Admin: mark inquiry contacted/closed"""
    if "admin" not in current_user.get("roles", []):
        raise HTTPException(status_code=403, detail="Admin access required")
    if status not in ["new", "contacted", "closed"]:
        raise HTTPException(status_code=400, detail="Invalid status")
    db = get_database()
    result = await db.exchange_inquiries.update_one({"id": inquiry_id}, {"$set": {"status": status}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Inquiry not found")
    return {"message": f"Inquiry marked {status}"}


async def _notify_seller(email: str, name: str, title: str, status: str):
    from services.email_service import email_service
    if status == "active":
        subject = f"🎉 Your listing '{title}' is now LIVE on AirYatra Exchange"
        body_line = "Great news! Your aircraft listing has been <b style='color:#16a34a;'>approved and published</b> on AirYatra Aviation Exchange. Buyers across India can now view your aircraft and send inquiries."
    else:
        subject = f"Update on your AirYatra Exchange listing '{title}'"
        body_line = "After review, we are unable to publish your listing at this time. Common reasons include incomplete documentation or unverifiable details. You may update the details and submit again, or contact our team for assistance."
    html = f"""
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#0f172a;color:#e2e8f0;border-radius:12px;overflow:hidden;">
      <div style="background:#f97316;padding:20px 28px;">
        <h2 style="margin:0;color:#fff;">AirYatra Aviation Exchange</h2>
      </div>
      <div style="padding:28px;">
        <p>Dear {name},</p>
        <p>{body_line}</p>
        <div style="background:#1e293b;border-radius:8px;padding:16px;margin:16px 0;">
          <p style="margin:0;"><b>Aircraft:</b> {title}</p>
          <p style="margin:8px 0 0;"><b>Status:</b> {'LIVE ✅' if status == 'active' else 'Not Approved ❌'}</p>
        </div>
        <p style="color:#94a3b8;font-size:13px;">Team AirYatra • India's First Aircraft Resale Marketplace</p>
      </div>
    </div>"""
    await email_service.send_email(to_email=email, subject=subject, html_body=html)


@router.patch("/admin/listings/{listing_id}/status")
async def update_listing_status(listing_id: str, background_tasks: BackgroundTasks, status: str = Query(...), current_user: dict = Depends(get_current_user)):
    """Admin: approve/reject/mark sold (emails seller on approve/reject)"""
    if "admin" not in current_user.get("roles", []):
        raise HTTPException(status_code=403, detail="Admin access required")
    if status not in ["active", "rejected", "sold", "pending_review"]:
        raise HTTPException(status_code=400, detail="Invalid status")
    db = get_database()
    listing = await db.exchange_listings.find_one({"id": listing_id}, {"_id": 0})
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    await db.exchange_listings.update_one({"id": listing_id}, {"$set": {"status": status, "verified": status == "active"}})
    if status == "active" and listing.get("enable_auction") and listing.get("auction_starting_bid_inr"):
        if not await db.exchange_auctions.find_one({"listing_id": listing_id, "status": "live"}):
            starting = listing["auction_starting_bid_inr"]
            reserve = listing.get("auction_reserve_price_inr") or starting
            await _create_auction(db, listing, {
                "starting_bid_inr": starting,
                "reserve_price_inr": reserve,
                "min_increment_inr": max(100000.0, starting * 0.01),
                "duration_hours": 72,
            })
    if status in ("active", "rejected") and listing.get("seller_id"):
        seller = await db.users.find_one({"id": listing["seller_id"]}, {"_id": 0, "email": 1, "full_name": 1})
        if seller and seller.get("email"):
            background_tasks.add_task(_notify_seller, seller["email"], seller.get("full_name", "Seller"), listing["title"], status)
    return {"message": f"Listing marked {status}"}


@router.patch("/admin/listings/{listing_id}/feature")
async def toggle_listing_feature(listing_id: str, featured: bool = Query(...), current_user: dict = Depends(get_current_user)):
    """Admin: mark/unmark listing as featured spotlight"""
    if "admin" not in current_user.get("roles", []):
        raise HTTPException(status_code=403, detail="Admin access required")
    db = get_database()
    result = await db.exchange_listings.update_one({"id": listing_id}, {"$set": {"featured": featured}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Listing not found")
    return {"message": "Listing featured" if featured else "Listing unfeatured"}


@router.get("/featured")
async def get_featured_listings():
    """Public: featured spotlight listings"""
    db = get_database()
    await _ensure_seed(db)
    listings = await db.exchange_listings.find({"status": "active", "featured": True}, {"_id": 0}).sort("created_at", -1).to_list(6)
    return {"listings": listings}


@router.get("/my-listings")
async def get_my_listings(current_user: dict = Depends(get_current_user)):
    """Seller: own listings with views & inquiries"""
    db = get_database()
    listings = await db.exchange_listings.find({"seller_id": current_user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)
    ids = [l["id"] for l in listings]
    inquiries = await db.exchange_inquiries.find({"listing_id": {"$in": ids}}, {"_id": 0}).sort("created_at", -1).to_list(500) if ids else []
    inq_map = {}
    for i in inquiries:
        inq_map.setdefault(i["listing_id"], []).append(i)
    for l in listings:
        l["inquiries"] = inq_map.get(l["id"], [])
    return {
        "listings": listings,
        "total_views": sum(l.get("views", 0) for l in listings),
        "total_inquiries": len(inquiries),
    }


# ============ Fractional Ownership ============

FRACTIONAL_SEED = [
    {"id": "frx-h145", "title": "Airbus H145 VIP", "manufacturer": "Airbus", "model": "H145", "category": "helicopter", "year": 2022, "image": IMG_H125, "location": "Mumbai, Maharashtra", "total_value_inr": 720000000, "total_shares": 8, "share_price_inr": 90000000, "shares_available": 5, "hours_per_share": 100, "description": "Twin-engine VIP helicopter fully managed by AirYatra. Each 1/8 share includes 100 flying hours/year with crew, hangarage and maintenance handled end-to-end.", "highlights": ["Fully Managed", "100 hrs/year per share", "Crew Included", "Zero Maintenance Hassle"]},
    {"id": "frx-pc12", "title": "Pilatus PC-12 NGX", "manufacturer": "Pilatus", "model": "PC-12 NGX", "category": "turboprop", "year": 2023, "image": IMG_KINGAIR, "location": "Delhi NCR", "total_value_inr": 420000000, "total_shares": 4, "share_price_inr": 105000000, "shares_available": 2, "hours_per_share": 200, "description": "Versatile single-engine turboprop with executive interior. 1/4 share gives 200 flying hours/year — ideal for corporate travel across India with short-strip capability.", "highlights": ["1/4 Ownership", "200 hrs/year per share", "Executive Interior", "Pan-India Range"]},
    {"id": "frx-phenom", "title": "Embraer Phenom 300E", "manufacturer": "Embraer", "model": "Phenom 300E", "category": "jet", "year": 2022, "image": IMG_JET, "location": "Bengaluru, Karnataka", "total_value_inr": 880000000, "total_shares": 8, "share_price_inr": 110000000, "shares_available": 6, "hours_per_share": 90, "description": "World's best-selling light jet. 1/8 share includes 90 jet hours/year, dedicated crew, and guaranteed availability with 48-hour booking notice.", "highlights": ["Light Jet", "90 hrs/year per share", "48hr Booking Guarantee", "Dedicated Crew"]},
]


async def _ensure_fractional_seed(db):
    if await db.exchange_fractional.count_documents({}) == 0:
        now = datetime.now(timezone.utc).isoformat()
        await db.exchange_fractional.insert_many([{**f, "status": "active", "created_at": now} for f in FRACTIONAL_SEED])


class FractionalReserve(BaseModel):
    shares: int = Field(ge=1, le=8)
    phone: Optional[str] = None
    message: str = ""


@router.get("/fractional")
async def get_fractional_offerings():
    """Public: fractional ownership offerings"""
    db = get_database()
    await _ensure_fractional_seed(db)
    offerings = await db.exchange_fractional.find({"status": "active"}, {"_id": 0}).sort("created_at", -1).to_list(50)
    return {"offerings": offerings}


@router.post("/fractional/{fractional_id}/reserve")
async def reserve_fractional_share(fractional_id: str, req: FractionalReserve, current_user: dict = Depends(get_current_user)):
    """Investor: expression of interest to reserve shares (no payment yet)"""
    db = get_database()
    offering = await db.exchange_fractional.find_one({"id": fractional_id}, {"_id": 0})
    if not offering:
        raise HTTPException(status_code=404, detail="Offering not found")
    if req.shares > offering.get("shares_available", 0):
        raise HTTPException(status_code=400, detail=f"Only {offering.get('shares_available', 0)} share(s) available")
    await db.exchange_fractional_reservations.insert_one({
        "id": str(uuid4()),
        "fractional_id": fractional_id,
        "title": offering["title"],
        "shares": req.shares,
        "share_price_inr": offering["share_price_inr"],
        "investor_id": current_user["id"],
        "investor_name": current_user.get("full_name"),
        "investor_email": current_user.get("email"),
        "investor_phone": req.phone,
        "message": req.message,
        "status": "new",
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"message": "Share reservation received! Our investment desk will contact you within 24 hours to complete the allocation."}


@router.get("/admin/fractional-reservations")
async def admin_get_fractional_reservations(current_user: dict = Depends(get_current_user)):
    """Admin: all fractional share reservations + offerings summary"""
    if "admin" not in current_user.get("roles", []):
        raise HTTPException(status_code=403, detail="Admin access required")
    db = get_database()
    await _ensure_fractional_seed(db)
    reservations = await db.exchange_fractional_reservations.find({}, {"_id": 0}).sort("created_at", -1).to_list(200)
    offerings = await db.exchange_fractional.find({}, {"_id": 0}).to_list(50)
    return {"reservations": reservations, "offerings": offerings, "new_count": sum(1 for r in reservations if r.get("status") == "new")}


@router.patch("/admin/fractional-reservations/{reservation_id}/status")
async def update_fractional_reservation(reservation_id: str, status: str = Query(...), current_user: dict = Depends(get_current_user)):
    """Admin: approve (allocates shares) / reject / mark contacted"""
    if "admin" not in current_user.get("roles", []):
        raise HTTPException(status_code=403, detail="Admin access required")
    if status not in ["new", "contacted", "approved", "rejected"]:
        raise HTTPException(status_code=400, detail="Invalid status")
    db = get_database()
    res = await db.exchange_fractional_reservations.find_one({"id": reservation_id}, {"_id": 0})
    if not res:
        raise HTTPException(status_code=404, detail="Reservation not found")
    if res.get("status") == "approved" and status == "approved":
        raise HTTPException(status_code=400, detail="Already approved")
    if status == "approved":
        r = await db.exchange_fractional.update_one(
            {"id": res["fractional_id"], "shares_available": {"$gte": res["shares"]}},
            {"$inc": {"shares_available": -res["shares"]}},
        )
        if r.matched_count == 0:
            raise HTTPException(status_code=400, detail="Not enough shares available to allocate")
    await db.exchange_fractional_reservations.update_one({"id": reservation_id}, {"$set": {"status": status}})
    return {"message": f"Reservation marked {status}"}


# ============ Aircraft Auctions ============

class AuctionCreate(BaseModel):
    starting_bid_inr: float
    reserve_price_inr: float
    min_increment_inr: float = 500000
    duration_hours: int = 72


class BidCreate(BaseModel):
    amount_inr: float


def _mask_name(name):
    if not name:
        return "Anonymous"
    parts = name.split()
    return f"{parts[0]} {parts[-1][0]}." if len(parts) > 1 else parts[0]


async def _create_auction(db, listing, cfg: dict):
    now = datetime.now(timezone.utc)
    ends = datetime.fromtimestamp(now.timestamp() + cfg["duration_hours"] * 3600, tz=timezone.utc)
    auction = {
        "id": f"auc-{uuid4().hex[:8]}",
        "listing_id": listing["id"],
        "title": listing["title"], "image": listing.get("image"), "category": listing.get("category"),
        "location": listing.get("location"), "year": listing.get("year"),
        "flight_hours": listing.get("flight_hours"), "seats": listing.get("seats"),
        "seller_name": listing.get("seller_name"),
        "starting_bid_inr": cfg["starting_bid_inr"],
        "reserve_price_inr": cfg["reserve_price_inr"],
        "min_increment_inr": cfg["min_increment_inr"],
        "current_bid_inr": 0, "bid_count": 0,
        "highest_bidder_id": None, "highest_bidder_name": None,
        "starts_at": now.isoformat(), "ends_at": ends.isoformat(),
        "status": "live", "result": None,
        "created_at": now.isoformat(),
    }
    await db.exchange_auctions.insert_one(dict(auction))
    await db.exchange_listings.update_one({"id": listing["id"]}, {"$set": {"status": "in_auction"}})
    return auction


async def _notify_winner(email: str, name: str, title: str, winning_bid: float):
    from services.email_service import email_service
    html = f"""
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#0f172a;color:#e2e8f0;border-radius:12px;overflow:hidden;">
      <div style="background:#16a34a;padding:20px 28px;"><h2 style="margin:0;color:#fff;">🏆 Congratulations — You Won the Auction!</h2></div>
      <div style="padding:28px;">
        <p>Dear {name},</p>
        <p>Your bid was the highest and the reserve was met — <b>{title}</b> is yours! / बधाई हो, नीलामी आपने जीत ली!</p>
        <div style="background:#1e293b;border-radius:8px;padding:16px;margin:16px 0;">
          <p style="margin:0;"><b>Winning Bid:</b> <span style="color:#f97316;font-size:20px;">Rs. {winning_bid:,.0f}</span></p>
        </div>
        <h3 style="color:#f97316;margin-bottom:8px;">📋 Next Steps Checklist</h3>
        <ol style="line-height:1.9;padding-left:20px;margin-top:0;">
          <li><b>Welcome Call</b> — Our aviation desk will call you within 24 hours to kick off the process</li>
          <li><b>Sale Agreement & Documents</b> — Verification of registration, airworthiness certificate and maintenance logs</li>
          <li><b>Secure Payment Coordination</b> — Our team will guide you through the escrow & payment process</li>
          <li><b>Pre-Delivery Inspection</b> — Final inspection at the aircraft's base with your engineer</li>
          <li><b>DGCA Ownership Transfer & Handover</b> — We handle the paperwork, you take the keys ✈️</li>
        </ol>
        <p style="margin-top:16px;">Keep this email handy — quote your auction win when our team calls.</p>
        <p style="color:#94a3b8;font-size:13px;">Team AirYatra • India's First Aircraft Auction Platform</p>
      </div>
    </div>"""
    await email_service.send_email(to_email=email, subject=f"🏆 You WON the auction — {title}! Next steps inside", html_body=html)


async def _finalize_if_due(db, auction):
    if auction.get("status") != "live":
        return auction
    if datetime.fromisoformat(auction["ends_at"]) > datetime.now(timezone.utc):
        return auction
    if auction.get("highest_bidder_id"):
        result = "sold" if auction["current_bid_inr"] >= auction["reserve_price_inr"] else "reserve_not_met"
    else:
        result = "no_bids"
    r = await db.exchange_auctions.update_one({"id": auction["id"], "status": "live"}, {"$set": {"status": "ended", "result": result}})
    await db.exchange_listings.update_one({"id": auction["listing_id"]}, {"$set": {"status": "sold" if result == "sold" else "active"}})
    if r.modified_count == 1 and result == "sold":
        winner = await db.users.find_one({"id": auction["highest_bidder_id"]}, {"_id": 0, "email": 1, "full_name": 1})
        if winner and winner.get("email"):
            import asyncio
            asyncio.create_task(_notify_winner(winner["email"], winner.get("full_name", "Winner"), auction["title"], auction["current_bid_inr"]))
    auction["status"] = "ended"
    auction["result"] = result
    return auction


def _public_auction(a):
    a = dict(a)
    reserve = a.pop("reserve_price_inr", 0)
    a["reserve_met"] = bool(a.get("bid_count", 0) > 0 and a.get("current_bid_inr", 0) >= reserve)
    a.pop("highest_bidder_id", None)
    if a.get("highest_bidder_name"):
        a["highest_bidder_name"] = _mask_name(a["highest_bidder_name"])
    return a


@router.get("/auctions")
async def get_auctions():
    """Public: live & recently ended auctions"""
    db = get_database()
    auctions = await db.exchange_auctions.find({}, {"_id": 0}).sort("ends_at", 1).to_list(100)
    out = []
    for a in auctions:
        a = await _finalize_if_due(db, a)
        out.append(_public_auction(a))
    live = [a for a in out if a["status"] == "live"]
    ended = sorted([a for a in out if a["status"] == "ended"], key=lambda x: x["ends_at"], reverse=True)[:10]
    counts = {}
    async for c in db.exchange_watchlist.aggregate([{"$group": {"_id": "$auction_id", "count": {"$sum": 1}}}]):
        counts[c["_id"]] = c["count"]
    for a in live:
        a["watchers"] = counts.get(a["id"], 0)
    return {"live": live, "ended": ended, "server_time": datetime.now(timezone.utc).isoformat()}


async def _notify_outbid(email: str, name: str, title: str, new_bid: float, ends_at: str):
    from services.email_service import email_service
    try:
        ends = datetime.fromisoformat(ends_at).strftime("%d %b %Y, %I:%M %p UTC")
    except Exception:
        ends = ends_at
    html = f"""
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#0f172a;color:#e2e8f0;border-radius:12px;overflow:hidden;">
      <div style="background:#dc2626;padding:20px 28px;"><h2 style="margin:0;color:#fff;">⚡ You've Been Outbid!</h2></div>
      <div style="padding:28px;">
        <p>Dear {name},</p>
        <p>Someone just placed a higher bid on <b>{title}</b> in the AirYatra Aviation Exchange auction.</p>
        <div style="background:#1e293b;border-radius:8px;padding:16px;margin:16px 0;">
          <p style="margin:0;"><b>New Highest Bid:</b> <span style="color:#f97316;font-size:18px;">Rs. {new_bid:,.0f}</span></p>
          <p style="margin:8px 0 0;"><b>Auction Ends:</b> {ends}</p>
        </div>
        <p><b>Don't lose this aircraft!</b> Head back to the auction and place a higher bid before time runs out. / समय खत्म होने से पहले ऊंची बोली लगाएं!</p>
        <p style="color:#94a3b8;font-size:13px;">Team AirYatra • Live Aircraft Auctions</p>
      </div>
    </div>"""
    await email_service.send_email(to_email=email, subject=f"⚡ Outbid Alert — {title} (Act fast!)", html_body=html)


@router.post("/auctions/{auction_id}/bid")
async def place_bid(auction_id: str, bid: BidCreate, background_tasks: BackgroundTasks, current_user: dict = Depends(get_current_user)):
    """Place a bid on a live auction (emails previous highest bidder)"""
    db = get_database()
    auction = await db.exchange_auctions.find_one({"id": auction_id}, {"_id": 0})
    if not auction:
        raise HTTPException(status_code=404, detail="Auction not found")
    auction = await _finalize_if_due(db, auction)
    if auction["status"] != "live":
        raise HTTPException(status_code=400, detail="Auction has ended")
    min_next = (auction["current_bid_inr"] + auction["min_increment_inr"]) if auction["bid_count"] > 0 else auction["starting_bid_inr"]
    if bid.amount_inr < min_next:
        raise HTTPException(status_code=400, detail=f"Minimum bid is ₹{min_next:,.0f}")
    prev_bidder_id = auction.get("highest_bidder_id")
    r = await db.exchange_auctions.update_one(
        {"id": auction_id, "status": "live", "current_bid_inr": {"$lt": bid.amount_inr}},
        {"$set": {"current_bid_inr": bid.amount_inr, "highest_bidder_id": current_user["id"], "highest_bidder_name": current_user.get("full_name")}, "$inc": {"bid_count": 1}},
    )
    if r.modified_count == 0:
        raise HTTPException(status_code=409, detail="You were outbid — refresh and place a higher bid")
    await db.exchange_bids.insert_one({
        "id": str(uuid4()), "auction_id": auction_id,
        "bidder_id": current_user["id"], "bidder_name": current_user.get("full_name"),
        "amount_inr": bid.amount_inr, "created_at": datetime.now(timezone.utc).isoformat(),
    })
    if prev_bidder_id and prev_bidder_id != current_user["id"]:
        prev = await db.users.find_one({"id": prev_bidder_id}, {"_id": 0, "email": 1, "full_name": 1})
        if prev and prev.get("email"):
            background_tasks.add_task(_notify_outbid, prev["email"], prev.get("full_name", "Bidder"), auction["title"], bid.amount_inr, auction["ends_at"])
    return {"message": "Bid placed! You are the highest bidder.", "current_bid_inr": bid.amount_inr}


@router.get("/auctions/{auction_id}/bids")
async def get_bid_history(auction_id: str):
    """Public: bid history (masked names)"""
    db = get_database()
    bids = await db.exchange_bids.find({"auction_id": auction_id}, {"_id": 0, "bidder_id": 0}).sort("created_at", -1).to_list(50)
    for b in bids:
        b["bidder_name"] = _mask_name(b.get("bidder_name"))
    return {"bids": bids}


@router.post("/admin/listings/{listing_id}/start-auction")
async def start_auction(listing_id: str, cfg: AuctionCreate, current_user: dict = Depends(get_current_user)):
    """Admin: start a timed auction on an active listing"""
    if "admin" not in current_user.get("roles", []):
        raise HTTPException(status_code=403, detail="Admin access required")
    db = get_database()
    listing = await db.exchange_listings.find_one({"id": listing_id}, {"_id": 0})
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    if listing["status"] != "active":
        raise HTTPException(status_code=400, detail="Only active listings can be auctioned")
    if await db.exchange_auctions.find_one({"listing_id": listing_id, "status": "live"}):
        raise HTTPException(status_code=400, detail="An auction is already live for this listing")
    auction = await _create_auction(db, listing, cfg.dict())
    return {"message": f"Auction started — ends in {cfg.duration_hours} hours", "auction_id": auction["id"]}


@router.get("/admin/auctions")
async def admin_get_auctions(current_user: dict = Depends(get_current_user)):
    """Admin: all auctions with full details"""
    if "admin" not in current_user.get("roles", []):
        raise HTTPException(status_code=403, detail="Admin access required")
    db = get_database()
    auctions = await db.exchange_auctions.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)
    auctions = [await _finalize_if_due(db, a) for a in auctions]
    return {"auctions": auctions, "live_count": sum(1 for a in auctions if a["status"] == "live")}


@router.post("/admin/auctions/{auction_id}/end")
async def end_auction_now(auction_id: str, current_user: dict = Depends(get_current_user)):
    """Admin: end a live auction immediately"""
    if "admin" not in current_user.get("roles", []):
        raise HTTPException(status_code=403, detail="Admin access required")
    db = get_database()
    auction = await db.exchange_auctions.find_one({"id": auction_id}, {"_id": 0})
    if not auction:
        raise HTTPException(status_code=404, detail="Auction not found")
    if auction["status"] != "live":
        raise HTTPException(status_code=400, detail="Auction is not live")
    now_iso = datetime.now(timezone.utc).isoformat()
    await db.exchange_auctions.update_one({"id": auction_id}, {"$set": {"ends_at": now_iso}})
    auction["ends_at"] = now_iso
    auction = await _finalize_if_due(db, auction)
    return {"message": f"Auction ended — result: {auction['result'].replace('_', ' ')}"}


# ============ Inspection Booking ============

class InspectionCreate(BaseModel):
    preferred_date: str
    time_slot: str
    phone: str
    notes: str = ""


@router.post("/listings/{listing_id}/book-inspection")
async def book_inspection(listing_id: str, req: InspectionCreate, current_user: dict = Depends(get_current_user)):
    """Buyer: request a pre-purchase inspection slot"""
    db = get_database()
    listing = await db.exchange_listings.find_one({"id": listing_id}, {"_id": 0, "title": 1, "location": 1})
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    await db.exchange_inspections.insert_one({
        "id": str(uuid4()),
        "listing_id": listing_id,
        "listing_title": listing["title"],
        "location": listing.get("location"),
        "buyer_id": current_user["id"],
        "buyer_name": current_user.get("full_name"),
        "buyer_email": current_user.get("email"),
        "buyer_phone": req.phone,
        "preferred_date": req.preferred_date,
        "time_slot": req.time_slot,
        "notes": req.notes,
        "status": "requested",
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"message": "Inspection request received! Our team will confirm your slot within 24 hours."}


async def _notify_inspection(email: str, name: str, title: str, date: str, slot: str, location: str, status: str):
    from services.email_service import email_service
    if status == "confirmed":
        subject = f"✅ Inspection Confirmed — {title}"
        body_line = f"Your pre-purchase inspection is <b style='color:#16a34a;'>confirmed</b> for <b>{date} ({slot})</b> at {location}. Our aviation expert will accompany you. Please carry a government photo ID."
    else:
        subject = f"Inspection Update — {title}"
        body_line = f"Unfortunately your inspection request for {date} ({slot}) has been cancelled. Please book another slot from the listing page or contact our team."
    html = f"""
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#0f172a;color:#e2e8f0;border-radius:12px;overflow:hidden;">
      <div style="background:#f97316;padding:20px 28px;"><h2 style="margin:0;color:#fff;">AirYatra Aviation Exchange</h2></div>
      <div style="padding:28px;">
        <p>Dear {name},</p>
        <p>{body_line}</p>
        <p style="color:#94a3b8;font-size:13px;">Team AirYatra • India's First Aircraft Resale Marketplace</p>
      </div>
    </div>"""
    await email_service.send_email(to_email=email, subject=subject, html_body=html)


@router.get("/admin/inspections")
async def admin_get_inspections(current_user: dict = Depends(get_current_user)):
    """Admin: all inspection requests"""
    if "admin" not in current_user.get("roles", []):
        raise HTTPException(status_code=403, detail="Admin access required")
    db = get_database()
    inspections = await db.exchange_inspections.find({}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return {"inspections": inspections, "requested_count": sum(1 for i in inspections if i.get("status") == "requested")}


@router.patch("/admin/inspections/{inspection_id}/status")
async def update_inspection_status(inspection_id: str, background_tasks: BackgroundTasks, status: str = Query(...), current_user: dict = Depends(get_current_user)):
    """Admin: confirm/complete/cancel inspection (emails buyer on confirm/cancel)"""
    if "admin" not in current_user.get("roles", []):
        raise HTTPException(status_code=403, detail="Admin access required")
    if status not in ["requested", "confirmed", "completed", "cancelled"]:
        raise HTTPException(status_code=400, detail="Invalid status")
    db = get_database()
    insp = await db.exchange_inspections.find_one({"id": inspection_id}, {"_id": 0})
    if not insp:
        raise HTTPException(status_code=404, detail="Inspection not found")
    await db.exchange_inspections.update_one({"id": inspection_id}, {"$set": {"status": status}})
    if status in ("confirmed", "cancelled") and insp.get("buyer_email"):
        background_tasks.add_task(_notify_inspection, insp["buyer_email"], insp.get("buyer_name", "Buyer"), insp["listing_title"], insp["preferred_date"], insp["time_slot"], insp.get("location", "the aircraft location"), status)
    return {"message": f"Inspection marked {status}"}


# ============ Ownership Certificates ============

@router.get("/fractional/my-reservations")
async def get_my_reservations(current_user: dict = Depends(get_current_user)):
    """Investor: own share reservations"""
    db = get_database()
    reservations = await db.exchange_fractional_reservations.find({"investor_id": current_user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)
    offerings = {o["id"]: o for o in await db.exchange_fractional.find({}, {"_id": 0}).to_list(50)}
    for r in reservations:
        o = offerings.get(r["fractional_id"], {})
        r["total_shares"] = o.get("total_shares")
        r["aircraft_image"] = o.get("image")
        r["hours_per_share"] = o.get("hours_per_share")
    return {"reservations": reservations}


def _generate_certificate(res: dict, offering: dict) -> bytes:
    from io import BytesIO
    from reportlab.lib.pagesizes import landscape, A4
    from reportlab.lib.units import mm
    from reportlab.lib.colors import HexColor
    from reportlab.pdfgen import canvas

    buf = BytesIO()
    c = canvas.Canvas(buf, pagesize=landscape(A4))
    w, h = landscape(A4)
    cert_no = f"AY-FRX-{res['id'][:8].upper()}"
    issue_date = datetime.now(timezone.utc).strftime("%d %B %Y")
    total_shares = offering.get("total_shares", 8)
    amount = res["share_price_inr"] * res["shares"]

    c.setFillColor(HexColor("#0f172a"))
    c.rect(0, 0, w, h, fill=1, stroke=0)
    c.setStrokeColor(HexColor("#f97316"))
    c.setLineWidth(3)
    c.rect(10 * mm, 10 * mm, w - 20 * mm, h - 20 * mm)
    c.setLineWidth(0.8)
    c.rect(13 * mm, 13 * mm, w - 26 * mm, h - 26 * mm)

    c.setFillColor(HexColor("#f97316"))
    c.setFont("Helvetica-Bold", 28)
    c.drawCentredString(w / 2, h - 35 * mm, "AIRYATRA AVIATION EXCHANGE")
    c.setFillColor(HexColor("#e2e8f0"))
    c.setFont("Helvetica", 15)
    c.drawCentredString(w / 2, h - 45 * mm, "CERTIFICATE OF FRACTIONAL AIRCRAFT OWNERSHIP")
    c.setStrokeColor(HexColor("#f97316"))
    c.setLineWidth(1)
    c.line(w / 2 - 60 * mm, h - 49 * mm, w / 2 + 60 * mm, h - 49 * mm)

    c.setFillColor(HexColor("#94a3b8"))
    c.setFont("Helvetica", 12)
    c.drawCentredString(w / 2, h - 62 * mm, "This is to certify that")
    c.setFillColor(HexColor("#ffffff"))
    c.setFont("Helvetica-Bold", 24)
    c.drawCentredString(w / 2, h - 73 * mm, res.get("investor_name") or "Investor")
    c.setFillColor(HexColor("#94a3b8"))
    c.setFont("Helvetica", 12)
    c.drawCentredString(w / 2, h - 83 * mm, "is the registered owner of")
    c.setFillColor(HexColor("#f97316"))
    c.setFont("Helvetica-Bold", 18)
    c.drawCentredString(w / 2, h - 94 * mm, f"{res['shares']} Share(s) of 1/{total_shares} each  •  {res['title']}")

    c.setFillColor(HexColor("#e2e8f0"))
    c.setFont("Helvetica", 12)
    details = [
        f"Investment Value: Rs. {amount:,.0f}",
        f"Flying Entitlement: {offering.get('hours_per_share', 0) * res['shares']} hours/year",
        f"Aircraft Base: {offering.get('location', 'India')}",
    ]
    y = h - 108 * mm
    for d in details:
        c.drawCentredString(w / 2, y, d)
        y -= 8 * mm

    c.setFont("Helvetica", 10)
    c.setFillColor(HexColor("#94a3b8"))
    c.drawString(22 * mm, 25 * mm, f"Certificate No: {cert_no}")
    c.drawString(22 * mm, 19 * mm, f"Date of Issue: {issue_date}")
    c.setStrokeColor(HexColor("#94a3b8"))
    c.setLineWidth(0.5)
    c.line(w - 90 * mm, 27 * mm, w - 22 * mm, 27 * mm)
    c.drawString(w - 90 * mm, 21 * mm, "Authorised Signatory, AirYatra")
    c.setFont("Helvetica-Oblique", 8)
    c.drawCentredString(w / 2, 15 * mm, "Subject to the Fractional Ownership Agreement. Managed by AirYatra Aviation Pvt Ltd.")

    c.save()
    return buf.getvalue()


@router.get("/fractional/certificate/{reservation_id}")
async def download_certificate(reservation_id: str, current_user: dict = Depends(get_current_user)):
    """Investor: download share certificate PDF (approved reservations only)"""
    db = get_database()
    res = await db.exchange_fractional_reservations.find_one({"id": reservation_id}, {"_id": 0})
    if not res:
        raise HTTPException(status_code=404, detail="Reservation not found")
    if res["investor_id"] != current_user["id"] and "admin" not in current_user.get("roles", []):
        raise HTTPException(status_code=403, detail="Access denied")
    if res.get("status") != "approved":
        raise HTTPException(status_code=400, detail="Certificate is available only after your allocation is approved")
    offering = await db.exchange_fractional.find_one({"id": res["fractional_id"]}, {"_id": 0}) or {}
    pdf = _generate_certificate(res, offering)
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="AirYatra_Share_Certificate_{res["id"][:8].upper()}.pdf"'},
    )


# ============ Auction Watchlist ============

@router.post("/auctions/{auction_id}/watch")
async def toggle_watch_auction(auction_id: str, current_user: dict = Depends(get_current_user)):
    """Toggle watchlist on an auction — watchers get ending-soon reminder emails"""
    db = get_database()
    auction = await db.exchange_auctions.find_one({"id": auction_id}, {"_id": 0, "id": 1, "title": 1, "status": 1})
    if not auction:
        raise HTTPException(status_code=404, detail="Auction not found")
    existing = await db.exchange_watchlist.find_one({"auction_id": auction_id, "user_id": current_user["id"]}, {"_id": 0})
    if existing:
        await db.exchange_watchlist.delete_one({"id": existing["id"]})
        return {"watching": False, "message": "Removed from watchlist"}
    if auction["status"] != "live":
        raise HTTPException(status_code=400, detail="Auction has ended")
    await db.exchange_watchlist.insert_one({
        "id": str(uuid4()),
        "auction_id": auction_id,
        "auction_title": auction["title"],
        "user_id": current_user["id"],
        "user_name": current_user.get("full_name"),
        "user_email": current_user.get("email"),
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"watching": True, "message": "Watching! We'll email you before this auction ends / नीलामी खत्म होने से पहले याद दिलाएंगे"}


@router.get("/auctions/watchlist/my")
async def get_my_watchlist(current_user: dict = Depends(get_current_user)):
    """Auction ids the current user is watching"""
    db = get_database()
    items = await db.exchange_watchlist.find({"user_id": current_user["id"]}, {"_id": 0, "auction_id": 1}).to_list(200)
    return {"auction_ids": [i["auction_id"] for i in items]}


@router.get("/auctions/watchlist/details")
async def get_my_watchlist_details(current_user: dict = Depends(get_current_user)):
    """Full auction data for the current user's watchlist"""
    db = get_database()
    items = await db.exchange_watchlist.find({"user_id": current_user["id"]}, {"_id": 0, "auction_id": 1, "created_at": 1}).sort("created_at", -1).to_list(200)
    ids = [i["auction_id"] for i in items]
    auctions = await db.exchange_auctions.find({"id": {"$in": ids}}, {"_id": 0}).to_list(200) if ids else []
    counts = {}
    async for c in db.exchange_watchlist.aggregate([{"$group": {"_id": "$auction_id", "count": {"$sum": 1}}}]):
        counts[c["_id"]] = c["count"]
    out = []
    for a in auctions:
        a = await _finalize_if_due(db, a)
        pa = _public_auction(a)
        pa["is_highest_bidder"] = a.get("highest_bidder_id") == current_user["id"]
        pa["watchers"] = counts.get(a["id"], 0)
        out.append(pa)
    order = {aid: idx for idx, aid in enumerate(ids)}
    out.sort(key=lambda x: order.get(x["id"], 999))
    return {"auctions": out}
