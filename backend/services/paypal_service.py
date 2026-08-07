"""
AirYatra PayPal Payment Service
Sandbox/Test Mode Integration for International Payments
"""

import os
import logging
from datetime import datetime, timezone
from typing import Dict, Any, Optional
import uuid

# PayPal SDK
from paypalcheckoutsdk.core import PayPalHttpClient, SandboxEnvironment, LiveEnvironment
from paypalcheckoutsdk.orders import OrdersCreateRequest, OrdersCaptureRequest, OrdersGetRequest

logger = logging.getLogger(__name__)

class PayPalService:
    """PayPal payment service for AirYatra"""
    
    def __init__(self):
        self.client_id = os.environ.get("PAYPAL_CLIENT_ID", "")
        self.client_secret = os.environ.get("PAYPAL_CLIENT_SECRET", "")
        self.mode = os.environ.get("PAYPAL_MODE", "sandbox")  # sandbox or live
        self.client = None
        self._initialize_client()
    
    def _initialize_client(self):
        """Initialize PayPal client based on mode"""
        if not self.client_id or not self.client_secret:
            logger.warning("PayPal credentials not configured. Running in MOCK mode.")
            return
        
        try:
            if self.mode == "live":
                environment = LiveEnvironment(
                    client_id=self.client_id,
                    client_secret=self.client_secret
                )
            else:
                environment = SandboxEnvironment(
                    client_id=self.client_id,
                    client_secret=self.client_secret
                )
            
            self.client = PayPalHttpClient(environment)
            logger.info(f"PayPal client initialized in {self.mode} mode")
        except Exception as e:
            logger.error(f"Failed to initialize PayPal client: {e}")
            self.client = None
    
    def is_configured(self) -> bool:
        """Check if PayPal is properly configured"""
        return self.client is not None
    
    async def create_order(
        self,
        amount: float,
        currency: str = "USD",
        booking_id: str = None,
        description: str = "AirYatra Helicopter Booking",
        return_url: str = None,
        cancel_url: str = None
    ) -> Dict[str, Any]:
        """
        Create a PayPal order for payment
        
        Args:
            amount: Payment amount
            currency: Currency code (USD, EUR, GBP, etc.)
            booking_id: Reference booking ID
            description: Order description
            return_url: Success redirect URL
            cancel_url: Cancel redirect URL
        
        Returns:
            Order details with approval URL
        """
        # Mock mode if not configured
        if not self.is_configured():
            return self._mock_create_order(amount, currency, booking_id, description)
        
        try:
            request = OrdersCreateRequest()
            request.prefer("return=representation")
            
            order_body = {
                "intent": "CAPTURE",
                "purchase_units": [{
                    "reference_id": booking_id or str(uuid.uuid4()),
                    "description": description,
                    "amount": {
                        "currency_code": currency,
                        "value": f"{amount:.2f}"
                    },
                    "custom_id": booking_id
                }],
                "application_context": {
                    "brand_name": "AirYatra",
                    "landing_page": "BILLING",
                    "user_action": "PAY_NOW",
                    "shipping_preference": "NO_SHIPPING"
                }
            }
            
            # Add return/cancel URLs if provided
            if return_url and cancel_url:
                order_body["application_context"]["return_url"] = return_url
                order_body["application_context"]["cancel_url"] = cancel_url
            
            request.request_body(order_body)
            response = self.client.execute(request)
            
            # Extract approval URL
            approval_url = None
            for link in response.result.links:
                if link.rel == "approve":
                    approval_url = link.href
                    break
            
            return {
                "success": True,
                "order_id": response.result.id,
                "status": response.result.status,
                "approval_url": approval_url,
                "amount": amount,
                "currency": currency,
                "booking_id": booking_id,
                "mode": self.mode,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            
        except Exception as e:
            logger.error(f"PayPal create order error: {e}")
            return {
                "success": False,
                "error": str(e),
                "mode": self.mode
            }
    
    async def capture_order(self, order_id: str) -> Dict[str, Any]:
        """
        Capture a PayPal order after approval
        
        Args:
            order_id: PayPal order ID to capture
        
        Returns:
            Capture details with transaction ID
        """
        # Mock mode if not configured
        if not self.is_configured():
            return self._mock_capture_order(order_id)
        
        try:
            request = OrdersCaptureRequest(order_id)
            response = self.client.execute(request)
            
            result = response.result
            capture = result.purchase_units[0].payments.captures[0]
            
            return {
                "success": True,
                "order_id": result.id,
                "status": result.status,
                "transaction_id": capture.id,
                "amount": capture.amount.value,
                "currency": capture.amount.currency_code,
                "booking_id": result.purchase_units[0].reference_id,
                "payer": {
                    "email": result.payer.email_address if hasattr(result, 'payer') else None,
                    "name": f"{result.payer.name.given_name} {result.payer.name.surname}" if hasattr(result, 'payer') and hasattr(result.payer, 'name') else None,
                    "payer_id": result.payer.payer_id if hasattr(result, 'payer') else None
                },
                "captured_at": datetime.now(timezone.utc).isoformat(),
                "mode": self.mode
            }
            
        except Exception as e:
            logger.error(f"PayPal capture order error: {e}")
            return {
                "success": False,
                "error": str(e),
                "order_id": order_id,
                "mode": self.mode
            }
    
    async def get_order(self, order_id: str) -> Dict[str, Any]:
        """Get PayPal order details"""
        if not self.is_configured():
            return self._mock_get_order(order_id)
        
        try:
            request = OrdersGetRequest(order_id)
            response = self.client.execute(request)
            result = response.result
            
            return {
                "success": True,
                "order_id": result.id,
                "status": result.status,
                "amount": result.purchase_units[0].amount.value,
                "currency": result.purchase_units[0].amount.currency_code,
                "booking_id": result.purchase_units[0].reference_id,
                "mode": self.mode
            }
            
        except Exception as e:
            logger.error(f"PayPal get order error: {e}")
            return {
                "success": False,
                "error": str(e),
                "mode": self.mode
            }
    
    # ==================== MOCK METHODS ====================
    
    def _mock_create_order(self, amount: float, currency: str, booking_id: str, description: str) -> Dict:
        """Mock order creation for testing without credentials"""
        mock_order_id = f"MOCK-{uuid.uuid4().hex[:12].upper()}"
        return {
            "success": True,
            "order_id": mock_order_id,
            "status": "CREATED",
            "approval_url": f"https://www.sandbox.paypal.com/checkoutnow?token={mock_order_id}",
            "amount": amount,
            "currency": currency,
            "booking_id": booking_id,
            "mode": "MOCK",
            "mock_mode": True,
            "message": "PayPal running in MOCK mode. Configure PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET for real payments.",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
    
    def _mock_capture_order(self, order_id: str) -> Dict:
        """Mock order capture for testing"""
        return {
            "success": True,
            "order_id": order_id,
            "status": "COMPLETED",
            "transaction_id": f"MOCK-TXN-{uuid.uuid4().hex[:10].upper()}",
            "amount": "100.00",
            "currency": "USD",
            "booking_id": None,
            "payer": {
                "email": "mock-buyer@paypal.com",
                "name": "Mock Buyer",
                "payer_id": "MOCK-PAYER-123"
            },
            "captured_at": datetime.now(timezone.utc).isoformat(),
            "mode": "MOCK",
            "mock_mode": True,
            "message": "Mock capture successful. Configure PayPal credentials for real payments."
        }
    
    def _mock_get_order(self, order_id: str) -> Dict:
        """Mock get order for testing"""
        return {
            "success": True,
            "order_id": order_id,
            "status": "APPROVED",
            "amount": "100.00",
            "currency": "USD",
            "booking_id": None,
            "mode": "MOCK",
            "mock_mode": True
        }


# Singleton instance
paypal_service = PayPalService()


# Currency conversion helper (approximate rates)
CURRENCY_RATES = {
    "INR_TO_USD": 0.012,  # 1 INR = 0.012 USD
    "INR_TO_EUR": 0.011,
    "INR_TO_GBP": 0.0095,
    "USD_TO_INR": 83.0,
    "EUR_TO_INR": 90.0,
    "GBP_TO_INR": 105.0
}

def convert_inr_to_usd(inr_amount: float) -> float:
    """Convert INR to USD for PayPal (which doesn't support INR)"""
    return round(inr_amount * CURRENCY_RATES["INR_TO_USD"], 2)

def convert_usd_to_inr(usd_amount: float) -> float:
    """Convert USD back to INR for display"""
    return round(usd_amount * CURRENCY_RATES["USD_TO_INR"], 2)
