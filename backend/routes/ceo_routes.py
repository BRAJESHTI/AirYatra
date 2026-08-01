from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import Response
from datetime import datetime, timezone
from database import get_database
from routes.auth_routes import get_current_user

router = APIRouter(prefix="/ceo", tags=["CEO Dashboard"])

PAID_STATUSES = ["paid", "completed", "success", "verified", "captured"]
EMPLOYEE_ROLES = ["hr", "finance", "marketing", "operations", "sales", "support", "regional_manager"]
EXPENSE_PENDING = ["submitted", "pending_approval", "pending"]


async def _gather_kpis(db):
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0).isoformat()
    today = now.date().isoformat()

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
    watchers_total = await db.exchange_watchlist.count_documents({})

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

    # People & HR (HRMS)
    employees_total = await db.users.count_documents({"roles": {"$in": EMPLOYEE_ROLES}})
    attendance_today = await db.attendance.count_documents({"date": today})
    leaves_pending = await db.leaves.count_documents({"status": "pending"})
    pending_expenses = await db.expense_claims.find({"status": {"$in": EXPENSE_PENDING}}, {"_id": 0, "amount": 1}).to_list(1000)
    expenses_pending_count = len(pending_expenses)
    expenses_pending_amount = sum(e.get("amount", 0) for e in pending_expenses)
    payroll_month = await db.payroll.find({"month": now.month, "year": now.year}, {"_id": 0}).to_list(1000)
    payroll_month_net = sum(p.get("net_salary", p.get("net_pay", 0)) for p in payroll_month)

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
        "period": now.strftime("%B %Y"),
        "revenue": {"total_collected_inr": revenue_total, "accepted_quotes_value_inr": pipeline_value},
        "bookings": {"total": total_bookings, "this_month": bookings_month, "monthly_trend": trend},
        "customers": {"total": total_customers, "new_this_month": new_customers_month},
        "fleet": {"operators_total": operators_total, "operators_active": operators_active, "aircraft_total": aircraft_total, "aircraft_available": aircraft_available},
        "marketplace": {
            "listings_active": listings_active, "listings_sold": listings_sold, "listings_pending": listings_pending,
            "auctions_live": auctions_live, "total_bids": total_bids, "live_auction_bid_value_inr": auction_bid_value,
            "auction_watchers": watchers_total,
            "fractional_shares_sold": shares_sold, "fractional_shares_total": shares_total,
            "fractional_allocated_value_inr": fractional_value, "fractional_new_eois": eoi_new,
            "buyer_inquiries": inquiries_total, "inspections_pending": inspections_pending,
        },
        "hr": {
            "employees_total": employees_total,
            "attendance_today": attendance_today,
            "leaves_pending": leaves_pending,
            "expenses_pending_count": expenses_pending_count,
            "expenses_pending_amount_inr": expenses_pending_amount,
            "payroll_month_net_inr": payroll_month_net,
            "payroll_month_count": len(payroll_month),
        },
        "memberships": tiers,
        "partners": {"total": partners_total, "active": partners_active, "bookings_total": partner_bookings_total, "bookings_new": partner_bookings_new},
    }


@router.get("/dashboard")
async def ceo_dashboard(current_user: dict = Depends(get_current_user)):
    """Executive KPIs: revenue, bookings, fleet, marketplace, HR, users"""
    if "admin" not in current_user.get("roles", []):
        raise HTTPException(status_code=403, detail="Admin access required")
    db = get_database()
    return await _gather_kpis(db)


def _fmt_inr(v):
    if v >= 10000000:
        return f"Rs. {v / 10000000:.1f} Cr"
    if v >= 100000:
        return f"Rs. {v / 100000:.1f} L"
    return f"Rs. {v:,.0f}"


def _generate_board_report(d: dict) -> bytes:
    from io import BytesIO
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import mm
    from reportlab.lib.colors import HexColor
    from reportlab.pdfgen import canvas

    buf = BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    w, h = A4

    def header():
        c.setFillColor(HexColor("#0f172a"))
        c.rect(0, h - 40 * mm, w, 40 * mm, fill=1, stroke=0)
        c.setFillColor(HexColor("#f97316"))
        c.setFont("Helvetica-Bold", 22)
        c.drawString(20 * mm, h - 20 * mm, "AIRYATRA")
        c.setFillColor(HexColor("#e2e8f0"))
        c.setFont("Helvetica", 13)
        c.drawString(20 * mm, h - 28 * mm, "Monthly Board Report — Executive Summary")
        c.setFont("Helvetica", 10)
        c.drawRightString(w - 20 * mm, h - 20 * mm, f"Period: {d['period']}")
        c.drawRightString(w - 20 * mm, h - 26 * mm, f"Generated: {datetime.now(timezone.utc).strftime('%d %b %Y')}")

    header()
    y = h - 52 * mm

    def section(title):
        nonlocal y
        if y < 40 * mm:
            c.showPage()
            header()
            y = h - 52 * mm
        c.setFillColor(HexColor("#f97316"))
        c.setFont("Helvetica-Bold", 13)
        c.drawString(20 * mm, y, title)
        c.setStrokeColor(HexColor("#f97316"))
        c.setLineWidth(0.8)
        c.line(20 * mm, y - 2 * mm, w - 20 * mm, y - 2 * mm)
        y -= 10 * mm

    def row(label, value):
        nonlocal y
        if y < 30 * mm:
            c.showPage()
            header()
            y = h - 52 * mm
        c.setFillColor(HexColor("#334155"))
        c.setFont("Helvetica", 10.5)
        c.drawString(24 * mm, y, label)
        c.setFillColor(HexColor("#0f172a"))
        c.setFont("Helvetica-Bold", 10.5)
        c.drawRightString(w - 24 * mm, y, str(value))
        y -= 7 * mm

    mp = d["marketplace"]
    hr = d["hr"]
    pt = d["partners"]

    section("1. Financial Performance")
    row("Revenue Collected", _fmt_inr(d["revenue"]["total_collected_inr"]))
    row("Accepted Quotes Pipeline", _fmt_inr(d["revenue"]["accepted_quotes_value_inr"]))
    row("Live Auction Bid Value", _fmt_inr(mp["live_auction_bid_value_inr"]))
    row("Fractional Shares Allocated Value", _fmt_inr(mp["fractional_allocated_value_inr"]))
    y -= 3 * mm

    section("2. Operations & Growth")
    row("Total Bookings", f"{d['bookings']['total']} ({d['bookings']['this_month']} this month)")
    row("Customers", f"{d['customers']['total']} (+{d['customers']['new_this_month']} this month)")
    row("Operators (active/total)", f"{d['fleet']['operators_active']} / {d['fleet']['operators_total']}")
    row("Aircraft (available/total)", f"{d['fleet']['aircraft_available']} / {d['fleet']['aircraft_total']}")
    trend_str = "   ".join(f"{t['month']}: {t['bookings']}" for t in d["bookings"]["monthly_trend"])
    row("Booking Trend (6 mo)", trend_str)
    y -= 3 * mm

    section("3. Aviation Exchange Marketplace")
    row("Active Listings", f"{mp['listings_active']} ({mp['listings_sold']} sold, {mp['listings_pending']} pending review)")
    row("Live Auctions", f"{mp['auctions_live']} ({mp['total_bids']} total bids, {mp['auction_watchers']} watchers)")
    row("Fractional Shares Sold", f"{mp['fractional_shares_sold']} / {mp['fractional_shares_total']} ({mp['fractional_new_eois']} new EOIs)")
    row("Buyer Inquiries / Pending Inspections", f"{mp['buyer_inquiries']} / {mp['inspections_pending']}")
    y -= 3 * mm

    section("4. People & HR (HRMS)")
    row("Internal Employees", hr["employees_total"])
    row("Attendance Marked Today", hr["attendance_today"])
    row("Pending Leave Requests", hr["leaves_pending"])
    row("Pending Expense Claims", f"{hr['expenses_pending_count']} ({_fmt_inr(hr['expenses_pending_amount_inr'])})")
    row("Payroll This Month", f"{hr['payroll_month_count']} slips ({_fmt_inr(hr['payroll_month_net_inr'])})")
    y -= 3 * mm

    section("5. Partnerships & Memberships")
    row("API Partners (active/total)", f"{pt['active']} / {pt['total']}")
    row("Partner Bookings", f"{pt['bookings_total']} ({pt['bookings_new']} awaiting processing)")
    for tier, count in (d["memberships"] or {}).items():
        row(f"BLACK Membership — {tier.title()}", count)

    c.setFillColor(HexColor("#94a3b8"))
    c.setFont("Helvetica-Oblique", 8)
    c.drawCentredString(w / 2, 15 * mm, "Confidential — prepared for the Board of Directors & Investors • AirYatra Aviation Pvt Ltd")

    c.save()
    return buf.getvalue()


@router.get("/report.pdf")
async def download_board_report(current_user: dict = Depends(get_current_user)):
    """Downloadable monthly board-report PDF for investors"""
    if "admin" not in current_user.get("roles", []):
        raise HTTPException(status_code=403, detail="Admin access required")
    db = get_database()
    data = await _gather_kpis(db)
    pdf = _generate_board_report(data)
    fname = f"AirYatra_Board_Report_{data['period'].replace(' ', '_')}.pdf"
    return Response(content=pdf, media_type="application/pdf", headers={"Content-Disposition": f'attachment; filename="{fname}"'})
