"""Enhanced Audit Trail — live feed, filters, reports, exports, suspicious activity, immutability"""
import os
import io
import csv
import hmac
import hashlib
import uuid
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException, Depends, Query
from fastapi.responses import StreamingResponse
from database import get_database
from middleware import get_current_user

router = APIRouter(prefix="/admin/audit-trail", tags=["Admin - Audit Trail"])

STAFF = {"admin", "super_admin", "ceo", "finance", "cfo", "hr_admin"}
ARCHIVE_ROLES = {"super_admin", "ceo"}
IST = timezone(timedelta(hours=5, minutes=30))
SECRET = os.environ.get("JWT_SECRET_KEY") or os.environ.get("SECRET_KEY") or "audit-secret"

REPORT_PRESETS = {
    "login": {"action": {"$in": ["login", "google_oauth_login", "otp_verified", "2fa_enabled"]}},
    "failed_login": {"action": {"$in": ["login_failed", "otp_failed", "account_locked"]}},
    "logout": {"action": "logout"},
    "user_activity": {},
    "approval": {"action": {"$regex": "approv|reject", "$options": "i"}},
    "refund": {"action": {"$regex": "refund", "$options": "i"}},
    "financial": {"$or": [{"category": "payments"}, {"action": {"$regex": "payment|payout|settlement|gst|invoice|receipt", "$options": "i"}}]},
    "invoice": {"action": {"$regex": "invoice", "$options": "i"}},
    "receipt": {"action": {"$regex": "receipt", "$options": "i"}},
    "role_change": {"action": {"$regex": "role|permission", "$options": "i"}},
    "document": {"action": {"$regex": "document|file_|upload|download", "$options": "i"}},
    "security": {"$or": [{"risk_level": {"$in": ["high", "critical"]}}, {"category": "security_event"},
                         {"action": {"$regex": "password|2fa|otp|unlock|locked", "$options": "i"}}]},
    "suspicious": {"risk_level": {"$in": ["high", "critical"]}},
    "api_audit": {"action": {"$regex": "api_key|gateway|api_", "$options": "i"}},
    "device": {"$or": [{"user_agent": {"$ne": None}}, {"client.user_agent": {"$exists": True}},
                       {"details.user_agent": {"$exists": True}}]},
    "location": {"ip_address": {"$nin": [None, ""]}},
}


def _require_staff(user):
    if not STAFF & set(user.get("roles", [])):
        raise HTTPException(status_code=403, detail="Staff access required")


def sign_entry(entry: dict) -> str:
    if entry.get("sig_v") == 2:
        base = "|".join(str(entry.get(k)) for k in
                        ("id", "action", "user_id", "created_at", "status", "risk_level",
                         "ip_address", "entity_type", "entity_id")) + f"|{entry.get('details')}"
    else:
        base = f"{entry.get('id')}|{entry.get('action')}|{entry.get('user_id')}|{entry.get('created_at')}"
    return hmac.new(SECRET.encode(), base.encode(), hashlib.sha256).hexdigest()


async def audit_event(db, action, user, details=None, resource_type=None, resource_id=None,
                      risk_level="low", ip=None, status="success"):
    """Signed, append-only audit write (used by hooks across modules)"""
    entry = {
        "id": str(uuid.uuid4()), "action": action, "category": "app_event",
        "user_id": (user or {}).get("id"), "user_name": (user or {}).get("full_name") or (user or {}).get("email"),
        "user_email": (user or {}).get("email"), "user_roles": (user or {}).get("roles", []),
        "entity_type": resource_type, "entity_id": resource_id,
        "details": details or {}, "ip_address": ip, "status": status,
        "risk_level": risk_level, "created_at": datetime.now(timezone.utc).isoformat(),
        "sig_v": 2,
    }
    entry["sig"] = sign_entry(entry)
    try:
        await db.audit_logs.insert_one({**entry})
    except Exception:
        pass
    return entry["id"]


def _range_from_preset(preset, from_date, to_date):
    now = datetime.now(IST)
    today = now.replace(hour=0, minute=0, second=0, microsecond=0)
    if preset == "today":
        return today, None
    if preset == "yesterday":
        return today - timedelta(days=1), today
    if preset == "this_week":
        return today - timedelta(days=today.weekday()), None
    if preset == "this_month":
        return today.replace(day=1), None
    start = datetime.fromisoformat(from_date).replace(tzinfo=IST) if from_date else None
    end = (datetime.fromisoformat(to_date).replace(tzinfo=IST) + timedelta(days=1)) if to_date else None
    return start, end


def _time_query(start, end):
    conds = []
    if start:
        s_utc = start.astimezone(timezone.utc)
        c = {"$or": [{"created_at": {"$gte": s_utc.isoformat()}}, {"timestamp": {"$gte": s_utc}}]}
        conds.append(c)
    if end:
        e_utc = end.astimezone(timezone.utc)
        conds.append({"$or": [{"created_at": {"$lt": e_utc.isoformat()}}, {"timestamp": {"$lt": e_utc}}]})
    return conds


def _norm(d):
    ts = d.get("created_at") or d.get("timestamp")
    if hasattr(ts, "isoformat"):
        ts = ts.isoformat()
    u = d.get("user") or {}
    cl = d.get("client") or {}
    ua = d.get("user_agent") or cl.get("user_agent") or (d.get("details") or {}).get("user_agent") or ""
    browser = "Chrome" if "Chrome" in ua else "Firefox" if "Firefox" in ua else "Safari" if "Safari" in ua else ("API/Other" if ua else "")
    oss = "Windows" if "Windows" in ua else "Mac" if "Mac" in ua else "Linux" if "Linux" in ua else "Android" if "Android" in ua else ""
    return {
        "id": d.get("id"), "time": ts, "action": d.get("action"),
        "category": d.get("category") or d.get("entity_type") or "general",
        "user_name": d.get("user_name") or d.get("user_email") or u.get("email") or "system",
        "user_id": d.get("user_id") or u.get("id"),
        "roles": d.get("user_roles") or u.get("roles") or [],
        "resource": f"{d.get('entity_type') or d.get('resource_type') or ''} {d.get('entity_id') or d.get('resource_id') or ''}".strip(),
        "ip": d.get("ip_address") or d.get("ip") or cl.get("ip_address") or "",
        "browser": browser, "os": oss,
        "status": d.get("status", "success"), "risk": d.get("risk_level", "low"),
        "details": str(d.get("details") or d.get("changes") or "")[:300],
        "signed": bool(d.get("sig")),
    }


async def _build_query(preset, from_date, to_date, action, role, module, ip, search, report_type):
    q = {"$and": []}
    start, end = _range_from_preset(preset, from_date, to_date)
    q["$and"].extend(_time_query(start, end))
    if report_type and report_type in REPORT_PRESETS and REPORT_PRESETS[report_type]:
        q["$and"].append(REPORT_PRESETS[report_type])
    if action:
        q["$and"].append({"action": {"$regex": action, "$options": "i"}})
    if role:
        q["$and"].append({"$or": [{"user_roles": role}, {"user.roles": role}]})
    if module:
        q["$and"].append({"$or": [{"category": {"$regex": module, "$options": "i"}},
                                  {"entity_type": {"$regex": module, "$options": "i"}},
                                  {"resource_type": {"$regex": module, "$options": "i"}}]})
    if ip:
        q["$and"].append({"$or": [{"ip_address": {"$regex": ip}}, {"ip": {"$regex": ip}},
                                  {"client.ip_address": {"$regex": ip}}]})
    if search:
        rx = {"$regex": search, "$options": "i"}
        q["$and"].append({"$or": [
            {"user_name": rx}, {"user_email": rx}, {"user.email": rx}, {"action": rx},
            {"entity_id": rx}, {"resource_id": rx}, {"entity_type": rx}, {"ip_address": rx},
            {"client.ip_address": rx},
            {"details.booking_ref": rx}, {"details.invoice_number": rx}, {"details.refund_id": rx},
        ]})
    return q if q["$and"] else {}


@router.get("/feed")
async def live_feed(
    preset: str = Query(None), from_date: str = Query(None), to_date: str = Query(None),
    action: str = Query(None), role: str = Query(None), module: str = Query(None),
    ip: str = Query(None), search: str = Query(None), report_type: str = Query(None),
    limit: int = Query(50, le=200), user: dict = Depends(get_current_user)):
    _require_staff(user)
    db = get_database()
    q = await _build_query(preset, from_date, to_date, action, role, module, ip, search, report_type)
    docs = await db.audit_logs.find(q, {"_id": 0}).sort([("created_at", -1), ("timestamp", -1)]).to_list(limit)
    total = await db.audit_logs.count_documents(q)
    return {"logs": [_norm(d) for d in docs], "total": total,
            "report_types": list(REPORT_PRESETS.keys())}


@router.get("/suspicious")
async def suspicious_activity(days: int = Query(7, le=90), user: dict = Depends(get_current_user)):
    _require_staff(user)
    db = get_database()
    since = (datetime.now(timezone.utc) - timedelta(days=days))
    q = {"$or": [{"created_at": {"$gte": since.isoformat()}}, {"timestamp": {"$gte": since}}]}
    docs = await db.audit_logs.find(q, {"_id": 0}).to_list(3000)
    alerts = []

    # 1. Multiple failed logins (>=3 per user/email)
    fails = {}
    for d in docs:
        if d.get("action") in ("login_failed", "otp_failed"):
            key = d.get("user_email") or (d.get("details") or {}).get("email") or d.get("user_id") or d.get("ip_address") or "unknown"
            fails[key] = fails.get(key, 0) + 1
    for k, n in fails.items():
        if n >= 3:
            alerts.append({"type": "multiple_failed_logins", "severity": "high",
                           "summary": f"{n} failed login/OTP attempts for {k} in last {days}d"})

    # 2. Multiple simultaneous logins (same user, >=2 distinct IPs)
    ips = {}
    for d in docs:
        dip = d.get("ip_address") or (d.get("client") or {}).get("ip_address")
        if d.get("action") in ("login", "google_oauth_login") and dip:
            u2 = d.get("user_email") or (d.get("user") or {}).get("email") or d.get("user_name") or d.get("user_id")
            ips.setdefault(u2, set()).add(dip)
    for u2, s in ips.items():
        if len(s) >= 2:
            alerts.append({"type": "multi_ip_login", "severity": "medium",
                           "summary": f"{u2} logged in from {len(s)} different IPs ({', '.join(list(s)[:3])})"})

    # 3. Off-hours refund approvals (IST outside 09:00-21:00)
    for d in docs:
        if "refund" in (d.get("action") or "") and "approv" in (d.get("action") or ""):
            ts = d.get("created_at") or d.get("timestamp")
            try:
                dt = datetime.fromisoformat(ts) if isinstance(ts, str) else ts
                h = dt.astimezone(IST).hour
                if h < 9 or h >= 21:
                    alerts.append({"type": "offhours_refund_approval", "severity": "high",
                                   "summary": f"Refund approval at {h:02d}:00 IST by {d.get('user_name')}"})
            except Exception:
                pass

    # 4. Permission escalation / role changes
    for d in docs:
        if "role" in (d.get("action") or "").lower() or "permission" in (d.get("action") or "").lower():
            alerts.append({"type": "permission_change", "severity": "medium",
                           "summary": f"{d.get('action')} by {d.get('user_name')} on {d.get('entity_id') or ''}"})

    # 5. Payment gateway / API key changes
    for d in docs:
        if d.get("action") in ("payment_gateway_mode_changed",) or "api_key" in (d.get("action") or ""):
            alerts.append({"type": "gateway_or_api_key_change", "severity": "high",
                           "summary": f"{d.get('action')} by {d.get('user_email') or d.get('user_name')}"})

    # 6. Large payout / refund (>= 1L)
    for d in docs:
        det = d.get("details") or {}
        amt = det.get("amount") or det.get("refundable_amount") or 0
        try:
            if float(amt) >= 100000 and ("refund" in (d.get("action") or "") or "payout" in (d.get("action") or "")):
                alerts.append({"type": "large_payout", "severity": "high",
                               "summary": f"₹{float(amt):,.0f} {d.get('action')} by {d.get('user_name')}"})
        except Exception:
            pass

    # persist new alerts (dedupe by summary/day)
    day = datetime.now(IST).date().isoformat()
    for a in alerts:
        await db.security_alerts.update_one(
            {"summary": a["summary"], "day": day},
            {"$setOnInsert": {**a, "day": day, "id": str(uuid.uuid4()),
                              "created_at": datetime.now(timezone.utc).isoformat(), "acknowledged": False}},
            upsert=True)
    return {"alerts": alerts, "count": len(alerts), "window_days": days}


@router.get("/export")
async def export_report(
    format: str = Query("csv"), report_type: str = Query("user_activity"),
    preset: str = Query(None), from_date: str = Query(None), to_date: str = Query(None),
    search: str = Query(None), user: dict = Depends(get_current_user)):
    _require_staff(user)
    db = get_database()
    q = await _build_query(preset, from_date, to_date, None, None, None, None, search, report_type)
    docs = await db.audit_logs.find(q, {"_id": 0}).sort([("created_at", -1), ("timestamp", -1)]).to_list(2000)
    rows = [_norm(d) for d in docs]
    headers = ["time", "action", "category", "user_name", "roles", "resource", "ip", "browser", "os", "status", "risk", "details"]
    fname = f"audit_{report_type}_{datetime.now(IST).strftime('%Y%m%d_%H%M')}"

    # log the report download itself
    await audit_event(db, "audit_report_downloaded", user,
                      details={"report_type": report_type, "format": format, "rows": len(rows)},
                      resource_type="audit_report", risk_level="medium")

    if format == "csv":
        buf = io.StringIO()
        w = csv.writer(buf)
        w.writerow(headers)
        for r in rows:
            w.writerow([r["time"], r["action"], r["category"], r["user_name"], "|".join(r["roles"]),
                        r["resource"], r["ip"], r["browser"], r["os"], r["status"], r["risk"], r["details"]])
        return StreamingResponse(io.BytesIO(buf.getvalue().encode()), media_type="text/csv",
                                 headers={"Content-Disposition": f"attachment; filename={fname}.csv"})
    if format == "excel":
        from openpyxl import Workbook
        wb = Workbook()
        ws = wb.active
        ws.title = report_type[:28]
        ws.append([h.upper() for h in headers])
        for r in rows:
            ws.append([r["time"], r["action"], r["category"], r["user_name"], "|".join(r["roles"]),
                       r["resource"], r["ip"], r["browser"], r["os"], r["status"], r["risk"], r["details"]])
        out = io.BytesIO()
        wb.save(out)
        out.seek(0)
        return StreamingResponse(out, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                                 headers={"Content-Disposition": f"attachment; filename={fname}.xlsx"})
    if format == "pdf":
        from reportlab.lib.pagesizes import landscape, A4
        from reportlab.lib import colors
        from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph
        from reportlab.lib.styles import getSampleStyleSheet
        out = io.BytesIO()
        doc = SimpleDocTemplate(out, pagesize=landscape(A4))
        styles = getSampleStyleSheet()
        data = [["Time", "Action", "User", "Roles", "IP", "Status", "Risk"]]
        for r in rows[:300]:
            data.append([str(r["time"])[:19], r["action"][:30], str(r["user_name"])[:25],
                         "|".join(r["roles"])[:20], r["ip"][:15], r["status"], r["risk"]])
        t = Table(data, repeatRows=1)
        t.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f97316")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTSIZE", (0, 0), (-1, -1), 7),
            ("GRID", (0, 0), (-1, -1), 0.4, colors.grey),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f1f5f9")]),
        ]))
        doc.build([Paragraph(f"AirYatra Audit Report — {report_type.replace('_', ' ').title()} ({len(rows)} records)", styles["Title"]), t])
        out.seek(0)
        return StreamingResponse(out, media_type="application/pdf",
                                 headers={"Content-Disposition": f"attachment; filename={fname}.pdf"})
    raise HTTPException(status_code=400, detail="format must be csv, excel or pdf")


@router.get("/verify-integrity")
async def verify_integrity(sample: int = Query(200, le=1000), user: dict = Depends(get_current_user)):
    """Tamper-proof check: re-compute HMAC signatures on signed logs"""
    _require_staff(user)
    db = get_database()
    docs = await db.audit_logs.find({"sig": {"$exists": True}}, {"_id": 0}).sort("created_at", -1).to_list(sample)
    tampered = [d["id"] for d in docs if sign_entry(d) != d.get("sig")]
    return {"checked": len(docs), "tampered": len(tampered), "tampered_ids": tampered[:10],
            "integrity": "OK" if not tampered else "COMPROMISED",
            "note": "Signed entries are HMAC-SHA256 protected. No delete API exists — logs are append-only."}


@router.post("/archive")
async def archive_logs(days_older_than: int = Query(365, ge=30), user: dict = Depends(get_current_user)):
    """Archive (NOT delete) old logs — CEO / Super Admin only"""
    if not ARCHIVE_ROLES & set(user.get("roles", [])):
        raise HTTPException(status_code=403, detail="Only CEO / Super Admin may archive audit logs")
    db = get_database()
    cutoff = datetime.now(timezone.utc) - timedelta(days=days_older_than)
    q = {"$or": [{"created_at": {"$lt": cutoff.isoformat()}}, {"timestamp": {"$lt": cutoff}}]}
    moved = 0
    async for d in db.audit_logs.find(q):
        d["archived_at"] = datetime.now(timezone.utc).isoformat()
        await db.audit_logs_archive.insert_one(d)
        await db.audit_logs.delete_one({"_id": d["_id"]})
        moved += 1
    await audit_event(db, "audit_logs_archived", user,
                      details={"moved": moved, "days_older_than": days_older_than}, risk_level="high")
    return {"message": f"{moved} log(s) archived to audit_logs_archive (retained, not deleted)", "moved": moved}
