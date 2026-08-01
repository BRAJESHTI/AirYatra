from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone
from database import get_database
from routes.auth_routes import get_current_user

router = APIRouter(prefix="/ceo", tags=["CEO Dashboard"])

PAID_STATUSES = ["paid", "completed", "success", "verified", "captured"]


@router.get("/dashboard")
async def ceo_dashboard(current_user: dict = Depends(get_current_user)):
    """Executive KPIs: revenue, bookings, fleet, marketplace, users"""
    if "admin" not in current_user.get("roles", []):
        raise HTTPException(status_code=403, detail="Admin access required")
    db = get_database()
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0).isoformat()

    total_bookings = await db.bookings.count_documents({})
    bookings_month = await db.bookings.count_documents({"created_at": {"$gte": month_start}})
    total_customers = await db.users.count_documents({"roles": "customer"})
    new_customers_month = await db.users.count_documents({"roles": "customer", "created_at": {"$gte": month_start}})

    paid = await db.payment_orders.find({"status": {"$in": PAID_STATUSES}}, {"_id": 0, "amount": 1}).to_list(5000)
    revenue_total = sum(p.get("amount", 0) for p in paid)
    accepted = await db.quotes.find({"status": "accepted"}, {"_id": 0, "amount": 1}).to_list(5000)
    pipeline_value = sum(q.get("amount", 0) for q in accepted)

    operators_total = await db.operators.count_documents({})
    operators_active = await db.operators.count_documents({"status": "active"})
    aircraft_total = await db.aircraft.count_documents({})
    aircraft_available = await db.aircraft.count_documents({"is_available": True})

    listings_active = await db.exchange_listings.count_documents({"status": "active"})
    listings_sold = await db.exchange_listings.count_documents({"status": "sold"})
    listings_pending = await db.exchange_listings.count_documents({"status": "pending_review"})
    auctions_live = await db.exchange_auctions.count_documents({"status": "live"})
    total_bids = await db.exchange_bids.count_documents({})
    live_auctions = await db.exchange_auctions.find({"status": "live"}, {"_id": 0, "current_bid_inr": 1}).to_list(100)
    auction_bid_value = sum(a.get("current_bid_inr", 0) for a in live_auctions)

    offerings = await db.exchange_fractional.find({}, {"_id": 0, "total_shares": 1, "shares_available": 1}).to_list(50)
    shares_sold = sum(o["total_shares"] - o["shares_available"] for o in offerings)
    shares_total = sum(o["total_shares"] for o in offerings)
    approved_res = await db.exchange_fractional_reservations.find({"status": "approved"}, {"_id": 0, "shares": 1, "share_price_inr": 1}).to_list(500)
    fractional_value = sum(r["shares"] * r["share_price_inr"] for r in approved_res)
    eoi_new = await db.exchange_fractional_reservations.count_documents({"status": "new"})

    inquiries_total = await db.exchange_inquiries.count_documents({})
    inspections_pending = await db.exchange_inspections.count_documents({"status": "requested"})

    tiers = {}
    async for m in db.memberships.find({}, {"_id": 0, "tier": 1}):
        t = m.get("tier", "unknown")
        tiers[t] = tiers.get(t, 0) + 1

    partners_total = await db.partners.count_documents({})
    partners_active = await db.partners.count_documents({"status": "active"})
    partner_bookings_total = await db.partner_bookings.count_documents({})
    partner_bookings_new = await db.partner_bookings.count_documents({"status": "received"})

    trend = []
    for i in range(5, -1, -1):
        idx = now.year * 12 + (now.month - 1) - i
        y, m = divmod(idx, 12)
        m += 1
        start = datetime(y, m, 1, tzinfo=timezone.utc)
        end = datetime(y + (1 if m == 12 else 0), 1 if m == 12 else m + 1, 1, tzinfo=timezone.utc)
        count = await db.bookings.count_documents({"created_at": {"$gte": start.isoformat(), "$lt": end.isoformat()}})
        trend.append({"month": start.strftime("%b %y"), "bookings": count})

    return {
        "generated_at": now.isoformat(),
        "revenue": {"total_collected_inr": revenue_total, "accepted_quotes_value_inr": pipeline_value},
        "bookings": {"total": total_bookings, "this_month": bookings_month, "monthly_trend": trend},
        "customers": {"total": total_customers, "new_this_month": new_customers_month},
        "fleet": {"operators_total": operators_total, "operators_active": operators_active, "aircraft_total": aircraft_total, "aircraft_available": aircraft_available},
        "marketplace": {
            "listings_active": listings_active, "listings_sold": listings_sold, "listings_pending": listings_pending,
            "auctions_live": auctions_live, "total_bids": total_bids, "live_auction_bid_value_inr": auction_bid_value,
            "fractional_shares_sold": shares_sold, "fractional_shares_total": shares_total,
            "fractional_allocated_value_inr": fractional_value, "fractional_new_eois": eoi_new,
            "buyer_inquiries": inquiries_total, "inspections_pending": inspections_pending,
        },
        "memberships": tiers,
        "partners": {"total": partners_total, "active": partners_active, "bookings_total": partner_bookings_total, "bookings_new": partner_bookings_new},
    }
