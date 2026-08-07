from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import Optional, Dict
from datetime import datetime, timezone
from uuid import uuid4
from database import get_database
from middleware import get_current_user
from services.payment_service import payment_service
from services.notification_service import notification_service

# Email integration for booking confirmation
try:
    from services.booking_email_integration import on_booking_confirmed, on_payment_success
    BOOKING_EMAIL_AVAILABLE = True
except ImportError:
    BOOKING_EMAIL_AVAILABLE = False

router = APIRouter(prefix="/payments", tags=["Payments"])

class CreateOrderRequest(BaseModel):
    booking_id: str
    amount: float  # Amount in INR
    voucher_code: Optional[str] = None  # RWD loyalty voucher code

class VerifyPaymentRequest(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str
    booking_id: str

class RefundRequest(BaseModel):
    payment_id: str
    booking_id: str
    amount: Optional[float] = None  # Partial refund amount in INR
    reason: str = "Customer request"

@router.post("/create-order")
async def create_payment_order(
    request: CreateOrderRequest,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """Create a Razorpay order for booking payment"""
    
    # Try to find in inquiries first (new flow)
    booking = await db.inquiries.find_one({"id": request.booking_id}, {"_id": 0})
    is_inquiry = bool(booking)
    
    # If not found, try bookings collection
    if not booking:
        booking = await db.bookings.find_one({"id": request.booking_id}, {"_id": 0})
    
    if not booking:
        raise HTTPException(status_code=404, detail="Booking/Inquiry not found")
    
    if booking.get("customer_id") != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Apply loyalty voucher discount
    discount = 0.0
    voucher = None
    if request.voucher_code:
        from routes.loyalty_routes import validate_voucher_for_user
        voucher, error = await validate_voucher_for_user(db, current_user["id"], request.voucher_code)
        if error:
            raise HTTPException(status_code=400, detail=error)
        discount = min(float(voucher["value"]), request.amount)
    
    final_amount = max(1.0, request.amount - discount)
    
    # Convert INR to paise
    amount_paise = int(final_amount * 100)
    
    result = await payment_service.create_order(
        amount=amount_paise,
        currency="INR",
        booking_id=request.booking_id,
        notes={
            "booking_id": request.booking_id,
            "customer_id": current_user["id"],
            "customer_email": current_user.get("email"),
            "is_inquiry": is_inquiry,
            "voucher_code": voucher["code"] if voucher else None
        }
    )
    
    if result["success"]:
        # Store order in database
        await db.payment_orders.insert_one({
            "id": str(uuid4()),
            "order_id": result["order_id"],
            "booking_id": request.booking_id,
            "is_inquiry": is_inquiry,
            "customer_id": current_user["id"],
            "amount": final_amount,
            "original_amount": request.amount,
            "voucher_code": voucher["code"] if voucher else None,
            "voucher_discount": discount,
            "amount_paise": amount_paise,
            "status": "created",
            "mock": result.get("mock", False),
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        result["original_amount"] = request.amount
        result["discount"] = discount
        result["final_amount"] = final_amount
        result["voucher_code"] = voucher["code"] if voucher else None
    
    return result

@router.post("/verify")
async def verify_payment(
    request: VerifyPaymentRequest,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """Verify Razorpay payment after completion"""
    
    result = await payment_service.verify_payment(
        razorpay_order_id=request.razorpay_order_id,
        razorpay_payment_id=request.razorpay_payment_id,
        razorpay_signature=request.razorpay_signature
    )
    
    if result.get("verified"):
        # Get payment order to check if it's an inquiry
        payment_order = await db.payment_orders.find_one(
            {"order_id": request.razorpay_order_id},
            {"_id": 0}
        )
        is_inquiry = payment_order.get("is_inquiry", False) if payment_order else False
        
        update_data = {
            "payment_status": "paid",
            "payment_id": request.razorpay_payment_id,
            "payment_order_id": request.razorpay_order_id,
            "paid_at": datetime.now(timezone.utc).isoformat(),
            "status": "confirmed",
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        # Update inquiry or booking
        if is_inquiry:
            await db.inquiries.update_one(
                {"id": request.booking_id},
                {"$set": update_data}
            )
            booking = await db.inquiries.find_one({"id": request.booking_id}, {"_id": 0})
        else:
            # Try inquiries first, then bookings (for new flow)
            update_result = await db.inquiries.update_one(
                {"id": request.booking_id},
                {"$set": update_data}
            )
            if update_result.modified_count == 0:
                await db.bookings.update_one(
                    {"id": request.booking_id},
                    {"$set": update_data}
                )
                booking = await db.bookings.find_one({"id": request.booking_id}, {"_id": 0})
            else:
                booking = await db.inquiries.find_one({"id": request.booking_id}, {"_id": 0})
        
        # Update payment order
        await db.payment_orders.update_one(
            {"order_id": request.razorpay_order_id},
            {"$set": {
                "status": "paid",
                "payment_id": request.razorpay_payment_id,
                "verified_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        # Mark applied loyalty voucher as used
        if payment_order and payment_order.get("voucher_code"):
            await db.reward_redemptions.update_one(
                {"code": payment_order["voucher_code"], "status": "active"},
                {"$set": {
                    "status": "used",
                    "used_at": datetime.now(timezone.utc).isoformat(),
                    "used_for_booking": request.booking_id
                }}
            )
        
        # Send confirmation notifications
        if booking:
            await notification_service.send_booking_confirmation(
                booking=booking,
                customer_email=current_user.get("email"),
                customer_phone=current_user.get("phone")
            )
            
            # Send booking confirmation email with tracking
            if BOOKING_EMAIL_AVAILABLE:
                try:
                    customer = {
                        "id": current_user.get("id"),
                        "name": current_user.get("full_name", current_user.get("name", "Valued Customer")),
                        "email": current_user.get("email"),
                        "phone": current_user.get("phone"),
                        "preferences": current_user.get("preferences", {})
                    }
                    
                    # Send booking confirmation email
                    email_result = await on_booking_confirmed(booking, customer, db)
                    
                    # Send payment receipt email
                    if payment_order:
                        payment_data = {
                            "transaction_id": request.razorpay_payment_id,
                            "amount": payment_order.get("amount"),
                            "method": "Razorpay",
                            "gst_amount": str(round(float(payment_order.get("amount", 0)) * 0.18 / 1.18, 2))
                        }
                        await on_payment_success(payment_data, booking, customer, db)
                    
                    result["email_sent"] = email_result.get("success", False)
                except Exception as e:
                    # Don't fail payment verification if email fails
                    result["email_error"] = str(e)
    
    return result

@router.post("/refund")
async def create_refund(
    request: RefundRequest,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """Create a refund for a payment"""
    
    # Verify booking
    booking = await db.bookings.find_one({"id": request.booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    # Only allow customer or admin to refund
    if booking.get("customer_id") != current_user["id"] and "admin" not in current_user.get("roles", []):
        raise HTTPException(status_code=403, detail="Not authorized")
    
    amount_paise = int(request.amount * 100) if request.amount else None
    
    result = await payment_service.create_refund(
        payment_id=request.payment_id,
        amount=amount_paise,
        reason=request.reason
    )
    
    if result.get("success"):
        # Update booking
        await db.bookings.update_one(
            {"id": request.booking_id},
            {"$set": {
                "refund_status": "processed",
                "refund_id": result.get("refund_id"),
                "refund_amount": result.get("amount"),
                "refund_reason": request.reason,
                "refunded_at": datetime.now(timezone.utc).isoformat()
            }}
        )
    
    return result

@router.get("/methods")
async def get_payment_methods(
    current_user: dict = Depends(get_current_user)
):
    """Get available payment methods"""
    return await payment_service.get_payment_methods()

@router.get("/order/{order_id}/status")
async def get_order_status(
    order_id: str,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """Get payment order status"""
    order = await db.payment_orders.find_one({"order_id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    return order
