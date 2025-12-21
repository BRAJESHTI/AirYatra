import razorpay
from fastapi import APIRouter, HTTPException, Depends
from database import get_database
from config import settings
from middleware import get_current_user
from email_service import email_service
import uuid
import logging
from datetime import datetime

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/payment", tags=["Payment"])

razorpay_client = razorpay.Client(auth=(settings.razorpay_key_id, settings.razorpay_key_secret))

@router.post("/create-order")
async def create_payment_order(data: dict, user: dict = Depends(get_current_user)):
    """Create Razorpay payment order"""
    db = get_database()
    
    booking = await db.bookings.find_one({"id": data["booking_id"]}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    if booking["customer_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    try:
        # Create Razorpay order
        amount = int(booking["total_amount"] * 100)  # Convert to paise
        order_data = {
            "amount": amount,
            "currency": "INR",
            "receipt": booking["booking_number"],
            "payment_capture": 1
        }
        
        razorpay_order = razorpay_client.order.create(data=order_data)
        
        # Save payment details
        payment = {
            "id": str(uuid.uuid4()),
            "booking_id": data["booking_id"],
            "razorpay_order_id": razorpay_order["id"],
            "amount": booking["total_amount"],
            "currency": "INR",
            "status": "created",
            "created_at": datetime.utcnow().isoformat()
        }
        
        await db.payments.insert_one(payment)
        
        # Update booking
        await db.bookings.update_one(
            {"id": data["booking_id"]},
            {"$set": {"status": "payment_pending"}}
        )
        
        return {
            "order_id": razorpay_order["id"],
            "amount": amount,
            "currency": "INR",
            "key_id": settings.razorpay_key_id
        }
    
    except Exception as e:
        logger.error(f"Error creating payment order: {e}")
        raise HTTPException(status_code=500, detail="Failed to create payment order")

@router.post("/verify")
async def verify_payment(data: dict, user: dict = Depends(get_current_user)):
    """Verify Razorpay payment signature"""
    db = get_database()
    
    try:
        # Verify signature
        params_dict = {
            'razorpay_order_id': data['razorpay_order_id'],
            'razorpay_payment_id': data['razorpay_payment_id'],
            'razorpay_signature': data['razorpay_signature']
        }
        
        razorpay_client.utility.verify_payment_signature(params_dict)
        
        # Update payment
        await db.payments.update_one(
            {"razorpay_order_id": data['razorpay_order_id']},
            {"$set": {
                "razorpay_payment_id": data['razorpay_payment_id'],
                "status": "success",
                "verified_at": datetime.utcnow().isoformat()
            }}
        )
        
        # Update booking
        payment = await db.payments.find_one({"razorpay_order_id": data['razorpay_order_id']}, {"_id": 0})
        if payment:
            await db.bookings.update_one(
                {"id": payment["booking_id"]},
                {"$set": {
                    "payment_id": data['razorpay_payment_id'],
                    "status": "payment_completed"
                }}
            )
            
            # Send confirmation email
            booking = await db.bookings.find_one({"id": payment["booking_id"]}, {"_id": 0})
            if booking:
                customer = await db.users.find_one({"id": booking["customer_id"]}, {"_id": 0})
                if customer:
                    email_service.send_booking_confirmation(customer["email"], booking)
        
        return {"status": "success", "message": "Payment verified"}
    
    except razorpay.errors.SignatureVerificationError as e:
        logger.error(f"Payment verification failed: {e}")
        raise HTTPException(status_code=400, detail="Payment verification failed")
    except Exception as e:
        logger.error(f"Error verifying payment: {e}")
        raise HTTPException(status_code=500, detail="Failed to verify payment")