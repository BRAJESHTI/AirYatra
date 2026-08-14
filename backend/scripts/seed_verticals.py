import asyncio, os, uuid, sys
sys.path.insert(0, '/app/backend')
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
load_dotenv('/app/backend/.env')
from auth import get_password_hash
from datetime import datetime, timezone


async def main():
    db = AsyncIOMotorClient(os.environ['MONGO_URL'])[os.environ['DB_NAME']]
    now = datetime.now(timezone.utc).isoformat()
    users = [
        ("yachtowner@airyatra.co.in", "Yacht@123456", "yacht_owner", "Marina Yachts Pvt Ltd"),
        ("cruiseop@airyatra.co.in", "Cruise@123456", "cruise_operator", "BlueWave Cruises Ltd"),
        ("helipadowner@airyatra.co.in", "Helipad@123456", "helipad_owner", "SkyPad Helipads"),
    ]
    uids = {}
    for email, pwd, role, name in users:
        existing = await db.users.find_one({"email": email})
        if existing:
            await db.users.update_one({"email": email}, {"$set": {"roles": [role], "password_hash": get_password_hash(pwd), "is_active": True, "email_verified": True}})
            uids[role] = existing["id"]
        else:
            uid = str(uuid.uuid4())
            await db.users.insert_one({"id": uid, "email": email, "password_hash": get_password_hash(pwd),
                "full_name": name, "roles": [role], "is_active": True, "email_verified": True,
                "phone": "+919000000001", "created_at": now})
            uids[role] = uid
        print("seeded:", email, role)

    assets = [
        ("helipad", "Juhu Beach Helipad", "Mumbai", "Juhu Beach, Near Airport", 25000, "helipad_owner", "DGCA-approved rooftop helipad with night landing"),
        ("helipad", "Aravalli Hills Helipad", "Gurugram", "Sector 59, Aravalli Edge", 18000, "helipad_owner", "Corporate helipad with lounge"),
        ("yacht", "Ocean Pearl 55ft", "Goa", "Mandovi Marina", 15000, "yacht_owner", "Luxury 55ft yacht, 12 guests, crew included"),
        ("yacht", "Sea Breeze Catamaran", "Mumbai", "Gateway of India Jetty", 12000, "yacht_owner", "Catamaran for parties, 20 guests"),
        ("cruise", "BlueWave Explorer", "Kochi", "Kochi Port Terminal 2", 8500, "cruise_operator", "3-night Lakshadweep cruise, luxury cabins"),
        ("cruise", "Ganga Vilas Deluxe", "Varanasi", "Ravidas Ghat", 12500, "cruise_operator", "River cruise with heritage tours"),
    ]
    prefix = {"helipad": "HLP", "yacht": "YCT", "cruise": "CRZ"}
    unit = {"helipad": "landing", "yacht": "hour", "cruise": "cabin/night"}
    for v, name, city, loc, price, role, desc in assets:
        if await db.vertical_assets.find_one({"name": name}):
            continue
        count = await db.vertical_assets.count_documents({"vertical": v})
        owner = await db.users.find_one({"id": uids[role]}, {"full_name": 1})
        await db.vertical_assets.insert_one({
            "id": str(uuid.uuid4()), "asset_code": f"{prefix[v]}-{count+1:04d}", "vertical": v,
            "name": name, "city": city, "location": loc, "description": desc,
            "base_price": price, "price_unit": unit[v], "details": {}, "images": [],
            "owner_user_id": uids[role], "owner_name": owner.get("full_name"), "status": "active",
            "blocked_dates": [], "created_at": now})
        print("asset:", name)

asyncio.run(main())
