from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List
import httpx
import math

router = APIRouter(prefix="/pincode", tags=["PIN Code Lookup"])

class PinCodeResponse(BaseModel):
    pincode: str
    state: str
    district: str
    area: str
    region: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None

class LocationInfo(BaseModel):
    pincode: str
    state: str
    district: str
    area: str
    block: Optional[str] = None
    division: Optional[str] = None
    region: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None

class PriceEstimate(BaseModel):
    distance_km: float
    base_price: float
    distance_charge: float
    waiting_charge: float
    gst_amount: float
    total_price: float
    advance_amount: float
    advance_percent: float

# India Post API for PIN code lookup
INDIA_POST_API = "https://api.postalpincode.in/pincode"

# Approximate coordinates for major Indian cities (fallback)
CITY_COORDINATES = {
    "mumbai": (19.0760, 72.8777),
    "delhi": (28.6139, 77.2090),
    "bangalore": (12.9716, 77.5946),
    "chennai": (13.0827, 80.2707),
    "kolkata": (22.5726, 88.3639),
    "hyderabad": (17.3850, 78.4867),
    "pune": (18.5204, 73.8567),
    "ahmedabad": (23.0225, 72.5714),
    "jaipur": (26.9124, 75.7873),
    "lucknow": (26.8467, 80.9462),
    "goa": (15.2993, 74.1240),
    "shimla": (31.1048, 77.1734),
    "srinagar": (34.0837, 74.7973),
    "amritsar": (31.6340, 74.8723),
    "varanasi": (25.3176, 82.9739),
}

@router.get("/lookup/{pincode}")
async def lookup_pincode(pincode: str):
    """
    Lookup PIN code details from India Post API
    Returns state, district, area, and coordinates
    """
    if len(pincode) != 6 or not pincode.isdigit():
        raise HTTPException(status_code=400, detail="Invalid PIN code. Must be 6 digits.")
    
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(f"{INDIA_POST_API}/{pincode}")
            data = response.json()
            
            if data and len(data) > 0 and data[0].get("Status") == "Success":
                post_offices = data[0].get("PostOffice", [])
                if post_offices:
                    po = post_offices[0]
                    
                    # Get coordinates if available, or estimate from city
                    lat, lng = None, None
                    district_lower = po.get("District", "").lower()
                    for city, coords in CITY_COORDINATES.items():
                        if city in district_lower:
                            lat, lng = coords
                            break
                    
                    locations = []
                    for po in post_offices:
                        locations.append(LocationInfo(
                            pincode=pincode,
                            state=po.get("State", ""),
                            district=po.get("District", ""),
                            area=po.get("Name", ""),
                            block=po.get("Block", ""),
                            division=po.get("Division", ""),
                            region=po.get("Region", ""),
                            latitude=lat,
                            longitude=lng
                        ))
                    
                    return {
                        "success": True,
                        "pincode": pincode,
                        "state": post_offices[0].get("State", ""),
                        "district": post_offices[0].get("District", ""),
                        "locations": locations,
                        "latitude": lat,
                        "longitude": lng
                    }
            
            raise HTTPException(status_code=404, detail="PIN code not found")
            
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="India Post API timeout")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to lookup PIN code: {str(e)}")

@router.get("/search")
async def search_by_area(
    state: Optional[str] = None,
    district: Optional[str] = None,
    area: Optional[str] = None
):
    """
    Search PIN codes by state, district, or area name
    """
    if not any([state, district, area]):
        raise HTTPException(status_code=400, detail="Provide at least one search parameter")
    
    search_term = area or district or state
    
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(f"https://api.postalpincode.in/postoffice/{search_term}")
            data = response.json()
            
            if data and len(data) > 0 and data[0].get("Status") == "Success":
                post_offices = data[0].get("PostOffice", [])
                results = []
                
                for po in post_offices:
                    # Filter by state/district if provided
                    if state and state.lower() not in po.get("State", "").lower():
                        continue
                    if district and district.lower() not in po.get("District", "").lower():
                        continue
                    
                    results.append({
                        "pincode": po.get("Pincode", ""),
                        "area": po.get("Name", ""),
                        "district": po.get("District", ""),
                        "state": po.get("State", ""),
                        "region": po.get("Region", "")
                    })
                
                return {"success": True, "results": results[:20]}  # Limit to 20 results
            
            return {"success": False, "results": [], "message": "No results found"}
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")

def calculate_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculate distance between two coordinates using Haversine formula
    Returns distance in kilometers
    """
    R = 6371  # Earth's radius in kilometers
    
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    delta_lat = math.radians(lat2 - lat1)
    delta_lon = math.radians(lon2 - lon1)
    
    a = math.sin(delta_lat/2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lon/2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    
    return R * c

@router.post("/calculate-price")
async def calculate_price(
    pickup_lat: float,
    pickup_lng: float,
    drop_lat: float,
    drop_lng: float,
    waiting_hours: float = 0,
    db=None
):
    """
    Calculate estimated price based on distance and waiting time
    Uses pricing settings from database
    """
    from database import get_database
    db = await get_database()
    
    # Get pricing settings
    pricing = await db.pricing_settings.find_one({"type": "helicopter_pricing"}, {"_id": 0})
    if not pricing:
        # Default pricing
        pricing = {
            "base_price_upto_50km": 50000,
            "rate_per_km_after_50": 1000,
            "waiting_charge_per_hour": 5000,
            "gst_percent": 18,
            "advance_percent": 5
        }
    
    # Calculate distance
    distance_km = calculate_distance(pickup_lat, pickup_lng, drop_lat, drop_lng)
    
    # Calculate base price
    if distance_km <= 50:
        base_price = pricing["base_price_upto_50km"]
        distance_charge = 0
    else:
        base_price = pricing["base_price_upto_50km"]
        extra_km = distance_km - 50
        distance_charge = extra_km * pricing["rate_per_km_after_50"]
    
    # Waiting charges
    waiting_charge = waiting_hours * pricing["waiting_charge_per_hour"]
    
    # Subtotal
    subtotal = base_price + distance_charge + waiting_charge
    
    # GST
    gst_amount = subtotal * (pricing["gst_percent"] / 100)
    
    # Total
    total_price = subtotal + gst_amount
    
    # Advance amount
    advance_percent = pricing["advance_percent"]
    advance_amount = total_price * (advance_percent / 100)
    
    return PriceEstimate(
        distance_km=round(distance_km, 2),
        base_price=base_price,
        distance_charge=round(distance_charge, 2),
        waiting_charge=waiting_charge,
        gst_amount=round(gst_amount, 2),
        total_price=round(total_price, 2),
        advance_amount=round(advance_amount, 2),
        advance_percent=advance_percent
    )

@router.get("/estimate-distance")
async def estimate_distance(
    from_pincode: str,
    to_pincode: str
):
    """
    Estimate distance between two PIN codes
    """
    # Lookup both PIN codes
    from_data = await lookup_pincode(from_pincode)
    to_data = await lookup_pincode(to_pincode)
    
    if not from_data.get("latitude") or not to_data.get("latitude"):
        # Use fallback - estimate based on region
        return {
            "success": False,
            "message": "Coordinates not available for these PIN codes",
            "estimated_distance_km": None
        }
    
    distance = calculate_distance(
        from_data["latitude"], from_data["longitude"],
        to_data["latitude"], to_data["longitude"]
    )
    
    return {
        "success": True,
        "from_location": {
            "pincode": from_pincode,
            "area": from_data["locations"][0].area if from_data.get("locations") else "",
            "district": from_data["district"],
            "state": from_data["state"]
        },
        "to_location": {
            "pincode": to_pincode,
            "area": to_data["locations"][0].area if to_data.get("locations") else "",
            "district": to_data["district"],
            "state": to_data["state"]
        },
        "estimated_distance_km": round(distance, 2)
    }
