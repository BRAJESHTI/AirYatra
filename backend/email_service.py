from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail
from config import settings
import logging

logger = logging.getLogger(__name__)

class EmailService:
    def __init__(self):
        self.sg = SendGridAPIClient(settings.sendgrid_api_key)
        self.from_email = settings.sender_email
    
    def send_email(self, to_email: str, subject: str, html_content: str):
        """Send email via SendGrid"""
        try:
            message = Mail(
                from_email=self.from_email,
                to_emails=to_email,
                subject=subject,
                html_content=html_content
            )
            response = self.sg.send(message)
            logger.info(f"Email sent to {to_email}: {response.status_code}")
            return True
        except Exception as e:
            logger.error(f"Error sending email: {e}")
            return False
    
    def send_booking_confirmation(self, to_email: str, booking_data: dict):
        """Send booking confirmation email"""
        subject = f"Booking Confirmed - {booking_data['booking_number']}"
        html_content = f"""
        <html>
            <body style="font-family: Arial, sans-serif; padding: 20px;">
                <h2>Booking Confirmed!</h2>
                <p>Dear Customer,</p>
                <p>Your helicopter booking has been confirmed.</p>
                <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
                    <p><strong>Booking Number:</strong> {booking_data['booking_number']}</p>
                    <p><strong>Route:</strong> {booking_data['from_location']} → {booking_data['to_location']}</p>
                    <p><strong>Date:</strong> {booking_data['departure_date']}</p>
                    <p><strong>Passengers:</strong> {booking_data['passengers']}</p>
                </div>
                <p>Thank you for choosing AirYatra!</p>
            </body>
        </html>
        """
        return self.send_email(to_email, subject, html_content)
    
    def send_quote_notification(self, to_email: str, quote_data: dict):
        """Send quote notification email"""
        subject = "New Quote Received - AirYatra"
        html_content = f"""
        <html>
            <body style="font-family: Arial, sans-serif; padding: 20px;">
                <h2>New Quote Received!</h2>
                <p>Dear Customer,</p>
                <p>You have received a new quote for your booking request.</p>
                <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
                    <p><strong>Quoted Price:</strong> ₹{quote_data['quoted_price']}</p>
                    <p><strong>Valid for:</strong> {quote_data['validity_hours']} hours</p>
                </div>
                <p>Please log in to your account to view and accept the quote.</p>
            </body>
        </html>
        """
        return self.send_email(to_email, subject, html_content)

email_service = EmailService()