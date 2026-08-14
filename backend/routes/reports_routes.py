from fastapi import APIRouter, Depends, Query
from typing import Optional
from datetime import datetime, timezone, timedelta
from database import get_database
from middleware import require_roles
from models import UserRole

router = APIRouter(prefix="/reports", tags=["Reports"])

@router.get("/bookings/by-route")
async def get_bookings_by_route(
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    limit: int = 20,
    current_user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.REGIONAL_MANAGER])),
    db=Depends(get_database)
):
    """Get bookings grouped by route (from-to locations)"""
    match_query = {}
    if from_date:
        match_query["created_at"] = {"$gte": from_date}
    if to_date:
        if "created_at" in match_query:
            match_query["created_at"]["$lte"] = to_date
        else:
            match_query["created_at"] = {"$lte": to_date}
    
    pipeline = [
        {"$match": match_query} if match_query else {"$match": {}},
        {
            "$group": {
                "_id": {
                    "from": "$from_location",
                    "to": "$to_location",
                    "from_state": "$from_state",
                    "to_state": "$to_state"
                },
                "total_bookings": {"$sum": 1},
                "completed_bookings": {
                    "$sum": {"$cond": [{"$eq": ["$status", "completed"]}, 1, 0]}
                },
                "cancelled_bookings": {
                    "$sum": {"$cond": [{"$eq": ["$status", "cancelled"]}, 1, 0]}
                },
                "total_revenue": {"$sum": {"$ifNull": ["$final_price", 0]}},
                "avg_price": {"$avg": {"$ifNull": ["$final_price", 0]}}
            }
        },
        {"$sort": {"total_bookings": -1}},
        {"$limit": limit}
    ]
    
    results = await db.bookings.aggregate(pipeline).to_list(limit)
    
    routes = []
    for r in results:
        routes.append({
            "from_location": r["_id"]["from"],
            "to_location": r["_id"]["to"],
            "from_state": r["_id"].get("from_state", ""),
            "to_state": r["_id"].get("to_state", ""),
            "total_bookings": r["total_bookings"],
            "completed_bookings": r["completed_bookings"],
            "cancelled_bookings": r["cancelled_bookings"],
            "total_revenue": round(r["total_revenue"], 2),
            "avg_price": round(r["avg_price"], 2) if r["avg_price"] else 0
        })
    
    return {"routes": routes, "total_routes": len(routes)}

@router.get("/bookings/by-state")
async def get_bookings_by_state(
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    current_user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.REGIONAL_MANAGER])),
    db=Depends(get_database)
):
    """Get bookings grouped by state"""
    match_query = {}
    if from_date:
        match_query["created_at"] = {"$gte": from_date}
    if to_date:
        if "created_at" in match_query:
            match_query["created_at"]["$lte"] = to_date
        else:
            match_query["created_at"] = {"$lte": to_date}
    
    pipeline = [
        {"$match": match_query} if match_query else {"$match": {}},
        {
            "$group": {
                "_id": "$from_state",
                "total_bookings": {"$sum": 1},
                "completed": {"$sum": {"$cond": [{"$eq": ["$status", "completed"]}, 1, 0]}},
                "cancelled": {"$sum": {"$cond": [{"$eq": ["$status", "cancelled"]}, 1, 0]}},
                "total_revenue": {"$sum": {"$ifNull": ["$final_price", 0]}}
            }
        },
        {"$sort": {"total_bookings": -1}}
    ]
    
    results = await db.bookings.aggregate(pipeline).to_list(100)
    
    states = []
    for r in results:
        if r["_id"]:
            states.append({
                "state": r["_id"],
                "total_bookings": r["total_bookings"],
                "completed": r["completed"],
                "cancelled": r["cancelled"],
                "total_revenue": round(r["total_revenue"], 2)
            })
    
    return {"states": states}

@router.get("/bookings/by-district")
async def get_bookings_by_district(
    state: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    current_user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.REGIONAL_MANAGER])),
    db=Depends(get_database)
):
    """Get bookings grouped by district"""
    match_query = {}
    if state:
        match_query["from_state"] = state
    if from_date:
        match_query["created_at"] = {"$gte": from_date}
    if to_date:
        if "created_at" in match_query:
            match_query["created_at"]["$lte"] = to_date
        else:
            match_query["created_at"] = {"$lte": to_date}
    
    pipeline = [
        {"$match": match_query} if match_query else {"$match": {}},
        {
            "$group": {
                "_id": {"state": "$from_state", "district": "$from_district"},
                "total_bookings": {"$sum": 1},
                "completed": {"$sum": {"$cond": [{"$eq": ["$status", "completed"]}, 1, 0]}},
                "total_revenue": {"$sum": {"$ifNull": ["$final_price", 0]}}
            }
        },
        {"$sort": {"total_bookings": -1}}
    ]
    
    results = await db.bookings.aggregate(pipeline).to_list(100)
    
    districts = []
    for r in results:
        if r["_id"]["district"]:
            districts.append({
                "state": r["_id"]["state"],
                "district": r["_id"]["district"],
                "total_bookings": r["total_bookings"],
                "completed": r["completed"],
                "total_revenue": round(r["total_revenue"], 2)
            })
    
    return {"districts": districts}

@router.get("/operators/performance")
async def get_operator_performance(
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    current_user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.REGIONAL_MANAGER])),
    db=Depends(get_database)
):
    """Get operator performance - bookings accepted, completed, cancelled"""
    # Get all operators
    operators = await db.operators.find({}, {"_id": 0}).to_list(1000)
    
    operator_stats = []
    for op in operators:
        # Get quotes sent by this operator
        quote_query = {"operator_id": op["id"]}
        if from_date:
            quote_query["created_at"] = {"$gte": from_date}
        if to_date:
            if "created_at" in quote_query:
                quote_query["created_at"]["$lte"] = to_date
            else:
                quote_query["created_at"] = {"$lte": to_date}
        
        quotes = await db.quotes.find(quote_query, {"_id": 0}).to_list(1000)
        
        accepted_quotes = [q for q in quotes if q.get("status") == "accepted"]
        
        # Get bookings for accepted quotes
        booking_ids = [q.get("booking_id") for q in accepted_quotes]
        
        completed_count = 0
        cancelled_after_accept = 0
        total_revenue = 0
        
        for bid in booking_ids:
            booking = await db.bookings.find_one({"id": bid}, {"_id": 0})
            if booking:
                if booking.get("status") == "completed":
                    completed_count += 1
                    total_revenue += booking.get("final_price", 0)
                elif booking.get("status") == "cancelled" and booking.get("cancelled_by") == "operator":
                    cancelled_after_accept += 1
        
        operator_stats.append({
            "operator_id": op["id"],
            "company_name": op.get("company_name", "Unknown"),
            "status": op.get("status", "pending"),
            "total_quotes_sent": len(quotes),
            "quotes_accepted": len(accepted_quotes),
            "bookings_completed": completed_count,
            "cancelled_after_accept": cancelled_after_accept,
            "total_revenue": round(total_revenue, 2),
            "acceptance_rate": round((len(accepted_quotes) / len(quotes) * 100) if quotes else 0, 1)
        })
    
    # Sort by bookings completed
    operator_stats.sort(key=lambda x: x["bookings_completed"], reverse=True)
    
    return {"operators": operator_stats}

@router.get("/operators/cancellations")
async def get_operator_cancellations(
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    current_user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN])),
    db=Depends(get_database)
):
    """Get operators who cancelled after accepting bookings"""
    match_query = {"status": "cancelled", "cancelled_by": "operator"}
    if from_date:
        match_query["cancelled_at"] = {"$gte": from_date}
    if to_date:
        if "cancelled_at" in match_query:
            match_query["cancelled_at"]["$lte"] = to_date
        else:
            match_query["cancelled_at"] = {"$lte": to_date}
    
    pipeline = [
        {"$match": match_query},
        {
            "$group": {
                "_id": "$operator_id",
                "cancellation_count": {"$sum": 1},
                "bookings": {"$push": {
                    "booking_id": "$id",
                    "booking_number": "$booking_number",
                    "cancelled_at": "$cancelled_at",
                    "cancellation_reason": "$cancellation_reason"
                }}
            }
        },
        {"$sort": {"cancellation_count": -1}}
    ]
    
    results = await db.bookings.aggregate(pipeline).to_list(100)
    
    cancellations = []
    for r in results:
        if r["_id"]:
            operator = await db.operators.find_one({"id": r["_id"]}, {"_id": 0})
            cancellations.append({
                "operator_id": r["_id"],
                "company_name": operator.get("company_name", "Unknown") if operator else "Unknown",
                "cancellation_count": r["cancellation_count"],
                "bookings": r["bookings"][:10]  # Limit to 10 recent
            })
    
    return {"cancellations": cancellations}

@router.get("/pilots/duty-hours")
async def get_pilot_duty_hours(
    operator_id: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    current_user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.OPERATOR, UserRole.REGIONAL_MANAGER])),
    db=Depends(get_database)
):
    """Get pilot duty hours with safety flags"""
    pilot_query = {}
    if operator_id:
        pilot_query["operator_id"] = operator_id
    
    pilots = await db.pilots.find(pilot_query, {"_id": 0}).to_list(1000)
    
    pilot_stats = []
    for pilot in pilots:
        # Get flight records for this pilot
        flight_query = {"pilot_id": pilot["id"]}
        if from_date:
            flight_query["flight_date"] = {"$gte": from_date}
        if to_date:
            if "flight_date" in flight_query:
                flight_query["flight_date"]["$lte"] = to_date
            else:
                flight_query["flight_date"] = {"$lte": to_date}
        
        flights = await db.flight_records.find(flight_query, {"_id": 0}).to_list(1000)
        
        total_flights = len(flights)
        total_hours = sum(f.get("flight_duration_hours", 0) for f in flights)
        
        # Calculate continuous duty hours (last 24 hours)
        now = datetime.now(timezone.utc)
        last_24h = (now - timedelta(hours=24)).isoformat()
        
        recent_flights = [f for f in flights if f.get("flight_date", "") >= last_24h]
        continuous_hours = sum(f.get("flight_duration_hours", 0) for f in recent_flights)
        
        # Determine duty flag
        if continuous_hours > 12:
            duty_flag = "red"
            duty_status = "EXCEEDED - Rest Required"
        elif continuous_hours >= 8:
            duty_flag = "orange"
            duty_status = "Caution - Approaching Limit"
        else:
            duty_flag = "green"
            duty_status = "Normal"
        
        # Get feedback for pilot
        feedback = await db.pilot_feedback.find({"pilot_id": pilot["id"]}, {"_id": 0}).to_list(100)
        avg_rating = sum(f.get("rating", 0) for f in feedback) / len(feedback) if feedback else 0
        
        pilot_stats.append({
            "pilot_id": pilot["id"],
            "pilot_name": pilot.get("name", "Unknown"),
            "license_number": pilot.get("license_number", ""),
            "operator_id": pilot.get("operator_id", ""),
            "total_flights": total_flights,
            "total_flight_hours": round(total_hours, 1),
            "last_24h_hours": round(continuous_hours, 1),
            "duty_flag": duty_flag,
            "duty_status": duty_status,
            "feedback_count": len(feedback),
            "avg_rating": round(avg_rating, 1)
        })
    
    # Sort by duty flag priority (red first, then orange, then green)
    flag_priority = {"red": 0, "orange": 1, "green": 2}
    pilot_stats.sort(key=lambda x: (flag_priority.get(x["duty_flag"], 3), -x["total_flight_hours"]))
    
    return {
        "pilots": pilot_stats,
        "summary": {
            "total_pilots": len(pilot_stats),
            "red_flag_count": len([p for p in pilot_stats if p["duty_flag"] == "red"]),
            "orange_flag_count": len([p for p in pilot_stats if p["duty_flag"] == "orange"]),
            "green_flag_count": len([p for p in pilot_stats if p["duty_flag"] == "green"])
        }
    }

@router.get("/pilots/feedback")
async def get_pilot_feedback(
    pilot_id: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    current_user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.OPERATOR])),
    db=Depends(get_database)
):
    """Get pilot feedback and ratings"""
    query = {}
    if pilot_id:
        query["pilot_id"] = pilot_id
    if from_date:
        query["created_at"] = {"$gte": from_date}
    if to_date:
        if "created_at" in query:
            query["created_at"]["$lte"] = to_date
        else:
            query["created_at"] = {"$lte": to_date}
    
    feedback_list = await db.pilot_feedback.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    
    # Enrich with pilot names
    for fb in feedback_list:
        pilot = await db.pilots.find_one({"id": fb.get("pilot_id")}, {"_id": 0})
        fb["pilot_name"] = pilot.get("name", "Unknown") if pilot else "Unknown"
    
    return {"feedback": feedback_list}

@router.get("/settlements/by-operator")
async def get_settlements_by_operator(
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    current_user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN])),
    db=Depends(get_database)
):
    """Get settlement and profit report by operator"""
    operators = await db.operators.find({}, {"_id": 0}).to_list(1000)
    
    # Get platform settings for commission
    settings = await db.platform_settings.find_one({"type": "platform"}, {"_id": 0})
    commission_percent = settings.get("platform_commission_percent", 10) if settings else 10
    
    operator_settlements = []
    for op in operators:
        # Get completed bookings for this operator
        booking_query = {"operator_id": op["id"], "status": "completed"}
        if from_date:
            booking_query["completed_at"] = {"$gte": from_date}
        if to_date:
            if "completed_at" in booking_query:
                booking_query["completed_at"]["$lte"] = to_date
            else:
                booking_query["completed_at"] = {"$lte": to_date}
        
        bookings = await db.bookings.find(booking_query, {"_id": 0}).to_list(1000)
        
        total_revenue = sum(b.get("final_price", 0) for b in bookings)
        platform_commission = total_revenue * commission_percent / 100
        operator_earnings = total_revenue - platform_commission
        
        # Get settlements
        settlement_query = {"operator_id": op["id"]}
        if from_date:
            settlement_query["created_at"] = {"$gte": from_date}
        if to_date:
            if "created_at" in settlement_query:
                settlement_query["created_at"]["$lte"] = to_date
            else:
                settlement_query["created_at"] = {"$lte": to_date}
        
        settlements = await db.settlements.find(settlement_query, {"_id": 0}).to_list(1000)
        total_settled = sum(s.get("amount", 0) for s in settlements if s.get("status") == "completed")
        pending_settlement = operator_earnings - total_settled
        
        operator_settlements.append({
            "operator_id": op["id"],
            "company_name": op.get("company_name", "Unknown"),
            "state": op.get("state", ""),
            "total_bookings": len(bookings),
            "total_revenue": round(total_revenue, 2),
            "platform_commission": round(platform_commission, 2),
            "operator_earnings": round(operator_earnings, 2),
            "total_settled": round(total_settled, 2),
            "pending_settlement": round(pending_settlement, 2)
        })
    
    # Sort by total revenue
    operator_settlements.sort(key=lambda x: x["total_revenue"], reverse=True)
    
    # Calculate totals
    total_revenue = sum(o["total_revenue"] for o in operator_settlements)
    total_commission = sum(o["platform_commission"] for o in operator_settlements)
    total_settled = sum(o["total_settled"] for o in operator_settlements)
    total_pending = sum(o["pending_settlement"] for o in operator_settlements)
    
    return {
        "operators": operator_settlements,
        "summary": {
            "total_revenue": round(total_revenue, 2),
            "total_platform_commission": round(total_commission, 2),
            "total_settled": round(total_settled, 2),
            "total_pending": round(total_pending, 2)
        }
    }

@router.get("/settlements/by-state")
async def get_settlements_by_state(
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    current_user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN])),
    db=Depends(get_database)
):
    """Get settlement report grouped by state"""
    match_query = {"status": "completed"}
    if from_date:
        match_query["completed_at"] = {"$gte": from_date}
    if to_date:
        if "completed_at" in match_query:
            match_query["completed_at"]["$lte"] = to_date
        else:
            match_query["completed_at"] = {"$lte": to_date}
    
    pipeline = [
        {"$match": match_query},
        {
            "$group": {
                "_id": "$from_state",
                "total_bookings": {"$sum": 1},
                "total_revenue": {"$sum": {"$ifNull": ["$final_price", 0]}}
            }
        },
        {"$sort": {"total_revenue": -1}}
    ]
    
    results = await db.bookings.aggregate(pipeline).to_list(100)
    
    settings = await db.platform_settings.find_one({"type": "platform"}, {"_id": 0})
    commission_percent = settings.get("platform_commission_percent", 10) if settings else 10
    
    states = []
    for r in results:
        if r["_id"]:
            commission = r["total_revenue"] * commission_percent / 100
            states.append({
                "state": r["_id"],
                "total_bookings": r["total_bookings"],
                "total_revenue": round(r["total_revenue"], 2),
                "platform_commission": round(commission, 2),
                "operator_earnings": round(r["total_revenue"] - commission, 2)
            })
    
    return {"states": states}

@router.get("/settlements/by-period")
async def get_settlements_by_period(
    period: str = "monthly",  # monthly, yearly
    year: Optional[int] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    current_user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN])),
    db=Depends(get_database)
):
    """Get settlement report by month or year"""
    match_query = {"status": "completed"}
    
    if from_date:
        match_query["completed_at"] = {"$gte": from_date}
    if to_date:
        if "completed_at" in match_query:
            match_query["completed_at"]["$lte"] = to_date
        else:
            match_query["completed_at"] = {"$lte": to_date}
    
    # Get all completed bookings
    bookings = await db.bookings.find(match_query, {"_id": 0}).to_list(10000)
    
    settings = await db.platform_settings.find_one({"type": "platform"}, {"_id": 0})
    commission_percent = settings.get("platform_commission_percent", 10) if settings else 10
    
    period_data = {}
    for b in bookings:
        completed_at = b.get("completed_at", b.get("created_at", ""))
        if not completed_at:
            continue
        
        try:
            date = datetime.fromisoformat(completed_at.replace("Z", "+00:00"))
            if period == "monthly":
                key = f"{date.year}-{date.month:02d}"
            else:
                key = str(date.year)
            
            if year and date.year != year:
                continue
            
            if key not in period_data:
                period_data[key] = {"bookings": 0, "revenue": 0}
            
            period_data[key]["bookings"] += 1
            period_data[key]["revenue"] += b.get("final_price", 0)
        except:
            continue
    
    periods = []
    for key in sorted(period_data.keys()):
        data = period_data[key]
        commission = data["revenue"] * commission_percent / 100
        periods.append({
            "period": key,
            "total_bookings": data["bookings"],
            "total_revenue": round(data["revenue"], 2),
            "platform_commission": round(commission, 2),
            "operator_earnings": round(data["revenue"] - commission, 2)
        })
    
    return {"periods": periods, "period_type": period}

@router.get("/summary")
async def get_reports_summary(
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    current_user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.REGIONAL_MANAGER])),
    db=Depends(get_database)
):
    """Get overall reports summary"""
    match_query = {}
    if from_date:
        match_query["created_at"] = {"$gte": from_date}
    if to_date:
        if "created_at" in match_query:
            match_query["created_at"]["$lte"] = to_date
        else:
            match_query["created_at"] = {"$lte": to_date}
    
    # Total bookings
    total_bookings = await db.bookings.count_documents(match_query)
    
    # Completed bookings
    completed_query = {**match_query, "status": "completed"}
    completed_bookings = await db.bookings.count_documents(completed_query)
    
    # Cancelled bookings
    cancelled_query = {**match_query, "status": "cancelled"}
    cancelled_bookings = await db.bookings.count_documents(cancelled_query)
    
    # Total revenue
    revenue_pipeline = [
        {"$match": completed_query},
        {"$group": {"_id": None, "total": {"$sum": {"$ifNull": ["$final_price", 0]}}}}
    ]
    revenue_result = await db.bookings.aggregate(revenue_pipeline).to_list(1)
    total_revenue = revenue_result[0]["total"] if revenue_result else 0
    
    # Active operators
    active_operators = await db.operators.count_documents({"status": "active"})
    
    # Active pilots
    total_pilots = await db.pilots.count_documents({})
    
    # Pilot duty summary
    pilots = await db.pilots.find({}, {"_id": 0, "id": 1}).to_list(1000)
    red_flag = 0
    orange_flag = 0
    
    now = datetime.now(timezone.utc)
    last_24h = (now - timedelta(hours=24)).isoformat()
    
    for pilot in pilots:
        flights = await db.flight_records.find({
            "pilot_id": pilot["id"],
            "flight_date": {"$gte": last_24h}
        }, {"_id": 0}).to_list(100)
        
        hours = sum(f.get("flight_duration_hours", 0) for f in flights)
        if hours > 12:
            red_flag += 1
        elif hours >= 8:
            orange_flag += 1
    
    return {
        "bookings": {
            "total": total_bookings,
            "completed": completed_bookings,
            "cancelled": cancelled_bookings,
            "completion_rate": round((completed_bookings / total_bookings * 100) if total_bookings else 0, 1)
        },
        "revenue": {
            "total": round(total_revenue, 2)
        },
        "operators": {
            "active": active_operators
        },
        "pilots": {
            "total": total_pilots,
            "red_flag": red_flag,
            "orange_flag": orange_flag,
            "green_flag": total_pilots - red_flag - orange_flag
        }
    }

@router.get("/bookings/by-purpose")
async def get_bookings_by_purpose(
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    current_user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.REGIONAL_MANAGER])),
    db=Depends(get_database)
):
    """Get bookings grouped by purpose (wedding, temple yatra, etc.)"""
    match_query = {}
    if from_date:
        match_query["created_at"] = {"$gte": from_date}
    if to_date:
        if "created_at" in match_query:
            match_query["created_at"]["$lte"] = to_date
        else:
            match_query["created_at"] = {"$lte": to_date}
    
    pipeline = [
        {"$match": match_query} if match_query else {"$match": {}},
        {
            "$group": {
                "_id": "$booking_purpose",
                "total_bookings": {"$sum": 1},
                "completed": {"$sum": {"$cond": [{"$eq": ["$status", "completed"]}, 1, 0]}},
                "cancelled": {"$sum": {"$cond": [{"$eq": ["$status", "cancelled"]}, 1, 0]}},
                "total_revenue": {"$sum": {"$ifNull": ["$final_price", 0]}},
                "total_passengers": {"$sum": {"$ifNull": ["$passengers", 1]}}
            }
        },
        {"$sort": {"total_bookings": -1}}
    ]
    
    results = await db.bookings.aggregate(pipeline).to_list(100)
    
    # Purpose labels mapping
    purpose_labels = {
        "wedding": "💒 Wedding",
        "temple_yatra": "🛕 Temple Yatra",
        "company_tour": "🏢 Company Tour",
        "election_tour": "🗳️ Election Tour",
        "general_tour": "✈️ General Tour",
        "medical_emergency": "🏥 Medical Emergency",
        "business_meeting": "💼 Business Meeting",
        "pilgrimage": "🙏 Pilgrimage",
        "film_shooting": "🎬 Film/Media Shooting",
        "survey_inspection": "📋 Survey/Inspection",
        "other": "📝 Other",
        None: "📝 Not Specified"
    }
    
    purposes = []
    total_all = sum(r["total_bookings"] for r in results)
    
    for r in results:
        purpose_key = r["_id"] or "other"
        purposes.append({
            "purpose": purpose_key,
            "purpose_label": purpose_labels.get(purpose_key, purpose_key),
            "total_bookings": r["total_bookings"],
            "completed": r["completed"],
            "cancelled": r["cancelled"],
            "total_revenue": round(r["total_revenue"], 2),
            "total_passengers": r["total_passengers"],
            "percentage": round((r["total_bookings"] / total_all * 100) if total_all else 0, 1)
        })
    
    return {
        "purposes": purposes,
        "total_bookings": total_all
    }

@router.get("/bookings/by-booking-for")
async def get_bookings_by_booking_for(
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    current_user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.REGIONAL_MANAGER])),
    db=Depends(get_database)
):
    """Get bookings grouped by who booked (self, friend_family, company, etc.)"""
    match_query = {}
    if from_date:
        match_query["created_at"] = {"$gte": from_date}
    if to_date:
        if "created_at" in match_query:
            match_query["created_at"]["$lte"] = to_date
        else:
            match_query["created_at"] = {"$lte": to_date}
    
    pipeline = [
        {"$match": match_query} if match_query else {"$match": {}},
        {
            "$group": {
                "_id": "$booking_for",
                "total_bookings": {"$sum": 1},
                "total_revenue": {"$sum": {"$ifNull": ["$final_price", 0]}}
            }
        },
        {"$sort": {"total_bookings": -1}}
    ]
    
    results = await db.bookings.aggregate(pipeline).to_list(100)
    
    booking_for_labels = {
        "self": "👤 Self",
        "friend_family": "👨‍👩‍👧‍👦 Friend & Family",
        "company": "🏢 Company",
        "political": "🎖️ Political/VIP",
        "other": "📋 Other",
        None: "📋 Not Specified"
    }
    
    categories = []
    total_all = sum(r["total_bookings"] for r in results)
    
    for r in results:
        cat_key = r["_id"] or "other"
        categories.append({
            "category": cat_key,
            "category_label": booking_for_labels.get(cat_key, cat_key),
            "total_bookings": r["total_bookings"],
            "total_revenue": round(r["total_revenue"], 2),
            "percentage": round((r["total_bookings"] / total_all * 100) if total_all else 0, 1)
        })
    
    return {
        "categories": categories,
        "total_bookings": total_all
    }
