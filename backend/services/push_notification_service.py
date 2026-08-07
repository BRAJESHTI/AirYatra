"""
AirYatra Push Notification Service
Provider: Firebase Cloud Messaging (FCM)
Features: Web push, Topic subscriptions, Scheduled notifications
"""

import os
import json
import logging
import uuid
import asyncio
import httpx
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List

logger = logging.getLogger(__name__)

# ==================== CONFIGURATION ====================

FCM_CONFIG = {
    "server_key": os.environ.get("FCM_SERVER_KEY", ""),
    "mock_mode": os.environ.get("FCM_MOCK_MODE", "true").lower() == "true",
    "fcm_url": "https://fcm.googleapis.com/fcm/send",
}


class PushNotificationService:
    """Firebase Cloud Messaging service for push notifications"""
    
    def __init__(self):
        self.config = FCM_CONFIG
        self.mock_mode = self.config["mock_mode"]
        self.fcm_url = self.config["fcm_url"]
        self.server_key = self.config["server_key"]
    
    async def send_to_device(
        self,
        device_token: str,
        title: str,
        body: str,
        data: Dict[str, Any] = None,
        icon: str = None,
        click_action: str = None
    ) -> Dict[str, Any]:
        """
        Send push notification to a specific device
        
        Args:
            device_token: FCM device token
            title: Notification title
            body: Notification body text
            data: Additional data payload
            icon: Notification icon URL
            click_action: URL to open when notification clicked
        """
        notification_id = f"PN-{uuid.uuid4().hex[:12].upper()}"
        
        result = {
            "success": False,
            "notification_id": notification_id,
            "device_token": device_token[:20] + "..." if device_token else None,
            "mock_mode": self.mock_mode,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
        if self.mock_mode:
            logger.info(f"[MOCK] Push notification: {title} - {body}")
            result["success"] = True
            result["status"] = "sent"
            result["mock_response"] = {
                "multicast_id": notification_id,
                "success": 1,
                "failure": 0,
                "results": [{"message_id": notification_id}]
            }
            return result
        
        if not self.server_key:
            result["error"] = "FCM server key not configured"
            return result
        
        # Build FCM payload
        payload = {
            "to": device_token,
            "notification": {
                "title": title,
                "body": body,
            },
            "data": data or {}
        }
        
        if icon:
            payload["notification"]["icon"] = icon
        if click_action:
            payload["notification"]["click_action"] = click_action
        
        # Send to FCM
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    self.fcm_url,
                    json=payload,
                    headers={
                        "Authorization": f"key={self.server_key}",
                        "Content-Type": "application/json"
                    },
                    timeout=10
                )
                
                if response.status_code == 200:
                    fcm_response = response.json()
                    result["success"] = fcm_response.get("success", 0) > 0
                    result["status"] = "sent" if result["success"] else "failed"
                    result["fcm_response"] = fcm_response
                else:
                    result["error"] = f"FCM error: {response.status_code}"
                    result["status"] = "failed"
                    
        except Exception as e:
            logger.error(f"FCM send error: {e}")
            result["error"] = str(e)
            result["status"] = "failed"
        
        return result
    
    async def send_to_topic(
        self,
        topic: str,
        title: str,
        body: str,
        data: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """Send notification to all devices subscribed to a topic"""
        
        notification_id = f"PN-{uuid.uuid4().hex[:12].upper()}"
        
        result = {
            "success": False,
            "notification_id": notification_id,
            "topic": topic,
            "mock_mode": self.mock_mode,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
        if self.mock_mode:
            logger.info(f"[MOCK] Topic notification to '{topic}': {title}")
            result["success"] = True
            result["status"] = "sent"
            result["mock_response"] = {"message_id": notification_id}
            return result
        
        if not self.server_key:
            result["error"] = "FCM server key not configured"
            return result
        
        payload = {
            "to": f"/topics/{topic}",
            "notification": {
                "title": title,
                "body": body
            },
            "data": data or {}
        }
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    self.fcm_url,
                    json=payload,
                    headers={
                        "Authorization": f"key={self.server_key}",
                        "Content-Type": "application/json"
                    },
                    timeout=10
                )
                
                if response.status_code == 200:
                    result["success"] = True
                    result["status"] = "sent"
                    result["fcm_response"] = response.json()
                else:
                    result["error"] = f"FCM error: {response.status_code}"
                    result["status"] = "failed"
                    
        except Exception as e:
            result["error"] = str(e)
            result["status"] = "failed"
        
        return result
    
    async def send_to_multiple(
        self,
        device_tokens: List[str],
        title: str,
        body: str,
        data: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """Send notification to multiple devices (max 1000)"""
        
        notification_id = f"PN-{uuid.uuid4().hex[:12].upper()}"
        
        result = {
            "success": False,
            "notification_id": notification_id,
            "total_devices": len(device_tokens),
            "mock_mode": self.mock_mode,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
        if not device_tokens:
            result["error"] = "No device tokens provided"
            return result
        
        # Limit to 1000 devices (FCM limit)
        tokens = device_tokens[:1000]
        
        if self.mock_mode:
            logger.info(f"[MOCK] Bulk notification to {len(tokens)} devices: {title}")
            result["success"] = True
            result["status"] = "sent"
            result["sent_count"] = len(tokens)
            result["failed_count"] = 0
            return result
        
        if not self.server_key:
            result["error"] = "FCM server key not configured"
            return result
        
        payload = {
            "registration_ids": tokens,
            "notification": {
                "title": title,
                "body": body
            },
            "data": data or {}
        }
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    self.fcm_url,
                    json=payload,
                    headers={
                        "Authorization": f"key={self.server_key}",
                        "Content-Type": "application/json"
                    },
                    timeout=30
                )
                
                if response.status_code == 200:
                    fcm_response = response.json()
                    result["success"] = fcm_response.get("success", 0) > 0
                    result["status"] = "sent"
                    result["sent_count"] = fcm_response.get("success", 0)
                    result["failed_count"] = fcm_response.get("failure", 0)
                    result["fcm_response"] = fcm_response
                else:
                    result["error"] = f"FCM error: {response.status_code}"
                    result["status"] = "failed"
                    
        except Exception as e:
            result["error"] = str(e)
            result["status"] = "failed"
        
        return result
    
    def get_status(self) -> Dict[str, Any]:
        """Get push notification service status"""
        return {
            "provider": "firebase",
            "mock_mode": self.mock_mode,
            "configured": bool(self.server_key),
            "status": "active" if self.mock_mode or self.server_key else "inactive"
        }


# Singleton instance
push_service = PushNotificationService()


# ==================== NOTIFICATION TEMPLATES ====================

PUSH_TEMPLATES = {
    "booking_confirmed": {
        "title": "Booking Confirmed! ✈️",
        "body": "Your helicopter booking {booking_id} is confirmed for {date}. See details.",
        "topic": "bookings"
    },
    "payment_received": {
        "title": "Payment Received 💰",
        "body": "Payment of ₹{amount} received for booking {booking_id}. Thank you!",
        "topic": "payments"
    },
    "flight_reminder": {
        "title": "Flight Tomorrow! 🚁",
        "body": "Your flight {booking_id} is scheduled for tomorrow at {time}. Don't forget!",
        "topic": "reminders"
    },
    "alert_triggered": {
        "title": "Performance Alert 🚨",
        "body": "{metric} is {comparison} {threshold}%. Current: {value}%",
        "topic": "admin_alerts"
    },
    "new_inquiry": {
        "title": "New Inquiry 📩",
        "body": "New inquiry from {customer_name} for {route}. Check dashboard.",
        "topic": "inquiries"
    },
    "complaint_update": {
        "title": "Complaint Update 📋",
        "body": "Complaint {complaint_id} status changed to {status}.",
        "topic": "complaints"
    }
}


async def send_templated_push(
    template_id: str,
    device_token: str = None,
    topic: str = None,
    variables: Dict[str, Any] = None
) -> Dict[str, Any]:
    """Send a templated push notification"""
    
    template = PUSH_TEMPLATES.get(template_id)
    if not template:
        return {
            "success": False,
            "error": f"Template '{template_id}' not found",
            "available_templates": list(PUSH_TEMPLATES.keys())
        }
    
    # Replace variables in template
    title = template["title"]
    body = template["body"]
    
    if variables:
        for key, value in variables.items():
            title = title.replace(f"{{{key}}}", str(value))
            body = body.replace(f"{{{key}}}", str(value))
    
    # Send to device or topic
    if device_token:
        return await push_service.send_to_device(device_token, title, body, variables)
    elif topic:
        return await push_service.send_to_topic(topic, title, body, variables)
    else:
        # Use template's default topic
        return await push_service.send_to_topic(template.get("topic", "general"), title, body, variables)


async def send_alert_push(
    metric: str,
    value: float,
    threshold: float,
    comparison: str
) -> Dict[str, Any]:
    """Send alert push notification to admin topic"""
    
    return await send_templated_push(
        "alert_triggered",
        topic="admin_alerts",
        variables={
            "metric": metric.replace("_", " ").title(),
            "comparison": comparison,
            "threshold": threshold,
            "value": round(value, 1)
        }
    )
