"""
AirYatra WhatsApp Service
Provider: Twilio (Mock Mode by default)
Features: Template messages, Variable replacement, Delivery tracking
"""

import os
import logging
import uuid
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List

logger = logging.getLogger(__name__)

# ==================== CONFIGURATION ====================

WHATSAPP_CONFIG = {
    "provider": os.environ.get("WHATSAPP_PROVIDER", "twilio"),  # twilio or meta
    "mock_mode": os.environ.get("WHATSAPP_MOCK_MODE", "true").lower() == "true",
    # Twilio Config
    "twilio_account_sid": os.environ.get("TWILIO_ACCOUNT_SID", ""),
    "twilio_auth_token": os.environ.get("TWILIO_AUTH_TOKEN", ""),
    "twilio_whatsapp_number": os.environ.get("TWILIO_WHATSAPP_NUMBER", ""),  # e.g., +14155238886
    # Meta Config (Future)
    "meta_access_token": os.environ.get("META_WHATSAPP_TOKEN", ""),
    "meta_phone_number_id": os.environ.get("META_PHONE_NUMBER_ID", ""),
}

# ==================== WHATSAPP TEMPLATES ====================

WHATSAPP_TEMPLATES = {
    "booking_confirmation": {
        "name": "Booking Confirmation",
        "template": """🚁 *AirYatra Booking Confirmed!*

Namaste {{customer_name}}! 🙏

Aapki helicopter booking confirm ho gayi hai:

📋 *Booking ID:* {{booking_id}}
✈️ *Route:* {{from_city}} → {{to_city}}
📅 *Date:* {{departure_date}}
⏰ *Time:* {{departure_time}}
👥 *Passengers:* {{passenger_count}}
💰 *Amount:* ₹{{amount}}

🎫 Status: *CONFIRMED* ✅

Questions? Reply to this message or call us.

_Thank you for flying with AirYatra!_ 🛫""",
        "variables": ["customer_name", "booking_id", "from_city", "to_city", "departure_date", "departure_time", "passenger_count", "amount"]
    },
    
    "payment_reminder": {
        "name": "Payment Reminder",
        "template": """⏰ *Payment Reminder - AirYatra*

Namaste {{customer_name}}! 🙏

Aapke booking ke liye payment pending hai:

📋 *Booking ID:* {{booking_id}}
✈️ *Route:* {{from_city}} → {{to_city}}
📅 *Date:* {{departure_date}}
💰 *Pending Amount:* ₹{{pending_amount}}

🔗 Pay Now: {{payment_link}}

⚠️ Please complete payment to confirm your booking.

_Team AirYatra_ 🚁""",
        "variables": ["customer_name", "booking_id", "from_city", "to_city", "departure_date", "pending_amount", "payment_link"]
    },
    
    "flight_reminder": {
        "name": "Flight Reminder (24h)",
        "template": """🔔 *Flight Reminder - Tomorrow!*

Namaste {{customer_name}}! 🙏

Your helicopter flight is *tomorrow*:

📋 *Booking ID:* {{booking_id}}
✈️ *Route:* {{from_city}} → {{to_city}}
📅 *Date:* {{departure_date}}
⏰ *Reporting Time:* {{reporting_time}}
📍 *Helipad:* {{helipad_name}}

✅ *Checklist:*
• Valid ID proof
• Booking confirmation
• Arrive 30 mins early

Safe travels! 🛫
_Team AirYatra_""",
        "variables": ["customer_name", "booking_id", "from_city", "to_city", "departure_date", "reporting_time", "helipad_name"]
    },
    
    "complaint_update": {
        "name": "Complaint Status Update",
        "template": """📢 *Complaint Update - AirYatra*

Namaste {{customer_name}}! 🙏

Your complaint status has been updated:

🎫 *Complaint ID:* {{complaint_id}}
📋 *Category:* {{category}}
📊 *Status:* {{status}}

{{status_message}}

Need help? Reply to this message.

_Team AirYatra_ 🚁""",
        "variables": ["customer_name", "complaint_id", "category", "status", "status_message"]
    },
    
    "discount_code": {
        "name": "Discount Code Notification",
        "template": """🎉 *Special Offer for You!*

Namaste {{customer_name}}! 🙏

Exclusive discount just for you:

🏷️ *Code:* {{discount_code}}
💰 *Discount:* {{discount_value}}
📅 *Valid Until:* {{valid_until}}
✈️ *Min Booking:* ₹{{min_amount}}

Use code at checkout!

Book now: {{booking_link}}

_Team AirYatra_ 🚁""",
        "variables": ["customer_name", "discount_code", "discount_value", "valid_until", "min_amount", "booking_link"]
    },
    
    "otp_verification": {
        "name": "OTP Verification",
        "template": """🔐 *AirYatra OTP*

Your verification code is:

*{{otp}}*

Valid for 10 minutes.
Do not share with anyone.

_Team AirYatra_""",
        "variables": ["otp"]
    }
}


class WhatsAppService:
    """WhatsApp messaging service with Twilio integration (Mock mode supported)"""
    
    def __init__(self):
        self.config = WHATSAPP_CONFIG
        self.mock_mode = self.config["mock_mode"]
        self.twilio_client = None
        
        if not self.mock_mode and self.config["provider"] == "twilio":
            self._init_twilio()
    
    def _init_twilio(self):
        """Initialize Twilio client"""
        try:
            from twilio.rest import Client
            self.twilio_client = Client(
                self.config["twilio_account_sid"],
                self.config["twilio_auth_token"]
            )
            logger.info("Twilio WhatsApp client initialized")
        except ImportError:
            logger.warning("Twilio library not installed. Using mock mode.")
            self.mock_mode = True
        except Exception as e:
            logger.error(f"Twilio initialization failed: {e}")
            self.mock_mode = True
    
    def _format_phone_number(self, phone: str) -> str:
        """Format phone number for WhatsApp (E.164 format)"""
        # Remove spaces, dashes, parentheses
        phone = ''.join(c for c in phone if c.isdigit() or c == '+')
        
        # Add India country code if not present
        if not phone.startswith('+'):
            if phone.startswith('91') and len(phone) == 12:
                phone = '+' + phone
            elif len(phone) == 10:
                phone = '+91' + phone
            else:
                phone = '+91' + phone[-10:]  # Take last 10 digits
        
        return phone
    
    def _replace_variables(self, template: str, variables: Dict[str, Any]) -> str:
        """Replace template variables with actual values"""
        content = template
        for key, value in variables.items():
            placeholder = "{{" + key + "}}"
            content = content.replace(placeholder, str(value))
        return content
    
    async def send_message(
        self,
        to_phone: str,
        message: str,
        template_name: str = None
    ) -> Dict[str, Any]:
        """
        Send WhatsApp message
        
        Args:
            to_phone: Recipient phone number
            message: Message content
            template_name: Optional template name for tracking
            
        Returns:
            Dict with status, message_id, etc.
        """
        formatted_phone = self._format_phone_number(to_phone)
        message_id = f"WA-{uuid.uuid4().hex[:12].upper()}"
        
        result = {
            "success": False,
            "message_id": message_id,
            "to": formatted_phone,
            "template": template_name,
            "mock_mode": self.mock_mode,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
        if self.mock_mode:
            # Mock mode - simulate successful send
            logger.info(f"[MOCK] WhatsApp message to {formatted_phone}: {message[:50]}...")
            result["success"] = True
            result["status"] = "sent"
            result["provider"] = "mock"
            result["mock_response"] = {
                "sid": message_id,
                "status": "queued",
                "direction": "outbound-api",
                "price": None,
                "error_code": None
            }
            return result
        
        # Real Twilio send
        if self.config["provider"] == "twilio" and self.twilio_client:
            try:
                twilio_message = self.twilio_client.messages.create(
                    body=message,
                    from_=f"whatsapp:{self.config['twilio_whatsapp_number']}",
                    to=f"whatsapp:{formatted_phone}"
                )
                
                result["success"] = True
                result["status"] = twilio_message.status
                result["provider"] = "twilio"
                result["message_id"] = twilio_message.sid
                result["twilio_response"] = {
                    "sid": twilio_message.sid,
                    "status": twilio_message.status,
                    "direction": twilio_message.direction,
                    "price": twilio_message.price,
                    "error_code": twilio_message.error_code
                }
                
                logger.info(f"WhatsApp sent to {formatted_phone}, SID: {twilio_message.sid}")
                
            except Exception as e:
                logger.error(f"Twilio send failed: {e}")
                result["error"] = str(e)
                result["status"] = "failed"
        else:
            result["error"] = "No WhatsApp provider configured"
            result["status"] = "failed"
        
        return result
    
    async def send_template_message(
        self,
        to_phone: str,
        template_id: str,
        variables: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Send a templated WhatsApp message
        
        Args:
            to_phone: Recipient phone number
            template_id: Template ID from WHATSAPP_TEMPLATES
            variables: Dict of variable values
            
        Returns:
            Dict with send result
        """
        template = WHATSAPP_TEMPLATES.get(template_id)
        
        if not template:
            return {
                "success": False,
                "error": f"Template '{template_id}' not found",
                "available_templates": list(WHATSAPP_TEMPLATES.keys())
            }
        
        # Replace variables in template
        message = self._replace_variables(template["template"], variables)
        
        # Send the message
        result = await self.send_message(to_phone, message, template_id)
        result["template_name"] = template["name"]
        result["variables_used"] = list(variables.keys())
        
        return result
    
    async def send_bulk_messages(
        self,
        recipients: List[Dict[str, Any]],
        template_id: str
    ) -> Dict[str, Any]:
        """
        Send template message to multiple recipients
        
        Args:
            recipients: List of dicts with 'phone' and 'variables' keys
            template_id: Template ID
            
        Returns:
            Dict with bulk send results
        """
        results = {
            "total": len(recipients),
            "sent": 0,
            "failed": 0,
            "details": []
        }
        
        for recipient in recipients[:100]:  # Limit to 100 per batch
            phone = recipient.get("phone")
            variables = recipient.get("variables", {})
            
            if not phone:
                results["failed"] += 1
                results["details"].append({"phone": None, "error": "Missing phone"})
                continue
            
            result = await self.send_template_message(phone, template_id, variables)
            
            if result["success"]:
                results["sent"] += 1
            else:
                results["failed"] += 1
            
            results["details"].append({
                "phone": phone,
                "success": result["success"],
                "message_id": result.get("message_id"),
                "error": result.get("error")
            })
        
        return results
    
    def get_available_templates(self) -> Dict[str, Any]:
        """Get list of available WhatsApp templates"""
        templates = []
        for tid, template in WHATSAPP_TEMPLATES.items():
            templates.append({
                "id": tid,
                "name": template["name"],
                "variables": template["variables"],
                "preview": template["template"][:200] + "..."
            })
        return {
            "templates": templates,
            "total": len(templates),
            "provider": self.config["provider"],
            "mock_mode": self.mock_mode
        }
    
    def get_status(self) -> Dict[str, Any]:
        """Get WhatsApp service status"""
        return {
            "provider": self.config["provider"],
            "mock_mode": self.mock_mode,
            "twilio_configured": bool(self.config["twilio_account_sid"]),
            "meta_configured": bool(self.config["meta_access_token"]),
            "whatsapp_number": self.config["twilio_whatsapp_number"][:6] + "****" if self.config["twilio_whatsapp_number"] else None,
            "status": "active" if self.mock_mode or self.twilio_client else "inactive"
        }


# Singleton instance
whatsapp_service = WhatsAppService()


# ==================== CONVENIENCE FUNCTIONS ====================

async def send_whatsapp(to_phone: str, message: str, template_name: str = None) -> Dict[str, Any]:
    """Send a WhatsApp message"""
    return await whatsapp_service.send_message(to_phone, message, template_name)


async def send_whatsapp_template(to_phone: str, template_id: str, variables: Dict[str, Any]) -> Dict[str, Any]:
    """Send a templated WhatsApp message"""
    return await whatsapp_service.send_template_message(to_phone, template_id, variables)


async def send_booking_confirmation_whatsapp(
    phone: str,
    customer_name: str,
    booking_id: str,
    from_city: str,
    to_city: str,
    departure_date: str,
    departure_time: str,
    passenger_count: int,
    amount: str
) -> Dict[str, Any]:
    """Send booking confirmation via WhatsApp"""
    return await whatsapp_service.send_template_message(
        phone,
        "booking_confirmation",
        {
            "customer_name": customer_name,
            "booking_id": booking_id,
            "from_city": from_city,
            "to_city": to_city,
            "departure_date": departure_date,
            "departure_time": departure_time,
            "passenger_count": str(passenger_count),
            "amount": amount
        }
    )


async def send_payment_reminder_whatsapp(
    phone: str,
    customer_name: str,
    booking_id: str,
    from_city: str,
    to_city: str,
    departure_date: str,
    pending_amount: str,
    payment_link: str
) -> Dict[str, Any]:
    """Send payment reminder via WhatsApp"""
    return await whatsapp_service.send_template_message(
        phone,
        "payment_reminder",
        {
            "customer_name": customer_name,
            "booking_id": booking_id,
            "from_city": from_city,
            "to_city": to_city,
            "departure_date": departure_date,
            "pending_amount": pending_amount,
            "payment_link": payment_link
        }
    )


async def send_otp_whatsapp(phone: str, otp: str) -> Dict[str, Any]:
    """Send OTP via WhatsApp"""
    return await whatsapp_service.send_template_message(
        phone,
        "otp_verification",
        {"otp": otp}
    )
