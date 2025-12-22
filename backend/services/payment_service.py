import os
import hashlib
import hmac
from typing import Optional, Dict
from datetime import datetime, timezone
from uuid import uuid4

# Razorpay Configuration
RAZORPAY_KEY_ID = os.environ.get("RAZORPAY_KEY_ID", "")
RAZORPAY_KEY_SECRET = os.environ.get("RAZORPAY_KEY_SECRET", "")

class PaymentService:
    def __init__(self):
        self.key_id = RAZORPAY_KEY_ID
        self.key_secret = RAZORPAY_KEY_SECRET
        self.client = None
        
        if self.key_id and self.key_secret and self.key_id != "your-razorpay-key-id":
            try:
                import razorpay
                self.client = razorpay.Client(auth=(self.key_id, self.key_secret))
            except ImportError:
                print("Razorpay SDK not installed")
    
    async def create_order(
        self,
        amount: int,  # Amount in paise (INR * 100)
        currency: str = "INR",
        booking_id: str = None,
        notes: Dict = None
    ) -> Dict:
        """Create a Razorpay order for payment"""
        
        if self.client:
            try:
                order_data = {
                    "amount": amount,
                    "currency": currency,
                    "receipt": f"booking_{booking_id}" if booking_id else f"order_{uuid4().hex[:8]}",
                    "notes": notes or {}
                }
                
                order = self.client.order.create(data=order_data)
                
                return {
                    "success": True,
                    "order_id": order["id"],
                    "amount": order["amount"],
                    "currency": order["currency"],
                    "key_id": self.key_id,
                    "mock": False
                }
            except Exception as e:
                print(f"Razorpay order creation error: {e}")
                return {"success": False, "error": str(e)}
        
        # Mock order for testing
        mock_order_id = f"order_{uuid4().hex[:16]}"
        return {
            "success": True,
            "order_id": mock_order_id,
            "amount": amount,
            "currency": currency,
            "key_id": "rzp_test_mock",
            "mock": True,
            "note": "Payment mocked - Razorpay credentials not configured"
        }
    
    async def verify_payment(
        self,
        razorpay_order_id: str,
        razorpay_payment_id: str,
        razorpay_signature: str
    ) -> Dict:
        """Verify Razorpay payment signature"""
        
        if self.client and self.key_secret:
            try:
                # Verify signature
                message = f"{razorpay_order_id}|{razorpay_payment_id}"
                generated_signature = hmac.new(
                    self.key_secret.encode(),
                    message.encode(),
                    hashlib.sha256
                ).hexdigest()
                
                if generated_signature == razorpay_signature:
                    # Fetch payment details
                    payment = self.client.payment.fetch(razorpay_payment_id)
                    
                    return {
                        "success": True,
                        "verified": True,
                        "payment_id": razorpay_payment_id,
                        "amount": payment.get("amount", 0) / 100,  # Convert paise to INR
                        "method": payment.get("method"),
                        "status": payment.get("status"),
                        "mock": False
                    }
                else:
                    return {
                        "success": False,
                        "verified": False,
                        "error": "Invalid signature"
                    }
            except Exception as e:
                print(f"Razorpay verification error: {e}")
                return {"success": False, "error": str(e)}
        
        # Mock verification
        return {
            "success": True,
            "verified": True,
            "payment_id": razorpay_payment_id or f"pay_{uuid4().hex[:16]}",
            "amount": 0,
            "method": "mock",
            "status": "captured",
            "mock": True,
            "note": "Payment verification mocked"
        }
    
    async def create_refund(
        self,
        payment_id: str,
        amount: Optional[int] = None,  # Partial refund amount in paise
        reason: str = "Customer request"
    ) -> Dict:
        """Create a refund for a payment"""
        
        if self.client:
            try:
                refund_data = {
                    "speed": "normal",
                    "notes": {"reason": reason}
                }
                if amount:
                    refund_data["amount"] = amount
                
                refund = self.client.payment.refund(payment_id, refund_data)
                
                return {
                    "success": True,
                    "refund_id": refund["id"],
                    "amount": refund.get("amount", 0) / 100,
                    "status": refund.get("status"),
                    "mock": False
                }
            except Exception as e:
                print(f"Razorpay refund error: {e}")
                return {"success": False, "error": str(e)}
        
        # Mock refund
        return {
            "success": True,
            "refund_id": f"rfnd_{uuid4().hex[:16]}",
            "amount": (amount or 0) / 100,
            "status": "processed",
            "mock": True,
            "note": "Refund mocked"
        }
    
    async def get_payment_methods(self) -> Dict:
        """Get available payment methods"""
        return {
            "methods": [
                {
                    "id": "upi",
                    "name": "UPI",
                    "description": "Pay using UPI apps like GPay, PhonePe, Paytm",
                    "icon": "upi",
                    "enabled": True
                },
                {
                    "id": "card",
                    "name": "Credit/Debit Card",
                    "description": "Pay using Visa, Mastercard, RuPay",
                    "icon": "card",
                    "enabled": True
                },
                {
                    "id": "netbanking",
                    "name": "Net Banking",
                    "description": "Pay directly from your bank account",
                    "icon": "bank",
                    "enabled": True
                },
                {
                    "id": "wallet",
                    "name": "Wallets",
                    "description": "Pay using Paytm, PhonePe wallet",
                    "icon": "wallet",
                    "enabled": True
                },
                {
                    "id": "emi",
                    "name": "EMI",
                    "description": "Pay in easy monthly installments",
                    "icon": "emi",
                    "enabled": True,
                    "min_amount": 300000  # Minimum INR 3000 for EMI
                }
            ],
            "razorpay_configured": bool(self.client)
        }

# Singleton instance
payment_service = PaymentService()
