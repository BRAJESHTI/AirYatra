"""
Weather Service
Fetch live weather data for pre-flight checks using OpenWeatherMap API
"""
import httpx
import os
from datetime import datetime, timezone
from typing import Dict, Any, Optional

# OpenWeatherMap API (free tier)
OPENWEATHERMAP_API_KEY = os.environ.get("OPENWEATHERMAP_API_KEY", "")
OPENWEATHERMAP_BASE_URL = "https://api.openweathermap.org/data/2.5"

# Major Indian aviation locations with coordinates
INDIAN_AIRPORTS = {
    "Mumbai": {"lat": 19.0896, "lon": 72.8656, "icao": "VABB"},
    "Delhi": {"lat": 28.5562, "lon": 77.1000, "icao": "VIDP"},
    "Bangalore": {"lat": 13.1986, "lon": 77.7066, "icao": "VOBL"},
    "Chennai": {"lat": 12.9941, "lon": 80.1707, "icao": "VOMM"},
    "Hyderabad": {"lat": 17.2403, "lon": 78.4294, "icao": "VOHS"},
    "Kolkata": {"lat": 22.6547, "lon": 88.4467, "icao": "VECC"},
    "Pune": {"lat": 18.5822, "lon": 73.9197, "icao": "VAPO"},
    "Ahmedabad": {"lat": 23.0772, "lon": 72.6347, "icao": "VAAH"},
    "Goa": {"lat": 15.3808, "lon": 73.8314, "icao": "VAGO"},
    "Jaipur": {"lat": 26.8242, "lon": 75.8122, "icao": "VIJP"},
    "Srinagar": {"lat": 33.9871, "lon": 74.7742, "icao": "VISR"},
    "Leh": {"lat": 34.1359, "lon": 77.5465, "icao": "VILH"},
    "Shimla": {"lat": 31.0818, "lon": 77.0681, "icao": "VISM"},
    "Kedarnath": {"lat": 30.7352, "lon": 79.0669, "icao": "VIDN"},
    "Vaishno Devi": {"lat": 33.0314, "lon": 74.9500, "icao": "VIKJ"},
    "Shirdi": {"lat": 19.6893, "lon": 74.3787, "icao": "VASD"},
    "Tirupati": {"lat": 13.6288, "lon": 79.5433, "icao": "VOTP"},
    "Agra": {"lat": 27.1575, "lon": 77.9608, "icao": "VIAG"},
    "Coorg": {"lat": 12.4244, "lon": 75.7382, "icao": "VOCG"},
}


class WeatherService:
    """Weather data fetcher for aviation"""
    
    def __init__(self):
        self.api_key = OPENWEATHERMAP_API_KEY
        self.base_url = OPENWEATHERMAP_BASE_URL
    
    async def get_weather(self, location: str) -> Dict[str, Any]:
        """
        Get weather data for a location
        
        Args:
            location: City name or airport code
            
        Returns:
            Weather data with aviation-relevant info
        """
        # Find location coordinates
        coords = INDIAN_AIRPORTS.get(location)
        
        if not coords:
            # Try to find by partial match
            for city, data in INDIAN_AIRPORTS.items():
                if location.lower() in city.lower():
                    coords = data
                    location = city
                    break
        
        if not coords:
            # Default to Mumbai if not found
            coords = INDIAN_AIRPORTS["Mumbai"]
            location = "Mumbai"
        
        # If no API key, return mock data
        if not self.api_key:
            return self._generate_mock_weather(location, coords)
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.base_url}/weather",
                    params={
                        "lat": coords["lat"],
                        "lon": coords["lon"],
                        "appid": self.api_key,
                        "units": "metric"
                    },
                    timeout=10
                )
                
                if response.status_code == 200:
                    data = response.json()
                    return self._parse_weather_response(data, location, coords)
                else:
                    return self._generate_mock_weather(location, coords)
        except Exception as e:
            print(f"Weather API error: {e}")
            return self._generate_mock_weather(location, coords)
    
    def _parse_weather_response(self, data: Dict, location: str, coords: Dict) -> Dict[str, Any]:
        """Parse OpenWeatherMap response into aviation-friendly format"""
        main = data.get("main", {})
        wind = data.get("wind", {})
        weather = data.get("weather", [{}])[0]
        clouds = data.get("clouds", {})
        visibility = data.get("visibility", 10000)  # meters
        
        # Calculate flight conditions
        temp_c = main.get("temp", 25)
        wind_speed_mps = wind.get("speed", 0)
        wind_speed_knots = wind_speed_mps * 1.944  # Convert m/s to knots
        visibility_km = visibility / 1000
        cloud_cover = clouds.get("all", 0)
        
        # Determine flight suitability
        conditions = self._assess_flight_conditions(
            temp_c, wind_speed_knots, visibility_km, cloud_cover, weather.get("main", "")
        )
        
        return {
            "location": location,
            "icao": coords.get("icao", ""),
            "coordinates": {"lat": coords["lat"], "lon": coords["lon"]},
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "temperature": {
                "celsius": round(temp_c, 1),
                "fahrenheit": round(temp_c * 9/5 + 32, 1)
            },
            "humidity": main.get("humidity", 50),
            "pressure": main.get("pressure", 1013),
            "wind": {
                "speed_knots": round(wind_speed_knots, 1),
                "speed_mps": round(wind_speed_mps, 1),
                "direction": wind.get("deg", 0),
                "gusts_knots": round(wind.get("gust", 0) * 1.944, 1) if wind.get("gust") else None
            },
            "visibility": {
                "meters": visibility,
                "kilometers": round(visibility_km, 1),
                "miles": round(visibility_km * 0.621, 1)
            },
            "clouds": {
                "coverage_percent": cloud_cover,
                "description": weather.get("description", "clear sky")
            },
            "weather_condition": weather.get("main", "Clear"),
            "weather_icon": weather.get("icon", "01d"),
            "flight_conditions": conditions,
            "source": "openweathermap"
        }
    
    def _generate_mock_weather(self, location: str, coords: Dict) -> Dict[str, Any]:
        """Generate realistic mock weather data"""
        import random
        
        # Base conditions on location
        is_mountain = location in ["Srinagar", "Leh", "Shimla", "Kedarnath"]
        is_coastal = location in ["Mumbai", "Chennai", "Goa", "Kolkata"]
        
        if is_mountain:
            temp = random.randint(5, 20)
            wind = random.randint(10, 25)
            visibility = random.randint(5, 15)
        elif is_coastal:
            temp = random.randint(25, 35)
            wind = random.randint(8, 18)
            visibility = random.randint(8, 20)
        else:
            temp = random.randint(20, 38)
            wind = random.randint(5, 15)
            visibility = random.randint(10, 25)
        
        cloud_cover = random.randint(0, 60)
        humidity = random.randint(40, 80)
        
        conditions = self._assess_flight_conditions(temp, wind, visibility, cloud_cover, "Clear")
        
        return {
            "location": location,
            "icao": coords.get("icao", ""),
            "coordinates": {"lat": coords["lat"], "lon": coords["lon"]},
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "temperature": {
                "celsius": temp,
                "fahrenheit": round(temp * 9/5 + 32, 1)
            },
            "humidity": humidity,
            "pressure": random.randint(1008, 1018),
            "wind": {
                "speed_knots": wind,
                "speed_mps": round(wind / 1.944, 1),
                "direction": random.randint(0, 360),
                "gusts_knots": wind + random.randint(0, 5) if random.random() > 0.7 else None
            },
            "visibility": {
                "meters": visibility * 1000,
                "kilometers": visibility,
                "miles": round(visibility * 0.621, 1)
            },
            "clouds": {
                "coverage_percent": cloud_cover,
                "description": "partly cloudy" if cloud_cover > 30 else "clear sky"
            },
            "weather_condition": "Clouds" if cloud_cover > 50 else "Clear",
            "weather_icon": "02d" if cloud_cover > 30 else "01d",
            "flight_conditions": conditions,
            "source": "simulated"
        }
    
    def _assess_flight_conditions(
        self, 
        temp_c: float, 
        wind_knots: float, 
        visibility_km: float, 
        cloud_cover: int,
        weather_main: str
    ) -> Dict[str, Any]:
        """Assess flight conditions based on weather parameters"""
        warnings = []
        status = "GO"  # GO, CAUTION, NO-GO
        
        # Wind assessment
        if wind_knots > 30:
            warnings.append("High winds - exceeds helicopter limits")
            status = "NO-GO"
        elif wind_knots > 20:
            warnings.append("Strong winds - exercise caution")
            if status != "NO-GO":
                status = "CAUTION"
        
        # Visibility assessment (VFR minimums)
        if visibility_km < 3:
            warnings.append("Poor visibility - below VFR minimums")
            status = "NO-GO"
        elif visibility_km < 5:
            warnings.append("Reduced visibility - marginal VFR")
            if status != "NO-GO":
                status = "CAUTION"
        
        # Cloud cover
        if cloud_cover > 80:
            warnings.append("Heavy cloud cover - IFR conditions possible")
            if status != "NO-GO":
                status = "CAUTION"
        
        # Weather conditions
        if weather_main in ["Thunderstorm", "Squall"]:
            warnings.append("Thunderstorm activity - avoid area")
            status = "NO-GO"
        elif weather_main in ["Rain", "Drizzle", "Snow"]:
            warnings.append(f"{weather_main} reported - reduced visibility expected")
            if status != "NO-GO":
                status = "CAUTION"
        elif weather_main == "Fog":
            warnings.append("Fog reported - poor visibility")
            status = "NO-GO"
        
        # Temperature
        if temp_c > 45:
            warnings.append("Extreme heat - reduced aircraft performance")
            if status != "NO-GO":
                status = "CAUTION"
        elif temp_c < 0:
            warnings.append("Freezing conditions - icing possible")
            if status != "NO-GO":
                status = "CAUTION"
        
        return {
            "status": status,
            "status_color": {"GO": "#22c55e", "CAUTION": "#f59e0b", "NO-GO": "#ef4444"}[status],
            "warnings": warnings,
            "safe_to_fly": status == "GO",
            "requires_review": status == "CAUTION",
            "vfr_possible": visibility_km >= 5 and cloud_cover < 70,
            "assessment": "Good conditions for VFR flight" if status == "GO" else 
                         "Review conditions before departure" if status == "CAUTION" else
                         "Flight not recommended"
        }
    
    async def get_route_weather(self, origin: str, destination: str) -> Dict[str, Any]:
        """Get weather for both origin and destination"""
        origin_weather = await self.get_weather(origin)
        dest_weather = await self.get_weather(destination)
        
        # Determine overall route status
        if origin_weather["flight_conditions"]["status"] == "NO-GO" or \
           dest_weather["flight_conditions"]["status"] == "NO-GO":
            overall_status = "NO-GO"
        elif origin_weather["flight_conditions"]["status"] == "CAUTION" or \
             dest_weather["flight_conditions"]["status"] == "CAUTION":
            overall_status = "CAUTION"
        else:
            overall_status = "GO"
        
        return {
            "origin": origin_weather,
            "destination": dest_weather,
            "route_status": overall_status,
            "route_safe": overall_status == "GO",
            "generated_at": datetime.now(timezone.utc).isoformat()
        }
    
    def get_flight_advisory(self, weather_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Generate flight safety advisory from weather data
        
        Returns:
            Advisory with safety level, messages, and recommendations
        """
        if not weather_data or not weather_data.get("success"):
            return {
                "level": "unknown",
                "can_fly": True,
                "icon": "❓",
                "message": "Weather data unavailable",
                "advisory": ["ℹ️ Check with operator for current conditions"]
            }
        
        current = weather_data.get("current", {})
        condition = current.get("description", "clear").lower()
        wind_speed = current.get("wind_speed", 0) * 3.6  # m/s to km/h
        visibility = current.get("visibility", 10000) / 1000  # m to km
        
        # Determine safety level
        level = "safe"
        icon = "☀️"
        messages = []
        
        # Check weather condition
        danger_conditions = ["thunderstorm", "tornado", "hurricane", "hail", "heavy rain", "blizzard"]
        warning_conditions = ["rain", "snow", "fog", "mist", "storm"]
        caution_conditions = ["overcast", "cloudy", "drizzle"]
        
        for cond in danger_conditions:
            if cond in condition:
                level = "danger"
                icon = "⛈️"
                messages.append(f"🔴 Severe weather: {condition.title()}")
                break
        
        if level == "safe":
            for cond in warning_conditions:
                if cond in condition:
                    level = "warning"
                    icon = "🌧️"
                    messages.append(f"🟠 Weather alert: {condition.title()}")
                    break
        
        if level == "safe":
            for cond in caution_conditions:
                if cond in condition:
                    level = "caution"
                    icon = "☁️"
                    messages.append(f"⚠️ {condition.title()} conditions")
                    break
        
        # Check wind
        if wind_speed > 70:
            level = "danger"
            messages.append(f"🔴 Dangerous winds: {wind_speed:.0f} km/h")
        elif wind_speed > 50:
            if level in ["safe", "caution"]:
                level = "warning"
            messages.append(f"🟠 Strong winds: {wind_speed:.0f} km/h")
        elif wind_speed > 30:
            messages.append(f"💨 Moderate winds: {wind_speed:.0f} km/h")
        
        # Check visibility
        if visibility < 1:
            level = "danger"
            messages.append("🔴 Very poor visibility (<1km)")
        elif visibility < 3:
            if level in ["safe", "caution"]:
                level = "warning"
            messages.append("🟠 Reduced visibility (<3km)")
        
        # Build advisory
        advisory = []
        if level == "safe":
            advisory.append("✅ Weather conditions are favorable for your flight")
            icon = "☀️"
        elif level == "caution":
            advisory.append("⚠️ Minor weather conditions - slight delays possible")
            advisory.append("🛫 Flight expected to operate normally")
            icon = "⛅"
        elif level == "warning":
            advisory.append("🟠 Weather may significantly impact your flight")
            advisory.append("📞 Confirm with operator before departure")
            icon = "🌧️"
        else:  # danger
            advisory.append("🔴 Severe weather conditions detected")
            advisory.append("⛔ Flight may be rescheduled for safety")
            advisory.append("📞 Contact AirYatra support: +91-22-12345678")
            icon = "⛈️"
        
        return {
            "level": level,
            "can_fly": level in ["safe", "caution"],
            "icon": icon,
            "message": messages[0] if messages else "Weather conditions acceptable",
            "details": messages,
            "advisory": advisory
        }


# Singleton instance
weather_service = WeatherService()
