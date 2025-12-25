from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone, timedelta
from uuid import uuid4
from database import get_database
from routes.auth_routes import get_current_user

router = APIRouter(prefix="/calendar-sync", tags=["Calendar Sync"])

# Models
class CalendarConnection(BaseModel):
    provider: str  # google, outlook, apple
    access_token: str
    refresh_token: Optional[str] = None
    calendar_id: Optional[str] = None

class CalendarEvent(BaseModel):
    booking_id: str
    title: Optional[str] = None
    description: Optional[str] = None
    reminder_minutes: int = 60

class SyncSettings(BaseModel):
    auto_sync: bool = True
    sync_upcoming_only: bool = True
    default_reminder_minutes: int = 60
    include_operator_details: bool = True

# Helper Functions
def create_calendar_event_data(booking: dict, settings: dict) -> dict:
    """Create calendar event data from booking"""
    title = f"✈️ AirYatra Flight: {booking.get('origin', '')} → {booking.get('destination', '')}"
    
    description_parts = [
        f"Booking: {booking.get('booking_number', '')}",
        f"Route: {booking.get('origin', '')} to {booking.get('destination', '')}",
        f"Passengers: {booking.get('passengers', 1)}",
    ]
    
    if settings.get("include_operator_details"):
        description_parts.extend([
            f"Operator: {booking.get('operator_name', 'TBD')}",
            f"Aircraft: {booking.get('aircraft_type', 'TBD')}"
        ])
    
    description_parts.extend([
        "",
        "Powered by AirYatra - India's Premium Helicopter Booking"
    ])
    
    # Parse date and time
    journey_date = booking.get("journey_date", "")
    journey_time = booking.get("journey_time", "10:00")
    
    try:
        start_dt = datetime.strptime(f"{journey_date} {journey_time}", "%Y-%m-%d %H:%M")
        end_dt = start_dt + timedelta(hours=2)  # Default 2 hour duration
    except:
        start_dt = datetime.now() + timedelta(days=1)
        end_dt = start_dt + timedelta(hours=2)
    
    return {
        "title": title,
        "description": "\n".join(description_parts),
        "start_time": start_dt.isoformat(),
        "end_time": end_dt.isoformat(),
        "location": f"{booking.get('origin', '')} Helipad",
        "reminder_minutes": settings.get("default_reminder_minutes", 60)
    }

# API Endpoints
@router.get("/providers")
async def get_supported_providers():
    """Get list of supported calendar providers"""
    return {
        "providers": [
            {
                "id": "google",
                "name": "Google Calendar",
                "icon": "google",
                "auth_url": "/api/calendar-sync/auth/google"
            },
            {
                "id": "outlook",
                "name": "Microsoft Outlook",
                "icon": "microsoft",
                "auth_url": "/api/calendar-sync/auth/outlook"
            },
            {
                "id": "apple",
                "name": "Apple Calendar",
                "icon": "apple",
                "instructions": "Use .ics download for Apple Calendar"
            }
        ]
    }

@router.post("/connect")
async def connect_calendar(connection: CalendarConnection, current_user: dict = Depends(get_current_user)):
    """Connect a calendar provider"""
    db = get_database()
    
    connection_data = {
        "id": str(uuid4()),
        "user_id": current_user["id"],
        "provider": connection.provider,
        "access_token": connection.access_token,
        "refresh_token": connection.refresh_token,
        "calendar_id": connection.calendar_id,
        "is_active": True,
        "connected_at": datetime.now(timezone.utc).isoformat(),
        "last_sync": None
    }
    
    # Remove existing connection for same provider
    await db.calendar_connections.delete_many({
        "user_id": current_user["id"],
        "provider": connection.provider
    })
    
    await db.calendar_connections.insert_one(connection_data)
    
    return {"message": f"{connection.provider} calendar connected", "connection_id": connection_data["id"]}

@router.get("/connections")
async def get_connections(current_user: dict = Depends(get_current_user)):
    """Get user's calendar connections"""
    db = get_database()
    
    connections = await db.calendar_connections.find(
        {"user_id": current_user["id"]},
        {"_id": 0, "access_token": 0, "refresh_token": 0}
    ).to_list(10)
    
    return {"connections": connections}

@router.delete("/disconnect/{provider}")
async def disconnect_calendar(provider: str, current_user: dict = Depends(get_current_user)):
    """Disconnect a calendar provider"""
    db = get_database()
    
    result = await db.calendar_connections.delete_one({
        "user_id": current_user["id"],
        "provider": provider
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Connection not found")
    
    return {"message": f"{provider} calendar disconnected"}

@router.post("/add-event")
async def add_booking_to_calendar(event: CalendarEvent, current_user: dict = Depends(get_current_user)):
    """Add a booking to calendar"""
    db = get_database()
    
    # Get booking
    booking = await db.bookings.find_one({"id": event.booking_id})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    # Get user settings
    settings = await db.calendar_sync_settings.find_one({"user_id": current_user["id"]})
    if not settings:
        settings = SyncSettings().dict()
    
    # Create event data
    event_data = create_calendar_event_data(booking, settings)
    
    if event.title:
        event_data["title"] = event.title
    if event.description:
        event_data["description"] = event.description
    event_data["reminder_minutes"] = event.reminder_minutes
    
    # Store calendar event
    calendar_event = {
        "id": str(uuid4()),
        "user_id": current_user["id"],
        "booking_id": event.booking_id,
        **event_data,
        "synced_to": [],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.calendar_events.insert_one(calendar_event)
    
    # In production: Actually sync to connected calendars via their APIs
    
    calendar_event.pop("_id", None)
    return {"message": "Event added to calendar", "event": calendar_event}

@router.get("/events")
async def get_calendar_events(current_user: dict = Depends(get_current_user)):
    """Get user's calendar events"""
    db = get_database()
    
    events = await db.calendar_events.find(
        {"user_id": current_user["id"]},
        {"_id": 0}
    ).sort("start_time", 1).to_list(100)
    
    return {"events": events}

@router.get("/download-ics/{booking_id}")
async def download_ics(booking_id: str, current_user: dict = Depends(get_current_user)):
    """Download ICS file for a booking"""
    db = get_database()
    
    booking = await db.bookings.find_one({"id": booking_id})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    settings = await db.calendar_sync_settings.find_one({"user_id": current_user["id"]}) or {}
    event_data = create_calendar_event_data(booking, settings)
    
    # Generate ICS content
    ics_content = f"""BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//AirYatra//Booking Calendar//EN
BEGIN:VEVENT
UID:{booking_id}@airyatra.com
DTSTAMP:{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}
DTSTART:{datetime.fromisoformat(event_data['start_time']).strftime('%Y%m%dT%H%M%S')}
DTEND:{datetime.fromisoformat(event_data['end_time']).strftime('%Y%m%dT%H%M%S')}
SUMMARY:{event_data['title']}
DESCRIPTION:{event_data['description'].replace(chr(10), '\\n')}
LOCATION:{event_data['location']}
BEGIN:VALARM
TRIGGER:-PT{event_data['reminder_minutes']}M
ACTION:DISPLAY
DESCRIPTION:Reminder
END:VALARM
END:VEVENT
END:VCALENDAR"""
    
    return {
        "ics_content": ics_content,
        "filename": f"airyatra_booking_{booking.get('booking_number', booking_id)}.ics"
    }

@router.get("/settings")
async def get_sync_settings(current_user: dict = Depends(get_current_user)):
    """Get calendar sync settings"""
    db = get_database()
    
    settings = await db.calendar_sync_settings.find_one(
        {"user_id": current_user["id"]},
        {"_id": 0}
    )
    
    if not settings:
        return SyncSettings().dict()
    
    return settings

@router.put("/settings")
async def update_sync_settings(settings: SyncSettings, current_user: dict = Depends(get_current_user)):
    """Update calendar sync settings"""
    db = get_database()
    
    settings_data = {
        "user_id": current_user["id"],
        **settings.dict(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.calendar_sync_settings.update_one(
        {"user_id": current_user["id"]},
        {"$set": settings_data},
        upsert=True
    )
    
    return {"message": "Settings updated", "settings": settings_data}

@router.post("/sync-all")
async def sync_all_bookings(current_user: dict = Depends(get_current_user)):
    """Sync all upcoming bookings to calendar"""
    db = get_database()
    
    # Get upcoming bookings
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    bookings = await db.bookings.find({
        "user_id": current_user["id"],
        "journey_date": {"$gte": today},
        "status": {"$in": ["confirmed", "pending"]}
    }).to_list(50)
    
    synced = 0
    settings = await db.calendar_sync_settings.find_one({"user_id": current_user["id"]}) or {}
    
    for booking in bookings:
        # Check if already synced
        existing = await db.calendar_events.find_one({
            "user_id": current_user["id"],
            "booking_id": booking["id"]
        })
        
        if not existing:
            event_data = create_calendar_event_data(booking, settings)
            calendar_event = {
                "id": str(uuid4()),
                "user_id": current_user["id"],
                "booking_id": booking["id"],
                **event_data,
                "synced_to": [],
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.calendar_events.insert_one(calendar_event)
            synced += 1
    
    return {"message": f"Synced {synced} bookings to calendar", "synced_count": synced}
