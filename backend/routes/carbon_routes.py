"""
AirYatra Carbon Calculator Routes
API endpoints for carbon emission calculations
"""

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from typing import Optional

from routes.auth_routes import get_current_user
from services.carbon_calculator_service import carbon_calculator

router = APIRouter(prefix="/carbon", tags=["Carbon Calculator"])


class EmissionRequest(BaseModel):
    distance_km: float
    aircraft_type: str = "helicopter"
    passenger_count: int = 1
    round_trip: bool = False


class RouteEmissionRequest(BaseModel):
    origin_city: str
    destination_city: str
    aircraft_type: str = "helicopter"
    passenger_count: int = 1
    custom_distance_km: Optional[float] = None


@router.get("/calculate")
async def calculate_emissions(
    distance_km: float = Query(..., description="Distance in kilometers"),
    aircraft_type: str = Query("helicopter", description="Aircraft type"),
    passenger_count: int = Query(1, ge=1, le=50, description="Number of passengers"),
    round_trip: bool = Query(False, description="Round trip calculation")
):
    """
    Calculate CO2 emissions for a flight.
    
    Returns:
    - Total emissions (kg CO2)
    - Per passenger emissions
    - Eco badge rating
    - Comparison with other transport modes
    - Carbon offset cost
    - Number of trees to plant for offset
    """
    return carbon_calculator.calculate_emissions(
        distance_km=distance_km,
        aircraft_type=aircraft_type,
        passenger_count=passenger_count,
        round_trip=round_trip
    )


@router.post("/calculate")
async def calculate_emissions_post(request: EmissionRequest):
    """Calculate emissions (POST method)"""
    return carbon_calculator.calculate_emissions(
        distance_km=request.distance_km,
        aircraft_type=request.aircraft_type,
        passenger_count=request.passenger_count,
        round_trip=request.round_trip
    )


@router.get("/route")
async def calculate_route_emissions(
    origin: str = Query(..., description="Origin city"),
    destination: str = Query(..., description="Destination city"),
    aircraft_type: str = Query("helicopter"),
    passenger_count: int = Query(1, ge=1, le=50)
):
    """
    Calculate emissions for a route between cities.
    Uses pre-calculated distances for major Indian cities.
    """
    return carbon_calculator.calculate_route_emissions(
        origin_city=origin,
        destination_city=destination,
        aircraft_type=aircraft_type,
        passenger_count=passenger_count
    )


@router.post("/route")
async def calculate_route_emissions_post(request: RouteEmissionRequest):
    """Calculate route emissions (POST method)"""
    return carbon_calculator.calculate_route_emissions(
        origin_city=request.origin_city,
        destination_city=request.destination_city,
        aircraft_type=request.aircraft_type,
        passenger_count=request.passenger_count,
        custom_distance_km=request.custom_distance_km
    )


@router.get("/compare")
async def compare_transport_modes(
    distance_km: float = Query(..., description="Distance in kilometers"),
    passenger_count: int = Query(1, ge=1, le=50)
):
    """
    Compare CO2 emissions across different transport modes.
    
    Includes: Helicopter, Small Aircraft, Commercial Flight, Car, Train, Bus
    """
    return carbon_calculator.get_eco_comparison(
        distance_km=distance_km,
        passenger_count=passenger_count
    )


@router.get("/aircraft-types")
async def get_aircraft_emission_factors():
    """
    Get list of supported aircraft types with their emission factors.
    
    Emission factor is kg CO2 per passenger-kilometer.
    """
    return {
        "success": True,
        "aircraft_types": carbon_calculator.get_supported_aircraft()
    }


@router.get("/offset-info")
async def get_offset_information():
    """
    Get information about carbon offset programs.
    """
    return {
        "success": True,
        "offset_programs": [
            {
                "name": "Tree Planting",
                "description": "Plant trees to absorb CO2",
                "rate": "1 tree absorbs ~22kg CO2/year",
                "cost_per_tree_inr": 100
            },
            {
                "name": "Renewable Energy",
                "description": "Support solar/wind projects",
                "rate": "$15 per ton CO2",
                "cost_per_ton_inr": 1245
            },
            {
                "name": "Community Projects",
                "description": "Support clean cookstoves, water filters",
                "rate": "$12 per ton CO2",
                "cost_per_ton_inr": 996
            }
        ],
        "airyatra_initiative": {
            "name": "AirYatra Green Sky",
            "description": "Our commitment to carbon-neutral aviation",
            "tree_goal_2026": 10000,
            "trees_planted": 3450,
            "partner": "Grow-Trees.com"
        }
    }
