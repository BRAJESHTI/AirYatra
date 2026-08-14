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
    "operator": ["Weather thik nahi hai", "Night ho gaya hai (day-flying limit)", "Engine/Technical fault",
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
    return {"message": f"Cancellation submitted. Policy deduction {pct}% applied. Refund team approval pending.",
            "refund_request": req}


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
    if await db.refund_requests.find_one({"booking_id": booking_id, "status": {"$in": ["pending_approval", "approved"]}}):
        raise HTTPException(status_code=400, detail="Refund request already exists for this booking")
    req = await _create_request(db, booking, "full", 0.0, "operator_cancel", remark, user,
                                operator_reason=reason_doc["label"])
    for coll in (db.inquiries, db.bookings):
        await coll.update_one({"id": booking_id}, {"$set": {"status": "cancellation_requested",
                                                            "cancelled_by": "operator",
                                                            "operator_cancel_reason": reason_doc["label"]}})
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
        await db.refund_transactions.insert_one({
            "id": str(uuid.uuid4()), "refund_request_id": request_id, "booking_id": req["booking_id"],
            "amount": req["refundable_amount"], "method": "pending_gateway",
            "created_at": _now().isoformat()})
        return {"message": f"Refund APPROVED by {REQUIRED_APPROVALS} approvers. ₹{req['refundable_amount']:,.0f} queued for processing.",
                "status": "approved", "approvals": approvals}
    await db.refund_requests.update_one({"id": request_id}, {"$set": {"approvals": approvals}})
    return {"message": f"Approval 1/{REQUIRED_APPROVALS} recorded. Ek aur approver chahiye.",
            "status": "pending_approval", "approvals": approvals}
