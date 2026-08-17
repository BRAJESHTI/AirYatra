"""
AirYatra Cashfree Payment Service
Sandbox/Test Mode Integration for Indian Payments
"""

import os
import logging
import httpx
import uuid
import hashlib
import hmac
import base64
from datetime import datetime, timezone
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)

class CashfreeService:
    """Cashfree payment service for AirYatra"""
    
    def __init__(self):
        self.client_id = os.environ.get("CASHFREE_CLIENT_ID", "")
        self.client_secret = os.environ.get("CASHFREE_CLIENT_SECRET", "")
        self.api_version = os.environ.get("CASHFREE_API_VERSION", "2023-08-01")
        self.mode = os.environ.get("CASHFREE_MODE", "sandbox")
        
        # Set base URL based on mode
        if self.mode == "production":
            self.base_url = "https://api.cashfree.com/pg"
        else:
            self.base_url = "https://sandbox.cashfree.com/pg"
        
        self._log_config()
    
    def _log_config(self):
        if self.is_configured():
            logger.info(f"Cashfree initialized in {self.mode} mode")
        else:
            logger.warning("Cashfree credentials not configured. Running in MOCK mode.")
    
    def is_configured(self) -> bool:
        """Check if Cashfree is properly configured"""
        return bool(self.client_id and self.client_secret)
    
    def _get_headers(self, idempotency_key: str = None) -> Dict[str, str]:
        """Get headers for Cashfree API requests"""
        headers = {
            "accept": "application/json",
            "content-type": "application/json",
            "x-api-version": self.api_version,
            "x-client-id": self.client_id,
            "x-client-secret": self.client_secret,
        }
        if idempotency_key:
            headers["x-idempotency-key"] = idempotency_key
        return headers
    
    async def _request(self, method: str, path: str, body: Dict = None, idempotency_key: str = None) -> Dict:
        """Make request to Cashfree API"""
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.request(
                method,
                f"{self.base_url}{path}",
                headers=self._get_headers(idempotency_key),
                json=body
            )
            
            if response.status_code >= 400:
                logger.error(f"Cashfree API error: {response.status_code} - {response.text}")
                return {"success": False, "error": response.text, "status_code": response.status_code}
            
            return {"success": True, **response.json()}
    
    async def create_order(
        self,
        amount: float,
        booking_id: str,
        customer_id: str,
        customer_name: str,
        customer_email: str,
        customer_phone: str,
        return_url: str = None,
        notify_url: str = None
    ) -> Dict[str, Any]:
        """
        Create a Cashfree order for payment
        
        Args:
            amount: Payment amount in INR
            booking_id: Reference booking ID
            customer_*: Customer details
            return_url: Redirect URL after payment
            notify_url: Webhook notification URL
        
        Returns:
            Order details with payment_session_id
        """
        # Mock mode if not configured
        if not self.is_configured():
            return self._mock_create_order(amount, booking_id, customer_name, customer_email)
        
        try:
            order_id = f"CF_{booking_id}_{uuid.uuid4().hex[:8]}"
            
            payload = {
                "order_id": order_id,
                "order_amount": float(amount),
                "order_currency": "INR",
                "customer_details": {
                    "customer_id": customer_id,
                    "customer_name": customer_name,
                    "customer_email": customer_email,
                    "customer_phone": customer_phone,
                },
                "order_meta": {}
            }
            
            if return_url:
                payload["order_meta"]["return_url"] = return_url
            if notify_url:
                payload["order_meta"]["notify_url"] = notify_url
            
            result = await self._request("POST", "/orders", body=payload, idempotency_key=order_id)
            
            if not result.get("success"):
                return result
            
            return {
                "success": True,
                "order_id": order_id,
                "cf_order_id": result.get("cf_order_id"),
                "payment_session_id": result.get("payment_session_id"),
                "order_status": result.get("order_status"),
                "amount": amount,
                "currency": "INR",
                "booking_id": booking_id,
                "mode": self.mode,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            
        except Exception as e:
            logger.error(f"Cashfree create order error: {e}")
            return {"success": False, "error": str(e)}
    
    async def pay_upi_collect(self, payment_session_id: str, upi_id: str) -> Dict[str, Any]:
        """Initiate a UPI Collect request to a specific VPA (GPay/PhonePe approval popup)"""
        if not self.is_configured():
            return {"success": True, "cf_payment_id": f"mock_pay_{uuid.uuid4().hex[:10]}",
                    "action": "custom", "mode": "MOCK", "mock_mode": True,
                    "message": "MOCK collect request (configure Cashfree keys for real UPI)"}
        try:
            payload = {
                "payment_session_id": payment_session_id,
                "payment_method": {
                    "upi": {"channel": "collect", "upi_id": upi_id, "upi_expiry_minutes": 10}
                }
            }
            return await self._request("POST", "/orders/sessions", body=payload,
                                       idempotency_key=str(uuid.uuid4()))
        except Exception as e:
            logger.error(f"Cashfree UPI collect error: {e}")
            return {"success": False, "error": str(e)}

    async def create_payment_link(self, link_id: str, amount: float, purpose: str,
                                  customer_name: str, customer_email: str, customer_phone: str,
                                  return_url: str = None, notify_url: str = None) -> Dict[str, Any]:
        """Create a Cashfree Payment Link (hosted on Cashfree's own domain — no whitelisting needed)"""
        if not self.is_configured():
            return {"success": True, "link_id": link_id, "link_url": f"https://mock.cashfree/{link_id}",
                    "link_status": "ACTIVE", "mode": "MOCK", "mock_mode": True}
        try:
            payload = {
                "link_id": link_id,
                "link_amount": float(amount),
                "link_currency": "INR",
                "link_purpose": purpose[:500],
                "customer_details": {
                    "customer_name": customer_name,
                    "customer_email": customer_email,
                    "customer_phone": customer_phone,
                },
                "link_notify": {"send_sms": False, "send_email": False},
                "link_meta": {}
            }
            if return_url:
                payload["link_meta"]["return_url"] = return_url
            if notify_url:
                payload["link_meta"]["notify_url"] = notify_url
            result = await self._request("POST", "/links", body=payload, idempotency_key=link_id)
            if not result.get("success"):
                return result
            return {"success": True, "link_id": link_id, "cf_link_id": result.get("cf_link_id"),
                    "link_url": result.get("link_url"), "link_qrcode": result.get("link_qrcode"),
                    "link_status": result.get("link_status"), "mode": self.mode}
        except Exception as e:
            logger.error(f"Cashfree payment link error: {e}")
            return {"success": False, "error": str(e)}

    async def get_payment_link(self, link_id: str) -> Dict[str, Any]:
        """Get payment link status (PAID/ACTIVE/EXPIRED)"""
        if not self.is_configured():
            return {"success": True, "link_status": "PAID", "mock_mode": True}
        try:
            return await self._request("GET", f"/links/{link_id}")
        except Exception as e:
            return {"success": False, "error": str(e)}

    async def get_link_orders(self, link_id: str) -> Any:
        """Orders created against a payment link (for payment proof)"""
        if not self.is_configured():
            return {"success": True, "data": []}
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                response = await client.get(f"{self.base_url}/links/{link_id}/orders",
                                            headers=self._get_headers())
            if response.status_code >= 400:
                return {"success": False, "error": response.text}
            return {"success": True, "data": response.json()}
        except Exception as e:
            return {"success": False, "error": str(e)}

    async def get_order(self, order_id: str) -> Dict[str, Any]:
        """Get order details from Cashfree"""
        if not self.is_configured():
            return self._mock_get_order(order_id)
        
        try:
            result = await self._request("GET", f"/orders/{order_id}")
            return result
        except Exception as e:
            logger.error(f"Cashfree get order error: {e}")
            return {"success": False, "error": str(e)}
    
    async def get_payments(self, order_id: str) -> Dict[str, Any]:
        """Get payment details for an order"""
        if not self.is_configured():
            return self._mock_get_payments(order_id)
        
        try:
            result = await self._request("GET", f"/orders/{order_id}/payments")
            return result
        except Exception as e:
            logger.error(f"Cashfree get payments error: {e}")
            return {"success": False, "error": str(e)}
    
    async def verify_payment(self, order_id: str) -> Dict[str, Any]:
        """Verify payment status for an order"""
        if not self.is_configured():
            return self._mock_verify_payment(order_id)
        
        try:
            # Get order status
            order = await self._request("GET", f"/orders/{order_id}")
            if not order.get("success"):
                return order
            
            # Get payment details
            payments_resp = await self._request("GET", f"/orders/{order_id}/payments")
            payments = payments_resp if isinstance(payments_resp, list) else payments_resp.get("data", [])
            
            # Find successful payment
            successful = next(
                (p for p in payments if p.get("payment_status") == "SUCCESS"),
                None
            )
            
            is_paid = order.get("order_status") == "PAID" and successful
            
            return {
                "success": True,
                "order_id": order_id,
                "order_status": order.get("order_status"),
                "is_paid": is_paid,
                "payment": successful,
                "cf_payment_id": successful.get("cf_payment_id") if successful else None,
                "payment_method": successful.get("payment_method") if successful else None,
                "mode": self.mode
            }
            
        except Exception as e:
            logger.error(f"Cashfree verify payment error: {e}")
            return {"success": False, "error": str(e)}
    
    async def create_refund(
        self,
        order_id: str,
        refund_amount: float,
        refund_note: str = "Customer refund",
        refund_speed: str = "STANDARD"
    ) -> Dict[str, Any]:
        """
        Create a refund for an order
        
        Args:
            order_id: Cashfree order ID
            refund_amount: Amount to refund
            refund_note: Reason for refund
            refund_speed: STANDARD or INSTANT
        
        Returns:
            Refund details
        """
        if not self.is_configured():
            return self._mock_create_refund(order_id, refund_amount, refund_note)
        
        try:
            refund_id = f"refund_{uuid.uuid4().hex[:12]}"
            
            payload = {
                "refund_amount": float(refund_amount),
                "refund_id": refund_id,
                "refund_note": refund_note,
                "refund_speed": refund_speed
            }
            
            result = await self._request(
                "POST", 
                f"/orders/{order_id}/refunds", 
                body=payload, 
                idempotency_key=refund_id
            )
            
            if not result.get("success"):
                return result
            
            return {
                "success": True,
                "refund_id": refund_id,
                "cf_refund_id": result.get("cf_refund_id"),
                "refund_status": result.get("refund_status"),
                "refund_amount": refund_amount,
                "order_id": order_id,
                "mode": self.mode,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            
        except Exception as e:
            logger.error(f"Cashfree create refund error: {e}")
            return {"success": False, "error": str(e)}
    
    async def get_refund(self, order_id: str, refund_id: str) -> Dict[str, Any]:
        """Get refund status"""
        if not self.is_configured():
            return {"success": True, "refund_status": "SUCCESS", "mock_mode": True}
        
        try:
            result = await self._request("GET", f"/orders/{order_id}/refunds/{refund_id}")
            return result
        except Exception as e:
            logger.error(f"Cashfree get refund error: {e}")
            return {"success": False, "error": str(e)}
    
    def verify_webhook(self, raw_body: bytes, timestamp: str, signature: str) -> bool:
        """Verify Cashfree webhook signature"""
        webhook_secret = os.environ.get("CASHFREE_WEBHOOK_SECRET", "") or self.client_secret
        if not webhook_secret:
            logger.warning("Webhook secret not configured")
            return True  # Allow in dev/mock mode only
        
        try:
            expected = base64.b64encode(
                hmac.new(
                    webhook_secret.encode(),
                    timestamp.encode() + raw_body,
                    hashlib.sha256
                ).digest()
            ).decode()
            return hmac.compare_digest(expected, signature)
        except Exception as e:
            logger.error(f"Webhook verification error: {e}")
            return False
    
    # ==================== MOCK METHODS ====================
    
    def _mock_create_order(self, amount: float, booking_id: str, customer_name: str, customer_email: str) -> Dict:
        """Mock order creation for testing"""
        mock_order_id = f"MOCK_CF_{uuid.uuid4().hex[:12].upper()}"
        return {
            "success": True,
            "order_id": mock_order_id,
            "cf_order_id": f"cf_{mock_order_id}",
            "payment_session_id": f"session_{uuid.uuid4().hex[:16]}",
            "order_status": "ACTIVE",
            "amount": amount,
            "currency": "INR",
            "booking_id": booking_id,
            "mode": "MOCK",
            "mock_mode": True,
            "message": "Cashfree running in MOCK mode. Configure credentials for real payments.",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
    
    def _mock_get_order(self, order_id: str) -> Dict:
        """Mock get order"""
        return {
            "success": True,
            "order_id": order_id,
            "order_status": "PAID",
            "order_amount": 100.00,
            "mode": "MOCK",
            "mock_mode": True
        }
    
    def _mock_get_payments(self, order_id: str) -> Dict:
        """Mock get payments"""
        return {
            "success": True,
            "data": [{
                "cf_payment_id": f"mock_pay_{uuid.uuid4().hex[:8]}",
                "payment_status": "SUCCESS",
                "payment_amount": 100.00,
                "payment_method": "upi"
            }],
            "mode": "MOCK",
            "mock_mode": True
        }
    
    def _mock_verify_payment(self, order_id: str) -> Dict:
        """Mock verify payment"""
        return {
            "success": True,
            "order_id": order_id,
            "order_status": "PAID",
            "is_paid": True,
            "payment": {
                "cf_payment_id": f"mock_pay_{uuid.uuid4().hex[:8]}",
                "payment_status": "SUCCESS",
                "payment_amount": 100.00,
                "payment_method": "upi"
            },
            "mode": "MOCK",
            "mock_mode": True,
            "message": "Mock payment verified"
        }
    
    def _mock_create_refund(self, order_id: str, refund_amount: float, refund_note: str) -> Dict:
        """Mock create refund"""
        return {
            "success": True,
            "refund_id": f"mock_refund_{uuid.uuid4().hex[:10]}",
            "cf_refund_id": f"cf_refund_{uuid.uuid4().hex[:8]}",
            "refund_status": "SUCCESS",
            "refund_amount": refund_amount,
            "order_id": order_id,
            "mode": "MOCK",
            "mock_mode": True,
            "message": "Mock refund processed"
        }


# Singleton instance
cashfree_service = CashfreeService()
