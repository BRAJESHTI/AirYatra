"""
Operator ERP Shell — Digital Flight Logbook + Maintenance Alerts (one place)
"""
from fastapi import APIRouter, HTTPException, Depends
from typing import Optional
from datetime import datetime, timezone, timedelta
from database import get_database
from middleware import get_current_user

router = APIRouter(prefix="/erp/operator", tags=["Operator ERP"])

MAINTENANCE_INTERVAL_HOURS = 100


async def _get_operator(db, user):
    if "operator" not in user.get("roles", []) and "admin" not in user.get("roles", []):
        raise HTTPException(status_code=403, detail="Operator access required")
    operator = await db.operators.find_one({"user_id": user["id"]}, {"_id": 0})
    if not operator and "operator" in user.get("roles", []):
        raise HTTPException(status_code=404, detail="Operator profile not found")
    return operator


@router.get("/overview")
async def erp_overview(current_user: dict = Depends(get_current_user), db=Depends(get_database)):
    """ERP Command Center: fleet health, flight KPIs, maintenance alerts in one place"""
    operator = await _get_operator(db, current_user)
    fleet_query = {"operator_id": operator["id"]} if operator else {}
    fleet = await db.aircraft.find(fleet_query, {"_id": 0}).to_list(100)
    fleet_ids = [a["id"] for a in fleet]

    now = datetime.now(timezone.utc)
    today = now.date().isoformat()
    month_start = f"{now.year}-{now.month:02d}-01"
    next_week = (now + timedelta(days=7)).date().isoformat()

    month_flights = await db.flight_records.find(
        {"aircraft_id": {"$in": fleet_ids}, "departure_time": {"$gte": month_start}}, {"_id": 0}
    ).to_list(1000)
    month_hours = round(sum(f.get("flight_duration_minutes", 0) for f in month_flights) / 60, 1)
    month_km = round(sum(f.get("distance_km", 0) for f in month_flights), 1)

    schedules = await db.maintenance_schedules.find(
        {"aircraft_id": {"$in": fleet_ids}, "status": {"$in": ["scheduled", "in_progress"]}}, {"_id": 0}
    ).sort("scheduled_date", 1).to_list(200)
    sched_by_aircraft = {}
    for s in schedules:
        sched_by_aircraft.setdefault(s["aircraft_id"], []).append(s)

    alerts = []
    fleet_out = []
    for a in fleet:
        total_hours = round(a.get("total_flight_hours", 0), 1)
        last_maint_hours = a.get("last_maintenance_hours", 0)
        hours_since = round(total_hours - last_maint_hours, 1)
        interval = a.get("maintenance_interval_hours", MAINTENANCE_INTERVAL_HOURS)
        reg = a.get("registration_number", "N/A")
        label = f"{a.get('model_name') or a.get('aircraft_type', '')} ({reg})"
        a_scheds = sched_by_aircraft.get(a["id"], [])

        for s in a_scheds:
            sd = (s.get("scheduled_date") or "")[:10]
            if s["status"] == "scheduled" and sd and sd < today:
                alerts.append({"severity": "overdue", "aircraft_id": a["id"], "aircraft": label,
                               "maintenance_id": s["id"], "title": f"{s.get('type', 'Maintenance').title()} OVERDUE since {sd}",
                               "detail": s.get("description", ""), "priority": s.get("priority", "medium")})
            elif s["status"] == "scheduled" and sd and today <= sd <= next_week:
                alerts.append({"severity": "due_soon", "aircraft_id": a["id"], "aircraft": label,
                               "maintenance_id": s["id"], "title": f"{s.get('type', 'Maintenance').title()} due on {sd}",
                               "detail": s.get("description", ""), "priority": s.get("priority", "medium")})
            elif s["status"] == "in_progress":
                alerts.append({"severity": "in_progress", "aircraft_id": a["id"], "aircraft": label,
                               "maintenance_id": s["id"], "title": f"{s.get('type', 'Maintenance').title()} in progress",
                               "detail": s.get("description", ""), "priority": s.get("priority", "medium")})

        if hours_since >= interval:
            alerts.append({"severity": "hours_due", "aircraft_id": a["id"], "aircraft": label, "maintenance_id": None,
                           "title": f"{hours_since}h flown since last maintenance (interval {interval}h)",
                           "detail": "Schedule an inspection now", "priority": "high"})
        elif hours_since >= interval * 0.8:
            alerts.append({"severity": "hours_soon", "aircraft_id": a["id"], "aircraft": label, "maintenance_id": None,
                           "title": f"{hours_since}h of {interval}h flown — maintenance approaching",
                           "detail": f"{round(interval - hours_since, 1)}h remaining", "priority": "medium"})

        next_sched = next((s for s in a_scheds if s["status"] == "scheduled"), None)
        fleet_out.append({
            "id": a["id"], "label": label, "registration": reg,
            "aircraft_type": a.get("aircraft_type"), "model_name": a.get("model_name"),
            "total_flight_hours": total_hours, "current_total_km": round(a.get("current_total_km", 0), 1),
            "hours_since_maintenance": hours_since, "maintenance_interval_hours": interval,
            "health_pct": max(0, min(100, round((1 - hours_since / interval) * 100))),
            "maintenance_status": a.get("maintenance_status", "operational"),
            "is_available": a.get("is_available", True),
            "next_maintenance": {"date": next_sched.get("scheduled_date"), "type": next_sched.get("type")} if next_sched else None,
        })

    sev_order = {"overdue": 0, "hours_due": 1, "due_soon": 2, "hours_soon": 3, "in_progress": 4}
    alerts.sort(key=lambda x: sev_order.get(x["severity"], 9))

    return {
        "kpis": {
            "fleet_size": len(fleet),
            "flights_this_month": len(month_flights),
            "hours_this_month": month_hours,
            "km_this_month": month_km,
            "open_maintenance": len(schedules),
            "critical_alerts": len([x for x in alerts if x["severity"] in ["overdue", "hours_due"]]),
        },
        "alerts": alerts,
        "fleet": fleet_out,
    }


@router.get("/logbook")
async def erp_logbook(
    aircraft_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """Digital Flight Logbook — all flight records across the operator's fleet"""
    operator = await _get_operator(db, current_user)
    fleet_query = {"operator_id": operator["id"]} if operator else {}
    fleet = await db.aircraft.find(fleet_query, {"_id": 0, "id": 1, "registration_number": 1, "model_name": 1, "aircraft_type": 1}).to_list(100)
    fleet_map = {a["id"]: a for a in fleet}
    ids = [aircraft_id] if aircraft_id and aircraft_id in fleet_map else list(fleet_map.keys())

    records = await db.flight_records.find(
        {"aircraft_id": {"$in": ids}}, {"_id": 0}
    ).sort("departure_time", -1).to_list(100)

    pilots = await db.pilots.find({"operator_id": operator["id"]} if operator else {}, {"_id": 0, "id": 1, "name": 1, "full_name": 1}).to_list(100)
    pilot_map = {p["id"]: p.get("name") or p.get("full_name", "") for p in pilots}

    for r in records:
        ac = fleet_map.get(r["aircraft_id"], {})
        r["aircraft_label"] = f"{ac.get('model_name') or ac.get('aircraft_type', '')} ({ac.get('registration_number', 'N/A')})"
        r["pilot_name"] = pilot_map.get(r.get("pilot_id"), "")

    total_minutes = sum(r.get("flight_duration_minutes", 0) for r in records)
    return {
        "records": records,
        "totals": {
            "flights": len(records),
            "hours": round(total_minutes / 60, 1),
            "distance_km": round(sum(r.get("distance_km", 0) for r in records), 1),
            "fuel_liters": round(sum(r.get("fuel_used_liters", 0) for r in records), 1),
        },
    }


@router.post("/maintenance/{maintenance_id}/complete")
async def complete_maintenance(
    maintenance_id: str,
    data: dict,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """Mark maintenance completed — resets aircraft hours-since-maintenance counter"""
    operator = await _get_operator(db, current_user)
    maint = await db.maintenance_schedules.find_one({"id": maintenance_id}, {"_id": 0})
    if not maint:
        raise HTTPException(status_code=404, detail="Maintenance not found")
    aircraft = await db.aircraft.find_one({"id": maint["aircraft_id"]}, {"_id": 0})
    if operator and aircraft and aircraft.get("operator_id") != operator["id"]:
        raise HTTPException(status_code=403, detail="Not your aircraft")

    now_iso = datetime.now(timezone.utc).isoformat()
    await db.maintenance_schedules.update_one(
        {"id": maintenance_id},
        {"$set": {
            "status": "completed",
            "completion_date": now_iso,
            "actual_cost": data.get("actual_cost", maint.get("estimated_cost", 0)),
            "notes": data.get("notes", ""),
            "completed_by": current_user["id"],
            "updated_at": now_iso,
        }}
    )
    if aircraft:
        await db.aircraft.update_one(
            {"id": aircraft["id"]},
            {"$set": {
                "last_maintenance_hours": aircraft.get("total_flight_hours", 0),
                "last_maintenance_date": now_iso[:10],
                "maintenance_pending": False,
                "maintenance_status": "operational",
                "updated_at": now_iso,
            }}
        )
    return {"message": "Maintenance completed / रखरखाव पूर्ण — hours counter reset"}
