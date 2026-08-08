"""
Razorpay Payment Gateway Routes
Order creation, payment verification, webhook handling
Receipt Prefix: AY000125 format
Website: airyatra.co.in
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
from bson import ObjectId
from database import get_database
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

# Create Razorpay Order
@router.post("/create-order")
async def create_order(request: OrderRequest):
    if not razorpay_client:
        raise HTTPException(status_code=500, detail="Razorpay not configured")
    
    db = get_database()
    
    # SECURITY FIX: Get booking and derive amount server-side
    booking = await db.bookings.find_one({"id": request.booking_id}, {"_id": 0})
    if not booking:
        booking = await db.inquiries.find_one({"id": request.booking_id}, {"_id": 0})
    
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    # Get amount from booking (not from client request)
    booking_amount = booking.get("total_amount") or booking.get("amount") or booking.get("quoted_price")
    if not booking_amount:
        raise HTTPException(status_code=400, detail="Booking amount not set. Contact support.")
    
    amount = float(booking_amount)
    
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
                "booking_id": request.booking_id or "",
                "customer_name": request.customer_name,
                "customer_email": request.customer_email,
                "customer_phone": request.customer_phone,
                "website": WEBSITE,
                **request.notes
            }
        }
        
        razorpay_order = razorpay_client.order.create(data=order_data)
        
        # Store order in database
        order_doc = {
            "razorpay_order_id": razorpay_order["id"],
            "receipt": receipt,
            "amount": request.amount,
            "amount_paise": amount_paise,
            "currency": "INR",
            "booking_id": request.booking_id,
            "customer_name": request.customer_name,
            "customer_email": request.customer_email,
            "customer_phone": request.customer_phone,
            "description": request.description,
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
            "amount": request.amount,
            "amount_paise": amount_paise,
            "currency": "INR",
            "key_id": RAZORPAY_KEY_ID,
            "prefill": {
                "name": request.customer_name,
                "email": request.customer_email,
                "contact": request.customer_phone
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
async def verify_payment(request: PaymentVerifyRequest):
    if not razorpay_client:
        raise HTTPException(status_code=500, detail="Razorpay not configured")
    
    db = get_database()
    
    try:
        # Verify signature
        params_dict = {
            'razorpay_order_id': request.razorpay_order_id,
            'razorpay_payment_id': request.razorpay_payment_id,
            'razorpay_signature': request.razorpay_signature
        }
        
        razorpay_client.utility.verify_payment_signature(params_dict)
        
        # Fetch payment details
        payment = razorpay_client.payment.fetch(request.razorpay_payment_id)
        
        # Update order status
        await db.razorpay_orders.update_one(
            {"razorpay_order_id": request.razorpay_order_id},
            {
                "$set": {
                    "status": "paid",
                    "razorpay_payment_id": request.razorpay_payment_id,
                    "razorpay_signature": request.razorpay_signature,
                    "payment_details": payment,
                    "paid_at": datetime.now(timezone.utc)
                }
            }
        )
        
        # Get order details
        order = await db.razorpay_orders.find_one({"razorpay_order_id": request.razorpay_order_id})
        
        # Update booking if linked
        if order and order.get("booking_id"):
            await db.bookings.update_one(
                {"_id": ObjectId(order["booking_id"])},
                {
                    "$set": {
                        "payment_status": "paid",
                        "razorpay_payment_id": request.razorpay_payment_id,
                        "paid_at": datetime.now(timezone.utc)
                    }
                }
            )
        
        # Create notification
        await db.notifications.insert_one({
            "type": "payment",
            "title": f"Payment Received - {order.get('receipt', '')}",
            "message": f"₹{order.get('amount', 0):,.0f} payment received from {order.get('customer_name', 'Customer')}",
            "priority": "normal",
            "metadata": {
                "order_id": request.razorpay_order_id,
                "payment_id": request.razorpay_payment_id,
                "amount": order.get("amount") if order else 0
            },
            "is_read": False,
            "is_archived": False,
            "created_at": datetime.now(timezone.utc)
        })
        
        logger.info(f"Payment verified: {request.razorpay_payment_id}")
        
        return {
            "success": True,
            "message": "Payment verified successfully",
            "order_id": request.razorpay_order_id,
            "payment_id": request.razorpay_payment_id,
            "receipt": order.get("receipt") if order else None,
            "amount": order.get("amount") if order else None
        }
        
    except razorpay.errors.SignatureVerificationError:
        logger.warning(f"Invalid signature for order: {request.razorpay_order_id}")
        
        # Update order status as failed
        await db.razorpay_orders.update_one(
            {"razorpay_order_id": request.razorpay_order_id},
            {"$set": {"status": "signature_failed", "failed_at": datetime.now(timezone.utc)}}
        )
        
        raise HTTPException(status_code=400, detail="Invalid payment signature")
    except Exception as e:
        logger.error(f"Payment verification failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Verification failed: {str(e)}")

# Webhook Handler
@router.post("/webhook")
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

# Create Refund
@router.post("/refund")
async def create_refund(request: RefundRequest):
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

# Get Order Status
@router.get("/order/{order_id}")
async def get_order_status(order_id: str):
    db = get_database()
    
    order = await db.razorpay_orders.find_one(
        {"razorpay_order_id": order_id},
        {"_id": 0}
    )
    
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    return order

# Get Payment Status
@router.get("/payment/{payment_id}")
async def get_payment_status(payment_id: str):
    if not razorpay_client:
        raise HTTPException(status_code=500, detail="Razorpay not configured")
    
    try:
        payment = razorpay_client.payment.fetch(payment_id)
        return payment
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Payment not found: {str(e)}")

# Get All Orders (Admin)
@router.get("/orders")
async def get_all_orders(
    status: Optional[str] = None,
    limit: int = 50,
    skip: int = 0
):
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

# Get Payment Statistics
@router.get("/stats")
async def get_payment_stats():
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
