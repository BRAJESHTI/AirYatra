"""
Stripe Payments (test mode via emergentintegrations) — booking checkout, status polling, webhook
"""
from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
from uuid import uuid4
import os
from database import get_database
from middleware import get_current_user
from emergentintegrations.payments.stripe.checkout import StripeCheckout, CheckoutSessionRequest

router = APIRouter(tags=["Stripe Payments"])


def _get_stripe(request: Request) -> StripeCheckout:
    host_url = str(request.base_url)
    return StripeCheckout(api_key=os.environ["STRIPE_API_KEY"], webhook_url=f"{host_url}api/webhook/stripe")


class StripeCheckoutRequest(BaseModel):
    booking_id: str
    voucher_code: Optional[str] = None
    origin_url: str


@router.post("/payments/stripe/checkout")
async def create_stripe_checkout(
    body: StripeCheckoutRequest,
    request: Request,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """Create Stripe hosted checkout session — amount computed SERVER-side (advance % of quote)"""
    inquiry = await db.inquiries.find_one({"id": body.booking_id}, {"_id": 0})
    is_inquiry = bool(inquiry)
    booking = inquiry or await db.bookings.find_one({"id": body.booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking/Inquiry not found")
    if booking.get("customer_id") != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    if booking.get("payment_status") == "paid":
        raise HTTPException(status_code=400, detail="Already paid / भुगतान पहले हो चुका है")

    # Server-side amount: advance % of accepted quote (same rules as payment-info)
    total_amount = float(booking.get("accepted_quote", {}).get("amount") or booking.get("estimated_price") or 0)
    if total_amount <= 0:
        raise HTTPException(status_code=400, detail="No payable amount on this booking")
    advance_percent = 50
    settings = await db.payment_rules_settings.find_one({"type": "payment_rules"}, {"_id": 0})
    if settings:
        for rule in settings.get("payment_rules", []):
            if rule.get("purpose") == booking.get("booking_purpose", "other"):
                advance_percent = rule.get("advance_percent", 50)
                break
    amount = float(int(total_amount * advance_percent / 100))

    # Loyalty voucher discount
    discount = 0.0
    voucher = None
    if body.voucher_code:
        from routes.loyalty_routes import validate_voucher_for_user
        voucher, error = await validate_voucher_for_user(db, current_user["id"], body.voucher_code)
        if error:
            raise HTTPException(status_code=400, detail=error)
        discount = min(float(voucher["value"]), amount)
    final_amount = max(1.0, amount - discount)

    stripe_checkout = _get_stripe(request)
    session_req = CheckoutSessionRequest(
        amount=final_amount,
        currency="inr",
        success_url=f"{body.origin_url}/payment/success?session_id={{CHECKOUT_SESSION_ID}}",
        cancel_url=f"{body.origin_url}/customer/payment/{body.booking_id}",
        metadata={
            "booking_id": body.booking_id,
            "customer_id": current_user["id"],
            "is_inquiry": str(is_inquiry),
            "voucher_code": voucher["code"] if voucher else "",
        },
    )
    session = await stripe_checkout.create_checkout_session(session_req)

    await db.payment_transactions.insert_one({
        "id": str(uuid4()),
        "session_id": session.session_id,
        "booking_id": body.booking_id,
        "is_inquiry": is_inquiry,
        "customer_id": current_user["id"],
        "amount": final_amount,
        "original_amount": amount,
        "advance_percent": advance_percent,
        "total_amount": total_amount,
        "voucher_code": voucher["code"] if voucher else None,
        "voucher_discount": discount,
        "currency": "inr",
        "gateway": "stripe_test",
        "status": "initiated",
        "payment_status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    })

    return {"checkout_url": session.url, "session_id": session.session_id,
            "amount": final_amount, "discount": discount, "advance_percent": advance_percent}


async def _apply_payment_success(db, txn: dict):
    """Idempotent booking confirmation after paid (DB updated by caller first)"""
    now = datetime.now(timezone.utc).isoformat()
    update_data = {
        "payment_status": "paid",
        "payment_session_id": txn["session_id"],
        "payment_gateway": "stripe_test",
        "paid_at": now,
        "status": "confirmed",
        "updated_at": now,
    }
    result = await db.inquiries.update_one({"id": txn["booking_id"]}, {"$set": update_data})
    if result.matched_count == 0:
        await db.bookings.update_one({"id": txn["booking_id"]}, {"$set": update_data})
        booking = await db.bookings.find_one({"id": txn["booking_id"]}, {"_id": 0})
    else:
        booking = await db.inquiries.find_one({"id": txn["booking_id"]}, {"_id": 0})

    if txn.get("voucher_code"):
        await db.reward_redemptions.update_one(
            {"code": txn["voucher_code"], "status": "active"},
            {"$set": {"status": "used", "used_at": now, "used_for_booking": txn["booking_id"]}}
        )

    if booking:
        try:
            customer = await db.users.find_one({"id": txn["customer_id"]}, {"_id": 0, "email": 1, "phone": 1})
            from services.notification_service import notification_service
            await notification_service.send_booking_confirmation(
                booking=booking,
                customer_email=(customer or {}).get("email"),
                customer_phone=(customer or {}).get("phone"),
            )
        except Exception as e:
            print(f"Booking confirmation notification failed: {e}")


async def _mark_paid_if_needed(db, session_id: str) -> dict:
    """Idempotent guard: flip txn to paid + confirm booking exactly once"""
    result = await db.payment_transactions.find_one_and_update(
        {"session_id": session_id, "payment_status": {"$ne": "paid"}},
        {"$set": {"status": "completed", "payment_status": "paid", "updated_at": datetime.now(timezone.utc).isoformat()}},
    )
    if result:
        txn = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
        await _apply_payment_success(db, txn)
    return await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})


@router.get("/payments/stripe/status/{session_id}")
async def stripe_payment_status(session_id: str, request: Request, db=Depends(get_database)):
    """Poll payment status (unauthenticated — minimal fields only)"""
    txn = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")
    if txn.get("payment_status") != "paid":
        try:
            stripe_checkout = _get_stripe(request)
            status = await stripe_checkout.get_checkout_status(session_id)
            if status.payment_status == "paid" or status.status == "complete":
                txn = await _mark_paid_if_needed(db, session_id)
            elif status.status == "expired":
                await db.payment_transactions.update_one(
                    {"session_id": session_id, "payment_status": {"$ne": "paid"}},
                    {"$set": {"status": "expired", "payment_status": "expired", "updated_at": datetime.now(timezone.utc).isoformat()}},
                )
                txn = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
        except Exception:
            pass
    return {
        "session_id": txn["session_id"],
        "status": txn.get("status"),
        "payment_status": txn.get("payment_status"),
        "booking_id": txn.get("booking_id"),
        "amount": txn.get("amount"),
    }


@router.post("/webhook/stripe")
async def stripe_webhook(request: Request, db=Depends(get_database)):
    """Stripe webhook — idempotent"""
    body = await request.body()
    signature = request.headers.get("Stripe-Signature")
    try:
        stripe_checkout = _get_stripe(request)
        webhook_response = await stripe_checkout.handle_webhook(body, signature)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Webhook error: {e}")
    if webhook_response.event_type == "checkout.session.completed" and webhook_response.payment_status == "paid":
        await _mark_paid_if_needed(db, webhook_response.session_id)
    return {"status": "ok"}
