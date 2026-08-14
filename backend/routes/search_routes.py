"""Smart Global Search (Ctrl+K) — role-based, multi-vertical (Air + Sea + Helipad)."""
from fastapi import APIRouter, Depends, Query
from database import get_database
from middleware import get_current_user
import re
import difflib
from datetime import datetime, timezone, timedelta

router = APIRouter(prefix="/search", tags=["Global Search"])

STAFF = {"admin", "super_admin", "ceo"}
FINANCE = {"finance", "accounts", "cfo", "finance_head", "accounts_manager"}
OWNERS = {"helipad_owner", "yacht_owner", "cruise_operator"}
OWNER_DASH = {"helipad_owner": "/helipad-owner", "yacht_owner": "/yacht-owner", "cruise_operator": "/cruise-operator"}

NAV = {
    "customer": [("Book Flight", "/booking"), ("Book Yacht", "/customer/marine?v=yacht"),
                 ("Book Cruise", "/customer/marine?v=cruise"), ("Book Helipad Transfer", "/customer/marine?v=helipad"),
                 ("My Trips", "/customer/trips"), ("Refunds", "/customer/refunds"),
                 ("Wallet", "/customer/wallet"), ("Loyalty", "/customer/loyalty"),
                 ("Profile", "/customer/profile"), ("Support", "/customer/support")],
    "operator": [("My Fleet / ERP", "/operator/erp"), ("Inquiries", "/operator/inquiries"),
                 ("My Routes & Quotes", "/operator/my-routes"), ("Cancel Booking", "/operator/cancel-bookings"),
                 ("Journey OTP", "/operator/journey-otp"), ("Settings", "/operator/settings")],
    "finance": [("Payments", "/finance?tab=payments"), ("Refunds", "/finance?tab=refunds"),
                ("Operator Payouts", "/finance?tab=operator_payouts"), ("GST/TDS Reports", "/finance?tab=gst_reports"),
                ("Vertical Revenue", "/finance?tab=vertical_revenue")],
    "sales": [("CRM Dashboard", "/sales?tab=crm_dashboard"), ("Leads", "/sales?tab=leads"),
              ("Campaigns", "/sales?tab=campaigns")],
    "admin": [("Refund Approvals", "/admin?tab=refund_approvals"), ("GST/TDS Reports", "/admin?tab=gst_reports"),
              ("Platform Fees", "/admin?tab=platform_fees"), ("Cancellation Reasons", "/admin?tab=cancellation_reasons"),
              ("Vertical Revenue", "/finance?tab=vertical_revenue"), ("Global Settings", "/admin?tab=settings")],
    "corporate": [("Corporate Dashboard", "/corporate"), ("New Booking", "/booking"),
                  ("My Trips", "/customer/trips"), ("Book Yacht", "/customer/marine?v=yacht")],
}

GSTIN_RE = re.compile(r'^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]{3}$', re.I)
PAN_RE = re.compile(r'^[A-Z]{5}[0-9]{4}[A-Z]$', re.I)
MOBILE_RE = re.compile(r'^\+?[0-9]{10,13}$')
EMAIL_RE = re.compile(r'@')


def _rx(q):
    return {"$regex": re.escape(q), "$options": "i"}


def _fuzzy(q, *texts):
    """Typo-tolerant match: substring OR difflib similarity on words/whole text"""
    ql = q.lower()
    qws = ql.split()
    for t in texts:
        if not t:
            continue
        tl = str(t).lower()
        if ql in tl:
            return True
        tws = tl.replace("-", " ").split()
        for w in tws:
            if len(ql) >= 3 and difflib.SequenceMatcher(None, ql, w).ratio() > 0.72:
                return True
        if len(ql) >= 4 and difflib.SequenceMatcher(None, ql, tl).ratio() > 0.6:
            return True
        if len(qws) > 1 and all(
                any(qw in tw or (len(qw) >= 3 and difflib.SequenceMatcher(None, qw, tw).ratio() > 0.72)
                    for tw in tws) for qw in qws):
            return True
    return False


@router.get("/global")
async def global_search(
    q: str = Query(..., min_length=1, max_length=100),
    limit: int = Query(30, ge=1, le=50),
    current_user: dict = Depends(get_current_user)
):
    """Role-based smart search: bookings (air/sea/helipad), customers, operators,
    assets, invoices, payments, refunds, payouts + typo-tolerant quick actions."""
    user = current_user
    q = q.strip()
    db = get_database()
    roles = set(user.get("roles", []))
    is_staff = bool(STAFF & roles)
    is_finance = bool(FINANCE & roles)
    is_sales = bool({"sales", "support"} & roles)
    results = []

    # Quick actions (typo tolerant)
    nav_key = ("admin" if is_staff else "finance" if is_finance else "sales" if is_sales
               else "operator" if "operator" in roles else
               "corporate" if {"corporate", "corporate_admin"} & roles else "customer")
    for label, path in NAV.get(nav_key, []):
        if q.lower() in label.lower() or difflib.SequenceMatcher(None, q.lower(), label.lower()).ratio() > 0.55:
            results.append({"category": "Quick Actions", "title": label, "subtitle": "Go to page",
                            "path": path, "id": path})

    async def add_aviation(extra, path):
        for coll in (db.bookings, db.inquiries):
            cur = coll.find(extra,
                {"_id": 0, "id": 1, "booking_number": 1, "inquiry_number": 1, "status": 1,
                 "customer_name": 1, "from_location": 1, "to_location": 1}).sort("created_at", -1).limit(150)
            count = 0
            async for b in cur:
                if count >= 4:
                    break
                if not _fuzzy(q, b.get("booking_number"), b.get("inquiry_number"),
                              b.get("customer_name"), b.get("from_location"), b.get("to_location")):
                    continue
                count += 1
                ref = b.get("booking_number") or b.get("inquiry_number") or b["id"][:8]
                results.append({"category": "Aviation Bookings", "title": ref,
                                "subtitle": f"{b.get('from_location') or ''} → {b.get('to_location') or ''} • {b.get('status')}",
                                "path": path, "id": b["id"]})

    async def add_vertical_bookings(extra, path):
        cur = db.vertical_bookings.find(extra,
            {"_id": 0, "id": 1, "booking_number": 1, "vertical": 1, "asset_name": 1,
             "asset_code": 1, "customer_name": 1, "status": 1, "amount": 1, "city": 1}).sort("created_at", -1).limit(200)
        count = 0
        async for b in cur:
            if count >= 6:
                break
            if not _fuzzy(q, b.get("booking_number"), b.get("asset_name"), b.get("asset_code"),
                          b.get("customer_name"), b.get("city")):
                continue
            count += 1
            results.append({"category": f"{b['vertical'].title()} Bookings", "title": b["booking_number"],
                            "subtitle": f"{b['asset_name']} • {b['city']} • {b['status']} • ₹{b['amount']:,.0f}",
                            "path": path, "id": b["id"]})

    async def add_assets(extra, path):
        cur = db.vertical_assets.find(extra,
            {"_id": 0, "id": 1, "vertical": 1, "name": 1, "asset_code": 1, "city": 1,
             "base_price": 1, "status": 1}).limit(200)
        count = 0
        async for a in cur:
            if count >= 6:
                break
            if not _fuzzy(q, a.get("name"), a.get("asset_code"), a.get("city"), a.get("vertical")):
                continue
            count += 1
            cat = {"helipad": "Helipads", "yacht": "Yachts", "cruise": "Cruise Ships"}[a["vertical"]]
            results.append({"category": cat, "title": f"{a['name']} ({a['asset_code']})",
                            "subtitle": f"{a['city']} • ₹{a['base_price']:,.0f}/{a.get('status')}",
                            "path": path or f"/customer/marine?v={a['vertical']}", "id": a["id"]})

    # Entity lookup (mobile/email/GST/PAN) for staff/finance/sales
    if (EMAIL_RE.search(q) or MOBILE_RE.match(q) or GSTIN_RE.match(q) or PAN_RE.match(q)) and (is_staff or is_finance or is_sales):
        async for u in db.users.find({"$or": [{"email": _rx(q)}, {"phone": _rx(q)},
                                              {"gstin": _rx(q)}, {"pan": _rx(q)}]},
                                     {"_id": 0, "id": 1, "full_name": 1, "email": 1, "roles": 1}).limit(5):
            results.append({"category": "Customers", "title": u.get("full_name") or u["email"],
                            "subtitle": f"{u['email']} • {', '.join(u.get('roles', []))}",
                            "path": "/admin?tab=users" if is_staff else None, "id": u["id"]})

    if "customer" in roles and not is_staff:
        await add_aviation({"customer_id": user["id"]}, "/customer/trips")
        await add_vertical_bookings({"customer_id": user["id"]}, "/customer/marine")
        await add_assets({"status": "active"}, None)
        async for r in db.refund_requests.find({"customer_id": user["id"], "booking_ref": _rx(q)},
                {"_id": 0, "id": 1, "booking_ref": 1, "status": 1, "refundable_amount": 1}).limit(3):
            results.append({"category": "Refunds", "title": f"Refund {r['booking_ref']}",
                            "subtitle": f"{r['status']} • ₹{r['refundable_amount']:,.0f}",
                            "path": "/customer/refunds", "id": r["id"]})

    if OWNERS & roles:
        dash = next((OWNER_DASH[r] for r in OWNER_DASH if r in roles), "/")
        await add_assets({"owner_user_id": user["id"]}, dash)
        await add_vertical_bookings({"owner_user_id": user["id"]}, dash)

    if "operator" in roles:
        op = await db.operators.find_one({"user_id": user["id"]}, {"_id": 0, "id": 1})
        if op:
            await add_aviation({"operator_id": op["id"]}, "/operator/inquiries")
            async for a in db.aircraft.find({"operator_id": op["id"], "$or": [
                    {"registration_number": _rx(q)}, {"model": _rx(q)}]},
                    {"_id": 0, "id": 1, "registration_number": 1, "model": 1}).limit(4):
                results.append({"category": "Aircraft", "title": a.get("registration_number", ""),
                                "subtitle": a.get("model", ""), "path": "/operator/erp", "id": a["id"]})

    if is_sales and not is_staff:
        await add_aviation({}, "/sales?tab=crm_dashboard")
        await add_vertical_bookings({}, "/sales?tab=crm_dashboard")
        await add_assets({}, "/sales?tab=crm_dashboard")
        async for u in db.users.find({"roles": "customer", "$or": [
                {"full_name": _rx(q)}, {"email": _rx(q)}, {"phone": _rx(q)}]},
                {"_id": 0, "id": 1, "full_name": 1, "email": 1}).limit(4):
            results.append({"category": "Customers", "title": u.get("full_name") or u["email"],
                            "subtitle": u["email"], "path": "/sales?tab=crm_dashboard", "id": u["id"]})

    if is_finance or is_staff:
        base = "/finance" if is_finance and not is_staff else "/admin"
        if not is_staff:
            await add_vertical_bookings({}, "/finance?tab=vertical_revenue")
            await add_assets({}, "/finance?tab=vertical_revenue")
        async for t in db.payment_orders.find({"$or": [{"order_id": _rx(q)}, {"payment_id": _rx(q)}]},
                {"_id": 0, "id": 1, "order_id": 1, "amount": 1, "status": 1}).limit(4):
            results.append({"category": "Payments", "title": t.get("order_id", ""),
                            "subtitle": f"₹{t.get('amount', 0):,.0f} • {t.get('status')}",
                            "path": "/finance?tab=payments", "id": t["id"]})
        async for r in db.refund_requests.find({"booking_ref": _rx(q)},
                {"_id": 0, "id": 1, "booking_ref": 1, "status": 1, "refundable_amount": 1}).limit(4):
            results.append({"category": "Refunds", "title": f"Refund {r['booking_ref']}",
                            "subtitle": f"{r['status']} • ₹{r['refundable_amount']:,.0f}",
                            "path": f"{base}?tab=refund_approvals" if is_staff else "/finance?tab=refunds", "id": r["id"]})
        async for s in db.settlements.find({"$or": [{"settlement_number": _rx(q)}, {"operator_name": _rx(q)}]},
                {"_id": 0, "id": 1, "settlement_number": 1, "operator_name": 1, "payout_amount": 1, "status": 1}).limit(4):
            results.append({"category": "Payouts", "title": s.get("settlement_number", ""),
                            "subtitle": f"{s.get('operator_name')} • ₹{s.get('payout_amount', 0):,.0f} • {s.get('status')}",
                            "path": "/finance?tab=operator_payouts", "id": s["id"]})
        async for inv in db.invoice_email_log.find({"invoice_number": _rx(q)},
                {"_id": 0, "id": 1, "invoice_number": 1, "to_email": 1, "sent_at": 1}).limit(3):
            results.append({"category": "Invoices", "title": inv.get("invoice_number", ""),
                            "subtitle": f"{inv.get('to_email')} • {str(inv.get('sent_at'))[:10]}",
                            "path": "/finance?tab=invoices", "id": inv["id"]})

    if is_staff:
        await add_aviation({}, "/admin/inquiries")
        await add_vertical_bookings({}, "/finance?tab=vertical_revenue")
        await add_assets({}, "/finance?tab=vertical_revenue")
        async for u in db.users.find({"$or": [{"full_name": _rx(q)}, {"email": _rx(q)}, {"phone": _rx(q)}]},
                {"_id": 0, "id": 1, "full_name": 1, "email": 1, "roles": 1}).limit(5):
            results.append({"category": "Customers", "title": u.get("full_name") or u["email"],
                            "subtitle": f"{u['email']} • {', '.join(u.get('roles', []))}",
                            "path": "/admin?tab=users", "id": u["id"]})
        async for o in db.operators.find({"$or": [{"company_name": _rx(q)}, {"base_city": _rx(q)}]},
                {"_id": 0, "id": 1, "company_name": 1, "base_city": 1, "status": 1}).limit(4):
            results.append({"category": "Operators", "title": o.get("company_name", ""),
                            "subtitle": f"{o.get('base_city') or ''} • {o.get('status')}",
                            "path": "/admin?tab=operators", "id": o["id"]})
        async for a in db.aircraft.find({"$or": [{"registration_number": _rx(q)}, {"model": _rx(q)}]},
                {"_id": 0, "id": 1, "registration_number": 1, "model": 1}).limit(4):
            results.append({"category": "Aircraft", "title": a.get("registration_number", ""),
                            "subtitle": a.get("model", ""), "path": "/admin?tab=fleet", "id": a["id"]})

    seen, deduped = set(), []
    for r in results:
        key = (r["category"], r["id"])
        if key not in seen:
            seen.add(key)
            deduped.append(r)
    try:
        term = q.lower().strip()
        if len(term) >= 3 and deduped:
            await db.search_logs.insert_one({
                "query": term, "user_id": user["id"], "results": len(deduped),
                "at": datetime.now(timezone.utc).isoformat()})
    except Exception:
        pass
    return {"results": deduped[:limit], "query": q}


@router.get("/trending")
async def trending_searches(user: dict = Depends(get_current_user)):
    """Top searched terms across the platform (last 30 days)"""
    db = get_database()
    since = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
    pipeline = [
        {"$match": {"at": {"$gte": since}, "results": {"$gt": 0}}},
        {"$group": {"_id": "$query", "count": {"$sum": 1},
                    "users": {"$addToSet": "$user_id"}}},
        {"$project": {"count": 1, "user_count": {"$size": "$users"}}},
        {"$sort": {"count": -1}},
        {"$limit": 8},
    ]
    rows = await db.search_logs.aggregate(pipeline).to_list(8)
    return {"trending": [{"term": r["_id"], "count": r["count"]} for r in rows]}
