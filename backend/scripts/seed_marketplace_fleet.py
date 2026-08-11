"""Seed marketplace fleet: 13 aircraft across 6 service categories (idempotent)"""
import asyncio
import os
import sys
import uuid
from datetime import datetime, timezone

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

from motor.motor_asyncio import AsyncIOMotorClient

CITIES = {
    "Mumbai": {"lat": 19.0989, "lng": 72.8347},
    "Delhi": {"lat": 28.5562, "lng": 77.1000},
    "Pune": {"lat": 18.5793, "lng": 73.9089},
    "Shirdi": {"lat": 19.6886, "lng": 74.3779},
    "Goa": {"lat": 15.3808, "lng": 73.8314},
}

FLEET = [
    # (model, category, reg, capacity, hourly, base_city, crew, pilot_hrs, rating, flights, wifi, oxygen, meals, baggage, speed, operator_name)
    ("Airbus H125", "helicopter", "VT-AYH", 5, 55000, "Mumbai", 0, 4200, 4.8, 640, False, True, False, 40, 220, "SkyLink Aviation"),
    ("Bell 407GXi", "helicopter", "VT-BLR", 6, 62000, "Pune", 1, 5100, 4.7, 512, True, True, False, 60, 246, "AirFleet Services"),
    ("Agusta AW109", "helicopter", "VT-AGW", 6, 78000, "Delhi", 1, 6800, 4.9, 890, True, True, True, 80, 285, "Prime Rotors India"),
    ("Robinson R44", "helicopter", "VT-RBN", 3, 32000, "Shirdi", 0, 2600, 4.4, 310, False, False, False, 20, 200, "Shirdi AirTours"),
    ("Cessna Citation XLS+", "chartered_plane", "VT-CXL", 9, 185000, "Mumbai", 2, 7500, 4.9, 1120, True, True, True, 250, 780, "JetSetGo Charters"),
    ("King Air B200", "chartered_plane", "VT-KAB", 8, 120000, "Delhi", 1, 6200, 4.6, 760, True, True, True, 180, 540, "IndoJet Aviation"),
    ("Hawker 800XP", "chartered_plane", "VT-HWK", 8, 165000, "Mumbai", 2, 8100, 4.8, 940, True, True, True, 220, 745, "SkyLink Aviation"),
    ("Bell 429 MedEvac", "air_ambulance", "VT-MED", 4, 95000, "Mumbai", 2, 5600, 4.9, 430, False, True, False, 30, 260, "LifeWing Air Ambulance"),
    ("King Air C90 ICU", "air_ambulance", "VT-ICU", 5, 135000, "Delhi", 2, 7100, 4.8, 380, True, True, False, 50, 450, "MedFly Rescue"),
    ("Sunseeker 76 Yacht", "yacht_cruiser", "IN-SY76", 20, 45000, "Mumbai", 4, 3800, 4.7, 265, True, False, True, 500, 32, "BlueWave Marine"),
    ("Azimut 55 Cruiser", "yacht_cruiser", "IN-AZ55", 14, 32000, "Goa", 3, 2900, 4.6, 198, True, False, True, 350, 35, "Goa Yacht Club"),
    ("Cessna 208 Caravan Cargo", "cargo", "VT-CGO", 2, 88000, "Mumbai", 0, 5900, 4.5, 540, False, False, False, 1200, 340, "CargoWings Logistics"),
    ("Bell 505 JetRanger X", "joy_ride", "VT-JOY", 4, 28000, "Mumbai", 0, 3100, 4.8, 1450, False, False, False, 15, 230, "Mumbai SkyRides"),
]

IMAGES = {
    "helicopter": "/services/helicopter.jpg",
    "chartered_plane": "/services/private_jet.jpg",
    "air_ambulance": "/services/air_ambulance.jpg",
    "yacht_cruiser": "/services/yacht_cruiser.jpg",
    "cargo": "/services/cargo.jpg",
    "joy_ride": "/services/joy_ride.jpg",
}

ENGINES = {
    "Airbus H125": ("single_engine", "Safran Arriel 2D Turboshaft"),
    "Bell 407GXi": ("single_engine", "Rolls-Royce M250-C47E/4"),
    "Agusta AW109": ("twin_engine", "Pratt & Whitney PW206C x2"),
    "Robinson R44": ("single_engine", "Lycoming IO-540 Piston"),
    "Cessna Citation XLS+": ("twin_engine", "PW545C Turbofan x2"),
    "King Air B200": ("twin_engine", "PT6A-42 Turboprop x2"),
    "Hawker 800XP": ("twin_engine", "Honeywell TFE731-5BR x2"),
    "Bell 429 MedEvac": ("twin_engine", "PW207D1 x2"),
    "King Air C90 ICU": ("twin_engine", "PT6A-21 Turboprop x2"),
    "Sunseeker 76 Yacht": ("twin_engine", "MAN V8-1300 Diesel x2"),
    "Azimut 55 Cruiser": ("twin_engine", "Volvo Penta IPS950 x2"),
    "Cessna 208 Caravan Cargo": ("single_engine", "PT6A-114A Turboprop"),
    "Bell 505 JetRanger X": ("single_engine", "Safran Arrius 2R Turboshaft"),
}


async def main():
    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    db = client[os.environ["DB_NAME"]]
    now = datetime.now(timezone.utc).isoformat()

    operators = await db.operators.find({}, {"_id": 0, "id": 1}).to_list(20)
    op_ids = [o["id"] for o in operators] or [str(uuid.uuid4())]

    await db.aircraft.delete_many({"marketplace_listed": True})

    docs = []
    for i, (model, cat, reg, cap, rate, city, crew, phrs, rating, flights, wifi, oxy, meals, bag, speed, op_name) in enumerate(FLEET):
        docs.append({
            "id": f"mkt-ac-{i+1:03d}",
            "operator_id": op_ids[i % len(op_ids)],
            "operator_name": op_name,
            "model_name": model,
            "aircraft_type": model,
            "service_category": cat,
            "registration_number": reg,
            "engine_type": ENGINES.get(model, ("single_engine", None))[0],
            "engine_model": ENGINES.get(model, (None, None))[1],
            "capacity": cap,
            "hourly_rate": float(rate),
            "base_location": city,
            "base_coordinates": {**CITIES[city], "city": city},
            "cruise_speed_kmh": speed,
            "cabin_crew": crew,
            "pilot_experience_hours": phrs,
            "rating": rating,
            "total_flights": flights,
            "amenities": {"wifi": wifi, "oxygen": oxy, "meals": meals, "baggage_kg": bag},
            "image": IMAGES[cat],
            "verified": True,
            "marketplace_listed": True,
            "is_available": True,
            "maintenance_status": "operational",
            "documents": [],
            "created_at": now,
            "updated_at": now,
        })
    await db.aircraft.insert_many(docs)

    # Engine settings: 20-min auction, ferry Rs.50/km
    await db.repositioning_engine.update_one(
        {"engine_id": "default_repositioning_engine"},
        {"$set": {"settings.default_auction_duration_minutes": 20,
                   "settings.ferry_rate_per_km": 50,
                   "settings.ferry_free_radius_km": 25,
                   "updated_at": now}},
        upsert=True,
    )

    print(f"Seeded {len(docs)} marketplace aircraft + engine settings (20-min auction, Rs.50/km ferry)")


asyncio.run(main())
