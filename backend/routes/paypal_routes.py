"""
AirYatra PayPal Payment Routes
Endpoints for PayPal checkout, capture, and webhook handling
"""

from fastapi import APIRouter, HTTPException, Depends, Request, Query
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
from database import get_database
from middleware import get_current_user, require_roles
import logging
import uuid
import hmac
import hashlib

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/payments/paypal", tags=["PayPal Payments"])

# Import PayPal service
from services.paypal_service import paypal_service, convert_inr_to_usd, convert_usd_to_inr


# ==================== PYDANTIC MODELS ====================

class CreateOrderRequest(BaseModel):
    booking_id: str
    amount: float  # Amount in INR
    currency: str = "USD"  # PayPal currency (will convert from INR)
    description: Optional[str] = None
    return_url: Optional[str] = None
    cancel_url: Optional[str] = None

class CaptureOrderRequest(BaseModel):
    order_id: str
    booking_id: Optional[str] = None


# ==================== PUBLIC ENDPOINTS ====================

@router.get("/config")
async def get_paypal_config():
    """Get PayPal client configuration for frontend"""
    import os
    client_id = os.environ.get("PAYPAL_CLIENT_ID", "")
    mode = os.environ.get("PAYPAL_MODE", "sandbox")
    
    return {
        "success": True,
        "client_id": client_id if client_id else "MOCK_CLIENT_ID",
        "mode": mode if client_id else "MOCK",
        "configured": paypal_service.is_configured(),
        "supported_currencies": ["USD", "EUR", "GBP", "CAD", "AUD"],
        "note": "PayPal does not support INR. Amounts will be converted to USD." if not paypal_service.is_configured() else None
    }


# ==================== PAYMENT ENDPOINTS ====================

@router.post("/create-order")
async def create_paypal_order(
    data: CreateOrderRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Create a PayPal order for booking payment
    
    - Converts INR amount to USD (PayPal doesn't support INR)
    - Returns approval URL for PayPal checkout
    """
    db = get_database()
    
    # Verify booking exists
    booking = await db.bookings.find_one({"id": data.booking_id})
    inquiry = await db.inquiries.find_one({"id": data.booking_id})
    
    if not booking and not inquiry:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    record = booking or inquiry
    
    # Convert INR to USD for PayPal
    inr_amount = data.amount
    if data.currency == "USD":
        usd_amount = convert_inr_to_usd(inr_amount)
    else:
        usd_amount = data.amount
    
    # Minimum PayPal amount is $1
    if usd_amount < 1:
        usd_amount = 1.0
    
    # Build return/cancel URLs
    import os
    base_url = os.environ.get("REACT_APP_BACKEND_URL", "https://aviation-erp-2.preview.emergentagent.com")
    return_url = data.return_url or f"{base_url}/payment/paypal/success?booking_id={data.booking_id}"
    cancel_url = data.cancel_url or f"{base_url}/payment/paypal/cancel?booking_id={data.booking_id}"
    
    # Create PayPal order
    result = await paypal_service.create_order(
        amount=usd_amount,
        currency="USD",
        booking_id=data.booking_id,
        description=data.description or f"AirYatra Booking - {record.get('route', 'Helicopter Charter')}",
        return_url=return_url,
        cancel_url=cancel_url
    )
    
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error", "Failed to create PayPal order"))
    
    # Store order in database
    order_record = {
        "id": str(uuid.uuid4()),
        "paypal_order_id": result["order_id"],
        "booking_id": data.booking_id,
        "user_id": current_user["id"],
        "amount_inr": inr_amount,
        "amount_usd": usd_amount,
        "currency": "USD",
        "status": "created",
        "approval_url": result["approval_url"],
        "mode": result.get("mode", "sandbox"),
        "mock_mode": result.get("mock_mode", False),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.paypal_orders.insert_one(order_record.copy())
    
    return {
        "success": True,
        "order_id": result["order_id"],
        "approval_url": result["approval_url"],
        "amount_inr": inr_amount,
        "amount_usd": usd_amount,
        "currency": "USD",
        "mode": result.get("mode"),
        "mock_mode": result.get("mock_mode", False),
        "message": result.get("message")
    }


@router.post("/capture-order")
async def capture_paypal_order(
    data: CaptureOrderRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Capture a PayPal order after user approval
    
    - Captures the payment
    - Updates booking status to paid
    - Records transaction
    """
    db = get_database()
    
    # Find the order record
    order_record = await db.paypal_orders.find_one({"paypal_order_id": data.order_id})
    if not order_record:
        # Try to capture anyway (might be direct PayPal flow)
        pass
    
    # Capture the order
    result = await paypal_service.capture_order(data.order_id)
    
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error", "Failed to capture payment"))
    
    booking_id = data.booking_id or (order_record.get("booking_id") if order_record else None)
    
    # Update order record
    if order_record:
        await db.paypal_orders.update_one(
            {"paypal_order_id": data.order_id},
            {"$set": {
                "status": "captured",
                "transaction_id": result.get("transaction_id"),
                "payer": result.get("payer"),
                "captured_at": datetime.now(timezone.utc).isoformat()
            }}
        )
    
    # Update booking/inquiry status
    if booking_id:
        await db.bookings.update_one(
            {"id": booking_id},
            {"$set": {
                "payment_status": "paid",
                "status": "confirmed",
                "payment_method": "paypal",
                "paypal_order_id": data.order_id,
                "paypal_transaction_id": result.get("transaction_id"),
                "paid_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        await db.inquiries.update_one(
            {"id": booking_id},
            {"$set": {
                "payment_status": "paid",
                "status": "confirmed",
                "payment_method": "paypal",
                "paypal_order_id": data.order_id,
                "paypal_transaction_id": result.get("transaction_id"),
                "paid_at": datetime.now(timezone.utc).isoformat()
            }}
        )
    
    # Record transaction
    transaction = {
        "id": str(uuid.uuid4()),
        "type": "paypal_payment",
        "booking_id": booking_id,
        "user_id": current_user["id"],
        "paypal_order_id": data.order_id,
        "transaction_id": result.get("transaction_id"),
        "amount_usd": float(result.get("amount", 0)),
        "amount_inr": order_record.get("amount_inr") if order_record else convert_usd_to_inr(float(result.get("amount", 0))),
        "currency": result.get("currency", "USD"),
        "status": "completed",
        "payer": result.get("payer"),
        "mode": result.get("mode"),
        "mock_mode": result.get("mock_mode", False),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.transactions.insert_one(transaction.copy())
    
    return {
        "success": True,
        "message": "Payment captured successfully",
        "transaction_id": result.get("transaction_id"),
        "order_id": data.order_id,
        "status": "COMPLETED",
        "amount_usd": result.get("amount"),
        "amount_inr": transaction["amount_inr"],
        "payer": result.get("payer"),
        "booking_id": booking_id,
        "mode": result.get("mode"),
        "mock_mode": result.get("mock_mode", False)
    }


@router.get("/order/{order_id}")
async def get_paypal_order(
    order_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get PayPal order details"""
    db = get_database()
    
    # Get from our database first
    order_record = await db.paypal_orders.find_one(
        {"paypal_order_id": order_id},
        {"_id": 0}
    )
    
    # Get from PayPal
    paypal_result = await paypal_service.get_order(order_id)
    
    return {
        "success": True,
        "order": order_record,
        "paypal_status": paypal_result
    }


# ==================== WEBHOOK ENDPOINT ====================

@router.post("/webhook")
async def paypal_webhook(request: Request):
    """
    Handle PayPal webhook events
    
    Events handled:
    - PAYMENT.CAPTURE.COMPLETED
    - PAYMENT.CAPTURE.DENIED
    - CHECKOUT.ORDER.APPROVED
    """
    db = get_database()
    
    try:
        body = await request.json()
        event_type = body.get("event_type", "")
        resource = body.get("resource", {})
        
        logger.info(f"PayPal webhook received: {event_type}")
        
        # Log webhook
        webhook_log = {
            "id": str(uuid.uuid4()),
            "event_type": event_type,
            "resource_id": resource.get("id"),
            "payload": body,
            "received_at": datetime.now(timezone.utc).isoformat()
        }
        await db.paypal_webhooks.insert_one(webhook_log)
        
        # Handle events
        if event_type == "PAYMENT.CAPTURE.COMPLETED":
            # Payment captured successfully
            capture_id = resource.get("id")
            order_id = resource.get("supplementary_data", {}).get("related_ids", {}).get("order_id")
            
            if order_id:
                await db.paypal_orders.update_one(
                    {"paypal_order_id": order_id},
                    {"$set": {
                        "status": "captured",
                        "capture_id": capture_id,
                        "webhook_received": True,
                        "captured_at": datetime.now(timezone.utc).isoformat()
                    }}
                )
        
        elif event_type == "PAYMENT.CAPTURE.DENIED":
            # Payment denied
            order_id = resource.get("supplementary_data", {}).get("related_ids", {}).get("order_id")
            if order_id:
                await db.paypal_orders.update_one(
                    {"paypal_order_id": order_id},
                    {"$set": {"status": "denied", "webhook_received": True}}
                )
        
        elif event_type == "CHECKOUT.ORDER.APPROVED":
            # Order approved, ready for capture
            order_id = resource.get("id")
            if order_id:
                await db.paypal_orders.update_one(
                    {"paypal_order_id": order_id},
                    {"$set": {"status": "approved", "webhook_received": True}}
                )
        
        return {"status": "received", "event_type": event_type}
        
    except Exception as e:
        logger.error(f"PayPal webhook error: {e}")
        return {"status": "error", "message": str(e)}


# ==================== ADMIN ENDPOINTS ====================

@router.get("/admin/orders")
async def list_paypal_orders(
    status: Optional[str] = None,
    limit: int = Query(50, le=200),
    current_user: dict = Depends(require_roles(["admin", "super_admin"]))
):
    """List all PayPal orders (Admin)"""
    db = get_database()
    
    query = {}
    if status:
        query["status"] = status
    
    orders = await db.paypal_orders.find(query, {"_id": 0}).sort("created_at", -1).to_list(limit)
    
    # Get stats
    total = await db.paypal_orders.count_documents({})
    created = await db.paypal_orders.count_documents({"status": "created"})
    captured = await db.paypal_orders.count_documents({"status": "captured"})
    
    return {
        "success": True,
        "orders": orders,
        "stats": {
            "total": total,
            "created": created,
            "captured": captured
        }
    }


@router.get("/admin/transactions")
async def list_paypal_transactions(
    limit: int = Query(50, le=200),
    current_user: dict = Depends(require_roles(["admin", "super_admin"]))
):
    """List all PayPal transactions (Admin)"""
    db = get_database()
    
    transactions = await db.transactions.find(
        {"type": "paypal_payment"},
        {"_id": 0}
    ).sort("created_at", -1).to_list(limit)
    
    # Calculate totals
    total_usd = sum(t.get("amount_usd", 0) for t in transactions)
    total_inr = sum(t.get("amount_inr", 0) for t in transactions)
    
    return {
        "success": True,
        "transactions": transactions,
        "totals": {
            "count": len(transactions),
            "total_usd": round(total_usd, 2),
            "total_inr": round(total_inr, 2)
        }
    }
