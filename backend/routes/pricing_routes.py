from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, timezone, timedelta
from uuid import uuid4
import math
from database import get_database
from routes.auth_routes import get_current_user
from models import PricingRequest, PricingRuleUpdate, PricingSettings

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

# Local Models (route-specific)
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


# ==================== PRICE HISTORY FOR CUSTOMERS ====================

@router.get("/history")
async def get_price_history(
    from_city: str = Query(..., alias="from"),
    to_city: str = Query(..., alias="to"),
    current_user: dict = Depends(get_current_user)
):
    """Get price history for a route - helps customers find best time to book"""
    db = get_database()
    
    now = datetime.now(timezone.utc)
    six_months_ago = (now - timedelta(days=180)).isoformat()
    
    # Get bookings/inquiries for this route
    from_pattern = {"$regex": from_city, "$options": "i"}
    to_pattern = {"$regex": to_city, "$options": "i"}
    
    route_bookings = await db.inquiries.find(
        {
            "$or": [
                {"from_location": from_pattern, "to_location": to_pattern},
                {"origin": from_pattern, "destination": to_pattern},
            ],
            "created_at": {"$gte": six_months_ago},
            "estimated_price": {"$exists": True, "$ne": None}
        },
        {"_id": 0, "estimated_price": 1, "accepted_quote": 1, "created_at": 1}
    ).to_list(500)
    
    # Also check bookings collection
    route_bookings_alt = await db.bookings.find(
        {
            "$and": [
                {
                    "$or": [
                        {"from_location": from_pattern, "to_location": to_pattern},
                        {"origin": from_pattern, "destination": to_pattern},
                    ]
                },
                {"created_at": {"$gte": six_months_ago}},
                {
                    "$or": [
                        {"total_amount": {"$exists": True, "$gt": 0}},
                        {"estimated_price": {"$exists": True, "$gt": 0}}
                    ]
                }
            ]
        },
        {"_id": 0, "total_amount": 1, "estimated_price": 1, "created_at": 1}
    ).to_list(500)
    
    # Merge data
    all_prices = []
    for b in route_bookings:
        price = float(b.get("accepted_quote", {}).get("amount") or b.get("estimated_price") or 0)
        if price > 0:
            all_prices.append({
                "price": price,
                "date": b.get("created_at", "")
            })
    
    for b in route_bookings_alt:
        price = float(b.get("total_amount") or b.get("estimated_price") or 0)
        if price > 0:
            all_prices.append({
                "price": price,
                "date": b.get("created_at", "")
            })
    
    # If no historical data, generate sample data based on route
    if not all_prices:
        # Generate realistic sample data
        base_prices = {
            ("mumbai", "shirdi"): 85000,
            ("mumbai", "pune"): 65000,
            ("delhi", "agra"): 95000,
            ("bangalore", "coorg"): 75000,
            ("chennai", "tirupati"): 70000,
        }
        
        route_key = (from_city.lower(), to_city.lower())
        base = base_prices.get(route_key, 80000)
        
        # Generate 6 months of sample data
        monthly_avg = []
        for i in range(6):
            month_date = datetime(now.year, now.month, 1) - timedelta(days=30*i)
            month_label = month_date.strftime("%b %Y")
            
            # Add some variation
            variation = 1.0 + (0.1 * (i % 3 - 1))  # -10% to +10%
            if month_date.month in [10, 11, 12, 1, 2]:  # Peak season
                variation *= 1.15
            
            monthly_avg.append({
                "month": month_label,
                "avg_price": round(base * variation)
            })
        
        monthly_avg.reverse()
        
        current_price = monthly_avg[-1]["avg_price"] if monthly_avg else base
        prices = [m["avg_price"] for m in monthly_avg]
        
        return {
            "current_price": current_price,
            "lowest_price": min(prices) if prices else base,
            "highest_price": max(prices) if prices else base,
            "avg_price": round(sum(prices) / len(prices)) if prices else base,
            "lowest_month": monthly_avg[prices.index(min(prices))]["month"] if prices else "N/A",
            "highest_month": monthly_avg[prices.index(max(prices))]["month"] if prices else "N/A",
            "trend_percent": 0,
            "monthly_avg": monthly_avg,
            "route": f"{from_city} → {to_city}",
            "data_source": "estimated"
        }
    
    # Calculate monthly averages from real data
    monthly_data = {}
    for p in all_prices:
        date_str = p.get("date", "")[:7]  # YYYY-MM
        if date_str:
            if date_str not in monthly_data:
                monthly_data[date_str] = []
            monthly_data[date_str].append(p["price"])
    
    # Build monthly average list
    monthly_avg = []
    for month_key in sorted(monthly_data.keys()):
        prices = monthly_data[month_key]
        month_date = datetime.strptime(month_key, "%Y-%m")
        monthly_avg.append({
            "month": month_date.strftime("%b %Y"),
            "avg_price": round(sum(prices) / len(prices))
        })
    
    # Calculate stats
    all_values = [p["price"] for p in all_prices]
    current_price = monthly_avg[-1]["avg_price"] if monthly_avg else (sum(all_values) / len(all_values) if all_values else 0)
    
    # Trend calculation (compare last month to previous)
    trend_percent = 0
    if len(monthly_avg) >= 2:
        prev_price = monthly_avg[-2]["avg_price"]
        if prev_price > 0:
            trend_percent = round(((current_price - prev_price) / prev_price) * 100, 1)
    
    # Find lowest/highest months
    prices_list = [m["avg_price"] for m in monthly_avg]
    lowest_idx = prices_list.index(min(prices_list)) if prices_list else 0
    highest_idx = prices_list.index(max(prices_list)) if prices_list else 0
    
    return {
        "current_price": round(current_price),
        "lowest_price": min(all_values) if all_values else 0,
        "highest_price": max(all_values) if all_values else 0,
        "avg_price": round(sum(all_values) / len(all_values)) if all_values else 0,
        "lowest_month": monthly_avg[lowest_idx]["month"] if monthly_avg else "N/A",
        "highest_month": monthly_avg[highest_idx]["month"] if monthly_avg else "N/A",
        "trend_percent": trend_percent,
        "monthly_avg": monthly_avg[-6:],  # Last 6 months
        "route": f"{from_city} → {to_city}",
        "data_source": "historical"
    }
