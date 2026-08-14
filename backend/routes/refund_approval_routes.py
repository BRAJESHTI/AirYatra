"""Refund Approval Chain: 2-of-5 role approval (Sales/Accounts/Finance/Admin/CEO) with email OTP.
After trip success/invoice generated -> only Admin/CEO can approve. Customer cancel -> policy auto-deduction.
Operator cancel -> mandatory dropdown reason. Admin/CEO manage cancellation reasons."""
from fastapi import APIRouter, HTTPException, Depends, Body
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone, timedelta
import uuid, random, logging

from database import get_database
from middleware import get_current_user

router = APIRouter(prefix="/refunds", tags=["Refund Approval Chain"])
logger = logging.getLogger(__name__)

APPROVER_ROLES = {"sales", "accounts", "finance", "admin", "super_admin", "ceo"}
SENIOR_ROLES = {"admin", "super_admin", "ceo"}
REQUIRED_APPROVALS = 2


def _now():
    return datetime.now(timezone.utc)


def _role_of(user: dict) -> Optional[str]:
    for r in ("ceo", "super_admin", "admin", "finance", "accounts", "sales"):
        if r in user.get("roles", []):
            return r
    return None


async def _get_booking(db, booking_id):
    return await db.inquiries.find_one({"id": booking_id}, {"_id": 0}) or \
           await db.bookings.find_one({"id": booking_id}, {"_id": 0})


def _paid_amount(booking) -> float:
    return float(booking.get("amount_paid") or booking.get("final_price") or booking.get("total_amount") or 0)


def _policy_deduction_pct(booking) -> float:
    """Customer self-cancel policy: >72h=10%, 24-72h=25%, <24h=50%, post-departure=100%"""
    try:
        d = (booking.get("departure_date") or booking.get("travel_date") or "")[:10]
        t = (booking.get("departure_time") or booking.get("travel_time") or "09:00")[:5]
        dep = datetime.fromisoformat(f"{d}T{t}:00+05:30")
        hours = (dep - _now()).total_seconds() / 3600
    except Exception:
        return 25.0
    if hours < 0:
        return 100.0
    if hours < 24:
        return 50.0
    if hours < 72:
        return 25.0
    return 10.0


async def _is_admin_only(db, booking) -> bool:
    """Trip success ya invoice generated -> only Admin/CEO approve"""
    if booking.get("status") in ("completed", "flight_completed", "trip_completed"):
        return True
    log = await db.invoice_email_log.find_one({"booking_id": booking["id"], "status": "sent"}, {"_id": 0, "key": 1})
    return bool(log)


async def _create_request(db, booking, refund_type, deduction_pct, initiated_by, reason, user,
                          operator_reason=None, amount_override=None):
    paid = _paid_amount(booking)
    deduction = round(paid * deduction_pct / 100, 2)
    refundable = round((amount_override if amount_override is not None else paid - deduction), 2)
    if refundable < 0:
        refundable = 0.0
    req = {
        "id": str(uuid.uuid4()),
        "booking_id": booking["id"],
        "booking_ref": booking.get("booking_number") or booking.get("inquiry_number") or booking["id"][:8],
        "customer_id": booking.get("customer_id") or booking.get("user_id"),
        "refund_type": refund_type,
        "amount_paid": paid,
        "deduction_pct": deduction_pct,
        "deduction_amount": deduction,
        "refundable_amount": refundable,
        "initiated_by": initiated_by,
        "initiated_by_user": user.get("full_name") or user.get("email"),
        "reason": reason,
        "operator_reason": operator_reason,
        "requires_admin_only": await _is_admin_only(db, booking),
        "status": "pending_approval",
        "approvals": [],
        "created_at": _now().isoformat(),
    }
    await db.refund_requests.insert_one({**req})
    return req


# ==================== CANCELLATION REASONS (Admin/CEO managed) ====================

DEFAULT_REASONS = {
    "operator": ["Bad weather conditions", "Night time (day-flying limit reached)", "Engine/Technical fault",
                 "Pilot unavailable / duty limit", "Landing permission issue"],
    "customer": ["Change of plans", "Medical emergency", "Booked by mistake", "Found better option"],
}


@router.get("/reasons")
async def list_reasons(audience: str = "customer", user: dict = Depends(get_current_user)):
    db = get_database()
    if await db.cancellation_reasons.count_documents({}) == 0:
        for aud, labels in DEFAULT_REASONS.items():
            for l in labels:
                await db.cancellation_reasons.insert_one(
                    {"id": str(uuid.uuid4()), "audience": aud, "label": l, "active": True,
                     "created_at": _now().isoformat()})
    reasons = await db.cancellation_reasons.find(
        {"audience": audience, "active": True}, {"_id": 0}).to_list(50)
    return {"reasons": reasons}


@router.post("/reasons")
async def add_reason(audience: str = Body(...), label: str = Body(...), user: dict = Depends(get_current_user)):
    if not SENIOR_ROLES & set(user.get("roles", [])):
        raise HTTPException(status_code=403, detail="Admin/CEO only")
    if audience not in ("customer", "operator") or not label.strip():
        raise HTTPException(status_code=400, detail="audience must be customer/operator with a label")
    db = get_database()
    r = {"id": str(uuid.uuid4()), "audience": audience, "label": label.strip(), "active": True,
         "added_by": user.get("full_name") or user.get("email"), "created_at": _now().isoformat()}
    await db.cancellation_reasons.insert_one({**r})
    return {"message": "Reason added", "reason": r}


@router.delete("/reasons/{reason_id}")
async def remove_reason(reason_id: str, user: dict = Depends(get_current_user)):
    if not SENIOR_ROLES & set(user.get("roles", [])):
        raise HTTPException(status_code=403, detail="Admin/CEO only")
    db = get_database()
    res = await db.cancellation_reasons.update_one({"id": reason_id}, {"$set": {"active": False}})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Reason not found")
    return {"message": "Reason removed"}


async def _send_cancellation_email(db, booking, req):
    """Customer ko instant cancellation email: refund amount + timeline"""
    try:
        customer = await db.users.find_one({"id": req.get("customer_id")}, {"_id": 0, "email": 1, "full_name": 1})
        if not customer or not customer.get("email"):
            return
        route = f"{booking.get('from_location') or booking.get('pickup_location') or 'N/A'} → {booking.get('to_location') or booking.get('drop_location') or 'N/A'}"
        by = "Operator" if req["initiated_by"] == "operator_cancel" else "You"
        deduction_row = "" if req["deduction_pct"] == 0 else (
            f"<div style='display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #2a2a4e;'>"
            f"<span style='color:#94a3b8;'>Cancellation Deduction ({req['deduction_pct']:.0f}%)</span>"
            f"<span style='color:#f87171;font-weight:600;'>- ₹{req['deduction_amount']:,.0f}</span></div>")
        html = f"""
<div style="font-family:'Segoe UI',Arial,sans-serif;background:#1a1a2e;color:#fff;padding:20px;">
  <div style="max-width:600px;margin:0 auto;background:#16213e;border-radius:16px;overflow:hidden;">
    <div style="background:linear-gradient(135deg,#f97316,#ea580c);padding:26px;text-align:center;">
      <h1 style="margin:0;font-size:24px;">Booking Cancellation Received</h1>
      <p style="margin:8px 0 0;opacity:.9;">Booking {req['booking_ref']}</p>
    </div>
    <div style="padding:26px;">
      <p>Dear {customer.get('full_name') or 'Customer'},</p>
      <p>{'Your booking has been cancelled by the operator.' if by == 'Operator' else 'Your cancellation request has been received.'} Details below:</p>
      <div style="background:#1a1a2e;border-radius:12px;padding:18px;margin:16px 0;">
        <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #2a2a4e;"><span style="color:#94a3b8;">Route</span><span style="font-weight:600;">{route}</span></div>
        <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #2a2a4e;"><span style="color:#94a3b8;">Cancelled By</span><span style="font-weight:600;">{by}</span></div>
        <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #2a2a4e;"><span style="color:#94a3b8;">Amount Paid</span><span style="font-weight:600;">₹{req['amount_paid']:,.0f}</span></div>
        {deduction_row}
        <div style="display:flex;justify-content:space-between;padding:8px 0;"><span style="color:#94a3b8;">Refund Amount</span><span style="color:#4ade80;font-weight:700;font-size:18px;">₹{req['refundable_amount']:,.0f}</span></div>
      </div>
      <div style="background:rgba(249,115,22,.1);border:1px solid rgba(249,115,22,.35);border-radius:12px;padding:16px;margin:16px 0;">
        <p style="margin:0;color:#fdba74;font-weight:600;">⏱️ Refund Timeline</p>
        <p style="margin:8px 0 0;color:#cbd5e1;font-size:14px;">
          • Refund team approval: within <b>24–48 hours</b><br/>
          • Amount credit to original payment method: <b>5–7 business days</b> after approval<br/>
          • You will keep receiving status updates by email
        </p>
      </div>
      <p style="color:#94a3b8;font-size:13px;">For any questions, write to support@airyatra.co.in.</p>
      <p style="margin-top:18px;">Team AirYatra ✈️</p>
    </div>
  </div>
</div>"""
        from services.email_service import email_service
        await email_service.send_email(
            to_email=customer["email"],
            subject=f"❌ Booking {req['booking_ref']} Cancelled — Refund ₹{req['refundable_amount']:,.0f} Initiated | AirYatra",
            html_body=html)
        await db.cancellation_email_log.insert_one({
            "id": str(uuid.uuid4()), "booking_id": booking["id"], "refund_request_id": req["id"],
            "to_email": customer["email"], "status": "sent", "sent_at": _now().isoformat()})
    except Exception as e:
        logger.error(f"Cancellation email failed for {booking.get('id')}: {e}")


# ==================== CANCEL FLOWS ====================

@router.post("/customer-cancel")
async def customer_cancel(booking_id: str = Body(...), reason: Optional[str] = Body(None),
                          user: dict = Depends(get_current_user)):
    """Customer khud cancel kare -> policy ke anusar auto-deduction -> team approval"""
    db = get_database()
    booking = await _get_booking(db, booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if booking.get("customer_id") != user["id"] and booking.get("user_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Not your booking")
    if await db.refund_requests.find_one({"booking_id": booking_id, "status": {"$in": ["pending_approval", "approved"]}}):
        raise HTTPException(status_code=400, detail="Refund request already exists for this booking")
    pct = _policy_deduction_pct(booking)
    req = await _create_request(db, booking, "policy_auto", pct, "customer_cancel", reason, user)
    for coll in (db.inquiries, db.bookings):
        await coll.update_one({"id": booking_id}, {"$set": {"status": "cancellation_requested",
                                                            "cancelled_by": "customer"}})
    await _send_cancellation_email(db, booking, req)
    return {"message": f"Cancellation submitted. Policy deduction {pct}% applied. Refund team approval pending.",
            "refund_request": req}


CANCELLABLE_STATUSES = ["confirmed", "quote_accepted", "payment_pending", "payment_completed",
                        "passenger_details_filled", "pending"]


@router.get("/operator/cancellable")
async def operator_cancellable_bookings(user: dict = Depends(get_current_user)):
    """Operator ki bookings jo cancel ho sakti hain"""
    db = get_database()
    if "operator" not in user.get("roles", []):
        raise HTTPException(status_code=403, detail="Operator access required")
    operator = await db.operators.find_one({"user_id": user["id"]}, {"_id": 0, "id": 1})
    if not operator:
        return {"bookings": []}
    q = {"operator_id": operator["id"], "status": {"$in": CANCELLABLE_STATUSES}}
    proj = {"_id": 0, "id": 1, "booking_number": 1, "inquiry_number": 1, "status": 1,
            "from_location": 1, "to_location": 1, "pickup_location": 1, "drop_location": 1,
            "departure_date": 1, "travel_date": 1, "total_amount": 1, "final_price": 1, "amount_paid": 1}
    bookings = await db.bookings.find(q, proj).sort("created_at", -1).to_list(100)
    inquiries = await db.inquiries.find(q, proj).sort("created_at", -1).to_list(100)
    return {"bookings": bookings + inquiries}


@router.post("/operator-cancel")
async def operator_cancel(booking_id: str = Body(...), reason_id: str = Body(...),
                          remark: Optional[str] = Body(None), user: dict = Depends(get_current_user)):
    """Operator cancel -> valid dropdown reason MANDATORY -> full refund request"""
    db = get_database()
    if "operator" not in user.get("roles", []):
        raise HTTPException(status_code=403, detail="Operator access required")
    reason_doc = await db.cancellation_reasons.find_one(
        {"id": reason_id, "audience": "operator", "active": True}, {"_id": 0})
    if not reason_doc:
        raise HTTPException(status_code=400, detail="Valid cancellation reason (dropdown) required")
    booking = await _get_booking(db, booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    operator = await db.operators.find_one({"user_id": user["id"]}, {"_id": 0, "id": 1})
    if not operator or booking.get("operator_id") != operator["id"]:
        raise HTTPException(status_code=403, detail="Not your booking")
    if await db.refund_requests.find_one({"booking_id": booking_id, "status": {"$in": ["pending_approval", "approved"]}}):
        raise HTTPException(status_code=400, detail="Refund request already exists for this booking")
    req = await _create_request(db, booking, "full", 0.0, "operator_cancel", remark, user,
                                operator_reason=reason_doc["label"])
    for coll in (db.inquiries, db.bookings):
        await coll.update_one({"id": booking_id}, {"$set": {"status": "cancellation_requested",
                                                            "cancelled_by": "operator",
                                                            "operator_cancel_reason": reason_doc["label"]}})
    await _send_cancellation_email(db, booking, req)
    return {"message": "Operator cancellation logged. Full refund pending team approval.", "refund_request": req}


@router.post("/manual")
async def manual_refund_request(booking_id: str = Body(...), refund_type: str = Body("partial"),
                                amount: Optional[float] = Body(None), remark: str = Body(...),
                                user: dict = Depends(get_current_user)):
    """Staff manually creates partial/full refund request with remark"""
    db = get_database()
    role = _role_of(user)
    if not role:
        raise HTTPException(status_code=403, detail="Staff access required")
    booking = await _get_booking(db, booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if refund_type not in ("partial", "full"):
        raise HTTPException(status_code=400, detail="refund_type must be partial/full")
    paid = _paid_amount(booking)
    amt = paid if refund_type == "full" else float(amount or 0)
    if amt <= 0 or amt > paid:
        raise HTTPException(status_code=400, detail=f"Amount must be between 0 and paid amount ₹{paid:,.0f}")
    req = await _create_request(db, booking, refund_type, 0.0, "manual_staff", remark, user, amount_override=amt)
    return {"message": "Refund request created, pending approvals.", "refund_request": req}


# ==================== APPROVAL WITH OTP ====================

@router.get("/pending")
async def pending_refunds(user: dict = Depends(get_current_user)):
    if not _role_of(user):
        raise HTTPException(status_code=403, detail="Staff access required")
    db = get_database()
    reqs = await db.refund_requests.find({"status": "pending_approval"}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return {"requests": reqs, "total": len(reqs)}


@router.get("/failed-gateway")
async def failed_gateway_refunds(user: dict = Depends(get_current_user)):
    """Approved refunds jinka gateway refund fail/pending hai — Finance/Admin/CEO monitoring"""
    if not ({"finance", "accounts"} | SENIOR_ROLES) & set(user.get("roles", [])):
        raise HTTPException(status_code=403, detail="Finance/Admin/CEO access required")
    db = get_database()
    reqs = await db.refund_requests.find(
        {"status": "approved", "gateway_refund_id": {"$exists": False},
         "manual_processed": {"$ne": True}},
        {"_id": 0}).sort("approved_at", -1).to_list(100)
    return {"requests": reqs, "total": len(reqs)}


@router.post("/{request_id}/retry-gateway")
async def retry_gateway_refund(request_id: str, user: dict = Depends(get_current_user)):
    """Failed gateway refund ko dobara try karein"""
    if not ({"finance", "accounts"} | SENIOR_ROLES) & set(user.get("roles", [])):
        raise HTTPException(status_code=403, detail="Finance/Admin/CEO access required")
    db = get_database()
    req = await db.refund_requests.find_one({"id": request_id}, {"_id": 0})
    if not req or req["status"] != "approved":
        raise HTTPException(status_code=404, detail="Approved refund request not found")
    if req.get("gateway_refund_id"):
        raise HTTPException(status_code=400, detail="Gateway refund already processed")
    gw = await _trigger_gateway_refund(db, req)
    if gw.get("triggered"):
        return {"message": f"Razorpay refund successful (ID: {gw['refund_id']})", "gateway_refund": gw}
    return {"message": f"Retry failed: {gw.get('reason')}", "gateway_refund": gw}


@router.post("/{request_id}/mark-processed")
async def mark_refund_processed(request_id: str, remark: str = Body(..., embed=True),
                                user: dict = Depends(get_current_user)):
    """Manual gateway refund hone par resolved mark karein (remark mandatory)"""
    if not ({"finance", "accounts"} | SENIOR_ROLES) & set(user.get("roles", [])):
        raise HTTPException(status_code=403, detail="Finance/Admin/CEO access required")
    if not remark.strip():
        raise HTTPException(status_code=400, detail="Remark required")
    db = get_database()
    req = await db.refund_requests.find_one({"id": request_id}, {"_id": 0})
    if not req or req["status"] != "approved":
        raise HTTPException(status_code=404, detail="Approved refund request not found")
    if req.get("gateway_refund_id") or req.get("manual_processed"):
        raise HTTPException(status_code=400, detail="Already processed")
    await db.refund_requests.update_one(
        {"id": request_id},
        {"$set": {"manual_processed": True, "manual_processed_by": user.get("full_name") or user["email"],
                  "manual_processed_remark": remark.strip(), "manual_processed_at": _now().isoformat()}})
    for coll in (db.inquiries, db.bookings):
        await coll.update_one({"id": req["booking_id"]}, {"$set": {"refund_status": "processed"}})
    await db.refund_transactions.insert_one({
        "id": str(uuid.uuid4()), "refund_request_id": request_id, "booking_id": req["booking_id"],
        "amount": req["refundable_amount"], "method": "manual",
        "processed_by": user.get("full_name") or user["email"], "remark": remark.strip(),
        "created_at": _now().isoformat()})
    return {"message": "Refund marked as manually processed"}


@router.post("/{request_id}/request-otp")
async def request_approval_otp(request_id: str, user: dict = Depends(get_current_user)):
    db = get_database()
    role = _role_of(user)
    if not role:
        raise HTTPException(status_code=403, detail="Staff access required")
    req = await db.refund_requests.find_one({"id": request_id}, {"_id": 0})
    if not req or req["status"] != "pending_approval":
        raise HTTPException(status_code=404, detail="Pending refund request not found")
    if req.get("requires_admin_only") and role not in SENIOR_ROLES:
        raise HTTPException(status_code=403, detail="Trip completed/invoice generated — only Admin/CEO can approve")
    code = f"{random.randint(100000, 999999)}"
    await db.refund_otps.update_one(
        {"user_id": user["id"], "request_id": request_id},
        {"$set": {"code": code, "expires_at": (_now() + timedelta(minutes=10)).isoformat()}}, upsert=True)
    from services.email_service import email_service
    await email_service.send_email(
        to_email=user["email"],
        subject=f"🔐 Refund Approval OTP: {code} | AirYatra",
        html_body=f"<div style='font-family:Arial;padding:20px;'><h2>Refund Approval OTP</h2>"
                  f"<p>Refund ₹{req['refundable_amount']:,.0f} for booking {req['booking_ref']}</p>"
                  f"<h1 style='letter-spacing:6px;color:#f97316;'>{code}</h1><p>Valid 10 minutes.</p></div>")
    return {"message": f"OTP emailed to {user['email']}", "expires_in_minutes": 10}


async def _trigger_gateway_refund(db, req):
    """2nd approval milte hi Razorpay refund API auto-trigger"""
    booking = await _get_booking(db, req["booking_id"])
    payment_id = (booking or {}).get("razorpay_payment_id")
    if not payment_id:
        order = await db.payment_orders.find_one(
            {"booking_id": req["booking_id"], "payment_id": {"$ne": None}}, {"_id": 0, "payment_id": 1})
        payment_id = (order or {}).get("payment_id")
    txn = {
        "id": str(uuid.uuid4()), "refund_request_id": req["id"], "booking_id": req["booking_id"],
        "amount": req["refundable_amount"], "created_at": _now().isoformat(),
    }
    if not payment_id:
        txn.update({"method": "pending_gateway", "gateway_status": "no_payment_id",
                    "note": "Razorpay payment ID not found — manual gateway refund required"})
        await db.refund_transactions.insert_one({**txn})
        return {"triggered": False, "reason": "no_payment_id"}
    from services.payment_service import payment_service
    result = await payment_service.create_refund(
        payment_id=payment_id,
        amount=int(round(req["refundable_amount"] * 100)),
        reason=f"Refund approved (2-of-5) for booking {req['booking_ref']}",
        db=db)
    if result.get("success"):
        txn.update({"method": "razorpay", "payment_id": payment_id,
                    "gateway_refund_id": result.get("refund_id"),
                    "gateway_status": result.get("status", "processed"),
                    "mock": bool(result.get("mock"))})
        await db.refund_transactions.insert_one({**txn})
        await db.refund_requests.update_one(
            {"id": req["id"]},
            {"$set": {"gateway_refund_id": result.get("refund_id"),
                      "gateway_refund_status": result.get("status", "processed"),
                      "gateway_refund_at": _now().isoformat()}})
        for coll in (db.inquiries, db.bookings):
            await coll.update_one({"id": req["booking_id"]},
                                  {"$set": {"refund_status": "processed",
                                            "razorpay_refund_id": result.get("refund_id")}})
        logger.info(f"Auto-refund triggered: {result.get('refund_id')} for booking {req['booking_id']}")
        return {"triggered": True, "refund_id": result.get("refund_id"), "mock": bool(result.get("mock"))}
    txn.update({"method": "pending_gateway", "payment_id": payment_id,
                "gateway_status": "failed", "error": result.get("error")})
    await db.refund_transactions.insert_one({**txn})
    await db.refund_requests.update_one(
        {"id": req["id"]}, {"$set": {"gateway_refund_status": "failed",
                                     "gateway_refund_error": result.get("error")}})
    logger.error(f"Auto-refund FAILED for booking {req['booking_id']}: {result.get('error')}")
    return {"triggered": False, "reason": result.get("error")}


@router.post("/{request_id}/approve")
async def approve_refund(request_id: str, otp: str = Body(...), action: str = Body("approve"),
                         remark: str = Body(...), user: dict = Depends(get_current_user)):
    db = get_database()
    role = _role_of(user)
    if not role:
        raise HTTPException(status_code=403, detail="Staff access required")
    req = await db.refund_requests.find_one({"id": request_id}, {"_id": 0})
    if not req or req["status"] != "pending_approval":
        raise HTTPException(status_code=404, detail="Pending refund request not found")
    if req.get("requires_admin_only") and role not in SENIOR_ROLES:
        raise HTTPException(status_code=403, detail="Trip completed/invoice generated — only Admin/CEO can approve")
    if any(a["user_id"] == user["id"] for a in req.get("approvals", [])):
        raise HTTPException(status_code=400, detail="You have already approved this request")
    otp_doc = await db.refund_otps.find_one({"user_id": user["id"], "request_id": request_id}, {"_id": 0})
    if not otp_doc or otp_doc["code"] != otp or otp_doc["expires_at"] < _now().isoformat():
        raise HTTPException(status_code=401, detail="Invalid or expired OTP")
    await db.refund_otps.delete_one({"user_id": user["id"], "request_id": request_id})

    if action == "reject":
        await db.refund_requests.update_one(
            {"id": request_id},
            {"$set": {"status": "rejected", "rejected_by": user.get("full_name") or user["email"],
                      "rejected_role": role, "reject_remark": remark, "rejected_at": _now().isoformat()}})
        return {"message": "Refund request rejected", "status": "rejected"}

    approval = {"user_id": user["id"], "role": role, "name": user.get("full_name") or user["email"],
                "remark": remark, "otp_verified": True, "at": _now().isoformat()}
    approvals = req.get("approvals", []) + [approval]
    if len(approvals) >= REQUIRED_APPROVALS:
        await db.refund_requests.update_one(
            {"id": request_id},
            {"$set": {"approvals": approvals, "status": "approved", "approved_at": _now().isoformat()}})
        for coll in (db.inquiries, db.bookings):
            await coll.update_one({"id": req["booking_id"]},
                                  {"$set": {"status": "cancelled", "refund_status": "approved",
                                            "refund_amount": req["refundable_amount"]}})
        gw = await _trigger_gateway_refund(db, req)
        if gw.get("triggered"):
            msg = (f"Refund APPROVED by {REQUIRED_APPROVALS} approvers. ₹{req['refundable_amount']:,.0f} "
                   f"auto-refunded via Razorpay (Refund ID: {gw['refund_id']}).")
        else:
            msg = (f"Refund APPROVED by {REQUIRED_APPROVALS} approvers. ₹{req['refundable_amount']:,.0f} approved, "
                   f"but auto gateway refund pending ({gw.get('reason')}). Manual processing required.")
        return {"message": msg, "status": "approved", "approvals": approvals, "gateway_refund": gw}
    await db.refund_requests.update_one({"id": request_id}, {"$set": {"approvals": approvals}})
    return {"message": f"Approval 1/{REQUIRED_APPROVALS} recorded. One more approver is required.",
            "status": "pending_approval", "approvals": approvals}
