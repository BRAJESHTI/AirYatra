"""
Fixed Route Seeding Script - Delhi-Mumbai and Popular Routes
From Document [4] - Mode-1 Fixed Routes
"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from datetime import datetime, timezone, timedelta
from dotenv import load_dotenv
import uuid

load_dotenv()

MONGO_URL = os.environ.get("MONGO_URL")
DB_NAME = os.environ.get("DB_NAME", "airyatra_db")


async def seed_fixed_routes():
    """Seed popular fixed routes for instant booking"""
    
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    # Check if routes already exist
    existing_count = await db.fixed_routes.count_documents({})
    if existing_count > 0:
        print(f"[INFO] {existing_count} fixed routes already exist. Skipping seeding.")
        return
    
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    valid_until = (datetime.now(timezone.utc) + timedelta(days=365)).strftime("%Y-%m-%d")
    
    # Popular Indian Aviation Routes
    routes = [
        # Delhi - Mumbai (Most Popular)
        {
            "id": str(uuid.uuid4()),
            "route_code": "FXR-DEL-BOM-001",
            "route_name": "Delhi to Mumbai Express",
            "route_name_hi": "दिल्ली से मुंबई एक्सप्रेस",
            "origin": "Delhi (IGI Airport)",
            "origin_coordinates": {"lat": 28.5562, "lng": 77.1000},
            "destination": "Mumbai (Juhu)",
            "destination_coordinates": {"lat": 19.0989, "lng": 72.8347},
            "distance_km": 1148,
            "estimated_duration_minutes": 120,
            "base_price": 250000,
            "price_per_seat": 45000,
            "current_price": 250000,
            "min_passengers": 1,
            "max_passengers": 6,
            "demand_multiplier": 1.2,
            "seasonal_multiplier": 1.0,
            "time_multiplier": 1.0,
            "available_days": ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"],
            "departure_times": ["07:00", "10:00", "14:00", "18:00"],
            "advance_booking_hours": 24,
            "aircraft_type": "helicopter",
            "operator_id": None,
            "aircraft_ids": [],
            "seats_available": 6,
            "bookings_today": 0,
            "total_bookings": 0,
            "ferry_included": True,
            "ferry_charge_type": "included",
            "ferry_charge_value": 0,
            "status": "active",
            "valid_from": today,
            "valid_until": valid_until,
            "created_by": "system",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "popularity_score": 95,
            "average_rating": 4.8,
            "total_revenue": 0
        },
        # Mumbai - Delhi (Return)
        {
            "id": str(uuid.uuid4()),
            "route_code": "FXR-BOM-DEL-001",
            "route_name": "Mumbai to Delhi Express",
            "route_name_hi": "मुंबई से दिल्ली एक्सप्रेस",
            "origin": "Mumbai (Juhu)",
            "origin_coordinates": {"lat": 19.0989, "lng": 72.8347},
            "destination": "Delhi (IGI Airport)",
            "destination_coordinates": {"lat": 28.5562, "lng": 77.1000},
            "distance_km": 1148,
            "estimated_duration_minutes": 120,
            "base_price": 250000,
            "price_per_seat": 45000,
            "current_price": 250000,
            "min_passengers": 1,
            "max_passengers": 6,
            "demand_multiplier": 1.15,
            "seasonal_multiplier": 1.0,
            "time_multiplier": 1.0,
            "available_days": ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"],
            "departure_times": ["08:00", "11:00", "15:00", "19:00"],
            "advance_booking_hours": 24,
            "aircraft_type": "helicopter",
            "operator_id": None,
            "aircraft_ids": [],
            "seats_available": 6,
            "bookings_today": 0,
            "total_bookings": 0,
            "ferry_included": True,
            "ferry_charge_type": "included",
            "ferry_charge_value": 0,
            "status": "active",
            "valid_from": today,
            "valid_until": valid_until,
            "created_by": "system",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "popularity_score": 92,
            "average_rating": 4.7,
            "total_revenue": 0
        },
        # Delhi - Chandigarh (Short Route)
        {
            "id": str(uuid.uuid4()),
            "route_code": "FXR-DEL-CHD-001",
            "route_name": "Delhi to Chandigarh Shuttle",
            "route_name_hi": "दिल्ली से चंडीगढ़ शटल",
            "origin": "Delhi (Safdarjung)",
            "origin_coordinates": {"lat": 28.5844, "lng": 77.2079},
            "destination": "Chandigarh (Panchkula Helipad)",
            "destination_coordinates": {"lat": 30.6884, "lng": 76.8584},
            "distance_km": 245,
            "estimated_duration_minutes": 45,
            "base_price": 85000,
            "price_per_seat": 18000,
            "current_price": 85000,
            "min_passengers": 1,
            "max_passengers": 5,
            "demand_multiplier": 1.0,
            "seasonal_multiplier": 1.0,
            "time_multiplier": 1.0,
            "available_days": ["monday", "tuesday", "wednesday", "thursday", "friday"],
            "departure_times": ["08:00", "12:00", "17:00"],
            "advance_booking_hours": 12,
            "aircraft_type": "helicopter",
            "operator_id": None,
            "aircraft_ids": [],
            "seats_available": 5,
            "bookings_today": 0,
            "total_bookings": 0,
            "ferry_included": True,
            "ferry_charge_type": "included",
            "ferry_charge_value": 0,
            "status": "active",
            "valid_from": today,
            "valid_until": valid_until,
            "created_by": "system",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "popularity_score": 78,
            "average_rating": 4.6,
            "total_revenue": 0
        },
        # Mumbai - Pune (Short Route)
        {
            "id": str(uuid.uuid4()),
            "route_code": "FXR-BOM-PNQ-001",
            "route_name": "Mumbai to Pune Express",
            "route_name_hi": "मुंबई से पुणे एक्सप्रेस",
            "origin": "Mumbai (BKC Helipad)",
            "origin_coordinates": {"lat": 19.0607, "lng": 72.8656},
            "destination": "Pune (Kharadi)",
            "destination_coordinates": {"lat": 18.5554, "lng": 73.9465},
            "distance_km": 150,
            "estimated_duration_minutes": 35,
            "base_price": 65000,
            "price_per_seat": 14000,
            "current_price": 65000,
            "min_passengers": 1,
            "max_passengers": 6,
            "demand_multiplier": 1.3,
            "seasonal_multiplier": 1.0,
            "time_multiplier": 1.0,
            "available_days": ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday"],
            "departure_times": ["07:30", "09:30", "13:00", "16:00", "19:00"],
            "advance_booking_hours": 6,
            "aircraft_type": "helicopter",
            "operator_id": None,
            "aircraft_ids": [],
            "seats_available": 6,
            "bookings_today": 0,
            "total_bookings": 0,
            "ferry_included": True,
            "ferry_charge_type": "included",
            "ferry_charge_value": 0,
            "status": "active",
            "valid_from": today,
            "valid_until": valid_until,
            "created_by": "system",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "popularity_score": 88,
            "average_rating": 4.9,
            "total_revenue": 0
        },
        # Delhi - Jaipur (Tourism Route)
        {
            "id": str(uuid.uuid4()),
            "route_code": "FXR-DEL-JAI-001",
            "route_name": "Delhi to Jaipur Heritage",
            "route_name_hi": "दिल्ली से जयपुर हेरिटेज",
            "origin": "Delhi (Palam)",
            "origin_coordinates": {"lat": 28.5665, "lng": 77.1031},
            "destination": "Jaipur (Sanganer)",
            "destination_coordinates": {"lat": 26.8241, "lng": 75.8122},
            "distance_km": 268,
            "estimated_duration_minutes": 50,
            "base_price": 95000,
            "price_per_seat": 20000,
            "current_price": 95000,
            "min_passengers": 1,
            "max_passengers": 5,
            "demand_multiplier": 1.1,
            "seasonal_multiplier": 1.2,
            "time_multiplier": 1.0,
            "available_days": ["friday", "saturday", "sunday"],
            "departure_times": ["08:00", "11:00", "15:00"],
            "advance_booking_hours": 24,
            "aircraft_type": "helicopter",
            "operator_id": None,
            "aircraft_ids": [],
            "seats_available": 5,
            "bookings_today": 0,
            "total_bookings": 0,
            "ferry_included": True,
            "ferry_charge_type": "included",
            "ferry_charge_value": 0,
            "status": "active",
            "valid_from": today,
            "valid_until": valid_until,
            "created_by": "system",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "popularity_score": 82,
            "average_rating": 4.7,
            "total_revenue": 0
        },
        # Bangalore - Chennai (Business Route)
        {
            "id": str(uuid.uuid4()),
            "route_code": "FXR-BLR-MAA-001",
            "route_name": "Bangalore to Chennai Shuttle",
            "route_name_hi": "बेंगलुरु से चेन्नई शटल",
            "origin": "Bangalore (HAL Helipad)",
            "origin_coordinates": {"lat": 12.9499, "lng": 77.6686},
            "destination": "Chennai (Adyar)",
            "destination_coordinates": {"lat": 13.0067, "lng": 80.2565},
            "distance_km": 290,
            "estimated_duration_minutes": 55,
            "base_price": 110000,
            "price_per_seat": 22000,
            "current_price": 110000,
            "min_passengers": 1,
            "max_passengers": 6,
            "demand_multiplier": 1.15,
            "seasonal_multiplier": 1.0,
            "time_multiplier": 1.0,
            "available_days": ["monday", "tuesday", "wednesday", "thursday", "friday"],
            "departure_times": ["07:00", "10:00", "14:00", "18:00"],
            "advance_booking_hours": 12,
            "aircraft_type": "helicopter",
            "operator_id": None,
            "aircraft_ids": [],
            "seats_available": 6,
            "bookings_today": 0,
            "total_bookings": 0,
            "ferry_included": True,
            "ferry_charge_type": "included",
            "ferry_charge_value": 0,
            "status": "active",
            "valid_from": today,
            "valid_until": valid_until,
            "created_by": "system",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "popularity_score": 75,
            "average_rating": 4.5,
            "total_revenue": 0
        },
        # Kedarnath Pilgrimage (Seasonal High Demand)
        {
            "id": str(uuid.uuid4()),
            "route_code": "FXR-DHR-KED-001",
            "route_name": "Dehradun to Kedarnath Yatra",
            "route_name_hi": "देहरादून से केदारनाथ यात्रा",
            "origin": "Dehradun (Jolly Grant)",
            "origin_coordinates": {"lat": 30.1897, "lng": 78.1804},
            "destination": "Kedarnath (Helipad)",
            "destination_coordinates": {"lat": 30.7346, "lng": 79.0669},
            "distance_km": 95,
            "estimated_duration_minutes": 25,
            "base_price": 175000,
            "price_per_seat": 6500,
            "current_price": 175000,
            "min_passengers": 1,
            "max_passengers": 6,
            "demand_multiplier": 2.5,
            "seasonal_multiplier": 1.5,
            "time_multiplier": 1.0,
            "available_days": ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"],
            "departure_times": ["05:30", "06:30", "07:30", "08:30", "09:30", "10:30"],
            "advance_booking_hours": 48,
            "aircraft_type": "helicopter",
            "operator_id": None,
            "aircraft_ids": [],
            "seats_available": 6,
            "bookings_today": 0,
            "total_bookings": 0,
            "ferry_included": True,
            "ferry_charge_type": "included",
            "ferry_charge_value": 0,
            "status": "active",
            "valid_from": today,
            "valid_until": valid_until,
            "created_by": "system",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "popularity_score": 99,
            "average_rating": 4.9,
            "total_revenue": 0
        },
        # Hyderabad - Tirupati (Pilgrimage)
        {
            "id": str(uuid.uuid4()),
            "route_code": "FXR-HYD-TIR-001",
            "route_name": "Hyderabad to Tirupati Darshan",
            "route_name_hi": "हैदराबाद से तिरुपति दर्शन",
            "origin": "Hyderabad (Begumpet)",
            "origin_coordinates": {"lat": 17.4504, "lng": 78.4610},
            "destination": "Tirupati (SV Temple Helipad)",
            "destination_coordinates": {"lat": 13.6288, "lng": 79.4192},
            "distance_km": 510,
            "estimated_duration_minutes": 75,
            "base_price": 165000,
            "price_per_seat": 32000,
            "current_price": 165000,
            "min_passengers": 1,
            "max_passengers": 6,
            "demand_multiplier": 1.8,
            "seasonal_multiplier": 1.3,
            "time_multiplier": 1.0,
            "available_days": ["friday", "saturday", "sunday"],
            "departure_times": ["05:00", "07:00", "09:00"],
            "advance_booking_hours": 72,
            "aircraft_type": "helicopter",
            "operator_id": None,
            "aircraft_ids": [],
            "seats_available": 6,
            "bookings_today": 0,
            "total_bookings": 0,
            "ferry_included": True,
            "ferry_charge_type": "included",
            "ferry_charge_value": 0,
            "status": "active",
            "valid_from": today,
            "valid_until": valid_until,
            "created_by": "system",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "popularity_score": 90,
            "average_rating": 4.8,
            "total_revenue": 0
        }
    ]
    
    # Insert all routes
    result = await db.fixed_routes.insert_many(routes)
    
    print(f"[SUCCESS] Seeded {len(result.inserted_ids)} fixed routes!")
    print("\nRoutes seeded:")
    for route in routes:
        print(f"  - {route['route_code']}: {route['route_name']} ({route['distance_km']} km)")
    
    client.close()


if __name__ == "__main__":
    asyncio.run(seed_fixed_routes())
