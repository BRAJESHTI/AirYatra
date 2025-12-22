from fastapi import APIRouter, Depends, HTTPException
from typing import Optional
from datetime import datetime, timezone, timedelta
from database import get_database
from middleware import get_current_user, require_roles

router = APIRouter(prefix="/analytics", tags=["Analytics"])

@router.get("/dashboard")
async def get_analytics_dashboard(
    period: str = "30d",  # 7d, 30d, 90d, 1y
    current_user: dict = Depends(require_roles(["admin", "super_admin"])),
    db=Depends(get_database)
):
    """Get comprehensive analytics dashboard"""
    
    # Calculate date range
    days_map = {"7d": 7, "30d": 30, "90d": 90, "1y": 365}
    days = days_map.get(period, 30)
    start_date = datetime.now(timezone.utc) - timedelta(days=days)
    start_iso = start_date.isoformat()
    
    # Booking statistics
    all_bookings = await db.bookings.find({}, {"_id": 0}).to_list(10000)
    period_bookings = [b for b in all_bookings if b.get("created_at", "") >= start_iso]
    
    completed_bookings = [b for b in period_bookings if b.get("status") == "completed"]
    cancelled_bookings = [b for b in period_bookings if b.get("status") == "cancelled"]
    
    total_revenue = sum(b.get("total_amount", 0) for b in completed_bookings)
    total_commission = sum(b.get("commission_amount", 0) for b in completed_bookings)
    
    # Daily booking trend
    daily_bookings = {}
    for b in period_bookings:
        date = b.get("created_at", "")[:10]
        if date:
            daily_bookings[date] = daily_bookings.get(date, 0) + 1
    
    booking_trend = [{"date": k, "count": v} for k, v in sorted(daily_bookings.items())]
    
    # Revenue trend
    daily_revenue = {}
    for b in completed_bookings:
        date = b.get("created_at", "")[:10]
        if date:
            daily_revenue[date] = daily_revenue.get(date, 0) + b.get("total_amount", 0)
    
    revenue_trend = [{"date": k, "amount": v} for k, v in sorted(daily_revenue.items())]
    
    # Top routes
    route_counts = {}
    for b in period_bookings:
        route = f"{b.get('from_location', '')} → {b.get('to_location', '')}"
        route_counts[route] = route_counts.get(route, 0) + 1
    
    top_routes = sorted(
        [{"route": k, "count": v} for k, v in route_counts.items()],
        key=lambda x: x["count"],
        reverse=True
    )[:10]
    
    # Operator statistics
    operators = await db.operators.find({}, {"_id": 0}).to_list(1000)
    active_operators = [op for op in operators if op.get("status") == "active"]
    
    # Top operators by bookings
    operator_bookings = {}
    for b in completed_bookings:
        op_id = b.get("operator_id")
        if op_id:
            operator_bookings[op_id] = operator_bookings.get(op_id, 0) + 1
    
    top_operators = []
    for op_id, count in sorted(operator_bookings.items(), key=lambda x: x[1], reverse=True)[:10]:
        op = next((o for o in operators if o["id"] == op_id), None)
        if op:
            top_operators.append({
                "operator_id": op_id,
                "company_name": op.get("company_name"),
                "booking_count": count,
                "rating": op.get("average_rating", 0)
            })
    
    # Customer statistics
    users = await db.users.find({}, {"_id": 0}).to_list(10000)
    customers = [u for u in users if "customer" in u.get("roles", [])]
    new_customers = [u for u in customers if u.get("created_at", "") >= start_iso]
    
    # Aircraft statistics
    aircraft = await db.aircraft.find({}, {"_id": 0}).to_list(1000)
    
    # Feedback statistics
    feedback = await db.feedback.find({}, {"_id": 0}).to_list(10000)
    period_feedback = [f for f in feedback if f.get("created_at", "") >= start_iso]
    avg_rating = sum(f.get("overall_rating", 0) for f in period_feedback) / len(period_feedback) if period_feedback else 0
    
    return {
        "period": period,
        "summary": {
            "total_bookings": len(period_bookings),
            "completed_bookings": len(completed_bookings),
            "cancelled_bookings": len(cancelled_bookings),
            "conversion_rate": round(len(completed_bookings) / len(period_bookings) * 100, 1) if period_bookings else 0,
            "total_revenue": total_revenue,
            "total_commission": total_commission,
            "average_booking_value": round(total_revenue / len(completed_bookings), 0) if completed_bookings else 0,
        },
        "operators": {
            "total": len(operators),
            "active": len(active_operators),
            "top_operators": top_operators
        },
        "customers": {
            "total": len(customers),
            "new_in_period": len(new_customers)
        },
        "aircraft": {
            "total": len(aircraft)
        },
        "feedback": {
            "total_reviews": len(period_feedback),
            "average_rating": round(avg_rating, 1)
        },
        "trends": {
            "bookings": booking_trend[-30:],  # Last 30 data points
            "revenue": revenue_trend[-30:]
        },
        "top_routes": top_routes
    }

@router.get("/revenue")
async def get_revenue_analytics(
    period: str = "30d",
    current_user: dict = Depends(require_roles(["admin", "super_admin"])),
    db=Depends(get_database)
):
    """Get detailed revenue analytics"""
    days_map = {"7d": 7, "30d": 30, "90d": 90, "1y": 365}
    days = days_map.get(period, 30)
    start_date = datetime.now(timezone.utc) - timedelta(days=days)
    
    bookings = await db.bookings.find(
        {"status": "completed"},
        {"_id": 0}
    ).to_list(10000)
    
    period_bookings = [b for b in bookings if b.get("created_at", "") >= start_date.isoformat()]
    
    # Revenue by payment method
    by_method = {}
    for b in period_bookings:
        method = b.get("payment_method", "unknown")
        by_method[method] = by_method.get(method, 0) + b.get("total_amount", 0)
    
    # Revenue by region
    by_region = {}
    for b in period_bookings:
        region = b.get("region", "unknown")
        by_region[region] = by_region.get(region, 0) + b.get("total_amount", 0)
    
    return {
        "total_revenue": sum(b.get("total_amount", 0) for b in period_bookings),
        "by_payment_method": [{"method": k, "amount": v} for k, v in by_method.items()],
        "by_region": [{"region": k, "amount": v} for k, v in by_region.items()]
    }

@router.get("/operator/{operator_id}")
async def get_operator_analytics(
    operator_id: str,
    period: str = "30d",
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """Get analytics for specific operator"""
    days_map = {"7d": 7, "30d": 30, "90d": 90, "1y": 365}
    days = days_map.get(period, 30)
    start_date = datetime.now(timezone.utc) - timedelta(days=days)
    
    # Verify access
    if "operator" in current_user.get("roles", []):
        operator = await db.operators.find_one({"user_id": current_user["id"]}, {"_id": 0})
        if not operator or operator["id"] != operator_id:
            raise HTTPException(status_code=403, detail="Access denied")
    elif "admin" not in current_user.get("roles", []):
        raise HTTPException(status_code=403, detail="Access denied")
    
    bookings = await db.bookings.find(
        {"operator_id": operator_id},
        {"_id": 0}
    ).to_list(10000)
    
    period_bookings = [b for b in bookings if b.get("created_at", "") >= start_date.isoformat()]
    completed = [b for b in period_bookings if b.get("status") == "completed"]
    
    return {
        "total_bookings": len(period_bookings),
        "completed_bookings": len(completed),
        "total_revenue": sum(b.get("total_amount", 0) for b in completed),
        "earnings": sum(b.get("total_amount", 0) - b.get("commission_amount", 0) for b in completed)
    }
