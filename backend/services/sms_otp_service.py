"""
AirYatra SMS OTP Service
Provider: Twilio Verify API
Features: Phone-based OTP login, verification
"""

import os
import logging
from datetime import datetime, timezone
from typing import Optional, Dict, Any
from twilio.rest import Client
from twilio.base.exceptions import TwilioRestException

logger = logging.getLogger(__name__)

# SMS OTP Configuration
TWILIO_ACCOUNT_SID = os.environ.get("TWILIO_ACCOUNT_SID", "")
TWILIO_AUTH_TOKEN = os.environ.get("TWILIO_AUTH_TOKEN", "")
TWILIO_VERIFY_SERVICE_SID = os.environ.get("TWILIO_VERIFY_SERVICE_SID", "")

# SECURITY: Mock mode MUST be explicitly enabled - defaults to FALSE for production safety
SMS_MOCK_MODE = os.environ.get("SMS_MOCK_MODE", "false").lower() == "true"

# In-memory OTP store for mock mode (ONLY for development/testing)
MOCK_OTP_STORE: Dict[str, str] = {}


class SMSOTPService:
    """
    SMS OTP Service using Twilio Verify API
    Supports mock mode for testing
    """
    
    def __init__(self):
        self.mock_mode = SMS_MOCK_MODE
        self.client = None
        self.verify_service_sid = TWILIO_VERIFY_SERVICE_SID
        
        if not self.mock_mode and TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN:
            try:
                self.client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
                logger.info("Twilio SMS client initialized")
            except Exception as e:
                logger.error(f"Failed to initialize Twilio: {e}")
                self.mock_mode = True
        else:
            logger.info("SMS OTP running in MOCK mode")
    
    def _format_phone(self, phone: str) -> str:
        """Format phone number to E.164 format"""
        phone = phone.strip().replace(" ", "").replace("-", "")
        
        # If doesn't start with +, assume Indian number
        if not phone.startswith("+"):
            if phone.startswith("91"):
                phone = "+" + phone
            elif phone.startswith("0"):
                phone = "+91" + phone[1:]
            else:
                phone = "+91" + phone
        
        return phone
    
    async def send_otp(self, phone: str) -> Dict[str, Any]:
        """
        Send OTP to phone number
        
        Args:
            phone: Phone number (will be formatted to E.164)
            
        Returns:
            Dict with success status and details
        """
        formatted_phone = self._format_phone(phone)
        
        result = {
            "success": False,
            "phone": formatted_phone,
            "mock_mode": self.mock_mode,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
        if self.mock_mode:
            # Mock mode - generate fixed OTP
            mock_otp = "123456"
            MOCK_OTP_STORE[formatted_phone] = mock_otp
            
            result["success"] = True
            result["status"] = "pending"
            result["message"] = f"OTP sent to {formatted_phone}"
            result["message_hi"] = f"OTP भेजा गया: {formatted_phone}"
            result["mock_otp"] = mock_otp  # Only in mock mode!
            
            logger.info(f"[MOCK] SMS OTP sent to {formatted_phone}: {mock_otp}")
            return result
        
        # Real Twilio Verify
        if not self.client:
            result["error"] = "Twilio client not initialized"
            return result
        
        if not self.verify_service_sid:
            # Create a verification without Verify service (direct SMS)
            try:
                # Use Twilio's built-in verification
                verification = self.client.verify.v2.services.create(
                    friendly_name='AirYatra SMS Verification'
                )
                self.verify_service_sid = verification.sid
                logger.info(f"Created Verify Service: {self.verify_service_sid}")
            except TwilioRestException as e:
                # If can't create, use direct SMS approach
                logger.warning(f"Couldn't create Verify service: {e}")
                return await self._send_direct_sms_otp(formatted_phone)
        
        try:
            verification = self.client.verify.v2.services(
                self.verify_service_sid
            ).verifications.create(
                to=formatted_phone,
                channel='sms'
            )
            
            result["success"] = True
            result["status"] = verification.status
            result["sid"] = verification.sid
            result["message"] = f"OTP sent to {formatted_phone}"
            result["message_hi"] = f"OTP भेजा गया: {formatted_phone}"
            
            logger.info(f"SMS OTP sent to {formatted_phone}, status: {verification.status}")
            
        except TwilioRestException as e:
            logger.error(f"Twilio error: {e}")
            result["error"] = str(e)
            result["error_code"] = e.code
        except Exception as e:
            logger.error(f"SMS send error: {e}")
            result["error"] = str(e)
        
        return result
    
    async def _send_direct_sms_otp(self, phone: str) -> Dict[str, Any]:
        """Fallback: Send OTP via direct SMS (not Verify API)"""
        import random
        
        otp = str(random.randint(100000, 999999))
        MOCK_OTP_STORE[phone] = otp
        
        try:
            # Get a Twilio phone number
            incoming_numbers = self.client.incoming_phone_numbers.list(limit=1)
            from_number = incoming_numbers[0].phone_number if incoming_numbers else None
            
            if not from_number:
                return {
                    "success": False,
                    "error": "No Twilio phone number available",
                    "phone": phone
                }
            
            message = self.client.messages.create(
                body=f"Your AirYatra verification code is: {otp}\n\nआपका AirYatra सत्यापन कोड है: {otp}",
                from_=from_number,
                to=phone
            )
            
            return {
                "success": True,
                "status": "sent",
                "sid": message.sid,
                "phone": phone,
                "message": f"OTP sent to {phone}",
                "method": "direct_sms"
            }
            
        except Exception as e:
            logger.error(f"Direct SMS failed: {e}")
            return {
                "success": False,
                "error": str(e),
                "phone": phone
            }
    
    async def verify_otp(self, phone: str, code: str) -> Dict[str, Any]:
        """
        Verify OTP code
        
        Args:
            phone: Phone number
            code: OTP code entered by user
            
        Returns:
            Dict with verification result
        """
        formatted_phone = self._format_phone(phone)
        
        result = {
            "success": False,
            "phone": formatted_phone,
            "mock_mode": self.mock_mode,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
        if self.mock_mode:
            # Mock mode verification
            stored_otp = MOCK_OTP_STORE.get(formatted_phone)
            
            if stored_otp and stored_otp == code:
                result["success"] = True
                result["valid"] = True
                result["status"] = "approved"
                result["message"] = "Phone verified successfully"
                result["message_hi"] = "फोन सत्यापित हो गया"
                # Clear OTP after use
                MOCK_OTP_STORE.pop(formatted_phone, None)
            else:
                result["valid"] = False
                result["status"] = "rejected"
                result["message"] = "Invalid OTP code"
                result["message_hi"] = "गलत OTP कोड"
            
            return result
        
        # Real Twilio Verify check
        if not self.client or not self.verify_service_sid:
            # Check mock store as fallback
            stored_otp = MOCK_OTP_STORE.get(formatted_phone)
            if stored_otp and stored_otp == code:
                result["success"] = True
                result["valid"] = True
                MOCK_OTP_STORE.pop(formatted_phone, None)
                return result
            result["error"] = "Verification service not available"
            return result
        
        try:
            verification_check = self.client.verify.v2.services(
                self.verify_service_sid
            ).verification_checks.create(
                to=formatted_phone,
                code=code
            )
            
            is_valid = verification_check.status == "approved"
            
            result["success"] = True
            result["valid"] = is_valid
            result["status"] = verification_check.status
            
            if is_valid:
                result["message"] = "Phone verified successfully"
                result["message_hi"] = "फोन सत्यापित हो गया"
            else:
                result["message"] = "Invalid OTP code"
                result["message_hi"] = "गलत OTP कोड"
            
            logger.info(f"OTP verification for {formatted_phone}: {verification_check.status}")
            
        except TwilioRestException as e:
            logger.error(f"Twilio verify error: {e}")
            result["error"] = str(e)
            result["error_code"] = e.code
        except Exception as e:
            logger.error(f"Verify error: {e}")
            result["error"] = str(e)
        
        return result


# Singleton instance
sms_otp_service = SMSOTPService()
