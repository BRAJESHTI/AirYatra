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
    "new delhi": (28.6139, 77.2090),
    "central delhi": (28.6139, 77.2090),
    "bangalore": (12.9716, 77.5946),
    "bengaluru": (12.9716, 77.5946),
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
    # Additional cities for better coverage
    "dehradun": (30.3165, 78.0322),
    "rishikesh": (30.0869, 78.2676),
    "haridwar": (29.9457, 78.1642),
    "mussoorie": (30.4598, 78.0644),
    "nainital": (29.3919, 79.4542),
    "agra": (27.1767, 78.0081),
    "noida": (28.5355, 77.3910),
    "gurgaon": (28.4595, 77.0266),
    "gurugram": (28.4595, 77.0266),
    "chandigarh": (30.7333, 76.7794),
    "indore": (22.7196, 75.8577),
    "bhopal": (23.2599, 77.4126),
    "nagpur": (21.1458, 79.0882),
    "patna": (25.5941, 85.1376),
    "ranchi": (23.3441, 85.3096),
    "bhubaneswar": (20.2961, 85.8245),
    "guwahati": (26.1445, 91.7362),
    "kochi": (9.9312, 76.2673),
    "trivandrum": (8.5241, 76.9366),
    "thiruvananthapuram": (8.5241, 76.9366),
    "coimbatore": (11.0168, 76.9558),
    "madurai": (9.9252, 78.1198),
    "mysore": (12.2958, 76.6394),
    "mysuru": (12.2958, 76.6394),
    "visakhapatnam": (17.6868, 83.2185),
    "vijayawada": (16.5062, 80.6480),
    "surat": (21.1702, 72.8311),
    "vadodara": (22.3072, 73.1812),
    "rajkot": (22.3039, 70.8022),
    "jodhpur": (26.2389, 73.0243),
    "udaipur": (24.5854, 73.7125),
    "ajmer": (26.4499, 74.6399),
    "jammu": (32.7266, 74.8570),
    "leh": (34.1526, 77.5771),
    "gangtok": (27.3389, 88.6065),
    "imphal": (24.8170, 93.9368),
    "kohima": (25.6751, 94.1086),
    "aizawl": (23.7271, 92.7176),
    "itanagar": (27.0844, 93.6053),
    "port blair": (11.6234, 92.7265),
    "puducherry": (11.9416, 79.8083),
    "panaji": (15.4909, 73.8278),
    # Tourist/Pilgrimage destinations
    "kedarnath": (30.7346, 79.0669),
    "badrinath": (30.7433, 79.4938),
    "shirdi": (19.7664, 74.4800),
    "tirupati": (13.6288, 79.4192),
    "puri": (19.8135, 85.8312),
    "dwarka": (22.2442, 68.9685),
    "amarnath": (34.2699, 75.5030),
    "mathura": (27.4924, 77.6737),
    "vrindavan": (27.5785, 77.6995),
    "ayodhya": (26.7922, 82.1998),
    "vaishno devi": (32.9854, 74.9492),
    "katra": (32.9915, 74.9318),
    "dharamsala": (32.2190, 76.3234),
    "mcleodganj": (32.2382, 76.3206),
}

# State-wise approximate coordinates (fallback when city not found)
STATE_COORDINATES = {
    "andhra pradesh": (15.9129, 79.7400),
    "arunachal pradesh": (28.2180, 94.7278),
    "assam": (26.2006, 92.9376),
    "bihar": (25.0961, 85.3131),
    "chhattisgarh": (21.2787, 81.8661),
    "goa": (15.2993, 74.1240),
    "gujarat": (22.2587, 71.1924),
    "haryana": (29.0588, 76.0856),
    "himachal pradesh": (31.1048, 77.1734),
    "jharkhand": (23.6102, 85.2799),
    "karnataka": (15.3173, 75.7139),
    "kerala": (10.8505, 76.2711),
    "madhya pradesh": (22.9734, 78.6569),
    "maharashtra": (19.7515, 75.7139),
    "manipur": (24.6637, 93.9063),
    "meghalaya": (25.4670, 91.3662),
    "mizoram": (23.1645, 92.9376),
    "nagaland": (26.1584, 94.5624),
    "odisha": (20.9517, 85.0985),
    "punjab": (31.1471, 75.3412),
    "rajasthan": (27.0238, 74.2179),
    "sikkim": (27.5330, 88.5122),
    "tamil nadu": (11.1271, 78.6569),
    "telangana": (18.1124, 79.0193),
    "tripura": (23.9408, 91.9882),
    "uttar pradesh": (26.8467, 80.9462),
    "uttarakhand": (30.0668, 79.0193),
    "west bengal": (22.9868, 87.8550),
    "delhi": (28.6139, 77.2090),
    "chandigarh": (30.7333, 76.7794),
    "jammu and kashmir": (33.7782, 76.5762),
    "ladakh": (34.1526, 77.5771),
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
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(f"{INDIA_POST_API}/{pincode}")
            data = response.json()
            
            if data and len(data) > 0 and data[0].get("Status") == "Success":
                post_offices = data[0].get("PostOffice", [])
                if post_offices:
                    po = post_offices[0]
                    
                    # Get coordinates - try multiple sources
                    lat, lng = None, None
                    district_lower = po.get("District", "").lower()
                    state_lower = po.get("State", "").lower()
                    area_lower = po.get("Name", "").lower()
                    
                    # 1. Try to match area name
                    for city, coords in CITY_COORDINATES.items():
                        if city in area_lower:
                            lat, lng = coords
                            break
                    
                    # 2. Try to match district
                    if lat is None:
                        for city, coords in CITY_COORDINATES.items():
                            if city in district_lower:
                                lat, lng = coords
                                break
                    
                    # 3. Fallback to state coordinates
                    if lat is None:
                        for state, coords in STATE_COORDINATES.items():
                            if state in state_lower or state_lower in state:
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
        return get_fallback_pincode_data(pincode)
    except HTTPException:
        raise
    except Exception as e:
        return get_fallback_pincode_data(pincode)

def get_fallback_pincode_data(pincode: str):
    """Get fallback data for PIN code when API fails"""
    # Major city pincodes
    FALLBACK_DATA = {
        "110001": {"state": "Delhi", "district": "New Delhi", "area": "Connaught Place", "lat": 28.6315, "lng": 77.2167},
        "400001": {"state": "Maharashtra", "district": "Mumbai", "area": "Fort", "lat": 18.9338, "lng": 72.8354},
        "600001": {"state": "Tamil Nadu", "district": "Chennai", "area": "Parrys", "lat": 13.0878, "lng": 80.2785},
        "700001": {"state": "West Bengal", "district": "Kolkata", "area": "BBD Bag", "lat": 22.5726, "lng": 88.3639},
        "560001": {"state": "Karnataka", "district": "Bangalore", "area": "MG Road", "lat": 12.9716, "lng": 77.5946},
        "500001": {"state": "Telangana", "district": "Hyderabad", "area": "Abids", "lat": 17.3850, "lng": 78.4867},
        "380001": {"state": "Gujarat", "district": "Ahmedabad", "area": "Lal Darwaja", "lat": 23.0225, "lng": 72.5714},
        "302001": {"state": "Rajasthan", "district": "Jaipur", "area": "Pink City", "lat": 26.9124, "lng": 75.7873},
        "226001": {"state": "Uttar Pradesh", "district": "Lucknow", "area": "Hazratganj", "lat": 26.8467, "lng": 80.9462},
        "411001": {"state": "Maharashtra", "district": "Pune", "area": "Shivaji Nagar", "lat": 18.5204, "lng": 73.8567},
        "201301": {"state": "Uttar Pradesh", "district": "Noida", "area": "Sector 1", "lat": 28.5355, "lng": 77.3910},
        "122001": {"state": "Haryana", "district": "Gurgaon", "area": "Sector 14", "lat": 28.4595, "lng": 77.0266},
    }
    
    if pincode in FALLBACK_DATA:
        data = FALLBACK_DATA[pincode]
        return {
            "success": True,
            "source": "fallback",
            "pincode": pincode,
            "state": data["state"],
            "district": data["district"],
            "locations": [LocationInfo(
                pincode=pincode,
                state=data["state"],
                district=data["district"],
                area=data["area"],
                latitude=data["lat"],
                longitude=data["lng"]
            )],
            "latitude": data["lat"],
            "longitude": data["lng"]
        }
    
    # Comprehensive state mapping based on first 2 digits of PIN code
    prefix = pincode[:2]
    state_map = {
        # Delhi & NCR
        "11": ("Delhi", "Delhi", 28.6139, 77.2090),
        # Haryana
        "12": ("Haryana", "Gurgaon", 28.4595, 77.0266),
        "13": ("Punjab", "Chandigarh", 30.7333, 76.7794),
        # Punjab
        "14": ("Punjab", "Amritsar", 31.6340, 74.8723),
        "15": ("Punjab", "Ludhiana", 30.9010, 75.8573),
        "16": ("Punjab", "Jalandhar", 31.3260, 75.5762),
        # Himachal Pradesh
        "17": ("Himachal Pradesh", "Shimla", 31.1048, 77.1734),
        # Jammu & Kashmir
        "18": ("Jammu & Kashmir", "Jammu", 32.7266, 74.8570),
        "19": ("Jammu & Kashmir", "Srinagar", 34.0837, 74.7973),
        # Uttar Pradesh
        "20": ("Uttar Pradesh", "Noida", 28.5355, 77.3910),
        "21": ("Uttar Pradesh", "Agra", 27.1767, 78.0081),
        "22": ("Uttar Pradesh", "Lucknow", 26.8467, 80.9462),
        "23": ("Uttar Pradesh", "Varanasi", 25.3176, 82.9739),
        "24": ("Uttarakhand", "Dehradun", 30.3165, 78.0322),
        "25": ("Uttar Pradesh", "Allahabad", 25.4358, 81.8463),
        "26": ("Uttar Pradesh", "Kanpur", 26.4499, 80.3319),
        "27": ("Uttar Pradesh", "Bareilly", 28.3670, 79.4304),
        "28": ("Uttar Pradesh", "Meerut", 28.9845, 77.7064),
        # Rajasthan
        "30": ("Rajasthan", "Jaipur", 26.9124, 75.7873),
        "31": ("Rajasthan", "Bikaner", 28.0229, 73.3119),
        "32": ("Rajasthan", "Jodhpur", 26.2389, 73.0243),
        "33": ("Rajasthan", "Udaipur", 24.5854, 73.7125),
        "34": ("Rajasthan", "Kota", 25.2138, 75.8648),
        # Gujarat
        "36": ("Gujarat", "Surat", 21.1702, 72.8311),
        "37": ("Gujarat", "Vadodara", 22.3072, 73.1812),
        "38": ("Gujarat", "Ahmedabad", 23.0225, 72.5714),
        "39": ("Gujarat", "Rajkot", 22.3039, 70.8022),
        # Maharashtra
        "40": ("Maharashtra", "Mumbai", 19.0760, 72.8777),
        "41": ("Maharashtra", "Pune", 18.5204, 73.8567),
        "42": ("Maharashtra", "Nashik", 19.9975, 73.7898),
        "43": ("Maharashtra", "Aurangabad", 19.8762, 75.3433),
        "44": ("Maharashtra", "Nagpur", 21.1458, 79.0882),
        # Madhya Pradesh
        "45": ("Madhya Pradesh", "Indore", 22.7196, 75.8577),
        "46": ("Madhya Pradesh", "Bhopal", 23.2599, 77.4126),
        "47": ("Madhya Pradesh", "Jabalpur", 23.1815, 79.9864),
        "48": ("Madhya Pradesh", "Gwalior", 26.2183, 78.1828),
        # Chhattisgarh
        "49": ("Chhattisgarh", "Raipur", 21.2514, 81.6296),
        # Telangana / Andhra Pradesh
        "50": ("Telangana", "Hyderabad", 17.3850, 78.4867),
        "51": ("Telangana", "Warangal", 17.9784, 79.6000),
        "52": ("Andhra Pradesh", "Vijayawada", 16.5062, 80.6480),
        "53": ("Andhra Pradesh", "Visakhapatnam", 17.6868, 83.2185),
        # Karnataka
        "56": ("Karnataka", "Bangalore", 12.9716, 77.5946),
        "57": ("Karnataka", "Mysore", 12.2958, 76.6394),
        "58": ("Karnataka", "Hubli", 15.3647, 75.1240),
        "59": ("Karnataka", "Mangalore", 12.9141, 74.8560),
        # Tamil Nadu
        "60": ("Tamil Nadu", "Chennai", 13.0827, 80.2707),
        "62": ("Tamil Nadu", "Madurai", 9.9252, 78.1198),
        "64": ("Tamil Nadu", "Coimbatore", 11.0168, 76.9558),
        # Kerala
        "67": ("Kerala", "Kozhikode", 11.2588, 75.7804),
        "68": ("Kerala", "Ernakulam", 9.9312, 76.2673),
        "69": ("Kerala", "Thiruvananthapuram", 8.5241, 76.9366),
        # West Bengal
        "70": ("West Bengal", "Kolkata", 22.5726, 88.3639),
        "73": ("West Bengal", "Siliguri", 26.7271, 88.3953),
        # Odisha
        "75": ("Odisha", "Bhubaneswar", 20.2961, 85.8245),
        "76": ("Odisha", "Cuttack", 20.4625, 85.8830),
        # Assam & NE
        "78": ("Assam", "Guwahati", 26.1445, 91.7362),
        # Bihar
        "80": ("Bihar", "Patna", 25.6117, 85.1376),
        "81": ("Bihar", "Gaya", 24.7955, 85.0002),
        "82": ("Bihar", "Muzaffarpur", 26.1225, 85.3906),
        # Jharkhand
        "83": ("Jharkhand", "Ranchi", 23.3441, 85.3096),
        # Goa
        "40": ("Goa", "Panaji", 15.4909, 73.8278),  # Some Goa pincodes start with 40
    }
    
    if prefix in state_map:
        state, district, lat, lng = state_map[prefix]
        return {
            "success": True,
            "source": "estimated",
            "pincode": pincode,
            "state": state,
            "district": district,
            "area": f"Area near {district}",
            "locations": [LocationInfo(
                pincode=pincode,
                state=state,
                district=district,
                area=f"Area near {district}",
                latitude=lat,
                longitude=lng
            )],
            "latitude": lat,
            "longitude": lng,
            "warning": "Estimated location based on PIN code region - verify before booking"
        }
    
    # Ultimate fallback - return center of India with warning
    return {
        "success": True,
        "source": "default_fallback",
        "pincode": pincode,
        "state": "India",
        "district": "Unknown",
        "area": f"Area {pincode}",
        "locations": [LocationInfo(
            pincode=pincode,
            state="India",
            district="Unknown",
            area=f"Area {pincode}",
            latitude=20.5937,  # Center of India
            longitude=78.9629
        )],
        "latitude": 20.5937,
        "longitude": 78.9629,
        "warning": "Location could not be determined precisely - please verify coordinates before booking"
    }

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
