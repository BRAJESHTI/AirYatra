from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, timezone, timedelta
from uuid import uuid4
import math
from database import get_database
from routes.auth_routes import get_current_user

router = APIRouter(prefix="/routes", tags=["Route Optimization"])

# India major helipad/airport coordinates (sample)
LOCATIONS = {
    "delhi": {"lat": 28.6139, "lon": 77.2090, "name": "Delhi"},
    "mumbai": {"lat": 19.0760, "lon": 72.8777, "name": "Mumbai"},
    "bangalore": {"lat": 12.9716, "lon": 77.5946, "name": "Bangalore"},
    "chennai": {"lat": 13.0827, "lon": 80.2707, "name": "Chennai"},
    "kolkata": {"lat": 22.5726, "lon": 88.3639, "name": "Kolkata"},
    "hyderabad": {"lat": 17.3850, "lon": 78.4867, "name": "Hyderabad"},
    "jaipur": {"lat": 26.9124, "lon": 75.7873, "name": "Jaipur"},
    "shimla": {"lat": 31.1048, "lon": 77.1734, "name": "Shimla"},
    "dehradun": {"lat": 30.3165, "lon": 78.0322, "name": "Dehradun"},
    "varanasi": {"lat": 25.3176, "lon": 82.9739, "name": "Varanasi"},
    "goa": {"lat": 15.2993, "lon": 74.1240, "name": "Goa"},
    "udaipur": {"lat": 24.5854, "lon": 73.7125, "name": "Udaipur"},
    "amritsar": {"lat": 31.6340, "lon": 74.8723, "name": "Amritsar"},
    "srinagar": {"lat": 34.0837, "lon": 74.7973, "name": "Srinagar"},
    "leh": {"lat": 34.1526, "lon": 77.5771, "name": "Leh"},
}

# Models
class RouteRequest(BaseModel):
    origin: str
    destination: str
    waypoints: List[str] = []  # Optional intermediate stops
    aircraft_type: Optional[str] = None
    optimize_for: str = "time"  # time, fuel, cost

class MultiStopRequest(BaseModel):
    locations: List[str]  # List of location names
    start_location: str
    return_to_start: bool = False
    optimize_for: str = "distance"  # distance, time

# Helper Functions
def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate great-circle distance between two points in km"""
    R = 6371  # Earth's radius in km
    
    lat1, lon1, lat2, lon2 = map(math.radians, [lat1, lon1, lat2, lon2])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    
    a = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon/2)**2
    c = 2 * math.asin(math.sqrt(a))
    
    return R * c

def estimate_flight_time(distance_km: float, aircraft_type: str = "helicopter") -> float:
    """Estimate flight time in minutes"""
    # Average speeds in km/h
    speeds = {
        "helicopter": 200,
        "light_helicopter": 180,
        "medium_helicopter": 220,
        "heavy_helicopter": 250,
        "fixed_wing": 400,
        "turboprop": 450,
        "jet": 800
    }
    speed = speeds.get(aircraft_type, 200)
    return (distance_km / speed) * 60  # Convert to minutes

def estimate_fuel_consumption(distance_km: float, aircraft_type: str = "helicopter") -> float:
    """Estimate fuel consumption in liters"""
    # Fuel consumption rates (liters per km)
    consumption_rates = {
        "helicopter": 1.5,
        "light_helicopter": 1.2,
        "medium_helicopter": 1.8,
        "heavy_helicopter": 2.5,
        "fixed_wing": 0.8,
        "turboprop": 1.0,
        "jet": 3.0
    }
    rate = consumption_rates.get(aircraft_type, 1.5)
    return distance_km * rate

def get_location_coords(location_name: str) -> dict:
    """Get coordinates for a location"""
    normalized = location_name.lower().strip()
    if normalized in LOCATIONS:
        return LOCATIONS[normalized]
    
    # Try partial match
    for key, value in LOCATIONS.items():
        if key in normalized or normalized in key:
            return value
    
    return None

def solve_tsp(locations: List[dict], start_idx: int = 0) -> List[int]:
    """Simple nearest neighbor TSP solver"""
    n = len(locations)
    if n <= 2:
        return list(range(n))
    
    visited = [False] * n
    route = [start_idx]
    visited[start_idx] = True
    
    current = start_idx
    for _ in range(n - 1):
        nearest = None
        min_dist = float('inf')
        
        for j in range(n):
            if not visited[j]:
                dist = haversine_distance(
                    locations[current]["lat"], locations[current]["lon"],
                    locations[j]["lat"], locations[j]["lon"]
                )
                if dist < min_dist:
                    min_dist = dist
                    nearest = j
        
        if nearest is not None:
            route.append(nearest)
            visited[nearest] = True
            current = nearest
    
    return route

# API Endpoints
@router.post("/optimize")
async def optimize_route(request: RouteRequest):
    """Optimize a route between two points"""
    origin_coords = get_location_coords(request.origin)
    dest_coords = get_location_coords(request.destination)
    
    if not origin_coords:
        raise HTTPException(status_code=400, detail=f"Unknown origin: {request.origin}")
    if not dest_coords:
        raise HTTPException(status_code=400, detail=f"Unknown destination: {request.destination}")
    
    # Calculate direct route
    direct_distance = haversine_distance(
        origin_coords["lat"], origin_coords["lon"],
        dest_coords["lat"], dest_coords["lon"]
    )
    
    direct_time = estimate_flight_time(direct_distance, request.aircraft_type or "helicopter")
    direct_fuel = estimate_fuel_consumption(direct_distance, request.aircraft_type or "helicopter")
    
    route_segments = [{
        "from": request.origin,
        "to": request.destination,
        "distance_km": round(direct_distance, 1),
        "estimated_time_min": round(direct_time, 0),
        "fuel_liters": round(direct_fuel, 1)
    }]
    
    # Process waypoints if any
    total_distance = direct_distance
    total_time = direct_time
    total_fuel = direct_fuel
    
    if request.waypoints:
        route_segments = []
        total_distance = 0
        total_time = 0
        total_fuel = 0
        
        all_points = [request.origin] + request.waypoints + [request.destination]
        
        for i in range(len(all_points) - 1):
            from_coords = get_location_coords(all_points[i])
            to_coords = get_location_coords(all_points[i + 1])
            
            if not from_coords or not to_coords:
                continue
            
            seg_distance = haversine_distance(
                from_coords["lat"], from_coords["lon"],
                to_coords["lat"], to_coords["lon"]
            )
            seg_time = estimate_flight_time(seg_distance, request.aircraft_type or "helicopter")
            seg_fuel = estimate_fuel_consumption(seg_distance, request.aircraft_type or "helicopter")
            
            route_segments.append({
                "from": all_points[i],
                "to": all_points[i + 1],
                "distance_km": round(seg_distance, 1),
                "estimated_time_min": round(seg_time, 0),
                "fuel_liters": round(seg_fuel, 1)
            })
            
            total_distance += seg_distance
            total_time += seg_time
            total_fuel += seg_fuel
    
    # Suggest alternative routes via major hubs
    alternatives = []
    potential_hubs = ["delhi", "mumbai", "bangalore", "hyderabad"]
    
    for hub in potential_hubs:
        if hub.lower() not in request.origin.lower() and hub.lower() not in request.destination.lower():
            hub_coords = LOCATIONS.get(hub)
            if hub_coords:
                dist1 = haversine_distance(
                    origin_coords["lat"], origin_coords["lon"],
                    hub_coords["lat"], hub_coords["lon"]
                )
                dist2 = haversine_distance(
                    hub_coords["lat"], hub_coords["lon"],
                    dest_coords["lat"], dest_coords["lon"]
                )
                total_alt = dist1 + dist2
                
                if total_alt < direct_distance * 1.5:  # Only if reasonable
                    alternatives.append({
                        "via": hub.title(),
                        "total_distance_km": round(total_alt, 1),
                        "estimated_time_min": round(estimate_flight_time(total_alt), 0),
                        "compared_to_direct": f"+{round((total_alt - direct_distance) / direct_distance * 100, 0)}%"
                    })
    
    return {
        "origin": {"name": request.origin, **origin_coords},
        "destination": {"name": request.destination, **dest_coords},
        "direct_route": {
            "distance_km": round(direct_distance, 1),
            "estimated_time_min": round(direct_time, 0),
            "fuel_liters": round(direct_fuel, 1)
        },
        "route_segments": route_segments,
        "totals": {
            "distance_km": round(total_distance, 1),
            "estimated_time_min": round(total_time, 0),
            "fuel_liters": round(total_fuel, 1),
            "estimated_cost": round(total_fuel * 100, 0)  # Assuming ₹100/liter
        },
        "alternative_routes": alternatives[:3],
        "aircraft_type": request.aircraft_type or "helicopter"
    }

@router.post("/multi-stop")
async def optimize_multi_stop(request: MultiStopRequest):
    """Optimize multi-stop route (TSP)"""
    locations_data = []
    
    for loc in request.locations:
        coords = get_location_coords(loc)
        if coords:
            locations_data.append({"name": loc, **coords})
    
    if len(locations_data) < 2:
        raise HTTPException(status_code=400, detail="Need at least 2 valid locations")
    
    # Find start index
    start_idx = 0
    for i, loc in enumerate(locations_data):
        if request.start_location.lower() in loc["name"].lower():
            start_idx = i
            break
    
    # Solve TSP
    optimized_order = solve_tsp(locations_data, start_idx)
    
    # Build optimized route
    optimized_route = [locations_data[i] for i in optimized_order]
    if request.return_to_start:
        optimized_route.append(optimized_route[0])
    
    # Calculate totals
    total_distance = 0
    total_time = 0
    segments = []
    
    for i in range(len(optimized_route) - 1):
        dist = haversine_distance(
            optimized_route[i]["lat"], optimized_route[i]["lon"],
            optimized_route[i+1]["lat"], optimized_route[i+1]["lon"]
        )
        time = estimate_flight_time(dist)
        
        segments.append({
            "from": optimized_route[i]["name"],
            "to": optimized_route[i+1]["name"],
            "distance_km": round(dist, 1),
            "time_min": round(time, 0)
        })
        
        total_distance += dist
        total_time += time
    
    return {
        "optimized_route": [loc["name"] for loc in optimized_route],
        "segments": segments,
        "totals": {
            "distance_km": round(total_distance, 1),
            "estimated_time_min": round(total_time, 0),
            "stops": len(optimized_route) - 1
        },
        "return_to_start": request.return_to_start
    }

@router.get("/locations")
async def get_available_locations():
    """Get list of available locations"""
    return {
        "locations": [
            {"id": key, **value}
            for key, value in LOCATIONS.items()
        ]
    }

@router.get("/distance")
async def calculate_distance(
    origin: str = Query(...),
    destination: str = Query(...)
):
    """Quick distance calculation"""
    origin_coords = get_location_coords(origin)
    dest_coords = get_location_coords(destination)
    
    if not origin_coords or not dest_coords:
        raise HTTPException(status_code=400, detail="Invalid locations")
    
    distance = haversine_distance(
        origin_coords["lat"], origin_coords["lon"],
        dest_coords["lat"], dest_coords["lon"]
    )
    
    return {
        "origin": origin,
        "destination": destination,
        "distance_km": round(distance, 1),
        "estimated_flight_time_min": round(estimate_flight_time(distance), 0)
    }
