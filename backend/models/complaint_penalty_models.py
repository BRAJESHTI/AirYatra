"""
Complaint, Penalty & Customer Satisfaction Models - AirYatra Aviation Platform

Based on Document [5] requirements:
- AirYatra investigates independently
- AirYatra decides right/wrong (not Operator)
- Operator cannot appeal
- CSS Score monitoring with automatic actions
"""

from pydantic import BaseModel, Field, EmailStr
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum

# ============= ENUMS =============

class ComplaintStatus(str, Enum):
    OPEN = "open"
    UNDER_INVESTIGATION = "under_investigation"
    OPERATOR_RESPONSE_PENDING = "operator_response_pending"
    RESOLVED = "resolved"
    CLOSED = "closed"
    REJECTED = "rejected"


class ComplaintSeverity(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class ComplaintCategory(str, Enum):
    SAFETY = "safety"
    SERVICE_QUALITY = "service_quality"
    CANCELLATION = "cancellation"
    DELAY = "delay"
    EQUIPMENT_FAILURE = "equipment_failure"
    CREW_BEHAVIOR = "crew_behavior"
    BILLING = "billing"
    FEATURE_DISCREPANCY = "feature_discrepancy"
    OTHER = "other"


class ComplaintDecision(str, Enum):
    UPHELD = "upheld"  # Customer was right
    DISMISSED = "dismissed"  # Complaint invalid
    PARTIALLY_UPHELD = "partially_upheld"  # Partial fault


class PenaltyType(str, Enum):
    COMPLAINT_PENALTY = "complaint_penalty"
    NON_COOPERATION = "non_cooperation"
    FEATURE_DISCREPANCY = "feature_discrepancy"
    FALSE_CLAIM = "false_claim"
    DOCUMENT_VIOLATION = "document_violation"
    CSS_PENALTY = "css_penalty"
    OTHER = "other"


class PenaltyRule(str, Enum):
    FIRST_SERIOUS_COMPLAINT = "first_serious_complaint"  # INR 10,000
    TWO_COMPLAINTS_30_DAYS = "two_complaints_30_days"  # INR 20,000 + suspension
    THREE_COMPLAINTS_60_DAYS = "three_complaints_60_days"  # Delisting
    NON_COOPERATION = "non_cooperation"  # INR 5,000+
    CSS_BELOW_60 = "css_below_60"  # Suspension
    CSS_BELOW_50 = "css_below_50"  # Delisting


class PenaltyStatus(str, Enum):
    ISSUED = "issued"
    PENDING_PAYMENT = "pending_payment"
    PAID = "paid"
    WAIVED = "waived"
    APPEALED = "appealed"  # Though appeals not allowed per Doc [5]


class CSSAction(str, Enum):
    NONE = "none"
    RATING_DROP = "rating_drop"  # Below 70
    TEMPORARY_SUSPENSION = "temporary_suspension"  # Below 60
    AUTOMATIC_DELISTING = "automatic_delisting"  # Below 50


class OperatorCooperationStatus(str, Enum):
    COOPERATIVE = "cooperative"
    NON_COOPERATIVE = "non_cooperative"
    PARTIALLY_COOPERATIVE = "partially_cooperative"
    PENDING_RESPONSE = "pending_response"


# ============= COMPLAINT MODEL [Document 5] =============

class ComplaintSchema:
    """
    MongoDB schema for Complaints
    Collection: complaints
    
    Key Rules (Document [5]):
    - AirYatra investigates independently
    - AirYatra decides right/wrong
    - Operator cannot appeal
    - Operator must respond within 2 hours
    """
    
    @staticmethod
    def get_schema():
        return {
            "complaint_id": str,
            "complaint_number": str,  # AY-COMP-YYYYMMDD-XXXX format
            
            # Complainant Details
            "customer_id": str,
            "customer_email": str,
            "customer_phone": str,
            "customer_name": str,
            
            # Complaint Subject
            "booking_id": str,
            "operator_id": str,
            "aircraft_id": str,
            
            # Complaint Details
            "subject": str,
            "description": str,
            "severity": str,  # ComplaintSeverity
            "category": str,  # ComplaintCategory
            
            # Status
            "status": str,  # ComplaintStatus
            
            # AirYatra Investigation
            "investigated_by": str,
            "investigation_start_date": datetime,
            "investigation_end_date": datetime,
            "investigation_findings": str,
            
            # AirYatra Decision (Final - No appeal)
            "airyatra_decision": str,  # ComplaintDecision
            "airyatra_decision_notes": str,
            "decision_made_by": str,
            "decision_date": datetime,
            
            # Operator Response (Must respond within 2 hours)
            "operator_response_required_at": datetime,
            "operator_response_received": bool,
            "operator_response_date": datetime,
            "operator_response_text": str,
            "operator_provided_documentation": bool,
            "operator_cooperation_status": str,  # OperatorCooperationStatus
            
            # Non-cooperation Penalty
            "non_cooperation_penalty_issued": bool,
            "non_cooperation_penalty_amount": int,  # INR 5,000+
            
            # Evidence
            "evidence_files": list,  # URLs
            "evidence_submitted_by_customer": bool,
            "evidence_submitted_by_operator": bool,
            
            # Resolution
            "resolution_action": str,
            "compensation_amount": float,
            "refund_amount": float,
            "reschedule_offered": bool,
            
            # Tracking
            "created_at": datetime,
            "resolved_at": datetime,
            "updated_at": datetime,
        }


# ============= PENALTY MODEL [Document 5] =============

class PenaltySchema:
    """
    MongoDB schema for Penalties
    Collection: penalties
    
    Penalty Rules (Document [5]):
    - 1 serious complaint: INR 10,000
    - 2 complaints in 30 days: INR 20,000 + suspension
    - 3+ complaints in 60 days: Delisting
    - Non-cooperation: INR 5,000+
    - No appeal allowed
    """
    
    @staticmethod
    def get_schema():
        return {
            "penalty_id": str,
            "operator_id": str,
            
            # Penalty Details
            "penalty_type": str,  # PenaltyType
            "penalty_amount": int,  # INR
            "penalty_rule": str,  # PenaltyRule
            
            # Trigger
            "triggered_by_complaint_id": str,
            "triggered_by": str,  # Description
            
            # Suspension (if applicable)
            "suspension_triggered": bool,
            "suspension_duration_days": int,
            "suspension_start_date": datetime,
            "suspension_end_date": datetime,
            
            # Delisting (if applicable)
            "delisting_triggered": bool,
            "delisting_date": datetime,
            "delisting_permanent": bool,
            
            # Status
            "status": str,  # PenaltyStatus
            
            # Payment
            "payment_due_date": datetime,
            "payment_received_date": datetime,
            "payment_amount": int,
            "payment_receipt_url": str,
            
            # Appeal (Document [5]: No appeal allowed)
            "appeal_allowed": bool,  # Always False
            "appeal_notes": str,
            
            # Admin
            "issued_by": str,
            "issued_at": datetime,
            "notes": str,
            
            # Timestamps
            "created_at": datetime,
            "updated_at": datetime,
        }


# ============= FORCED RESCHEDULING MODEL [Document 5] =============

class ForcedReschedulingSchema:
    """
    MongoDB schema for Forced Rescheduling
    Collection: forced_rescheduling
    
    Rules (Document [5]):
    - If Operator cancels, AirYatra forces rescheduling
    - Same price, no compensation to Operator
    - Operator cannot refuse = delisting
    """
    
    @staticmethod
    def get_schema():
        return {
            "rescheduling_id": str,
            "original_booking_id": str,
            "operator_id": str,
            
            # Dates
            "original_departure_date": datetime,
            "rescheduled_departure_date": datetime,
            
            # Price (Same price, but reduced payout)
            "original_price": float,
            "rescheduled_price": float,  # Same as original
            "original_operator_payout": float,
            "rescheduled_operator_payout": float,  # Same (even if delayed 3 months)
            
            # Reason
            "reason": str,
            "reason_category": str,  # operator_cancellation, maintenance, crew, weather
            
            # AirYatra Directive
            "airyatra_directive_issued": bool,
            "operator_can_refuse": bool,  # Always False
            "directive_issued_by": str,
            "directive_issued_at": datetime,
            
            # Operator Response
            "operator_accepted": bool,
            "operator_response_date": datetime,
            
            # Delisting if Refused
            "delisting_for_refusal": bool,
            "delisting_date": datetime,
            
            # Customer Communication
            "customer_notified": bool,
            "customer_notified_date": datetime,
            
            "created_at": datetime,
        }


# ============= CUSTOMER SATISFACTION SCORE (CSS) MODEL [Document 5] =============

class CustomerSatisfactionScoreSchema:
    """
    MongoDB schema for CSS Monitoring
    Collection: customer_satisfaction_scores
    
    CSS Rules (Document [5]):
    - Below 70: Rating drop
    - Below 60: Temporary suspension (7-14 days)
    - Below 50: Automatic delisting
    - No appeal allowed
    """
    
    @staticmethod
    def get_schema():
        return {
            "css_id": str,
            "operator_id": str,
            
            # Calculation Period
            "calculation_month": int,  # 1-12
            "calculation_year": int,
            "calculation_date": datetime,
            
            # CSS Score (0-100)
            "css_score": float,
            
            # Score Components
            "rating_score": float,  # From customer ratings
            "complaint_score": float,  # Deduction for complaints
            "delay_score": float,  # Deduction for delays
            "refund_score": float,  # Deduction for refunds
            "cancellation_score": float,  # Deduction for cancellations
            
            # Detailed Metrics
            "average_rating": float,
            "total_complaints_month": int,
            "total_delays_month": int,
            "total_refunds_month": int,
            "total_cancellations_month": int,
            "total_bookings_month": int,
            
            # Action Based on Score
            "action_taken": str,  # CSSAction
            
            # Suspension (if applicable)
            "suspension_start_date": datetime,
            "suspension_end_date": datetime,  # 7-14 days
            
            # Delisting (if applicable)
            "delisting_date": datetime,
            "delisting_permanent": bool,
            
            # No Appeal (Document [5])
            "appeal_allowed": bool,  # Always False
            
            # History
            "previous_month_score": float,
            "score_trend": str,  # improving, declining, stable
            
            # Admin
            "calculated_by": str,
            "notes": str,
            
            "created_at": datetime,
        }


# ============= PYDANTIC API MODELS =============

class ComplaintCreate(BaseModel):
    """Create complaint"""
    booking_id: str
    subject: str
    description: str
    severity: ComplaintSeverity = ComplaintSeverity.MEDIUM
    category: ComplaintCategory
    evidence_files: List[str] = []


class ComplaintUpdate(BaseModel):
    """Update complaint"""
    status: Optional[ComplaintStatus] = None
    severity: Optional[ComplaintSeverity] = None
    notes: Optional[str] = None


class ComplaintInvestigationCreate(BaseModel):
    """Admin investigation submission"""
    complaint_id: str
    findings: str
    decision: ComplaintDecision
    decision_notes: str
    compensation_amount: float = 0
    refund_amount: float = 0
    reschedule_offered: bool = False


class OperatorResponseCreate(BaseModel):
    """Operator response to complaint"""
    complaint_id: str
    response_text: str
    documentation_provided: bool = False
    evidence_files: List[str] = []


class PenaltyCreate(BaseModel):
    """Create penalty"""
    operator_id: str
    penalty_type: PenaltyType
    penalty_amount: int
    penalty_rule: PenaltyRule
    triggered_by: str
    triggered_by_complaint_id: Optional[str] = None
    suspension_duration_days: Optional[int] = None
    notes: Optional[str] = None


class ForcedReschedulingCreate(BaseModel):
    """Create forced rescheduling directive"""
    original_booking_id: str
    operator_id: str
    rescheduled_departure_date: datetime
    reason: str
    reason_category: str


class CSSCalculationRequest(BaseModel):
    """Request CSS calculation for operator"""
    operator_id: str
    calculation_month: int
    calculation_year: int


class ComplaintResponse(BaseModel):
    """Complaint response model"""
    complaint_id: str
    complaint_number: str
    customer_name: str
    subject: str
    severity: str
    category: str
    status: str
    airyatra_decision: Optional[str]
    created_at: datetime
    resolved_at: Optional[datetime]


class PenaltyResponse(BaseModel):
    """Penalty response model"""
    penalty_id: str
    operator_id: str
    penalty_type: str
    penalty_amount: int
    penalty_rule: str
    status: str
    suspension_triggered: bool
    delisting_triggered: bool
    issued_at: datetime


class CSSResponse(BaseModel):
    """CSS response model"""
    css_id: str
    operator_id: str
    css_score: float
    action_taken: str
    calculation_month: int
    calculation_year: int
    score_trend: str
    average_rating: float
    total_complaints_month: int


class ComplaintDashboardStats(BaseModel):
    """Complaint dashboard statistics"""
    total_complaints: int
    open_complaints: int
    under_investigation: int
    resolved_complaints: int
    average_resolution_time_hours: float
    complaints_by_severity: Dict[str, int]
    complaints_by_category: Dict[str, int]
    upheld_rate: float
    operator_response_rate: float


class PenaltyDashboardStats(BaseModel):
    """Penalty dashboard statistics"""
    total_penalties_issued: int
    total_penalty_amount: int
    penalties_paid: int
    penalties_pending: int
    suspensions_active: int
    delistings_count: int
    by_type: Dict[str, int]
    by_rule: Dict[str, int]
