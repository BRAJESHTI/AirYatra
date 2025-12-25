from fastapi import APIRouter, HTTPException, Depends, Query, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, Field
from typing import Optional, List, Dict
from datetime import datetime, timezone, timedelta
from uuid import uuid4
import asyncio
import json
import math
from database import get_database
from routes.auth_routes import get_current_user

router = APIRouter(prefix="/flight-live", tags=["Real-time Flight Tracking"])

# Active WebSocket connections for live tracking
active_connections: Dict[str, List[WebSocket]] = {}

# Simulated flight data (In production, integrate with ADS-B/FlightAware)
ACTIVE_FLIGHTS = {}

# Models
class FlightPosition(BaseModel):
    flight_id: str
    latitude: float
    longitude: float
    altitude_ft: float
    speed_knots: float
    heading: float
    vertical_rate: float = 0
    timestamp: str = None

class FlightTrackingStart(BaseModel):
    booking_id: str
    aircraft_registration: str
    origin_lat: float
    origin_lon: float
    dest_lat: float
    dest_lon: float
    estimated_duration_min: int
    pilot_name: Optional[str] = None

class FlightUpdate(BaseModel):
    flight_id: str
    status: str  # taxiing, takeoff, cruising, descending, landing, landed
    position: Optional[FlightPosition] = None
    eta_minutes: Optional[int] = None
    message: Optional[str] = None

# Helper Functions
def calculate_bearing(lat1, lon1, lat2, lon2):
    """Calculate bearing between two points"""
    lat1, lon1, lat2, lon2 = map(math.radians, [lat1, lon1, lat2, lon2])
    dlon = lon2 - lon1
    x = math.sin(dlon) * math.cos(lat2)
    y = math.cos(lat1) * math.sin(lat2) - math.sin(lat1) * math.cos(lat2) * math.cos(dlon)
    bearing = math.atan2(x, y)
    return (math.degrees(bearing) + 360) % 360

def interpolate_position(origin, dest, progress):
    """Interpolate position between origin and destination"""
    lat = origin['lat'] + (dest['lat'] - origin['lat']) * progress
    lon = origin['lon'] + (dest['lon'] - origin['lon']) * progress
    return lat, lon

async def broadcast_to_flight(flight_id: str, message: dict):
    """Broadcast message to all connections tracking a flight"""
    if flight_id in active_connections:
        disconnected = []
        for connection in active_connections[flight_id]:
            try:
                await connection.send_json(message)
            except:
                disconnected.append(connection)
        for conn in disconnected:
            active_connections[flight_id].remove(conn)

# API Endpoints
@router.post("/start")
async def start_flight_tracking(flight_data: FlightTrackingStart, current_user: dict = Depends(get_current_user)):
    """Start tracking a flight"""
    db = get_database()
    
    flight_id = str(uuid4())
    
    flight_record = {
        "id": flight_id,
        "booking_id": flight_data.booking_id,
        "aircraft_registration": flight_data.aircraft_registration,
        "pilot_name": flight_data.pilot_name,
        "origin": {"lat": flight_data.origin_lat, "lon": flight_data.origin_lon},
        "destination": {"lat": flight_data.dest_lat, "lon": flight_data.dest_lon},
        "estimated_duration_min": flight_data.estimated_duration_min,
        "status": "preparing",
        "current_position": {
            "latitude": flight_data.origin_lat,
            "longitude": flight_data.origin_lon,
            "altitude_ft": 0,
            "speed_knots": 0,
            "heading": calculate_bearing(
                flight_data.origin_lat, flight_data.origin_lon,
                flight_data.dest_lat, flight_data.dest_lon
            )
        },
        "position_history": [],
        "started_at": datetime.now(timezone.utc).isoformat(),
        "started_by": current_user["id"],
        "eta": (datetime.now(timezone.utc) + timedelta(minutes=flight_data.estimated_duration_min)).isoformat(),
        "actual_departure": None,
        "actual_arrival": None,
        "is_active": True
    }
    
    await db.live_flights.insert_one(flight_record)
    ACTIVE_FLIGHTS[flight_id] = flight_record
    
    # Update booking
    await db.bookings.update_one(
        {"id": flight_data.booking_id},
        {"$set": {"live_flight_id": flight_id, "flight_status": "preparing"}}
    )
    
    return {"message": "Flight tracking started", "flight_id": flight_id}

@router.post("/update")
async def update_flight_position(update: FlightUpdate, current_user: dict = Depends(get_current_user)):
    """Update flight position (called by pilot/operator app)"""
    db = get_database()
    
    flight = await db.live_flights.find_one({"id": update.flight_id, "is_active": True})
    if not flight:
        raise HTTPException(status_code=404, detail="Active flight not found")
    
    update_data = {
        "status": update.status,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    if update.position:
        position_data = {
            "latitude": update.position.latitude,
            "longitude": update.position.longitude,
            "altitude_ft": update.position.altitude_ft,
            "speed_knots": update.position.speed_knots,
            "heading": update.position.heading,
            "vertical_rate": update.position.vertical_rate,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        update_data["current_position"] = position_data
        
        # Add to history
        await db.live_flights.update_one(
            {"id": update.flight_id},
            {"$push": {"position_history": position_data}}
        )
    
    if update.eta_minutes:
        update_data["eta"] = (datetime.now(timezone.utc) + timedelta(minutes=update.eta_minutes)).isoformat()
    
    if update.status == "takeoff":
        update_data["actual_departure"] = datetime.now(timezone.utc).isoformat()
    elif update.status == "landed":
        update_data["actual_arrival"] = datetime.now(timezone.utc).isoformat()
        update_data["is_active"] = False
    
    await db.live_flights.update_one({"id": update.flight_id}, {"$set": update_data})
    
    # Update booking status
    await db.bookings.update_one(
        {"live_flight_id": update.flight_id},
        {"$set": {"flight_status": update.status}}
    )
    
    # Broadcast to connected clients
    broadcast_msg = {
        "type": "position_update",
        "flight_id": update.flight_id,
        "status": update.status,
        "position": update_data.get("current_position"),
        "eta": update_data.get("eta"),
        "message": update.message
    }
    await broadcast_to_flight(update.flight_id, broadcast_msg)
    
    return {"message": "Flight updated", "status": update.status}

@router.get("/track/{flight_id}")
async def get_flight_tracking(flight_id: str):
    """Get current flight tracking data"""
    db = get_database()
    
    flight = await db.live_flights.find_one({"id": flight_id}, {"_id": 0})
    if not flight:
        raise HTTPException(status_code=404, detail="Flight not found")
    
    return flight

@router.get("/booking/{booking_id}")
async def get_flight_by_booking(booking_id: str):
    """Get flight tracking by booking ID"""
    db = get_database()
    
    flight = await db.live_flights.find_one(
        {"booking_id": booking_id},
        {"_id": 0}
    )
    
    if not flight:
        return {"tracking_available": False, "message": "No live tracking for this booking"}
    
    return {"tracking_available": True, "flight": flight}

@router.get("/active")
async def get_active_flights(current_user: dict = Depends(get_current_user)):
    """Get all active flights (admin/operator)"""
    db = get_database()
    
    flights = await db.live_flights.find(
        {"is_active": True},
        {"_id": 0, "position_history": 0}
    ).to_list(100)
    
    return {"active_flights": flights, "count": len(flights)}

@router.get("/history/{booking_id}")
async def get_flight_history(booking_id: str, current_user: dict = Depends(get_current_user)):
    """Get flight path history"""
    db = get_database()
    
    flight = await db.live_flights.find_one(
        {"booking_id": booking_id},
        {"_id": 0}
    )
    
    if not flight:
        raise HTTPException(status_code=404, detail="Flight not found")
    
    return {
        "flight_id": flight["id"],
        "origin": flight["origin"],
        "destination": flight["destination"],
        "path": flight.get("position_history", []),
        "total_points": len(flight.get("position_history", []))
    }

@router.websocket("/ws/{flight_id}")
async def flight_tracking_websocket(websocket: WebSocket, flight_id: str):
    """WebSocket for real-time flight updates"""
    await websocket.accept()
    
    if flight_id not in active_connections:
        active_connections[flight_id] = []
    active_connections[flight_id].append(websocket)
    
    try:
        db = get_database()
        flight = await db.live_flights.find_one({"id": flight_id}, {"_id": 0, "position_history": 0})
        
        if flight:
            await websocket.send_json({
                "type": "initial",
                "flight": flight
            })
        
        while True:
            try:
                data = await asyncio.wait_for(websocket.receive_text(), timeout=30)
                # Handle ping/pong
                if data == "ping":
                    await websocket.send_text("pong")
            except asyncio.TimeoutError:
                # Send heartbeat
                await websocket.send_json({"type": "heartbeat"})
    except WebSocketDisconnect:
        if flight_id in active_connections:
            active_connections[flight_id].remove(websocket)

@router.get("/dashboard")
async def get_tracking_dashboard(current_user: dict = Depends(get_current_user)):
    """Get flight tracking dashboard stats"""
    if "admin" not in current_user.get("roles", []) and "operator" not in current_user.get("roles", []):
        raise HTTPException(status_code=403, detail="Access denied")
    
    db = get_database()
    
    active_count = await db.live_flights.count_documents({"is_active": True})
    total_today = await db.live_flights.count_documents({
        "started_at": {"$gte": datetime.now(timezone.utc).replace(hour=0, minute=0, second=0).isoformat()}
    })
    
    # Get active flights
    active_flights = await db.live_flights.find(
        {"is_active": True},
        {"_id": 0, "position_history": 0}
    ).to_list(50)
    
    # Status breakdown
    pipeline = [
        {"$match": {"is_active": True}},
        {"$group": {"_id": "$status", "count": {"$sum": 1}}}
    ]
    status_breakdown = {}
    async for doc in db.live_flights.aggregate(pipeline):
        status_breakdown[doc["_id"]] = doc["count"]
    
    return {
        "active_flights_count": active_count,
        "total_flights_today": total_today,
        "status_breakdown": status_breakdown,
        "active_flights": active_flights
    }
