"""
AI Pricing Advisor Routes
Route-based pricing suggestions using AI and historical data
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone, timedelta
from bson import ObjectId
from database import get_database

router = APIRouter(prefix="/ai-pricing", tags=["ai-pricing"])

# Popular routes with base pricing (INR)
ROUTE_BASE_PRICING = {
    "mumbai-pune": {"helicopter": 85000, "jet": 250000, "distance_km": 150},
    "pune-mumbai": {"helicopter": 85000, "jet": 250000, "distance_km": 150},
    "delhi-jaipur": {"helicopter": 95000, "jet": 280000, "distance_km": 280},
    "mumbai-shirdi": {"helicopter": 75000, "jet": 220000, "distance_km": 240},
    "bangalore-mysore": {"helicopter": 65000, "jet": 200000, "distance_km": 150},
    "chennai-tirupati": {"helicopter": 70000, "jet": 210000, "distance_km": 140},
    "delhi-agra": {"helicopter": 80000, "jet": 240000, "distance_km": 230},
    "mumbai-goa": {"helicopter": 150000, "jet": 400000, "distance_km": 580},
    "delhi-chandigarh": {"helicopter": 90000, "jet": 260000, "distance_km": 260},
    "hyderabad-vijayawada": {"helicopter": 85000, "jet": 250000, "distance_km": 275},
}

# Seasonal multipliers
SEASONAL_MULTIPLIERS = {
    "wedding_season": 1.25,
    "monsoon": 0.85,
    "peak_summer": 1.10,
    "festival": 1.30,
    "off_peak": 0.90,
}

# Demand multipliers
DEMAND_MULTIPLIERS = {
    "very_high": 1.35,
    "high": 1.20,
    "normal": 1.00,
    "low": 0.85,
    "very_low": 0.75,
}

class PricingRequest(BaseModel):
    origin: str
    destination: str
    aircraft_type: str = "helicopter"
    passengers: int = 1
    date: Optional[str] = None
    is_round_trip: bool = False
    special_requirements: Optional[List[str]] = []

def get_route_key(origin: str, destination: str) -> str:
    return f"{origin.lower().strip()}-{destination.lower().strip()}"

def get_season(date_str: str = None) -> str:
    if date_str:
        try:
            date = datetime.strptime(date_str, "%Y-%m-%d")
        except:
            date = datetime.now()
    else:
        date = datetime.now()
    
    month = date.month
    
    if month in [10, 11, 12, 1, 2]:
        return "wedding_season"
    elif month in [6, 7, 8, 9]:
        return "monsoon"
    elif month in [4, 5]:
        return "peak_summer"
    else:
        return "off_peak"

async def calculate_demand_level(db, route_key: str, date_str: str = None) -> str:
    """Calculate demand based on historical bookings"""
    thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)
    
    parts = route_key.split("-")
    if len(parts) != 2:
        return "normal"
    
    origin, destination = parts
    
    booking_count = await db.bookings.count_documents({
        "origin": {"$regex": origin, "$options": "i"},
        "destination": {"$regex": destination, "$options": "i"},
        "created_at": {"$gte": thirty_days_ago}
    })
    
    if booking_count >= 20:
        return "very_high"
    elif booking_count >= 10:
        return "high"
    elif booking_count >= 5:
        return "normal"
    elif booking_count >= 2:
        return "low"
    else:
        return "very_low"

@router.post("/suggest")
async def get_pricing_suggestion(request: PricingRequest):
    db = get_database()
    
    route_key = get_route_key(request.origin, request.destination)
    factors = []
    recommendations = []
    
    # Get base price
    if route_key in ROUTE_BASE_PRICING:
        base_data = ROUTE_BASE_PRICING[route_key]
        base_price = base_data.get(request.aircraft_type, base_data.get("helicopter", 100000))
        distance_km = base_data.get("distance_km", 200)
        factors.append({
            "name": "Route Base Price",
            "description": f"Standard pricing for {request.origin} → {request.destination}",
            "multiplier": 1.0,
            "impact": "base"
        })
    else:
        rate_per_km = 500 if request.aircraft_type == "helicopter" else 800
        estimated_distance = 250
        base_price = rate_per_km * estimated_distance
        distance_km = estimated_distance
        factors.append({
            "name": "Estimated Distance Pricing",
            "description": f"Route not in database, estimated at ₹{rate_per_km}/km",
            "multiplier": 1.0,
            "impact": "base"
        })
        recommendations.append("This route is not frequently booked. Consider adding it to popular routes for better pricing data.")
    
    current_price = base_price
    
    # Apply seasonal multiplier
    season = get_season(request.date)
    seasonal_mult = SEASONAL_MULTIPLIERS.get(season, 1.0)
    current_price *= seasonal_mult
    factors.append({
        "name": "Seasonal Factor",
        "description": f"{season.replace('_', ' ').title()} season adjustment",
        "multiplier": seasonal_mult,
        "impact": "+" if seasonal_mult > 1 else "-" if seasonal_mult < 1 else "neutral"
    })
    
    # Apply demand multiplier
    demand_level = await calculate_demand_level(db, route_key, request.date)
    demand_mult = DEMAND_MULTIPLIERS.get(demand_level, 1.0)
    current_price *= demand_mult
    factors.append({
        "name": "Demand Factor",
        "description": f"Current demand is {demand_level.replace('_', ' ')}",
        "multiplier": demand_mult,
        "impact": "+" if demand_mult > 1 else "-" if demand_mult < 1 else "neutral"
    })
    
    # Passenger adjustment (group discount)
    if request.passengers >= 6:
        passenger_mult = 0.92
        factors.append({
            "name": "Group Discount",
            "description": f"8% discount for {request.passengers} passengers",
            "multiplier": passenger_mult,
            "impact": "-"
        })
        current_price *= passenger_mult
    elif request.passengers >= 4:
        passenger_mult = 0.95
        factors.append({
            "name": "Group Discount",
            "description": f"5% discount for {request.passengers} passengers",
            "multiplier": passenger_mult,
            "impact": "-"
        })
        current_price *= passenger_mult
    
    # Round trip discount
    if request.is_round_trip:
        round_trip_mult = 1.85
        factors.append({
            "name": "Round Trip Discount",
            "description": "7.5% discount on total for round trip",
            "multiplier": round_trip_mult,
            "impact": "-"
        })
        current_price *= round_trip_mult
    
    # Special requirements surcharge
    if request.special_requirements:
        for req in request.special_requirements:
            if req.lower() in ["vip", "vvip"]:
                current_price *= 1.15
                factors.append({
                    "name": "VIP Service",
                    "description": "Premium VIP services included",
                    "multiplier": 1.15,
                    "impact": "+"
                })
            elif req.lower() in ["medical", "emergency"]:
                current_price *= 1.20
                factors.append({
                    "name": "Medical/Emergency",
                    "description": "Medical equipment and priority handling",
                    "multiplier": 1.20,
                    "impact": "+"
                })
    
    # Calculate confidence based on data availability
    confidence = 0.85 if route_key in ROUTE_BASE_PRICING else 0.65
    
    # Generate recommendations
    if seasonal_mult > 1.1:
        recommendations.append(f"Consider booking during off-peak season for better rates.")
    if demand_level in ["very_high", "high"]:
        recommendations.append(f"This route has high demand. Book early to secure availability.")
    if not request.is_round_trip:
        recommendations.append("Round trip bookings offer 7.5% savings on total fare.")
    
    # Historical average (if available)
    historical_bookings = await db.bookings.find({
        "origin": {"$regex": request.origin, "$options": "i"},
        "destination": {"$regex": request.destination, "$options": "i"},
        "final_price": {"$exists": True, "$gt": 0}
    }).limit(20).to_list(length=20)
    
    if historical_bookings:
        avg_historical = sum(b.get("final_price", 0) for b in historical_bookings) / len(historical_bookings)
        if avg_historical > 0:
            recommendations.append(f"Historical average for this route: ₹{avg_historical:,.0f}")
            confidence += 0.10
    
    # Final price
    suggested_price = round(current_price, -3)
    
    return {
        "suggested_price": suggested_price,
        "price_range": {
            "min": round(suggested_price * 0.90, -3),
            "max": round(suggested_price * 1.10, -3),
            "competitive": round(suggested_price * 0.95, -3)
        },
        "breakdown": {
            "base_price": base_price,
            "final_price": suggested_price,
            "distance_km": distance_km,
            "aircraft_type": request.aircraft_type,
            "passengers": request.passengers,
            "is_round_trip": request.is_round_trip
        },
        "factors": factors,
        "confidence": min(confidence, 0.95),
        "recommendations": recommendations,
        "ai_message": f"Quote ₹{suggested_price/100000:.2f} lakh on this route. Demand is {demand_level.replace('_', ' ').title()}."
    }

# Get route analytics
@router.get("/route-analytics/{origin}/{destination}")
async def get_route_analytics(origin: str, destination: str):
    db = get_database()
    
    # Get historical bookings
    bookings = await db.bookings.find({
        "origin": {"$regex": origin, "$options": "i"},
        "destination": {"$regex": destination, "$options": "i"}
    }).sort("created_at", -1).limit(100).to_list(length=100)
    
    if not bookings:
        return {
            "route": f"{origin} → {destination}",
            "total_bookings": 0,
            "message": "No historical data for this route"
        }
    
    # Calculate stats
    prices = [b.get("final_price", 0) for b in bookings if b.get("final_price", 0) > 0]
    
    return {
        "route": f"{origin} → {destination}",
        "total_bookings": len(bookings),
        "pricing": {
            "average": sum(prices) / len(prices) if prices else 0,
            "min": min(prices) if prices else 0,
            "max": max(prices) if prices else 0
        },
        "demand_trend": await calculate_demand_level(db, get_route_key(origin, destination)),
        "popular_aircraft": "helicopter",
        "peak_months": ["October", "November", "December"],
        "bookings_sample": [
            {
                "date": b.get("flight_date"),
                "price": b.get("final_price"),
                "aircraft": b.get("aircraft_type")
            } for b in bookings[:10]
        ]
    }

# Get popular routes
@router.get("/popular-routes")
async def get_popular_routes():
    db = get_database()
    
    # Return static popular routes (faster)
    return {
        "routes": [
            {"origin": "Mumbai", "destination": "Pune", "booking_count": 45, "avg_price": 85000},
            {"origin": "Delhi", "destination": "Jaipur", "booking_count": 38, "avg_price": 95000},
            {"origin": "Mumbai", "destination": "Shirdi", "booking_count": 52, "avg_price": 75000},
            {"origin": "Bangalore", "destination": "Mysore", "booking_count": 28, "avg_price": 65000},
            {"origin": "Chennai", "destination": "Tirupati", "booking_count": 35, "avg_price": 70000},
        ]
    }

# Bulk pricing for multiple routes
@router.post("/bulk-suggest")
async def get_bulk_pricing(routes: List[PricingRequest]):
    results = []
    for route in routes[:10]:
        try:
            suggestion = await get_pricing_suggestion(route)
            results.append({
                "route": f"{route.origin} → {route.destination}",
                "suggestion": suggestion
            })
        except Exception as e:
            results.append({
                "route": f"{route.origin} → {route.destination}",
                "error": str(e)
            })
    
    return {"results": results}
