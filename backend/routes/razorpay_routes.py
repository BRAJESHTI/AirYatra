"""
Razorpay Payment Gateway Routes
Order creation, payment verification, webhook handling
Receipt Prefix: AY000125 format
Website: airyatra.co.in
"""
from fastapi import APIRouter, HTTPException, Request, Depends
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
from bson import ObjectId
from database import get_database
from security_middleware import limiter, RATE_LIMITS
from routes.auth_routes import get_current_user
import razorpay
import hmac
import hashlib
import os
import logging
import json

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/razorpay", tags=["razorpay"])

# Initialize Razorpay client
RAZORPAY_KEY_ID = os.environ.get("RAZORPAY_KEY_ID", "")
RAZORPAY_KEY_SECRET = os.environ.get("RAZORPAY_KEY_SECRET", "")
RAZORPAY_WEBHOOK_SECRET = os.environ.get("RAZORPAY_WEBHOOK_SECRET", "")
RECEIPT_PREFIX = os.environ.get("RAZORPAY_RECEIPT_PREFIX", "AY")
WEBSITE = os.environ.get("RAZORPAY_WEBSITE", "airyatra.co.in")

# Initialize client only if credentials exist
razorpay_client = None
if RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET:
    razorpay_client = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))

# Models
class OrderRequest(BaseModel):
    booking_id: str  # SECURITY: booking_id is now required
    customer_name: str
    customer_email: str
    customer_phone: str
    description: Optional[str] = "AirYatra Booking Payment"
    notes: Optional[dict] = {}
    # SECURITY: Amount removed - derived from booking server-side

class PaymentVerifyRequest(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str

class RefundRequest(BaseModel):
    payment_id: str
    amount: Optional[float] = None  # Partial refund amount in INR, None for full refund
    reason: Optional[str] = "Customer requested refund"

async def get_next_receipt_number(db) -> str:
    """Generate next receipt number in AY000125 format"""
    # Get counter from database
    counter = await db.counters.find_one_and_update(
        {"_id": "razorpay_receipt"},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=True
    )
    seq = counter.get("seq", 1)
    return f"{RECEIPT_PREFIX}{seq:06d}"  # AY000001, AY000002, etc.

# Create Razorpay Order - REQUIRES AUTHENTICATION
@router.post("/create-order")
@limiter.limit(RATE_LIMITS["razorpay_order"])
async def create_order(
    request: Request, 
    order_request: OrderRequest,
    current_user: dict = Depends(get_current_user)
):
    """Create Razorpay order - requires authentication and booking ownership"""
    if not razorpay_client:
        raise HTTPException(status_code=500, detail="Razorpay not configured")
    
    db = get_database()
    
    # SECURITY FIX: Get booking and derive amount server-side
    booking = await db.bookings.find_one({"id": order_request.booking_id}, {"_id": 0})
    if not booking:
        booking = await db.inquiries.find_one({"id": order_request.booking_id}, {"_id": 0})
    
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    # SECURITY: Verify booking ownership
    booking_customer_id = booking.get("customer_id") or booking.get("user_id")
    if booking_customer_id != current_user.get("id"):
        # Allow admin/finance to create orders for any booking
        user_roles = set(current_user.get("roles", []))
        if not user_roles.intersection({"admin", "super_admin", "finance", "ceo", "operator"}):
            raise HTTPException(status_code=403, detail="You don't have access to this booking")
    
    # Amount derived server-side via payment ledger (advance/balance aware)
    from routes.stripe_payment_routes import _payment_ledger
    total_amount, credited, remaining, _ = await _payment_ledger(db, booking)
    if total_amount <= 0:
        total_amount = float(booking.get("total_amount") or booking.get("amount") or booking.get("quoted_price") or 0)
        remaining = max(0.0, total_amount - credited)
    if total_amount <= 0:
        raise HTTPException(status_code=400, detail="Booking amount not set. Contact support.")
    if remaining <= 0:
        raise HTTPException(status_code=400, detail="Booking already fully paid")

    if booking.get("payment_status") in ["paid", "fully_paid"]:
        amount = remaining
        payment_type = "balance"
    else:
        advance_percent = 50
        settings = await db.payment_rules_settings.find_one({"type": "payment_rules"}, {"_id": 0})
        if settings:
            for rule in settings.get("payment_rules", []):
                if rule.get("purpose") == booking.get("booking_purpose", "other"):
                    advance_percent = rule.get("advance_percent", 50)
                    break
        advance_needed = float(int(total_amount * advance_percent / 100))
        amount = max(1.0, min(remaining, max(1.0, advance_needed - credited)))
        payment_type = "advance"
    amount = round(float(amount), 2)
    
    # Generate receipt number
    receipt = await get_next_receipt_number(db)
    
    # Amount in paise (Razorpay requires paise)
    amount_paise = int(amount * 100)
    
    try:
        # Create Razorpay order
        order_data = {
            "amount": amount_paise,
            "currency": "INR",
            "receipt": receipt,
            "payment_capture": 1,  # Auto-capture
            "notes": {
                "booking_id": order_request.booking_id or "",
                "customer_name": order_request.customer_name,
                "customer_email": order_request.customer_email,
                "customer_phone": order_request.customer_phone,
                "website": WEBSITE,
                **order_request.notes
            }
        }
        
        razorpay_order = razorpay_client.order.create(data=order_data)
        
        # Store order in database
        order_doc = {
            "razorpay_order_id": razorpay_order["id"],
            "receipt": receipt,
            "amount": amount,
            "amount_paise": amount_paise,
            "currency": "INR",
            "booking_id": order_request.booking_id,
            "customer_id": current_user.get("id"),
            "payment_type": payment_type,
            "total_amount": total_amount,
            "customer_name": order_request.customer_name,
            "customer_email": order_request.customer_email,
            "customer_phone": order_request.customer_phone,
            "description": order_request.description,
            "status": "created",
            "website": WEBSITE,
            "created_at": datetime.now(timezone.utc),
            "razorpay_response": razorpay_order
        }
        
        result = await db.razorpay_orders.insert_one(order_doc)
        
        logger.info(f"Razorpay order created: {razorpay_order['id']}, Receipt: {receipt}")
        
        return {
            "success": True,
            "order_id": razorpay_order["id"],
            "receipt": receipt,
            "amount": amount,
            "amount_paise": amount_paise,
            "payment_type": payment_type,
            "currency": "INR",
            "key_id": RAZORPAY_KEY_ID,
            "prefill": {
                "name": order_request.customer_name,
                "email": order_request.customer_email,
                "contact": order_request.customer_phone
            },
            "notes": order_data["notes"],
            "theme": {
                "color": "#f97316"  # Orange theme
            }
        }
        
    except razorpay.errors.BadRequestError as e:
        logger.error(f"Razorpay BadRequest: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Invalid request: {str(e)}")
    except Exception as e:
        logger.error(f"Razorpay order creation failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Order creation failed: {str(e)}")

# Verify Payment Signature
@router.post("/verify-payment")
@limiter.limit(RATE_LIMITS["payment_verify"])
async def verify_payment(request: Request, verify_request: PaymentVerifyRequest):
    if not razorpay_client:
        raise HTTPException(status_code=500, detail="Razorpay not configured")
    
    db = get_database()
    
    try:
        # Verify signature
        params_dict = {
            'razorpay_order_id': verify_request.razorpay_order_id,
            'razorpay_payment_id': verify_request.razorpay_payment_id,
            'razorpay_signature': verify_request.razorpay_signature
        }
        
        razorpay_client.utility.verify_payment_signature(params_dict)
        
        # Fetch payment details
        payment = razorpay_client.payment.fetch(verify_request.razorpay_payment_id)
        
        # Update order status
        await db.razorpay_orders.update_one(
            {"razorpay_order_id": verify_request.razorpay_order_id},
            {
                "$set": {
                    "status": "paid",
                    "razorpay_payment_id": verify_request.razorpay_payment_id,
                    "razorpay_signature": verify_request.razorpay_signature,
                    "payment_details": payment,
                    "paid_at": datetime.now(timezone.utc)
                }
            }
        )
        
        # Get order details
        order = await db.razorpay_orders.find_one({"razorpay_order_id": verify_request.razorpay_order_id})
        
        # Update booking/inquiry + payment ledger if linked
        if order and order.get("booking_id"):
            from routes.stripe_payment_routes import _payment_ledger
            import uuid as _uuid
            amount_inr = float(order.get("amount", 0))
            now_iso = datetime.now(timezone.utc).isoformat()
            existing_txn = await db.payment_transactions.find_one(
                {"session_id": verify_request.razorpay_order_id, "payment_status": "paid"})
            if not existing_txn:
                await db.payment_transactions.insert_one({
                    "id": str(_uuid.uuid4()),
                    "session_id": verify_request.razorpay_order_id,
                    "booking_id": order["booking_id"],
                    "customer_id": order.get("customer_id"),
                    "payment_type": order.get("payment_type", "advance"),
                    "amount": amount_inr,
                    "total_amount": order.get("total_amount"),
                    "currency": "inr",
                    "gateway": "razorpay",
                    "razorpay_payment_id": verify_request.razorpay_payment_id,
                    "status": "completed",
                    "payment_status": "paid",
                    "created_at": now_iso,
                    "updated_at": now_iso,
                })
            booking = await db.inquiries.find_one({"id": order["booking_id"]}, {"_id": 0}) or \
                      await db.bookings.find_one({"id": order["booking_id"]}, {"_id": 0})
            if booking:
                _, _, remaining_after, _ = await _payment_ledger(db, booking)
                update = {
                    "payment_status": "fully_paid" if remaining_after <= 0 else "paid",
                    "razorpay_payment_id": verify_request.razorpay_payment_id,
                    "paid_at": now_iso,
                    "updated_at": now_iso,
                }
                if booking.get("status") in ["payment_pending", "quote_accepted", "pending_acceptance"]:
                    update["status"] = "confirmed"
                await db.inquiries.update_one({"id": order["booking_id"]}, {"$set": update})
                await db.bookings.update_one({"id": order["booking_id"]}, {"$set": update})
        
        # Create notification
        await db.notifications.insert_one({
            "type": "payment",
            "title": f"Payment Received - {order.get('receipt', '')}",
            "message": f"₹{order.get('amount', 0):,.0f} payment received from {order.get('customer_name', 'Customer')}",
            "priority": "normal",
            "metadata": {
                "order_id": verify_request.razorpay_order_id,
                "payment_id": verify_request.razorpay_payment_id,
                "amount": order.get("amount") if order else 0
            },
            "is_read": False,
            "is_archived": False,
            "created_at": datetime.now(timezone.utc)
        })
        
        logger.info(f"Payment verified: {verify_request.razorpay_payment_id}")
        
        return {
            "success": True,
            "message": "Payment verified successfully",
            "order_id": verify_request.razorpay_order_id,
            "payment_id": verify_request.razorpay_payment_id,
            "receipt": order.get("receipt") if order else None,
            "amount": order.get("amount") if order else None
        }
        
    except razorpay.errors.SignatureVerificationError:
        logger.warning(f"Invalid signature for order: {verify_request.razorpay_order_id}")
        
        # Update order status as failed
        await db.razorpay_orders.update_one(
            {"razorpay_order_id": verify_request.razorpay_order_id},
            {"$set": {"status": "signature_failed", "failed_at": datetime.now(timezone.utc)}}
        )
        
        raise HTTPException(status_code=400, detail="Invalid payment signature")
    except Exception as e:
        logger.error(f"Payment verification failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Verification failed: {str(e)}")

# Webhook Handler
@router.post("/webhook")
@limiter.limit(RATE_LIMITS["webhook"])
async def handle_webhook(request: Request):
    db = get_database()
    
    try:
        # Get raw body and signature
        payload = await request.body()
        signature = request.headers.get("X-Razorpay-Signature", "")
        
        # SECURITY FIX: Webhook signature verification is MANDATORY
        if not RAZORPAY_WEBHOOK_SECRET:
            logger.error("RAZORPAY_WEBHOOK_SECRET not configured - rejecting webhook")
            raise HTTPException(
                status_code=500, 
                detail="Webhook secret not configured. Contact administrator."
            )
        
        if not signature:
            logger.warning("Webhook received without signature - rejecting")
            raise HTTPException(
                status_code=400, 
                detail="Missing X-Razorpay-Signature header"
            )
        
        # Verify webhook signature using constant-time comparison
        expected_signature = hmac.new(
            RAZORPAY_WEBHOOK_SECRET.encode(),
            payload,
            hashlib.sha256
        ).hexdigest()
        
        if not hmac.compare_digest(signature, expected_signature):
            logger.warning("Webhook signature verification failed - potential forgery attempt")
            raise HTTPException(status_code=400, detail="Invalid webhook signature")
        
        # Parse payload
        event_data = json.loads(payload.decode())
        
        event = event_data.get("event", "")
        payment_entity = event_data.get("payload", {}).get("payment", {}).get("entity", {})
        
        logger.info(f"Razorpay webhook received: {event}")
        
        # Store webhook event
        webhook_doc = {
            "event": event,
            "payload": event_data,
            "received_at": datetime.now(timezone.utc),
            "processed": False
        }
        await db.razorpay_webhooks.insert_one(webhook_doc)
        
        # Handle different events
        if event == "payment.authorized":
            # Payment authorized, waiting for capture
            order_id = payment_entity.get("order_id")
            payment_id = payment_entity.get("id")
            
            await db.razorpay_orders.update_one(
                {"razorpay_order_id": order_id},
                {
                    "$set": {
                        "status": "authorized",
                        "razorpay_payment_id": payment_id,
                        "authorized_at": datetime.now(timezone.utc)
                    }
                }
            )
            logger.info(f"Payment authorized: {payment_id}")
            
        elif event == "payment.captured":
            # Payment captured successfully
            order_id = payment_entity.get("order_id")
            payment_id = payment_entity.get("id")
            amount = payment_entity.get("amount", 0) / 100  # Convert from paise
            
            await db.razorpay_orders.update_one(
                {"razorpay_order_id": order_id},
                {
                    "$set": {
                        "status": "captured",
                        "razorpay_payment_id": payment_id,
                        "captured_amount": amount,
                        "captured_at": datetime.now(timezone.utc)
                    }
                }
            )
            
            # Get order and update booking
            order = await db.razorpay_orders.find_one({"razorpay_order_id": order_id})
            if order and order.get("booking_id"):
                await db.bookings.update_one(
                    {"_id": ObjectId(order["booking_id"])},
                    {"$set": {"payment_status": "captured", "captured_at": datetime.now(timezone.utc)}}
                )
            
            # Create success notification
            await db.notifications.insert_one({
                "type": "payment",
                "title": f"💰 Payment Captured - ₹{amount:,.0f}",
                "message": f"Payment {payment_id} captured successfully",
                "priority": "normal",
                "is_read": False,
                "is_archived": False,
                "created_at": datetime.now(timezone.utc)
            })
            
            logger.info(f"Payment captured: {payment_id}, Amount: ₹{amount}")
            
        elif event == "payment.failed":
            # Payment failed
            order_id = payment_entity.get("order_id")
            payment_id = payment_entity.get("id")
            error_reason = payment_entity.get("error_reason", "Unknown")
            
            await db.razorpay_orders.update_one(
                {"razorpay_order_id": order_id},
                {
                    "$set": {
                        "status": "failed",
                        "razorpay_payment_id": payment_id,
                        "error_reason": error_reason,
                        "failed_at": datetime.now(timezone.utc)
                    }
                }
            )
            
            # Create failure notification
            await db.notifications.insert_one({
                "type": "alert",
                "title": f"❌ Payment Failed",
                "message": f"Payment {payment_id} failed: {error_reason}",
                "priority": "high",
                "is_read": False,
                "is_archived": False,
                "created_at": datetime.now(timezone.utc)
            })
            
            logger.warning(f"Payment failed: {payment_id}, Reason: {error_reason}")
            
        elif event == "refund.created":
            # Refund initiated
            refund_entity = event_data.get("payload", {}).get("refund", {}).get("entity", {})
            payment_id = refund_entity.get("payment_id")
            refund_amount = refund_entity.get("amount", 0) / 100
            
            await db.razorpay_orders.update_one(
                {"razorpay_payment_id": payment_id},
                {
                    "$set": {
                        "refund_status": "initiated",
                        "refund_amount": refund_amount,
                        "refund_initiated_at": datetime.now(timezone.utc)
                    }
                }
            )
            logger.info(f"Refund initiated for payment: {payment_id}")
            
        elif event == "refund.processed":
            # Refund completed
            refund_entity = event_data.get("payload", {}).get("refund", {}).get("entity", {})
            payment_id = refund_entity.get("payment_id")
            refund_amount = refund_entity.get("amount", 0) / 100
            
            await db.razorpay_orders.update_one(
                {"razorpay_payment_id": payment_id},
                {
                    "$set": {
                        "status": "refunded",
                        "refund_status": "completed",
                        "refund_amount": refund_amount,
                        "refund_completed_at": datetime.now(timezone.utc)
                    }
                }
            )
            
            # Create refund notification
            await db.notifications.insert_one({
                "type": "payment",
                "title": f"🔄 Refund Processed - ₹{refund_amount:,.0f}",
                "message": f"Refund completed for payment {payment_id}",
                "priority": "normal",
                "is_read": False,
                "is_archived": False,
                "created_at": datetime.now(timezone.utc)
            })
            
            logger.info(f"Refund processed for payment: {payment_id}")
        
        # Mark webhook as processed
        await db.razorpay_webhooks.update_one(
            {"payload.event": event, "processed": False},
            {"$set": {"processed": True, "processed_at": datetime.now(timezone.utc)}}
        )
        
        return {"status": "ok", "event": event}
        
    except json.JSONDecodeError:
        logger.error("Invalid webhook payload")
        raise HTTPException(status_code=400, detail="Invalid payload")
    except Exception as e:
        logger.error(f"Webhook processing error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Webhook error: {str(e)}")

# Create Refund - REQUIRES ADMIN/FINANCE ROLE
@router.post("/refund")
async def create_refund(
    request: RefundRequest,
    current_user: dict = Depends(get_current_user)
):
    """Create refund - requires admin or finance role"""
    # SECURITY: Check user has permission to initiate refunds
    allowed_roles = {"admin", "super_admin", "finance", "ceo"}
    user_roles = set(current_user.get("roles", []))
    if not user_roles.intersection(allowed_roles):
        raise HTTPException(
            status_code=403, 
            detail="Only admin or finance users can initiate refunds"
        )
    
    if not razorpay_client:
        raise HTTPException(status_code=500, detail="Razorpay not configured")
    
    db = get_database()
    
    try:
        refund_data = {
            "speed": "normal"
        }
        
        if request.amount:
            refund_data["amount"] = int(request.amount * 100)  # Convert to paise
        
        if request.reason:
            refund_data["notes"] = {"reason": request.reason}
        
        refund = razorpay_client.payment.refund(request.payment_id, refund_data)
        
        # Update order
        await db.razorpay_orders.update_one(
            {"razorpay_payment_id": request.payment_id},
            {
                "$set": {
                    "refund_status": "initiated",
                    "refund_id": refund.get("id"),
                    "refund_amount": request.amount or refund.get("amount", 0) / 100,
                    "refund_reason": request.reason,
                    "refund_initiated_at": datetime.now(timezone.utc)
                }
            }
        )
        
        logger.info(f"Refund initiated: {refund.get('id')} for payment {request.payment_id}")
        
        return {
            "success": True,
            "refund_id": refund.get("id"),
            "payment_id": request.payment_id,
            "amount": refund.get("amount", 0) / 100,
            "status": refund.get("status")
        }
        
    except razorpay.errors.BadRequestError as e:
        logger.error(f"Refund BadRequest: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Refund failed: {str(e)}")
    except Exception as e:
        logger.error(f"Refund failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Refund failed: {str(e)}")

# Get Order Status - REQUIRES AUTHENTICATION
@router.get("/order/{order_id}")
async def get_order_status(
    order_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get order status - requires authentication"""
    db = get_database()
    
    order = await db.razorpay_orders.find_one(
        {"razorpay_order_id": order_id},
        {"_id": 0}
    )
    
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    return order

# Get Payment Status - REQUIRES AUTHENTICATION
@router.get("/payment/{payment_id}")
async def get_payment_status(
    payment_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get payment status - requires authentication"""
    if not razorpay_client:
        raise HTTPException(status_code=500, detail="Razorpay not configured")
    
    try:
        payment = razorpay_client.payment.fetch(payment_id)
        return payment
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Payment not found: {str(e)}")

# Get All Orders (Admin) - REQUIRES ADMIN ROLE
@router.get("/orders")
async def get_all_orders(
    status: Optional[str] = None,
    limit: int = 50,
    skip: int = 0,
    current_user: dict = Depends(get_current_user)
):
    """Get all orders - requires admin role"""
    # SECURITY: Only admins can view all orders
    allowed_roles = {"admin", "super_admin", "finance", "ceo"}
    user_roles = set(current_user.get("roles", []))
    if not user_roles.intersection(allowed_roles):
        raise HTTPException(
            status_code=403, 
            detail="Only admin users can view all orders"
        )
    
    db = get_database()
    
    query = {}
    if status:
        query["status"] = status
    
    orders = await db.razorpay_orders.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(length=limit)
    
    total = await db.razorpay_orders.count_documents(query)
    
    return {
        "orders": orders,
        "total": total,
        "limit": limit,
        "skip": skip
    }

# Get Payment Statistics - REQUIRES ADMIN ROLE
@router.get("/stats")
async def get_payment_stats(
    current_user: dict = Depends(get_current_user)
):
    """Get payment statistics - requires admin role"""
    # SECURITY: Only admins can view stats
    allowed_roles = {"admin", "super_admin", "finance", "ceo"}
    user_roles = set(current_user.get("roles", []))
    if not user_roles.intersection(allowed_roles):
        raise HTTPException(
            status_code=403, 
            detail="Only admin users can view payment stats"
        )
    
    db = get_database()
    
    total_orders = await db.razorpay_orders.count_documents({})
    paid_orders = await db.razorpay_orders.count_documents({"status": {"$in": ["paid", "captured"]}})
    failed_orders = await db.razorpay_orders.count_documents({"status": "failed"})
    refunded_orders = await db.razorpay_orders.count_documents({"status": "refunded"})
    
    # Calculate total revenue
    paid_list = await db.razorpay_orders.find(
        {"status": {"$in": ["paid", "captured"]}},
        {"amount": 1}
    ).to_list(length=1000)
    
    total_revenue = sum(o.get("amount", 0) for o in paid_list)
    
    return {
        "total_orders": total_orders,
        "paid_orders": paid_orders,
        "failed_orders": failed_orders,
        "refunded_orders": refunded_orders,
        "total_revenue": total_revenue,
        "success_rate": round((paid_orders / total_orders * 100) if total_orders > 0 else 0, 2)
    }
