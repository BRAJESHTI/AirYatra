from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, timezone, timedelta
from uuid import uuid4
import httpx
import os
from database import get_database
from routes.auth_routes import get_current_user

router = APIRouter(prefix="/weather", tags=["Weather Integration"])

# Weather API Configuration
WEATHER_API_KEY = os.environ.get("OPENWEATHER_API_KEY", "")
WEATHER_API_URL = "https://api.openweathermap.org/data/2.5"

# Flight Safety Thresholds
FLIGHT_SAFETY_THRESHOLDS = {
    "visibility_min_km": 5,  # Minimum visibility in km
    "wind_speed_max_kmh": 50,  # Maximum wind speed in km/h
    "wind_gust_max_kmh": 65,  # Maximum gust speed
    "ceiling_min_ft": 1500,  # Minimum cloud ceiling in feet
    "temp_min_c": -10,  # Minimum temperature
    "temp_max_c": 45,  # Maximum temperature
    "precipitation_max_mm": 10,  # Max precipitation per hour
}

# Models
class LocationWeather(BaseModel):
    lat: float
    lon: float
    city: Optional[str] = None

class RouteWeatherRequest(BaseModel):
    origin_lat: float
    origin_lon: float
    origin_name: Optional[str] = None
    destination_lat: float
    destination_lon: float
    destination_name: Optional[str] = None
    journey_datetime: Optional[str] = None

class WeatherAlert(BaseModel):
    alert_type: str
    severity: str  # low, medium, high, critical
    message: str
    affected_location: str

# Helper Functions
def assess_flight_safety(weather_data: dict) -> dict:
    """Assess flight safety based on weather conditions"""
    alerts = []
    safety_score = 100
    
    # Visibility check
    visibility_km = weather_data.get("visibility", 10000) / 1000
    if visibility_km < FLIGHT_SAFETY_THRESHOLDS["visibility_min_km"]:
        safety_score -= 30
        alerts.append({
            "type": "visibility",
            "severity": "high" if visibility_km < 2 else "medium",
            "message": f"Low visibility: {visibility_km:.1f} km (min: {FLIGHT_SAFETY_THRESHOLDS['visibility_min_km']} km)",
            "value": visibility_km
        })
    
    # Wind check
    wind_speed = weather_data.get("wind", {}).get("speed", 0) * 3.6  # Convert m/s to km/h
    wind_gust = weather_data.get("wind", {}).get("gust", 0) * 3.6
    
    if wind_speed > FLIGHT_SAFETY_THRESHOLDS["wind_speed_max_kmh"]:
        safety_score -= 25
        alerts.append({
            "type": "wind",
            "severity": "high" if wind_speed > 60 else "medium",
            "message": f"High wind speed: {wind_speed:.0f} km/h (max: {FLIGHT_SAFETY_THRESHOLDS['wind_speed_max_kmh']} km/h)",
            "value": wind_speed
        })
    
    if wind_gust > FLIGHT_SAFETY_THRESHOLDS["wind_gust_max_kmh"]:
        safety_score -= 15
        alerts.append({
            "type": "gust",
            "severity": "high",
            "message": f"Strong gusts: {wind_gust:.0f} km/h",
            "value": wind_gust
        })
    
    # Weather condition check
    weather_main = weather_data.get("weather", [{}])[0].get("main", "").lower()
    weather_desc = weather_data.get("weather", [{}])[0].get("description", "")
    
    dangerous_conditions = ["thunderstorm", "tornado", "hurricane", "squall"]
    moderate_conditions = ["rain", "snow", "drizzle", "fog", "mist", "haze"]
    
    if any(cond in weather_main for cond in dangerous_conditions):
        safety_score -= 40
        alerts.append({
            "type": "severe_weather",
            "severity": "critical",
            "message": f"Dangerous weather: {weather_desc}",
            "value": weather_main
        })
    elif any(cond in weather_main for cond in moderate_conditions):
        safety_score -= 15
        alerts.append({
            "type": "weather_condition",
            "severity": "medium",
            "message": f"Weather condition: {weather_desc}",
            "value": weather_main
        })
    
    # Temperature check
    temp = weather_data.get("main", {}).get("temp", 25)
    if temp < FLIGHT_SAFETY_THRESHOLDS["temp_min_c"] or temp > FLIGHT_SAFETY_THRESHOLDS["temp_max_c"]:
        safety_score -= 10
        alerts.append({
            "type": "temperature",
            "severity": "low",
            "message": f"Extreme temperature: {temp:.0f}°C",
            "value": temp
        })
    
    # Determine overall status
    if safety_score >= 80:
        status = "safe"
        status_message = "Good flying conditions"
    elif safety_score >= 60:
        status = "caution"
        status_message = "Flyable with caution - monitor conditions"
    elif safety_score >= 40:
        status = "warning"
        status_message = "Marginal conditions - consider postponing"
    else:
        status = "danger"
        status_message = "Unsafe for flight - strongly advise postponing"
    
    return {
        "safety_score": max(0, safety_score),
        "status": status,
        "status_message": status_message,
        "alerts": alerts
    }

async def fetch_weather(lat: float, lon: float) -> dict:
    """Fetch weather from OpenWeatherMap API"""
    if not WEATHER_API_KEY:
        # Return mock data if no API key
        return get_mock_weather(lat, lon)
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{WEATHER_API_URL}/weather",
                params={
                    "lat": lat,
                    "lon": lon,
                    "appid": WEATHER_API_KEY,
                    "units": "metric"
                },
                timeout=10
            )
            
            if response.status_code == 200:
                return response.json()
            else:
                return get_mock_weather(lat, lon)
    except Exception:
        return get_mock_weather(lat, lon)

async def fetch_forecast(lat: float, lon: float, hours: int = 24) -> list:
    """Fetch weather forecast"""
    if not WEATHER_API_KEY:
        return get_mock_forecast(lat, lon, hours)
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{WEATHER_API_URL}/forecast",
                params={
                    "lat": lat,
                    "lon": lon,
                    "appid": WEATHER_API_KEY,
                    "units": "metric",
                    "cnt": hours // 3  # API returns 3-hour intervals
                },
                timeout=10
            )
            
            if response.status_code == 200:
                return response.json().get("list", [])
            else:
                return get_mock_forecast(lat, lon, hours)
    except Exception:
        return get_mock_forecast(lat, lon, hours)

def get_mock_weather(lat: float, lon: float) -> dict:
    """Generate mock weather data for demo"""
    import random
    
    conditions = [
        {"main": "Clear", "description": "clear sky", "icon": "01d"},
        {"main": "Clouds", "description": "scattered clouds", "icon": "03d"},
        {"main": "Clouds", "description": "broken clouds", "icon": "04d"},
        {"main": "Rain", "description": "light rain", "icon": "10d"},
    ]
    
    return {
        "weather": [random.choice(conditions)],
        "main": {
            "temp": random.randint(20, 35),
            "feels_like": random.randint(22, 38),
            "humidity": random.randint(40, 80),
            "pressure": random.randint(1000, 1020)
        },
        "visibility": random.randint(5000, 10000),
        "wind": {
            "speed": random.uniform(2, 15),
            "deg": random.randint(0, 360),
            "gust": random.uniform(5, 25)
        },
        "clouds": {"all": random.randint(0, 100)},
        "coord": {"lat": lat, "lon": lon},
        "dt": int(datetime.now().timestamp()),
        "name": "Location",
        "_mock": True
    }

def get_mock_forecast(lat: float, lon: float, hours: int) -> list:
    """Generate mock forecast data"""
    forecasts = []
    base_time = datetime.now(timezone.utc)
    
    for i in range(0, hours, 3):
        forecast_time = base_time + timedelta(hours=i)
        forecasts.append({
            "dt": int(forecast_time.timestamp()),
            "dt_txt": forecast_time.strftime("%Y-%m-%d %H:%M:%S"),
            **get_mock_weather(lat, lon)
        })
    
    return forecasts

# API Endpoints
@router.get("/current")
async def get_current_weather(
    lat: float = Query(..., ge=-90, le=90),
    lon: float = Query(..., ge=-180, le=180),
    include_safety: bool = True
):
    """Get current weather for a location"""
    weather = await fetch_weather(lat, lon)
    
    result = {
        "location": {
            "lat": lat,
            "lon": lon,
            "name": weather.get("name", "Unknown")
        },
        "current": {
            "condition": weather.get("weather", [{}])[0].get("main", "Unknown"),
            "description": weather.get("weather", [{}])[0].get("description", ""),
            "icon": weather.get("weather", [{}])[0].get("icon", "01d"),
            "temperature": weather.get("main", {}).get("temp"),
            "feels_like": weather.get("main", {}).get("feels_like"),
            "humidity": weather.get("main", {}).get("humidity"),
            "pressure": weather.get("main", {}).get("pressure"),
            "visibility_km": weather.get("visibility", 10000) / 1000,
            "wind_speed_kmh": round(weather.get("wind", {}).get("speed", 0) * 3.6, 1),
            "wind_direction": weather.get("wind", {}).get("deg"),
            "wind_gust_kmh": round(weather.get("wind", {}).get("gust", 0) * 3.6, 1),
            "clouds_percent": weather.get("clouds", {}).get("all", 0)
        },
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "is_mock": weather.get("_mock", False)
    }
    
    if include_safety:
        result["flight_safety"] = assess_flight_safety(weather)
    
    return result

@router.post("/route")
async def get_route_weather(request: RouteWeatherRequest):
    """Get weather for both origin and destination"""
    origin_weather = await fetch_weather(request.origin_lat, request.origin_lon)
    dest_weather = await fetch_weather(request.destination_lat, request.destination_lon)
    
    origin_safety = assess_flight_safety(origin_weather)
    dest_safety = assess_flight_safety(dest_weather)
    
    # Combined safety assessment
    combined_score = min(origin_safety["safety_score"], dest_safety["safety_score"])
    all_alerts = [
        {**a, "location": request.origin_name or "Origin"} for a in origin_safety["alerts"]
    ] + [
        {**a, "location": request.destination_name or "Destination"} for a in dest_safety["alerts"]
    ]
    
    if combined_score >= 80:
        overall_status = "safe"
        recommendation = "Good conditions for flight on this route"
    elif combined_score >= 60:
        overall_status = "caution"
        recommendation = "Flight possible but monitor weather closely"
    elif combined_score >= 40:
        overall_status = "warning"
        recommendation = "Consider postponing or alternative route"
    else:
        overall_status = "danger"
        recommendation = "Flight not recommended - unsafe conditions"
    
    return {
        "origin": {
            "name": request.origin_name or "Origin",
            "lat": request.origin_lat,
            "lon": request.origin_lon,
            "weather": {
                "condition": origin_weather.get("weather", [{}])[0].get("main"),
                "description": origin_weather.get("weather", [{}])[0].get("description"),
                "temperature": origin_weather.get("main", {}).get("temp"),
                "wind_speed_kmh": round(origin_weather.get("wind", {}).get("speed", 0) * 3.6, 1),
                "visibility_km": origin_weather.get("visibility", 10000) / 1000
            },
            "safety": origin_safety
        },
        "destination": {
            "name": request.destination_name or "Destination",
            "lat": request.destination_lat,
            "lon": request.destination_lon,
            "weather": {
                "condition": dest_weather.get("weather", [{}])[0].get("main"),
                "description": dest_weather.get("weather", [{}])[0].get("description"),
                "temperature": dest_weather.get("main", {}).get("temp"),
                "wind_speed_kmh": round(dest_weather.get("wind", {}).get("speed", 0) * 3.6, 1),
                "visibility_km": dest_weather.get("visibility", 10000) / 1000
            },
            "safety": dest_safety
        },
        "route_assessment": {
            "overall_status": overall_status,
            "combined_safety_score": combined_score,
            "recommendation": recommendation,
            "alerts": all_alerts,
            "alerts_count": len(all_alerts)
        },
        "journey_datetime": request.journey_datetime,
        "checked_at": datetime.now(timezone.utc).isoformat()
    }

@router.get("/forecast")
async def get_weather_forecast(
    lat: float = Query(..., ge=-90, le=90),
    lon: float = Query(..., ge=-180, le=180),
    hours: int = Query(24, ge=3, le=120)
):
    """Get weather forecast for a location"""
    forecasts = await fetch_forecast(lat, lon, hours)
    
    processed = []
    for f in forecasts:
        safety = assess_flight_safety(f)
        processed.append({
            "datetime": f.get("dt_txt"),
            "timestamp": f.get("dt"),
            "condition": f.get("weather", [{}])[0].get("main"),
            "description": f.get("weather", [{}])[0].get("description"),
            "temperature": f.get("main", {}).get("temp"),
            "wind_speed_kmh": round(f.get("wind", {}).get("speed", 0) * 3.6, 1),
            "visibility_km": f.get("visibility", 10000) / 1000,
            "safety_status": safety["status"],
            "safety_score": safety["safety_score"]
        })
    
    # Find best flight window
    best_window = max(processed, key=lambda x: x["safety_score"]) if processed else None
    
    return {
        "location": {"lat": lat, "lon": lon},
        "forecast": processed,
        "best_flight_window": best_window,
        "is_mock": not WEATHER_API_KEY
    }

@router.get("/alerts/active")
async def get_active_weather_alerts(current_user: dict = Depends(get_current_user)):
    """Get active weather alerts for upcoming bookings"""
    db = get_database()
    
    # Get upcoming bookings
    now = datetime.now(timezone.utc)
    upcoming_bookings = await db.bookings.find({
        "status": {"$in": ["confirmed", "pending"]},
        "journey_date": {"$gte": now.isoformat()[:10]}
    }, {"_id": 0}).to_list(50)
    
    alerts = []
    for booking in upcoming_bookings:
        # Get coordinates (simplified - would need geocoding in real app)
        origin_coords = booking.get("origin_coordinates", {})
        dest_coords = booking.get("destination_coordinates", {})
        
        if origin_coords.get("lat") and origin_coords.get("lon"):
            weather = await fetch_weather(origin_coords["lat"], origin_coords["lon"])
            safety = assess_flight_safety(weather)
            
            if safety["status"] in ["warning", "danger"]:
                alerts.append({
                    "booking_id": booking["id"],
                    "booking_number": booking.get("booking_number"),
                    "route": f"{booking.get('origin')} → {booking.get('destination')}",
                    "journey_date": booking.get("journey_date"),
                    "location": booking.get("origin"),
                    "weather_status": safety["status"],
                    "safety_score": safety["safety_score"],
                    "alerts": safety["alerts"][:3],
                    "recommendation": safety["status_message"]
                })
    
    return {
        "active_alerts": alerts,
        "total_alerts": len(alerts),
        "checked_at": datetime.now(timezone.utc).isoformat()
    }

# Admin Endpoints
@router.get("/admin/config")
async def get_weather_config(current_user: dict = Depends(get_current_user)):
    """Get weather configuration"""
    if "admin" not in current_user.get("roles", []):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    return {
        "api_configured": bool(WEATHER_API_KEY),
        "safety_thresholds": FLIGHT_SAFETY_THRESHOLDS,
        "api_provider": "OpenWeatherMap" if WEATHER_API_KEY else "Mock Data"
    }

@router.post("/admin/test")
async def test_weather_api(
    lat: float = 28.6139,  # Delhi
    lon: float = 77.2090,
    current_user: dict = Depends(get_current_user)
):
    """Test weather API connection"""
    if "admin" not in current_user.get("roles", []):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    weather = await fetch_weather(lat, lon)
    
    return {
        "status": "success",
        "api_configured": bool(WEATHER_API_KEY),
        "is_mock": weather.get("_mock", False),
        "sample_data": weather,
        "test_location": "Delhi, India"
    }
