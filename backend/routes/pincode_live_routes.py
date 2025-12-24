from fastapi import APIRouter, HTTPException
from typing import Optional
import httpx
import logging
from database import get_database

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/pincode", tags=["PIN Code Service"])

# Hardcoded PIN code data for fallback
INDIAN_PINCODES = {
    "110001": {"area": "Connaught Place", "district": "New Delhi", "state": "Delhi", "latitude": 28.6315, "longitude": 77.2167},
    "400001": {"area": "Fort", "district": "Mumbai", "state": "Maharashtra", "latitude": 18.9338, "longitude": 72.8354},
    "600001": {"area": "Parrys", "district": "Chennai", "state": "Tamil Nadu", "latitude": 13.0878, "longitude": 80.2785},
    "700001": {"area": "BBD Bag", "district": "Kolkata", "state": "West Bengal", "latitude": 22.5726, "longitude": 88.3639},
    "560001": {"area": "MG Road", "district": "Bangalore", "state": "Karnataka", "latitude": 12.9716, "longitude": 77.5946},
    "500001": {"area": "Abids", "district": "Hyderabad", "state": "Telangana", "latitude": 17.3850, "longitude": 78.4867},
    "380001": {"area": "Lal Darwaja", "district": "Ahmedabad", "state": "Gujarat", "latitude": 23.0225, "longitude": 72.5714},
    "302001": {"area": "Pink City", "district": "Jaipur", "state": "Rajasthan", "latitude": 26.9124, "longitude": 75.7873},
    "226001": {"area": "Hazratganj", "district": "Lucknow", "state": "Uttar Pradesh", "latitude": 26.8467, "longitude": 80.9462},
    "411001": {"area": "Shivaji Nagar", "district": "Pune", "state": "Maharashtra", "latitude": 18.5204, "longitude": 73.8567},
    "201301": {"area": "Sector 1", "district": "Noida", "state": "Uttar Pradesh", "latitude": 28.5355, "longitude": 77.3910},
    "122001": {"area": "Sector 14", "district": "Gurgaon", "state": "Haryana", "latitude": 28.4595, "longitude": 77.0266},
    "452001": {"area": "Rajwada", "district": "Indore", "state": "Madhya Pradesh", "latitude": 22.7196, "longitude": 75.8577},
    "440001": {"area": "Sitabuldi", "district": "Nagpur", "state": "Maharashtra", "latitude": 21.1458, "longitude": 79.0882},
    "682001": {"area": "Fort Kochi", "district": "Ernakulam", "state": "Kerala", "latitude": 9.9312, "longitude": 76.2673},
    "180001": {"area": "Gandhi Nagar", "district": "Jammu", "state": "Jammu & Kashmir", "latitude": 32.7266, "longitude": 74.8570},
    "190001": {"area": "Lal Chowk", "district": "Srinagar", "state": "Jammu & Kashmir", "latitude": 34.0837, "longitude": 74.7973},
    "171001": {"area": "Mall Road", "district": "Shimla", "state": "Himachal Pradesh", "latitude": 31.1048, "longitude": 77.1734},
    "248001": {"area": "Rajpur Road", "district": "Dehradun", "state": "Uttarakhand", "latitude": 30.3165, "longitude": 78.0322},
    "403001": {"area": "Panjim", "district": "North Goa", "state": "Goa", "latitude": 15.4989, "longitude": 73.8278},
}

# Live API endpoints
POSTAL_API_URL = "https://api.postalpincode.in/pincode"
INDIA_POST_API_URL = "https://api.data.gov.in/resource/6176ee09-3d56-4a3b-8115-21841576b2f6"

@router.get("/lookup/{pincode}")
async def lookup_pincode(pincode: str, use_live_api: bool = True):
    """
    Lookup PIN code details
    PIN कोड खोजें
    
    Tries live API first, falls back to hardcoded data
    """
    db = get_database()
    
    # Validate pincode format
    if not pincode or len(pincode) != 6 or not pincode.isdigit():
        raise HTTPException(status_code=400, detail="Invalid PIN code format. Must be 6 digits.")
    
    # Check cache first
    cached = await db.pincode_cache.find_one({"pincode": pincode}, {"_id": 0})
    if cached:
        return {
            "success": True,
            "source": "cache",
            "data": cached
        }
    
    # Try live API if enabled
    if use_live_api:
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                # Try Postal API first
                response = await client.get(f"{POSTAL_API_URL}/{pincode}")
                if response.status_code == 200:
                    api_data = response.json()
                    if api_data and len(api_data) > 0 and api_data[0].get("Status") == "Success":
                        post_offices = api_data[0].get("PostOffice", [])
                        if post_offices:
                            po = post_offices[0]  # Use first post office
                            location_data = {
                                "pincode": pincode,
                                "area": po.get("Name", ""),
                                "district": po.get("District", ""),
                                "state": po.get("State", ""),
                                "region": po.get("Region", ""),
                                "division": po.get("Division", ""),
                                "latitude": None,  # API doesn't provide coordinates
                                "longitude": None,
                                "post_offices": [{
                                    "name": p.get("Name"),
                                    "branch_type": p.get("BranchType"),
                                    "delivery_status": p.get("DeliveryStatus")
                                } for p in post_offices[:5]]
                            }
                            
                            # Try to get coordinates from hardcoded data or estimate
                            if pincode in INDIAN_PINCODES:
                                location_data["latitude"] = INDIAN_PINCODES[pincode]["latitude"]
                                location_data["longitude"] = INDIAN_PINCODES[pincode]["longitude"]
                            else:
                                # Estimate coordinates based on state capital
                                state_coords = get_state_coordinates(po.get("State", ""))
                                if state_coords:
                                    location_data["latitude"] = state_coords["latitude"]
                                    location_data["longitude"] = state_coords["longitude"]
                            
                            # Cache the result
                            await db.pincode_cache.update_one(
                                {"pincode": pincode},
                                {"$set": location_data},
                                upsert=True
                            )
                            
                            return {
                                "success": True,
                                "source": "live_api",
                                "data": location_data
                            }
        except httpx.TimeoutException:
            logger.warning(f"Live API timeout for {pincode}, using fallback")
        except Exception as e:
            logger.warning(f"Live API failed for {pincode}: {e}")
    
    # Fallback to hardcoded data
    if pincode in INDIAN_PINCODES:
        location_data = {
            "pincode": pincode,
            **INDIAN_PINCODES[pincode]
        }
        return {
            "success": True,
            "source": "hardcoded",
            "data": location_data
        }
    
    # Generate approximate data for unknown pincodes
    state_code = pincode[:2]
    state_info = get_state_by_pincode_prefix(state_code)
    
    if state_info:
        return {
            "success": True,
            "source": "estimated",
            "data": {
                "pincode": pincode,
                "area": f"Area {pincode}",
                "district": state_info["district"],
                "state": state_info["state"],
                "latitude": state_info["latitude"],
                "longitude": state_info["longitude"]
            },
            "warning": "Approximate location - verify before booking"
        }
    
    raise HTTPException(status_code=404, detail=f"PIN code {pincode} not found")

def get_state_coordinates(state: str) -> dict:
    """Get approximate coordinates for Indian states"""
    state_coords = {
        "Delhi": {"latitude": 28.6139, "longitude": 77.2090},
        "Maharashtra": {"latitude": 19.0760, "longitude": 72.8777},
        "Karnataka": {"latitude": 12.9716, "longitude": 77.5946},
        "Tamil Nadu": {"latitude": 13.0827, "longitude": 80.2707},
        "West Bengal": {"latitude": 22.5726, "longitude": 88.3639},
        "Telangana": {"latitude": 17.3850, "longitude": 78.4867},
        "Gujarat": {"latitude": 23.0225, "longitude": 72.5714},
        "Rajasthan": {"latitude": 26.9124, "longitude": 75.7873},
        "Uttar Pradesh": {"latitude": 26.8467, "longitude": 80.9462},
        "Madhya Pradesh": {"latitude": 23.2599, "longitude": 77.4126},
        "Kerala": {"latitude": 8.5241, "longitude": 76.9366},
        "Punjab": {"latitude": 31.1471, "longitude": 75.3412},
        "Haryana": {"latitude": 28.4595, "longitude": 77.0266},
        "Bihar": {"latitude": 25.6117, "longitude": 85.1376},
        "Odisha": {"latitude": 20.2961, "longitude": 85.8245},
        "Assam": {"latitude": 26.1445, "longitude": 91.7362},
        "Jharkhand": {"latitude": 23.3441, "longitude": 85.3096},
        "Uttarakhand": {"latitude": 30.3165, "longitude": 78.0322},
        "Himachal Pradesh": {"latitude": 31.1048, "longitude": 77.1734},
        "Goa": {"latitude": 15.2993, "longitude": 74.1240},
        "Jammu & Kashmir": {"latitude": 33.7782, "longitude": 76.5762},
    }
    return state_coords.get(state)

def get_state_by_pincode_prefix(prefix: str) -> dict:
    """Get state info by PIN code prefix"""
    prefix_map = {
        "11": {"state": "Delhi", "district": "Delhi", "latitude": 28.6139, "longitude": 77.2090},
        "12": {"state": "Haryana", "district": "Gurgaon", "latitude": 28.4595, "longitude": 77.0266},
        "13": {"state": "Punjab", "district": "Chandigarh", "latitude": 30.7333, "longitude": 76.7794},
        "14": {"state": "Punjab", "district": "Amritsar", "latitude": 31.6340, "longitude": 74.8723},
        "15": {"state": "Punjab", "district": "Ludhiana", "latitude": 30.9010, "longitude": 75.8573},
        "16": {"state": "Punjab", "district": "Jalandhar", "latitude": 31.3260, "longitude": 75.5762},
        "17": {"state": "Himachal Pradesh", "district": "Shimla", "latitude": 31.1048, "longitude": 77.1734},
        "18": {"state": "Jammu & Kashmir", "district": "Jammu", "latitude": 32.7266, "longitude": 74.8570},
        "19": {"state": "Jammu & Kashmir", "district": "Srinagar", "latitude": 34.0837, "longitude": 74.7973},
        "20": {"state": "Uttar Pradesh", "district": "Noida", "latitude": 28.5355, "longitude": 77.3910},
        "21": {"state": "Uttar Pradesh", "district": "Agra", "latitude": 27.1767, "longitude": 78.0081},
        "22": {"state": "Uttar Pradesh", "district": "Lucknow", "latitude": 26.8467, "longitude": 80.9462},
        "23": {"state": "Uttar Pradesh", "district": "Varanasi", "latitude": 25.3176, "longitude": 82.9739},
        "24": {"state": "Uttarakhand", "district": "Dehradun", "latitude": 30.3165, "longitude": 78.0322},
        "25": {"state": "Uttar Pradesh", "district": "Allahabad", "latitude": 25.4358, "longitude": 81.8463},
        "26": {"state": "Uttar Pradesh", "district": "Kanpur", "latitude": 26.4499, "longitude": 80.3319},
        "27": {"state": "Uttar Pradesh", "district": "Bareilly", "latitude": 28.3670, "longitude": 79.4304},
        "28": {"state": "Uttar Pradesh", "district": "Meerut", "latitude": 28.9845, "longitude": 77.7064},
        "30": {"state": "Rajasthan", "district": "Jaipur", "latitude": 26.9124, "longitude": 75.7873},
        "31": {"state": "Rajasthan", "district": "Bikaner", "latitude": 28.0229, "longitude": 73.3119},
        "32": {"state": "Rajasthan", "district": "Jodhpur", "latitude": 26.2389, "longitude": 73.0243},
        "33": {"state": "Rajasthan", "district": "Udaipur", "latitude": 24.5854, "longitude": 73.7125},
        "34": {"state": "Rajasthan", "district": "Kota", "latitude": 25.2138, "longitude": 75.8648},
        "36": {"state": "Gujarat", "district": "Surat", "latitude": 21.1702, "longitude": 72.8311},
        "37": {"state": "Gujarat", "district": "Vadodara", "latitude": 22.3072, "longitude": 73.1812},
        "38": {"state": "Gujarat", "district": "Ahmedabad", "latitude": 23.0225, "longitude": 72.5714},
        "39": {"state": "Gujarat", "district": "Rajkot", "latitude": 22.3039, "longitude": 70.8022},
        "40": {"state": "Maharashtra", "district": "Mumbai", "latitude": 19.0760, "longitude": 72.8777},
        "41": {"state": "Maharashtra", "district": "Pune", "latitude": 18.5204, "longitude": 73.8567},
        "42": {"state": "Maharashtra", "district": "Nashik", "latitude": 19.9975, "longitude": 73.7898},
        "43": {"state": "Maharashtra", "district": "Aurangabad", "latitude": 19.8762, "longitude": 75.3433},
        "44": {"state": "Maharashtra", "district": "Nagpur", "latitude": 21.1458, "longitude": 79.0882},
        "45": {"state": "Madhya Pradesh", "district": "Indore", "latitude": 22.7196, "longitude": 75.8577},
        "46": {"state": "Madhya Pradesh", "district": "Bhopal", "latitude": 23.2599, "longitude": 77.4126},
        "47": {"state": "Madhya Pradesh", "district": "Jabalpur", "latitude": 23.1815, "longitude": 79.9864},
        "48": {"state": "Madhya Pradesh", "district": "Gwalior", "latitude": 26.2183, "longitude": 78.1828},
        "49": {"state": "Chhattisgarh", "district": "Raipur", "latitude": 21.2514, "longitude": 81.6296},
        "50": {"state": "Telangana", "district": "Hyderabad", "latitude": 17.3850, "longitude": 78.4867},
        "51": {"state": "Telangana", "district": "Warangal", "latitude": 17.9784, "longitude": 79.6000},
        "52": {"state": "Andhra Pradesh", "district": "Vijayawada", "latitude": 16.5062, "longitude": 80.6480},
        "53": {"state": "Andhra Pradesh", "district": "Visakhapatnam", "latitude": 17.6868, "longitude": 83.2185},
        "56": {"state": "Karnataka", "district": "Bangalore", "latitude": 12.9716, "longitude": 77.5946},
        "57": {"state": "Karnataka", "district": "Mysore", "latitude": 12.2958, "longitude": 76.6394},
        "58": {"state": "Karnataka", "district": "Hubli", "latitude": 15.3647, "longitude": 75.1240},
        "59": {"state": "Karnataka", "district": "Mangalore", "latitude": 12.9141, "longitude": 74.8560},
        "60": {"state": "Tamil Nadu", "district": "Chennai", "latitude": 13.0827, "longitude": 80.2707},
        "62": {"state": "Tamil Nadu", "district": "Madurai", "latitude": 9.9252, "longitude": 78.1198},
        "64": {"state": "Tamil Nadu", "district": "Coimbatore", "latitude": 11.0168, "longitude": 76.9558},
        "67": {"state": "Kerala", "district": "Kozhikode", "latitude": 11.2588, "longitude": 75.7804},
        "68": {"state": "Kerala", "district": "Ernakulam", "latitude": 9.9312, "longitude": 76.2673},
        "69": {"state": "Kerala", "district": "Thiruvananthapuram", "latitude": 8.5241, "longitude": 76.9366},
        "70": {"state": "West Bengal", "district": "Kolkata", "latitude": 22.5726, "longitude": 88.3639},
        "73": {"state": "West Bengal", "district": "Siliguri", "latitude": 26.7271, "longitude": 88.3953},
        "75": {"state": "Odisha", "district": "Bhubaneswar", "latitude": 20.2961, "longitude": 85.8245},
        "78": {"state": "Assam", "district": "Guwahati", "latitude": 26.1445, "longitude": 91.7362},
        "80": {"state": "Bihar", "district": "Patna", "latitude": 25.6117, "longitude": 85.1376},
        "81": {"state": "Bihar", "district": "Gaya", "latitude": 24.7955, "longitude": 85.0002},
        "82": {"state": "Bihar", "district": "Muzaffarpur", "latitude": 26.1225, "longitude": 85.3906},
        "83": {"state": "Jharkhand", "district": "Ranchi", "latitude": 23.3441, "longitude": 85.3096},
    }
    return prefix_map.get(prefix)

@router.get("/search")
async def search_by_area(
    query: str,
    state: Optional[str] = None,
    limit: int = 10
):
    """Search PIN codes by area name"""
    db = get_database()
    
    search_query = {"area": {"$regex": query, "$options": "i"}}
    if state:
        search_query["state"] = {"$regex": state, "$options": "i"}
    
    results = await db.pincode_cache.find(search_query, {"_id": 0}).limit(limit).to_list(limit)
    
    # Also search in hardcoded data
    for pincode, data in INDIAN_PINCODES.items():
        if query.lower() in data["area"].lower() or query.lower() in data["district"].lower():
            if state and state.lower() not in data["state"].lower():
                continue
            if len(results) < limit:
                results.append({"pincode": pincode, **data})
    
    return {"results": results[:limit]}
