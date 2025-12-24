import os
import hashlib
import hmac
from typing import Optional, Dict
from datetime import datetime, timezone
from uuid import uuid4

class PaymentService:
    def __init__(self):
        # Default to environment variables, but can be overridden by database settings
        self.key_id = os.environ.get("RAZORPAY_KEY_ID", "")
        self.key_secret = os.environ.get("RAZORPAY_KEY_SECRET", "")
        self.client = None
        self._db_settings_loaded = False
    
    async def _load_api_keys_from_db(self, db):
        """Load API keys from database settings - Admin configured keys take priority"""
        if self._db_settings_loaded and self.client:
            return
        
        try:
            api_settings = await db.api_keys_settings.find_one({"type": "api_keys"}, {"_id": 0})
            if api_settings:
                # Razorpay
                if api_settings.get("razorpay_key_id"):
                    self.key_id = api_settings["razorpay_key_id"]
                if api_settings.get("razorpay_key_secret"):
                    self.key_secret = api_settings["razorpay_key_secret"]
                
                # Initialize Razorpay client if keys available
                if self.key_id and self.key_secret and len(self.key_id) > 10:
                    try:
                        import razorpay
                        self.client = razorpay.Client(auth=(self.key_id, self.key_secret))
                        print("[PaymentService] Razorpay client initialized from DB settings")
                    except ImportError:
                        print("[PaymentService] Razorpay SDK not installed")
                
                self._db_settings_loaded = True
        except Exception as e:
            print(f"[PaymentService] Error loading API keys from DB: {e}")
    
    def reset_settings_cache(self):
        """Reset settings cache to force reload from database"""
        self._db_settings_loaded = False
        self.client = None
    
    async def create_order(
        self,
        amount: int,  # Amount in paise (INR * 100)
        currency: str = "INR",
        booking_id: str = None,
        notes: Dict = None,
        db=None
    ) -> Dict:
        """Create a Razorpay order for payment"""
        
        # Load keys from DB if provided
        if db:
            await self._load_api_keys_from_db(db)
        
        if self.client:
            try:
                order_data = {
                    "amount": amount,
                    "currency": currency,
                    "receipt": f"booking_{booking_id}" if booking_id else f"order_{uuid4().hex[:8]}",
                    "notes": notes or {}
                }
                
                order = self.client.order.create(data=order_data)
                
                print(f"[Razorpay] Order created: {order['id']}, Amount: ₹{amount/100}")
                
                return {
                    "success": True,
                    "order_id": order["id"],
                    "amount": order["amount"],
                    "currency": order["currency"],
                    "key_id": self.key_id,
                    "mock": False
                }
            except Exception as e:
                print(f"[Razorpay] Order creation error: {e}")
                return {"success": False, "error": str(e)}
        
        # Mock order for testing
        mock_order_id = f"order_{uuid4().hex[:16]}"
        print(f"[MOCK PAYMENT] Order created: {mock_order_id}, Amount: ₹{amount/100}")
        
        return {
            "success": True,
            "order_id": mock_order_id,
            "amount": amount,
            "currency": currency,
            "key_id": "rzp_test_mock",
            "mock": True,
            "note": "Payment mocked - Configure Razorpay credentials in Admin Settings → API Keys"
        }
    
    async def verify_payment(
        self,
        razorpay_order_id: str,
        razorpay_payment_id: str,
        razorpay_signature: str,
        db=None
    ) -> Dict:
        """Verify Razorpay payment signature"""
        
        if db:
            await self._load_api_keys_from_db(db)
        
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
                    
                    print(f"[Razorpay] Payment verified: {razorpay_payment_id}")
                    
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
                print(f"[Razorpay] Verification error: {e}")
                return {"success": False, "error": str(e)}
        
        # Mock verification
        print(f"[MOCK PAYMENT] Verification for payment: {razorpay_payment_id}")
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
        reason: str = "Customer request",
        db=None
    ) -> Dict:
        """Create a refund for a payment"""
        
        if db:
            await self._load_api_keys_from_db(db)
        
        if self.client:
            try:
                refund_data = {
                    "speed": "normal",
                    "notes": {"reason": reason}
                }
                if amount:
                    refund_data["amount"] = amount
                
                refund = self.client.payment.refund(payment_id, refund_data)
                
                print(f"[Razorpay] Refund created: {refund['id']}")
                
                return {
                    "success": True,
                    "refund_id": refund["id"],
                    "amount": refund.get("amount", 0) / 100,
                    "status": refund.get("status"),
                    "mock": False
                }
            except Exception as e:
                print(f"[Razorpay] Refund error: {e}")
                return {"success": False, "error": str(e)}
        
        # Mock refund
        mock_refund_id = f"rfnd_{uuid4().hex[:16]}"
        print(f"[MOCK PAYMENT] Refund created: {mock_refund_id}")
        
        return {
            "success": True,
            "refund_id": mock_refund_id,
            "amount": (amount or 0) / 100,
            "status": "processed",
            "mock": True,
            "note": "Refund mocked"
        }
    
    async def get_payment_status(self, db=None) -> Dict:
        """Get payment service status"""
        
        if db:
            await self._load_api_keys_from_db(db)
        
        return {
            "razorpay_configured": bool(self.client),
            "key_id_set": bool(self.key_id and len(self.key_id) > 10),
            "mock_mode": not bool(self.client)
        }
    
    async def get_payment_methods(self, db=None) -> Dict:
        """Get available payment methods"""
        
        if db:
            await self._load_api_keys_from_db(db)
        
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
            "razorpay_configured": bool(self.client),
            "mock_mode": not bool(self.client)
        }

# Singleton instance
payment_service = PaymentService()
