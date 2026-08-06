"""
Auction Notification Service
SMS/WhatsApp/Email/In-App notifications for auction events
"""

import os
import logging
from datetime import datetime, timezone
from typing import Optional, List, Dict
from enum import Enum
import uuid
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

logger = logging.getLogger(__name__)


class NotificationChannel(str, Enum):
    IN_APP = "in_app"
    SMS = "sms"
    WHATSAPP = "whatsapp"
    EMAIL = "email"


class NotificationType(str, Enum):
    AUCTION_CREATED = "auction_created"
    AUCTION_BID_PLACED = "auction_bid_placed"
    AUCTION_OUTBID = "auction_outbid"
    AUCTION_WON = "auction_won"
    AUCTION_LOST = "auction_lost"
    AUCTION_ENDING_SOON = "auction_ending_soon"
    AUCTION_EXPIRED = "auction_expired"
    AUCTION_CANCELLED = "auction_cancelled"
    NEW_AUCTION_OPPORTUNITY = "new_auction_opportunity"


# Notification Templates (English + Hindi)
NOTIFICATION_TEMPLATES = {
    NotificationType.AUCTION_CREATED: {
        "title": "Auction Created",
        "title_hi": "नीलामी बनाई गई",
        "message": "Your auction #{auction_number} has been created. Operators will start bidding soon!",
        "message_hi": "आपकी नीलामी #{auction_number} बन गई है। ऑपरेटर जल्द ही बोली लगाएंगे!",
        "sms": "AirYatra: Auction #{auction_number} created! {origin}→{destination} on {date}. Track: {link}"
    },
    NotificationType.AUCTION_BID_PLACED: {
        "title": "New Bid Received",
        "title_hi": "नई बोली आई",
        "message": "New bid of ₹{amount} received on your auction #{auction_number}",
        "message_hi": "आपकी नीलामी #{auction_number} पर ₹{amount} की नई बोली आई है",
        "sms": "AirYatra: New bid ₹{amount} on auction #{auction_number}! Current lowest: ₹{lowest}"
    },
    NotificationType.AUCTION_OUTBID: {
        "title": "You've Been Outbid",
        "title_hi": "आपकी बोली पिछड़ गई",
        "message": "Someone placed a lower bid of ₹{amount} on auction #{auction_number}. Your rank: #{rank}",
        "message_hi": "किसी ने नीलामी #{auction_number} पर ₹{amount} की कम बोली लगाई। आपकी रैंक: #{rank}",
        "sms": "AirYatra: Outbid on #{auction_number}! New lowest: ₹{amount}. Your rank: #{rank}. Bid again?"
    },
    NotificationType.AUCTION_WON: {
        "title": "Congratulations! You Won!",
        "title_hi": "बधाई हो! आपने जीता!",
        "message": "Your bid of ₹{amount} won auction #{auction_number}! Booking confirmed.",
        "message_hi": "आपकी ₹{amount} की बोली ने नीलामी #{auction_number} जीती! बुकिंग कन्फर्म।",
        "sms": "AirYatra: 🎉 You WON auction #{auction_number}! Bid: ₹{amount}. Booking ref: {booking_ref}"
    },
    NotificationType.AUCTION_LOST: {
        "title": "Auction Completed",
        "title_hi": "नीलामी पूरी हुई",
        "message": "Auction #{auction_number} has been won by another operator. Better luck next time!",
        "message_hi": "नीलामी #{auction_number} किसी और ऑपरेटर ने जीती। अगली बार बेहतर किस्मत!",
        "sms": "AirYatra: Auction #{auction_number} won by another operator. Keep bidding on new auctions!"
    },
    NotificationType.AUCTION_ENDING_SOON: {
        "title": "Auction Ending Soon!",
        "title_hi": "नीलामी जल्द खत्म!",
        "message": "Auction #{auction_number} ends in {minutes} minutes! Current lowest: ₹{lowest}",
        "message_hi": "नीलामी #{auction_number} {minutes} मिनट में खत्म! वर्तमान न्यूनतम: ₹{lowest}",
        "sms": "AirYatra: ⏰ Auction #{auction_number} ends in {minutes}min! Lowest: ₹{lowest}. Bid now!"
    },
    NotificationType.NEW_AUCTION_OPPORTUNITY: {
        "title": "New Auction Opportunity",
        "title_hi": "नई नीलामी का अवसर",
        "message": "New booking request: {origin} → {destination} on {date}. {passengers} passengers. Bid now!",
        "message_hi": "नई बुकिंग: {origin} → {destination}, {date}। {passengers} यात्री। अभी बोली लगाएं!",
        "sms": "AirYatra: New auction! {origin}→{destination} on {date}. {passengers} pax. Max budget: ₹{budget}. Bid now!"
    },
    NotificationType.AUCTION_EXPIRED: {
        "title": "Auction Expired",
        "title_hi": "नीलामी समाप्त",
        "message": "Auction #{auction_number} has expired without a winner.",
        "message_hi": "नीलामी #{auction_number} बिना विजेता के समाप्त हो गई।",
        "sms": "AirYatra: Auction #{auction_number} expired. No bids accepted."
    },
    NotificationType.AUCTION_CANCELLED: {
        "title": "Auction Cancelled",
        "title_hi": "नीलामी रद्द",
        "message": "Auction #{auction_number} has been cancelled by the customer.",
        "message_hi": "नीलामी #{auction_number} ग्राहक द्वारा रद्द कर दी गई।",
        "sms": "AirYatra: Auction #{auction_number} cancelled."
    }
}


class AuctionNotificationService:
    """Handles all auction-related notifications"""
    
    def __init__(self, db):
        self.db = db
        self.twilio_client = None
        self.twilio_enabled = False
        self._init_twilio()
    
    def _init_twilio(self):
        """Initialize Twilio client if credentials available"""
        account_sid = os.environ.get("TWILIO_ACCOUNT_SID")
        auth_token = os.environ.get("TWILIO_AUTH_TOKEN")
        
        if account_sid and auth_token and account_sid != "your_account_sid":
            try:
                from twilio.rest import Client
                self.twilio_client = Client(account_sid, auth_token)
                self.twilio_enabled = True
                logger.info("Twilio SMS service initialized")
            except ImportError:
                logger.warning("Twilio library not installed. SMS disabled.")
            except Exception as e:
                logger.error(f"Twilio init failed: {e}")
        else:
            logger.info("Twilio credentials not configured. SMS notifications disabled.")
    
    async def get_notification_settings(self) -> dict:
        """Get current notification settings"""
        settings = await self.db.notification_settings.find_one(
            {"setting_id": "auction_notifications"},
            {"_id": 0}
        )
        
        if not settings:
            # Default settings
            settings = {
                "setting_id": "auction_notifications",
                "channels": {
                    "in_app": True,
                    "email": True,
                    "sms": False,  # Disabled by default until Twilio configured
                    "whatsapp": False
                },
                "events": {
                    "auction_created": ["in_app", "email"],
                    "auction_bid_placed": ["in_app"],
                    "auction_outbid": ["in_app", "email", "sms"],
                    "auction_won": ["in_app", "email", "sms"],
                    "auction_lost": ["in_app", "email"],
                    "auction_ending_soon": ["in_app", "sms"],
                    "new_auction_opportunity": ["in_app", "email"],
                    "auction_expired": ["in_app"],
                    "auction_cancelled": ["in_app", "email"]
                },
                "sms_enabled": self.twilio_enabled,
                "whatsapp_enabled": False,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await self.db.notification_settings.insert_one(settings)
        
        settings["sms_enabled"] = self.twilio_enabled
        return settings
    
    async def send_notification(
        self,
        notification_type: NotificationType,
        user_id: str,
        data: dict,
        channels: Optional[List[NotificationChannel]] = None
    ) -> dict:
        """Send notification through configured channels"""
        
        settings = await self.get_notification_settings()
        template = NOTIFICATION_TEMPLATES.get(notification_type, {})
        
        # Determine which channels to use
        if channels is None:
            channels = settings.get("events", {}).get(notification_type.value, ["in_app"])
        
        results = {
            "notification_id": str(uuid.uuid4()),
            "type": notification_type.value,
            "user_id": user_id,
            "channels_sent": [],
            "channels_failed": [],
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
        # Get user info for contact details
        user = await self.db.users.find_one({"id": user_id}, {"_id": 0})
        if not user:
            user = {"email": None, "phone": None}
        
        # Format messages with data
        title = template.get("title", "Notification").format(**data)
        title_hi = template.get("title_hi", title).format(**data)
        message = template.get("message", "").format(**data)
        message_hi = template.get("message_hi", message).format(**data)
        sms_text = template.get("sms", message).format(**data)
        
        # Send In-App Notification
        if "in_app" in channels or NotificationChannel.IN_APP.value in channels:
            try:
                in_app_notif = {
                    "id": results["notification_id"],
                    "type": notification_type.value,
                    "user_id": user_id,
                    "title": title,
                    "title_hi": title_hi,
                    "message": message,
                    "message_hi": message_hi,
                    "data": data,
                    "read": False,
                    "created_at": datetime.now(timezone.utc).isoformat()
                }
                await self.db.notifications.insert_one(in_app_notif)
                results["channels_sent"].append("in_app")
            except Exception as e:
                logger.error(f"In-app notification failed: {e}")
                results["channels_failed"].append({"channel": "in_app", "error": str(e)})
        
        # Send Email Notification
        if ("email" in channels or NotificationChannel.EMAIL.value in channels) and user.get("email"):
            try:
                await self._send_email(user["email"], title, message, data)
                results["channels_sent"].append("email")
            except Exception as e:
                logger.error(f"Email notification failed: {e}")
                results["channels_failed"].append({"channel": "email", "error": str(e)})
        
        # Send SMS Notification
        if ("sms" in channels or NotificationChannel.SMS.value in channels) and self.twilio_enabled:
            phone = user.get("phone") or user.get("mobile")
            if phone:
                try:
                    await self._send_sms(phone, sms_text)
                    results["channels_sent"].append("sms")
                except Exception as e:
                    logger.error(f"SMS notification failed: {e}")
                    results["channels_failed"].append({"channel": "sms", "error": str(e)})
        
        # Log notification
        await self.db.notification_logs.insert_one({
            "notification_id": results["notification_id"],
            "type": notification_type.value,
            "user_id": user_id,
            "data": data,
            "channels_sent": results["channels_sent"],
            "channels_failed": results["channels_failed"],
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        
        return results
    
    async def _send_email(self, to_email: str, subject: str, body: str, data: dict):
        """Send email notification via SMTP"""
        smtp_host = os.environ.get("SMTP_HOST", "smtp.gmail.com")
        smtp_port = int(os.environ.get("SMTP_PORT", 587))
        smtp_user = os.environ.get("SMTP_USER")
        smtp_password = os.environ.get("SMTP_PASSWORD")
        from_email = os.environ.get("SMTP_FROM_EMAIL", smtp_user)
        from_name = os.environ.get("SMTP_FROM_NAME", "AirYatra")
        
        if not smtp_user or not smtp_password:
            logger.warning("SMTP credentials not configured")
            return
        
        msg = MIMEMultipart("alternative")
        msg["Subject"] = f"AirYatra: {subject}"
        msg["From"] = f"{from_name} <{from_email}>"
        msg["To"] = to_email
        
        # HTML email template
        html_body = f"""
        <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #f97316, #ea580c); padding: 20px; border-radius: 10px 10px 0 0;">
                <h1 style="color: white; margin: 0;">✈️ AirYatra</h1>
            </div>
            <div style="background: #1e293b; padding: 30px; border-radius: 0 0 10px 10px; color: #e2e8f0;">
                <h2 style="color: #f97316; margin-top: 0;">{subject}</h2>
                <p style="font-size: 16px; line-height: 1.6;">{body}</p>
                
                {'<div style="background: #334155; padding: 15px; border-radius: 8px; margin: 20px 0;">' +
                 '<p style="margin: 5px 0;"><strong>Route:</strong> ' + data.get('origin', '') + ' → ' + data.get('destination', '') + '</p>' +
                 '<p style="margin: 5px 0;"><strong>Date:</strong> ' + data.get('date', data.get('journey_date', '')) + '</p>' +
                 '</div>' if data.get('origin') else ''}
                
                <a href="https://aviation-erp-2.preview.emergentagent.com/auctions" 
                   style="display: inline-block; background: #f97316; color: white; padding: 12px 24px; 
                          text-decoration: none; border-radius: 6px; margin-top: 20px;">
                    View Auction Details
                </a>
            </div>
            <p style="color: #64748b; font-size: 12px; text-align: center; margin-top: 20px;">
                © 2026 AirYatra - India's Aviation Operating System
            </p>
        </body>
        </html>
        """
        
        msg.attach(MIMEText(body, "plain"))
        msg.attach(MIMEText(html_body, "html"))
        
        with smtplib.SMTP(smtp_host, smtp_port) as server:
            server.starttls()
            server.login(smtp_user, smtp_password)
            server.sendmail(from_email, to_email, msg.as_string())
        
        logger.info(f"Email sent to {to_email}")
    
    async def _send_sms(self, phone: str, message: str):
        """Send SMS via Twilio"""
        if not self.twilio_enabled or not self.twilio_client:
            raise Exception("Twilio SMS not configured")
        
        from_number = os.environ.get("TWILIO_PHONE_NUMBER")
        if not from_number:
            raise Exception("TWILIO_PHONE_NUMBER not configured")
        
        # Ensure phone is in E.164 format
        if not phone.startswith("+"):
            phone = f"+91{phone}"  # Default to India
        
        self.twilio_client.messages.create(
            body=message,
            from_=from_number,
            to=phone
        )
        
        logger.info(f"SMS sent to {phone}")
    
    async def notify_auction_created(self, auction: dict):
        """Notify customer that auction was created"""
        await self.send_notification(
            NotificationType.AUCTION_CREATED,
            auction.get("customer_id"),
            {
                "auction_number": auction.get("auction_number"),
                "origin": auction.get("origin"),
                "destination": auction.get("destination"),
                "date": auction.get("journey_date"),
                "link": f"https://aviation-erp-2.preview.emergentagent.com/auctions/{auction.get('auction_id')}"
            }
        )
    
    async def notify_operators_new_auction(self, auction: dict, operator_ids: List[str]):
        """Notify eligible operators about new auction opportunity"""
        for operator_id in operator_ids:
            # Get operator's user_id
            operator = await self.db.operators.find_one({"id": operator_id}, {"_id": 0, "user_id": 1})
            if operator and operator.get("user_id"):
                await self.send_notification(
                    NotificationType.NEW_AUCTION_OPPORTUNITY,
                    operator["user_id"],
                    {
                        "auction_number": auction.get("auction_number"),
                        "origin": auction.get("origin"),
                        "destination": auction.get("destination"),
                        "date": auction.get("journey_date"),
                        "passengers": auction.get("passengers"),
                        "budget": auction.get("max_budget", "N/A")
                    },
                    channels=["in_app", "email", "sms"]
                )
    
    async def notify_bid_placed(self, auction: dict, bid: dict):
        """Notify customer about new bid on their auction"""
        await self.send_notification(
            NotificationType.AUCTION_BID_PLACED,
            auction.get("customer_id"),
            {
                "auction_number": auction.get("auction_number"),
                "amount": bid.get("bid_amount"),
                "lowest": auction.get("lowest_bid", bid.get("bid_amount"))
            }
        )
    
    async def notify_outbid(self, auction: dict, outbid_operator_user_id: str, new_lowest: float, their_rank: int):
        """Notify operator they've been outbid"""
        await self.send_notification(
            NotificationType.AUCTION_OUTBID,
            outbid_operator_user_id,
            {
                "auction_number": auction.get("auction_number"),
                "amount": new_lowest,
                "rank": their_rank
            },
            channels=["in_app", "sms"]  # Urgent - include SMS
        )
    
    async def notify_auction_won(self, auction: dict, winning_bid: dict, booking_ref: str):
        """Notify winning operator"""
        operator = await self.db.operators.find_one(
            {"id": winning_bid.get("operator_id")},
            {"_id": 0, "user_id": 1}
        )
        if operator and operator.get("user_id"):
            await self.send_notification(
                NotificationType.AUCTION_WON,
                operator["user_id"],
                {
                    "auction_number": auction.get("auction_number"),
                    "amount": winning_bid.get("bid_amount"),
                    "booking_ref": booking_ref
                },
                channels=["in_app", "email", "sms"]
            )
    
    async def notify_auction_lost(self, auction: dict, losing_operator_ids: List[str]):
        """Notify losing operators"""
        for operator_id in losing_operator_ids:
            operator = await self.db.operators.find_one({"id": operator_id}, {"_id": 0, "user_id": 1})
            if operator and operator.get("user_id"):
                await self.send_notification(
                    NotificationType.AUCTION_LOST,
                    operator["user_id"],
                    {"auction_number": auction.get("auction_number")}
                )
    
    async def notify_auction_ending_soon(self, auction: dict, minutes_remaining: int):
        """Notify all bidders that auction is ending soon"""
        for bid in auction.get("bids", []):
            operator = await self.db.operators.find_one(
                {"id": bid.get("operator_id")},
                {"_id": 0, "user_id": 1}
            )
            if operator and operator.get("user_id"):
                await self.send_notification(
                    NotificationType.AUCTION_ENDING_SOON,
                    operator["user_id"],
                    {
                        "auction_number": auction.get("auction_number"),
                        "minutes": minutes_remaining,
                        "lowest": auction.get("lowest_bid", "N/A")
                    },
                    channels=["in_app", "sms"]
                )


# Singleton instance holder
_notification_service = None

def get_notification_service(db) -> AuctionNotificationService:
    """Get or create notification service instance"""
    global _notification_service
    if _notification_service is None:
        _notification_service = AuctionNotificationService(db)
    return _notification_service
