"""
AirYatra - Distance Calculator Service
Calculates aviation distances, flight times, and route costs
"""

import math
import logging
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional, Tuple
from database import get_database

logger = logging.getLogger(__name__)

# Indian Airport Coordinates Database
INDIAN_AIRPORTS = {
    # Metro Cities
    "BOM": {"city": "Mumbai", "state": "Maharashtra", "lat": 19.0896, "lng": 72.8656, "landing_fee": 5000},
    "DEL": {"city": "Delhi", "state": "Delhi", "lat": 28.5562, "lng": 77.1000, "landing_fee": 6000},
    "BLR": {"city": "Bangalore", "state": "Karnataka", "lat": 13.1986, "lng": 77.7066, "landing_fee": 5000},
    "MAA": {"city": "Chennai", "state": "Tamil Nadu", "lat": 12.9941, "lng": 80.1709, "landing_fee": 4500},
    "CCU": {"city": "Kolkata", "state": "West Bengal", "lat": 22.6520, "lng": 88.4463, "landing_fee": 4500},
    "HYD": {"city": "Hyderabad", "state": "Telangana", "lat": 17.2403, "lng": 78.4294, "landing_fee": 5000},
    
    # Tier 2 Cities
    "PNQ": {"city": "Pune", "state": "Maharashtra", "lat": 18.5822, "lng": 73.9197, "landing_fee": 3500},
    "AMD": {"city": "Ahmedabad", "state": "Gujarat", "lat": 23.0225, "lng": 72.5714, "landing_fee": 3500},
    "JAI": {"city": "Jaipur", "state": "Rajasthan", "lat": 26.8242, "lng": 75.8122, "landing_fee": 3500},
    "GOI": {"city": "Goa", "state": "Goa", "lat": 15.3808, "lng": 73.8314, "landing_fee": 4000},
    "LKO": {"city": "Lucknow", "state": "Uttar Pradesh", "lat": 26.7606, "lng": 80.8893, "landing_fee": 3000},
    "COK": {"city": "Kochi", "state": "Kerala", "lat": 10.1520, "lng": 76.3915, "landing_fee": 3500},
    "IXC": {"city": "Chandigarh", "state": "Punjab", "lat": 30.6735, "lng": 76.7885, "landing_fee": 3000},
    "NAG": {"city": "Nagpur", "state": "Maharashtra", "lat": 21.0922, "lng": 79.0472, "landing_fee": 2500},
    "IDR": {"city": "Indore", "state": "Madhya Pradesh", "lat": 22.7218, "lng": 75.8010, "landing_fee": 2500},
    "BHO": {"city": "Bhopal", "state": "Madhya Pradesh", "lat": 23.2875, "lng": 77.3374, "landing_fee": 2500},
    "PAT": {"city": "Patna", "state": "Bihar", "lat": 25.5913, "lng": 85.0880, "landing_fee": 2500},
    "GAU": {"city": "Guwahati", "state": "Assam", "lat": 26.1061, "lng": 91.5859, "landing_fee": 3000},
    "SXR": {"city": "Srinagar", "state": "J&K", "lat": 33.9871, "lng": 74.7742, "landing_fee": 4000},
    "IXL": {"city": "Leh", "state": "Ladakh", "lat": 34.1359, "lng": 77.5465, "landing_fee": 5000},
    
    # Pilgrimage/Tourism
    "SAG": {"city": "Shirdi", "state": "Maharashtra", "lat": 19.6967, "lng": 74.3792, "landing_fee": 3000},
    "DED": {"city": "Dehradun", "state": "Uttarakhand", "lat": 30.1899, "lng": 78.1802, "landing_fee": 3500},
    "SLV": {"city": "Shimla", "state": "Himachal", "lat": 31.0818, "lng": 77.0689, "landing_fee": 4000},
    "IXJ": {"city": "Jammu", "state": "J&K", "lat": 32.6891, "lng": 74.8374, "landing_fee": 3500},
    "AGR": {"city": "Agra", "state": "Uttar Pradesh", "lat": 27.1575, "lng": 78.0281, "landing_fee": 3000},
    "VNS": {"city": "Varanasi", "state": "Uttar Pradesh", "lat": 25.4520, "lng": 82.8593, "landing_fee": 3000},
    "UDR": {"city": "Udaipur", "state": "Rajasthan", "lat": 24.6177, "lng": 73.8961, "landing_fee": 3500},
    "JDH": {"city": "Jodhpur", "state": "Rajasthan", "lat": 26.2511, "lng": 73.0486, "landing_fee": 3000},
    "TRV": {"city": "Thiruvananthapuram", "state": "Kerala", "lat": 8.4829, "lng": 76.9201, "landing_fee": 3500},
    "IXZ": {"city": "Port Blair", "state": "Andaman", "lat": 11.6412, "lng": 92.7297, "landing_fee": 4500},
    
    # Helicopter-specific
    "KJB": {"city": "Kedarnath", "state": "Uttarakhand", "lat": 30.7352, "lng": 79.0669, "landing_fee": 5000},
    "VDI": {"city": "Vaishno Devi", "state": "J&K", "lat": 33.0308, "lng": 74.9490, "landing_fee": 4500},
    "AMR": {"city": "Amarnath", "state": "J&K", "lat": 34.2167, "lng": 75.5000, "landing_fee": 5000},
}

# City to Airport Code Mapping
CITY_TO_AIRPORT = {
    "mumbai": "BOM", "delhi": "DEL", "bangalore": "BLR", "bengaluru": "BLR",
    "chennai": "MAA", "kolkata": "CCU", "hyderabad": "HYD", "pune": "PNQ",
    "ahmedabad": "AMD", "jaipur": "JAI", "goa": "GOI", "lucknow": "LKO",
    "kochi": "COK", "chandigarh": "IXC", "nagpur": "NAG", "indore": "IDR",
    "bhopal": "BHO", "patna": "PAT", "guwahati": "GAU", "srinagar": "SXR",
    "leh": "IXL", "shirdi": "SAG", "dehradun": "DED", "shimla": "SLV",
    "jammu": "IXJ", "agra": "AGR", "varanasi": "VNS", "udaipur": "UDR",
    "jodhpur": "JDH", "thiruvananthapuram": "TRV", "trivandrum": "TRV",
    "port blair": "IXZ", "kedarnath": "KJB", "vaishno devi": "VDI",
    "katra": "VDI", "amarnath": "AMR"
}

# Aircraft Performance Data
AIRCRAFT_PERFORMANCE = {
    "helicopter": {
        "cruise_speed_kmh": 220,
        "fuel_burn_lph": 180,  # Liters per hour
        "range_km": 600,
        "typical_altitude_ft": 5000
    },
    "light_helicopter": {
        "cruise_speed_kmh": 200,
        "fuel_burn_lph": 120,
        "range_km": 450,
        "typical_altitude_ft": 5000
    },
    "medium_helicopter": {
        "cruise_speed_kmh": 250,
        "fuel_burn_lph": 250,
        "range_km": 700,
        "typical_altitude_ft": 8000
    },
    "heavy_helicopter": {
        "cruise_speed_kmh": 280,
        "fuel_burn_lph": 400,
        "range_km": 900,
        "typical_altitude_ft": 10000
    },
    "turboprop": {
        "cruise_speed_kmh": 450,
        "fuel_burn_lph": 300,
        "range_km": 1500,
        "typical_altitude_ft": 25000
    },
    "light_jet": {
        "cruise_speed_kmh": 700,
        "fuel_burn_lph": 500,
        "range_km": 2500,
        "typical_altitude_ft": 35000
    },
    "small_aircraft": {
        "cruise_speed_kmh": 350,
        "fuel_burn_lph": 150,
        "range_km": 1200,
        "typical_altitude_ft": 15000
    }
}

# Current Fuel Prices (INR per liter) - ATF
FUEL_PRICES = {
    "default": 105,  # Default ATF price
    "BOM": 108,
    "DEL": 102,
    "BLR": 106,
    "MAA": 104,
    "HYD": 105,
    "CCU": 103
}


class DistanceCalculatorService:
    """Service for calculating aviation distances and costs"""
    
    def __init__(self):
        self.earth_radius_km = 6371
    
    def haversine_distance(self, lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """Calculate great-circle distance using Haversine formula"""
        lat1_rad = math.radians(lat1)
        lat2_rad = math.radians(lat2)
        delta_lat = math.radians(lat2 - lat1)
        delta_lon = math.radians(lon2 - lon1)
        
        a = math.sin(delta_lat/2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lon/2)**2
        c = 2 * math.asin(math.sqrt(a))
        
        return self.earth_radius_km * c
    
    def get_airport_code(self, location: str) -> Optional[str]:
        """Get airport code from city name or code"""
        if not location:
            return None
        
        # If already an airport code
        location_upper = location.upper()
        if location_upper in INDIAN_AIRPORTS:
            return location_upper
        
        # Try city name lookup
        location_lower = location.lower().strip()
        return CITY_TO_AIRPORT.get(location_lower)
    
    def get_airport_info(self, code_or_city: str) -> Optional[Dict]:
        """Get airport information by code or city name"""
        code = self.get_airport_code(code_or_city)
        if code and code in INDIAN_AIRPORTS:
            info = INDIAN_AIRPORTS[code].copy()
            info["code"] = code
            return info
        return None
    
    def calculate_aviation_distance(
        self,
        from_location: str,
        to_location: str,
        aircraft_type: str = "helicopter"
    ) -> Dict[str, Any]:
        """
        Calculate aviation distance between two locations
        Returns distance, flight time, and route details
        """
        # Get airport info
        from_info = self.get_airport_info(from_location)
        to_info = self.get_airport_info(to_location)
        
        if not from_info:
            return {"success": False, "error": f"Unknown departure location: {from_location}"}
        if not to_info:
            return {"success": False, "error": f"Unknown destination: {to_location}"}
        
        # Calculate straight-line distance
        straight_distance = self.haversine_distance(
            from_info["lat"], from_info["lng"],
            to_info["lat"], to_info["lng"]
        )
        
        # Aviation route is typically 5-10% longer due to routing
        aviation_distance = straight_distance * 1.08
        
        # Get aircraft performance
        aircraft = AIRCRAFT_PERFORMANCE.get(aircraft_type, AIRCRAFT_PERFORMANCE["helicopter"])
        
        # Calculate flight time
        flight_time_hours = aviation_distance / aircraft["cruise_speed_kmh"]
        flight_time_minutes = int(flight_time_hours * 60)
        
        # Add 10 minutes for takeoff/landing
        total_time_minutes = flight_time_minutes + 10
        
        return {
            "success": True,
            "from": {
                "code": from_info["code"],
                "city": from_info["city"],
                "state": from_info["state"],
                "lat": from_info["lat"],
                "lng": from_info["lng"],
                "landing_fee": from_info["landing_fee"]
            },
            "to": {
                "code": to_info["code"],
                "city": to_info["city"],
                "state": to_info["state"],
                "lat": to_info["lat"],
                "lng": to_info["lng"],
                "landing_fee": to_info["landing_fee"]
            },
            "distance": {
                "straight_line_km": round(straight_distance, 2),
                "aviation_route_km": round(aviation_distance, 2)
            },
            "flight_time": {
                "hours": round(flight_time_hours, 2),
                "minutes": flight_time_minutes,
                "total_minutes": total_time_minutes
            },
            "aircraft": {
                "type": aircraft_type,
                "cruise_speed_kmh": aircraft["cruise_speed_kmh"],
                "fuel_burn_lph": aircraft["fuel_burn_lph"],
                "typical_altitude_ft": aircraft["typical_altitude_ft"]
            }
        }
    
    def calculate_fuel_cost(
        self,
        flight_time_hours: float,
        aircraft_type: str = "helicopter",
        departure_airport: str = "BOM"
    ) -> Dict[str, float]:
        """Calculate fuel cost for a flight"""
        aircraft = AIRCRAFT_PERFORMANCE.get(aircraft_type, AIRCRAFT_PERFORMANCE["helicopter"])
        
        fuel_burn_lph = aircraft["fuel_burn_lph"]
        fuel_needed = fuel_burn_lph * flight_time_hours
        
        # Add 20% reserve
        fuel_with_reserve = fuel_needed * 1.2
        
        # Get fuel price
        fuel_price = FUEL_PRICES.get(departure_airport, FUEL_PRICES["default"])
        
        total_fuel_cost = fuel_with_reserve * fuel_price
        
        return {
            "fuel_needed_liters": round(fuel_needed, 2),
            "fuel_with_reserve_liters": round(fuel_with_reserve, 2),
            "fuel_price_per_liter": fuel_price,
            "total_fuel_cost": round(total_fuel_cost, 2)
        }
    
    def calculate_crew_cost(
        self,
        flight_time_hours: float,
        pilot_rate: float = 5000,  # INR per hour
        copilot_rate: float = 3000,  # INR per hour
        requires_copilot: bool = True
    ) -> Dict[str, float]:
        """Calculate crew costs"""
        # Minimum billing is 1 hour
        billable_hours = max(flight_time_hours, 1.0)
        
        pilot_cost = pilot_rate * billable_hours
        copilot_cost = copilot_rate * billable_hours if requires_copilot else 0
        
        return {
            "billable_hours": round(billable_hours, 2),
            "pilot_rate": pilot_rate,
            "pilot_cost": round(pilot_cost, 2),
            "copilot_rate": copilot_rate if requires_copilot else 0,
            "copilot_cost": round(copilot_cost, 2),
            "total_crew_cost": round(pilot_cost + copilot_cost, 2)
        }
    
    def calculate_landing_charges(
        self,
        from_airport: str,
        to_airport: str,
        parking_hours: float = 0
    ) -> Dict[str, float]:
        """Calculate landing and parking charges"""
        from_info = self.get_airport_info(from_airport)
        to_info = self.get_airport_info(to_airport)
        
        departure_landing = from_info["landing_fee"] if from_info else 3000
        arrival_landing = to_info["landing_fee"] if to_info else 3000
        
        # Parking charges (approx 500/hour)
        parking_charges = parking_hours * 500 if parking_hours > 0 else 0
        
        # Ground handling (flat fee)
        ground_handling = 2000
        
        return {
            "departure_landing_fee": departure_landing,
            "arrival_landing_fee": arrival_landing,
            "parking_charges": round(parking_charges, 2),
            "ground_handling": ground_handling,
            "total_landing_charges": round(
                departure_landing + arrival_landing + parking_charges + ground_handling, 2
            )
        }
    
    def calculate_repositioning_cost(
        self,
        aircraft_current_location: str,
        pickup_location: str,
        aircraft_type: str = "helicopter"
    ) -> Dict[str, Any]:
        """
        Calculate ferry/repositioning cost if aircraft needs to move to pickup point
        """
        # If same location, no repositioning needed
        current_code = self.get_airport_code(aircraft_current_location)
        pickup_code = self.get_airport_code(pickup_location)
        
        if current_code == pickup_code:
            return {
                "repositioning_needed": False,
                "repositioning_distance_km": 0,
                "repositioning_cost": 0,
                "message": "Aircraft already at pickup location"
            }
        
        # Calculate ferry distance
        distance_result = self.calculate_aviation_distance(
            aircraft_current_location, pickup_location, aircraft_type
        )
        
        if not distance_result["success"]:
            return {
                "repositioning_needed": True,
                "error": distance_result.get("error"),
                "repositioning_cost": 0
            }
        
        ferry_distance = distance_result["distance"]["aviation_route_km"]
        flight_time = distance_result["flight_time"]["hours"]
        
        # Calculate ferry costs
        fuel_cost = self.calculate_fuel_cost(flight_time, aircraft_type, current_code)
        crew_cost = self.calculate_crew_cost(flight_time)
        landing_cost = self.calculate_landing_charges(current_code, pickup_code)
        
        total_repositioning_cost = (
            fuel_cost["total_fuel_cost"] +
            crew_cost["total_crew_cost"] +
            landing_cost["total_landing_charges"]
        )
        
        return {
            "repositioning_needed": True,
            "from_location": aircraft_current_location,
            "to_location": pickup_location,
            "repositioning_distance_km": round(ferry_distance, 2),
            "repositioning_time_hours": round(flight_time, 2),
            "fuel_cost": fuel_cost["total_fuel_cost"],
            "crew_cost": crew_cost["total_crew_cost"],
            "landing_cost": landing_cost["total_landing_charges"],
            "repositioning_cost": round(total_repositioning_cost, 2),
            "message": f"Aircraft needs to ferry from {aircraft_current_location} to {pickup_location}"
        }
    
    def get_all_airports(self) -> List[Dict]:
        """Get list of all supported airports"""
        airports = []
        for code, info in INDIAN_AIRPORTS.items():
            airports.append({
                "code": code,
                "city": info["city"],
                "state": info["state"],
                "coordinates": {"lat": info["lat"], "lng": info["lng"]},
                "landing_fee": info["landing_fee"]
            })
        return sorted(airports, key=lambda x: x["city"])
    
    def search_airports(self, query: str) -> List[Dict]:
        """Search airports by city name or code"""
        query_lower = query.lower()
        results = []
        
        for code, info in INDIAN_AIRPORTS.items():
            if (query_lower in code.lower() or 
                query_lower in info["city"].lower() or
                query_lower in info["state"].lower()):
                results.append({
                    "code": code,
                    "city": info["city"],
                    "state": info["state"],
                    "display": f"{info['city']} ({code})"
                })
        
        return results[:10]  # Limit to 10 results


# Singleton instance
distance_calculator = DistanceCalculatorService()
