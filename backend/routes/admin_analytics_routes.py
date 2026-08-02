"""
Admin Analytics Dashboard & Export Center
Unified analytics: Revenue trends, Booking patterns, Customer segments, Route performance
PDF/CSV reports generation
"""
import csv
import io
from collections import defaultdict
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse

from database import get_database
from middleware import require_roles

router = APIRouter(prefix="/analytics/admin", tags=["Admin Analytics"])


@router.get("/dashboard")
async def get_admin_analytics_dashboard(
    period: str = "month",  # week, month, quarter, year
    current_user: dict = Depends(require_roles(["admin", "ceo"]))
):
    """
    Comprehensive admin analytics dashboard
    """
    db = get_database()
    
    now = datetime.now(timezone.utc)
    
    # Period calculation
    if period == "week":
        start_date = now - timedelta(days=7)
    elif period == "month":
        start_date = now - timedelta(days=30)
    elif period == "quarter":
        start_date = now - timedelta(days=90)
    else:
        start_date = now - timedelta(days=365)
    
    start_str = start_date.isoformat()
    
    # ========== REVENUE ANALYTICS ==========
    paid_inquiries = await db.customer_inquiries.find({
        "payment_status": "paid"
    }).to_list(5000)
    
    # Period filter
    period_inquiries = [
        inq for inq in paid_inquiries 
        if inq.get("created_at", "") >= start_str
    ]
    
    total_revenue = sum(inq.get("quoted_amount", 0) for inq in period_inquiries)
    avg_booking_value = total_revenue / len(period_inquiries) if period_inquiries else 0
    
    # Revenue trend (daily)
    revenue_by_day = defaultdict(float)
    for inq in period_inquiries:
        try:
            date_str = inq.get("created_at", "")[:10]
            revenue_by_day[date_str] += inq.get("quoted_amount", 0)
        except:
            pass
    
    revenue_trend = [
        {"date": d, "revenue": r}
        for d, r in sorted(revenue_by_day.items())[-30:]
    ]
    
    # ========== BOOKING ANALYTICS ==========
    all_bookings = await db.bookings.find({}).to_list(5000)
    all_inquiries = await db.customer_inquiries.find({}).to_list(5000)
    
    period_bookings = [
        b for b in all_bookings + all_inquiries
        if b.get("created_at", "") >= start_str
    ]
    
    # Booking status distribution
    status_dist = defaultdict(int)
    for b in period_bookings:
        status = b.get("status", "unknown")
        status_dist[status] += 1
    
    # Conversion funnel
    total_inquiries = len([i for i in all_inquiries if i.get("created_at", "") >= start_str])
    quoted = len([i for i in all_inquiries if i.get("status") in ["quoted", "accepted", "paid", "completed"] and i.get("created_at", "") >= start_str])
    paid = len([i for i in all_inquiries if i.get("payment_status") == "paid" and i.get("created_at", "") >= start_str])
    completed = len([i for i in all_inquiries if i.get("status") == "completed" and i.get("created_at", "") >= start_str])
    
    conversion_funnel = [
        {"stage": "Inquiries", "count": total_inquiries},
        {"stage": "Quoted", "count": quoted},
        {"stage": "Paid", "count": paid},
        {"stage": "Completed", "count": completed}
    ]
    
    # ========== CUSTOMER ANALYTICS ==========
    all_customers = await db.users.find({"roles": "customer"}, {"_id": 0}).to_list(10000)
    
    new_customers = len([
        c for c in all_customers
        if c.get("created_at", "") >= start_str
    ])
    
    # Customer segments by booking count
    customer_bookings = defaultdict(int)
    for inq in paid_inquiries:
        customer_bookings[inq.get("user_id", "")] += 1
    
    segments = {
        "new": 0,
        "occasional": 0,
        "regular": 0,
        "vip": 0
    }
    
    for count in customer_bookings.values():
        if count == 1:
            segments["new"] += 1
        elif count <= 3:
            segments["occasional"] += 1
        elif count <= 10:
            segments["regular"] += 1
        else:
            segments["vip"] += 1
    
    # Top customers
    top_customers = sorted(customer_bookings.items(), key=lambda x: x[1], reverse=True)[:10]
    top_customer_details = []
    for cust_id, count in top_customers:
        cust = await db.users.find_one({"id": cust_id}, {"_id": 0, "full_name": 1, "email": 1})
        if cust:
            cust_revenue = sum(inq.get("quoted_amount", 0) for inq in paid_inquiries if inq.get("user_id") == cust_id)
            top_customer_details.append({
                "customer_id": cust_id,
                "name": cust.get("full_name", "Unknown"),
                "email": cust.get("email", ""),
                "bookings": count,
                "revenue": cust_revenue
            })
    
    # ========== OPERATIONAL METRICS ==========
    fleet_count = await db.fleet.count_documents({"status": "active"})
    pilot_count = await db.pilots.count_documents({})
    operator_count = await db.users.count_documents({"roles": "operator"})
    
    # ========== TIME-BASED PATTERNS ==========
    hour_distribution = defaultdict(int)
    day_distribution = defaultdict(int)
    
    for inq in period_inquiries:
        try:
            date_str = inq.get("created_at", "")
            if date_str:
                dt = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
                hour_distribution[dt.hour] += 1
                day_distribution[dt.strftime("%A")] += 1
        except:
            pass
    
    # ========== ROUTE PERFORMANCE ==========
    route_performance = defaultdict(lambda: {"bookings": 0, "revenue": 0})
    for inq in period_inquiries:
        route = f"{inq.get('from_location', 'Unknown')} → {inq.get('to_location', 'Unknown')}"
        route_performance[route]["bookings"] += 1
        route_performance[route]["revenue"] += inq.get("quoted_amount", 0)
    
    top_routes = sorted(
        [{"route": r, **d} for r, d in route_performance.items()],
        key=lambda x: x["revenue"],
        reverse=True
    )[:10]
    
    return {
        "period": period,
        "date_range": {
            "start": start_date.strftime("%Y-%m-%d"),
            "end": now.strftime("%Y-%m-%d")
        },
        "revenue": {
            "total": total_revenue,
            "avg_booking_value": round(avg_booking_value),
            "trend": revenue_trend
        },
        "bookings": {
            "total": len(period_bookings),
            "status_distribution": dict(status_dist),
            "conversion_funnel": conversion_funnel
        },
        "customers": {
            "total": len(all_customers),
            "new_in_period": new_customers,
            "segments": segments,
            "top_customers": top_customer_details
        },
        "operations": {
            "active_fleet": fleet_count,
            "total_pilots": pilot_count,
            "operators": operator_count
        },
        "patterns": {
            "hourly_distribution": [{"hour": h, "count": c} for h, c in sorted(hour_distribution.items())],
            "daily_distribution": [{"day": d, "count": c} for d, c in day_distribution.items()]
        },
        "top_routes": top_routes,
        "generated_at": now.isoformat()
    }


# ============== EXPORT CENTER ==============

@router.get("/export/bookings")
async def export_bookings_csv(
    start_date: str | None = None,
    end_date: str | None = None,
    current_user: dict = Depends(require_roles(["admin", "ceo"]))
):
    """Export bookings to CSV"""
    db = get_database()
    
    query = {}
    if start_date:
        query["created_at"] = {"$gte": start_date}
    if end_date:
        if "created_at" in query:
            query["created_at"]["$lte"] = end_date
        else:
            query["created_at"] = {"$lte": end_date}
    
    inquiries = await db.customer_inquiries.find(query, {"_id": 0}).to_list(10000)
    
    # Create CSV
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Header
    writer.writerow([
        "ID", "Customer Name", "Email", "Phone", "From", "To", "Date", 
        "Service Type", "Passengers", "Quoted Amount", "Payment Status", 
        "Status", "Created At"
    ])
    
    for inq in inquiries:
        writer.writerow([
            inq.get("id", ""),
            inq.get("customer_name", ""),
            inq.get("customer_email", ""),
            inq.get("customer_phone", ""),
            inq.get("from_location", ""),
            inq.get("to_location", ""),
            inq.get("travel_date", ""),
            inq.get("service_type", ""),
            inq.get("passengers", ""),
            inq.get("quoted_amount", 0),
            inq.get("payment_status", ""),
            inq.get("status", ""),
            inq.get("created_at", "")
        ])
    
    output.seek(0)
    
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode('utf-8')),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=bookings_export_{datetime.now().strftime('%Y%m%d')}.csv"}
    )


@router.get("/export/customers")
async def export_customers_csv(
    current_user: dict = Depends(require_roles(["admin", "ceo"]))
):
    """Export customers to CSV"""
    db = get_database()
    
    customers = await db.users.find({"roles": "customer"}, {"_id": 0, "password_hash": 0}).to_list(50000)
    
    output = io.StringIO()
    writer = csv.writer(output)
    
    writer.writerow([
        "ID", "Full Name", "Email", "Phone", "Region", "Status", "Created At"
    ])
    
    for c in customers:
        writer.writerow([
            c.get("id", ""),
            c.get("full_name", ""),
            c.get("email", ""),
            c.get("phone", ""),
            c.get("region", ""),
            "Active" if c.get("is_active", True) else "Inactive",
            c.get("created_at", "")
        ])
    
    output.seek(0)
    
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode('utf-8')),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=customers_export_{datetime.now().strftime('%Y%m%d')}.csv"}
    )


@router.get("/export/fleet")
async def export_fleet_csv(
    current_user: dict = Depends(require_roles(["admin", "ceo", "operator"]))
):
    """Export fleet to CSV"""
    db = get_database()
    
    fleet = await db.fleet.find({}, {"_id": 0}).to_list(1000)
    
    output = io.StringIO()
    writer = csv.writer(output)
    
    writer.writerow([
        "ID", "Registration", "Type", "Model", "Capacity", "Status", 
        "Total Flight Hours", "Last Maintenance", "Operator"
    ])
    
    for a in fleet:
        writer.writerow([
            a.get("id", ""),
            a.get("registration", ""),
            a.get("type", "") or a.get("aircraft_type", ""),
            a.get("model", ""),
            a.get("capacity", ""),
            a.get("status", ""),
            a.get("total_flight_hours", 0),
            a.get("last_maintenance_date", ""),
            a.get("operator_id", "")
        ])
    
    output.seek(0)
    
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode('utf-8')),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=fleet_export_{datetime.now().strftime('%Y%m%d')}.csv"}
    )


@router.get("/export/finance")
async def export_finance_csv(
    start_date: str | None = None,
    end_date: str | None = None,
    current_user: dict = Depends(require_roles(["admin", "ceo"]))
):
    """Export financial data to CSV"""
    db = get_database()
    
    query = {"payment_status": "paid"}
    if start_date:
        query["created_at"] = {"$gte": start_date}
    if end_date:
        if "created_at" in query:
            query["created_at"]["$lte"] = end_date
        else:
            query["created_at"] = {"$lte": end_date}
    
    transactions = await db.customer_inquiries.find(query, {"_id": 0}).to_list(50000)
    
    output = io.StringIO()
    writer = csv.writer(output)
    
    writer.writerow([
        "Transaction ID", "Date", "Customer", "Route", "Amount", 
        "Payment Method", "Status", "GST", "Net Amount"
    ])
    
    for t in transactions:
        amount = t.get("quoted_amount", 0)
        gst = round(amount * 0.18 / 1.18)  # Assuming 18% GST included
        net = amount - gst
        
        writer.writerow([
            t.get("id", ""),
            t.get("created_at", "")[:10],
            t.get("customer_name", ""),
            f"{t.get('from_location', '')} → {t.get('to_location', '')}",
            amount,
            t.get("payment_method", "Online"),
            "Completed",
            gst,
            net
        ])
    
    output.seek(0)
    
    sum(t.get("quoted_amount", 0) for t in transactions)
    
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode('utf-8')),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=finance_export_{datetime.now().strftime('%Y%m%d')}.csv"}
    )


@router.get("/export/summary")
async def get_export_summary(
    current_user: dict = Depends(require_roles(["admin", "ceo"]))
):
    """Get export options summary"""
    db = get_database()
    
    bookings_count = await db.customer_inquiries.count_documents({})
    customers_count = await db.users.count_documents({"roles": "customer"})
    fleet_count = await db.fleet.count_documents({})
    transactions_count = await db.customer_inquiries.count_documents({"payment_status": "paid"})
    
    return {
        "available_exports": [
            {
                "id": "bookings",
                "name": "Bookings Export",
                "description": "All booking inquiries with customer details",
                "record_count": bookings_count,
                "endpoint": "/api/analytics/admin/export/bookings"
            },
            {
                "id": "customers",
                "name": "Customers Export",
                "description": "All registered customers",
                "record_count": customers_count,
                "endpoint": "/api/analytics/admin/export/customers"
            },
            {
                "id": "fleet",
                "name": "Fleet Export",
                "description": "All aircraft in fleet",
                "record_count": fleet_count,
                "endpoint": "/api/analytics/admin/export/fleet"
            },
            {
                "id": "finance",
                "name": "Financial Export",
                "description": "All paid transactions with GST breakdown",
                "record_count": transactions_count,
                "endpoint": "/api/analytics/admin/export/finance"
            }
        ]
    }
