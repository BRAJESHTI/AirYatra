"""
Seed Data for Landing Infrastructure
Major Indian Airports, Helipads, and sample configurations
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone
from uuid import uuid4
import os

MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "airyatra_db")


# ============== MAJOR AIRPORTS ==============
AIRPORTS = [
    # Delhi NCR
    {"name": "Indira Gandhi International Airport", "icao_code": "VIDP", "city": "New Delhi", "district": "New Delhi", "state": "Delhi", "latitude": 28.5562, "longitude": 77.1000, "facilities": ["fuel", "atc", "customs", "cargo"]},
    {"name": "Hindon Air Force Station", "icao_code": "VIHN", "city": "Ghaziabad", "district": "Ghaziabad", "state": "Uttar Pradesh", "latitude": 28.7081, "longitude": 77.3590, "facilities": ["military", "vip"]},
    
    # Mumbai
    {"name": "Chhatrapati Shivaji Maharaj International Airport", "icao_code": "VABB", "city": "Mumbai", "district": "Mumbai", "state": "Maharashtra", "latitude": 19.0896, "longitude": 72.8656, "facilities": ["fuel", "atc", "customs", "cargo"]},
    {"name": "Juhu Aerodrome", "icao_code": "VAJJ", "city": "Mumbai", "district": "Mumbai", "state": "Maharashtra", "latitude": 19.0988, "longitude": 72.8347, "facilities": ["helicopter", "charter"]},
    
    # Bangalore
    {"name": "Kempegowda International Airport", "icao_code": "VOBL", "city": "Bengaluru", "district": "Bengaluru Urban", "state": "Karnataka", "latitude": 13.1986, "longitude": 77.7066, "facilities": ["fuel", "atc", "customs", "cargo"]},
    {"name": "HAL Airport", "icao_code": "VOBG", "city": "Bengaluru", "district": "Bengaluru Urban", "state": "Karnataka", "latitude": 12.9499, "longitude": 77.6681, "facilities": ["charter", "helicopter"]},
    
    # Chennai
    {"name": "Chennai International Airport", "icao_code": "VOMM", "city": "Chennai", "district": "Chennai", "state": "Tamil Nadu", "latitude": 12.9941, "longitude": 80.1709, "facilities": ["fuel", "atc", "customs", "cargo"]},
    
    # Kolkata
    {"name": "Netaji Subhas Chandra Bose International Airport", "icao_code": "VECC", "city": "Kolkata", "district": "Kolkata", "state": "West Bengal", "latitude": 22.6547, "longitude": 88.4467, "facilities": ["fuel", "atc", "customs", "cargo"]},
    
    # Hyderabad
    {"name": "Rajiv Gandhi International Airport", "icao_code": "VOHS", "city": "Hyderabad", "district": "Hyderabad", "state": "Telangana", "latitude": 17.2403, "longitude": 78.4294, "facilities": ["fuel", "atc", "customs", "cargo"]},
    {"name": "Begumpet Airport", "icao_code": "VOHY", "city": "Hyderabad", "district": "Hyderabad", "state": "Telangana", "latitude": 17.4531, "longitude": 78.4678, "facilities": ["charter", "helicopter"]},
    
    # Jaipur
    {"name": "Jaipur International Airport", "icao_code": "VIJP", "city": "Jaipur", "district": "Jaipur", "state": "Rajasthan", "latitude": 26.8242, "longitude": 75.8122, "facilities": ["fuel", "atc", "customs"]},
    
    # Ahmedabad
    {"name": "Sardar Vallabhbhai Patel International Airport", "icao_code": "VAAH", "city": "Ahmedabad", "district": "Ahmedabad", "state": "Gujarat", "latitude": 23.0772, "longitude": 72.6347, "facilities": ["fuel", "atc", "customs", "cargo"]},
    
    # Pune
    {"name": "Pune Airport", "icao_code": "VAPO", "city": "Pune", "district": "Pune", "state": "Maharashtra", "latitude": 18.5821, "longitude": 73.9197, "facilities": ["fuel", "atc", "charter"]},
    
    # Goa
    {"name": "Goa International Airport", "icao_code": "VAGO", "city": "Dabolim", "district": "South Goa", "state": "Goa", "latitude": 15.3808, "longitude": 73.8314, "facilities": ["fuel", "atc", "customs"]},
    {"name": "Manohar International Airport", "icao_code": "VOGA", "city": "Mopa", "district": "North Goa", "state": "Goa", "latitude": 15.7319, "longitude": 73.8314, "facilities": ["fuel", "atc", "customs"]},
    
    # Lucknow
    {"name": "Chaudhary Charan Singh International Airport", "icao_code": "VILK", "city": "Lucknow", "district": "Lucknow", "state": "Uttar Pradesh", "latitude": 26.7606, "longitude": 80.8893, "facilities": ["fuel", "atc", "customs"]},
    
    # Uttarakhand
    {"name": "Jolly Grant Airport", "icao_code": "VIDN", "city": "Dehradun", "district": "Dehradun", "state": "Uttarakhand", "latitude": 30.1897, "longitude": 78.1803, "facilities": ["fuel", "atc"]},
    
    # J&K
    {"name": "Srinagar International Airport", "icao_code": "VISR", "city": "Srinagar", "district": "Srinagar", "state": "Jammu & Kashmir", "latitude": 33.9871, "longitude": 74.7742, "facilities": ["fuel", "atc", "customs"]},
    {"name": "Jammu Airport", "icao_code": "VIJU", "city": "Jammu", "district": "Jammu", "state": "Jammu & Kashmir", "latitude": 32.6891, "longitude": 74.8378, "facilities": ["fuel", "atc"]},
    
    # Chandigarh
    {"name": "Chandigarh International Airport", "icao_code": "VICG", "city": "Chandigarh", "district": "Chandigarh", "state": "Chandigarh", "latitude": 30.6735, "longitude": 76.7885, "facilities": ["fuel", "atc", "customs"]},
    
    # Amritsar
    {"name": "Sri Guru Ram Dass Jee International Airport", "icao_code": "VIAR", "city": "Amritsar", "district": "Amritsar", "state": "Punjab", "latitude": 31.7096, "longitude": 74.7973, "facilities": ["fuel", "atc", "customs"]},
]


# ============== PILGRIMAGE HELIPADS ==============
PILGRIMAGE_HELIPADS = [
    # Uttarakhand - Char Dham
    {"name": "Kedarnath Helipad", "city": "Kedarnath", "district": "Rudraprayag", "state": "Uttarakhand", "latitude": 30.7346, "longitude": 79.0669, "category": "pilgrimage", "owner_type": "government"},
    {"name": "Badrinath Helipad", "city": "Badrinath", "district": "Chamoli", "state": "Uttarakhand", "latitude": 30.7433, "longitude": 79.4938, "category": "pilgrimage", "owner_type": "government"},
    {"name": "Yamunotri Helipad", "city": "Yamunotri", "district": "Uttarkashi", "state": "Uttarakhand", "latitude": 31.0140, "longitude": 78.4639, "category": "pilgrimage", "owner_type": "government"},
    {"name": "Gangotri Helipad", "city": "Gangotri", "district": "Uttarkashi", "state": "Uttarakhand", "latitude": 30.9945, "longitude": 78.9386, "category": "pilgrimage", "owner_type": "government"},
    {"name": "Phata Helipad", "city": "Phata", "district": "Rudraprayag", "state": "Uttarakhand", "latitude": 30.6058, "longitude": 79.0539, "category": "pilgrimage", "owner_type": "government"},
    {"name": "Guptkashi Helipad", "city": "Guptkashi", "district": "Rudraprayag", "state": "Uttarakhand", "latitude": 30.5303, "longitude": 79.0800, "category": "pilgrimage", "owner_type": "government"},
    {"name": "Sirsi Helipad (Kedarnath)", "city": "Sirsi", "district": "Rudraprayag", "state": "Uttarakhand", "latitude": 30.5500, "longitude": 79.0600, "category": "pilgrimage", "owner_type": "government"},
    
    # J&K - Vaishno Devi & Amarnath
    {"name": "Katra Helipad", "city": "Katra", "district": "Reasi", "state": "Jammu & Kashmir", "latitude": 32.9915, "longitude": 74.9318, "category": "pilgrimage", "owner_type": "government"},
    {"name": "Sanjichhat Helipad", "city": "Vaishno Devi", "district": "Reasi", "state": "Jammu & Kashmir", "latitude": 32.9854, "longitude": 74.9492, "category": "pilgrimage", "owner_type": "trust"},
    {"name": "Panchtarni Helipad (Amarnath)", "city": "Panchtarni", "district": "Anantnag", "state": "Jammu & Kashmir", "latitude": 34.2699, "longitude": 75.5030, "category": "pilgrimage", "owner_type": "government"},
    {"name": "Baltal Helipad", "city": "Baltal", "district": "Ganderbal", "state": "Jammu & Kashmir", "latitude": 34.3000, "longitude": 75.4000, "category": "pilgrimage", "owner_type": "government"},
    
    # Maharashtra - Shirdi
    {"name": "Shirdi Helipad", "city": "Shirdi", "district": "Ahmednagar", "state": "Maharashtra", "latitude": 19.7664, "longitude": 74.4800, "category": "pilgrimage", "owner_type": "trust"},
    
    # Andhra Pradesh - Tirupati
    {"name": "Tirupati Helipad", "city": "Tirupati", "district": "Tirupati", "state": "Andhra Pradesh", "latitude": 13.6288, "longitude": 79.4192, "category": "pilgrimage", "owner_type": "trust"},
    
    # Gujarat
    {"name": "Dwarka Helipad", "city": "Dwarka", "district": "Devbhoomi Dwarka", "state": "Gujarat", "latitude": 22.2442, "longitude": 68.9685, "category": "pilgrimage", "owner_type": "government"},
    {"name": "Somnath Helipad", "city": "Somnath", "district": "Gir Somnath", "state": "Gujarat", "latitude": 20.8880, "longitude": 70.4012, "category": "pilgrimage", "owner_type": "trust"},
    
    # Odisha
    {"name": "Puri Helipad", "city": "Puri", "district": "Puri", "state": "Odisha", "latitude": 19.8135, "longitude": 85.8312, "category": "pilgrimage", "owner_type": "government"},
]


# ============== HOSPITAL HELIPADS ==============
HOSPITAL_HELIPADS = [
    {"name": "AIIMS Trauma Centre Helipad", "city": "New Delhi", "district": "New Delhi", "state": "Delhi", "latitude": 28.5672, "longitude": 77.2100, "category": "hospital", "owner_type": "government"},
    {"name": "Medanta Hospital Helipad", "city": "Gurugram", "district": "Gurugram", "state": "Haryana", "latitude": 28.4400, "longitude": 77.0400, "category": "hospital", "owner_type": "private"},
    {"name": "Apollo Hospital Chennai Helipad", "city": "Chennai", "district": "Chennai", "state": "Tamil Nadu", "latitude": 13.0100, "longitude": 80.2000, "category": "hospital", "owner_type": "private"},
    {"name": "Kokilaben Hospital Helipad", "city": "Mumbai", "district": "Mumbai", "state": "Maharashtra", "latitude": 19.1300, "longitude": 72.8300, "category": "hospital", "owner_type": "private"},
    {"name": "Fortis Escorts Heart Institute Helipad", "city": "New Delhi", "district": "New Delhi", "state": "Delhi", "latitude": 28.5500, "longitude": 77.2200, "category": "hospital", "owner_type": "private"},
]


# ============== HOTEL / RESORT HELIPADS ==============
HOTEL_HELIPADS = [
    {"name": "Oberoi Udaivilas Helipad", "city": "Udaipur", "district": "Udaipur", "state": "Rajasthan", "latitude": 24.5758, "longitude": 73.6800, "category": "hotel_resort", "owner_type": "hotel"},
    {"name": "Taj Lake Palace Helipad", "city": "Udaipur", "district": "Udaipur", "state": "Rajasthan", "latitude": 24.5750, "longitude": 73.6800, "category": "hotel_resort", "owner_type": "hotel"},
    {"name": "Rambagh Palace Helipad", "city": "Jaipur", "district": "Jaipur", "state": "Rajasthan", "latitude": 26.8950, "longitude": 75.8060, "category": "hotel_resort", "owner_type": "hotel"},
    {"name": "Umaid Bhawan Palace Helipad", "city": "Jodhpur", "district": "Jodhpur", "state": "Rajasthan", "latitude": 26.2850, "longitude": 73.0500, "category": "hotel_resort", "owner_type": "hotel"},
    {"name": "Wildflower Hall Helipad", "city": "Shimla", "district": "Shimla", "state": "Himachal Pradesh", "latitude": 31.1050, "longitude": 77.1700, "category": "hotel_resort", "owner_type": "hotel"},
    {"name": "Ananda Spa Helipad", "city": "Rishikesh", "district": "Tehri Garhwal", "state": "Uttarakhand", "latitude": 30.1200, "longitude": 78.3200, "category": "hotel_resort", "owner_type": "hotel"},
]


# ============== CORPORATE HELIPADS ==============
CORPORATE_HELIPADS = [
    {"name": "Reliance Corporate Park Helipad", "city": "Navi Mumbai", "district": "Thane", "state": "Maharashtra", "latitude": 19.0600, "longitude": 73.0200, "category": "corporate", "owner_type": "corporate"},
    {"name": "Infosys Mysore Campus Helipad", "city": "Mysuru", "district": "Mysuru", "state": "Karnataka", "latitude": 12.2700, "longitude": 76.6400, "category": "corporate", "owner_type": "corporate"},
    {"name": "DLF Cyber City Helipad", "city": "Gurugram", "district": "Gurugram", "state": "Haryana", "latitude": 28.4950, "longitude": 77.0900, "category": "corporate", "owner_type": "corporate"},
]


# ============== GOVERNMENT HELIPADS ==============
GOVT_HELIPADS = [
    {"name": "Safdarjung Helipad", "city": "New Delhi", "district": "New Delhi", "state": "Delhi", "latitude": 28.5850, "longitude": 77.2050, "category": "state_government", "owner_type": "government"},
    {"name": "Raj Bhavan Mumbai Helipad", "city": "Mumbai", "district": "Mumbai", "state": "Maharashtra", "latitude": 18.9290, "longitude": 72.8280, "category": "state_government", "owner_type": "government"},
    {"name": "Raj Bhavan Kolkata Helipad", "city": "Kolkata", "district": "Kolkata", "state": "West Bengal", "latitude": 22.5530, "longitude": 88.3470, "category": "state_government", "owner_type": "government"},
    {"name": "Vidhana Soudha Helipad", "city": "Bengaluru", "district": "Bengaluru Urban", "state": "Karnataka", "latitude": 12.9790, "longitude": 77.5910, "category": "state_government", "owner_type": "government"},
]


def generate_code(point_type: str, state: str, city: str) -> str:
    """Generate unique code for landing point"""
    type_prefix = {
        "airport": "APT",
        "govt_helipad": "GHP",
        "private_helipad": "PHP",
        "village_land": "VLN"
    }
    prefix = type_prefix.get(point_type, "LND")
    state_code = state[:2].upper()
    city_code = city[:3].upper()
    random_suffix = str(uuid4())[:4].upper()
    return f"{prefix}-{state_code}-{city_code}-{random_suffix}"


async def seed_landing_data():
    """Seed all landing infrastructure data"""
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    print("🚁 Seeding Landing Infrastructure Data...")
    
    # Check if data already exists
    existing_count = await db.landing_points.count_documents({})
    if existing_count > 10:
        print(f"  ⚠️ {existing_count} landing points already exist. Skipping seed.")
        return
    
    now = datetime.now(timezone.utc).isoformat()
    
    # Seed Airports
    print("  ✈️ Seeding Airports...")
    for airport in AIRPORTS:
        landing_point = {
            "id": str(uuid4()),
            "code": generate_code("airport", airport["state"], airport["city"]),
            "name": airport["name"],
            "type": "airport",
            "owner_type": "government",
            "category": "airport",
            "city": airport["city"],
            "district": airport["district"],
            "state": airport["state"],
            "latitude": airport["latitude"],
            "longitude": airport["longitude"],
            "icao_code": airport.get("icao_code"),
            "facilities": airport.get("facilities", []),
            "permission_required": False,
            "rent_applicable": True,
            "availability_calendar_required": False,
            "is_active": True,
            "is_verified": True,
            "created_at": now,
            "updated_at": now
        }
        await db.landing_points.insert_one(landing_point)
    print(f"    ✅ {len(AIRPORTS)} airports seeded")
    
    # Seed Pilgrimage Helipads
    print("  🙏 Seeding Pilgrimage Helipads...")
    for helipad in PILGRIMAGE_HELIPADS:
        landing_point = {
            "id": str(uuid4()),
            "code": generate_code("govt_helipad", helipad["state"], helipad["city"]),
            "name": helipad["name"],
            "type": "govt_helipad",
            "owner_type": helipad["owner_type"],
            "category": helipad["category"],
            "city": helipad["city"],
            "district": helipad["district"],
            "state": helipad["state"],
            "latitude": helipad["latitude"],
            "longitude": helipad["longitude"],
            "permission_required": False,
            "rent_applicable": True,
            "availability_calendar_required": True,  # Pilgrimage helipads have seasonal availability
            "is_active": True,
            "is_verified": True,
            "created_at": now,
            "updated_at": now
        }
        await db.landing_points.insert_one(landing_point)
    print(f"    ✅ {len(PILGRIMAGE_HELIPADS)} pilgrimage helipads seeded")
    
    # Seed Hospital Helipads
    print("  🏥 Seeding Hospital Helipads...")
    for helipad in HOSPITAL_HELIPADS:
        landing_point = {
            "id": str(uuid4()),
            "code": generate_code("private_helipad" if helipad["owner_type"] == "private" else "govt_helipad", helipad["state"], helipad["city"]),
            "name": helipad["name"],
            "type": "private_helipad" if helipad["owner_type"] == "private" else "govt_helipad",
            "owner_type": helipad["owner_type"],
            "category": helipad["category"],
            "city": helipad["city"],
            "district": helipad["district"],
            "state": helipad["state"],
            "latitude": helipad["latitude"],
            "longitude": helipad["longitude"],
            "permission_required": False,  # Emergency helipads don't need permission
            "rent_applicable": helipad["owner_type"] == "private",
            "availability_calendar_required": False,  # Always available for emergencies
            "is_active": True,
            "is_verified": True,
            "created_at": now,
            "updated_at": now
        }
        await db.landing_points.insert_one(landing_point)
    print(f"    ✅ {len(HOSPITAL_HELIPADS)} hospital helipads seeded")
    
    # Seed Hotel Helipads
    print("  🏨 Seeding Hotel/Resort Helipads...")
    for helipad in HOTEL_HELIPADS:
        landing_point = {
            "id": str(uuid4()),
            "code": generate_code("private_helipad", helipad["state"], helipad["city"]),
            "name": helipad["name"],
            "type": "private_helipad",
            "owner_type": helipad["owner_type"],
            "category": helipad["category"],
            "city": helipad["city"],
            "district": helipad["district"],
            "state": helipad["state"],
            "latitude": helipad["latitude"],
            "longitude": helipad["longitude"],
            "permission_required": True,  # Need prior approval from hotel
            "rent_applicable": True,
            "availability_calendar_required": True,  # Managed by hotel
            "is_active": True,
            "is_verified": True,
            "created_at": now,
            "updated_at": now
        }
        await db.landing_points.insert_one(landing_point)
    print(f"    ✅ {len(HOTEL_HELIPADS)} hotel helipads seeded")
    
    # Seed Corporate Helipads
    print("  🏢 Seeding Corporate Helipads...")
    for helipad in CORPORATE_HELIPADS:
        landing_point = {
            "id": str(uuid4()),
            "code": generate_code("private_helipad", helipad["state"], helipad["city"]),
            "name": helipad["name"],
            "type": "private_helipad",
            "owner_type": helipad["owner_type"],
            "category": helipad["category"],
            "city": helipad["city"],
            "district": helipad["district"],
            "state": helipad["state"],
            "latitude": helipad["latitude"],
            "longitude": helipad["longitude"],
            "permission_required": True,
            "rent_applicable": True,
            "availability_calendar_required": True,
            "is_active": True,
            "is_verified": True,
            "created_at": now,
            "updated_at": now
        }
        await db.landing_points.insert_one(landing_point)
    print(f"    ✅ {len(CORPORATE_HELIPADS)} corporate helipads seeded")
    
    # Seed Government Helipads
    print("  🏛️ Seeding Government Helipads...")
    for helipad in GOVT_HELIPADS:
        landing_point = {
            "id": str(uuid4()),
            "code": generate_code("govt_helipad", helipad["state"], helipad["city"]),
            "name": helipad["name"],
            "type": "govt_helipad",
            "owner_type": helipad["owner_type"],
            "category": helipad["category"],
            "city": helipad["city"],
            "district": helipad["district"],
            "state": helipad["state"],
            "latitude": helipad["latitude"],
            "longitude": helipad["longitude"],
            "permission_required": True,  # Government helipads need clearance
            "rent_applicable": False,
            "availability_calendar_required": True,
            "is_active": True,
            "is_verified": True,
            "created_at": now,
            "updated_at": now
        }
        await db.landing_points.insert_one(landing_point)
    print(f"    ✅ {len(GOVT_HELIPADS)} government helipads seeded")
    
    # Seed sample rent configurations
    print("  💰 Seeding Sample Rent Configurations...")
    
    # Get some landing points
    landing_points = await db.landing_points.find(
        {"rent_applicable": True},
        {"_id": 0, "id": 1, "type": 1, "category": 1}
    ).limit(20).to_list(20)
    
    rent_configs_created = 0
    for point in landing_points:
        # Base rent varies by category
        base_rent = 5000  # Default
        if point.get("category") == "pilgrimage":
            base_rent = 3000
        elif point.get("category") == "hotel_resort":
            base_rent = 15000
        elif point.get("category") == "corporate":
            base_rent = 10000
        elif point.get("category") == "hospital":
            base_rent = 2000  # Lower for medical emergencies
        elif point.get("type") == "airport":
            base_rent = 8000
        
        rent_config = {
            "id": str(uuid4()),
            "landing_point_id": point["id"],
            "rent_type": "per_landing",
            "base_rent_amount": base_rent,
            "max_hours": 2,
            "parking_charge_per_hour": base_rent * 0.1,
            "gst_applicable": True,
            "gst_percentage": 18.0,
            "helicopter_rate": base_rent,
            "fixed_wing_rate": base_rent * 1.5,
            "peak_hours_multiplier": 1.2,
            "weekend_multiplier": 1.0,
            "is_active": True,
            "effective_from": now,
            "created_at": now
        }
        await db.landing_rent.insert_one(rent_config)
        rent_configs_created += 1
    
    print(f"    ✅ {rent_configs_created} rent configurations seeded")
    
    # Create indexes
    print("  📇 Creating indexes...")
    await db.landing_points.create_index([("type", 1)])
    await db.landing_points.create_index([("state", 1)])
    await db.landing_points.create_index([("city", 1)])
    await db.landing_points.create_index([("latitude", 1), ("longitude", 1)])
    await db.landing_points.create_index([("is_active", 1)])
    await db.helipad_availability.create_index([("landing_point_id", 1), ("date", 1)])
    await db.landing_rent.create_index([("landing_point_id", 1), ("is_active", 1)])
    await db.village_landing_permissions.create_index([("customer_id", 1)])
    await db.village_landing_permissions.create_index([("booking_id", 1)])
    await db.village_landing_permissions.create_index([("status", 1)])
    
    total_count = await db.landing_points.count_documents({})
    print(f"\n✅ Landing Infrastructure Seed Complete!")
    print(f"   Total Landing Points: {total_count}")
    print(f"   - Airports: {len(AIRPORTS)}")
    print(f"   - Pilgrimage Helipads: {len(PILGRIMAGE_HELIPADS)}")
    print(f"   - Hospital Helipads: {len(HOSPITAL_HELIPADS)}")
    print(f"   - Hotel Helipads: {len(HOTEL_HELIPADS)}")
    print(f"   - Corporate Helipads: {len(CORPORATE_HELIPADS)}")
    print(f"   - Government Helipads: {len(GOVT_HELIPADS)}")


if __name__ == "__main__":
    asyncio.run(seed_landing_data())
