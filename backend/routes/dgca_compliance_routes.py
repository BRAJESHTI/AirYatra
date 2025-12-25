from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, timezone, timedelta
from uuid import uuid4
from database import get_database
from routes.auth_routes import get_current_user

router = APIRouter(prefix="/dgca", tags=["DGCA Compliance"])

# DGCA Regulations (Simplified)
DGCA_LIMITS = {
    "max_flight_duty_period": 14,  # hours
    "max_flight_time_daily": 8,  # hours
    "max_flight_time_weekly": 30,  # hours
    "max_flight_time_monthly": 100,  # hours
    "max_flight_time_yearly": 1000,  # hours
    "min_rest_period": 10,  # hours
    "min_rest_after_night_ops": 12,  # hours
    "max_consecutive_duty_days": 7,
    "min_days_off_monthly": 4
}

# Models
class FlightDutyLog(BaseModel):
    pilot_id: str
    date: str
    duty_start: str  # ISO datetime
    duty_end: str
    flight_time_hours: float
    sectors: int = 1
    is_night_ops: bool = False
    aircraft_registration: str
    route: str
    remarks: Optional[str] = None

class RestPeriodLog(BaseModel):
    pilot_id: str
    rest_start: str
    rest_end: str
    location: str
    accommodation_type: Optional[str] = None  # hotel, home, crew_room

class ComplianceReport(BaseModel):
    report_type: str  # flight_log, duty_hours, rest_compliance, aircraft_utilization
    start_date: str
    end_date: str
    entity_id: Optional[str] = None  # pilot_id or aircraft_id
    format: str = "summary"  # summary, detailed

# Helper Functions
async def calculate_pilot_hours(db, pilot_id: str, period: str) -> dict:
    """Calculate pilot flight hours for a period"""
    now = datetime.now(timezone.utc)
    
    if period == "daily":
        start = now.replace(hour=0, minute=0, second=0)
    elif period == "weekly":
        start = now - timedelta(days=7)
    elif period == "monthly":
        start = now - timedelta(days=30)
    elif period == "yearly":
        start = now - timedelta(days=365)
    else:
        start = now - timedelta(days=30)
    
    pipeline = [
        {
            "$match": {
                "pilot_id": pilot_id,
                "date": {"$gte": start.strftime("%Y-%m-%d")}
            }
        },
        {
            "$group": {
                "_id": None,
                "total_hours": {"$sum": "$flight_time_hours"},
                "total_sectors": {"$sum": "$sectors"},
                "duty_days": {"$addToSet": "$date"}
            }
        }
    ]
    
    result = await db.flight_duty_logs.aggregate(pipeline).to_list(1)
    
    if result:
        return {
            "period": period,
            "total_hours": round(result[0]["total_hours"], 1),
            "total_sectors": result[0]["total_sectors"],
            "duty_days": len(result[0]["duty_days"])
        }
    return {"period": period, "total_hours": 0, "total_sectors": 0, "duty_days": 0}

async def check_pilot_compliance(db, pilot_id: str) -> dict:
    """Check if pilot is compliant with DGCA limits"""
    daily = await calculate_pilot_hours(db, pilot_id, "daily")
    weekly = await calculate_pilot_hours(db, pilot_id, "weekly")
    monthly = await calculate_pilot_hours(db, pilot_id, "monthly")
    yearly = await calculate_pilot_hours(db, pilot_id, "yearly")
    
    violations = []
    warnings = []
    
    # Check limits
    if daily["total_hours"] > DGCA_LIMITS["max_flight_time_daily"]:
        violations.append(f"Daily flight time exceeded: {daily['total_hours']}h / {DGCA_LIMITS['max_flight_time_daily']}h max")
    elif daily["total_hours"] > DGCA_LIMITS["max_flight_time_daily"] * 0.9:
        warnings.append(f"Approaching daily limit: {daily['total_hours']}h")
    
    if weekly["total_hours"] > DGCA_LIMITS["max_flight_time_weekly"]:
        violations.append(f"Weekly flight time exceeded: {weekly['total_hours']}h / {DGCA_LIMITS['max_flight_time_weekly']}h max")
    elif weekly["total_hours"] > DGCA_LIMITS["max_flight_time_weekly"] * 0.9:
        warnings.append(f"Approaching weekly limit: {weekly['total_hours']}h")
    
    if monthly["total_hours"] > DGCA_LIMITS["max_flight_time_monthly"]:
        violations.append(f"Monthly flight time exceeded: {monthly['total_hours']}h / {DGCA_LIMITS['max_flight_time_monthly']}h max")
    elif monthly["total_hours"] > DGCA_LIMITS["max_flight_time_monthly"] * 0.9:
        warnings.append(f"Approaching monthly limit: {monthly['total_hours']}h")
    
    if yearly["total_hours"] > DGCA_LIMITS["max_flight_time_yearly"]:
        violations.append(f"Yearly flight time exceeded: {yearly['total_hours']}h / {DGCA_LIMITS['max_flight_time_yearly']}h max")
    elif yearly["total_hours"] > DGCA_LIMITS["max_flight_time_yearly"] * 0.9:
        warnings.append(f"Approaching yearly limit: {yearly['total_hours']}h")
    
    # Check rest period
    last_duty = await db.flight_duty_logs.find_one(
        {"pilot_id": pilot_id},
        sort=[("duty_end", -1)]
    )
    
    if last_duty:
        duty_end = datetime.fromisoformat(last_duty["duty_end"].replace('Z', '+00:00'))
        hours_since_duty = (datetime.now(timezone.utc) - duty_end).total_seconds() / 3600
        
        min_rest = DGCA_LIMITS["min_rest_after_night_ops"] if last_duty.get("is_night_ops") else DGCA_LIMITS["min_rest_period"]
        
        if hours_since_duty < min_rest:
            violations.append(f"Insufficient rest: {round(hours_since_duty, 1)}h since last duty, {min_rest}h required")
    
    return {
        "pilot_id": pilot_id,
        "is_compliant": len(violations) == 0,
        "can_fly": len(violations) == 0,
        "hours": {
            "daily": daily,
            "weekly": weekly,
            "monthly": monthly,
            "yearly": yearly
        },
        "limits": DGCA_LIMITS,
        "violations": violations,
        "warnings": warnings
    }

# API Endpoints
@router.get("/limits")
async def get_dgca_limits():
    """Get DGCA regulatory limits"""
    return {"limits": DGCA_LIMITS}

@router.post("/duty-log")
async def log_flight_duty(log: FlightDutyLog, current_user: dict = Depends(get_current_user)):
    """Log a flight duty period"""
    db = get_database()
    
    log_data = {
        "id": str(uuid4()),
        **log.dict(),
        "logged_by": current_user["id"],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.flight_duty_logs.insert_one(log_data)
    
    # Check compliance after logging
    compliance = await check_pilot_compliance(db, log.pilot_id)
    
    log_data.pop("_id", None)
    
    return {
        "message": "Duty logged",
        "log": log_data,
        "compliance_status": compliance
    }

@router.post("/rest-log")
async def log_rest_period(log: RestPeriodLog, current_user: dict = Depends(get_current_user)):
    """Log a rest period"""
    db = get_database()
    
    # Calculate rest duration
    rest_start = datetime.fromisoformat(log.rest_start.replace('Z', '+00:00'))
    rest_end = datetime.fromisoformat(log.rest_end.replace('Z', '+00:00'))
    duration_hours = (rest_end - rest_start).total_seconds() / 3600
    
    log_data = {
        "id": str(uuid4()),
        **log.dict(),
        "duration_hours": round(duration_hours, 1),
        "meets_minimum": duration_hours >= DGCA_LIMITS["min_rest_period"],
        "logged_by": current_user["id"],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.rest_period_logs.insert_one(log_data)
    log_data.pop("_id", None)
    
    return {"message": "Rest period logged", "log": log_data}

@router.get("/pilot/{pilot_id}/compliance")
async def get_pilot_compliance(pilot_id: str, current_user: dict = Depends(get_current_user)):
    """Get pilot compliance status"""
    db = get_database()
    return await check_pilot_compliance(db, pilot_id)

@router.get("/pilot/{pilot_id}/can-fly")
async def check_can_fly(pilot_id: str, flight_hours: float = 0):
    """Quick check if pilot can fly"""
    db = get_database()
    compliance = await check_pilot_compliance(db, pilot_id)
    
    # Additional check for planned flight
    if flight_hours > 0:
        daily = compliance["hours"]["daily"]["total_hours"]
        if daily + flight_hours > DGCA_LIMITS["max_flight_time_daily"]:
            return {
                "can_fly": False,
                "reason": f"Flight would exceed daily limit. Current: {daily}h, Planned: {flight_hours}h, Max: {DGCA_LIMITS['max_flight_time_daily']}h"
            }
    
    return {
        "can_fly": compliance["can_fly"],
        "violations": compliance["violations"],
        "warnings": compliance["warnings"]
    }

@router.get("/pilot/{pilot_id}/duty-history")
async def get_duty_history(pilot_id: str, days: int = 30, current_user: dict = Depends(get_current_user)):
    """Get pilot duty history"""
    db = get_database()
    
    start_date = (datetime.now(timezone.utc) - timedelta(days=days)).strftime("%Y-%m-%d")
    
    logs = await db.flight_duty_logs.find(
        {"pilot_id": pilot_id, "date": {"$gte": start_date}},
        {"_id": 0}
    ).sort("date", -1).to_list(100)
    
    return {"duty_logs": logs, "count": len(logs)}

@router.get("/alerts")
async def get_compliance_alerts(current_user: dict = Depends(get_current_user)):
    """Get all compliance alerts"""
    if "admin" not in current_user.get("roles", []) and "operator" not in current_user.get("roles", []):
        raise HTTPException(status_code=403, detail="Access denied")
    
    db = get_database()
    
    # Get all pilots with recent activity
    thirty_days_ago = (datetime.now(timezone.utc) - timedelta(days=30)).strftime("%Y-%m-%d")
    
    pipeline = [
        {"$match": {"date": {"$gte": thirty_days_ago}}},
        {"$group": {"_id": "$pilot_id"}}
    ]
    
    active_pilots = []
    async for doc in db.flight_duty_logs.aggregate(pipeline):
        active_pilots.append(doc["_id"])
    
    alerts = []
    for pilot_id in active_pilots:
        compliance = await check_pilot_compliance(db, pilot_id)
        
        # Get pilot info
        pilot = await db.pilots.find_one({"id": pilot_id}, {"_id": 0, "name": 1, "license_number": 1})
        pilot_name = pilot.get("name", pilot_id) if pilot else pilot_id
        
        if compliance["violations"]:
            alerts.append({
                "pilot_id": pilot_id,
                "pilot_name": pilot_name,
                "severity": "critical",
                "type": "violation",
                "messages": compliance["violations"]
            })
        elif compliance["warnings"]:
            alerts.append({
                "pilot_id": pilot_id,
                "pilot_name": pilot_name,
                "severity": "warning",
                "type": "approaching_limit",
                "messages": compliance["warnings"]
            })
    
    return {
        "alerts": alerts,
        "critical_count": len([a for a in alerts if a["severity"] == "critical"]),
        "warning_count": len([a for a in alerts if a["severity"] == "warning"])
    }

@router.post("/report")
async def generate_compliance_report(report: ComplianceReport, current_user: dict = Depends(get_current_user)):
    """Generate DGCA compliance report"""
    if "admin" not in current_user.get("roles", []):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    db = get_database()
    
    report_data = {
        "id": str(uuid4()),
        "report_type": report.report_type,
        "period": f"{report.start_date} to {report.end_date}",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "generated_by": current_user["id"]
    }
    
    if report.report_type == "flight_log":
        logs = await db.flight_duty_logs.find(
            {"date": {"$gte": report.start_date, "$lte": report.end_date}},
            {"_id": 0}
        ).to_list(1000)
        report_data["flight_logs"] = logs
        report_data["total_flights"] = len(logs)
        report_data["total_hours"] = sum(l.get("flight_time_hours", 0) for l in logs)
    
    elif report.report_type == "duty_hours":
        pipeline = [
            {"$match": {"date": {"$gte": report.start_date, "$lte": report.end_date}}},
            {"$group": {
                "_id": "$pilot_id",
                "total_hours": {"$sum": "$flight_time_hours"},
                "total_sectors": {"$sum": "$sectors"},
                "duty_days": {"$sum": 1}
            }},
            {"$sort": {"total_hours": -1}}
        ]
        
        pilot_hours = []
        async for doc in db.flight_duty_logs.aggregate(pipeline):
            pilot_hours.append({
                "pilot_id": doc["_id"],
                "total_hours": round(doc["total_hours"], 1),
                "total_sectors": doc["total_sectors"],
                "duty_days": doc["duty_days"]
            })
        report_data["pilot_hours"] = pilot_hours
    
    # Save report
    await db.compliance_reports.insert_one(report_data)
    report_data.pop("_id", None)
    
    return report_data

@router.get("/dashboard")
async def get_compliance_dashboard(current_user: dict = Depends(get_current_user)):
    """Get DGCA compliance dashboard"""
    if "admin" not in current_user.get("roles", []) and "operator" not in current_user.get("roles", []):
        raise HTTPException(status_code=403, detail="Access denied")
    
    db = get_database()
    
    alerts = await get_compliance_alerts(current_user)
    
    # Flight stats this month
    month_start = datetime.now(timezone.utc).replace(day=1).strftime("%Y-%m-%d")
    
    pipeline = [
        {"$match": {"date": {"$gte": month_start}}},
        {"$group": {
            "_id": None,
            "total_hours": {"$sum": "$flight_time_hours"},
            "total_sectors": {"$sum": "$sectors"},
            "unique_pilots": {"$addToSet": "$pilot_id"}
        }}
    ]
    
    month_stats = await db.flight_duty_logs.aggregate(pipeline).to_list(1)
    
    return {
        "alerts_summary": {
            "critical": alerts["critical_count"],
            "warnings": alerts["warning_count"]
        },
        "this_month": {
            "total_flight_hours": round(month_stats[0]["total_hours"], 1) if month_stats else 0,
            "total_sectors": month_stats[0]["total_sectors"] if month_stats else 0,
            "active_pilots": len(month_stats[0]["unique_pilots"]) if month_stats else 0
        },
        "dgca_limits": DGCA_LIMITS,
        "recent_alerts": alerts["alerts"][:5]
    }
