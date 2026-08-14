from fastapi import APIRouter, Depends, HTTPException
from typing import Optional
from datetime import datetime, timezone, timedelta
from database import get_database
from middleware import get_current_user, require_roles
from models import UserRole

router = APIRouter(prefix="/analytics", tags=["Analytics"])

@router.get("/dashboard")
async def get_analytics_dashboard(
    period: str = "30d",  # 7d, 30d, 90d, 1y
    current_user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN])),
    db=Depends(get_database)
):
    """Get comprehensive analytics dashboard - optimized with aggregation"""
    
    # Calculate date range
    days_map = {"7d": 7, "30d": 30, "90d": 90, "1y": 365}
    days = days_map.get(period, 30)
    start_date = datetime.now(timezone.utc) - timedelta(days=days)
    start_iso = start_date.isoformat()
    
    # Use aggregation for booking statistics
    booking_stats = await db.bookings.aggregate([
        {"$match": {"created_at": {"$gte": start_iso}}},
        {"$group": {
            "_id": "$status",
            "count": {"$sum": 1},
            "total_amount": {"$sum": {"$ifNull": ["$total_amount", 0]}},
            "total_commission": {"$sum": {"$ifNull": ["$commission_amount", 0]}}
        }}
    ]).to_list(100)
    
    completed_count = 0
    cancelled_count = 0
    total_bookings = 0
    total_revenue = 0
    total_commission = 0
    
    for stat in booking_stats:
        total_bookings += stat["count"]
        if stat["_id"] == "completed":
            completed_count = stat["count"]
            total_revenue = stat["total_amount"]
            total_commission = stat["total_commission"]
        elif stat["_id"] == "cancelled":
            cancelled_count = stat["count"]
    
    # Daily booking trend (last 30 days max)
    booking_trend = await db.bookings.aggregate([
        {"$match": {"created_at": {"$gte": start_iso}}},
        {"$project": {"date": {"$substr": ["$created_at", 0, 10]}}},
        {"$group": {"_id": "$date", "count": {"$sum": 1}}},
        {"$sort": {"_id": 1}},
        {"$limit": 30}
    ]).to_list(30)
    
    booking_trend = [{"date": b["_id"], "count": b["count"]} for b in booking_trend]
    
    # Revenue trend
    revenue_trend = await db.bookings.aggregate([
        {"$match": {"created_at": {"$gte": start_iso}, "status": "completed"}},
        {"$project": {"date": {"$substr": ["$created_at", 0, 10]}, "total_amount": 1}},
        {"$group": {"_id": "$date", "amount": {"$sum": {"$ifNull": ["$total_amount", 0]}}}},
        {"$sort": {"_id": 1}},
        {"$limit": 30}
    ]).to_list(30)
    
    revenue_trend = [{"date": r["_id"], "amount": r["amount"]} for r in revenue_trend]
    
    # Top routes
    top_routes = await db.bookings.aggregate([
        {"$match": {"created_at": {"$gte": start_iso}}},
        {"$group": {
            "_id": {"from": "$from_location", "to": "$to_location"},
            "count": {"$sum": 1}
        }},
        {"$sort": {"count": -1}},
        {"$limit": 10},
        {"$project": {
            "_id": 0,
            "route": {"$concat": [{"$ifNull": ["$_id.from", ""]}, " → ", {"$ifNull": ["$_id.to", ""]}]},
            "count": 1
        }}
    ]).to_list(10)
    
    # Operator statistics - use count instead of fetching all
    total_operators = await db.operators.count_documents({})
    active_operators = await db.operators.count_documents({"status": "active"})
    
    # Top operators by bookings
    top_operators_agg = await db.bookings.aggregate([
        {"$match": {"created_at": {"$gte": start_iso}, "status": "completed", "operator_id": {"$ne": None}}},
        {"$group": {"_id": "$operator_id", "booking_count": {"$sum": 1}}},
        {"$sort": {"booking_count": -1}},
        {"$limit": 10}
    ]).to_list(10)
    
    # Lookup operator details
    top_operators = []
    for op_stat in top_operators_agg:
        op = await db.operators.find_one({"id": op_stat["_id"]}, {"_id": 0, "id": 1, "company_name": 1, "average_rating": 1})
        if op:
            top_operators.append({
                "operator_id": op_stat["_id"],
                "company_name": op.get("company_name"),
                "booking_count": op_stat["booking_count"],
                "rating": op.get("average_rating", 0)
            })
    
    # Customer statistics - use count
    total_customers = await db.users.count_documents({"roles": "customer"})
    new_customers = await db.users.count_documents({"roles": "customer", "created_at": {"$gte": start_iso}})
    
    # Aircraft count
    total_aircraft = await db.aircraft.count_documents({})
    
    # Feedback statistics
    feedback_stats = await db.feedback.aggregate([
        {"$match": {"created_at": {"$gte": start_iso}}},
        {"$group": {
            "_id": None,
            "count": {"$sum": 1},
            "avg_rating": {"$avg": {"$ifNull": ["$overall_rating", 0]}}
        }}
    ]).to_list(1)
    
    feedback_count = feedback_stats[0]["count"] if feedback_stats else 0
    avg_rating = feedback_stats[0]["avg_rating"] if feedback_stats else 0
    
    return {
        "period": period,
        "summary": {
            "total_bookings": total_bookings,
            "completed_bookings": completed_count,
            "cancelled_bookings": cancelled_count,
            "conversion_rate": round(completed_count / total_bookings * 100, 1) if total_bookings else 0,
            "total_revenue": total_revenue,
            "total_commission": total_commission,
            "average_booking_value": round(total_revenue / completed_count, 0) if completed_count else 0,
        },
        "operators": {
            "total": total_operators,
            "active": active_operators,
            "top_operators": top_operators
        },
        "customers": {
            "total": total_customers,
            "new_in_period": new_customers
        },
        "aircraft": {
            "total": total_aircraft
        },
        "feedback": {
            "total_reviews": feedback_count,
            "average_rating": round(avg_rating, 1) if avg_rating else 0
        },
        "trends": {
            "bookings": booking_trend,
            "revenue": revenue_trend
        },
        "top_routes": top_routes
    }

@router.get("/revenue")
async def get_revenue_analytics(
    period: str = "30d",
    current_user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN])),
    db=Depends(get_database)
):
    """Get detailed revenue analytics - optimized"""
    days_map = {"7d": 7, "30d": 30, "90d": 90, "1y": 365}
    days = days_map.get(period, 30)
    start_date = datetime.now(timezone.utc) - timedelta(days=days)
    start_iso = start_date.isoformat()
    
    # Revenue by payment method
    by_method = await db.bookings.aggregate([
        {"$match": {"status": "completed", "created_at": {"$gte": start_iso}}},
        {"$group": {
            "_id": {"$ifNull": ["$payment_method", "unknown"]},
            "amount": {"$sum": {"$ifNull": ["$total_amount", 0]}}
        }}
    ]).to_list(20)
    
    # Revenue by region
    by_region = await db.bookings.aggregate([
        {"$match": {"status": "completed", "created_at": {"$gte": start_iso}}},
        {"$group": {
            "_id": {"$ifNull": ["$region", "unknown"]},
            "amount": {"$sum": {"$ifNull": ["$total_amount", 0]}}
        }}
    ]).to_list(20)
    
    # Total revenue
    total_revenue = sum(r["amount"] for r in by_method)
    
    return {
        "total_revenue": total_revenue,
        "by_payment_method": [{"method": r["_id"], "amount": r["amount"]} for r in by_method],
        "by_region": [{"region": r["_id"], "amount": r["amount"]} for r in by_region]
    }

@router.get("/operator/{operator_id}")
async def get_operator_analytics(
    operator_id: str,
    period: str = "30d",
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """Get analytics for specific operator - optimized"""
    days_map = {"7d": 7, "30d": 30, "90d": 90, "1y": 365}
    days = days_map.get(period, 30)
    start_date = datetime.now(timezone.utc) - timedelta(days=days)
    start_iso = start_date.isoformat()
    
    # Verify access
    if "operator" in current_user.get("roles", []):
        operator = await db.operators.find_one({"user_id": current_user["id"]}, {"_id": 0, "id": 1})
        if not operator or operator["id"] != operator_id:
            raise HTTPException(status_code=403, detail="Access denied")
    elif "admin" not in current_user.get("roles", []) and "super_admin" not in current_user.get("roles", []):
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Use aggregation for operator stats
    stats = await db.bookings.aggregate([
        {"$match": {"operator_id": operator_id, "created_at": {"$gte": start_iso}}},
        {"$group": {
            "_id": "$status",
            "count": {"$sum": 1},
            "total_amount": {"$sum": {"$ifNull": ["$total_amount", 0]}}
        }}
    ]).to_list(10)
    
    total_bookings = 0
    completed_count = 0
    total_revenue = 0
    
    for stat in stats:
        total_bookings += stat["count"]
        if stat["_id"] == "completed":
            completed_count = stat["count"]
            total_revenue = stat["total_amount"]
    
    return {
        "total_bookings": total_bookings,
        "completed_bookings": completed_count,
        "total_revenue": total_revenue,
        "average_booking_value": round(total_revenue / completed_count, 0) if completed_count else 0,
        "completion_rate": round(completed_count / total_bookings * 100, 1) if total_bookings else 0
    }

@router.get("/booking-purpose")
async def get_booking_purpose_analytics(
    period: str = "30d",
    current_user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN])),
    db=Depends(get_database)
):
    """Get booking purpose analytics - optimized"""
    days_map = {"7d": 7, "30d": 30, "90d": 90, "1y": 365}
    days = days_map.get(period, 30)
    start_date = datetime.now(timezone.utc) - timedelta(days=days)
    start_iso = start_date.isoformat()
    
    # Aggregate by booking purpose
    purpose_stats = await db.bookings.aggregate([
        {"$match": {"created_at": {"$gte": start_iso}}},
        {"$group": {
            "_id": {"$ifNull": ["$booking_purpose", "general_tour"]},
            "count": {"$sum": 1},
            "total_revenue": {"$sum": {"$cond": [
                {"$eq": ["$status", "completed"]},
                {"$ifNull": ["$total_amount", 0]},
                0
            ]}}
        }},
        {"$sort": {"count": -1}},
        {"$limit": 15}
    ]).to_list(15)
    
    purpose_labels = {
        "wedding": "Wedding",
        "temple_yatra": "Temple Yatra",
        "company_tour": "Company Tour",
        "election_tour": "Election Tour",
        "general_tour": "General Tour",
        "medical_emergency": "Medical Emergency",
        "business_meeting": "Business Meeting",
        "pilgrimage": "Pilgrimage",
        "film_shooting": "Film/Media Shooting",
        "survey_inspection": "Survey/Inspection",
        "other": "Other"
    }
    
    result = []
    for stat in purpose_stats:
        purpose = stat["_id"]
        result.append({
            "purpose": purpose,
            "label": purpose_labels.get(purpose, purpose),
            "count": stat["count"],
            "revenue": stat["total_revenue"]
        })
    
    return {
        "period": period,
        "by_purpose": result
    }
