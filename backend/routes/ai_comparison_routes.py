"""
AI Smart Comparison Routes
From Document [1] - Customer को पूरा Comparison दिखे
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from typing import Optional, List
from datetime import datetime, timezone, timedelta
from database import get_database
from middleware import get_current_user, require_roles
from models import (
    AircraftComparison, AircraftComparisonCreate, ComparisonFilledBy,
    FeatureComparisonItem, PriceComparisonItem, SafetyComparisonItem,
    AmenityComparisonItem, OperatorComparisonItem
)
import uuid
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/ai-comparison", tags=["AI Smart Comparison"])


# ============ HELPER FUNCTIONS ============

def calculate_distance(coord1: dict, coord2: dict) -> float:
    """Calculate distance between two coordinates (Haversine formula)"""
    from math import radians, sin, cos, sqrt, atan2
    
    lat1, lon1 = radians(coord1.get('lat', 0)), radians(coord1.get('lng', 0))
    lat2, lon2 = radians(coord2.get('lat', 0)), radians(coord2.get('lng', 0))
    
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    
    a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
    c = 2 * atan2(sqrt(a), sqrt(1-a))
    
    return round(6371 * c, 2)  # Earth radius in km


def calculate_safety_score(aircraft: dict) -> int:
    """Calculate safety score for aircraft"""
    safety = aircraft.get('safety_features', {})
    score = 50  # Base score
    
    if safety.get('tcas'): score += 10
    if safety.get('terrain_awareness'): score += 10
    if safety.get('weather_radar'): score += 10
    if safety.get('autopilot'): score += 10
    if safety.get('defibrillator'): score += 5
    if safety.get('oxygen_kit'): score += 5
    
    return min(100, score)


def calculate_comfort_score(aircraft: dict) -> int:
    """Calculate comfort/amenity score"""
    amenities = aircraft.get('amenities', {})
    score = 40  # Base score
    
    wifi = amenities.get('wifi_type', 'none')
    if wifi == 'high_speed': score += 20
    elif wifi == 'basic': score += 10
    
    if amenities.get('leather_seats'): score += 15
    if amenities.get('pressurized_cabin'): score += 10
    if amenities.get('meals_available'): score += 10
    if amenities.get('entertainment_system'): score += 5
    if amenities.get('lavatory'): score += 5
    if amenities.get('conference_table'): score += 5
    
    return min(100, score)


def calculate_value_score(price: float, avg_price: float) -> int:
    """Calculate value score based on price comparison"""
    if avg_price == 0:
        return 50
    
    ratio = price / avg_price
    if ratio <= 0.8:
        return 95  # Great value
    elif ratio <= 0.9:
        return 85
    elif ratio <= 1.0:
        return 75
    elif ratio <= 1.1:
        return 65
    elif ratio <= 1.2:
        return 55
    else:
        return 45  # Expensive


def get_winner(items: list, aircraft_ids: list, comparison_type: str) -> Optional[str]:
    """Determine winner for a comparison category"""
    # For safety/amenities - count True values
    # For price - lowest wins
    # For features - subjective, return None
    
    if comparison_type == 'price':
        totals = {}
        for item in items:
            for i, aid in enumerate(aircraft_ids):
                key = f'aircraft_{i+1}_amount'
                if key in item:
                    totals[aid] = totals.get(aid, 0) + item[key]
        if totals:
            return min(totals, key=totals.get)
    
    elif comparison_type in ['safety', 'amenities']:
        counts = {}
        for item in items:
            for i, aid in enumerate(aircraft_ids):
                key = f'aircraft_{i+1}_has'
                if item.get(key, False):
                    counts[aid] = counts.get(aid, 0) + 1
        if counts:
            return max(counts, key=counts.get)
    
    return None


async def generate_ai_recommendation(comparison: dict, aircraft_details: list) -> dict:
    """Generate AI recommendation based on comparison data"""
    scores = comparison.get('scores', {})
    
    if not scores:
        return {
            "recommendation": None,
            "reason": "Insufficient data for recommendation",
            "reason_hi": "सिफारिश के लिए अपर्याप्त डेटा"
        }
    
    # Find highest overall score
    best_aircraft = max(scores.items(), key=lambda x: x[1].get('overall', 0))
    best_id = best_aircraft[0]
    best_scores = best_aircraft[1]
    
    # Find the aircraft details
    best_detail = next((a for a in aircraft_details if a.get('id') == best_id), None)
    model_name = best_detail.get('basic_info', {}).get('model', 'This aircraft') if best_detail else 'This aircraft'
    
    # Generate reason
    strengths = []
    if best_scores.get('safety', 0) >= 80:
        strengths.append("excellent safety features")
    if best_scores.get('comfort', 0) >= 80:
        strengths.append("superior comfort")
    if best_scores.get('value', 0) >= 80:
        strengths.append("best value for money")
    
    reason = f"{model_name} offers " + (", ".join(strengths) if strengths else "the best overall experience")
    reason_hi = f"{model_name} " + ("सर्वोत्तम सुरक्षा, आराम और मूल्य प्रदान करता है" if len(strengths) >= 2 else "सबसे अच्छा समग्र अनुभव प्रदान करता है")
    
    return {
        "recommendation": best_id,
        "reason": reason,
        "reason_hi": reason_hi
    }


# ============ PUBLIC ENDPOINTS ============

@router.post("/create")
async def create_comparison(
    request: AircraftComparisonCreate,
    current_user: dict = Depends(get_current_user)
):
    """
    Create new aircraft comparison
    Compares 2-3 aircraft side by side
    """
    db = get_database()
    
    if len(request.aircraft_ids) < 2 or len(request.aircraft_ids) > 3:
        raise HTTPException(status_code=400, detail="Please provide 2-3 aircraft IDs for comparison")
    
    # Fetch aircraft details
    aircraft_list = []
    for aid in request.aircraft_ids:
        aircraft = await db.aircraft_catalog.find_one({"id": aid}, {"_id": 0})
        if not aircraft:
            # Try legacy aircraft collection
            aircraft = await db.aircraft.find_one({"id": aid}, {"_id": 0})
        if aircraft:
            aircraft_list.append(aircraft)
    
    if len(aircraft_list) < 2:
        raise HTTPException(status_code=404, detail="Could not find enough aircraft for comparison")
    
    # Calculate distance if route provided
    distance_km = 0
    if request.route_origin and request.route_destination:
        # Try to get coordinates from landing points
        origin_point = await db.landing_points.find_one(
            {"landing_point_name": {"$regex": request.route_origin, "$options": "i"}},
            {"_id": 0, "latitude": 1, "longitude": 1}
        )
        dest_point = await db.landing_points.find_one(
            {"landing_point_name": {"$regex": request.route_destination, "$options": "i"}},
            {"_id": 0, "latitude": 1, "longitude": 1}
        )
        if origin_point and dest_point:
            distance_km = calculate_distance(
                {"lat": origin_point.get("latitude"), "lng": origin_point.get("longitude")},
                {"lat": dest_point.get("latitude"), "lng": dest_point.get("longitude")}
            )
    
    # Build feature comparison
    feature_items = []
    feature_list = [
        ("Model", "मॉडल", "basic_info.model", "model"),
        ("Manufacturer", "निर्माता", "basic_info.manufacturer", "manufacturer"),
        ("Passenger Capacity", "यात्री क्षमता", "passenger_capacity", "basic_info.passenger_capacity"),
        ("Cruise Speed", "क्रूज़ स्पीड", "cruise_speed_kmh", "basic_info.cruise_speed_kmh"),
        ("Max Range", "अधिकतम रेंज", "max_range_km", "basic_info.max_range_km"),
        ("Engine Type", "इंजन प्रकार", "engine_type", "basic_info.engine_type"),
    ]
    
    for fname, fname_hi, key1, key2 in feature_list:
        values = []
        for ac in aircraft_list:
            val = ac.get(key1.split('.')[0], {}).get(key1.split('.')[-1]) if '.' in key1 else ac.get(key1)
            if val is None:
                val = ac.get(key2.split('.')[0], {}).get(key2.split('.')[-1]) if '.' in key2 else ac.get(key2)
            values.append(str(val) if val else "N/A")
        
        item = {
            "feature_name": fname,
            "feature_name_hi": fname_hi,
            "aircraft_1_value": values[0],
            "aircraft_2_value": values[1],
            "importance": "high" if fname in ["Passenger Capacity", "Cruise Speed"] else "medium"
        }
        if len(values) > 2:
            item["aircraft_3_value"] = values[2]
        feature_items.append(item)
    
    # Build price comparison
    price_items = []
    prices = []
    for ac in aircraft_list:
        hourly = ac.get('hourly_rate', 0) or ac.get('pricing', {}).get('hourly_rate', 50000)
        prices.append(hourly)
    
    avg_price = sum(prices) / len(prices) if prices else 50000
    
    # Estimated price for journey
    hours = distance_km / 200 if distance_km > 0 else 1  # Assume 200 km/h
    for i, (ac, hourly) in enumerate(zip(aircraft_list, prices)):
        est_price = hourly * max(1, hours)
        price_items.append({
            "component": "Estimated Trip Cost",
            "component_hi": "अनुमानित यात्रा लागत",
            f"aircraft_{i+1}_amount": est_price
        })
    
    # Build safety comparison
    safety_items = []
    safety_features = [
        ("TCAS", "TCAS", "tcas", 15),
        ("Terrain Awareness", "भूभाग जागरूकता", "terrain_awareness", 15),
        ("Weather Radar", "मौसम रडार", "weather_radar", 10),
        ("Autopilot", "ऑटोपायलट", "autopilot", 10),
        ("Defibrillator", "डिफिब्रिलेटर", "defibrillator", 5),
        ("Oxygen Kit", "ऑक्सीजन किट", "oxygen_kit", 5),
    ]
    
    for sname, sname_hi, key, weight in safety_features:
        item = {
            "feature": sname,
            "feature_hi": sname_hi,
            "weight": weight
        }
        for i, ac in enumerate(aircraft_list):
            safety = ac.get('safety_features', {})
            item[f"aircraft_{i+1}_has"] = safety.get(key, False)
        safety_items.append(item)
    
    # Build amenity comparison
    amenity_items = []
    amenities_list = [
        ("WiFi", "वाईफाई", "wifi_type", "entertainment"),
        ("Leather Seats", "लेदर सीट्स", "leather_seats", "comfort"),
        ("Pressurized Cabin", "प्रेशराइज्ड केबिन", "pressurized_cabin", "comfort"),
        ("Meals", "भोजन", "meals_available", "comfort"),
        ("Lavatory", "शौचालय", "lavatory", "comfort"),
        ("Conference Table", "कॉन्फ्रेंस टेबल", "conference_table", "business"),
    ]
    
    for aname, aname_hi, key, category in amenities_list:
        item = {
            "amenity": aname,
            "amenity_hi": aname_hi,
            "category": category
        }
        for i, ac in enumerate(aircraft_list):
            amenities = ac.get('amenities', {})
            val = amenities.get(key, False)
            if key == "wifi_type":
                val = val not in [None, "none", ""]
            item[f"aircraft_{i+1}_has"] = bool(val)
        amenity_items.append(item)
    
    # Calculate scores
    scores = {}
    for i, ac in enumerate(aircraft_list):
        aid = ac.get('id', f"aircraft_{i+1}")
        safety_score = calculate_safety_score(ac)
        comfort_score = calculate_comfort_score(ac)
        value_score = calculate_value_score(prices[i], avg_price)
        overall = round((safety_score * 0.3 + comfort_score * 0.3 + value_score * 0.4))
        
        scores[aid] = {
            "safety": safety_score,
            "comfort": comfort_score,
            "value": value_score,
            "overall": overall
        }
    
    # Determine winners
    winners = {
        "safety": get_winner(safety_items, [ac.get('id') for ac in aircraft_list], 'safety'),
        "price": get_winner(price_items, [ac.get('id') for ac in aircraft_list], 'price'),
        "amenities": get_winner(amenity_items, [ac.get('id') for ac in aircraft_list], 'amenities'),
        "overall": max(scores.items(), key=lambda x: x[1].get('overall', 0))[0] if scores else None
    }
    
    # Generate AI recommendation
    ai_rec = await generate_ai_recommendation({"scores": scores}, aircraft_list)
    
    # Create comparison document
    comparison_id = f"CMP-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{str(uuid.uuid4())[:6].upper()}"
    
    comparison = {
        "id": str(uuid.uuid4()),
        "comparison_id": comparison_id,
        "aircraft_ids": [ac.get('id') for ac in aircraft_list],
        "aircraft_details": [
            {
                "id": ac.get('id'),
                "model": ac.get('basic_info', {}).get('model') or ac.get('model'),
                "manufacturer": ac.get('basic_info', {}).get('manufacturer') or ac.get('manufacturer'),
                "type": ac.get('aircraft_type') or ac.get('type'),
                "image_url": ac.get('images', [{}])[0].get('url') if ac.get('images') else None
            }
            for ac in aircraft_list
        ],
        "route_origin": request.route_origin,
        "route_destination": request.route_destination,
        "journey_date": request.journey_date,
        "distance_km": distance_km,
        "passengers": request.passengers,
        "feature_comparison": feature_items,
        "price_comparison": price_items,
        "safety_comparison": safety_items,
        "amenities_comparison": amenity_items,
        "operator_comparison": [],
        "scores": scores,
        "ai_recommendation": ai_rec.get("recommendation"),
        "ai_recommendation_reason": ai_rec.get("reason"),
        "ai_recommendation_reason_hi": ai_rec.get("reason_hi"),
        "winners": winners,
        "filled_by": "system",
        "created_by": current_user.get("id"),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "expires_at": (datetime.now(timezone.utc) + timedelta(hours=24)).isoformat(),
        "view_count": 0
    }
    
    await db.aircraft_comparisons.insert_one(comparison)
    
    # Remove _id before returning
    comparison.pop('_id', None)
    
    return comparison


@router.get("/{comparison_id}")
async def get_comparison(
    comparison_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get comparison by ID"""
    db = get_database()
    
    comparison = await db.aircraft_comparisons.find_one(
        {"comparison_id": comparison_id},
        {"_id": 0}
    )
    
    if not comparison:
        raise HTTPException(status_code=404, detail="Comparison not found")
    
    # Increment view count
    await db.aircraft_comparisons.update_one(
        {"comparison_id": comparison_id},
        {"$inc": {"view_count": 1}}
    )
    
    return comparison


@router.get("/my/recent")
async def get_my_comparisons(
    limit: int = Query(10, le=50),
    current_user: dict = Depends(get_current_user)
):
    """Get user's recent comparisons"""
    db = get_database()
    
    comparisons = await db.aircraft_comparisons.find(
        {"created_by": current_user["id"]},
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(length=limit)
    
    return {
        "comparisons": comparisons,
        "total": len(comparisons)
    }


@router.post("/quick-compare")
async def quick_compare(
    aircraft_ids: List[str] = Query(..., min_length=2, max_length=3)
):
    """
    Quick comparison without auth (public endpoint)
    Returns basic comparison data
    """
    db = get_database()
    
    # Fetch aircraft
    aircraft_list = []
    for aid in aircraft_ids:
        aircraft = await db.aircraft_catalog.find_one({"id": aid}, {"_id": 0})
        if not aircraft:
            aircraft = await db.aircraft.find_one({"id": aid}, {"_id": 0})
        if aircraft:
            aircraft_list.append(aircraft)
    
    if len(aircraft_list) < 2:
        raise HTTPException(status_code=404, detail="Need at least 2 aircraft")
    
    # Calculate basic scores
    comparison_data = []
    for ac in aircraft_list:
        safety_score = calculate_safety_score(ac)
        comfort_score = calculate_comfort_score(ac)
        
        comparison_data.append({
            "id": ac.get('id'),
            "model": ac.get('basic_info', {}).get('model') or ac.get('model'),
            "manufacturer": ac.get('basic_info', {}).get('manufacturer') or ac.get('manufacturer'),
            "passenger_capacity": ac.get('passenger_capacity') or ac.get('basic_info', {}).get('passenger_capacity'),
            "hourly_rate": ac.get('hourly_rate') or ac.get('pricing', {}).get('hourly_rate'),
            "safety_score": safety_score,
            "comfort_score": comfort_score,
            "verified": ac.get('verification', {}).get('verified', False)
        })
    
    return {
        "aircraft": comparison_data,
        "comparison_type": "quick",
        "message": "Login to get detailed comparison with AI recommendations"
    }
