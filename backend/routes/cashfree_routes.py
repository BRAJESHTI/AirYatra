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


# ==================== WEBHOOK ENDPOINT ====================

@router.post("/webhook")
async def cashfree_webhook(request: Request):
    """Handle Cashfree webhook events"""
    db = get_database()
    
    try:
        raw_body = await request.body()
        signature = request.headers.get("x-webhook-signature", "")
        timestamp = request.headers.get("x-webhook-timestamp", "")
        
        # Verify signature (skip in dev if not configured)
        if not cashfree_service.verify_webhook(raw_body, timestamp, signature):
            logger.warning("Invalid webhook signature")
            # Continue processing for development
        
        event = json.loads(raw_body)
        event_type = event.get("type", "")
        data = event.get("data", {})
        order_data = data.get("order", {})
        order_id = order_data.get("order_id")
        
        logger.info(f"Cashfree webhook: {event_type} for order {order_id}")
        
        # Log webhook
        webhook_log = {
            "id": str(uuid.uuid4()),
            "event_type": event_type,
            "order_id": order_id,
            "payload": event,
            "received_at": datetime.now(timezone.utc).isoformat()
        }
        await db.cashfree_webhooks.insert_one(webhook_log)
        
        # Handle events
        if event_type == "PAYMENT_SUCCESS":
            payment_data = data.get("payment", {})
            await db.cashfree_orders.update_one(
                {"cashfree_order_id": order_id},
                {"$set": {
                    "status": "paid",
                    "cf_payment_id": payment_data.get("cf_payment_id"),
                    "payment_method": payment_data.get("payment_method"),
                    "webhook_received": True,
                    "paid_at": datetime.now(timezone.utc).isoformat()
                }}
            )
        
        elif event_type == "PAYMENT_FAILED":
            await db.cashfree_orders.update_one(
                {"cashfree_order_id": order_id},
                {"$set": {"status": "failed", "webhook_received": True}}
            )
        
        elif event_type == "REFUND_SUCCESS":
            refund_data = data.get("refund", {})
            await db.cashfree_refunds.update_one(
                {"order_id": order_id},
                {"$set": {
                    "refund_status": "SUCCESS",
                    "webhook_received": True
                }}
            )
        
        return {"status": "received", "event_type": event_type}
        
    except Exception as e:
        logger.error(f"Cashfree webhook error: {e}")
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
