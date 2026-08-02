"""
AirYatra Finance ERP - Dashboard Analytics
Monthly revenue trends and payment gateway reconciliation
"""
from fastapi import APIRouter, Depends
from middleware import get_current_user, require_roles
from models import UserRole
from database import get_database
from datetime import datetime, timezone, timedelta
from typing import Optional

router = APIRouter(prefix="/finance/analytics", tags=["finance-analytics"])

@router.get("/revenue-trends")
async def get_revenue_trends(
    period: str = "6months",  # 3months, 6months, 12months, year
    current_user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.FINANCE_HEAD, UserRole.CFO]))
):
    """
    Get monthly revenue trends with breakdown by payment type
    """
    db = get_database()
    
    now = datetime.now(timezone.utc)
    
    # Determine date range
    if period == "3months":
        months = 3
    elif period == "6months":
        months = 6
    elif period == "12months" or period == "year":
        months = 12
    else:
        months = 6
    
    start_date = now - timedelta(days=months * 30)
    
    # Get all paid transactions (both advance and balance)
    paid_transactions = await db.payment_transactions.find({
        "status": "paid",
        "created_at": {"$gte": start_date}
    }).to_list(10000)
    
    # Also get from inquiries with payment_status = paid
    paid_inquiries = await db.inquiries.find({
        "payment_status": {"$in": ["paid", "fully_paid"]},
        "updated_at": {"$gte": start_date.isoformat()}
    }).to_list(5000)
    
    # Aggregate by month
    monthly_revenue = {}
    revenue_by_type = {"advance": {}, "balance": {}}
    payment_methods = {"stripe": 0, "razorpay": 0, "upi": 0, "neft": 0, "other": 0}
    
    for txn in paid_transactions:
        try:
            created = txn.get("created_at")
            if isinstance(created, str):
                dt = datetime.fromisoformat(created.replace("Z", "+00:00"))
            else:
                dt = created
            
            month_key = dt.strftime("%Y-%m")
            amount = txn.get("amount", 0)
            payment_type = txn.get("payment_type", "advance")
            gateway = txn.get("gateway", "other").lower()
            
            # Monthly total
            monthly_revenue[month_key] = monthly_revenue.get(month_key, 0) + amount
            
            # By payment type
            if payment_type not in revenue_by_type:
                revenue_by_type[payment_type] = {}
            revenue_by_type[payment_type][month_key] = revenue_by_type[payment_type].get(month_key, 0) + amount
            
            # By gateway
            if gateway in payment_methods:
                payment_methods[gateway] += amount
            else:
                payment_methods["other"] += amount
                
        except (ValueError, TypeError, AttributeError):
            pass
    
    # Process inquiries for additional data
    for inquiry in paid_inquiries:
        try:
            updated = inquiry.get("updated_at", inquiry.get("created_at", ""))
            if isinstance(updated, str):
                dt = datetime.fromisoformat(updated.replace("Z", "+00:00"))
            else:
                dt = updated
            
            month_key = dt.strftime("%Y-%m")
            
            # If not already in transactions, add from inquiry
            if month_key not in monthly_revenue:
                total = inquiry.get("final_price", inquiry.get("quoted_price", 0))
                monthly_revenue[month_key] = monthly_revenue.get(month_key, 0) + total
        except (ValueError, TypeError, AttributeError):
            pass
    
    # Sort months
    sorted_months = sorted(monthly_revenue.keys())
    
    # Calculate totals and growth
    total_revenue = sum(monthly_revenue.values())
    
    # Month-over-month growth
    growth_data = []
    for i, month in enumerate(sorted_months):
        current = monthly_revenue[month]
        prev = monthly_revenue.get(sorted_months[i-1], 0) if i > 0 else 0
        growth_rate = ((current - prev) / prev * 100) if prev > 0 else 0
        growth_data.append({
            "month": month,
            "revenue": current,
            "growth_rate": round(growth_rate, 1),
            "advance": revenue_by_type.get("advance", {}).get(month, 0),
            "balance": revenue_by_type.get("balance", {}).get(month, 0)
        })
    
    # Average monthly revenue
    avg_monthly = total_revenue / len(sorted_months) if sorted_months else 0
    
    return {
        "total_revenue": total_revenue,
        "average_monthly": round(avg_monthly, 2),
        "period": period,
        "monthly_breakdown": growth_data,
        "by_payment_type": {
            "advance": sum(revenue_by_type.get("advance", {}).values()),
            "balance": sum(revenue_by_type.get("balance", {}).values())
        },
        "by_gateway": payment_methods
    }


@router.get("/gateway-reconciliation")
async def get_gateway_reconciliation(
    gateway: Optional[str] = None,  # stripe, razorpay, all
    period: str = "month",
    current_user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.FINANCE_HEAD, UserRole.CFO]))
):
    """
    Payment gateway reconciliation - match transactions with settlements
    """
    db = get_database()
    
    now = datetime.now(timezone.utc)
    
    if period == "week":
        start_date = now - timedelta(days=7)
    elif period == "month":
        start_date = now - timedelta(days=30)
    elif period == "quarter":
        start_date = now - timedelta(days=90)
    else:
        start_date = now - timedelta(days=30)
    
    # Query filter
    query = {
        "status": "paid",
        "created_at": {"$gte": start_date}
    }
    if gateway and gateway != "all":
        query["gateway"] = gateway.lower()
    
    # Get transactions
    transactions = await db.payment_transactions.find(query).to_list(5000)
    
    # Get settlements (if any)
    settlements = await db.payment_settlements.find({
        "created_at": {"$gte": start_date}
    }).to_list(1000)
    
    # Aggregate data
    total_collected = 0
    total_settled = 0
    pending_settlement = 0
    by_gateway = {}
    daily_breakdown = {}
    
    for txn in transactions:
        amount = txn.get("amount", 0)
        gw = txn.get("gateway", "unknown")
        is_settled = txn.get("settled", False)
        
        total_collected += amount
        if is_settled:
            total_settled += amount
        else:
            pending_settlement += amount
        
        # By gateway
        if gw not in by_gateway:
            by_gateway[gw] = {"collected": 0, "settled": 0, "pending": 0, "count": 0}
        by_gateway[gw]["collected"] += amount
        by_gateway[gw]["count"] += 1
        if is_settled:
            by_gateway[gw]["settled"] += amount
        else:
            by_gateway[gw]["pending"] += amount
        
        # Daily breakdown
        try:
            created = txn.get("created_at")
            if isinstance(created, str):
                dt = datetime.fromisoformat(created.replace("Z", "+00:00"))
            else:
                dt = created
            day_key = dt.strftime("%Y-%m-%d")
            if day_key not in daily_breakdown:
                daily_breakdown[day_key] = {"collected": 0, "count": 0}
            daily_breakdown[day_key]["collected"] += amount
            daily_breakdown[day_key]["count"] += 1
        except (ValueError, TypeError):
            pass
    
    # Process settlements
    for settlement in settlements:
        amount = settlement.get("amount", 0)
        gw = settlement.get("gateway", "unknown")
        if gw in by_gateway:
            by_gateway[gw]["settled"] = settlement.get("total_settled", by_gateway[gw]["settled"])
    
    # Sort daily breakdown
    sorted_days = sorted(daily_breakdown.keys())
    daily_data = [{"date": d, **daily_breakdown[d]} for d in sorted_days]
    
    return {
        "period": period,
        "summary": {
            "total_collected": total_collected,
            "total_settled": total_settled,
            "pending_settlement": pending_settlement,
            "settlement_rate": round(total_settled / total_collected * 100, 1) if total_collected > 0 else 0,
            "transaction_count": len(transactions)
        },
        "by_gateway": by_gateway,
        "daily_breakdown": daily_data[-30:],  # Last 30 days
        "alerts": _generate_reconciliation_alerts(by_gateway, pending_settlement)
    }


def _generate_reconciliation_alerts(by_gateway: dict, pending_total: float) -> list:
    """Generate alerts for reconciliation issues"""
    alerts = []
    
    # High pending settlement alert
    if pending_total > 100000:  # > ₹1 Lakh
        alerts.append({
            "type": "warning",
            "message": f"High pending settlement: ₹{pending_total:,.0f}",
            "action": "Review pending settlements and initiate transfer"
        })
    
    # Gateway-specific alerts
    for gw, data in by_gateway.items():
        pending_pct = (data["pending"] / data["collected"] * 100) if data["collected"] > 0 else 0
        if pending_pct > 50:
            alerts.append({
                "type": "info",
                "message": f"{gw.capitalize()}: {pending_pct:.0f}% transactions pending settlement",
                "action": f"Check {gw} dashboard for settlement status"
            })
    
    return alerts


@router.get("/collection-summary")
async def get_collection_summary(
    current_user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.FINANCE_HEAD, UserRole.CFO]))
):
    """
    Quick collection summary for dashboard
    """
    db = get_database()
    
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = now - timedelta(days=7)
    month_start = now - timedelta(days=30)
    
    # Get all paid transactions
    all_transactions = await db.payment_transactions.find({"status": "paid"}).to_list(10000)
    
    today_total = 0
    week_total = 0
    month_total = 0
    all_time_total = 0
    
    for txn in all_transactions:
        amount = txn.get("amount", 0)
        all_time_total += amount
        
        try:
            created = txn.get("created_at")
            if isinstance(created, str):
                dt = datetime.fromisoformat(created.replace("Z", "+00:00"))
            elif isinstance(created, datetime):
                dt = created if created.tzinfo else created.replace(tzinfo=timezone.utc)
            else:
                continue
            
            if dt >= today_start:
                today_total += amount
            if dt >= week_start:
                week_total += amount
            if dt >= month_start:
                month_total += amount
        except (ValueError, TypeError):
            pass
    
    # Pending balances
    pending_inquiries = await db.inquiries.find({
        "payment_status": "paid",  # Advance paid but not fully paid
        "status": {"$nin": ["cancelled", "rejected"]}
    }).to_list(1000)
    
    pending_balance_total = 0
    pending_count = 0
    for inq in pending_inquiries:
        total = inq.get("final_price", inq.get("quoted_price", 0))
        credited = inq.get("amount_credited", total * 0.5)  # Default 50% advance
        remaining = total - credited
        if remaining > 0:
            pending_balance_total += remaining
            pending_count += 1
    
    return {
        "today": {"amount": today_total, "label": "Today"},
        "week": {"amount": week_total, "label": "This Week"},
        "month": {"amount": month_total, "label": "This Month"},
        "all_time": {"amount": all_time_total, "label": "All Time"},
        "pending_balance": {
            "amount": pending_balance_total,
            "count": pending_count,
            "label": "Pending Balances"
        }
    }


@router.get("/top-customers")
async def get_top_customers(
    limit: int = 10,
    period: str = "all",
    current_user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.FINANCE_HEAD, UserRole.CFO]))
):
    """
    Get top customers by revenue
    """
    db = get_database()
    
    now = datetime.now(timezone.utc)
    
    # Date filter
    if period == "month":
        start_date = now - timedelta(days=30)
    elif period == "quarter":
        start_date = now - timedelta(days=90)
    elif period == "year":
        start_date = now - timedelta(days=365)
    else:
        start_date = None
    
    # Get paid inquiries/bookings
    query = {"payment_status": {"$in": ["paid", "fully_paid"]}}
    if start_date:
        query["updated_at"] = {"$gte": start_date.isoformat()}
    
    inquiries = await db.inquiries.find(query).to_list(10000)
    
    # Aggregate by customer
    customer_revenue = {}
    for inq in inquiries:
        user_id = inq.get("user_id")
        if not user_id:
            continue
        
        amount = inq.get("final_price", inq.get("quoted_price", 0))
        
        if user_id not in customer_revenue:
            customer_revenue[user_id] = {"total": 0, "bookings": 0, "user_id": user_id}
        customer_revenue[user_id]["total"] += amount
        customer_revenue[user_id]["bookings"] += 1
    
    # Sort by revenue
    sorted_customers = sorted(customer_revenue.values(), key=lambda x: x["total"], reverse=True)[:limit]
    
    # Enrich with user details
    result = []
    for cust in sorted_customers:
        user = await db.users.find_one({"id": cust["user_id"]}, {"_id": 0, "password_hash": 0})
        if user:
            result.append({
                "user_id": cust["user_id"],
                "name": user.get("full_name", "Unknown"),
                "email": user.get("email", ""),
                "phone": user.get("phone", ""),
                "total_revenue": cust["total"],
                "booking_count": cust["bookings"],
                "membership": user.get("membership_tier", "none")
            })
    
    return {"customers": result, "period": period}
