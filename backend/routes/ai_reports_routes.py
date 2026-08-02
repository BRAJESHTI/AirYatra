"""
AI Report Generator Routes
Natural language report generation
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone, timedelta
from database import get_database

router = APIRouter(prefix="/ai-reports", tags=["ai-reports"])

class ReportRequest(BaseModel):
    report_type: str  # sales, bookings, revenue, operators, customers, flights
    period: str = "last_30_days"  # today, last_7_days, last_30_days, last_quarter, custom
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    format: str = "summary"  # summary, detailed, executive

def get_date_range(period: str, start_date: str = None, end_date: str = None):
    """Get date range based on period"""
    now = datetime.now(timezone.utc)
    
    if period == "today":
        start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        end = now
    elif period == "last_7_days":
        start = now - timedelta(days=7)
        end = now
    elif period == "last_30_days":
        start = now - timedelta(days=30)
        end = now
    elif period == "last_quarter":
        start = now - timedelta(days=90)
        end = now
    elif period == "custom" and start_date and end_date:
        start = datetime.fromisoformat(start_date)
        end = datetime.fromisoformat(end_date)
    else:
        start = now - timedelta(days=30)
        end = now
    
    return start, end

@router.post("/generate")
async def generate_report(request: ReportRequest):
    """Generate AI report based on natural language request"""
    db = get_database()
    
    start_date, end_date = get_date_range(request.period, request.start_date, request.end_date)
    
    report = {
        "report_type": request.report_type,
        "period": request.period,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "date_range": {
            "start": start_date.isoformat(),
            "end": end_date.isoformat()
        }
    }
    
    if request.report_type == "sales":
        report.update(await generate_sales_report(db, start_date, end_date))
    elif request.report_type == "bookings":
        report.update(await generate_bookings_report(db, start_date, end_date))
    elif request.report_type == "revenue":
        report.update(await generate_revenue_report(db, start_date, end_date))
    elif request.report_type == "operators":
        report.update(await generate_operators_report(db, start_date, end_date))
    elif request.report_type == "customers":
        report.update(await generate_customers_report(db, start_date, end_date))
    elif request.report_type == "flights":
        report.update(await generate_flights_report(db, start_date, end_date))
    else:
        report.update(await generate_executive_summary(db, start_date, end_date))
    
    # Store report
    report["_id"] = None
    result = await db.generated_reports.insert_one({**report, "created_at": datetime.now(timezone.utc)})
    report["report_id"] = str(result.inserted_id)
    
    return report

async def generate_sales_report(db, start_date, end_date):
    """Generate sales report"""
    bookings = await db.bookings.find({
        "created_at": {"$gte": start_date, "$lte": end_date}
    }).to_list(length=1000)
    
    total_bookings = len(bookings)
    confirmed = len([b for b in bookings if b.get("status") == "confirmed"])
    cancelled = len([b for b in bookings if b.get("status") == "cancelled"])
    total_value = sum(b.get("final_price", 0) for b in bookings)
    
    # Top routes
    route_counts = {}
    for b in bookings:
        route = f"{b.get('origin', 'N/A')} → {b.get('destination', 'N/A')}"
        route_counts[route] = route_counts.get(route, 0) + 1
    
    top_routes = sorted(route_counts.items(), key=lambda x: x[1], reverse=True)[:5]
    
    conversion_rate = (confirmed / total_bookings * 100) if total_bookings > 0 else 0
    
    return {
        "title": "Sales Performance Report",
        "metrics": {
            "total_bookings": total_bookings,
            "confirmed_bookings": confirmed,
            "cancelled_bookings": cancelled,
            "total_value": total_value,
            "avg_booking_value": total_value / total_bookings if total_bookings > 0 else 0,
            "conversion_rate": round(conversion_rate, 1)
        },
        "top_routes": [{"route": r[0], "bookings": r[1]} for r in top_routes],
        "ai_summary": f"📊 Sales Report: {total_bookings} total bookings with ₹{total_value/100000:.1f}L revenue. Conversion rate: {conversion_rate:.1f}%. Top route: {top_routes[0][0] if top_routes else 'N/A'}.",
        "ai_insights": [
            f"✅ {confirmed} bookings confirmed ({conversion_rate:.1f}% conversion)",
            f"💰 Average booking value: ₹{total_value/total_bookings:,.0f}" if total_bookings > 0 else "No bookings",
            f"🛤️ Most popular route: {top_routes[0][0]}" if top_routes else "No route data"
        ]
    }

async def generate_bookings_report(db, start_date, end_date):
    """Generate bookings analysis report"""
    bookings = await db.bookings.find({
        "created_at": {"$gte": start_date, "$lte": end_date}
    }).to_list(length=1000)
    
    # Status breakdown
    status_counts = {}
    for b in bookings:
        status = b.get("status", "unknown")
        status_counts[status] = status_counts.get(status, 0) + 1
    
    # Booking type breakdown
    type_counts = {}
    for b in bookings:
        btype = b.get("booking_type", "individual")
        type_counts[btype] = type_counts.get(btype, 0) + 1
    
    # Daily trend
    daily_counts = {}
    for b in bookings:
        if b.get("created_at"):
            day = b["created_at"].strftime("%Y-%m-%d") if hasattr(b["created_at"], 'strftime') else str(b["created_at"])[:10]
            daily_counts[day] = daily_counts.get(day, 0) + 1
    
    return {
        "title": "Bookings Analysis Report",
        "metrics": {
            "total_bookings": len(bookings),
            "status_breakdown": status_counts,
            "type_breakdown": type_counts
        },
        "daily_trend": [{"date": k, "count": v} for k, v in sorted(daily_counts.items())],
        "ai_summary": f"📅 Bookings Report: {len(bookings)} bookings analyzed. Corporate: {type_counts.get('corporate', 0)}, Individual: {type_counts.get('individual', 0)}.",
        "ai_insights": [
            f"📈 Peak day: {max(daily_counts, key=daily_counts.get) if daily_counts else 'N/A'}",
            f"🏢 Corporate bookings: {type_counts.get('corporate', 0)} ({type_counts.get('corporate', 0)/len(bookings)*100:.1f}%)" if bookings else "No data"
        ]
    }

async def generate_revenue_report(db, start_date, end_date):
    """Generate revenue report"""
    payments = await db.payments.find({
        "created_at": {"$gte": start_date, "$lte": end_date},
        "status": "completed"
    }).to_list(length=1000)
    
    razorpay_orders = await db.razorpay_orders.find({
        "created_at": {"$gte": start_date, "$lte": end_date},
        "status": {"$in": ["paid", "captured"]}
    }).to_list(length=1000)
    
    total_payments = sum(p.get("amount", 0) for p in payments)
    total_razorpay = sum(o.get("amount", 0) for o in razorpay_orders)
    total_revenue = total_payments + total_razorpay
    
    # Daily revenue
    daily_revenue = {}
    for p in payments:
        if p.get("created_at"):
            day = p["created_at"].strftime("%Y-%m-%d") if hasattr(p["created_at"], 'strftime') else str(p["created_at"])[:10]
            daily_revenue[day] = daily_revenue.get(day, 0) + p.get("amount", 0)
    
    return {
        "title": "Revenue Report",
        "metrics": {
            "total_revenue": total_revenue,
            "payment_count": len(payments) + len(razorpay_orders),
            "avg_payment": total_revenue / (len(payments) + len(razorpay_orders)) if (payments or razorpay_orders) else 0,
            "razorpay_revenue": total_razorpay,
            "other_payments": total_payments
        },
        "daily_revenue": [{"date": k, "amount": v} for k, v in sorted(daily_revenue.items())],
        "ai_summary": f"💰 Revenue Report: Total ₹{total_revenue/100000:.2f}L collected. Razorpay: ₹{total_razorpay/100000:.2f}L.",
        "ai_insights": [
            f"📊 {len(payments) + len(razorpay_orders)} successful payments",
            f"💳 Average payment: ₹{total_revenue/(len(payments)+len(razorpay_orders)):,.0f}" if (payments or razorpay_orders) else "No payments"
        ]
    }

async def generate_operators_report(db, start_date, end_date):
    """Generate operators performance report"""
    operators = await db.users.find({"roles": "operator"}).to_list(length=100)
    
    operator_stats = []
    for op in operators:
        op_id = str(op["_id"])
        bookings = await db.bookings.count_documents({
            "operator_id": op_id,
            "created_at": {"$gte": start_date, "$lte": end_date}
        })
        
        operator_stats.append({
            "name": op.get("company_name") or op.get("name", "Unknown"),
            "email": op.get("email"),
            "bookings": bookings,
            "is_active": op.get("is_active", True)
        })
    
    operator_stats.sort(key=lambda x: x["bookings"], reverse=True)
    
    active_count = len([o for o in operator_stats if o["is_active"]])
    inactive_count = len([o for o in operator_stats if not o["is_active"]])
    
    return {
        "title": "Operators Performance Report",
        "metrics": {
            "total_operators": len(operators),
            "active_operators": active_count,
            "inactive_operators": inactive_count,
            "total_bookings": sum(o["bookings"] for o in operator_stats)
        },
        "top_operators": operator_stats[:10],
        "ai_summary": f"✈️ Operators Report: {len(operators)} operators, {active_count} active. Top performer: {operator_stats[0]['name'] if operator_stats else 'N/A'}.",
        "ai_insights": [
            f"🏆 Top operator: {operator_stats[0]['name']} with {operator_stats[0]['bookings']} bookings" if operator_stats else "No data",
            f"⚠️ {inactive_count} operators inactive" if inactive_count > 0 else "All operators active"
        ]
    }

async def generate_customers_report(db, start_date, end_date):
    """Generate customers report"""
    new_customers = await db.users.count_documents({
        "roles": "customer",
        "created_at": {"$gte": start_date, "$lte": end_date}
    })
    
    total_customers = await db.users.count_documents({"roles": "customer"})
    
    # Repeat customers
    bookings = await db.bookings.find({
        "created_at": {"$gte": start_date, "$lte": end_date}
    }).to_list(length=1000)
    
    customer_bookings = {}
    for b in bookings:
        cust_id = b.get("customer_id") or b.get("user_id")
        if cust_id:
            customer_bookings[str(cust_id)] = customer_bookings.get(str(cust_id), 0) + 1
    
    repeat_customers = len([c for c in customer_bookings.values() if c > 1])
    
    return {
        "title": "Customers Report",
        "metrics": {
            "total_customers": total_customers,
            "new_customers": new_customers,
            "active_customers": len(customer_bookings),
            "repeat_customers": repeat_customers,
            "repeat_rate": round(repeat_customers / len(customer_bookings) * 100, 1) if customer_bookings else 0
        },
        "ai_summary": f"👥 Customers Report: {total_customers} total, {new_customers} new. Repeat rate: {repeat_customers/len(customer_bookings)*100:.1f}%." if customer_bookings else f"👥 {total_customers} total customers.",
        "ai_insights": [
            f"🆕 {new_customers} new customers acquired",
            f"🔄 {repeat_customers} repeat customers ({repeat_customers/len(customer_bookings)*100:.1f}% repeat rate)" if customer_bookings else "No booking data"
        ]
    }

async def generate_flights_report(db, start_date, end_date):
    """Generate flights report"""
    bookings = await db.bookings.find({
        "flight_date": {"$gte": start_date.strftime("%Y-%m-%d"), "$lte": end_date.strftime("%Y-%m-%d")}
    }).to_list(length=1000)
    
    completed = len([b for b in bookings if b.get("status") == "completed"])
    in_progress = len([b for b in bookings if b.get("status") in ["confirmed", "in_progress"]])
    cancelled = len([b for b in bookings if b.get("status") == "cancelled"])
    
    return {
        "title": "Flights Report",
        "metrics": {
            "total_flights": len(bookings),
            "completed": completed,
            "scheduled": in_progress,
            "cancelled": cancelled,
            "completion_rate": round(completed / len(bookings) * 100, 1) if bookings else 0
        },
        "ai_summary": f"🛫 Flights Report: {len(bookings)} flights. {completed} completed, {in_progress} scheduled, {cancelled} cancelled.",
        "ai_insights": [
            f"✅ Completion rate: {completed/len(bookings)*100:.1f}%" if bookings else "No flights",
            f"❌ Cancellation rate: {cancelled/len(bookings)*100:.1f}%" if bookings else "No data"
        ]
    }

async def generate_executive_summary(db, start_date, end_date):
    """Generate executive summary report"""
    # Get all key metrics
    total_bookings = await db.bookings.count_documents({
        "created_at": {"$gte": start_date, "$lte": end_date}
    })
    
    payments = await db.payments.find({
        "created_at": {"$gte": start_date, "$lte": end_date},
        "status": "completed"
    }).to_list(length=1000)
    
    total_revenue = sum(p.get("amount", 0) for p in payments)
    
    new_customers = await db.users.count_documents({
        "roles": "customer",
        "created_at": {"$gte": start_date, "$lte": end_date}
    })
    
    active_operators = await db.users.count_documents({"roles": "operator", "is_active": True})
    
    return {
        "title": "Executive Summary Report",
        "metrics": {
            "total_bookings": total_bookings,
            "total_revenue": total_revenue,
            "new_customers": new_customers,
            "active_operators": active_operators,
            "avg_booking_value": total_revenue / total_bookings if total_bookings > 0 else 0
        },
        "ai_summary": f"📈 Executive Summary: {total_bookings} bookings, ₹{total_revenue/100000:.2f}L revenue, {new_customers} new customers.",
        "ai_insights": [
            f"💰 Total Revenue: ₹{total_revenue/100000:.2f} Lakhs",
            f"📊 Bookings: {total_bookings}",
            f"👥 New Customers: {new_customers}",
            f"✈️ Active Operators: {active_operators}"
        ],
        "recommendations": [
            "🎯 Focus on corporate segment for higher deal values",
            "📱 Increase digital marketing spend for customer acquisition",
            "🤝 Onboard more operators in high-growth states"
        ]
    }

@router.get("/templates")
async def get_report_templates():
    """Get available report templates"""
    return {
        "templates": [
            {"id": "sales", "name": "Sales Performance", "description": "Bookings, conversions, top routes"},
            {"id": "bookings", "name": "Bookings Analysis", "description": "Status breakdown, daily trends"},
            {"id": "revenue", "name": "Revenue Report", "description": "Payments, daily revenue, averages"},
            {"id": "operators", "name": "Operators Performance", "description": "Operator rankings, activity"},
            {"id": "customers", "name": "Customer Insights", "description": "New vs repeat, acquisition"},
            {"id": "flights", "name": "Flights Report", "description": "Completion rates, scheduling"},
            {"id": "executive", "name": "Executive Summary", "description": "High-level KPIs and insights"}
        ],
        "periods": [
            {"id": "today", "name": "Today"},
            {"id": "last_7_days", "name": "Last 7 Days"},
            {"id": "last_30_days", "name": "Last 30 Days"},
            {"id": "last_quarter", "name": "Last Quarter"},
            {"id": "custom", "name": "Custom Range"}
        ]
    }

@router.get("/history")
async def get_report_history(limit: int = 20):
    """Get previously generated reports"""
    db = get_database()
    
    reports = await db.generated_reports.find({}).sort("created_at", -1).limit(limit).to_list(length=limit)
    
    for r in reports:
        r["_id"] = str(r["_id"])
    
    return {"reports": reports}
