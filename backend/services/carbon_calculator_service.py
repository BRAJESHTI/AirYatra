"""
AirYatra Carbon Emission Calculator
Calculate CO2 footprint for flights and suggest carbon offsets
"""

import math
import logging
from typing import Dict, Any, Optional, List
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

# Average CO2 emissions per passenger-km by aircraft type (kg CO2)
# Based on industry averages and ICAO data
AIRCRAFT_EMISSIONS = {
    # Helicopters (higher emissions per km due to lower efficiency)
    "helicopter": 0.350,          # ~350g CO2/pax-km
    "bell_407": 0.320,
    "bell_429": 0.310,
    "ec_135": 0.300,
    "as_350": 0.340,
    "h_125": 0.340,
    "h_130": 0.330,
    "h_145": 0.280,
    "aw_109": 0.290,
    "aw_139": 0.260,
    "mi_17": 0.400,
    
    # Small Fixed Wing
    "cessna_172": 0.180,
    "cessna_208": 0.160,
    "king_air": 0.200,
    "beechcraft": 0.190,
    "pilatus_pc12": 0.170,
    
    # Jets (more efficient per km)
    "citation": 0.150,
    "learjet": 0.160,
    "gulfstream": 0.140,
    "falcon": 0.145,
    "hawker": 0.155,
    
    # seaplane
    "seaplane": 0.280,
    "caravan": 0.175,
    
    # Default fallback
    "default": 0.300
}

# Carbon offset cost per ton CO2 (USD)
OFFSET_COST_PER_TON = 15.0  # $15 per ton CO2

# Eco badges thresholds (kg CO2 per passenger)
ECO_BADGES = {
    "eco_champion": {"max_kg": 20, "badge": "🌳", "label": "Eco Champion"},
    "eco_friendly": {"max_kg": 50, "badge": "🌿", "label": "Eco Friendly"},
    "moderate": {"max_kg": 100, "badge": "🍃", "label": "Moderate Impact"},
    "high": {"max_kg": 200, "badge": "🏭", "label": "High Impact"},
    "very_high": {"max_kg": float("inf"), "badge": "⚠️", "label": "Very High Impact"}
}

# Average distances between major Indian cities (km) - for quick lookups
CITY_DISTANCES = {
    ("Mumbai", "Delhi"): 1148,
    ("Mumbai", "Bangalore"): 842,
    ("Mumbai", "Chennai"): 1028,
    ("Mumbai", "Kolkata"): 1663,
    ("Mumbai", "Hyderabad"): 617,
    ("Mumbai", "Pune"): 149,
    ("Mumbai", "Goa"): 460,
    ("Mumbai", "Ahmedabad"): 440,
    ("Mumbai", "Jaipur"): 1020,
    ("Mumbai", "Srinagar"): 1700,
    ("Mumbai", "Shirdi"): 245,
    ("Delhi", "Bangalore"): 1740,
    ("Delhi", "Chennai"): 1760,
    ("Delhi", "Kolkata"): 1305,
    ("Delhi", "Hyderabad"): 1260,
    ("Delhi", "Jaipur"): 280,
    ("Delhi", "Srinagar"): 640,
    ("Delhi", "Leh"): 680,
    ("Delhi", "Shimla"): 340,
    ("Delhi", "Kedarnath"): 380,
    ("Delhi", "Vaishno Devi"): 590,
    ("Bangalore", "Chennai"): 290,
    ("Bangalore", "Hyderabad"): 500,
    ("Bangalore", "Coorg"): 260,
}


class CarbonCalculator:
    """Calculate carbon emissions and provide eco-friendly insights"""
    
    def __init__(self):
        pass
    
    def calculate_emissions(
        self,
        distance_km: float,
        aircraft_type: str = "helicopter",
        passenger_count: int = 1,
        round_trip: bool = False
    ) -> Dict[str, Any]:
        """
        Calculate CO2 emissions for a flight
        
        Args:
            distance_km: Distance in kilometers
            aircraft_type: Type of aircraft
            passenger_count: Number of passengers
            round_trip: Whether to calculate for round trip
        
        Returns:
            Detailed emissions breakdown
        """
        # Get emission factor
        aircraft_key = aircraft_type.lower().replace(" ", "_").replace("-", "_")
        emission_factor = AIRCRAFT_EMISSIONS.get(aircraft_key, AIRCRAFT_EMISSIONS["default"])
        
        # Calculate total distance
        total_distance = distance_km * 2 if round_trip else distance_km
        
        # Total emissions (kg CO2)
        total_emissions_kg = total_distance * emission_factor * passenger_count
        
        # Per passenger emissions
        per_passenger_kg = total_distance * emission_factor
        
        # Comparison with alternatives
        car_emissions_kg = total_distance * 0.120 * passenger_count  # ~120g/km for car
        train_emissions_kg = total_distance * 0.041 * passenger_count  # ~41g/km for train
        commercial_flight_kg = total_distance * 0.090 * passenger_count  # ~90g/km commercial
        
        # Get eco badge
        eco_badge = self._get_eco_badge(per_passenger_kg)
        
        # Carbon offset cost
        offset_cost_usd = (total_emissions_kg / 1000) * OFFSET_COST_PER_TON
        offset_cost_inr = offset_cost_usd * 83  # Approx USD to INR
        
        # Trees equivalent (1 tree absorbs ~22kg CO2 per year)
        trees_to_offset = math.ceil(total_emissions_kg / 22)
        
        return {
            "success": True,
            "emissions": {
                "total_kg": round(total_emissions_kg, 2),
                "per_passenger_kg": round(per_passenger_kg, 2),
                "total_tons": round(total_emissions_kg / 1000, 4)
            },
            "journey": {
                "distance_km": round(total_distance, 1),
                "aircraft_type": aircraft_type,
                "passenger_count": passenger_count,
                "is_round_trip": round_trip
            },
            "eco_rating": {
                "badge": eco_badge["badge"],
                "label": eco_badge["label"],
                "level": eco_badge.get("level", "moderate")
            },
            "comparison": {
                "car_kg": round(car_emissions_kg, 2),
                "train_kg": round(train_emissions_kg, 2),
                "commercial_flight_kg": round(commercial_flight_kg, 2),
                "vs_car": f"{((total_emissions_kg / car_emissions_kg - 1) * 100):.0f}% {'more' if total_emissions_kg > car_emissions_kg else 'less'}" if car_emissions_kg > 0 else "N/A",
                "vs_commercial": f"{((total_emissions_kg / commercial_flight_kg - 1) * 100):.0f}% {'more' if total_emissions_kg > commercial_flight_kg else 'less'}" if commercial_flight_kg > 0 else "N/A"
            },
            "offset": {
                "cost_usd": round(offset_cost_usd, 2),
                "cost_inr": round(offset_cost_inr, 2),
                "trees_equivalent": trees_to_offset,
                "description": f"Plant {trees_to_offset} trees to offset this journey"
            },
            "tips": self._get_eco_tips(per_passenger_kg, aircraft_type)
        }
    
    def calculate_route_emissions(
        self,
        origin_city: str,
        destination_city: str,
        aircraft_type: str = "helicopter",
        passenger_count: int = 1,
        custom_distance_km: Optional[float] = None
    ) -> Dict[str, Any]:
        """
        Calculate emissions for a route between cities
        """
        # Get distance
        if custom_distance_km:
            distance = custom_distance_km
        else:
            distance = self._get_city_distance(origin_city, destination_city)
        
        if distance is None:
            return {
                "success": False,
                "error": f"Distance not found for {origin_city} → {destination_city}. Please provide custom_distance_km."
            }
        
        result = self.calculate_emissions(
            distance_km=distance,
            aircraft_type=aircraft_type,
            passenger_count=passenger_count
        )
        
        result["route"] = {
            "origin": origin_city,
            "destination": destination_city,
            "distance_km": distance
        }
        
        return result
    
    def get_eco_comparison(
        self,
        distance_km: float,
        passenger_count: int = 1
    ) -> Dict[str, Any]:
        """
        Compare emissions across different transport modes
        """
        modes = {
            "helicopter": {"factor": 0.300, "icon": "🚁", "time_factor": 1.0},
            "small_aircraft": {"factor": 0.180, "icon": "✈️", "time_factor": 1.2},
            "commercial_flight": {"factor": 0.090, "icon": "🛫", "time_factor": 1.5},
            "car": {"factor": 0.120, "icon": "🚗", "time_factor": 4.0},
            "train": {"factor": 0.041, "icon": "🚆", "time_factor": 6.0},
            "bus": {"factor": 0.027, "icon": "🚌", "time_factor": 8.0}
        }
        
        comparison = []
        for mode, data in modes.items():
            emissions_kg = distance_km * data["factor"] * passenger_count
            travel_time_hrs = (distance_km / 100) * data["time_factor"]  # Rough estimate
            
            comparison.append({
                "mode": mode.replace("_", " ").title(),
                "icon": data["icon"],
                "emissions_kg": round(emissions_kg, 2),
                "estimated_time_hrs": round(travel_time_hrs, 1),
                "eco_score": 100 - min(100, int(emissions_kg / passenger_count))
            })
        
        # Sort by emissions
        comparison.sort(key=lambda x: x["emissions_kg"])
        
        return {
            "success": True,
            "distance_km": distance_km,
            "passenger_count": passenger_count,
            "comparison": comparison,
            "recommendation": comparison[0]["mode"] if comparison else None,
            "greenest_option": comparison[0] if comparison else None
        }
    
    def _get_city_distance(self, origin: str, destination: str) -> Optional[float]:
        """Get distance between cities from lookup table"""
        
        # Normalize city names
        origin = origin.strip().title()
        destination = destination.strip().title()
        
        # Check both directions
        key1 = (origin, destination)
        key2 = (destination, origin)
        
        if key1 in CITY_DISTANCES:
            return CITY_DISTANCES[key1]
        elif key2 in CITY_DISTANCES:
            return CITY_DISTANCES[key2]
        
        return None
    
    def _get_eco_badge(self, per_passenger_kg: float) -> Dict[str, str]:
        """Determine eco badge based on emissions"""
        
        for level, config in ECO_BADGES.items():
            if per_passenger_kg <= config["max_kg"]:
                return {
                    "badge": config["badge"],
                    "label": config["label"],
                    "level": level
                }
        
        return {"badge": "⚠️", "label": "Very High Impact", "level": "very_high"}
    
    def _get_eco_tips(self, emissions_kg: float, aircraft_type: str) -> List[str]:
        """Generate eco-friendly tips"""
        
        tips = []
        
        if emissions_kg > 100:
            tips.append("🌳 Consider carbon offset programs to neutralize your footprint")
            tips.append("👥 Share the flight with more passengers to reduce per-person emissions")
        
        if "helicopter" in aircraft_type.lower():
            tips.append("✈️ For longer routes, consider fixed-wing aircraft (30-40% more efficient)")
        
        if emissions_kg > 50:
            tips.append("🔋 Choose operators with newer, fuel-efficient aircraft")
        
        tips.append("📅 Combine trips when possible to reduce total flights")
        tips.append("🌱 Support AirYatra's tree-planting initiative")
        
        return tips[:4]  # Return max 4 tips
    
    def get_supported_aircraft(self) -> List[Dict[str, Any]]:
        """Get list of supported aircraft with their emission factors"""
        
        result = []
        for aircraft, factor in AIRCRAFT_EMISSIONS.items():
            if aircraft != "default":
                result.append({
                    "type": aircraft.replace("_", " ").title(),
                    "emission_factor": factor,
                    "emission_category": "high" if factor > 0.25 else "medium" if factor > 0.15 else "low"
                })
        
        return sorted(result, key=lambda x: x["emission_factor"])


# Singleton instance
carbon_calculator = CarbonCalculator()
