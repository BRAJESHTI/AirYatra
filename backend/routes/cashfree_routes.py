"""
AirYatra Cashfree Payment Routes
Endpoints for Cashfree checkout, verification, refunds, and webhooks
"""

from fastapi import APIRouter, HTTPException, Depends, Request, Query
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
from database import get_database
from middleware import get_current_user, require_roles
import logging
import uuid
import json

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/payments/cashfree", tags=["Cashfree Payments"])

from services.cashfree_service import cashfree_service


# ==================== PYDANTIC MODELS ====================

class CreateOrderRequest(BaseModel):
    booking_id: str
    amount: float
    customer_name: Optional[str] = None
    customer_email: Optional[str] = None
    customer_phone: Optional[str] = None
    return_url: Optional[str] = None

class VerifyPaymentRequest(BaseModel):
    order_id: str
    booking_id: Optional[str] = None

class RefundRequest(BaseModel):
    order_id: str
    refund_amount: float
    refund_note: Optional[str] = "Customer refund"
    booking_id: Optional[str] = None


# ==================== PUBLIC ENDPOINTS ====================

@router.get("/config")
async def get_cashfree_config():
    """Get Cashfree client configuration for frontend"""
    import os
    client_id = os.environ.get("CASHFREE_CLIENT_ID", "")
    mode = os.environ.get("CASHFREE_MODE", "sandbox")
    
    return {
        "success": True,
        "mode": mode if cashfree_service.is_configured() else "MOCK",
        "configured": cashfree_service.is_configured(),
        "currency": "INR",
        "payment_methods": ["UPI", "Cards", "Net Banking", "Wallets"]
    }


# ==================== PAYMENT ENDPOINTS ====================

@router.post("/create-order")
async def create_cashfree_order(
    data: CreateOrderRequest,
    current_user: dict = Depends(get_current_user)
):
    """Create a Cashfree order for booking payment"""
    db = get_database()
    
    # Verify booking exists
    booking = await db.bookings.find_one({"id": data.booking_id})
    inquiry = await db.inquiries.find_one({"id": data.booking_id})
    
    if not booking and not inquiry:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    record = booking or inquiry
    
    # Get customer details
    customer_name = data.customer_name or current_user.get("full_name", current_user.get("name", "Customer"))
    customer_email = data.customer_email or current_user.get("email", "customer@airyatra.com")
    customer_phone = data.customer_phone or current_user.get("phone", "9999999999")
    
    # Build return URL
    import os
    base_url = os.environ.get("REACT_APP_BACKEND_URL", "https://airyatra-corporate.preview.emergentagent.com")
    return_url = data.return_url or f"{base_url}/payment/cashfree/result?booking_id={data.booking_id}"
    notify_url = f"{base_url}/api/payments/cashfree/webhook"
    
    # Create Cashfree order
    result = await cashfree_service.create_order(
        amount=data.amount,
        booking_id=data.booking_id,
        customer_id=current_user["id"],
        customer_name=customer_name,
        customer_email=customer_email,
        customer_phone=customer_phone,
        return_url=return_url,
        notify_url=notify_url
    )
    
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error", "Failed to create Cashfree order"))
    
    # Store order in database
    order_record = {
        "id": str(uuid.uuid4()),
        "cashfree_order_id": result["order_id"],
        "cf_order_id": result.get("cf_order_id"),
        "payment_session_id": result.get("payment_session_id"),
        "booking_id": data.booking_id,
        "user_id": current_user["id"],
        "amount": data.amount,
        "currency": "INR",
        "status": "created",
        "mode": result.get("mode", "sandbox"),
        "mock_mode": result.get("mock_mode", False),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.cashfree_orders.insert_one(order_record.copy())
    
    return {
        "success": True,
        "order_id": result["order_id"],
        "payment_session_id": result.get("payment_session_id"),
        "amount": data.amount,
        "currency": "INR",
        "mode": result.get("mode"),
        "mock_mode": result.get("mock_mode", False),
        "message": result.get("message")
    }


@router.post("/verify-payment")
async def verify_cashfree_payment(
    data: VerifyPaymentRequest,
    current_user: dict = Depends(get_current_user)
):
    """Verify Cashfree payment status"""
    db = get_database()
    
    # Verify payment with Cashfree
    result = await cashfree_service.verify_payment(data.order_id)
    
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error", "Failed to verify payment"))
    
    # Find order record
    order_record = await db.cashfree_orders.find_one({"cashfree_order_id": data.order_id})
    booking_id = data.booking_id or (order_record.get("booking_id") if order_record else None)
    
    # Update order record
    if order_record:
        await db.cashfree_orders.update_one(
            {"cashfree_order_id": data.order_id},
            {"$set": {
                "status": "paid" if result.get("is_paid") else result.get("order_status", "unknown"),
                "cf_payment_id": result.get("cf_payment_id"),
                "payment_method": result.get("payment_method"),
                "verified_at": datetime.now(timezone.utc).isoformat()
            }}
        )
    
    # Update booking status if paid
    if result.get("is_paid") and booking_id:
        await db.bookings.update_one(
            {"id": booking_id},
            {"$set": {
                "payment_status": "paid",
                "status": "confirmed",
                "payment_method": "cashfree",
                "cashfree_order_id": data.order_id,
                "cf_payment_id": result.get("cf_payment_id"),
                "paid_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        await db.inquiries.update_one(
            {"id": booking_id},
            {"$set": {
                "payment_status": "paid",
                "status": "confirmed",
                "payment_method": "cashfree",
                "cashfree_order_id": data.order_id,
                "paid_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        # Record transaction
        transaction = {
            "id": str(uuid.uuid4()),
            "type": "cashfree_payment",
            "booking_id": booking_id,
            "user_id": current_user["id"],
            "cashfree_order_id": data.order_id,
            "cf_payment_id": result.get("cf_payment_id"),
            "amount": order_record.get("amount") if order_record else 0,
            "currency": "INR",
            "payment_method": result.get("payment_method"),
            "status": "completed",
            "mode": result.get("mode"),
            "mock_mode": result.get("mock_mode", False),
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.transactions.insert_one(transaction.copy())

        from services.invoice_email_service import schedule_invoice_email
        schedule_invoice_email(db, booking_id, "cashfree")
    
    return {
        "success": True,
        "is_paid": result.get("is_paid", False),
        "order_status": result.get("order_status"),
        "cf_payment_id": result.get("cf_payment_id"),
        "payment_method": result.get("payment_method"),
        "booking_id": booking_id,
        "mode": result.get("mode"),
        "mock_mode": result.get("mock_mode", False)
    }


@router.get("/order/{order_id}")
async def get_cashfree_order(
    order_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get Cashfree order details"""
    db = get_database()
    
    # Get from our database
    order_record = await db.cashfree_orders.find_one(
        {"cashfree_order_id": order_id},
        {"_id": 0}
    )
    
    # Get from Cashfree
    cashfree_result = await cashfree_service.get_order(order_id)
    
    return {
        "success": True,
        "order": order_record,
        "cashfree_status": cashfree_result
    }


# ==================== REFUND ENDPOINTS ====================

@router.post("/refund")
async def create_cashfree_refund(
    data: RefundRequest,
    current_user: dict = Depends(require_roles(["admin", "super_admin"]))
):
    """Create a refund for Cashfree payment (Admin)"""
    db = get_database()
    
    # Find order
    order_record = await db.cashfree_orders.find_one({"cashfree_order_id": data.order_id})
    if not order_record:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if order_record.get("status") != "paid":
        raise HTTPException(status_code=400, detail="Only paid orders can be refunded")
    
    if data.refund_amount > order_record.get("amount", 0):
        raise HTTPException(status_code=400, detail="Refund amount exceeds order amount")
    
    # Create refund
    result = await cashfree_service.create_refund(
        order_id=data.order_id,
        refund_amount=data.refund_amount,
        refund_note=data.refund_note
    )
    
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error", "Failed to create refund"))
    
    # Store refund record
    refund_record = {
        "id": str(uuid.uuid4()),
        "refund_id": result.get("refund_id"),
        "cf_refund_id": result.get("cf_refund_id"),
        "order_id": data.order_id,
        "booking_id": data.booking_id or order_record.get("booking_id"),
        "refund_amount": data.refund_amount,
        "refund_note": data.refund_note,
        "refund_status": result.get("refund_status"),
        "created_by": current_user["id"],
        "mode": result.get("mode"),
        "mock_mode": result.get("mock_mode", False),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.cashfree_refunds.insert_one(refund_record.copy())
    
    # Update order status
    await db.cashfree_orders.update_one(
        {"cashfree_order_id": data.order_id},
        {"$set": {"status": "refunded", "refund_amount": data.refund_amount}}
    )
    
    return {
        "success": True,
        "message": "Refund initiated",
        "refund_id": result.get("refund_id"),
        "refund_status": result.get("refund_status"),
        "refund_amount": data.refund_amount,
        "mode": result.get("mode"),
        "mock_mode": result.get("mock_mode", False)
    }


class UPICollectRequest(BaseModel):
    booking_id: str
    upi_id: str


PAYMENT_STAFF = {"admin", "super_admin", "finance", "ceo", "cfo"}


async def _resolve_payable(db, booking_id: str, user: dict):
    """Detect booking type and derive amount server-side. Returns (type, booking, amount, payment_type)"""
    vb = await db.vertical_bookings.find_one({"id": booking_id}, {"_id": 0})
    if vb:
        if vb["customer_id"] != user["id"]:
            raise HTTPException(status_code=403, detail="Not your booking")
        if vb.get("payment_status") == "paid":
            raise HTTPException(status_code=400, detail="Already paid")
        if vb.get("status") != "confirmed":
            raise HTTPException(status_code=400, detail="Booking must be confirmed by owner before payment")
        return "vertical", vb, round(float(vb["amount"]), 2), "full"

    booking = await db.bookings.find_one({"id": booking_id}, {"_id": 0}) or \
              await db.inquiries.find_one({"id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    owner = booking.get("customer_id") or booking.get("user_id")
    if owner != user["id"] and not (PAYMENT_STAFF & set(user.get("roles", []))):
        raise HTTPException(status_code=403, detail="You don't have access to this booking")

    from routes.stripe_payment_routes import _payment_ledger
    total_amount, credited, remaining, _ = await _payment_ledger(db, booking)
    if total_amount <= 0:
        total_amount = float(booking.get("total_amount") or booking.get("amount") or
                             booking.get("quoted_price") or booking.get("estimated_price") or 0)
        remaining = max(0.0, total_amount - credited)
    if total_amount <= 0:
        raise HTTPException(status_code=400, detail="Booking amount not set. Contact support.")
    if remaining <= 0:
        raise HTTPException(status_code=400, detail="Booking already fully paid")

    if booking.get("payment_status") in ["paid", "fully_paid"]:
        amount, payment_type = remaining, "balance"
    else:
        from routes.payment_rules_routes import resolve_payment_rule
        rule = await resolve_payment_rule(db, booking, total_amount)
        pct = rule["advance_percent"]
        if pct == 0:
            amount = remaining
        else:
            advance_needed = float(int(total_amount * pct / 100))
            amount = max(1.0, min(remaining, max(1.0, advance_needed - credited)))
        payment_type = "advance"
    return "aviation", booking, round(float(amount), 2), payment_type


async def _finalize_cashfree_payment(db, order_record, cf_payment_id, payment_method, source="webhook"):
    """Idempotent completion: booking confirm + ledger + settlement + invoice + audit"""
    order_id = order_record["cashfree_order_id"]
    now_iso = datetime.now(timezone.utc).isoformat()
    res = await db.cashfree_orders.update_one(
        {"cashfree_order_id": order_id, "status": {"$ne": "paid"}},
        {"$set": {"status": "paid", "cf_payment_id": str(cf_payment_id or ""),
                  "payment_method": payment_method, "paid_source": source, "paid_at": now_iso}})
    if res.modified_count == 0:
        return {"already_paid": True}

    booking_id = order_record.get("booking_id")
    amount = float(order_record.get("amount") or 0)

    if order_record.get("booking_type") == "vertical":
        booking = await db.vertical_bookings.find_one({"id": booking_id}, {"_id": 0})
        if booking and booking.get("payment_status") != "paid":
            from routes.vertical_routes import _complete_vertical_payment
            await _complete_vertical_payment(db, booking, order_id, str(cf_payment_id or ""),
                                             mock=order_record.get("mock_mode", False))
    else:
        existing = await db.payment_transactions.find_one({"session_id": order_id, "payment_status": "paid"})
        if not existing:
            await db.payment_transactions.insert_one({
                "id": str(uuid.uuid4()), "session_id": order_id, "booking_id": booking_id,
                "customer_id": order_record.get("user_id"),
                "payment_type": order_record.get("payment_type", "advance"),
                "amount": amount, "currency": "inr", "gateway": "cashfree",
                "cf_payment_id": str(cf_payment_id or ""), "status": "completed",
                "payment_status": "paid", "created_at": now_iso, "updated_at": now_iso})
        booking = await db.inquiries.find_one({"id": booking_id}, {"_id": 0}) or \
                  await db.bookings.find_one({"id": booking_id}, {"_id": 0})
        if booking:
            from routes.stripe_payment_routes import _payment_ledger
            _, _, remaining_after, _ = await _payment_ledger(db, booking)
            update = {"payment_status": "fully_paid" if remaining_after <= 0 else "paid",
                      "cf_payment_id": str(cf_payment_id or ""), "payment_method": "cashfree_upi",
                      "paid_at": now_iso, "updated_at": now_iso}
            if booking.get("status") in ["payment_pending", "quote_accepted", "pending_acceptance"]:
                update["status"] = "confirmed"
            await db.inquiries.update_one({"id": booking_id}, {"$set": update})
            await db.bookings.update_one({"id": booking_id}, {"$set": update})
            from services.invoice_email_service import schedule_invoice_email
            schedule_invoice_email(db, booking_id, "cashfree")

    await db.notifications.insert_one({
        "type": "payment", "title": f"Cashfree UPI Payment Received - {order_id}",
        "message": f"₹{amount:,.2f} UPI collect payment received via Cashfree",
        "priority": "normal",
        "metadata": {"order_id": order_id, "cf_payment_id": str(cf_payment_id or ""), "amount": amount},
        "is_read": False, "is_archived": False, "created_at": datetime.now(timezone.utc)})
    try:
        from routes.audit_trail_routes import audit_event
        user = await db.users.find_one({"id": order_record.get("user_id")}, {"_id": 0}) or {}
        await audit_event(db, "cashfree_payment_success", user,
                          details={"booking_id": booking_id, "order_id": order_id, "amount": amount,
                                   "gateway": "cashfree", "cf_payment_id": str(cf_payment_id or ""),
                                   "payment_method": payment_method, "upi_id": order_record.get("upi_id"),
                                   "source": source, "mode": order_record.get("mode")},
                          resource_type="payment", resource_id=order_id, risk_level="medium")
    except Exception:
        pass
    return {"finalized": True}


@router.post("/upi-collect")
async def initiate_upi_collect(data: UPICollectRequest, request: Request,
                               current_user: dict = Depends(get_current_user)):
    """Send a real UPI Collect request to a VPA — approval popup appears in GPay/PhonePe"""
    db = get_database()
    upi = data.upi_id.strip()
    if "@" not in upi or " " in upi:
        raise HTTPException(status_code=400, detail="Invalid UPI ID (format: name@bank)")

    btype, booking, amount, payment_type = await _resolve_payable(db, data.booking_id, current_user)

    import os
    base_url = (os.environ.get("REACT_APP_BACKEND_URL") or os.environ.get("FRONTEND_URL", "")).strip('"')
    result = await cashfree_service.create_order(
        amount=amount, booking_id=data.booking_id, customer_id=current_user["id"],
        customer_name=current_user.get("full_name") or current_user.get("name") or "Customer",
        customer_email=current_user.get("email", "customer@airyatra.co.in"),
        customer_phone=current_user.get("phone") or "9999999999",
        return_url=f"{base_url}/payment/cashfree/result?booking_id={data.booking_id}",
        notify_url=f"{base_url}/api/payments/cashfree/webhook")
    if not result.get("success"):
        raise HTTPException(status_code=502, detail=f"Cashfree order failed: {str(result.get('error', ''))[:300]}")

    order_id = result["order_id"]
    collect_mode = "direct_collect"
    collect = await cashfree_service.pay_upi_collect(result.get("payment_session_id"), upi)
    if not collect.get("success"):
        err = str(collect.get("error", ""))
        if "s2s" in err.lower() or "feature_not_enabled" in err.lower():
            # Direct collect API not enabled on merchant account — hosted checkout fallback
            collect_mode = "hosted_checkout"
            collect = {"success": True, "cf_payment_id": ""}
        else:
            raise HTTPException(status_code=502, detail=f"UPI collect failed: {err[:300]}")

    await db.cashfree_orders.insert_one({
        "id": str(uuid.uuid4()), "cashfree_order_id": order_id,
        "cf_order_id": result.get("cf_order_id"), "payment_session_id": result.get("payment_session_id"),
        "booking_id": data.booking_id, "booking_type": btype, "user_id": current_user["id"],
        "amount": amount, "payment_type": payment_type, "currency": "INR", "upi_id": upi,
        "cf_payment_id": str(collect.get("cf_payment_id") or ""), "channel": "upi_collect",
        "collect_mode": collect_mode,
        "status": "collect_requested", "mode": result.get("mode", cashfree_service.mode),
        "mock_mode": result.get("mock_mode", False),
        "created_at": datetime.now(timezone.utc).isoformat()})
    try:
        from routes.audit_trail_routes import audit_event
        await audit_event(db, "cashfree_upi_collect_initiated", current_user,
                          details={"booking_id": data.booking_id, "order_id": order_id, "amount": amount,
                                   "upi_id": upi, "gateway": "cashfree", "booking_type": btype,
                                   "mode": result.get("mode", cashfree_service.mode)},
                          resource_type="payment", resource_id=order_id, risk_level="medium",
                          ip=request.client.host if request.client else None)
    except Exception:
        pass
    return {"success": True, "order_id": order_id, "amount": amount, "payment_type": payment_type,
            "mode": result.get("mode", cashfree_service.mode), "mock_mode": result.get("mock_mode", False),
            "collect_mode": collect_mode,
            "payment_session_id": result.get("payment_session_id") if collect_mode == "hosted_checkout" else None,
            "message": (f"₹{amount:g} collect request sent to {upi} — approve it in your UPI app (GPay)"
                        if collect_mode == "direct_collect"
                        else f"Cashfree secure checkout khul raha hai — UPI select karke {upi} daaliye, GPay me approve karein")}


@router.get("/collect-status/{order_id}")
async def collect_status(order_id: str, current_user: dict = Depends(get_current_user)):
    """Poll UPI collect status — finalizes booking on SUCCESS (idempotent)"""
    db = get_database()
    rec = await db.cashfree_orders.find_one({"cashfree_order_id": order_id}, {"_id": 0})
    if not rec:
        raise HTTPException(status_code=404, detail="Order not found")
    if rec.get("user_id") != current_user["id"] and not (PAYMENT_STAFF & set(current_user.get("roles", []))):
        raise HTTPException(status_code=403, detail="Not authorized")
    if rec.get("status") == "paid":
        return {"status": "SUCCESS", "order_id": order_id, "amount": rec.get("amount"),
                "cf_payment_id": rec.get("cf_payment_id"), "already_paid": True}
    if rec.get("status") == "failed":
        return {"status": "FAILED", "order_id": order_id}

    result = await cashfree_service.verify_payment(order_id)
    if result.get("success") and result.get("is_paid"):
        await _finalize_cashfree_payment(db, rec, result.get("cf_payment_id"),
                                         result.get("payment_method"), source="poll")
        return {"status": "SUCCESS", "order_id": order_id, "amount": rec.get("amount"),
                "cf_payment_id": result.get("cf_payment_id")}
    order_status = result.get("order_status") or "ACTIVE"
    if order_status in ("EXPIRED", "TERMINATED", "TERMINATION_REQUESTED"):
        await db.cashfree_orders.update_one(
            {"cashfree_order_id": order_id, "status": {"$ne": "paid"}},
            {"$set": {"status": "failed"}})
        return {"status": "FAILED", "order_status": order_status, "order_id": order_id}
    return {"status": "PENDING", "order_status": order_status, "order_id": order_id}


# ==================== TEST PRICING (₹1-₹50 gateway test) ====================

TEST_PRICES_VERTICAL = {"yacht": 15, "cruise": 20, "helipad": 40}
TEST_PRICES_AIRCRAFT = {"helicopter": 5, "chartered_plane": 10, "private_jet": 10,
                        "air_ambulance": 25, "cargo": 30, "joy_ride": 35, "scenic": 35}


@router.post("/test-pricing/apply")
async def apply_test_pricing(request: Request,
                             current_user: dict = Depends(require_roles(["admin", "super_admin"]))):
    """Temporarily set all operator pricing to ₹1-₹50 for live gateway testing (backup taken)"""
    db = get_database()
    if await db.test_pricing_backup.find_one({"active": True}):
        raise HTTPException(status_code=400, detail="Test pricing already active — restore original pricing first")
    assets = await db.vertical_assets.find({}, {"_id": 0, "id": 1, "vertical": 1, "base_price": 1}).to_list(500)
    aircraft = await db.aircraft.find({}, {"_id": 0, "id": 1, "aircraft_type": 1, "hourly_rate": 1}).to_list(500)
    await db.test_pricing_backup.insert_one({
        "id": str(uuid.uuid4()), "active": True, "vertical_assets": assets, "aircraft": aircraft,
        "created_by": current_user.get("email"), "created_at": datetime.now(timezone.utc).isoformat()})
    for v, price in TEST_PRICES_VERTICAL.items():
        await db.vertical_assets.update_many({"vertical": v}, {"$set": {"base_price": price}})
    for t, rate in TEST_PRICES_AIRCRAFT.items():
        await db.aircraft.update_many({"aircraft_type": t}, {"$set": {"hourly_rate": float(rate)}})
    await db.aircraft.update_many({"hourly_rate": {"$gt": 50}}, {"$set": {"hourly_rate": 5.0}})
    try:
        from routes.audit_trail_routes import audit_event
        await audit_event(db, "test_pricing_applied", current_user,
                          details={"vertical_prices": TEST_PRICES_VERTICAL, "aircraft_prices": TEST_PRICES_AIRCRAFT},
                          resource_type="pricing", risk_level="high",
                          ip=request.client.host if request.client else None)
    except Exception:
        pass
    return {"message": "Test pricing applied: Helicopter ₹5/hr, Jet ₹10/hr, Yacht ₹15, Cruise ₹20, "
                       "Air Ambulance ₹25/hr, Cargo ₹30/hr, Scenic ₹35/hr, Helipad ₹40. "
                       "Restore original pricing after the gateway test!",
            "backup_taken": True}


@router.post("/test-pricing/restore")
async def restore_test_pricing(request: Request,
                               current_user: dict = Depends(require_roles(["admin", "super_admin"]))):
    """Restore original operator pricing from backup"""
    db = get_database()
    backup = await db.test_pricing_backup.find_one({"active": True})
    if not backup:
        raise HTTPException(status_code=404, detail="No active test pricing backup found")
    for a in backup.get("vertical_assets", []):
        if a.get("id") is not None:
            await db.vertical_assets.update_one({"id": a["id"]}, {"$set": {"base_price": a.get("base_price")}})
    for a in backup.get("aircraft", []):
        if a.get("id") is not None:
            await db.aircraft.update_one({"id": a["id"]}, {"$set": {"hourly_rate": a.get("hourly_rate")}})
    await db.test_pricing_backup.update_one(
        {"id": backup["id"]},
        {"$set": {"active": False, "restored_at": datetime.now(timezone.utc).isoformat(),
                  "restored_by": current_user.get("email")}})
    try:
        from routes.audit_trail_routes import audit_event
        await audit_event(db, "test_pricing_restored", current_user,
                          details={"backup_id": backup["id"]}, resource_type="pricing", risk_level="high",
                          ip=request.client.host if request.client else None)
    except Exception:
        pass
    return {"message": "Original pricing restored successfully"}


# ==================== WEBHOOK ENDPOINT ====================

@router.post("/webhook")
async def cashfree_webhook(request: Request):
    """Handle Cashfree webhook events — signature enforced, duplicate-protected"""
    db = get_database()

    raw_body = await request.body()
    signature = request.headers.get("x-webhook-signature", "")
    timestamp = request.headers.get("x-webhook-timestamp", "")

    if cashfree_service.is_configured() and not cashfree_service.verify_webhook(raw_body, timestamp, signature):
        logger.warning("Cashfree webhook: INVALID signature — rejected")
        raise HTTPException(status_code=401, detail="Invalid webhook signature")

    try:
        event = json.loads(raw_body)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    event_type = event.get("type", "")
    data = event.get("data", {})
    order_data = data.get("order", {})
    payment_data = data.get("payment", {})
    order_id = order_data.get("order_id")
    cf_payment_id = str(payment_data.get("cf_payment_id") or "")

    # Duplicate webhook protection
    event_key = f"{event_type}:{order_id}:{cf_payment_id}"
    if await db.cashfree_webhook_events.find_one({"event_key": event_key}):
        logger.info(f"Cashfree webhook duplicate skipped: {event_key}")
        return {"status": "received", "duplicate": True}
    await db.cashfree_webhook_events.insert_one({
        "event_key": event_key, "received_at": datetime.now(timezone.utc).isoformat()})

    logger.info(f"Cashfree webhook: {event_type} for order {order_id}")
    await db.cashfree_webhooks.insert_one({
        "id": str(uuid.uuid4()), "event_type": event_type, "order_id": order_id,
        "payload": event, "signature_verified": cashfree_service.is_configured(),
        "received_at": datetime.now(timezone.utc).isoformat()})

    try:
        if event_type in ("PAYMENT_SUCCESS", "PAYMENT_SUCCESS_WEBHOOK"):
            rec = await db.cashfree_orders.find_one({"cashfree_order_id": order_id}, {"_id": 0})
            if rec:
                await _finalize_cashfree_payment(db, rec, cf_payment_id,
                                                 payment_data.get("payment_method"), source="webhook")
            else:
                await db.cashfree_orders.update_one(
                    {"cashfree_order_id": order_id},
                    {"$set": {"status": "paid", "cf_payment_id": cf_payment_id,
                              "webhook_received": True,
                              "paid_at": datetime.now(timezone.utc).isoformat()}})

        elif event_type in ("PAYMENT_FAILED", "PAYMENT_FAILED_WEBHOOK", "PAYMENT_USER_DROPPED_WEBHOOK"):
            await db.cashfree_orders.update_one(
                {"cashfree_order_id": order_id, "status": {"$ne": "paid"}},
                {"$set": {"status": "failed", "webhook_received": True}})

        elif event_type in ("REFUND_SUCCESS", "PAYMENT_REFUND_SUCCESS"):
            await db.cashfree_refunds.update_one(
                {"order_id": order_id},
                {"$set": {"refund_status": "SUCCESS", "webhook_received": True}})

        return {"status": "received", "event_type": event_type}

    except Exception as e:
        logger.error(f"Cashfree webhook processing error: {e}")
        return {"status": "error", "message": str(e)}


# ==================== ADMIN ENDPOINTS ====================

@router.get("/admin/orders")
async def list_cashfree_orders(
    status: Optional[str] = None,
    limit: int = Query(50, le=200),
    current_user: dict = Depends(require_roles(["admin", "super_admin"]))
):
    """List all Cashfree orders (Admin)"""
    db = get_database()
    
    query = {}
    if status:
        query["status"] = status
    
    orders = await db.cashfree_orders.find(query, {"_id": 0}).sort("created_at", -1).to_list(limit)
    
    total = await db.cashfree_orders.count_documents({})
    paid = await db.cashfree_orders.count_documents({"status": "paid"})
    
    return {
        "success": True,
        "orders": orders,
        "stats": {"total": total, "paid": paid}
    }


@router.get("/admin/refunds")
async def list_cashfree_refunds(
    limit: int = Query(50, le=200),
    current_user: dict = Depends(require_roles(["admin", "super_admin"]))
):
    """List all Cashfree refunds (Admin)"""
    db = get_database()
    
    refunds = await db.cashfree_refunds.find({}, {"_id": 0}).sort("created_at", -1).to_list(limit)
    
    total_refunded = sum(r.get("refund_amount", 0) for r in refunds)
    
    return {
        "success": True,
        "refunds": refunds,
        "stats": {"count": len(refunds), "total_refunded": total_refunded}
    }
