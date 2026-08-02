"""
Flight Revenue Dashboard Routes
Booking revenue analytics by route and aircraft for operators
"""
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone, timedelta
from database import get_database
from middleware import get_current_user, require_roles
from typing import Optional

router = APIRouter(prefix="/analytics/revenue", tags=["Revenue Analytics"])


@router.get("/dashboard")
async def get_revenue_dashboard(
    period: Optional[str] = "month",  # day, week, month, year, custom
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get revenue dashboard overview"""
    db = get_database()
    
    user_roles = current_user.get("roles", [])
    if "operator" not in user_roles and "admin" not in user_roles:
        raise HTTPException(status_code=403, detail="Operator/Admin access required")
    
    now = datetime.now(timezone.utc)
    
    # Calculate date range
    if start_date and end_date:
        start = start_date
        end = end_date
    elif period == "day":
        start = now.strftime("%Y-%m-%d")
        end = start
    elif period == "week":
        start = (now - timedelta(days=7)).strftime("%Y-%m-%d")
        end = now.strftime("%Y-%m-%d")
    elif period == "year":
        start = f"{now.year}-01-01"
        end = now.strftime("%Y-%m-%d")
    else:  # month
        start = f"{now.year}-{now.month:02d}-01"
        end = now.strftime("%Y-%m-%d")
    
    # Get bookings in date range
    bookings = await db.inquiries.find(
        {
            "created_at": {"$gte": start, "$lte": end + "T23:59:59"},
            "status": {"$in": ["confirmed", "completed", "paid"]}
        },
        {"_id": 0}
    ).to_list(1000)
    
    # Calculate totals
    total_revenue = sum(b.get("total_amount", b.get("amount", 0)) for b in bookings)
    total_bookings = len(bookings)
    avg_booking_value = total_revenue / total_bookings if total_bookings > 0 else 0
    
    # Revenue by route
    route_revenue = {}
    for b in bookings:
        origin = b.get("from_location", b.get("origin", "Unknown"))
        dest = b.get("to_location", b.get("destination", "Unknown"))
        route = f"{origin} → {dest}"
        
        if route not in route_revenue:
            route_revenue[route] = {"bookings": 0, "revenue": 0, "passengers": 0}
        
        route_revenue[route]["bookings"] += 1
        route_revenue[route]["revenue"] += b.get("total_amount", b.get("amount", 0))
        route_revenue[route]["passengers"] += b.get("passengers", b.get("passenger_count", 1))
    
    # Sort by revenue
    top_routes = sorted(
        [{"route": k, **v} for k, v in route_revenue.items()],
        key=lambda x: x["revenue"],
        reverse=True
    )[:10]
    
    # Revenue by aircraft type
    aircraft_revenue = {}
    for b in bookings:
        aircraft = b.get("aircraft_type", "Unknown")
        
        if aircraft not in aircraft_revenue:
            aircraft_revenue[aircraft] = {"bookings": 0, "revenue": 0}
        
        aircraft_revenue[aircraft]["bookings"] += 1
        aircraft_revenue[aircraft]["revenue"] += b.get("total_amount", b.get("amount", 0))
    
    aircraft_list = sorted(
        [{"aircraft": k, **v} for k, v in aircraft_revenue.items()],
        key=lambda x: x["revenue"],
        reverse=True
    )
    
    # Daily revenue for chart
    daily_revenue = {}
    for b in bookings:
        date = b.get("created_at", "")[:10]
        if date:
            if date not in daily_revenue:
                daily_revenue[date] = 0
            daily_revenue[date] += b.get("total_amount", b.get("amount", 0))
    
    # Sort by date
    daily_chart = [
        {"date": k, "revenue": v}
        for k, v in sorted(daily_revenue.items())
    ]
    
    # Get previous period for comparison
    if period == "month":
        prev_start = (datetime.strptime(start, "%Y-%m-%d") - timedelta(days=30)).strftime("%Y-%m-%d")
        prev_end = (datetime.strptime(start, "%Y-%m-%d") - timedelta(days=1)).strftime("%Y-%m-%d")
    elif period == "week":
        prev_start = (datetime.strptime(start, "%Y-%m-%d") - timedelta(days=7)).strftime("%Y-%m-%d")
        prev_end = (datetime.strptime(start, "%Y-%m-%d") - timedelta(days=1)).strftime("%Y-%m-%d")
    else:
        prev_start = prev_end = None
    
    prev_revenue = 0
    if prev_start and prev_end:
        prev_bookings = await db.inquiries.find(
            {
                "created_at": {"$gte": prev_start, "$lte": prev_end + "T23:59:59"},
                "status": {"$in": ["confirmed", "completed", "paid"]}
            },
            {"_id": 0, "total_amount": 1, "amount": 1}
        ).to_list(1000)
        prev_revenue = sum(b.get("total_amount", b.get("amount", 0)) for b in prev_bookings)
    
    # Calculate growth
    growth_percent = 0
    if prev_revenue > 0:
        growth_percent = ((total_revenue - prev_revenue) / prev_revenue) * 100
    
    return {
        "period": {
            "type": period,
            "start_date": start,
            "end_date": end
        },
        "summary": {
            "total_revenue": round(total_revenue, 2),
            "total_bookings": total_bookings,
            "avg_booking_value": round(avg_booking_value, 2),
            "growth_percent": round(growth_percent, 1),
            "prev_period_revenue": round(prev_revenue, 2)
        },
        "top_routes": top_routes,
        "by_aircraft": aircraft_list,
        "daily_chart": daily_chart,
        "generated_at": now.isoformat()
    }


@router.get("/by-route")
async def get_revenue_by_route(
    route: Optional[str] = None,
    period: Optional[str] = "month",
    current_user: dict = Depends(get_current_user)
):
    """Get detailed revenue breakdown by route"""
    db = get_database()
    
    user_roles = current_user.get("roles", [])
    if "operator" not in user_roles and "admin" not in user_roles:
        raise HTTPException(status_code=403, detail="Operator/Admin access required")
    
    now = datetime.now(timezone.utc)
    
    # Calculate date range
    if period == "week":
        start = (now - timedelta(days=7)).strftime("%Y-%m-%d")
    elif period == "year":
        start = f"{now.year}-01-01"
    else:
        start = f"{now.year}-{now.month:02d}-01"
    
    # Build query
    query = {
        "created_at": {"$gte": start},
        "status": {"$in": ["confirmed", "completed", "paid"]}
    }
    
    if route:
        # Parse route (e.g., "Mumbai → Shirdi")
        parts = route.split("→")
        if len(parts) == 2:
            origin = parts[0].strip()
            dest = parts[1].strip()
            query["$or"] = [
                {"from_location": origin, "to_location": dest},
                {"origin": origin, "destination": dest}
            ]
    
    bookings = await db.inquiries.find(query, {"_id": 0}).to_list(500)
    
    # Aggregate by route
    routes = {}
    for b in bookings:
        origin = b.get("from_location", b.get("origin", "Unknown"))
        dest = b.get("to_location", b.get("destination", "Unknown"))
        route_key = f"{origin} → {dest}"
        
        if route_key not in routes:
            routes[route_key] = {
                "route": route_key,
                "origin": origin,
                "destination": dest,
                "total_revenue": 0,
                "total_bookings": 0,
                "total_passengers": 0,
                "by_aircraft": {},
                "by_date": {}
            }
        
        amount = b.get("total_amount", b.get("amount", 0))
        routes[route_key]["total_revenue"] += amount
        routes[route_key]["total_bookings"] += 1
        routes[route_key]["total_passengers"] += b.get("passengers", b.get("passenger_count", 1))
        
        # By aircraft
        aircraft = b.get("aircraft_type", "Unknown")
        if aircraft not in routes[route_key]["by_aircraft"]:
            routes[route_key]["by_aircraft"][aircraft] = {"bookings": 0, "revenue": 0}
        routes[route_key]["by_aircraft"][aircraft]["bookings"] += 1
        routes[route_key]["by_aircraft"][aircraft]["revenue"] += amount
        
        # By date
        date = b.get("created_at", "")[:10]
        if date:
            if date not in routes[route_key]["by_date"]:
                routes[route_key]["by_date"][date] = 0
            routes[route_key]["by_date"][date] += amount
    
    # Convert to list and sort
    result = sorted(
        list(routes.values()),
        key=lambda x: x["total_revenue"],
        reverse=True
    )
    
    return {
        "routes": result,
        "total_routes": len(result),
        "period": period,
        "generated_at": now.isoformat()
    }


@router.get("/by-aircraft")
async def get_revenue_by_aircraft(
    aircraft_type: Optional[str] = None,
    period: Optional[str] = "month",
    current_user: dict = Depends(get_current_user)
):
    """Get detailed revenue breakdown by aircraft type"""
    db = get_database()
    
    user_roles = current_user.get("roles", [])
    if "operator" not in user_roles and "admin" not in user_roles:
        raise HTTPException(status_code=403, detail="Operator/Admin access required")
    
    now = datetime.now(timezone.utc)
    
    # Calculate date range
    if period == "week":
        start = (now - timedelta(days=7)).strftime("%Y-%m-%d")
    elif period == "year":
        start = f"{now.year}-01-01"
    else:
        start = f"{now.year}-{now.month:02d}-01"
    
    # Build query
    query = {
        "created_at": {"$gte": start},
        "status": {"$in": ["confirmed", "completed", "paid"]}
    }
    
    if aircraft_type:
        query["aircraft_type"] = aircraft_type
    
    bookings = await db.inquiries.find(query, {"_id": 0}).to_list(500)
    
    # Aggregate by aircraft
    aircraft_data = {}
    for b in bookings:
        aircraft = b.get("aircraft_type", "Unknown")
        
        if aircraft not in aircraft_data:
            aircraft_data[aircraft] = {
                "aircraft_type": aircraft,
                "total_revenue": 0,
                "total_bookings": 0,
                "total_flight_hours": 0,
                "top_routes": {},
                "revenue_per_hour": 0
            }
        
        amount = b.get("total_amount", b.get("amount", 0))
        aircraft_data[aircraft]["total_revenue"] += amount
        aircraft_data[aircraft]["total_bookings"] += 1
        aircraft_data[aircraft]["total_flight_hours"] += b.get("flight_duration", 1)
        
        # Track routes
        origin = b.get("from_location", b.get("origin", "Unknown"))
        dest = b.get("to_location", b.get("destination", "Unknown"))
        route = f"{origin} → {dest}"
        
        if route not in aircraft_data[aircraft]["top_routes"]:
            aircraft_data[aircraft]["top_routes"][route] = 0
        aircraft_data[aircraft]["top_routes"][route] += amount
    
    # Calculate per-hour revenue
    for aircraft in aircraft_data.values():
        if aircraft["total_flight_hours"] > 0:
            aircraft["revenue_per_hour"] = round(
                aircraft["total_revenue"] / aircraft["total_flight_hours"], 2
            )
        
        # Convert top routes to sorted list
        aircraft["top_routes"] = sorted(
            [{"route": k, "revenue": v} for k, v in aircraft["top_routes"].items()],
            key=lambda x: x["revenue"],
            reverse=True
        )[:5]
    
    result = sorted(
        list(aircraft_data.values()),
        key=lambda x: x["total_revenue"],
        reverse=True
    )
    
    return {
        "aircraft": result,
        "total_types": len(result),
        "period": period,
        "generated_at": now.isoformat()
    }


@router.get("/summary")
async def get_revenue_summary(
    current_user: dict = Depends(get_current_user)
):
    """Get quick revenue summary for dashboard cards"""
    db = get_database()
    
    user_roles = current_user.get("roles", [])
    if "operator" not in user_roles and "admin" not in user_roles:
        raise HTTPException(status_code=403, detail="Operator/Admin access required")
    
    now = datetime.now(timezone.utc)
    today = now.strftime("%Y-%m-%d")
    month_start = f"{now.year}-{now.month:02d}-01"
    year_start = f"{now.year}-01-01"
    
    # Today's revenue
    today_bookings = await db.inquiries.find(
        {"created_at": {"$gte": today}, "status": {"$in": ["confirmed", "completed", "paid"]}},
        {"_id": 0, "total_amount": 1, "amount": 1}
    ).to_list(100)
    today_revenue = sum(b.get("total_amount", b.get("amount", 0)) for b in today_bookings)
    
    # This month's revenue
    month_bookings = await db.inquiries.find(
        {"created_at": {"$gte": month_start}, "status": {"$in": ["confirmed", "completed", "paid"]}},
        {"_id": 0, "total_amount": 1, "amount": 1}
    ).to_list(500)
    month_revenue = sum(b.get("total_amount", b.get("amount", 0)) for b in month_bookings)
    
    # This year's revenue
    year_bookings = await db.inquiries.find(
        {"created_at": {"$gte": year_start}, "status": {"$in": ["confirmed", "completed", "paid"]}},
        {"_id": 0, "total_amount": 1, "amount": 1}
    ).to_list(2000)
    year_revenue = sum(b.get("total_amount", b.get("amount", 0)) for b in year_bookings)
    
    # Pending payments
    pending = await db.inquiries.find(
        {"status": "pending_payment"},
        {"_id": 0, "total_amount": 1, "amount": 1}
    ).to_list(100)
    pending_amount = sum(b.get("total_amount", b.get("amount", 0)) for b in pending)
    
    return {
        "today": {
            "revenue": round(today_revenue, 2),
            "bookings": len(today_bookings)
        },
        "this_month": {
            "revenue": round(month_revenue, 2),
            "bookings": len(month_bookings)
        },
        "this_year": {
            "revenue": round(year_revenue, 2),
            "bookings": len(year_bookings)
        },
        "pending_payments": {
            "amount": round(pending_amount, 2),
            "count": len(pending)
        },
        "generated_at": now.isoformat()
    }
