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
    payment_type: Optional[str] = "advance"


# ==================== PUBLIC PAYMENT LINK ROUTES ====================

@router.get("/payments/link/{token}")
async def verify_payment_link(
    token: str,
    db=Depends(get_database)
):
    """Public endpoint to verify a payment link token and get booking details"""
    # Find the payment link
    payment_link = await db.payment_links.find_one(
        {"token": token, "status": "active"},
        {"_id": 0}
    )
    
    if not payment_link:
        raise HTTPException(status_code=404, detail="Payment link not found or expired")
    
    # Check expiry
    expires_at = payment_link.get("expires_at", "")
    if expires_at and expires_at < datetime.now(timezone.utc).isoformat():
        await db.payment_links.update_one(
            {"token": token},
            {"$set": {"status": "expired"}}
        )
        raise HTTPException(status_code=410, detail="Payment link has expired")
    
    # Get booking details
    booking = await db.inquiries.find_one(
        {"id": payment_link.get("booking_id")},
        {"_id": 0}
    )
    if not booking:
        booking = await db.bookings.find_one(
            {"id": payment_link.get("booking_id")},
            {"_id": 0}
        )
    
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    # Check if already fully paid
    if booking.get("payment_status") == "fully_paid":
        return {
            "valid": False,
            "already_paid": True,
            "message": "This booking is already fully paid",
            "booking_id": payment_link.get("booking_id"),
        }
    
    # Calculate actual remaining balance
    total_amount, credited, remaining, _ = await _payment_ledger(db, booking)
    
    if remaining <= 0:
        return {
            "valid": False,
            "already_paid": True,
            "message": "No balance remaining",
            "booking_id": payment_link.get("booking_id"),
        }
    
    # Get customer info
    customer = await db.users.find_one(
        {"id": booking.get("customer_id")},
        {"_id": 0, "full_name": 1, "email": 1}
    )
    
    return {
        "valid": True,
        "token": token,
        "booking_id": payment_link.get("booking_id"),
        "inquiry_number": booking.get("inquiry_number", payment_link.get("booking_id", "")[:8]),
        "customer_name": (customer or {}).get("full_name", booking.get("customer_name", "Customer")),
        "customer_email": (customer or {}).get("email", booking.get("customer_email", "")),
        "route": f"{booking.get('from_location', '')} → {booking.get('to_location', '')}",
        "departure_date": booking.get("departure_date", ""),
        "total_amount": total_amount,
        "already_paid": credited,
        "remaining_balance": remaining,
        "expires_at": payment_link.get("expires_at"),
    }


@router.post("/payments/link/{token}/checkout")
async def create_payment_link_checkout(
    token: str,
    request: Request,
    db=Depends(get_database)
):
    """Public endpoint to create Stripe checkout from payment link (no auth required)"""
    # Verify payment link
    payment_link = await db.payment_links.find_one(
        {"token": token, "status": "active"},
        {"_id": 0}
    )
    
    if not payment_link:
        raise HTTPException(status_code=404, detail="Payment link not found or expired")
    
    # Check expiry
    expires_at = payment_link.get("expires_at", "")
    if expires_at and expires_at < datetime.now(timezone.utc).isoformat():
        await db.payment_links.update_one({"token": token}, {"$set": {"status": "expired"}})
        raise HTTPException(status_code=410, detail="Payment link has expired")
    
    booking_id = payment_link.get("booking_id")
    customer_id = payment_link.get("customer_id")
    
    # Get booking
    booking = await db.inquiries.find_one({"id": booking_id}, {"_id": 0})
    if not booking:
        booking = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    # Check payment status
    if booking.get("payment_status") == "fully_paid":
        raise HTTPException(status_code=400, detail="Already fully paid")
    
    # Calculate remaining
    total_amount, credited, remaining, _ = await _payment_ledger(db, booking)
    if remaining <= 0:
        raise HTTPException(status_code=400, detail="No balance remaining")
    
    # Create Stripe checkout session
    stripe = _get_stripe(request)
    origin_url = str(request.base_url).rstrip("/")
    
    inquiry_number = booking.get("inquiry_number", booking_id[:8])
    route = f"{booking.get('from_location', '')} → {booking.get('to_location', '')}"
    
    session_req = CheckoutSessionRequest(
        line_items=[{
            "price_data": {
                "currency": "inr",
                "product_data": {
                    "name": f"AirYatra Balance Payment - #{inquiry_number}",
                    "description": f"Remaining balance for {route}",
                },
                "unit_amount": int(remaining * 100),
            },
            "quantity": 1,
        }],
        success_url=f"{origin_url}/payment-success?session_id={{CHECKOUT_SESSION_ID}}&token={token}",
        cancel_url=f"{origin_url}/pay/{token}?cancelled=true",
        mode="payment",
        metadata={
            "booking_id": booking_id,
            "customer_id": customer_id,
            "payment_type": "balance",
            "payment_link_token": token,
        },
    )
    session = stripe.create_session(session_req)
    
    # Record transaction
    txn_id = str(uuid4())
    now_iso = datetime.now(timezone.utc).isoformat()
    await db.payment_transactions.insert_one({
        "id": txn_id,
        "booking_id": booking_id,
        "customer_id": customer_id,
        "session_id": session.id,
        "payment_type": "balance",
        "amount": remaining,
        "voucher_discount": 0,
        "currency": "INR",
        "gateway": "stripe_test",
        "payment_status": "pending",
        "payment_link_token": token,
        "created_at": now_iso,
        "updated_at": now_iso,
    })
    
    # Mark payment link as used
    await db.payment_links.update_one(
        {"token": token},
        {"$set": {"status": "checkout_initiated", "checkout_session_id": session.id, "checkout_at": now_iso}}
    )
    
    return {
        "checkout_url": session.url,
        "session_id": session.id,
        "amount": remaining,
    }


# ==================== END PUBLIC ROUTES ====================


async def _payment_ledger(db, booking: dict):
    """Total owed vs paid (voucher discounts credited as paid value)"""
    total_amount = float((booking.get("accepted_quote") or {}).get("amount") or booking.get("estimated_price") or 0)
    txns = await db.payment_transactions.find(
        {"booking_id": booking["id"], "payment_status": "paid"}, {"_id": 0}
    ).sort("created_at", 1).to_list(50)
    credited = sum(float(t.get("amount", 0)) + float(t.get("voucher_discount", 0)) for t in txns)
    remaining = max(0.0, round(total_amount - credited, 2))
    return total_amount, credited, remaining, txns


class WalletApplyRequest(BaseModel):
    booking_id: str


@router.get("/payments/summary/{booking_id}")
async def payment_summary(booking_id: str, current_user: dict = Depends(get_current_user),
                          db=Depends(get_database)):
    """Payment ledger for a booking: total, paid, remaining balance (for 'Pay Balance' UI)"""
    booking = await db.inquiries.find_one({"id": booking_id}, {"_id": 0}) or \
              await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    btype = "aviation"
    if not booking:
        booking = await db.vertical_bookings.find_one({"id": booking_id}, {"_id": 0})
        btype = "vertical"
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    owner = booking.get("customer_id") or booking.get("user_id")
    staff = {"admin", "super_admin", "finance", "ceo", "cfo"} & set(current_user.get("roles", []))
    if owner != current_user["id"] and not staff:
        raise HTTPException(status_code=403, detail="Not your booking")

    if btype == "vertical":
        total = float(booking.get("amount") or 0)
        credited = total if booking.get("payment_status") == "paid" else 0.0
        remaining = round(total - credited, 2)
    else:
        total, credited, remaining, _ = await _payment_ledger(db, booking)
    return {"booking_id": booking_id, "booking_type": btype,
            "total_amount": round(total, 2), "paid_amount": round(credited, 2),
            "remaining_amount": round(remaining, 2), "is_fully_paid": remaining <= 0,
            "currency": "INR"}


@router.get("/payments/gateways")
async def list_payment_gateways(current_user: dict = Depends(get_current_user), db=Depends(get_database)):
    """Available payment gateways + user's wallet/reward balance"""
    wallet = await db.wallets.find_one({"user_id": current_user["id"]}, {"_id": 0}) or {}
    return {"gateways": [
        {"id": "razorpay", "name": "Razorpay", "description": "UPI, Cards, NetBanking, Wallets, EMI",
         "enabled": bool(os.environ.get("RAZORPAY_KEY_ID")), "badge": "Recommended",
         "methods": ["upi", "card", "netbanking", "wallet", "emi"]},
        {"id": "stripe", "name": "Stripe", "description": "International & Indian Cards",
         "enabled": True, "badge": "Test Mode", "methods": ["card"]},
        {"id": "cashfree", "name": "Cashfree UPI Collect", "description": "UPI Collect Request — approval popup in GPay/PhonePe",
         "enabled": bool(os.environ.get("CASHFREE_CLIENT_ID")), "badge": "LIVE" if os.environ.get("CASHFREE_MODE") == "production" else None,
         "methods": ["upi"]},
        {"id": "paypal", "name": "PayPal", "description": "International payments",
         "enabled": bool(os.environ.get("PAYPAL_CLIENT_ID")), "badge": None, "methods": ["paypal"]},
        {"id": "wallet", "name": "Credit / Reward Points", "description": "Use your AirYatra wallet & reward balance",
         "enabled": True, "badge": None, "balance": wallet.get("balance", 0), "methods": ["wallet"]},
    ]}


@router.post("/payments/wallet/apply")
async def apply_wallet_payment(body: WalletApplyRequest, current_user: dict = Depends(get_current_user),
                               db=Depends(get_database)):
    """Pay with wallet/reward balance - credits the booking payment ledger"""
    booking = await db.inquiries.find_one({"id": body.booking_id}, {"_id": 0}) or \
              await db.bookings.find_one({"id": body.booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if booking.get("customer_id") != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")

    total_amount, credited, remaining, _ = await _payment_ledger(db, booking)
    if total_amount <= 0:
        raise HTTPException(status_code=400, detail="No payable amount on this booking")
    if remaining <= 0:
        raise HTTPException(status_code=400, detail="Booking already fully paid")

    wallet = await db.wallets.find_one({"user_id": current_user["id"]}, {"_id": 0})
    balance = float((wallet or {}).get("balance", 0))
    if balance <= 0:
        raise HTTPException(status_code=400, detail="No wallet/reward balance available")

    amount = round(min(balance, remaining), 2)
    now = datetime.now(timezone.utc).isoformat()

    new_balance = round(balance - amount, 2)
    debit_result = await db.wallets.update_one(
        {"user_id": current_user["id"], "balance": {"$gte": amount}},
        {"$inc": {"balance": -amount, "total_used": amount}}
    )
    if debit_result.modified_count == 0:
        raise HTTPException(status_code=409, detail="Wallet balance changed, please retry")
    await db.wallet_transactions.insert_one({
        "id": str(uuid4()),
        "user_id": current_user["id"],
        "type": "debit",
        "amount": amount,
        "balance_after": new_balance,
        "reason": f"Payment for booking {body.booking_id}",
        "booking_id": body.booking_id,
        "created_at": now,
    })
    await db.payment_transactions.insert_one({
        "id": str(uuid4()),
        "session_id": f"wallet_{uuid4().hex[:12]}",
        "booking_id": body.booking_id,
        "customer_id": current_user["id"],
        "payment_type": "wallet",
        "amount": amount,
        "total_amount": total_amount,
        "currency": "inr",
        "gateway": "wallet",
        "status": "completed",
        "payment_status": "paid",
        "created_at": now,
        "updated_at": now,
    })

    credited_after = credited + amount
    remaining_after = max(0.0, round(total_amount - credited_after, 2))

    from routes.payment_rules_routes import resolve_payment_rule
    rule = await resolve_payment_rule(db, booking, total_amount)
    advance_percent = rule["advance_percent"]
    advance_needed = float(int(total_amount * advance_percent / 100))

    update = {"updated_at": now}
    if remaining_after <= 0:
        update["payment_status"] = "fully_paid"
        update["status"] = "confirmed"
    elif credited_after >= advance_needed:
        update["payment_status"] = "paid"
        if booking.get("status") in ["payment_pending", "quote_accepted", "pending_acceptance"]:
            update["status"] = "confirmed"
    await db.inquiries.update_one({"id": body.booking_id}, {"$set": update})
    await db.bookings.update_one({"id": body.booking_id}, {"$set": update})

    if "payment_status" in update:
        from services.invoice_email_service import schedule_invoice_email
        schedule_invoice_email(db, body.booking_id, "wallet")

    return {
        "success": True,
        "applied": amount,
        "new_wallet_balance": new_balance,
        "remaining_due": remaining_after,
        "fully_paid": remaining_after <= 0,
        "advance_covered": credited_after >= advance_needed,
        "message": f"Rs.{amount:,.0f} paid from wallet/reward balance",
    }


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

    payment_type = "balance" if body.payment_type == "balance" else "advance"
    total_amount, credited, remaining, _ = await _payment_ledger(db, booking)
    if total_amount <= 0:
        raise HTTPException(status_code=400, detail="No payable amount on this booking")

    if payment_type == "balance":
        if booking.get("payment_status") not in ["paid", "fully_paid"]:
            raise HTTPException(status_code=400, detail="Advance payment pending — pehle advance bharein")
        if remaining <= 0:
            raise HTTPException(status_code=400, detail="Already fully paid")
        amount = remaining
        advance_percent = None
    else:
        if booking.get("payment_status") in ["paid", "fully_paid"]:
            raise HTTPException(status_code=400, detail="Already paid")
        from routes.payment_rules_routes import resolve_payment_rule
        rule = await resolve_payment_rule(db, booking, total_amount)
        advance_percent = rule["advance_percent"]
        amount = remaining if advance_percent == 0 else float(int(total_amount * advance_percent / 100))

    # Loyalty voucher discount (advance payments only)
    discount = 0.0
    voucher = None
    if body.voucher_code and payment_type == "advance":
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
            "payment_type": payment_type,
        },
    )
    session = await stripe_checkout.create_checkout_session(session_req)

    await db.payment_transactions.insert_one({
        "id": str(uuid4()),
        "session_id": session.session_id,
        "booking_id": body.booking_id,
        "is_inquiry": is_inquiry,
        "customer_id": current_user["id"],
        "payment_type": payment_type,
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

    return {"checkout_url": session.url, "session_id": session.session_id, "payment_type": payment_type,
            "amount": final_amount, "discount": discount, "advance_percent": advance_percent}


async def _apply_payment_success(db, txn: dict):
    """Idempotent booking confirmation after paid (DB updated by caller first)"""
    now = datetime.now(timezone.utc).isoformat()
    if txn.get("payment_type") == "balance":
        update_data = {
            "payment_status": "fully_paid",
            "balance_paid_at": now,
            "balance_session_id": txn["session_id"],
            "updated_at": now,
        }
    else:
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

    # Send PDF receipt email for ALL payment types (advance and balance)
    try:
        customer = await db.users.find_one({"id": txn["customer_id"]}, {"_id": 0, "email": 1, "full_name": 1, "phone": 1})
        if customer and customer.get("email") and booking:
            # Generate PDF receipt
            pdf_bytes = _generate_receipt_pdf(txn, booking, customer)
            
            # Send email with PDF attachment
            from services.email_service import email_service
            await email_service.send_payment_receipt_with_pdf(
                to_email=customer["email"],
                customer_name=customer.get("full_name", "Customer"),
                txn=txn,
                booking=booking,
                pdf_bytes=pdf_bytes
            )
            print(f"Payment receipt email sent to {customer['email']} for txn {txn.get('id', '')[:8]}")
    except Exception as e:
        print(f"Payment receipt email failed: {e}")

    # Send booking confirmation for advance payments only (existing behavior)
    if booking and txn.get("payment_type") != "balance":
        try:
            customer = await db.users.find_one({"id": txn["customer_id"]}, {"_id": 0, "email": 1, "phone": 1, "full_name": 1})
            
            # Send booking confirmation email with PDF receipt
            if customer and customer.get("email"):
                from services.email_service import email_service
                booking_data = {
                    **booking,
                    "customer_name": customer.get("full_name", "Customer"),
                    "customer_email": customer.get("email"),
                    "customer_phone": customer.get("phone", ""),
                    "total_amount": txn.get("amount", booking.get("total_amount", 0)),
                    "payment_status": "paid",
                    "booking_id": booking.get("id", txn.get("booking_id"))
                }
                await email_service.send_booking_confirmation(
                    to_email=customer["email"],
                    booking_data=booking_data
                )
                print(f"Booking confirmation email with PDF sent to {customer['email']}")
            
            # Also send SMS notification
            from services.notification_service import notification_service
            await notification_service.send_booking_confirmation(
                booking=booking,
                customer_email=(customer or {}).get("email"),
                customer_phone=(customer or {}).get("phone"),
            )
        except Exception as e:
            print(f"Booking confirmation notification failed: {e}")
    
    # Process referral bonus for first-time bookings (advance payment only)
    if booking and txn.get("payment_type") != "balance":
        try:
            from routes.referral_routes import process_referral_bonus
            await process_referral_bonus(
                booking_id=txn["booking_id"],
                booking_amount=txn.get("amount", 0),
                customer_id=txn["customer_id"]
            )
            print(f"Referral bonus processed for booking {txn['booking_id'][:8]}")
        except Exception as e:
            print(f"Referral bonus processing skipped/failed: {e}")

    # Auto-email PDF invoice on payment success
    from services.invoice_email_service import schedule_invoice_email
    schedule_invoice_email(db, txn["booking_id"], "stripe")


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


@router.get("/payments/transactions/{booking_id}")
async def booking_payment_ledger(
    booking_id: str,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """Payment ledger for a booking: total, credited, remaining + paid transactions (owner or admin)"""
    booking = await db.inquiries.find_one({"id": booking_id}, {"_id": 0}) or await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    roles = current_user.get("roles", [])
    if booking.get("customer_id") != current_user["id"] and not any(r in ["admin", "super_admin"] for r in roles):
        raise HTTPException(status_code=403, detail="Not authorized")
    total_amount, credited, remaining, txns = await _payment_ledger(db, booking)
    return {
        "booking_id": booking_id,
        "payment_status": booking.get("payment_status"),
        "total_amount": total_amount,
        "paid_total": round(credited, 2),
        "remaining_due": remaining,
        "transactions": [{
            "id": t["id"], "session_id": t["session_id"], "payment_type": t.get("payment_type", "advance"),
            "amount": t.get("amount"), "voucher_discount": t.get("voucher_discount", 0),
            "paid_at": t.get("updated_at"), "gateway": t.get("gateway"),
        } for t in txns],
    }


def _generate_receipt_pdf(txn: dict, booking: dict, customer: dict) -> bytes:
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.colors import HexColor
    from reportlab.pdfgen import canvas
    import io as _io

    buf = _io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    w, h = A4
    navy, orange, grey, green = HexColor("#0f172a"), HexColor("#f97316"), HexColor("#64748b"), HexColor("#16a34a")

    c.setFillColor(navy)
    c.rect(0, h - 90, w, 90, fill=True, stroke=0)
    c.setFillColor(HexColor("#ffffff"))
    c.setFont("Helvetica-Bold", 20)
    c.drawString(40, h - 45, "AirYatra Aviation Pvt. Ltd.")
    c.setFont("Helvetica", 10)
    c.drawString(40, h - 62, "India's Aviation Operating System | info@airyatra.co.in")
    c.setFillColor(orange)
    c.setFont("Helvetica-Bold", 14)
    c.drawRightString(w - 40, h - 45, "PAYMENT RECEIPT")
    c.setFillColor(HexColor("#ffffff"))
    c.setFont("Helvetica", 9)
    c.drawRightString(w - 40, h - 62, f"Receipt No: AYR-{txn['id'][:8].upper()}")

    y = h - 130
    c.setFillColor(green)
    c.setFont("Helvetica-Bold", 13)
    c.drawString(40, y, "PAYMENT SUCCESSFUL")
    c.setFillColor(grey)
    c.setFont("Helvetica", 9)
    paid_at = (txn.get("updated_at") or "")[:19].replace("T", " ")
    c.drawRightString(w - 40, y, f"Date: {paid_at} UTC")

    y -= 30
    rows = [
        ("Customer", customer.get("full_name", "")),
        ("Email", customer.get("email", "")),
        ("Booking Ref", booking.get("inquiry_number") or booking.get("booking_number") or txn.get("booking_id", "")[:12]),
        ("Route", f"{booking.get('from_location', '')} → {booking.get('to_location', '')}"),
        ("Payment Type", "Remaining Balance" if txn.get("payment_type") == "balance" else "Advance Payment"),
        ("Gateway", "Stripe (Test Mode)"),
        ("Transaction Ref", txn.get("session_id", "")[:38]),
    ]
    c.setFont("Helvetica", 10)
    for k, v in rows:
        c.setFillColor(grey)
        c.drawString(40, y, f"{k}:")
        c.setFillColor(navy)
        c.drawString(160, y, str(v))
        y -= 18

    y -= 10
    c.setStrokeColor(grey)
    c.line(40, y, w - 40, y)
    y -= 26
    c.setFillColor(navy)
    c.setFont("Helvetica-Bold", 11)
    c.drawString(40, y, "Amount Paid")
    c.drawRightString(w - 40, y, f"Rs. {txn.get('amount', 0):,.2f}")
    if txn.get("voucher_discount"):
        y -= 18
        c.setFont("Helvetica", 10)
        c.setFillColor(grey)
        c.drawString(40, y, f"Loyalty voucher discount applied ({txn.get('voucher_code', '')})")
        c.drawRightString(w - 40, y, f"- Rs. {txn['voucher_discount']:,.2f}")

    y -= 30
    c.setFillColor(orange)
    c.rect(40, y - 10, w - 80, 34, fill=True, stroke=0)
    c.setFillColor(HexColor("#ffffff"))
    c.setFont("Helvetica-Bold", 13)
    c.drawString(52, y + 1, "TOTAL RECEIVED")
    c.drawRightString(w - 52, y + 1, f"Rs. {txn.get('amount', 0):,.2f}")

    c.setFillColor(grey)
    c.setFont("Helvetica", 8)
    c.drawString(40, 50, "This is a computer-generated receipt and does not require a signature.")
    c.drawString(40, 38, f"Generated on {datetime.now(timezone.utc).strftime('%d %b %Y %H:%M UTC')} | AirYatra Payments")
    c.showPage()
    c.save()
    return buf.getvalue()


@router.get("/payments/receipt/{session_id}")
async def download_payment_receipt(
    session_id: str,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """Download PDF receipt for a paid transaction (owner or admin)"""
    from fastapi.responses import Response as FastAPIResponse
    txn = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")
    roles = current_user.get("roles", [])
    if txn.get("customer_id") != current_user["id"] and not any(r in ["admin", "super_admin"] for r in roles):
        raise HTTPException(status_code=403, detail="Not authorized")
    if txn.get("payment_status") != "paid":
        raise HTTPException(status_code=400, detail="Receipt available only for successful payments")

    booking = await db.inquiries.find_one({"id": txn["booking_id"]}, {"_id": 0}) or await db.bookings.find_one({"id": txn["booking_id"]}, {"_id": 0}) or {}
    customer = await db.users.find_one({"id": txn["customer_id"]}, {"_id": 0, "full_name": 1, "email": 1}) or {}
    pdf = _generate_receipt_pdf(txn, booking, customer)
    fname = f"AirYatra_Receipt_AYR-{txn['id'][:8].upper()}.pdf"
    return FastAPIResponse(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{fname}"'},
    )


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
