import os
from typing import Optional, Dict, List
from datetime import datetime, timezone
from uuid import uuid4

class NotificationService:
    def __init__(self):
        # Default to environment variables, but can be overridden by database settings
        self.sendgrid_key = os.environ.get("SENDGRID_API_KEY", "")
        self.twilio_sid = os.environ.get("TWILIO_ACCOUNT_SID", "")
        self.twilio_token = os.environ.get("TWILIO_AUTH_TOKEN", "")
        self.twilio_phone = os.environ.get("TWILIO_PHONE_NUMBER", "")
        self.whatsapp_number = os.environ.get("TWILIO_WHATSAPP_NUMBER", "")
        self._db_settings_loaded = False
    
    async def _load_api_keys_from_db(self, db):
        """Load API keys from database settings - Admin configured keys take priority"""
        if self._db_settings_loaded:
            return
        
        try:
            api_settings = await db.api_keys_settings.find_one({"type": "api_keys"}, {"_id": 0})
            if api_settings:
                # SendGrid
                if api_settings.get("sendgrid_api_key"):
                    self.sendgrid_key = api_settings["sendgrid_api_key"]
                
                # Twilio
                if api_settings.get("twilio_account_sid"):
                    self.twilio_sid = api_settings["twilio_account_sid"]
                if api_settings.get("twilio_auth_token"):
                    self.twilio_token = api_settings["twilio_auth_token"]
                if api_settings.get("twilio_phone_number"):
                    self.twilio_phone = api_settings["twilio_phone_number"]
                if api_settings.get("twilio_whatsapp_number"):
                    self.whatsapp_number = api_settings["twilio_whatsapp_number"]
                
                self._db_settings_loaded = True
                print("[NotificationService] API keys loaded from database settings")
        except Exception as e:
            print(f"[NotificationService] Error loading API keys from DB: {e}")
    
    def reset_settings_cache(self):
        """Reset settings cache to force reload from database"""
        self._db_settings_loaded = False
    
    async def send_email(
        self,
        to_email: str,
        subject: str,
        html_content: str,
        from_email: str = "noreply@airyatra.com",
        db=None
    ) -> Dict:
        """Send email using SendGrid"""
        
        # Load keys from DB if provided
        if db:
            await self._load_api_keys_from_db(db)
        
        if self.sendgrid_key and len(self.sendgrid_key) > 10:
            try:
                from sendgrid import SendGridAPIClient
                from sendgrid.helpers.mail import Mail
                
                message = Mail(
                    from_email=from_email,
                    to_emails=to_email,
                    subject=subject,
                    html_content=html_content
                )
                
                sg = SendGridAPIClient(self.sendgrid_key)
                response = sg.send(message)
                
                print(f"[SendGrid] Email sent to {to_email}, status: {response.status_code}")
                
                return {
                    "success": True,
                    "message_id": str(uuid4()),
                    "status_code": response.status_code,
                    "mock": False
                }
            except ImportError:
                print("[SendGrid] SDK not installed, falling back to mock")
            except Exception as e:
                print(f"[SendGrid] Error: {e}")
                return {"success": False, "error": str(e)}
        
        # Mock response when API key not configured
        print(f"[MOCK EMAIL] To: {to_email}, Subject: {subject}")
        return {
            "success": True,
            "message_id": str(uuid4()),
            "mock": True,
            "note": "Email mocked - Configure SendGrid API key in Admin Settings"
        }
    
    async def send_sms(
        self,
        to_number: str,
        message: str,
        db=None
    ) -> Dict:
        """Send SMS using Twilio"""
        
        if db:
            await self._load_api_keys_from_db(db)
        
        if self.twilio_sid and self.twilio_token and self.twilio_phone and len(self.twilio_sid) > 10:
            try:
                from twilio.rest import Client
                
                client = Client(self.twilio_sid, self.twilio_token)
                
                # Format number for India
                if not to_number.startswith('+'):
                    to_number = f'+91{to_number.lstrip("0")}'
                
                msg = client.messages.create(
                    body=message,
                    from_=self.twilio_phone,
                    to=to_number
                )
                
                print(f"[Twilio SMS] Sent to {to_number}, SID: {msg.sid}")
                
                return {
                    "success": True,
                    "message_sid": msg.sid,
                    "status": msg.status,
                    "mock": False
                }
            except ImportError:
                print("[Twilio] SDK not installed, falling back to mock")
            except Exception as e:
                print(f"[Twilio SMS] Error: {e}")
                return {"success": False, "error": str(e)}
        
        # Mock response
        print(f"[MOCK SMS] To: {to_number}, Message: {message[:50]}...")
        return {
            "success": True,
            "message_sid": str(uuid4()),
            "mock": True,
            "note": "SMS mocked - Configure Twilio credentials in Admin Settings"
        }
    
    async def send_whatsapp(
        self,
        to_number: str,
        message: str,
        db=None
    ) -> Dict:
        """Send WhatsApp message using Twilio"""
        
        if db:
            await self._load_api_keys_from_db(db)
        
        if self.twilio_sid and self.twilio_token and self.whatsapp_number and len(self.twilio_sid) > 10:
            try:
                from twilio.rest import Client
                
                client = Client(self.twilio_sid, self.twilio_token)
                
                # Format number for WhatsApp
                if not to_number.startswith('whatsapp:'):
                    if not to_number.startswith('+'):
                        to_number = f'+91{to_number.lstrip("0")}'
                    to_number = f'whatsapp:{to_number}'
                
                from_whatsapp = self.whatsapp_number
                if not from_whatsapp.startswith('whatsapp:'):
                    from_whatsapp = f'whatsapp:{from_whatsapp}'
                
                msg = client.messages.create(
                    body=message,
                    from_=from_whatsapp,
                    to=to_number
                )
                
                print(f"[Twilio WhatsApp] Sent to {to_number}, SID: {msg.sid}")
                
                return {
                    "success": True,
                    "message_sid": msg.sid,
                    "status": msg.status,
                    "mock": False
                }
            except ImportError:
                print("[Twilio] SDK not installed, falling back to mock")
            except Exception as e:
                print(f"[Twilio WhatsApp] Error: {e}")
                return {"success": False, "error": str(e)}
        
        # Mock response
        print(f"[MOCK WHATSAPP] To: {to_number}, Message: {message[:50]}...")
        return {
            "success": True,
            "message_sid": str(uuid4()),
            "mock": True,
            "note": "WhatsApp mocked - Configure Twilio WhatsApp in Admin Settings"
        }
    
    async def send_otp(
        self,
        phone_number: str,
        otp: str,
        purpose: str = "verification",
        db=None
    ) -> Dict:
        """Send OTP via SMS and/or WhatsApp"""
        
        message = f"Your AirYatra OTP for {purpose}: {otp}\n\nValid for 30 minutes. Do not share with anyone.\n\nआपका AirYatra OTP: {otp}"
        
        # Try SMS first
        sms_result = await self.send_sms(phone_number, message, db)
        
        # Also send via WhatsApp if configured
        whatsapp_result = await self.send_whatsapp(phone_number, message, db)
        
        return {
            "success": sms_result.get("success") or whatsapp_result.get("success"),
            "sms": sms_result,
            "whatsapp": whatsapp_result,
            "otp_sent": True
        }
    
    async def send_booking_confirmation(
        self,
        booking: Dict,
        customer_email: str,
        customer_phone: Optional[str] = None,
        db=None
    ) -> Dict:
        """Send booking confirmation via email and WhatsApp"""
        
        # Email content
        html_content = f"""
        <html>
        <body style="font-family: Arial, sans-serif; background: #1a1a2e; color: #fff; padding: 20px;">
            <div style="max-width: 600px; margin: 0 auto; background: #16213e; padding: 30px; border-radius: 10px;">
                <h1 style="color: #f97316;">✈️ Booking Confirmed!</h1>
                <p>Dear Customer,</p>
                <p>Your helicopter booking has been confirmed.</p>
                
                <div style="background: #1a1a2e; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="color: #f97316;">Booking Details</h3>
                    <p><strong>Booking ID:</strong> {booking.get('booking_number', booking.get('id', 'N/A')[:8])}</p>
                    <p><strong>Route:</strong> {booking.get('from_location')} → {booking.get('to_location')}</p>
                    <p><strong>Date:</strong> {booking.get('departure_date', 'TBD')}</p>
                    <p><strong>Pickup Time:</strong> {booking.get('pickup_time', 'TBD')}</p>
                    <p><strong>Passengers:</strong> {booking.get('passengers', 1)}</p>
                    <p><strong>Purpose:</strong> {booking.get('booking_purpose', 'General')}</p>
                    <p><strong>Amount:</strong> ₹{booking.get('total_amount', 0):,}</p>
                </div>
                
                <p>Thank you for choosing AirYatra!</p>
                <p style="color: #888;">For any queries, contact support@airyatra.com</p>
            </div>
        </body>
        </html>
        """
        
        email_result = await self.send_email(
            to_email=customer_email,
            subject=f"✈️ Booking Confirmed - {booking.get('booking_number', '')} | AirYatra",
            html_content=html_content,
            db=db
        )
        
        # WhatsApp message
        whatsapp_result = None
        if customer_phone:
            whatsapp_message = f"""✈️ *AirYatra Booking Confirmed*

📋 Booking ID: {booking.get('booking_number', booking.get('id', '')[:8])}
📍 Route: {booking.get('from_location')} → {booking.get('to_location')}
📅 Date: {booking.get('departure_date', 'TBD')}
⏰ Pickup: {booking.get('pickup_time', 'TBD')}
👥 Passengers: {booking.get('passengers', 1)}
💰 Amount: ₹{booking.get('total_amount', 0):,}

Thank you for choosing AirYatra!
धन्यवाद AirYatra को चुनने के लिए!"""
            
            whatsapp_result = await self.send_whatsapp(customer_phone, whatsapp_message, db)
        
        return {
            "email": email_result,
            "whatsapp": whatsapp_result
        }
    
    async def send_journey_otp_notification(
        self,
        phone_number: str,
        otp: str,
        otp_type: str,
        booking_info: Dict,
        db=None
    ) -> Dict:
        """Send journey OTP to customer"""
        
        otp_messages = {
            "pickup": f"""🚁 *AirYatra Journey OTP*

Your pilot has arrived for pickup!
आपका पायलट पिकअप के लिए आ गया है!

📋 Booking: {booking_info.get('booking_number', '')}
🔐 OTP: *{otp}*

Share this OTP with pilot to confirm pickup.
पिकअप की पुष्टि के लिए यह OTP पायलट को दें।""",
            
            "start_journey": f"""🚁 *AirYatra Journey Start OTP*

Ready to start your journey!
यात्रा शुरू करने के लिए तैयार!

📋 Booking: {booking_info.get('booking_number', '')}
🔐 OTP: *{otp}*

Share this OTP with pilot to start flight.
उड़ान शुरू करने के लिए यह OTP पायलट को दें।""",
            
            "complete_journey": f"""🚁 *AirYatra Journey Completion OTP*

You have reached your destination!
आप अपनी मंजिल पर पहुंच गए हैं!

📋 Booking: {booking_info.get('booking_number', '')}
🔐 OTP: *{otp}*

Share this OTP with pilot to complete journey.
यात्रा पूर्ण करने के लिए यह OTP पायलट को दें।"""
        }
        
        message = otp_messages.get(otp_type, f"Your AirYatra OTP: {otp}")
        
        # Send via both SMS and WhatsApp
        sms_result = await self.send_sms(phone_number, message.replace("*", ""), db)
        whatsapp_result = await self.send_whatsapp(phone_number, message, db)
        
        return {
            "success": sms_result.get("success") or whatsapp_result.get("success"),
            "sms": sms_result,
            "whatsapp": whatsapp_result
        }
    
    async def send_operator_notification(
        self,
        operator_email: str,
        notification_type: str,
        data: Dict,
        db=None
    ) -> Dict:
        """Send notification to operator"""
        
        templates = {
            "new_inquiry": {
                "subject": "🔔 New Booking Inquiry | AirYatra",
                "message": f"New booking inquiry received for route {data.get('route', 'N/A')}"
            },
            "booking_confirmed": {
                "subject": "✅ Booking Confirmed | AirYatra",
                "message": f"Booking {data.get('booking_id', '')} has been confirmed"
            },
            "document_expiry": {
                "subject": "⚠️ Document Expiry Alert | AirYatra",
                "message": f"Document {data.get('document_type', '')} is expiring soon"
            },
            "settlement_ready": {
                "subject": "💰 Settlement Ready | AirYatra",
                "message": f"Settlement of ₹{data.get('amount', 0):,} is ready for processing"
            }
        }
        
        template = templates.get(notification_type, {
            "subject": "Notification | AirYatra",
            "message": "You have a new notification"
        })
        
        html_content = f"""
        <html>
        <body style="font-family: Arial, sans-serif;">
            <h2>{template['subject']}</h2>
            <p>{template['message']}</p>
            <p>Login to your AirYatra dashboard for more details.</p>
        </body>
        </html>
        """
        
        return await self.send_email(
            to_email=operator_email,
            subject=template["subject"],
            html_content=html_content,
            db=db
        )
    
    async def send_admin_alert(
        self,
        alert_type: str,
        data: Dict,
        admin_emails: List[str] = None,
        db=None
    ) -> Dict:
        """Send alert to admin team"""
        
        if not admin_emails:
            admin_emails = ["admin@airyatra.com"]
        
        html_content = f"""
        <html>
        <body>
            <h2>🚨 Admin Alert: {alert_type}</h2>
            <pre>{str(data)}</pre>
        </body>
        </html>
        """
        
        results = []
        for email in admin_emails:
            result = await self.send_email(
                to_email=email,
                subject=f"[ALERT] {alert_type} | AirYatra Admin",
                html_content=html_content,
                db=db
            )
            results.append(result)
        
        return {"results": results}

# Singleton instance
notification_service = NotificationService()

# Helper functions for easy import
async def send_whatsapp_message(to_number: str, message: str, db=None) -> bool:
    """Helper function to send WhatsApp message"""
    result = await notification_service.send_whatsapp(to_number, message, db)
    return result.get("success", False)

async def send_sms_message(to_number: str, message: str, db=None) -> bool:
    """Helper function to send SMS"""
    result = await notification_service.send_sms(to_number, message, db)
    return result.get("success", False)

async def send_email_notification(to_email: str, subject: str, html_content: str, db=None) -> bool:
    """Helper function to send email"""
    result = await notification_service.send_email(to_email, subject, html_content, db=db)
    return result.get("success", False)
