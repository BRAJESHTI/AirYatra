"""
Pilot Mobile Portal API
PWA-optimized endpoints for pilot companion app
"""
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone, timedelta
from database import get_database
from middleware import get_current_user, require_roles
from bson import ObjectId

router = APIRouter(prefix="/pilot", tags=["Pilot Mobile Portal"])


@router.get("/mobile/dashboard")
async def get_pilot_mobile_dashboard(
    current_user: dict = Depends(get_current_user)
):
    """
    Comprehensive pilot mobile dashboard
    - Stats, upcoming flights, alerts, duty status, documents, flight logs
    """
    db = get_database()
    
    user_id = current_user.get("id") or str(current_user.get("_id"))
    now = datetime.now(timezone.utc)
    
    # Check if user is a pilot
    user_roles = current_user.get("roles", [])
    if "pilot" not in user_roles and "admin" not in user_roles:
        raise HTTPException(status_code=403, detail="Pilot access required")
    
    # Get pilot profile
    pilot = await db.pilots.find_one({"user_id": user_id}, {"_id": 0})
    if not pilot:
        # Create pilot profile if doesn't exist
        pilot = {
            "user_id": user_id,
            "license_number": current_user.get("license_number", "N/A"),
            "total_hours": 0,
            "created_at": now.isoformat()
        }
    
    # ========== STATS ==========
    # Get flight logs for this pilot
    flight_logs = await db.flight_logs.find({"pilot_id": user_id}).to_list(500)
    
    # This month's hours
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    this_month_logs = [
        log for log in flight_logs
        if log.get("date", "") >= month_start.isoformat()[:10]
    ]
    hours_this_month = sum(log.get("duration_hours", 0) or log.get("flight_duration_hours", 1.5) for log in this_month_logs)
    
    # Total flights
    total_flights = len(flight_logs)
    
    # FDTL calculations
    fdtl = await db.pilot_fdtl.find_one({"pilot_id": user_id}, {"_id": 0})
    if not fdtl:
        fdtl = {
            "fdp_used": 0,
            "flight_time_24h": 0,
            "weekly_hours": hours_this_month,
            "rest_required": 10,
            "is_on_duty": False
        }
    
    duty_hours_remaining = max(0, 14 - fdtl.get("fdp_used", 0))
    
    stats = {
        "total_flights": total_flights,
        "hours_this_month": round(hours_this_month, 1),
        "duty_hours_remaining": round(duty_hours_remaining, 1),
        "total_hours": pilot.get("total_hours", sum(log.get("duration_hours", 0) for log in flight_logs))
    }
    
    # ========== UPCOMING FLIGHTS ==========
    # Get assigned flights for this pilot
    upcoming = await db.pilot_assignments.find({
        "pilot_id": user_id,
        "status": {"$in": ["assigned", "confirmed"]},
        "flight_date": {"$gte": now.strftime("%Y-%m-%d")}
    }, {"_id": 0}).sort("flight_date", 1).limit(5).to_list(5)
    
    # Also check bookings assigned to this pilot
    bookings = await db.bookings.find({
        "pilot_id": user_id,
        "status": {"$in": ["confirmed", "upcoming"]}
    }, {"_id": 0}).limit(5).to_list(5)
    
    upcoming_flights = []
    for a in upcoming:
        upcoming_flights.append({
            "flight_id": a.get("flight_id", f"FL-{ObjectId()}"),
            "from": a.get("from_location", "TBD"),
            "to": a.get("to_location", "TBD"),
            "date": a.get("flight_date", "TBD"),
            "time": a.get("departure_time", "TBD"),
            "aircraft": a.get("aircraft_registration", "TBD")
        })
    
    for b in bookings:
        upcoming_flights.append({
            "flight_id": b.get("booking_id", f"BK-{ObjectId()}"),
            "from": b.get("departure_city", b.get("from_location", "TBD")),
            "to": b.get("arrival_city", b.get("to_location", "TBD")),
            "date": b.get("departure_date", "TBD"),
            "time": b.get("departure_time", "TBD"),
            "aircraft": b.get("aircraft_registration", "TBD")
        })
    
    # Dedupe and limit to 5
    upcoming_flights = upcoming_flights[:5]
    
    # ========== ALERTS ==========
    alerts = []
    
    # Document expiry alerts
    documents = await db.pilot_documents.find(
        {"pilot_id": user_id},
        {"_id": 0}
    ).to_list(20)
    
    for doc in documents:
        expiry_str = doc.get("expiry_date")
        if expiry_str:
            try:
                if isinstance(expiry_str, str):
                    expiry = datetime.fromisoformat(expiry_str.replace("Z", "+00:00"))
                else:
                    expiry = expiry_str
                
                days_until = (expiry - now).days
                
                if days_until <= 0:
                    alerts.append({
                        "type": "critical",
                        "title": f"{doc.get('document_type', 'Document')} Expired",
                        "message": f"Expired on {expiry_str[:10]}"
                    })
                elif days_until <= 30:
                    alerts.append({
                        "type": "warning",
                        "title": f"{doc.get('document_type', 'Document')} Expiring",
                        "message": f"Expires in {days_until} days"
                    })
            except Exception:
                pass
    
    # FDTL alerts
    if fdtl.get("fdp_used", 0) >= 12:
        alerts.append({
            "type": "warning",
            "title": "FDTL Limit Approaching",
            "message": f"Only {14 - fdtl.get('fdp_used', 0)}h remaining"
        })
    
    if fdtl.get("flight_time_24h", 0) >= 7:
        alerts.append({
            "type": "warning",
            "title": "Daily Flight Time Limit",
            "message": f"{8 - fdtl.get('flight_time_24h', 0)}h remaining today"
        })
    
    # ========== DUTY STATUS ==========
    duty_logs = await db.duty_logs.find(
        {"pilot_id": user_id}
    ).sort("created_at", -1).limit(10).to_list(10)
    
    recent_logs = []
    for log in duty_logs:
        recent_logs.append({
            "date": log.get("date", "")[:10] if log.get("date") else log.get("created_at", "")[:10],
            "type": log.get("type", "duty"),
            "hours": log.get("hours", 0)
        })
    
    duty_status = {
        **fdtl,
        "recent_logs": recent_logs
    }
    
    # ========== DOCUMENTS ==========
    docs_list = []
    for doc in documents:
        expiry_str = doc.get("expiry_date", "")
        days_until = 365
        
        if expiry_str:
            try:
                if isinstance(expiry_str, str):
                    expiry = datetime.fromisoformat(expiry_str.replace("Z", "+00:00"))
                else:
                    expiry = expiry_str
                days_until = (expiry - now).days
            except Exception:
                pass
        
        docs_list.append({
            "document_type": doc.get("document_type", "Unknown"),
            "document_number": doc.get("document_number", "N/A"),
            "expiry_date": expiry_str[:10] if expiry_str else "N/A",
            "days_until_expiry": days_until,
            "verification_status": doc.get("verification_status", "pending")
        })
    
    # Sort by days until expiry
    docs_list.sort(key=lambda x: x["days_until_expiry"])
    
    # ========== FLIGHT LOGS ==========
    logs_list = []
    for log in flight_logs[-10:]:
        logs_list.append({
            "flight_id": log.get("flight_id", f"LOG-{ObjectId()}"),
            "date": log.get("date", "")[:10] if log.get("date") else "",
            "from": log.get("departure_location", log.get("from_location", "N/A")),
            "to": log.get("arrival_location", log.get("to_location", "N/A")),
            "aircraft": log.get("aircraft_registration", "N/A"),
            "duration": log.get("duration_hours", log.get("flight_duration_hours", 0)),
            "flight_type": log.get("flight_type", "Commercial")
        })
    
    logs_list.reverse()  # Most recent first
    
    return {
        "pilot": pilot,
        "stats": stats,
        "upcoming_flights": upcoming_flights,
        "alerts": alerts,
        "duty_status": duty_status,
        "documents": docs_list,
        "flight_logs": logs_list,
        "generated_at": now.isoformat()
    }


@router.post("/duty/check-in")
async def pilot_check_in(
    current_user: dict = Depends(get_current_user)
):
    """Record pilot duty start"""
    db = get_database()
    
    user_id = current_user.get("id") or str(current_user.get("_id"))
    now = datetime.now(timezone.utc)
    
    # Update FDTL record
    await db.pilot_fdtl.update_one(
        {"pilot_id": user_id},
        {
            "$set": {
                "is_on_duty": True,
                "duty_start_time": now.isoformat(),
                "updated_at": now.isoformat()
            }
        },
        upsert=True
    )
    
    # Log the check-in
    await db.duty_logs.insert_one({
        "id": f"duty_{ObjectId()}",
        "pilot_id": user_id,
        "type": "check_in",
        "date": now.strftime("%Y-%m-%d"),
        "time": now.strftime("%H:%M"),
        "created_at": now.isoformat()
    })
    
    return {"message": "Checked in successfully", "timestamp": now.isoformat()}


@router.post("/duty/check-out")
async def pilot_check_out(
    current_user: dict = Depends(get_current_user)
):
    """Record pilot duty end"""
    db = get_database()
    
    user_id = current_user.get("id") or str(current_user.get("_id"))
    now = datetime.now(timezone.utc)
    
    # Get current FDTL
    fdtl = await db.pilot_fdtl.find_one({"pilot_id": user_id})
    
    duty_hours = 0
    if fdtl and fdtl.get("duty_start_time"):
        try:
            start = datetime.fromisoformat(fdtl["duty_start_time"].replace("Z", "+00:00"))
            duty_hours = (now - start).total_seconds() / 3600
        except Exception:
            pass
    
    # Update FDTL record
    await db.pilot_fdtl.update_one(
        {"pilot_id": user_id},
        {
            "$set": {
                "is_on_duty": False,
                "duty_end_time": now.isoformat(),
                "updated_at": now.isoformat()
            },
            "$inc": {
                "fdp_used": duty_hours
            }
        },
        upsert=True
    )
    
    # Log the check-out
    await db.duty_logs.insert_one({
        "id": f"duty_{ObjectId()}",
        "pilot_id": user_id,
        "type": "check_out",
        "date": now.strftime("%Y-%m-%d"),
        "time": now.strftime("%H:%M"),
        "hours": round(duty_hours, 2),
        "created_at": now.isoformat()
    })
    
    return {
        "message": "Checked out successfully",
        "duty_hours": round(duty_hours, 2),
        "timestamp": now.isoformat()
    }


@router.get("/documents")
async def get_pilot_documents(
    current_user: dict = Depends(get_current_user)
):
    """Get pilot's documents"""
    db = get_database()
    
    user_id = current_user.get("id") or str(current_user.get("_id"))
    
    documents = await db.pilot_documents.find(
        {"pilot_id": user_id},
        {"_id": 0}
    ).to_list(50)
    
    return {"documents": documents}


@router.get("/flight-logs")
async def get_pilot_flight_logs(
    limit: int = 20,
    current_user: dict = Depends(get_current_user)
):
    """Get pilot's flight logs"""
    db = get_database()
    
    user_id = current_user.get("id") or str(current_user.get("_id"))
    
    logs = await db.flight_logs.find(
        {"pilot_id": user_id},
        {"_id": 0}
    ).sort("date", -1).limit(limit).to_list(limit)
    
    return {"flight_logs": logs}
