"""
AirYatra Firebase Push Notification Service (Mock Mode)
Handles push notifications for mobile alerts

MOCK MODE: This service simulates push notifications.
To enable live mode, add Firebase credentials to .env:
- FIREBASE_PROJECT_ID
- FIREBASE_PRIVATE_KEY
- FIREBASE_CLIENT_EMAIL
"""

import os
import logging
import uuid
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional

logger = logging.getLogger(__name__)

# Firebase credentials (Mock mode if not configured)
FIREBASE_PROJECT_ID = os.environ.get("FIREBASE_PROJECT_ID", "")
FIREBASE_PRIVATE_KEY = os.environ.get("FIREBASE_PRIVATE_KEY", "")
FIREBASE_CLIENT_EMAIL = os.environ.get("FIREBASE_CLIENT_EMAIL", "")

# Check if Firebase is configured
FIREBASE_CONFIGURED = bool(FIREBASE_PROJECT_ID and FIREBASE_PRIVATE_KEY and FIREBASE_CLIENT_EMAIL)


class FirebasePushService:
    """
    Firebase Cloud Messaging (FCM) Service
    Supports both Mock and Live modes
    """
    
    def __init__(self):
        self.is_mock = not FIREBASE_CONFIGURED
        self.firebase_app = None
        self._sent_notifications = []  # Track sent notifications in mock mode
        
        if not self.is_mock:
            self._initialize_firebase()
        else:
            logger.info("[Firebase Push] Running in MOCK mode - notifications will be logged only")
    
    def _initialize_firebase(self):
        """Initialize Firebase Admin SDK"""
        try:
            import firebase_admin
            from firebase_admin import credentials, messaging
            
            cred = credentials.Certificate({
                "type": "service_account",
                "project_id": FIREBASE_PROJECT_ID,
                "private_key": FIREBASE_PRIVATE_KEY.replace('\\n', '\n'),
                "client_email": FIREBASE_CLIENT_EMAIL,
                "token_uri": "https://oauth2.googleapis.com/token",
            })
            
            self.firebase_app = firebase_admin.initialize_app(cred)
            logger.info("[Firebase Push] Initialized in LIVE mode")
            
        except ImportError:
            logger.warning("[Firebase Push] firebase-admin not installed, falling back to mock mode")
            self.is_mock = True
        except Exception as e:
            logger.error(f"[Firebase Push] Failed to initialize: {e}")
            self.is_mock = True
    
    async def send_notification(
        self,
        token: str,
        title: str,
        body: str,
        data: Optional[Dict[str, str]] = None,
        image_url: Optional[str] = None,
        click_action: Optional[str] = None,
        notification_type: str = "general"
    ) -> Dict[str, Any]:
        """
        Send push notification to a single device
        
        Args:
            token: FCM device token
            title: Notification title
            body: Notification body text
            data: Optional data payload
            image_url: Optional image URL for rich notification
            click_action: URL/action to open when tapped
            notification_type: Type for categorization (booking, alert, promo, etc.)
        
        Returns:
            Dict with success status and message_id
        """
        notification_id = str(uuid.uuid4())[:8]
        timestamp = datetime.now(timezone.utc)
        
        notification_record = {
            "notification_id": notification_id,
            "token": token[:20] + "..." if len(token) > 20 else token,
            "title": title,
            "body": body,
            "data": data,
            "notification_type": notification_type,
            "timestamp": timestamp.isoformat(),
            "is_mock": self.is_mock
        }
        
        if self.is_mock:
            # Mock mode - log and track
            logger.info(f"[Firebase Push MOCK] Sending to {token[:20]}...")
            logger.info(f"  Title: {title}")
            logger.info(f"  Body: {body}")
            logger.info(f"  Data: {data}")
            
            self._sent_notifications.append(notification_record)
            
            return {
                "success": True,
                "message_id": f"mock_{notification_id}",
                "mock": True,
                "notification": notification_record,
                "note": "Notification logged (Mock mode). Configure Firebase credentials for live delivery."
            }
        
        # Live mode
        try:
            from firebase_admin import messaging
            
            message = messaging.Message(
                notification=messaging.Notification(
                    title=title,
                    body=body,
                    image=image_url
                ),
                data=data or {},
                token=token,
                android=messaging.AndroidConfig(
                    priority="high",
                    notification=messaging.AndroidNotification(
                        click_action=click_action,
                        icon="notification_icon",
                        color="#FF6B00"  # AirYatra orange
                    )
                ),
                apns=messaging.APNSConfig(
                    payload=messaging.APNSPayload(
                        aps=messaging.Aps(
                            sound="default",
                            badge=1
                        )
                    )
                )
            )
            
            response = messaging.send(message)
            logger.info(f"[Firebase Push] Sent successfully: {response}")
            
            return {
                "success": True,
                "message_id": response,
                "mock": False,
                "notification": notification_record
            }
            
        except Exception as e:
            logger.error(f"[Firebase Push] Failed to send: {e}")
            return {
                "success": False,
                "error": str(e),
                "mock": False
            }
    
    async def send_to_multiple(
        self,
        tokens: List[str],
        title: str,
        body: str,
        data: Optional[Dict[str, str]] = None,
        notification_type: str = "general"
    ) -> Dict[str, Any]:
        """Send notification to multiple devices"""
        
        if self.is_mock:
            logger.info(f"[Firebase Push MOCK] Sending to {len(tokens)} devices")
            
            results = []
            for token in tokens:
                result = await self.send_notification(
                    token=token,
                    title=title,
                    body=body,
                    data=data,
                    notification_type=notification_type
                )
                results.append(result)
            
            return {
                "success": True,
                "total": len(tokens),
                "sent": len(tokens),
                "failed": 0,
                "mock": True,
                "results": results
            }
        
        # Live mode - use multicast
        try:
            from firebase_admin import messaging
            
            message = messaging.MulticastMessage(
                notification=messaging.Notification(
                    title=title,
                    body=body
                ),
                data=data or {},
                tokens=tokens
            )
            
            response = messaging.send_multicast(message)
            
            return {
                "success": True,
                "total": len(tokens),
                "sent": response.success_count,
                "failed": response.failure_count,
                "mock": False
            }
            
        except Exception as e:
            logger.error(f"[Firebase Push] Multicast failed: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    async def send_to_topic(
        self,
        topic: str,
        title: str,
        body: str,
        data: Optional[Dict[str, str]] = None
    ) -> Dict[str, Any]:
        """Send notification to a topic (e.g., all users, operators)"""
        
        if self.is_mock:
            logger.info(f"[Firebase Push MOCK] Sending to topic: {topic}")
            logger.info(f"  Title: {title}")
            logger.info(f"  Body: {body}")
            
            return {
                "success": True,
                "message_id": f"mock_topic_{uuid.uuid4().hex[:8]}",
                "topic": topic,
                "mock": True,
                "note": "Topic notification logged (Mock mode)"
            }
        
        try:
            from firebase_admin import messaging
            
            message = messaging.Message(
                notification=messaging.Notification(
                    title=title,
                    body=body
                ),
                data=data or {},
                topic=topic
            )
            
            response = messaging.send(message)
            
            return {
                "success": True,
                "message_id": response,
                "topic": topic,
                "mock": False
            }
            
        except Exception as e:
            logger.error(f"[Firebase Push] Topic send failed: {e}")
            return {"success": False, "error": str(e)}
    
    # ==================== NOTIFICATION TEMPLATES ====================
    
    async def send_booking_confirmed(
        self,
        token: str,
        booking_id: str,
        route: str,
        departure_time: str,
        pnr: str = None
    ) -> Dict[str, Any]:
        """Send booking confirmation notification"""
        return await self.send_notification(
            token=token,
            title="✈️ Booking Confirmed!",
            body=f"Your flight {route} on {departure_time} is confirmed. PNR: {pnr or booking_id[:8]}",
            data={
                "type": "booking_confirmed",
                "booking_id": booking_id,
                "action": "view_booking"
            },
            notification_type="booking"
        )
    
    async def send_payment_success(
        self,
        token: str,
        amount: float,
        booking_id: str,
        transaction_id: str
    ) -> Dict[str, Any]:
        """Send payment success notification"""
        return await self.send_notification(
            token=token,
            title="💳 Payment Successful!",
            body=f"₹{amount:,.0f} received for booking {booking_id[:8]}. Receipt ready!",
            data={
                "type": "payment_success",
                "booking_id": booking_id,
                "transaction_id": transaction_id,
                "action": "view_receipt"
            },
            notification_type="payment"
        )
    
    async def send_flight_reminder(
        self,
        token: str,
        booking_id: str,
        route: str,
        hours_before: int = 24
    ) -> Dict[str, Any]:
        """Send flight reminder notification"""
        return await self.send_notification(
            token=token,
            title=f"⏰ Flight in {hours_before} hours!",
            body=f"Your flight {route} departs soon. Check-in now!",
            data={
                "type": "flight_reminder",
                "booking_id": booking_id,
                "action": "check_in"
            },
            notification_type="reminder"
        )
    
    async def send_refund_processed(
        self,
        token: str,
        refund_amount: float,
        booking_id: str,
        refund_id: str
    ) -> Dict[str, Any]:
        """Send refund processed notification"""
        return await self.send_notification(
            token=token,
            title="💰 Refund Processed!",
            body=f"₹{refund_amount:,.0f} refund initiated. Expected in 5-7 business days.",
            data={
                "type": "refund_processed",
                "booking_id": booking_id,
                "refund_id": refund_id,
                "action": "view_refund"
            },
            notification_type="refund"
        )
    
    async def send_promo_offer(
        self,
        token: str,
        title: str,
        message: str,
        promo_code: str = None,
        offer_id: str = None
    ) -> Dict[str, Any]:
        """Send promotional offer notification"""
        return await self.send_notification(
            token=token,
            title=f"🎁 {title}",
            body=message,
            data={
                "type": "promo_offer",
                "promo_code": promo_code or "",
                "offer_id": offer_id or "",
                "action": "view_offer"
            },
            notification_type="promo"
        )
    
    async def send_sos_alert(
        self,
        token: str,
        alert_type: str,
        message: str,
        flight_id: str = None
    ) -> Dict[str, Any]:
        """Send SOS/Emergency alert notification"""
        return await self.send_notification(
            token=token,
            title=f"🚨 {alert_type.upper()} ALERT",
            body=message,
            data={
                "type": "sos_alert",
                "alert_type": alert_type,
                "flight_id": flight_id or "",
                "action": "view_alert",
                "priority": "high"
            },
            notification_type="emergency"
        )
    
    # ==================== UTILITY METHODS ====================
    
    def get_status(self) -> Dict[str, Any]:
        """Get service status"""
        return {
            "service": "Firebase Push Notifications",
            "mode": "MOCK" if self.is_mock else "LIVE",
            "configured": FIREBASE_CONFIGURED,
            "project_id": FIREBASE_PROJECT_ID[:10] + "..." if FIREBASE_PROJECT_ID else None,
            "mock_notifications_sent": len(self._sent_notifications) if self.is_mock else None
        }
    
    def get_mock_history(self, limit: int = 50) -> List[Dict]:
        """Get history of mock notifications (for testing)"""
        return self._sent_notifications[-limit:]
    
    def clear_mock_history(self):
        """Clear mock notification history"""
        self._sent_notifications = []


# Singleton instance
firebase_push_service = FirebasePushService()
