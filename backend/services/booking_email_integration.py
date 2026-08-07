"""
AirYatra Booking Email Integration
Automatic email triggers for booking lifecycle events
"""

import asyncio
import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)

# Import services
try:
    from services.branded_email_templates import get_branded_email
    from services.email_tracking_service import email_tracking_service, create_email_tracking_record
    from services.email_multilang_service import detect_user_language, get_translation
    from services.email_service import email_service
    SERVICES_AVAILABLE = True
except ImportError as e:
    logger.warning(f"Some email services not available: {e}")
    SERVICES_AVAILABLE = False


class BookingEmailIntegration:
    """Handles automatic email sending for booking events"""
    
    def __init__(self):
        self.enabled = SERVICES_AVAILABLE
    
    async def send_booking_confirmation(
        self,
        booking: Dict[str, Any],
        customer: Dict[str, Any],
        db = None
    ) -> Dict[str, Any]:
        """Send booking confirmation email when booking is confirmed"""
        
        if not self.enabled:
            return {"success": False, "error": "Email services not available"}
        
        try:
            # Extract data
            customer_name = customer.get("name", customer.get("full_name", "Valued Customer"))
            customer_email = customer.get("email")
            
            if not customer_email:
                return {"success": False, "error": "Customer email not found"}
            
            # Detect language preference
            lang = detect_user_language(customer.get("preferences"), "en")
            
            # Generate email
            email_data = get_branded_email(
                "booking_confirmation",
                customer_name=customer_name,
                booking_id=booking.get("booking_id", booking.get("id", "N/A")),
                from_city=booking.get("from_city", booking.get("origin", "N/A")),
                to_city=booking.get("to_city", booking.get("destination", "N/A")),
                departure_date=booking.get("departure_date", booking.get("date", "N/A")),
                departure_time=booking.get("departure_time", booking.get("time", "N/A")),
                passenger_count=booking.get("passenger_count", booking.get("passengers", 1)),
                total_amount=str(booking.get("total_amount", booking.get("amount", "0"))),
                payment_status=booking.get("payment_status", "Paid"),
                aircraft_type=booking.get("aircraft_type", "Helicopter"),
                operator_name=booking.get("operator_name", "AirYatra Partner"),
                pnr=booking.get("pnr"),
                theme="dark"
            )
            
            if not email_data:
                return {"success": False, "error": "Failed to generate email template"}
            
            # Generate tracking ID and inject tracking
            tracking_id = email_tracking_service.generate_tracking_id(booking.get("booking_id"))
            tracked_html = email_tracking_service.inject_tracking_into_html(
                email_data["html"], 
                tracking_id
            )
            
            # Send email
            await email_service.send_email(customer_email, email_data["subject"], tracked_html)
            
            # Log tracking record
            if db:
                tracking_record = create_email_tracking_record(
                    tracking_id=tracking_id,
                    email_type="booking_confirmation",
                    recipient=customer_email,
                    subject=email_data["subject"],
                    template_name="booking_confirmation",
                    booking_id=booking.get("booking_id"),
                    user_id=customer.get("id"),
                    metadata={"language": lang}
                )
                await db.email_tracking.insert_one(tracking_record)
            
            logger.info(f"Booking confirmation email sent to {customer_email} for {booking.get('booking_id')}")
            
            return {
                "success": True,
                "tracking_id": tracking_id,
                "recipient": customer_email,
                "template": "booking_confirmation"
            }
            
        except Exception as e:
            logger.error(f"Failed to send booking confirmation: {e}")
            return {"success": False, "error": str(e)}
    
    async def send_payment_receipt(
        self,
        payment: Dict[str, Any],
        booking: Dict[str, Any],
        customer: Dict[str, Any],
        db = None
    ) -> Dict[str, Any]:
        """Send payment receipt email after successful payment"""
        
        if not self.enabled:
            return {"success": False, "error": "Email services not available"}
        
        try:
            customer_email = customer.get("email")
            if not customer_email:
                return {"success": False, "error": "Customer email not found"}
            
            email_data = get_branded_email(
                "payment_receipt",
                customer_name=customer.get("name", "Valued Customer"),
                booking_id=booking.get("booking_id", "N/A"),
                transaction_id=payment.get("transaction_id", payment.get("id", "N/A")),
                amount=str(payment.get("amount", "0")),
                payment_method=payment.get("method", payment.get("payment_method", "Online")),
                payment_date=datetime.now().strftime("%d %b %Y, %I:%M %p"),
                from_city=booking.get("from_city", "N/A"),
                to_city=booking.get("to_city", "N/A"),
                gst_amount=str(payment.get("gst_amount", "0")),
                invoice_number=payment.get("invoice_number"),
                theme="dark"
            )
            
            if not email_data:
                return {"success": False, "error": "Failed to generate email template"}
            
            tracking_id = email_tracking_service.generate_tracking_id(payment.get("transaction_id"))
            tracked_html = email_tracking_service.inject_tracking_into_html(email_data["html"], tracking_id)
            
            await email_service.send_email(customer_email, email_data["subject"], tracked_html)
            
            if db:
                tracking_record = create_email_tracking_record(
                    tracking_id=tracking_id,
                    email_type="payment_receipt",
                    recipient=customer_email,
                    subject=email_data["subject"],
                    template_name="payment_receipt",
                    booking_id=booking.get("booking_id"),
                    user_id=customer.get("id")
                )
                await db.email_tracking.insert_one(tracking_record)
            
            return {"success": True, "tracking_id": tracking_id, "recipient": customer_email}
            
        except Exception as e:
            logger.error(f"Failed to send payment receipt: {e}")
            return {"success": False, "error": str(e)}
    
    async def send_flight_reminder(
        self,
        booking: Dict[str, Any],
        customer: Dict[str, Any],
        helipad: Dict[str, Any] = None,
        db = None
    ) -> Dict[str, Any]:
        """Send flight reminder email 24 hours before departure"""
        
        if not self.enabled:
            return {"success": False, "error": "Email services not available"}
        
        try:
            customer_email = customer.get("email")
            if not customer_email:
                return {"success": False, "error": "Customer email not found"}
            
            # Calculate reporting time (30 mins before departure)
            departure_time = booking.get("departure_time", "07:00 AM")
            
            email_data = get_branded_email(
                "flight_reminder",
                customer_name=customer.get("name", "Valued Customer"),
                booking_id=booking.get("booking_id", "N/A"),
                from_city=booking.get("from_city", "N/A"),
                to_city=booking.get("to_city", "N/A"),
                departure_date=booking.get("departure_date", "Tomorrow"),
                departure_time=departure_time,
                helipad_name=helipad.get("name", "Departure Helipad") if helipad else "Departure Helipad",
                helipad_address=helipad.get("address", "Contact support for location") if helipad else "Contact support for location",
                reporting_time=f"30 mins before {departure_time}",
                passenger_count=booking.get("passenger_count", 1),
                theme="dark"
            )
            
            if not email_data:
                return {"success": False, "error": "Failed to generate email template"}
            
            tracking_id = email_tracking_service.generate_tracking_id(booking.get("booking_id"))
            tracked_html = email_tracking_service.inject_tracking_into_html(email_data["html"], tracking_id)
            
            await email_service.send_email(customer_email, email_data["subject"], tracked_html)
            
            if db:
                tracking_record = create_email_tracking_record(
                    tracking_id=tracking_id,
                    email_type="flight_reminder",
                    recipient=customer_email,
                    subject=email_data["subject"],
                    template_name="flight_reminder",
                    booking_id=booking.get("booking_id"),
                    user_id=customer.get("id")
                )
                await db.email_tracking.insert_one(tracking_record)
            
            return {"success": True, "tracking_id": tracking_id, "recipient": customer_email}
            
        except Exception as e:
            logger.error(f"Failed to send flight reminder: {e}")
            return {"success": False, "error": str(e)}
    
    async def send_flight_rescheduled(
        self,
        booking: Dict[str, Any],
        customer: Dict[str, Any],
        old_schedule: Dict[str, Any],
        new_schedule: Dict[str, Any],
        reason: str = "Operational requirements",
        db = None
    ) -> Dict[str, Any]:
        """Send notification when flight is rescheduled"""
        
        if not self.enabled:
            return {"success": False, "error": "Email services not available"}
        
        try:
            customer_email = customer.get("email")
            if not customer_email:
                return {"success": False, "error": "Customer email not found"}
            
            email_data = get_branded_email(
                "flight_rescheduled",
                customer_name=customer.get("name", "Valued Customer"),
                booking_id=booking.get("booking_id", "N/A"),
                from_city=booking.get("from_city", "N/A"),
                to_city=booking.get("to_city", "N/A"),
                old_date=old_schedule.get("date", "N/A"),
                old_time=old_schedule.get("time", "N/A"),
                new_date=new_schedule.get("date", "N/A"),
                new_time=new_schedule.get("time", "N/A"),
                reason=reason,
                theme="dark"
            )
            
            if not email_data:
                return {"success": False, "error": "Failed to generate email template"}
            
            tracking_id = email_tracking_service.generate_tracking_id(booking.get("booking_id"))
            tracked_html = email_tracking_service.inject_tracking_into_html(email_data["html"], tracking_id)
            
            await email_service.send_email(customer_email, email_data["subject"], tracked_html)
            
            if db:
                tracking_record = create_email_tracking_record(
                    tracking_id=tracking_id,
                    email_type="flight_rescheduled",
                    recipient=customer_email,
                    subject=email_data["subject"],
                    template_name="flight_rescheduled",
                    booking_id=booking.get("booking_id"),
                    user_id=customer.get("id"),
                    metadata={"reason": reason}
                )
                await db.email_tracking.insert_one(tracking_record)
            
            return {"success": True, "tracking_id": tracking_id, "recipient": customer_email}
            
        except Exception as e:
            logger.error(f"Failed to send reschedule notification: {e}")
            return {"success": False, "error": str(e)}
    
    async def send_flight_cancelled(
        self,
        booking: Dict[str, Any],
        customer: Dict[str, Any],
        cancellation_reason: str,
        refund_amount: str,
        cancelled_by: str = "Operator",
        db = None
    ) -> Dict[str, Any]:
        """Send notification when flight is cancelled"""
        
        if not self.enabled:
            return {"success": False, "error": "Email services not available"}
        
        try:
            customer_email = customer.get("email")
            if not customer_email:
                return {"success": False, "error": "Customer email not found"}
            
            email_data = get_branded_email(
                "flight_cancelled",
                customer_name=customer.get("name", "Valued Customer"),
                booking_id=booking.get("booking_id", "N/A"),
                from_city=booking.get("from_city", "N/A"),
                to_city=booking.get("to_city", "N/A"),
                departure_date=booking.get("departure_date", "N/A"),
                cancellation_reason=cancellation_reason,
                refund_amount=refund_amount,
                refund_status="Processing",
                refund_timeline="5-7 business days",
                cancelled_by=cancelled_by,
                theme="dark"
            )
            
            if not email_data:
                return {"success": False, "error": "Failed to generate email template"}
            
            tracking_id = email_tracking_service.generate_tracking_id(booking.get("booking_id"))
            tracked_html = email_tracking_service.inject_tracking_into_html(email_data["html"], tracking_id)
            
            await email_service.send_email(customer_email, email_data["subject"], tracked_html)
            
            if db:
                tracking_record = create_email_tracking_record(
                    tracking_id=tracking_id,
                    email_type="flight_cancelled",
                    recipient=customer_email,
                    subject=email_data["subject"],
                    template_name="flight_cancelled",
                    booking_id=booking.get("booking_id"),
                    user_id=customer.get("id"),
                    metadata={"reason": cancellation_reason, "refund": refund_amount}
                )
                await db.email_tracking.insert_one(tracking_record)
            
            return {"success": True, "tracking_id": tracking_id, "recipient": customer_email}
            
        except Exception as e:
            logger.error(f"Failed to send cancellation notification: {e}")
            return {"success": False, "error": str(e)}
    
    async def send_flight_completed(
        self,
        booking: Dict[str, Any],
        customer: Dict[str, Any],
        flight_details: Dict[str, Any] = None,
        db = None
    ) -> Dict[str, Any]:
        """Send thank you email after flight completion"""
        
        if not self.enabled:
            return {"success": False, "error": "Email services not available"}
        
        try:
            customer_email = customer.get("email")
            if not customer_email:
                return {"success": False, "error": "Customer email not found"}
            
            email_data = get_branded_email(
                "flight_completed",
                customer_name=customer.get("name", "Valued Customer"),
                booking_id=booking.get("booking_id", "N/A"),
                from_city=booking.get("from_city", "N/A"),
                to_city=booking.get("to_city", "N/A"),
                flight_date=booking.get("departure_date", datetime.now().strftime("%d %b %Y")),
                flight_duration=flight_details.get("duration", "N/A") if flight_details else "N/A",
                pilot_name=flight_details.get("pilot_name") if flight_details else None,
                theme="dark"
            )
            
            if not email_data:
                return {"success": False, "error": "Failed to generate email template"}
            
            tracking_id = email_tracking_service.generate_tracking_id(booking.get("booking_id"))
            tracked_html = email_tracking_service.inject_tracking_into_html(email_data["html"], tracking_id)
            
            await email_service.send_email(customer_email, email_data["subject"], tracked_html)
            
            if db:
                tracking_record = create_email_tracking_record(
                    tracking_id=tracking_id,
                    email_type="flight_completed",
                    recipient=customer_email,
                    subject=email_data["subject"],
                    template_name="flight_completed",
                    booking_id=booking.get("booking_id"),
                    user_id=customer.get("id")
                )
                await db.email_tracking.insert_one(tracking_record)
            
            return {"success": True, "tracking_id": tracking_id, "recipient": customer_email}
            
        except Exception as e:
            logger.error(f"Failed to send completion email: {e}")
            return {"success": False, "error": str(e)}


# Singleton instance
booking_email_integration = BookingEmailIntegration()


# ==================== EVENT HOOKS ====================

async def on_booking_confirmed(booking: Dict, customer: Dict, db):
    """Hook to call when booking status changes to confirmed"""
    return await booking_email_integration.send_booking_confirmation(booking, customer, db)


async def on_payment_success(payment: Dict, booking: Dict, customer: Dict, db):
    """Hook to call when payment is successful"""
    return await booking_email_integration.send_payment_receipt(payment, booking, customer, db)


async def on_booking_rescheduled(booking: Dict, customer: Dict, old_schedule: Dict, new_schedule: Dict, reason: str, db):
    """Hook to call when booking is rescheduled"""
    return await booking_email_integration.send_flight_rescheduled(booking, customer, old_schedule, new_schedule, reason, db)


async def on_booking_cancelled(booking: Dict, customer: Dict, reason: str, refund_amount: str, cancelled_by: str, db):
    """Hook to call when booking is cancelled"""
    return await booking_email_integration.send_flight_cancelled(booking, customer, reason, refund_amount, cancelled_by, db)


async def on_flight_completed(booking: Dict, customer: Dict, flight_details: Dict, db):
    """Hook to call when flight is completed"""
    return await booking_email_integration.send_flight_completed(booking, customer, flight_details, db)
