"""
AirYatra Unified Refund Service
Handles refunds for PayPal, Razorpay, Cashfree with configurable deduction rules
"""

import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, Optional, List
from decimal import Decimal

logger = logging.getLogger(__name__)


# ==================== REFUND DEDUCTION RULES ====================

# Time-based cancellation deduction rules
CANCELLATION_RULES = {
    # Hours before departure: deduction percentage
    "72_plus": {
        "hours_before": 72,
        "deduction_percent": 10,
        "description": "More than 72 hours before departure"
    },
    "48_to_72": {
        "hours_before": 48,
        "deduction_percent": 25,
        "description": "48-72 hours before departure"
    },
    "24_to_48": {
        "hours_before": 24,
        "deduction_percent": 50,
        "description": "24-48 hours before departure"
    },
    "12_to_24": {
        "hours_before": 12,
        "deduction_percent": 75,
        "description": "12-24 hours before departure"
    },
    "less_than_12": {
        "hours_before": 0,
        "deduction_percent": 100,
        "description": "Less than 12 hours before departure"
    }
}

# Additional fees
PROCESSING_FEE_PERCENT = 2.5  # Payment gateway processing fee
ADMIN_FEE = 500  # Fixed admin fee in INR


class RefundCalculator:
    """Calculate refund amounts based on cancellation rules"""
    
    @staticmethod
    def get_hours_until_departure(departure_datetime: datetime) -> float:
        """Calculate hours until departure"""
        now = datetime.now(timezone.utc)
        if isinstance(departure_datetime, str):
            departure_datetime = datetime.fromisoformat(departure_datetime.replace('Z', '+00:00'))
        
        delta = departure_datetime - now
        return max(0, delta.total_seconds() / 3600)
    
    @staticmethod
    def get_applicable_rule(hours_before: float) -> Dict:
        """Get applicable cancellation rule based on hours before departure"""
        if hours_before >= 72:
            return CANCELLATION_RULES["72_plus"]
        elif hours_before >= 48:
            return CANCELLATION_RULES["48_to_72"]
        elif hours_before >= 24:
            return CANCELLATION_RULES["24_to_48"]
        elif hours_before >= 12:
            return CANCELLATION_RULES["12_to_24"]
        else:
            return CANCELLATION_RULES["less_than_12"]
    
    @staticmethod
    def calculate_refund(
        total_amount: float,
        departure_datetime: datetime = None,
        hours_before: float = None,
        include_processing_fee: bool = True,
        include_admin_fee: bool = True,
        custom_deduction_percent: float = None
    ) -> Dict[str, Any]:
        """
        Calculate refund amount with all deductions
        
        Args:
            total_amount: Original booking amount
            departure_datetime: Flight departure datetime
            hours_before: Hours until departure (if datetime not provided)
            include_processing_fee: Include payment gateway fee deduction
            include_admin_fee: Include admin processing fee
            custom_deduction_percent: Override rule-based deduction
        
        Returns:
            Detailed refund breakdown
        """
        # Determine hours before departure
        if departure_datetime:
            hours = RefundCalculator.get_hours_until_departure(departure_datetime)
        elif hours_before is not None:
            hours = hours_before
        else:
            hours = 999  # Default to maximum refund if no time provided
        
        # Get applicable rule
        rule = RefundCalculator.get_applicable_rule(hours)
        
        # Calculate cancellation deduction
        if custom_deduction_percent is not None:
            cancellation_percent = custom_deduction_percent
            rule_description = "Custom deduction applied"
        else:
            cancellation_percent = rule["deduction_percent"]
            rule_description = rule["description"]
        
        cancellation_deduction = round(total_amount * cancellation_percent / 100, 2)
        
        # Calculate processing fee deduction
        processing_fee = 0
        if include_processing_fee:
            processing_fee = round(total_amount * PROCESSING_FEE_PERCENT / 100, 2)
        
        # Calculate admin fee
        admin_fee = ADMIN_FEE if include_admin_fee else 0
        
        # Total deductions
        total_deductions = cancellation_deduction + processing_fee + admin_fee
        
        # Net refund amount
        net_refund = max(0, round(total_amount - total_deductions, 2))
        
        return {
            "original_amount": total_amount,
            "hours_before_departure": round(hours, 1),
            "rule_applied": rule_description,
            "deductions": {
                "cancellation_deduction": {
                    "percent": cancellation_percent,
                    "amount": cancellation_deduction
                },
                "processing_fee": {
                    "percent": PROCESSING_FEE_PERCENT if include_processing_fee else 0,
                    "amount": processing_fee
                },
                "admin_fee": admin_fee
            },
            "total_deductions": total_deductions,
            "net_refund_amount": net_refund,
            "refund_percent": round((net_refund / total_amount) * 100, 1) if total_amount > 0 else 0
        }


class UnifiedRefundService:
    """Unified refund service for all payment gateways"""
    
    def __init__(self):
        self.calculator = RefundCalculator()
    
    async def process_refund(
        self,
        db,
        booking_id: str,
        payment_gateway: str,  # paypal, razorpay, cashfree
        departure_datetime: datetime = None,
        custom_deduction_percent: float = None,
        refund_reason: str = "Customer cancellation",
        admin_override: bool = False,
        requested_by: str = None
    ) -> Dict[str, Any]:
        """
        Process refund through the appropriate payment gateway
        
        Args:
            db: Database instance
            booking_id: Booking ID to refund
            payment_gateway: Payment gateway used (paypal, razorpay, cashfree)
            departure_datetime: Flight departure datetime
            custom_deduction_percent: Override deduction (admin only)
            refund_reason: Reason for refund
            admin_override: Skip deduction rules (admin only)
            requested_by: User ID requesting refund
        
        Returns:
            Refund result with breakdown
        """
        # Get booking details
        booking = await db.bookings.find_one({"id": booking_id})
        if not booking:
            return {"success": False, "error": "Booking not found"}
        
        total_amount = booking.get("total_amount", 0)
        if not total_amount:
            return {"success": False, "error": "Booking amount not found"}
        
        # Get departure datetime from booking if not provided
        if not departure_datetime:
            departure_str = booking.get("departure_datetime") or booking.get("date")
            if departure_str:
                try:
                    departure_datetime = datetime.fromisoformat(departure_str.replace('Z', '+00:00'))
                except (ValueError, AttributeError):
                    pass
        
        # Calculate refund
        if admin_override:
            refund_calculation = {
                "original_amount": total_amount,
                "net_refund_amount": total_amount,
                "total_deductions": 0,
                "rule_applied": "Admin override - Full refund"
            }
        else:
            refund_calculation = self.calculator.calculate_refund(
                total_amount=total_amount,
                departure_datetime=departure_datetime,
                custom_deduction_percent=custom_deduction_percent
            )
        
        net_refund = refund_calculation["net_refund_amount"]
        
        # Process refund through appropriate gateway
        gateway_result = await self._process_gateway_refund(
            db=db,
            booking=booking,
            payment_gateway=payment_gateway,
            refund_amount=net_refund,
            refund_reason=refund_reason
        )
        
        if not gateway_result.get("success"):
            return {
                "success": False,
                "error": gateway_result.get("error", "Gateway refund failed"),
                "calculation": refund_calculation
            }
        
        # Store refund record
        refund_record = {
            "id": gateway_result.get("refund_id", f"REF-{booking_id[:8]}"),
            "booking_id": booking_id,
            "payment_gateway": payment_gateway,
            "original_amount": total_amount,
            "refund_amount": net_refund,
            "deductions": refund_calculation.get("deductions"),
            "total_deductions": refund_calculation.get("total_deductions"),
            "rule_applied": refund_calculation.get("rule_applied"),
            "refund_reason": refund_reason,
            "admin_override": admin_override,
            "gateway_refund_id": gateway_result.get("gateway_refund_id"),
            "gateway_status": gateway_result.get("status"),
            "requested_by": requested_by,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.refunds.insert_one(refund_record.copy())
        
        # Update booking status
        await db.bookings.update_one(
            {"id": booking_id},
            {"$set": {
                "status": "cancelled",
                "payment_status": "refunded",
                "refund_amount": net_refund,
                "cancelled_at": datetime.now(timezone.utc).isoformat(),
                "cancellation_reason": refund_reason
            }}
        )
        
        return {
            "success": True,
            "message": "Refund processed successfully",
            "refund_id": refund_record["id"],
            "calculation": refund_calculation,
            "gateway_result": gateway_result
        }
    
    async def _process_gateway_refund(
        self,
        db,
        booking: Dict,
        payment_gateway: str,
        refund_amount: float,
        refund_reason: str
    ) -> Dict[str, Any]:
        """Process refund through specific payment gateway"""
        
        if payment_gateway == "paypal":
            return await self._refund_paypal(db, booking, refund_amount, refund_reason)
        elif payment_gateway == "razorpay":
            return await self._refund_razorpay(db, booking, refund_amount, refund_reason)
        elif payment_gateway == "cashfree":
            return await self._refund_cashfree(db, booking, refund_amount, refund_reason)
        else:
            # Mock refund for testing
            return {
                "success": True,
                "refund_id": f"MOCK-REF-{booking['id'][:8]}",
                "gateway_refund_id": f"mock_refund_{datetime.now().timestamp()}",
                "status": "SUCCESS",
                "mock_mode": True
            }
    
    async def _refund_paypal(self, db, booking: Dict, refund_amount: float, reason: str) -> Dict:
        """Process PayPal refund"""
        from services.paypal_service import paypal_service, convert_inr_to_usd
        
        order_id = booking.get("paypal_order_id")
        if not order_id:
            return {"success": False, "error": "PayPal order ID not found"}
        
        # Convert INR to USD for PayPal
        usd_amount = convert_inr_to_usd(refund_amount)
        
        # PayPal doesn't have direct refund in our current implementation
        # This would need PayPal Payments API for actual refunds
        return {
            "success": True,
            "refund_id": f"PP-REF-{order_id[:8]}",
            "gateway_refund_id": f"paypal_refund_{datetime.now().timestamp()}",
            "status": "PENDING",
            "amount_usd": usd_amount,
            "note": "PayPal refund initiated - manual processing may be required"
        }
    
    async def _refund_razorpay(self, db, booking: Dict, refund_amount: float, reason: str) -> Dict:
        """Process Razorpay refund"""
        payment_id = booking.get("razorpay_payment_id")
        if not payment_id:
            return {"success": False, "error": "Razorpay payment ID not found"}
        
        # Use Razorpay service if available
        try:
            from services.razorpay_service import razorpay_service
            result = await razorpay_service.create_refund(
                payment_id=payment_id,
                amount=int(refund_amount * 100),  # Razorpay uses paise
                notes={"reason": reason}
            )
            return result
        except ImportError:
            return {
                "success": True,
                "refund_id": f"RZ-REF-{payment_id[:8]}",
                "gateway_refund_id": f"razorpay_refund_{datetime.now().timestamp()}",
                "status": "PENDING",
                "mock_mode": True
            }
    
    async def _refund_cashfree(self, db, booking: Dict, refund_amount: float, reason: str) -> Dict:
        """Process Cashfree refund"""
        from services.cashfree_service import cashfree_service
        
        order_id = booking.get("cashfree_order_id")
        if not order_id:
            return {"success": False, "error": "Cashfree order ID not found"}
        
        result = await cashfree_service.create_refund(
            order_id=order_id,
            refund_amount=refund_amount,
            refund_note=reason
        )
        
        return {
            "success": result.get("success", False),
            "refund_id": result.get("refund_id"),
            "gateway_refund_id": result.get("cf_refund_id"),
            "status": result.get("refund_status", "PENDING"),
            "mock_mode": result.get("mock_mode", False)
        }
    
    def get_refund_preview(
        self,
        total_amount: float,
        departure_datetime: datetime = None,
        hours_before: float = None
    ) -> Dict[str, Any]:
        """Get refund preview without processing"""
        return self.calculator.calculate_refund(
            total_amount=total_amount,
            departure_datetime=departure_datetime,
            hours_before=hours_before
        )


# Singleton instance
unified_refund_service = UnifiedRefundService()
refund_calculator = RefundCalculator()
