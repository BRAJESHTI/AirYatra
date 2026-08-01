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
    if status in ("active", "rejected") and listing.get("seller_id"):
        seller = await db.users.find_one({"id": listing["seller_id"]}, {"_id": 0, "email": 1, "full_name": 1})
        if seller and seller.get("email"):
            background_tasks.add_task(_notify_seller, seller["email"], seller.get("full_name", "Seller"), listing["title"], status)
    return {"message": f"Listing marked {status}"}
