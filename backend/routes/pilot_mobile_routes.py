"""
Pilot Mobile Portal API
PWA-optimized endpoints for pilot companion app
"""
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from datetime import datetime, timezone, timedelta
from database import get_database
from middleware import get_current_user, require_roles
from bson import ObjectId
from services.email_service import email_service

router = APIRouter(prefix="/pilot", tags=["Pilot Mobile Portal"])


async def _send_duty_email(pilot_email: str, pilot_name: str, duty_type: str, duty_data: dict):
    """Send duty check-in/check-out email to pilot"""
    try:
        if duty_type == "check_in":
            subject = f"✅ Duty Started - {pilot_name} | AirYatra"
            html_body = f"""
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body {{ font-family: 'Segoe UI', Arial, sans-serif; background: #1a1a2e; color: #ffffff; margin: 0; padding: 20px; }}
                    .container {{ max-width: 500px; margin: 0 auto; background: #16213e; border-radius: 16px; overflow: hidden; }}
                    .header {{ background: linear-gradient(135deg, #22c55e, #16a34a); padding: 25px; text-align: center; }}
                    .header h1 {{ margin: 0; font-size: 24px; }}
                    .content {{ padding: 25px; }}
                    .info-box {{ background: #1a1a2e; border-radius: 12px; padding: 15px; margin: 15px 0; }}
                    .info-row {{ display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #2a2a4e; }}
                    .info-row:last-child {{ border-bottom: none; }}
                    .label {{ color: #94a3b8; }}
                    .value {{ color: #ffffff; font-weight: 600; }}
                    .footer {{ background: #0f0f1e; padding: 15px; text-align: center; font-size: 11px; color: #64748b; }}
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>✅ Duty Check-In Successful</h1>
                    </div>
                    <div class="content">
                        <p>Namaste <strong>{pilot_name}</strong>,</p>
                        <p>Aapka duty period shuru ho gaya hai. Safe flying! 🚁</p>
                        
                        <div class="info-box">
                            <div class="info-row">
                                <span class="label">Check-In Time:</span>
                                <span class="value">{duty_data.get('time', 'N/A')}</span>
                            </div>
                            <div class="info-row">
                                <span class="label">Date:</span>
                                <span class="value">{duty_data.get('date', 'N/A')}</span>
                            </div>
                            <div class="info-row">
                                <span class="label">FDTL Remaining:</span>
                                <span class="value">{duty_data.get('fdtl_remaining', '14')}h</span>
                            </div>
                        </div>
                        
                        <p style="color: #f97316; font-size: 13px;">⚠️ Remember: Max Flight Duty Period is 14 hours</p>
                    </div>
                    <div class="footer">
                        AirYatra Aviation Platform | Pilot Duty Management
                    </div>
                </div>
            </body>
            </html>
            """
        else:  # check_out
            subject = f"🏁 Duty Completed - {pilot_name} | AirYatra"
            html_body = f"""
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body {{ font-family: 'Segoe UI', Arial, sans-serif; background: #1a1a2e; color: #ffffff; margin: 0; padding: 20px; }}
                    .container {{ max-width: 500px; margin: 0 auto; background: #16213e; border-radius: 16px; overflow: hidden; }}
                    .header {{ background: linear-gradient(135deg, #f97316, #ea580c); padding: 25px; text-align: center; }}
                    .header h1 {{ margin: 0; font-size: 24px; }}
                    .content {{ padding: 25px; }}
                    .summary-box {{ background: linear-gradient(135deg, #1e3a5f, #1a1a2e); border-radius: 12px; padding: 20px; margin: 15px 0; text-align: center; }}
                    .big-number {{ font-size: 48px; font-weight: bold; color: #f97316; }}
                    .info-box {{ background: #1a1a2e; border-radius: 12px; padding: 15px; margin: 15px 0; }}
                    .info-row {{ display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #2a2a4e; }}
                    .info-row:last-child {{ border-bottom: none; }}
                    .label {{ color: #94a3b8; }}
                    .value {{ color: #ffffff; font-weight: 600; }}
                    .footer {{ background: #0f0f1e; padding: 15px; text-align: center; font-size: 11px; color: #64748b; }}
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>🏁 Duty Completed</h1>
                    </div>
                    <div class="content">
                        <p>Namaste <strong>{pilot_name}</strong>,</p>
                        <p>Aapka duty period successfully complete ho gaya. Rest well! 😊</p>
                        
                        <div class="summary-box">
                            <div class="big-number">{duty_data.get('duty_hours', '0')}h</div>
                            <p style="margin: 5px 0 0; color: #94a3b8;">Total Duty Hours Today</p>
                        </div>
                        
                        <div class="info-box">
                            <div class="info-row">
                                <span class="label">Check-In:</span>
                                <span class="value">{duty_data.get('check_in_time', 'N/A')}</span>
                            </div>
                            <div class="info-row">
                                <span class="label">Check-Out:</span>
                                <span class="value">{duty_data.get('check_out_time', 'N/A')}</span>
                            </div>
                            <div class="info-row">
                                <span class="label">FDP Used Today:</span>
                                <span class="value">{duty_data.get('fdp_used', '0')}h</span>
                            </div>
                            <div class="info-row">
                                <span class="label">Rest Required:</span>
                                <span class="value" style="color: #22c55e;">10 hours minimum</span>
                            </div>
                        </div>
                    </div>
                    <div class="footer">
                        AirYatra Aviation Platform | Pilot Duty Management
                    </div>
                </div>
            </body>
            </html>
            """
        
        await email_service.send_email(
            to_email=pilot_email,
            subject=subject,
            html_body=html_body
        )
    except Exception as e:
        print(f"Failed to send duty email: {e}")


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
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    """Record pilot duty start"""
    db = get_database()
    
    user_id = current_user.get("id") or str(current_user.get("_id"))
    now = datetime.now(timezone.utc)
    
    # Get current FDTL for remaining hours
    fdtl = await db.pilot_fdtl.find_one({"pilot_id": user_id})
    fdtl_remaining = 14 - (fdtl.get("fdp_used", 0) if fdtl else 0)
    
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
    
    # Send duty email in background
    pilot_email = current_user.get("email")
    pilot_name = current_user.get("full_name", "Pilot")
    if pilot_email:
        background_tasks.add_task(
            _send_duty_email,
            pilot_email,
            pilot_name,
            "check_in",
            {
                "time": now.strftime("%H:%M IST"),
                "date": now.strftime("%d %B %Y"),
                "fdtl_remaining": round(fdtl_remaining, 1)
            }
        )
    
    return {"message": "Checked in successfully", "timestamp": now.isoformat()}


@router.post("/duty/check-out")
async def pilot_check_out(
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    """Record pilot duty end"""
    db = get_database()
    
    user_id = current_user.get("id") or str(current_user.get("_id"))
    now = datetime.now(timezone.utc)
    
    # Get current FDTL
    fdtl = await db.pilot_fdtl.find_one({"pilot_id": user_id})
    
    duty_hours = 0
    check_in_time = "N/A"
    if fdtl and fdtl.get("duty_start_time"):
        try:
            start = datetime.fromisoformat(fdtl["duty_start_time"].replace("Z", "+00:00"))
            duty_hours = (now - start).total_seconds() / 3600
            check_in_time = start.strftime("%H:%M IST")
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
    
    # Send duty email in background
    pilot_email = current_user.get("email")
    pilot_name = current_user.get("full_name", "Pilot")
    fdp_used = (fdtl.get("fdp_used", 0) if fdtl else 0) + duty_hours
    
    if pilot_email:
        background_tasks.add_task(
            _send_duty_email,
            pilot_email,
            pilot_name,
            "check_out",
            {
                "duty_hours": round(duty_hours, 1),
                "check_in_time": check_in_time,
                "check_out_time": now.strftime("%H:%M IST"),
                "fdp_used": round(fdp_used, 1)
            }
        )
    
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



# ==================== DOCUMENT UPLOAD ====================

@router.post("/documents/upload")
async def upload_pilot_document(
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    """Upload pilot document (license, medical, rating certificates)"""
    from fastapi import File, UploadFile, Form
    
    # This endpoint requires form data - we'll create a separate one
    pass


from fastapi import File, UploadFile, Form
from typing import Optional
import base64
import os


@router.post("/documents/upload-file")
async def upload_pilot_document_file(
    document_type: str = Form(...),
    document_number: str = Form(...),
    expiry_date: str = Form(...),
    file: UploadFile = File(...),
    issuer: Optional[str] = Form(None),
    notes: Optional[str] = Form(None),
    current_user: dict = Depends(get_current_user)
):
    """
    Upload pilot document with file
    
    Document types: license, medical, type_rating, insurance, passport, other
    """
    db = get_database()
    
    user_id = current_user.get("id") or str(current_user.get("_id"))
    
    # Validate document type
    valid_types = ["license", "medical", "type_rating", "insurance", "passport", "aadhar", "pan", "other"]
    if document_type.lower() not in valid_types:
        raise HTTPException(status_code=400, detail=f"Invalid document type. Must be one of: {', '.join(valid_types)}")
    
    # Validate file type
    allowed_extensions = [".pdf", ".jpg", ".jpeg", ".png"]
    file_ext = os.path.splitext(file.filename)[1].lower()
    if file_ext not in allowed_extensions:
        raise HTTPException(status_code=400, detail=f"Invalid file type. Allowed: {', '.join(allowed_extensions)}")
    
    # Validate file size (max 5MB)
    file_content = await file.read()
    if len(file_content) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large. Maximum 5MB allowed.")
    
    # Parse expiry date
    try:
        expiry = datetime.strptime(expiry_date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
    
    now = datetime.now(timezone.utc)
    
    # Store file as base64 (for simplicity, in production use cloud storage)
    file_base64 = base64.b64encode(file_content).decode('utf-8')
    
    # Create document record
    doc_id = f"doc_{ObjectId()}"
    document = {
        "id": doc_id,
        "pilot_id": user_id,
        "document_type": document_type.lower(),
        "document_number": document_number,
        "expiry_date": expiry.isoformat(),
        "file_name": file.filename,
        "file_type": file.content_type,
        "file_size": len(file_content),
        "file_data": file_base64,
        "issuer": issuer,
        "notes": notes,
        "verification_status": "pending",  # pending, verified, rejected
        "uploaded_at": now.isoformat(),
        "created_at": now.isoformat()
    }
    
    # Check if document already exists (update if so)
    existing = await db.pilot_documents.find_one({
        "pilot_id": user_id,
        "document_type": document_type.lower(),
        "document_number": document_number
    })
    
    if existing:
        await db.pilot_documents.update_one(
            {"id": existing["id"]},
            {"$set": {
                "expiry_date": expiry.isoformat(),
                "file_name": file.filename,
                "file_type": file.content_type,
                "file_size": len(file_content),
                "file_data": file_base64,
                "issuer": issuer,
                "notes": notes,
                "verification_status": "pending",
                "uploaded_at": now.isoformat(),
                "updated_at": now.isoformat()
            }}
        )
        return {
            "message": "Document updated successfully",
            "document_id": existing["id"],
            "status": "pending_verification"
        }
    else:
        await db.pilot_documents.insert_one(document)
        return {
            "message": "Document uploaded successfully",
            "document_id": doc_id,
            "status": "pending_verification"
        }


@router.get("/documents/{doc_id}/download")
async def download_pilot_document(
    doc_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Download a pilot document"""
    from fastapi.responses import Response
    
    db = get_database()
    user_id = current_user.get("id") or str(current_user.get("_id"))
    user_roles = current_user.get("roles", [])
    
    # Get document
    document = await db.pilot_documents.find_one({"id": doc_id}, {"_id": 0})
    
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Check access - must be owner or admin/operator
    is_owner = document.get("pilot_id") == user_id
    is_admin = any(r in user_roles for r in ["admin", "super_admin", "operator"])
    
    if not is_owner and not is_admin:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Decode file
    file_data = base64.b64decode(document.get("file_data", ""))
    
    return Response(
        content=file_data,
        media_type=document.get("file_type", "application/octet-stream"),
        headers={
            "Content-Disposition": f"attachment; filename={document.get('file_name', 'document')}"
        }
    )




# ==================== FLIGHT PRE-CHECK ====================

PREFLIGHT_CHECKLIST = [
    {"category": "Weather", "items": [
        {"id": "weather_briefing", "label": "Weather briefing obtained", "critical": True},
        {"id": "weather_suitable", "label": "Weather conditions suitable for flight", "critical": True},
        {"id": "notams_checked", "label": "NOTAMs checked", "critical": True},
    ]},
    {"category": "Aircraft", "items": [
        {"id": "fuel_check", "label": "Fuel quantity checked and adequate", "critical": True},
        {"id": "oil_level", "label": "Oil level within limits", "critical": True},
        {"id": "exterior_inspection", "label": "Exterior walk-around completed", "critical": True},
        {"id": "documents_onboard", "label": "Aircraft documents on board", "critical": True},
        {"id": "avionics_check", "label": "Avionics functional check completed", "critical": False},
        {"id": "emergency_equipment", "label": "Emergency equipment checked", "critical": True},
    ]},
    {"category": "Pilot", "items": [
        {"id": "license_valid", "label": "License and medical valid", "critical": True},
        {"id": "fdtl_compliance", "label": "FDTL limits checked", "critical": True},
        {"id": "fit_to_fly", "label": "Pilot fit to fly (IMSAFE)", "critical": True},
    ]},
    {"category": "Passengers", "items": [
        {"id": "passenger_briefing", "label": "Safety briefing completed", "critical": True},
        {"id": "weight_balance", "label": "Weight & balance within limits", "critical": True},
        {"id": "baggage_secured", "label": "Baggage secured", "critical": False},
        {"id": "seatbelts_checked", "label": "Seatbelts fastened", "critical": True},
    ]},
    {"category": "Communications", "items": [
        {"id": "radio_check", "label": "Radio communication check", "critical": True},
        {"id": "atc_clearance", "label": "ATC clearance obtained (if required)", "critical": False},
        {"id": "flight_plan_filed", "label": "Flight plan filed (if required)", "critical": False},
    ]},
]


@router.get("/preflight/checklist")
async def get_preflight_checklist(
    current_user: dict = Depends(get_current_user)
):
    """Get the standard pre-flight checklist"""
    return {
        "checklist": PREFLIGHT_CHECKLIST,
        "total_items": sum(len(cat["items"]) for cat in PREFLIGHT_CHECKLIST),
        "critical_items": sum(
            sum(1 for item in cat["items"] if item["critical"]) 
            for cat in PREFLIGHT_CHECKLIST
        )
    }


@router.post("/preflight/submit")
async def submit_preflight_check(
    data: dict,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    """
    Submit pre-flight checklist
    
    data: {
        "flight_id": str (optional),
        "aircraft_registration": str,
        "items_checked": {"weather_briefing": true, "fuel_check": true, ...},
        "notes": str (optional),
        "passenger_count": int
    }
    """
    db = get_database()
    
    user_id = current_user.get("id") or str(current_user.get("_id"))
    pilot_name = current_user.get("full_name", "Pilot")
    now = datetime.now(timezone.utc)
    
    items_checked = data.get("items_checked", {})
    
    # Validate all critical items are checked
    missing_critical = []
    for category in PREFLIGHT_CHECKLIST:
        for item in category["items"]:
            if item["critical"] and not items_checked.get(item["id"]):
                missing_critical.append(f"{category['category']}: {item['label']}")
    
    if missing_critical:
        raise HTTPException(
            status_code=400, 
            detail={
                "message": "Cannot proceed - critical items not checked",
                "missing_items": missing_critical
            }
        )
    
    # Calculate completion percentage
    total_items = sum(len(cat["items"]) for cat in PREFLIGHT_CHECKLIST)
    checked_count = sum(1 for v in items_checked.values() if v)
    completion_pct = round((checked_count / total_items) * 100, 1)
    
    # Create preflight record
    preflight_id = f"precheck_{ObjectId()}"
    preflight_record = {
        "id": preflight_id,
        "pilot_id": user_id,
        "pilot_name": pilot_name,
        "flight_id": data.get("flight_id"),
        "aircraft_registration": data.get("aircraft_registration", "Unknown"),
        "items_checked": items_checked,
        "checked_count": checked_count,
        "total_items": total_items,
        "completion_percentage": completion_pct,
        "passenger_count": data.get("passenger_count", 0),
        "notes": data.get("notes", ""),
        "status": "approved" if completion_pct >= 80 else "review_required",
        "submitted_at": now.isoformat(),
        "created_at": now.isoformat()
    }
    
    await db.preflight_checks.insert_one(preflight_record)
    
    # Update flight assignment if flight_id provided
    if data.get("flight_id"):
        await db.pilot_assignments.update_one(
            {"flight_id": data["flight_id"], "pilot_id": user_id},
            {"$set": {
                "preflight_completed": True,
                "preflight_id": preflight_id,
                "preflight_at": now.isoformat()
            }}
        )
    
    return {
        "message": "Pre-flight check submitted successfully",
        "preflight_id": preflight_id,
        "status": preflight_record["status"],
        "completion_percentage": completion_pct,
        "ready_for_takeoff": completion_pct >= 80
    }


@router.get("/preflight/history")
async def get_preflight_history(
    limit: int = 10,
    current_user: dict = Depends(get_current_user)
):
    """Get pilot's pre-flight check history"""
    db = get_database()
    
    user_id = current_user.get("id") or str(current_user.get("_id"))
    
    records = await db.preflight_checks.find(
        {"pilot_id": user_id},
        {"_id": 0}
    ).sort("submitted_at", -1).limit(limit).to_list(limit)
    
    return {"preflight_history": records}

@router.delete("/documents/{doc_id}")
async def delete_pilot_document(
    doc_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a pilot document"""
    db = get_database()
    user_id = current_user.get("id") or str(current_user.get("_id"))
    
    # Get document
    document = await db.pilot_documents.find_one({"id": doc_id})
    
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Check ownership
    if document.get("pilot_id") != user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Delete
    await db.pilot_documents.delete_one({"id": doc_id})
    
    return {"message": "Document deleted successfully"}
