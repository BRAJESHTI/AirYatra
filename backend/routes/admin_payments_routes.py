"""
Admin Payments Dashboard API
Shows daily collections, pending balances, and payment history for admins
"""
from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime, timezone, timedelta
from database import get_database
from middleware import get_current_user

router = APIRouter(prefix="/admin/payments", tags=["Admin Payments"])


def _require_admin(user: dict):
    """Check if user is admin or super_admin"""
    roles = user.get("roles", [])
    if not any(r in ["admin", "super_admin"] for r in roles):
        raise HTTPException(status_code=403, detail="Admin access required")


@router.get("/dashboard")
async def get_payments_dashboard(
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """Get admin payments dashboard with KPIs, daily collections, pending balances"""
    _require_admin(current_user)
    
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today_start - timedelta(days=7)
    month_start = today_start.replace(day=1)
    
    # Get all paid transactions
    all_paid = await db.payment_transactions.find(
        {"payment_status": "paid"},
        {"_id": 0}
    ).to_list(10000)
    
    # Today's collections
    today_paid = [
        t for t in all_paid
        if t.get("updated_at", "")[:10] == today_start.strftime("%Y-%m-%d")
    ]
    today_total = sum(float(t.get("amount", 0)) for t in today_paid)
    today_count = len(today_paid)
    
    # This week's collections
    week_paid = [
        t for t in all_paid
        if t.get("updated_at", "")[:10] >= week_start.strftime("%Y-%m-%d")
    ]
    week_total = sum(float(t.get("amount", 0)) for t in week_paid)
    
    # This month's collections
    month_paid = [
        t for t in all_paid
        if t.get("updated_at", "")[:7] == month_start.strftime("%Y-%m")
    ]
    month_total = sum(float(t.get("amount", 0)) for t in month_paid)
    
    # Total all-time collections
    all_time_total = sum(float(t.get("amount", 0)) for t in all_paid)
    
    # Get bookings/inquiries with pending balances (paid but not fully_paid)
    pending_balance_bookings = await db.inquiries.find(
        {"payment_status": "paid"},  # Has paid advance but not fully_paid
        {"_id": 0, "id": 1, "inquiry_number": 1, "customer_name": 1, "customer_email": 1,
         "payment_status": 1, "accepted_quote": 1, "estimated_price": 1, "from_location": 1, 
         "to_location": 1, "departure_date": 1}
    ).to_list(500)
    
    # Calculate remaining balance for each
    pending_balances = []
    total_pending = 0.0
    
    for booking in pending_balance_bookings:
        total_amount = float(booking.get("accepted_quote", {}).get("amount") or booking.get("estimated_price") or 0)
        if total_amount <= 0:
            continue
            
        # Get paid transactions for this booking
        txns = await db.payment_transactions.find(
            {"booking_id": booking["id"], "payment_status": "paid"},
            {"_id": 0, "amount": 1, "voucher_discount": 1}
        ).to_list(10)
        
        credited = sum(float(t.get("amount", 0)) + float(t.get("voucher_discount", 0)) for t in txns)
        remaining = max(0.0, round(total_amount - credited, 2))
        
        if remaining > 0:
            pending_balances.append({
                "booking_id": booking["id"],
                "inquiry_number": booking.get("inquiry_number", ""),
                "customer_name": booking.get("customer_name", ""),
                "customer_email": booking.get("customer_email", ""),
                "route": f"{booking.get('from_location', '')} → {booking.get('to_location', '')}",
                "departure_date": booking.get("departure_date", ""),
                "total_amount": total_amount,
                "paid": round(credited, 2),
                "remaining": remaining,
            })
            total_pending += remaining
    
    # Get recent transactions (last 50)
    recent_txns = await db.payment_transactions.find(
        {"payment_status": "paid"},
        {"_id": 0}
    ).sort("updated_at", -1).limit(50).to_list(50)
    
    # Enrich with customer and booking info
    enriched_txns = []
    for txn in recent_txns:
        customer = await db.users.find_one(
            {"id": txn.get("customer_id")},
            {"_id": 0, "full_name": 1, "email": 1}
        )
        booking = await db.inquiries.find_one(
            {"id": txn.get("booking_id")},
            {"_id": 0, "inquiry_number": 1, "from_location": 1, "to_location": 1}
        ) or {}
        
        enriched_txns.append({
            "id": txn.get("id"),
            "session_id": txn.get("session_id"),
            "booking_id": txn.get("booking_id"),
            "inquiry_number": booking.get("inquiry_number", txn.get("booking_id", "")[:8]),
            "customer_name": (customer or {}).get("full_name", "Unknown"),
            "customer_email": (customer or {}).get("email", ""),
            "route": f"{booking.get('from_location', '')} → {booking.get('to_location', '')}",
            "payment_type": txn.get("payment_type", "advance"),
            "amount": txn.get("amount", 0),
            "voucher_discount": txn.get("voucher_discount", 0),
            "gateway": txn.get("gateway", "stripe_test"),
            "paid_at": txn.get("updated_at", ""),
        })
    
    # Daily breakdown for last 7 days (for chart)
    daily_breakdown = []
    for i in range(7):
        day = today_start - timedelta(days=i)
        day_str = day.strftime("%Y-%m-%d")
        day_txns = [t for t in all_paid if t.get("updated_at", "")[:10] == day_str]
        daily_breakdown.append({
            "date": day_str,
            "label": day.strftime("%d %b"),
            "amount": sum(float(t.get("amount", 0)) for t in day_txns),
            "count": len(day_txns),
        })
    daily_breakdown.reverse()  # Oldest to newest
    
    return {
        "kpis": {
            "today_total": round(today_total, 2),
            "today_count": today_count,
            "week_total": round(week_total, 2),
            "month_total": round(month_total, 2),
            "all_time_total": round(all_time_total, 2),
            "pending_balance_total": round(total_pending, 2),
            "pending_balance_count": len(pending_balances),
        },
        "pending_balances": pending_balances[:20],  # Top 20
        "recent_transactions": enriched_txns,
        "daily_breakdown": daily_breakdown,
    }


@router.get("/transactions")
async def get_all_transactions(
    page: int = 1,
    limit: int = 50,
    status: str = None,
    payment_type: str = None,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """Get paginated payment transactions with filters"""
    _require_admin(current_user)
    
    query = {}
    if status:
        query["payment_status"] = status
    if payment_type:
        query["payment_type"] = payment_type
    
    total = await db.payment_transactions.count_documents(query)
    skip = (page - 1) * limit
    
    txns = await db.payment_transactions.find(
        query, {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    # Enrich with customer info
    enriched = []
    for txn in txns:
        customer = await db.users.find_one(
            {"id": txn.get("customer_id")},
            {"_id": 0, "full_name": 1, "email": 1}
        )
        enriched.append({
            **txn,
            "customer_name": (customer or {}).get("full_name", "Unknown"),
            "customer_email": (customer or {}).get("email", ""),
        })
    
    return {
        "transactions": enriched,
        "total": total,
        "page": page,
        "limit": limit,
        "pages": (total + limit - 1) // limit,
    }
