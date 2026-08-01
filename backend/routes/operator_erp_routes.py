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


@router.get("/analytics")
async def erp_analytics(current_user: dict = Depends(get_current_user), db=Depends(get_database)):
    """Advanced ERP analytics: utilization trend, fuel efficiency, pilot duty hours, maintenance costs, revenue"""
    operator = await _get_operator(db, current_user)
    fleet_query = {"operator_id": operator["id"]} if operator else {}
    fleet = await db.aircraft.find(fleet_query, {"_id": 0, "id": 1, "registration_number": 1, "model_name": 1, "aircraft_type": 1}).to_list(100)
    fleet_map = {a["id"]: a for a in fleet}
    fleet_ids = list(fleet_map.keys())
    now = datetime.now(timezone.utc)

    # 6-month utilization trend
    six_months_ago = (now.replace(day=1) - timedelta(days=155)).strftime("%Y-%m-01")
    records = await db.flight_records.find(
        {"aircraft_id": {"$in": fleet_ids}, "departure_time": {"$gte": six_months_ago}}, {"_id": 0}
    ).to_list(5000)
    trend = {}
    for i in range(5, -1, -1):
        m = now.month - i
        y = now.year
        while m <= 0:
            m += 12
            y -= 1
        trend[f"{y}-{m:02d}"] = {"label": datetime(y, m, 1).strftime("%b"), "flights": 0, "hours": 0}
    for r in records:
        key = (r.get("departure_time") or "")[:7]
        if key in trend:
            trend[key]["flights"] += 1
            trend[key]["hours"] += r.get("flight_duration_minutes", 0) / 60
    monthly_trend = [{"month": k, "label": v["label"], "flights": v["flights"], "hours": round(v["hours"], 1)} for k, v in trend.items()]

    # Fuel efficiency per aircraft (all records this period)
    fuel_stats = []
    for a in fleet:
        recs = [r for r in records if r["aircraft_id"] == a["id"]]
        hours = sum(r.get("flight_duration_minutes", 0) for r in recs) / 60
        fuel = sum(r.get("fuel_used_liters", 0) for r in recs)
        km = sum(r.get("distance_km", 0) for r in recs)
        fuel_stats.append({
            "aircraft_id": a["id"],
            "label": f"{a.get('model_name') or a.get('aircraft_type', '')} ({a.get('registration_number', 'N/A')})",
            "hours": round(hours, 1), "fuel_liters": round(fuel, 1), "km": round(km, 1),
            "liters_per_hour": round(fuel / hours, 1) if hours > 0 else 0,
        })

    # Pilot duty hours this month (DGCA FDTL ~100h/month watch)
    month_start = f"{now.year}-{now.month:02d}-01"
    month_recs = [r for r in records if (r.get("departure_time") or "") >= month_start]
    pilots = await db.pilots.find({"operator_id": operator["id"]} if operator else {}, {"_id": 0, "id": 1, "full_name": 1, "name": 1}).to_list(100)
    pilot_hours = []
    for p in pilots:
        p_recs = [r for r in month_recs if r.get("pilot_id") == p["id"]]
        hrs = round(sum(r.get("flight_duration_minutes", 0) for r in p_recs) / 60, 1)
        pilot_hours.append({
            "pilot_id": p["id"], "name": p.get("full_name") or p.get("name", ""),
            "flights": len(p_recs), "hours": hrs,
            "fdtl_status": "over_limit" if hrs > 100 else ("watch" if hrs > 80 else "ok"),
        })
    pilot_hours.sort(key=lambda x: -x["hours"])

    # Maintenance costs
    year_start = f"{now.year}-01-01"
    completed = await db.maintenance_schedules.find(
        {"aircraft_id": {"$in": fleet_ids}, "status": "completed", "completion_date": {"$gte": year_start}},
        {"_id": 0, "actual_cost": 1, "estimated_cost": 1}
    ).to_list(500)
    upcoming = await db.maintenance_schedules.find(
        {"aircraft_id": {"$in": fleet_ids}, "status": {"$in": ["scheduled", "in_progress"]}},
        {"_id": 0, "estimated_cost": 1}
    ).to_list(500)
    maintenance_costs = {
        "spent_ytd": round(sum(c.get("actual_cost") or c.get("estimated_cost") or 0 for c in completed), 2),
        "completed_count": len(completed),
        "upcoming_estimate": round(sum(u.get("estimated_cost") or 0 for u in upcoming), 2),
        "upcoming_count": len(upcoming),
    }

    # Revenue this month (accepted quotes)
    quotes = await db.quotes.find(
        {"operator_id": operator["id"] if operator else {"$exists": True},
         "status": {"$in": ["accepted", "approved", "converted"]},
         "created_at": {"$gte": month_start}},
        {"_id": 0, "amount": 1}
    ).to_list(1000)
    revenue_month = round(sum(q.get("amount", 0) for q in quotes), 2)
    fuel_month = sum(r.get("fuel_used_liters", 0) for r in month_recs)

    return {
        "monthly_trend": monthly_trend,
        "fuel_stats": fuel_stats,
        "pilot_hours": pilot_hours,
        "maintenance_costs": maintenance_costs,
        "revenue_this_month": revenue_month,
        "fuel_this_month_liters": round(fuel_month, 1),
        "accepted_quotes_this_month": len(quotes),
    }


@router.get("/logbook/export")
async def export_logbook_csv(
    aircraft_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """One-click CSV export of the digital flight logbook (DGCA audit ready)"""
    import csv
    import io
    from fastapi.responses import Response
    operator = await _get_operator(db, current_user)
    fleet_query = {"operator_id": operator["id"]} if operator else {}
    fleet = await db.aircraft.find(fleet_query, {"_id": 0, "id": 1, "registration_number": 1, "model_name": 1, "aircraft_type": 1}).to_list(100)
    fleet_map = {a["id"]: a for a in fleet}
    ids = [aircraft_id] if aircraft_id and aircraft_id in fleet_map else list(fleet_map.keys())
    records = await db.flight_records.find({"aircraft_id": {"$in": ids}}, {"_id": 0}).sort("departure_time", -1).to_list(5000)
    pilots = await db.pilots.find({"operator_id": operator["id"]} if operator else {}, {"_id": 0, "id": 1, "full_name": 1, "name": 1}).to_list(100)
    pilot_map = {p["id"]: p.get("full_name") or p.get("name", "") for p in pilots}

    buf = io.StringIO()
    w = csv.writer(buf)
    now = datetime.now(timezone.utc)
    w.writerow([f"AirYatra ERP - Digital Flight Logbook - {operator.get('company_name', '') if operator else 'All Operators'}"])
    w.writerow([f"Generated: {now.strftime('%d %b %Y %H:%M UTC')}", f"Total entries: {len(records)}"])
    w.writerow([])
    w.writerow(["Date/Time (Departure)", "Aircraft", "Registration", "From", "To", "Pilot", "Duration (min)", "Distance (km)", "Fuel (L)", "Remarks"])
    for r in records:
        ac = fleet_map.get(r["aircraft_id"], {})
        w.writerow([
            (r.get("departure_time") or "").replace("T", " ")[:16],
            ac.get("model_name") or ac.get("aircraft_type", ""),
            ac.get("registration_number", ""),
            r.get("departure_location", ""), r.get("arrival_location", ""),
            pilot_map.get(r.get("pilot_id"), ""),
            r.get("flight_duration_minutes", 0), r.get("distance_km", 0),
            r.get("fuel_used_liters", 0), r.get("remarks", ""),
        ])
    total_min = sum(r.get("flight_duration_minutes", 0) for r in records)
    w.writerow([])
    w.writerow(["TOTALS", "", "", "", "", "", f"{total_min} min ({round(total_min/60,1)}h)",
                round(sum(r.get("distance_km", 0) for r in records), 1),
                round(sum(r.get("fuel_used_liters", 0) for r in records), 1), ""])
    fname = f"AirYatra_Flight_Logbook_{now.strftime('%Y%m%d')}.csv"
    return Response(
        content="\ufeff" + buf.getvalue(),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{fname}"'},
    )


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
