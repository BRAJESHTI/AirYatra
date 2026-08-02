"""
Real-time Operations Map
Live map showing active flights, helipads, weather overlay
"""
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone, timedelta
from database import get_database
from middleware import get_current_user, require_roles
import random

router = APIRouter(prefix="/operations/map", tags=["Real-time Operations Map"])

# Major Indian helipad locations (coordinates)
HELIPAD_LOCATIONS = {
    "Mumbai": {"lat": 19.0760, "lng": 72.8777, "name": "Mumbai Heliport"},
    "Delhi": {"lat": 28.5561, "lng": 77.1000, "name": "Palam Helipad"},
    "Bangalore": {"lat": 12.9352, "lng": 77.6245, "name": "HAL Heliport"},
    "Chennai": {"lat": 13.0827, "lng": 80.2707, "name": "Chennai Helipad"},
    "Hyderabad": {"lat": 17.4399, "lng": 78.4983, "name": "Begumpet Helipad"},
    "Kolkata": {"lat": 22.6520, "lng": 88.4463, "name": "Kolkata Heliport"},
    "Pune": {"lat": 18.5821, "lng": 73.9197, "name": "Pune Helipad"},
    "Ahmedabad": {"lat": 23.0225, "lng": 72.5714, "name": "Ahmedabad Heliport"},
    "Goa": {"lat": 15.3800, "lng": 73.8310, "name": "Dabolim Helipad"},
    "Jaipur": {"lat": 26.8241, "lng": 75.8126, "name": "Jaipur Helipad"},
    "Srinagar": {"lat": 34.0837, "lng": 74.7973, "name": "Srinagar Heliport"},
    "Leh": {"lat": 34.1526, "lng": 77.5771, "name": "Leh Helipad"},
    "Shimla": {"lat": 31.1048, "lng": 77.1734, "name": "Shimla Helipad"},
    "Kedarnath": {"lat": 30.7352, "lng": 79.0669, "name": "Kedarnath Helipad"},
    "Vaishno_Devi": {"lat": 33.0305, "lng": 74.9490, "name": "Katra Helipad"}
}


@router.get("/live")
async def get_live_operations_map(
    current_user: dict = Depends(require_roles(["admin", "ceo", "operator"]))
):
    """
    Get real-time operations data for map display
    - Active/simulated flights
    - Helipad status
    - Weather conditions
    """
    db = get_database()
    
    now = datetime.now(timezone.utc)
    
    # ========== HELIPADS ==========
    helipads = []
    for city, coords in HELIPAD_LOCATIONS.items():
        # Check for active bookings at this location
        active_bookings = await db.customer_inquiries.count_documents({
            "$or": [
                {"from_location": {"$regex": city, "$options": "i"}},
                {"to_location": {"$regex": city, "$options": "i"}}
            ],
            "status": {"$in": ["accepted", "in_progress"]}
        })
        
        # Simulated weather (random for demo)
        weather_conditions = ["clear", "partly_cloudy", "cloudy", "light_rain", "fog"]
        weather_weights = [0.4, 0.25, 0.15, 0.1, 0.1]
        weather = random.choices(weather_conditions, weather_weights)[0]
        
        # Visibility based on weather
        visibility_map = {
            "clear": random.randint(8, 10),
            "partly_cloudy": random.randint(6, 9),
            "cloudy": random.randint(4, 7),
            "light_rain": random.randint(3, 5),
            "fog": random.randint(1, 3)
        }
        
        helipads.append({
            "id": city.lower(),
            "name": coords["name"],
            "city": city,
            "lat": coords["lat"],
            "lng": coords["lng"],
            "status": "operational" if weather not in ["fog", "heavy_rain"] else "limited",
            "active_flights": active_bookings,
            "weather": {
                "condition": weather,
                "temperature": random.randint(15, 38),
                "wind_speed": random.randint(5, 25),
                "visibility_km": visibility_map.get(weather, 5),
                "humidity": random.randint(40, 90)
            },
            "facilities": ["fuel", "parking", "maintenance"] if city in ["Mumbai", "Delhi", "Bangalore"] else ["parking"]
        })
    
    # ========== ACTIVE FLIGHTS (Simulated) ==========
    # Get today's bookings that could be "in progress"
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    
    active_bookings = await db.customer_inquiries.find({
        "status": {"$in": ["accepted", "in_progress", "confirmed"]},
        "travel_date": {"$regex": now.strftime("%Y-%m-%d")}
    }).to_list(50)
    
    active_flights = []
    for idx, booking in enumerate(active_bookings[:5]):  # Max 5 simulated flights
        from_city = booking.get("from_location", "Mumbai")
        to_city = booking.get("to_location", "Delhi")
        
        # Get coordinates
        from_coords = HELIPAD_LOCATIONS.get(from_city.split()[0].title(), HELIPAD_LOCATIONS["Mumbai"])
        to_coords = HELIPAD_LOCATIONS.get(to_city.split()[0].title(), HELIPAD_LOCATIONS["Delhi"])
        
        # Simulate current position (somewhere between origin and destination)
        progress = random.uniform(0.2, 0.8)
        current_lat = from_coords["lat"] + (to_coords["lat"] - from_coords["lat"]) * progress
        current_lng = from_coords["lng"] + (to_coords["lng"] - from_coords["lng"]) * progress
        
        active_flights.append({
            "flight_id": f"AY{random.randint(100, 999)}",
            "booking_id": booking.get("id"),
            "aircraft": booking.get("aircraft_registration", f"VT-{random.choice(['ABC', 'XYZ', 'PQR'])}{random.randint(1, 9)}"),
            "from": {
                "city": from_city,
                "lat": from_coords["lat"],
                "lng": from_coords["lng"]
            },
            "to": {
                "city": to_city,
                "lat": to_coords["lat"],
                "lng": to_coords["lng"]
            },
            "current_position": {
                "lat": round(current_lat, 4),
                "lng": round(current_lng, 4),
                "altitude_ft": random.randint(2000, 8000),
                "speed_knots": random.randint(100, 150),
                "heading": random.randint(0, 359)
            },
            "progress_percent": round(progress * 100),
            "eta_minutes": random.randint(15, 60),
            "status": "in_flight",
            "passengers": booking.get("passengers", 1)
        })
    
    # If no real bookings, add simulated flights for demo
    if not active_flights:
        demo_routes = [
            ("Mumbai", "Pune"),
            ("Delhi", "Jaipur"),
            ("Bangalore", "Chennai")
        ]
        for idx, (from_city, to_city) in enumerate(demo_routes):
            from_coords = HELIPAD_LOCATIONS[from_city]
            to_coords = HELIPAD_LOCATIONS[to_city]
            progress = random.uniform(0.3, 0.7)
            
            active_flights.append({
                "flight_id": f"AY{random.randint(100, 999)}",
                "booking_id": f"demo_{idx}",
                "aircraft": f"VT-AYR{idx + 1}",
                "from": {"city": from_city, "lat": from_coords["lat"], "lng": from_coords["lng"]},
                "to": {"city": to_city, "lat": to_coords["lat"], "lng": to_coords["lng"]},
                "current_position": {
                    "lat": round(from_coords["lat"] + (to_coords["lat"] - from_coords["lat"]) * progress, 4),
                    "lng": round(from_coords["lng"] + (to_coords["lng"] - from_coords["lng"]) * progress, 4),
                    "altitude_ft": random.randint(3000, 6000),
                    "speed_knots": random.randint(110, 140),
                    "heading": random.randint(0, 359)
                },
                "progress_percent": round(progress * 100),
                "eta_minutes": random.randint(20, 45),
                "status": "in_flight",
                "passengers": random.randint(1, 4),
                "is_demo": True
            })
    
    # ========== FLEET STATUS ==========
    fleet = await db.fleet.find({"status": "active"}, {"_id": 0}).to_list(100)
    
    fleet_status = {
        "total": len(fleet),
        "in_flight": len(active_flights),
        "available": len(fleet) - len(active_flights),
        "maintenance": await db.fleet.count_documents({"status": "maintenance"})
    }
    
    # ========== WEATHER ALERTS ==========
    weather_alerts = []
    for helipad in helipads:
        if helipad["weather"]["condition"] == "fog":
            weather_alerts.append({
                "location": helipad["city"],
                "type": "fog",
                "severity": "high",
                "message": f"Low visibility at {helipad['name']} - Operations limited"
            })
        elif helipad["weather"]["wind_speed"] > 20:
            weather_alerts.append({
                "location": helipad["city"],
                "type": "wind",
                "severity": "medium",
                "message": f"High winds at {helipad['name']} - Caution advised"
            })
    
    return {
        "helipads": helipads,
        "active_flights": active_flights,
        "fleet_status": fleet_status,
        "weather_alerts": weather_alerts,
        "map_center": {
            "lat": 22.5,  # Center of India
            "lng": 78.9
        },
        "last_updated": now.isoformat(),
        "refresh_interval_seconds": 30
    }


@router.get("/flight/{flight_id}")
async def get_flight_details(
    flight_id: str,
    current_user: dict = Depends(require_roles(["admin", "ceo", "operator"]))
):
    """Get detailed flight tracking info"""
    # In a real implementation, this would fetch from flight tracking API
    return {
        "flight_id": flight_id,
        "status": "in_flight",
        "track_history": [
            # Last 10 position updates
        ],
        "message": "Flight tracking details - Integration with real ADS-B data required"
    }


@router.get("/weather/{location}")
async def get_location_weather(
    location: str,
    current_user: dict = Depends(require_roles(["admin", "ceo", "operator"]))
):
    """Get detailed weather for a location"""
    coords = HELIPAD_LOCATIONS.get(location.title(), HELIPAD_LOCATIONS.get("Mumbai"))
    
    # Simulated weather data
    conditions = ["clear", "partly_cloudy", "cloudy", "light_rain"]
    current_condition = random.choice(conditions)
    
    return {
        "location": location,
        "coordinates": coords,
        "current": {
            "condition": current_condition,
            "temperature_c": random.randint(20, 35),
            "feels_like_c": random.randint(22, 38),
            "humidity_percent": random.randint(40, 80),
            "wind_speed_kmh": random.randint(5, 30),
            "wind_direction": random.choice(["N", "NE", "E", "SE", "S", "SW", "W", "NW"]),
            "visibility_km": random.randint(3, 10),
            "pressure_mb": random.randint(1005, 1025),
            "uv_index": random.randint(3, 11)
        },
        "forecast_3h": [
            {
                "time": (datetime.now(timezone.utc) + timedelta(hours=i*3)).strftime("%H:%M"),
                "condition": random.choice(conditions),
                "temperature_c": random.randint(20, 35)
            }
            for i in range(1, 5)
        ],
        "flight_conditions": {
            "vfr_suitable": current_condition in ["clear", "partly_cloudy"],
            "ifr_required": current_condition in ["cloudy", "light_rain", "fog"],
            "recommendation": "Good for VFR operations" if current_condition in ["clear", "partly_cloudy"] else "IFR conditions - Check NOTAMs"
        },
        "generated_at": datetime.now(timezone.utc).isoformat()
    }
