"""
AirYatra Stripe Payment Service
Multi-currency international payments via Stripe
"""

import os
import stripe
import logging
from datetime import datetime, timezone
from typing import Dict, Any, Optional
from uuid import uuid4

logger = logging.getLogger(__name__)

# Initialize Stripe
STRIPE_API_KEY = os.environ.get("STRIPE_API_KEY", "")
STRIPE_WEBHOOK_SECRET = os.environ.get("STRIPE_WEBHOOK_SECRET", "")

if STRIPE_API_KEY:
    stripe.api_key = STRIPE_API_KEY
    logger.info("[Stripe] Initialized with API key")
else:
    logger.warning("[Stripe] No API key configured")


class StripePaymentService:
    """Stripe payment service for multi-currency checkout"""
    
    def __init__(self):
        self.configured = bool(STRIPE_API_KEY)
        self.supported_currencies = ['usd', 'eur', 'gbp', 'aud', 'cad', 'sgd', 'aed', 'jpy']
    
    def get_status(self) -> Dict[str, Any]:
        """Get Stripe configuration status"""
        return {
            "configured": self.configured,
            "mode": "TEST" if "test" in STRIPE_API_KEY.lower() else "LIVE" if self.configured else "NOT_CONFIGURED",
            "key_preview": STRIPE_API_KEY[:12] + "..." if STRIPE_API_KEY else None,
            "supported_currencies": self.supported_currencies
        }
    
    async def create_checkout_session(
        self,
        amount: int,  # Amount in smallest currency unit (cents for USD)
        currency: str,
        booking_id: str,
        customer_email: str,
        customer_name: str,
        description: str,
        success_url: str,
        cancel_url: str,
        metadata: Optional[Dict] = None
    ) -> Dict[str, Any]:
        """
        Create a Stripe Checkout Session for payment
        
        Args:
            amount: Amount in smallest currency unit (e.g., 1000 = $10.00)
            currency: Currency code (usd, eur, gbp, etc.)
            booking_id: AirYatra booking ID
            customer_email: Customer email for receipt
            customer_name: Customer name
            description: Payment description
            success_url: Redirect URL on success
            cancel_url: Redirect URL on cancel
            metadata: Additional metadata
        
        Returns:
            Dict with session_id and checkout_url
        """
        if not self.configured:
            return {
                "success": False,
                "error": "Stripe not configured. Add STRIPE_API_KEY to environment.",
                "mock": True
            }
        
        currency = currency.lower()
        if currency not in self.supported_currencies:
            return {
                "success": False,
                "error": f"Currency {currency} not supported. Supported: {', '.join(self.supported_currencies)}"
            }
        
        try:
            session = stripe.checkout.Session.create(
                payment_method_types=['card'],
                line_items=[{
                    'price_data': {
                        'currency': currency,
                        'product_data': {
                            'name': f'AirYatra Booking #{booking_id[:8]}',
                            'description': description,
                        },
                        'unit_amount': amount,
                    },
                    'quantity': 1,
                }],
                mode='payment',
                success_url=success_url + '?session_id={CHECKOUT_SESSION_ID}',
                cancel_url=cancel_url,
                customer_email=customer_email,
                metadata={
                    'booking_id': booking_id,
                    'customer_name': customer_name,
                    'platform': 'airyatra',
                    **(metadata or {})
                },
                payment_intent_data={
                    'metadata': {
                        'booking_id': booking_id,
                        'customer_name': customer_name
                    }
                }
            )
            
            logger.info(f"[Stripe] Checkout session created: {session.id} for booking {booking_id}")
            
            return {
                "success": True,
                "session_id": session.id,
                "checkout_url": session.url,
                "amount": amount,
                "currency": currency,
                "booking_id": booking_id,
                "expires_at": datetime.fromtimestamp(session.expires_at, tz=timezone.utc).isoformat()
            }
            
        except stripe.error.StripeError as e:
            logger.error(f"[Stripe] Error creating session: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    async def create_payment_intent(
        self,
        amount: int,
        currency: str,
        booking_id: str,
        customer_email: str,
        metadata: Optional[Dict] = None
    ) -> Dict[str, Any]:
        """
        Create a Stripe PaymentIntent for custom checkout flow
        """
        if not self.configured:
            return {"success": False, "error": "Stripe not configured", "mock": True}
        
        try:
            intent = stripe.PaymentIntent.create(
                amount=amount,
                currency=currency.lower(),
                metadata={
                    'booking_id': booking_id,
                    'platform': 'airyatra',
                    **(metadata or {})
                },
                receipt_email=customer_email,
                automatic_payment_methods={'enabled': True}
            )
            
            return {
                "success": True,
                "client_secret": intent.client_secret,
                "payment_intent_id": intent.id,
                "amount": amount,
                "currency": currency
            }
            
        except stripe.error.StripeError as e:
            logger.error(f"[Stripe] PaymentIntent error: {e}")
            return {"success": False, "error": str(e)}
    
    async def verify_session(self, session_id: str) -> Dict[str, Any]:
        """Verify a completed checkout session"""
        if not self.configured:
            return {"success": False, "error": "Stripe not configured"}
        
        try:
            session = stripe.checkout.Session.retrieve(session_id)
            
            return {
                "success": True,
                "session_id": session.id,
                "payment_status": session.payment_status,
                "payment_intent": session.payment_intent,
                "amount_total": session.amount_total,
                "currency": session.currency,
                "customer_email": session.customer_details.email if session.customer_details else None,
                "metadata": session.metadata,
                "paid": session.payment_status == 'paid'
            }
            
        except stripe.error.StripeError as e:
            logger.error(f"[Stripe] Session verification error: {e}")
            return {"success": False, "error": str(e)}
    
    async def get_payment_intent(self, payment_intent_id: str) -> Dict[str, Any]:
        """Get payment intent details"""
        if not self.configured:
            return {"success": False, "error": "Stripe not configured"}
        
        try:
            intent = stripe.PaymentIntent.retrieve(payment_intent_id)
            
            return {
                "success": True,
                "id": intent.id,
                "status": intent.status,
                "amount": intent.amount,
                "currency": intent.currency,
                "metadata": intent.metadata,
                "paid": intent.status == 'succeeded'
            }
            
        except stripe.error.StripeError as e:
            return {"success": False, "error": str(e)}
    
    async def create_refund(
        self,
        payment_intent_id: str,
        amount: Optional[int] = None,  # None = full refund
        reason: str = "requested_by_customer"
    ) -> Dict[str, Any]:
        """Create a refund for a Stripe payment"""
        if not self.configured:
            return {"success": False, "error": "Stripe not configured"}
        
        try:
            refund_params = {
                'payment_intent': payment_intent_id,
                'reason': reason
            }
            
            if amount:
                refund_params['amount'] = amount
            
            refund = stripe.Refund.create(**refund_params)
            
            logger.info(f"[Stripe] Refund created: {refund.id}")
            
            return {
                "success": True,
                "refund_id": refund.id,
                "amount": refund.amount,
                "currency": refund.currency,
                "status": refund.status
            }
            
        except stripe.error.StripeError as e:
            logger.error(f"[Stripe] Refund error: {e}")
            return {"success": False, "error": str(e)}
    
    def construct_webhook_event(self, payload: bytes, signature: str) -> Optional[stripe.Event]:
        """Construct and verify a webhook event"""
        if not STRIPE_WEBHOOK_SECRET:
            logger.warning("[Stripe] Webhook secret not configured")
            return None
        
        try:
            event = stripe.Webhook.construct_event(
                payload, signature, STRIPE_WEBHOOK_SECRET
            )
            return event
        except Exception as e:
            logger.error(f"[Stripe] Webhook verification failed: {e}")
            return None


# Singleton instance
stripe_service = StripePaymentService()
