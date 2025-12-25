from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, timezone, timedelta
from uuid import uuid4
import math
from database import get_database
from routes.auth_routes import get_current_user

router = APIRouter(prefix="/pricing", tags=["Dynamic Pricing"])

# Default pricing rules
DEFAULT_PRICING_CONFIG = {
    "base_multiplier": 1.0,
    "demand_pricing_enabled": True,
    "seasonal_pricing_enabled": True,
    "time_based_pricing_enabled": True,
    # Demand factors
    "high_demand_threshold": 0.7,  # 70% capacity = high demand
    "high_demand_multiplier": 1.3,
    "very_high_demand_threshold": 0.9,
    "very_high_demand_multiplier": 1.5,
    "low_demand_multiplier": 0.9,
    # Seasonal factors
    "peak_season_months": [10, 11, 12, 1, 2, 3, 4, 5],  # Oct-May (tourism season)
    "peak_season_multiplier": 1.2,
    "off_season_multiplier": 0.85,
    # Time-based factors
    "advance_booking_days": 30,
    "advance_booking_discount": 0.1,  # 10% discount
    "last_minute_days": 3,
    "last_minute_surcharge": 0.15,  # 15% surcharge
    # Special days
    "festival_dates": [],  # Will be populated
    "festival_multiplier": 1.4,
    # Route popularity (dynamic)
    "popular_route_multiplier": 1.15,
    # Weather impact
    "bad_weather_discount": 0.05,
    # Minimum and maximum caps
    "min_multiplier": 0.7,
    "max_multiplier": 2.0
}

# Models
class PricingRequest(BaseModel):
    origin: str
    destination: str
    journey_date: str
    journey_time: Optional[str] = None
    aircraft_type: Optional[str] = None
    passengers: int = 1
    base_price: float

class PricingRuleUpdate(BaseModel):
    rule_name: str
    value: float

class SeasonalRule(BaseModel):
    name: str
    start_date: str  # MM-DD format
    end_date: str
    multiplier: float
    description: Optional[str] = None

class FestivalDate(BaseModel):
    name: str
    date: str  # YYYY-MM-DD
    multiplier: float = 1.4

# Helper Functions
async def get_pricing_config(db):
    """Get pricing configuration"""
    config = await db.settings.find_one({"type": "pricing_config"}, {"_id": 0})
    if not config:
        config = {"type": "pricing_config", **DEFAULT_PRICING_CONFIG}
    return config

async def get_route_popularity(db, origin: str, destination: str) -> float:
    """Calculate route popularity based on booking history"""
    thirty_days_ago = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
    
    # Count bookings for this route
    route_bookings = await db.bookings.count_documents({
        "origin": {"$regex": origin, "$options": "i"},
        "destination": {"$regex": destination, "$options": "i"},
        "created_at": {"$gte": thirty_days_ago}
    })
    
    # Get total bookings
    total_bookings = await db.bookings.count_documents({
        "created_at": {"$gte": thirty_days_ago}
    })
    
    if total_bookings == 0:
        return 0.5  # Neutral
    
    popularity = route_bookings / max(total_bookings, 1)
    return min(1.0, popularity * 10)  # Normalize

async def get_demand_level(db, journey_date: str, origin: str, destination: str) -> float:
    """Calculate demand level for a specific date/route"""
    # Count existing bookings for this date
    existing_bookings = await db.bookings.count_documents({
        "journey_date": journey_date,
        "origin": {"$regex": origin, "$options": "i"},
        "status": {"$nin": ["cancelled", "rejected"]}
    })
    
    # Estimate capacity (simplified)
    estimated_capacity = 20  # Assume 20 slots per day per route
    
    return min(1.0, existing_bookings / estimated_capacity)

def calculate_seasonal_factor(journey_date: str, config: dict) -> tuple:
    """Calculate seasonal pricing factor"""
    if not config.get("seasonal_pricing_enabled"):
        return 1.0, "standard"
    
    try:
        date = datetime.strptime(journey_date, "%Y-%m-%d")
        month = date.month
        
        # Check festival dates
        festival_dates = config.get("festival_dates", [])
        for festival in festival_dates:
            if festival.get("date") == journey_date:
                return festival.get("multiplier", 1.4), f"festival_{festival.get('name')}"
        
        # Check peak season
        peak_months = config.get("peak_season_months", [])
        if month in peak_months:
            return config.get("peak_season_multiplier", 1.2), "peak_season"
        else:
            return config.get("off_season_multiplier", 0.85), "off_season"
    except:
        return 1.0, "standard"

def calculate_advance_booking_factor(journey_date: str, config: dict) -> tuple:
    """Calculate factor based on how far in advance booking is made"""
    if not config.get("time_based_pricing_enabled"):
        return 1.0, "standard"
    
    try:
        journey = datetime.strptime(journey_date, "%Y-%m-%d")
        today = datetime.now()
        days_until = (journey - today).days
        
        if days_until >= config.get("advance_booking_days", 30):
            discount = config.get("advance_booking_discount", 0.1)
            return 1.0 - discount, "advance_booking"
        elif days_until <= config.get("last_minute_days", 3):
            surcharge = config.get("last_minute_surcharge", 0.15)
            return 1.0 + surcharge, "last_minute"
        else:
            return 1.0, "standard"
    except:
        return 1.0, "standard"

# API Endpoints
@router.post("/calculate")
async def calculate_dynamic_price(request: PricingRequest):
    """Calculate dynamic price for a journey"""
    db = get_database()
    config = await get_pricing_config(db)
    
    factors = []
    total_multiplier = config.get("base_multiplier", 1.0)
    
    # 1. Demand-based pricing
    if config.get("demand_pricing_enabled"):
        demand_level = await get_demand_level(db, request.journey_date, request.origin, request.destination)
        
        if demand_level >= config.get("very_high_demand_threshold", 0.9):
            demand_mult = config.get("very_high_demand_multiplier", 1.5)
            factors.append({"type": "demand", "level": "very_high", "multiplier": demand_mult})
        elif demand_level >= config.get("high_demand_threshold", 0.7):
            demand_mult = config.get("high_demand_multiplier", 1.3)
            factors.append({"type": "demand", "level": "high", "multiplier": demand_mult})
        elif demand_level < 0.3:
            demand_mult = config.get("low_demand_multiplier", 0.9)
            factors.append({"type": "demand", "level": "low", "multiplier": demand_mult})
        else:
            demand_mult = 1.0
            factors.append({"type": "demand", "level": "normal", "multiplier": 1.0})
        
        total_multiplier *= demand_mult
    
    # 2. Seasonal pricing
    seasonal_mult, season_type = calculate_seasonal_factor(request.journey_date, config)
    if seasonal_mult != 1.0:
        factors.append({"type": "seasonal", "season": season_type, "multiplier": seasonal_mult})
        total_multiplier *= seasonal_mult
    
    # 3. Advance booking / Last minute
    time_mult, time_type = calculate_advance_booking_factor(request.journey_date, config)
    if time_mult != 1.0:
        factors.append({"type": "timing", "category": time_type, "multiplier": time_mult})
        total_multiplier *= time_mult
    
    # 4. Route popularity
    popularity = await get_route_popularity(db, request.origin, request.destination)
    if popularity > 0.7:
        pop_mult = config.get("popular_route_multiplier", 1.15)
        factors.append({"type": "popularity", "level": "high", "multiplier": pop_mult})
        total_multiplier *= pop_mult
    
    # Apply caps
    total_multiplier = max(config.get("min_multiplier", 0.7), 
                          min(config.get("max_multiplier", 2.0), total_multiplier))
    
    # Calculate final price
    final_price = round(request.base_price * total_multiplier, 2)
    savings = round(request.base_price - final_price, 2) if final_price < request.base_price else 0
    surcharge = round(final_price - request.base_price, 2) if final_price > request.base_price else 0
    
    return {
        "base_price": request.base_price,
        "final_price": final_price,
        "total_multiplier": round(total_multiplier, 3),
        "savings": abs(savings) if savings < 0 else 0,
        "surcharge": surcharge,
        "price_factors": factors,
        "route": f"{request.origin} → {request.destination}",
        "journey_date": request.journey_date,
        "pricing_valid_until": (datetime.now(timezone.utc) + timedelta(minutes=15)).isoformat()
    }

@router.get("/config")
async def get_pricing_configuration(current_user: dict = Depends(get_current_user)):
    """Get pricing configuration"""
    if "admin" not in current_user.get("roles", []):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    db = get_database()
    config = await get_pricing_config(db)
    return config

@router.post("/config")
async def update_pricing_configuration(config: dict, current_user: dict = Depends(get_current_user)):
    """Update pricing configuration"""
    if "admin" not in current_user.get("roles", []):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    db = get_database()
    config["type"] = "pricing_config"
    config["updated_at"] = datetime.now(timezone.utc).isoformat()
    config["updated_by"] = current_user["id"]
    
    await db.settings.update_one(
        {"type": "pricing_config"},
        {"$set": config},
        upsert=True
    )
    
    return {"message": "Pricing configuration updated"}

@router.post("/festivals")
async def add_festival_date(festival: FestivalDate, current_user: dict = Depends(get_current_user)):
    """Add festival date for special pricing"""
    if "admin" not in current_user.get("roles", []):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    db = get_database()
    
    await db.settings.update_one(
        {"type": "pricing_config"},
        {"$push": {"festival_dates": festival.dict()}},
        upsert=True
    )
    
    return {"message": f"Festival '{festival.name}' added"}

@router.get("/analysis")
async def get_pricing_analysis(current_user: dict = Depends(get_current_user)):
    """Get pricing analytics"""
    if "admin" not in current_user.get("roles", []):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    db = get_database()
    
    # Get recent price calculations
    thirty_days_ago = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
    
    # Popular routes
    pipeline = [
        {"$match": {"created_at": {"$gte": thirty_days_ago}}},
        {"$group": {
            "_id": {"origin": "$origin", "destination": "$destination"},
            "count": {"$sum": 1},
            "avg_price": {"$avg": "$total_amount"}
        }},
        {"$sort": {"count": -1}},
        {"$limit": 10}
    ]
    
    popular_routes = []
    async for doc in db.bookings.aggregate(pipeline):
        popular_routes.append({
            "route": f"{doc['_id']['origin']} → {doc['_id']['destination']}",
            "bookings": doc["count"],
            "avg_price": round(doc["avg_price"] or 0, 2)
        })
    
    # Revenue by month
    pipeline = [
        {"$match": {"status": {"$in": ["confirmed", "completed"]}}},
        {"$group": {
            "_id": {"$substr": ["$journey_date", 0, 7]},
            "revenue": {"$sum": "$total_amount"},
            "bookings": {"$sum": 1}
        }},
        {"$sort": {"_id": -1}},
        {"$limit": 6}
    ]
    
    monthly_revenue = []
    async for doc in db.bookings.aggregate(pipeline):
        monthly_revenue.append({
            "month": doc["_id"],
            "revenue": round(doc["revenue"] or 0, 2),
            "bookings": doc["bookings"]
        })
    
    return {
        "popular_routes": popular_routes,
        "monthly_revenue": monthly_revenue,
        "pricing_config": await get_pricing_config(db)
    }
