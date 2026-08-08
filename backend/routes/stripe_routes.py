"""
AirYatra Stripe Payment Routes
Multi-currency international payments
"""

from fastapi import APIRouter, Depends, HTTPException, Request, Body
from pydantic import BaseModel
from typing import Optional, Dict
from datetime import datetime, timezone
from uuid import uuid4

from database import get_database
from routes.auth_routes import get_current_user
from services.stripe_service import stripe_service
from security_middleware import limiter, RATE_LIMITS

router = APIRouter(prefix="/stripe", tags=["Stripe Payments"])


class CreateCheckoutRequest(BaseModel):
    booking_id: str
    currency: str = "usd"  # usd, eur, gbp, etc.
    description: Optional[str] = None
    # SECURITY: Amount is now derived from booking, not client-provided


class VerifySessionRequest(BaseModel):
    session_id: str
    booking_id: str


@router.get("/status")
async def get_stripe_status():
    """Get Stripe configuration status"""
    return stripe_service.get_status()


@router.post("/create-checkout")
@limiter.limit(RATE_LIMITS["stripe_checkout"])
async def create_stripe_checkout(
    request: Request,
    checkout_request: CreateCheckoutRequest,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """
    Create a Stripe Checkout Session for international payment.
    
    SECURITY: Amount is derived from booking, not client-provided.
    Use this for non-INR currencies (USD, EUR, GBP, etc.)
    For INR payments, use Razorpay instead.
    """
    # Get booking details
    booking = await db.inquiries.find_one({"id": checkout_request.booking_id}, {"_id": 0})
    if not booking:
        booking = await db.bookings.find_one({"id": checkout_request.booking_id}, {"_id": 0})
    
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    # SECURITY FIX: Verify user owns this booking or is admin
    user_roles = current_user.get("roles", [])
    is_admin = any(r in user_roles for r in ["admin", "super_admin", "finance"])
    booking_user_id = booking.get("user_id") or booking.get("customer_id")
    
    if not is_admin and booking_user_id != current_user.get("id"):
        raise HTTPException(status_code=403, detail="You can only pay for your own bookings")
    
    # SECURITY FIX: Derive amount from booking, not from client request
    booking_amount = booking.get("total_amount") or booking.get("amount") or booking.get("quoted_price")
    if not booking_amount:
        raise HTTPException(status_code=400, detail="Booking amount not set. Contact support.")
    
    amount = float(booking_amount)
    
    # Convert amount to smallest currency unit (cents)
    currency = checkout_request.currency.lower()
    
    # Currencies that don't use decimal (JPY, etc.)
    zero_decimal_currencies = ['jpy', 'krw', 'vnd']
    
    if currency in zero_decimal_currencies:
        amount_smallest = int(amount)
    else:
        amount_smallest = int(amount * 100)
    
    # Get base URL for redirects
    import os
    base_url = os.environ.get("REACT_APP_BACKEND_URL", "https://airyatra-corporate.preview.emergentagent.com")
    
    # Create checkout session
    result = await stripe_service.create_checkout_session(
        amount=amount_smallest,
        currency=currency,
        booking_id=checkout_request.booking_id,
        customer_email=current_user.get("email", ""),
        customer_name=current_user.get("full_name", current_user.get("name", "")),
        description=checkout_request.description or f"AirYatra Flight Booking - {booking.get('from_city', '')} to {booking.get('to_city', '')}",
        success_url=f"{base_url}/booking/payment-success",
        cancel_url=f"{base_url}/booking/payment-cancelled",
        metadata={
            "user_id": current_user.get("id", ""),
            "from_city": booking.get("from_city", ""),
            "to_city": booking.get("to_city", "")
        }
    )
    
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error", "Failed to create checkout"))
    
    # Store checkout session in database
    checkout_record = {
        "id": str(uuid4()),
        "stripe_session_id": result["session_id"],
        "booking_id": checkout_request.booking_id,
        "user_id": current_user.get("id"),
        "amount": amount,
        "amount_smallest": amount_smallest,
        "currency": currency,
        "status": "pending",
        "checkout_url": result["checkout_url"],
        "created_at": datetime.now(timezone.utc),
        "expires_at": result.get("expires_at")
    }
    
    await db.stripe_checkouts.insert_one(checkout_record)
    
    return {
        "success": True,
        "checkout_url": result["checkout_url"],
        "session_id": result["session_id"],
        "amount": amount,
        "currency": currency.upper(),
        "expires_at": result.get("expires_at")
    }


@router.post("/verify-session")
async def verify_stripe_session(
    request: VerifySessionRequest,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Verify a completed Stripe checkout session"""
    
    result = await stripe_service.verify_session(request.session_id)
    
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error", "Verification failed"))
    
    if result.get("paid"):
        # Update checkout record
        await db.stripe_checkouts.update_one(
            {"stripe_session_id": request.session_id},
            {
                "$set": {
                    "status": "completed",
                    "payment_intent": result.get("payment_intent"),
                    "completed_at": datetime.now(timezone.utc)
                }
            }
        )
        
        # Update booking status
        await db.inquiries.update_one(
            {"id": request.booking_id},
            {
                "$set": {
                    "payment_status": "paid",
                    "payment_method": "stripe",
                    "payment_currency": result.get("currency", "").upper(),
                    "stripe_payment_intent": result.get("payment_intent"),
                    "paid_at": datetime.now(timezone.utc)
                }
            }
        )
        
        # Also check bookings collection
        await db.bookings.update_one(
            {"id": request.booking_id},
            {
                "$set": {
                    "payment_status": "paid",
                    "payment_method": "stripe",
                    "payment_currency": result.get("currency", "").upper(),
                    "stripe_payment_intent": result.get("payment_intent"),
                    "paid_at": datetime.now(timezone.utc)
                }
            }
        )
        
        # Create transaction record
        transaction = {
            "id": str(uuid4()),
            "transaction_id": f"STR-{uuid4().hex[:12].upper()}",
            "booking_id": request.booking_id,
            "user_id": current_user.get("id"),
            "amount": result.get("amount_total", 0) / 100,  # Convert from cents
            "currency": result.get("currency", "").upper(),
            "payment_method": "stripe",
            "payment_gateway": "stripe",
            "stripe_session_id": request.session_id,
            "stripe_payment_intent": result.get("payment_intent"),
            "status": "success",
            "created_at": datetime.now(timezone.utc)
        }
        
        await db.transactions.insert_one(transaction)
    
    return {
        "success": True,
        "paid": result.get("paid", False),
        "payment_status": result.get("payment_status"),
        "amount": result.get("amount_total", 0) / 100,
        "currency": result.get("currency", "").upper(),
        "booking_id": request.booking_id
    }


@router.post("/create-payment-intent")
async def create_payment_intent(
    booking_id: str = Body(...),
    currency: str = Body("inr"),
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """
    Create a PaymentIntent for custom Stripe Elements integration.
    SECURITY: Amount is derived from booking server-side, not from client.
    Returns client_secret for frontend Stripe.js
    """
    # SECURITY FIX: Derive amount from booking, not from client request
    booking = await db.bookings.find_one(
        {"booking_id": booking_id},
        {"_id": 0, "total_amount": 1, "customer_id": 1, "status": 1, "currency": 1}
    )
    
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    # SECURITY: Verify booking ownership
    if booking.get("customer_id") != current_user.get("id"):
        # Allow admin/finance to create payments for any booking
        user_roles = set(current_user.get("roles", []))
        if not user_roles.intersection({"admin", "super_admin", "finance", "ceo"}):
            raise HTTPException(status_code=403, detail="You don't have access to this booking")
    
    # SECURITY: Don't allow payment for already paid bookings
    if booking.get("status") in ["paid", "completed"]:
        raise HTTPException(status_code=400, detail="Booking is already paid")
    
    # Get amount from booking (server-side source of truth)
    amount = booking.get("total_amount")
    if not amount or amount <= 0:
        raise HTTPException(status_code=400, detail="Invalid booking amount")
    
    # Use booking's currency or default
    currency = (booking.get("currency") or currency).lower()
    zero_decimal_currencies = ['jpy', 'krw', 'vnd']
    
    if currency in zero_decimal_currencies:
        amount_smallest = int(amount)
    else:
        amount_smallest = int(amount * 100)
    
    result = await stripe_service.create_payment_intent(
        amount=amount_smallest,
        currency=currency,
        booking_id=booking_id,
        customer_email=current_user.get("email", ""),
        metadata={"user_id": current_user.get("id", ""), "booking_id": booking_id}
    )
    
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error"))
    
    return {
        "success": True,
        "client_secret": result["client_secret"],
        "payment_intent_id": result["payment_intent_id"],
        "amount": amount,
        "currency": currency.upper()
    }


@router.post("/refund")
@limiter.limit(RATE_LIMITS["payment_refund"])
async def create_stripe_refund(
    request: Request,
    payment_intent_id: str = Body(...),
    amount: Optional[float] = Body(None),
    reason: str = Body("requested_by_customer"),
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Create a refund for a Stripe payment (Admin/Finance only)"""
    
    # SECURITY FIX: Role-based access control - only admin/finance can process refunds
    user_roles = current_user.get("roles", [])
    allowed_roles = ["admin", "super_admin", "finance", "cfo"]
    
    if not any(role in user_roles for role in allowed_roles):
        raise HTTPException(
            status_code=403, 
            detail="Insufficient permissions. Only Admin/Finance can process refunds."
        )
    
    # SECURITY FIX: Verify the payment belongs to a valid booking
    checkout = await db.stripe_checkouts.find_one({"payment_intent_id": payment_intent_id})
    if not checkout:
        raise HTTPException(
            status_code=404, 
            detail="Payment not found in system"
        )
    
    # Convert amount to cents if provided
    amount_smallest = int(amount * 100) if amount else None
    
    result = await stripe_service.create_refund(
        payment_intent_id=payment_intent_id,
        amount=amount_smallest,
        reason=reason
    )
    
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error"))
    
    # Log refund with audit trail
    refund_record = {
        "id": str(uuid4()),
        "refund_id": result["refund_id"],
        "payment_intent_id": payment_intent_id,
        "booking_id": checkout.get("booking_id"),
        "amount": result["amount"] / 100,
        "currency": result["currency"].upper(),
        "status": result["status"],
        "reason": reason,
        "created_by": current_user.get("id"),
        "created_by_email": current_user.get("email"),
        "created_by_role": user_roles,
        "created_at": datetime.now(timezone.utc)
    }
    
    await db.stripe_refunds.insert_one(refund_record)
    
    return {
        "success": True,
        "refund_id": result["refund_id"],
        "amount": result["amount"] / 100,
        "currency": result["currency"].upper(),
        "status": result["status"]
    }


@router.get("/checkout/{booking_id}")
async def get_checkout_history(
    booking_id: str,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Get Stripe checkout history for a booking (Owner/Admin only)"""
    
    # SECURITY FIX: Verify user owns this booking or is admin
    booking = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not booking:
        booking = await db.inquiries.find_one({"id": booking_id}, {"_id": 0})
    
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    user_roles = current_user.get("roles", [])
    is_admin = any(r in user_roles for r in ["admin", "super_admin", "finance"])
    booking_user_id = booking.get("user_id") or booking.get("customer_id")
    
    if not is_admin and booking_user_id != current_user.get("id"):
        raise HTTPException(status_code=403, detail="Access denied")
    
    checkouts = await db.stripe_checkouts.find(
        {"booking_id": booking_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(10)
    
    return {
        "success": True,
        "checkouts": checkouts
    }
