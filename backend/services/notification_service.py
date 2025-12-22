import os
from typing import Optional, Dict, List
from datetime import datetime, timezone
from uuid import uuid4

# Configuration
SENDGRID_API_KEY = os.environ.get("SENDGRID_API_KEY", "")
TWILIO_ACCOUNT_SID = os.environ.get("TWILIO_ACCOUNT_SID", "")
TWILIO_AUTH_TOKEN = os.environ.get("TWILIO_AUTH_TOKEN", "")
TWILIO_WHATSAPP_NUMBER = os.environ.get("TWILIO_WHATSAPP_NUMBER", "")

class NotificationService:
    def __init__(self):
        self.sendgrid_key = SENDGRID_API_KEY
        self.twilio_sid = TWILIO_ACCOUNT_SID
        self.twilio_token = TWILIO_AUTH_TOKEN
        self.whatsapp_number = TWILIO_WHATSAPP_NUMBER
        
    async def send_email(
        self,
        to_email: str,
        subject: str,
        html_content: str,
        from_email: str = "noreply@airyatra.com"
    ) -> Dict:
        """Send email using SendGrid"""
        
        if self.sendgrid_key and self.sendgrid_key != "your-sendgrid-api-key":
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
                
                return {
                    "success": True,
                    "message_id": str(uuid4()),
                    "status_code": response.status_code
                }
            except Exception as e:
                print(f"SendGrid error: {e}")
                return {"success": False, "error": str(e)}
        
        # Mock response when API key not configured
        print(f"[MOCK EMAIL] To: {to_email}, Subject: {subject}")
        return {
            "success": True,
            "message_id": str(uuid4()),
            "mock": True,
            "note": "Email mocked - SendGrid API key not configured"
        }
    
    async def send_whatsapp(
        self,
        to_number: str,
        message: str
    ) -> Dict:
        """Send WhatsApp message using Twilio"""
        
        if self.twilio_sid and self.twilio_token and self.twilio_sid != "your-twilio-account-sid":
            try:
                from twilio.rest import Client
                
                client = Client(self.twilio_sid, self.twilio_token)
                
                # Format number for WhatsApp
                if not to_number.startswith('whatsapp:'):
                    to_number = f'whatsapp:{to_number}'
                
                msg = client.messages.create(
                    body=message,
                    from_=f'whatsapp:{self.whatsapp_number}',
                    to=to_number
                )
                
                return {
                    "success": True,
                    "message_sid": msg.sid,
                    "status": msg.status
                }
            except Exception as e:
                print(f"Twilio error: {e}")
                return {"success": False, "error": str(e)}
        
        # Mock response
        print(f"[MOCK WHATSAPP] To: {to_number}, Message: {message[:50]}...")
        return {
            "success": True,
            "message_sid": str(uuid4()),
            "mock": True,
            "note": "WhatsApp mocked - Twilio credentials not configured"
        }
    
    async def send_booking_confirmation(
        self,
        booking: Dict,
        customer_email: str,
        customer_phone: Optional[str] = None
    ) -> Dict:
        """Send booking confirmation via email and WhatsApp"""
        
        # Email content
        html_content = f"""
        <html>
        <body style="font-family: Arial, sans-serif; background: #1a1a2e; color: #fff; padding: 20px;">
            <div style="max-width: 600px; margin: 0 auto; background: #16213e; padding: 30px; border-radius: 10px;">
                <h1 style="color: #f97316;">Booking Confirmed! ✈️</h1>
                <p>Dear Customer,</p>
                <p>Your helicopter booking has been confirmed.</p>
                
                <div style="background: #1a1a2e; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="color: #f97316;">Booking Details</h3>
                    <p><strong>Booking ID:</strong> {booking.get('booking_number', booking.get('id', 'N/A')[:8])}</p>
                    <p><strong>Route:</strong> {booking.get('from_location')} → {booking.get('to_location')}</p>
                    <p><strong>Date:</strong> {booking.get('departure_date', 'TBD')}</p>
                    <p><strong>Passengers:</strong> {booking.get('passengers', 1)}</p>
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
            subject=f"Booking Confirmed - {booking.get('booking_number', '')} | AirYatra",
            html_content=html_content
        )
        
        # WhatsApp message
        whatsapp_result = None
        if customer_phone:
            whatsapp_message = f"""✈️ *AirYatra Booking Confirmed*

Booking ID: {booking.get('booking_number', booking.get('id', '')[:8])}
Route: {booking.get('from_location')} → {booking.get('to_location')}
Date: {booking.get('departure_date', 'TBD')}
Amount: ₹{booking.get('total_amount', 0):,}

Thank you for choosing AirYatra!"""
            
            whatsapp_result = await self.send_whatsapp(customer_phone, whatsapp_message)
        
        return {
            "email": email_result,
            "whatsapp": whatsapp_result
        }
    
    async def send_operator_notification(
        self,
        operator_email: str,
        notification_type: str,
        data: Dict
    ) -> Dict:
        """Send notification to operator"""
        
        templates = {
            "new_inquiry": {
                "subject": "New Booking Inquiry | AirYatra",
                "message": f"New booking inquiry received for route {data.get('route', 'N/A')}"
            },
            "booking_confirmed": {
                "subject": "Booking Confirmed | AirYatra",
                "message": f"Booking {data.get('booking_id', '')} has been confirmed"
            },
            "document_expiry": {
                "subject": "Document Expiry Alert | AirYatra",
                "message": f"Document {data.get('document_type', '')} is expiring soon"
            },
            "settlement_ready": {
                "subject": "Settlement Ready | AirYatra",
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
            html_content=html_content
        )
    
    async def send_admin_alert(
        self,
        alert_type: str,
        data: Dict,
        admin_emails: List[str] = None
    ) -> Dict:
        """Send alert to admin team"""
        
        if not admin_emails:
            admin_emails = ["admin@airyatra.com"]
        
        html_content = f"""
        <html>
        <body>
            <h2>Admin Alert: {alert_type}</h2>
            <pre>{str(data)}</pre>
        </body>
        </html>
        """
        
        results = []
        for email in admin_emails:
            result = await self.send_email(
                to_email=email,
                subject=f"[ALERT] {alert_type} | AirYatra Admin",
                html_content=html_content
            )
            results.append(result)
        
        return {"results": results}

# Singleton instance
notification_service = NotificationService()
