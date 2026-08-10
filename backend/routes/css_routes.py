"""
Customer Satisfaction Score (CSS) Calculator Service - AirYatra Aviation Platform
Monthly score calculation with automatic suspension/delisting

Based on Document [5] requirements:
- Below 70: Rating drop
- Below 60: Temporary suspension (7-14 days)
- Below 50: Automatic delisting
- No appeal allowed
"""

from fastapi import APIRouter, HTTPException, Depends, Query, BackgroundTasks
from typing import Optional, List
from datetime import datetime, timedelta, timezone
import uuid

from database import get_database
from middleware import get_current_user, require_roles
from models.complaint_penalty_models import (
    CSSAction, PenaltyType, PenaltyRule, PenaltyStatus,
    CSSCalculationRequest, CSSResponse
)

router = APIRouter(prefix="/css", tags=["Customer Satisfaction Score"])

# ============= HELPER FUNCTIONS =============

def generate_css_id():
    return f"CSS-{uuid.uuid4().hex[:8].upper()}"

def generate_penalty_id():
    return f"PEN-{uuid.uuid4().hex[:8].upper()}"


async def calculate_css_score(db, operator_id: str, month: int, year: int) -> dict:
    """
    Calculate CSS Score for an operator
    
    Score Components:
    - Base score: 100
    - Rating score: Based on average customer rating (40% weight)
    - Complaint deduction: -5 per upheld complaint
    - Delay deduction: -2 per delayed flight
    - Cancellation deduction: -10 per cancellation
    - Refund deduction: -3 per refund issued
    """
    
    # Define period
    start_date = datetime(year, month, 1)
    if month == 12:
        end_date = datetime(year + 1, 1, 1)
    else:
        end_date = datetime(year, month + 1, 1)
    
    # Get operator info
    operator = await db.operators.find_one({"id": operator_id})
    if not operator:
        raise HTTPException(404, "Operator not found")
    
    # 1. Rating Score (0-40 points) - Based on average rating
    rating_pipeline = [
        {"$match": {
            "operator_id": operator_id,
            "created_at": {"$gte": start_date, "$lt": end_date},
            "rating": {"$exists": True}
        }},
        {"$group": {
            "_id": None,
            "avg_rating": {"$avg": "$rating"},
            "count": {"$sum": 1}
        }}
    ]
    rating_result = await db.reviews.aggregate(rating_pipeline).to_list(1)
    
    avg_rating = 0
    if rating_result and rating_result[0].get("avg_rating"):
        avg_rating = rating_result[0]["avg_rating"]
    
    # Rating score: (avg_rating / 5) * 40
    rating_score = (avg_rating / 5) * 40 if avg_rating > 0 else 20  # Default 20 if no ratings
    
    # 2. Complaint Score (deduction)
    upheld_complaints = await db.complaints.count_documents({
        "operator_id": operator_id,
        "airyatra_decision": "upheld",
        "decision_date": {"$gte": start_date, "$lt": end_date}
    })
    total_complaints = await db.complaints.count_documents({
        "operator_id": operator_id,
        "created_at": {"$gte": start_date, "$lt": end_date}
    })
    complaint_deduction = upheld_complaints * 5  # -5 per upheld complaint
    
    # 3. Delay Score (deduction)
    delayed_bookings = await db.bookings.count_documents({
        "operator_id": operator_id,
        "status": "completed",
        "completed_at": {"$gte": start_date, "$lt": end_date},
        "was_delayed": True
    })
    delay_deduction = delayed_bookings * 2  # -2 per delay
    
    # 4. Cancellation Score (deduction)
    cancelled_bookings = await db.bookings.count_documents({
        "operator_id": operator_id,
        "status": "cancelled",
        "cancelled_by": "operator",
        "cancelled_at": {"$gte": start_date, "$lt": end_date}
    })
    cancellation_deduction = cancelled_bookings * 10  # -10 per cancellation
    
    # 5. Refund Score (deduction)
    refunds = await db.refunds.count_documents({
        "operator_id": operator_id,
        "created_at": {"$gte": start_date, "$lt": end_date}
    })
    refund_deduction = refunds * 3  # -3 per refund
    
    # Calculate final score
    # Base: 60 points (for operational metrics) + Rating score (40 points max)
    base_score = 60
    total_deduction = complaint_deduction + delay_deduction + cancellation_deduction + refund_deduction
    
    css_score = base_score + rating_score - total_deduction
    css_score = max(0, min(100, css_score))  # Clamp between 0-100
    
    # Get total bookings
    total_bookings = await db.bookings.count_documents({
        "operator_id": operator_id,
        "created_at": {"$gte": start_date, "$lt": end_date}
    })
    
    return {
        "css_score": round(css_score, 2),
        "rating_score": round(rating_score, 2),
        "complaint_score": -complaint_deduction,
        "delay_score": -delay_deduction,
        "cancellation_score": -cancellation_deduction,
        "refund_score": -refund_deduction,
        "average_rating": round(avg_rating, 2),
        "total_complaints_month": total_complaints,
        "upheld_complaints_month": upheld_complaints,
        "total_delays_month": delayed_bookings,
        "total_cancellations_month": cancelled_bookings,
        "total_refunds_month": refunds,
        "total_bookings_month": total_bookings
    }


async def determine_css_action(css_score: float) -> tuple:
    """
    Determine action based on CSS score (Document [5]):
    - Below 70: Rating drop
    - Below 60: Temporary suspension (7-14 days)
    - Below 50: Automatic delisting
    """
    if css_score < 50:
        return CSSAction.AUTOMATIC_DELISTING, "Automatic delisting - CSS below 50"
    elif css_score < 60:
        return CSSAction.TEMPORARY_SUSPENSION, "Temporary suspension - CSS below 60"
    elif css_score < 70:
        return CSSAction.RATING_DROP, "Rating drop warning - CSS below 70"
    else:
        return CSSAction.NONE, "CSS score healthy"


# ============= API ENDPOINTS =============

@router.post("/calculate")
async def calculate_monthly_css(
    request: CSSCalculationRequest,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(require_roles(["admin", "super_admin"]))
):
    """
    Calculate CSS score for an operator for a specific month
    
    Automatically applies:
    - Rating drop warning (< 70)
    - Temporary suspension (< 60)
    - Automatic delisting (< 50)
    """
    db = get_database()
    
    # Check if already calculated
    existing = await db.customer_satisfaction_scores.find_one({
        "operator_id": request.operator_id,
        "calculation_month": request.calculation_month,
        "calculation_year": request.calculation_year
    })
    
    if existing:
        raise HTTPException(400, f"CSS already calculated for {request.calculation_month}/{request.calculation_year}")
    
    # Calculate score
    score_data = await calculate_css_score(
        db, request.operator_id, 
        request.calculation_month, 
        request.calculation_year
    )
    
    # Determine action
    action, action_reason = await determine_css_action(score_data["css_score"])
    
    # Get previous month score
    prev_month = request.calculation_month - 1 if request.calculation_month > 1 else 12
    prev_year = request.calculation_year if request.calculation_month > 1 else request.calculation_year - 1
    
    prev_css = await db.customer_satisfaction_scores.find_one({
        "operator_id": request.operator_id,
        "calculation_month": prev_month,
        "calculation_year": prev_year
    })
    prev_score = prev_css["css_score"] if prev_css else None
    
    # Determine trend
    trend = "stable"
    if prev_score:
        if score_data["css_score"] > prev_score + 2:
            trend = "improving"
        elif score_data["css_score"] < prev_score - 2:
            trend = "declining"
    
    css_id = generate_css_id()
    now = datetime.now(timezone.utc)
    
    css_record = {
        "css_id": css_id,
        "operator_id": request.operator_id,
        
        "calculation_month": request.calculation_month,
        "calculation_year": request.calculation_year,
        "calculation_date": now,
        
        "css_score": score_data["css_score"],
        
        # Score Components
        "rating_score": score_data["rating_score"],
        "complaint_score": score_data["complaint_score"],
        "delay_score": score_data["delay_score"],
        "cancellation_score": score_data["cancellation_score"],
        "refund_score": score_data["refund_score"],
        
        # Metrics
        "average_rating": score_data["average_rating"],
        "total_complaints_month": score_data["total_complaints_month"],
        "total_delays_month": score_data["total_delays_month"],
        "total_refunds_month": score_data["total_refunds_month"],
        "total_cancellations_month": score_data["total_cancellations_month"],
        "total_bookings_month": score_data["total_bookings_month"],
        
        # Action
        "action_taken": action.value,
        
        # History
        "previous_month_score": prev_score,
        "score_trend": trend,
        
        # No appeal allowed (Document [5])
        "appeal_allowed": False,
        
        "calculated_by": current_user["id"],
        "created_at": now
    }
    
    # Apply action
    if action == CSSAction.AUTOMATIC_DELISTING:
        css_record["delisting_date"] = now
        css_record["delisting_permanent"] = False
        
        # Update operator status
        await db.operators.update_one(
            {"id": request.operator_id},
            {"$set": {
                "status": "delisted",
                "delisted_at": now,
                "delisting_reason": f"CSS score below 50 ({score_data['css_score']})"
            }}
        )
        
        # Create penalty record
        penalty = {
            "penalty_id": generate_penalty_id(),
            "operator_id": request.operator_id,
            "penalty_type": PenaltyType.CSS_PENALTY.value,
            "penalty_amount": 0,
            "penalty_rule": PenaltyRule.CSS_BELOW_50.value,
            "triggered_by": f"CSS Score {score_data['css_score']} (below 50)",
            "delisting_triggered": True,
            "delisting_date": now,
            "status": PenaltyStatus.ISSUED.value,
            "appeal_allowed": False,
            "issued_at": now,
            "created_at": now
        }
        await db.penalties.insert_one(penalty)
        
    elif action == CSSAction.TEMPORARY_SUSPENSION:
        # Suspension duration based on score (7-14 days)
        suspension_days = 14 if score_data["css_score"] < 55 else 7
        suspension_end = now + timedelta(days=suspension_days)
        
        css_record["suspension_start_date"] = now
        css_record["suspension_end_date"] = suspension_end
        
        # Update operator status
        await db.operators.update_one(
            {"id": request.operator_id},
            {"$set": {
                "status": "suspended",
                "suspended_at": now,
                "suspension_end_date": suspension_end,
                "suspension_reason": f"CSS score below 60 ({score_data['css_score']})"
            }}
        )
        
        # Create penalty record
        penalty = {
            "penalty_id": generate_penalty_id(),
            "operator_id": request.operator_id,
            "penalty_type": PenaltyType.CSS_PENALTY.value,
            "penalty_amount": 0,
            "penalty_rule": PenaltyRule.CSS_BELOW_60.value,
            "triggered_by": f"CSS Score {score_data['css_score']} (below 60)",
            "suspension_triggered": True,
            "suspension_duration_days": suspension_days,
            "suspension_start_date": now,
            "suspension_end_date": suspension_end,
            "status": PenaltyStatus.ISSUED.value,
            "appeal_allowed": False,
            "issued_at": now,
            "created_at": now
        }
        await db.penalties.insert_one(penalty)
    
    await db.customer_satisfaction_scores.insert_one(css_record)
    
    return {
        "success": True,
        "css_id": css_id,
        "operator_id": request.operator_id,
        "period": f"{request.calculation_month}/{request.calculation_year}",
        "css_score": score_data["css_score"],
        "action_taken": action.value,
        "action_reason": action_reason,
        "score_breakdown": {
            "rating_score": score_data["rating_score"],
            "complaint_deduction": score_data["complaint_score"],
            "delay_deduction": score_data["delay_score"],
            "cancellation_deduction": score_data["cancellation_score"],
            "refund_deduction": score_data["refund_score"]
        },
        "trend": trend,
        "message_hi": f"CSS स्कोर: {score_data['css_score']} - {action_reason}"
    }


@router.get("/operator/{operator_id}")
async def get_operator_css_history(
    operator_id: str,
    limit: int = Query(12, ge=1, le=24),
    current_user: dict = Depends(get_current_user)
):
    """Get CSS history for an operator"""
    db = get_database()
    
    # Check access (operator can see own score, admin can see all)
    if "admin" not in current_user.get("roles", []):
        operator = await db.operators.find_one({"user_id": current_user["id"]})
        if not operator or operator.get("id") != operator_id:
            raise HTTPException(403, "Access denied")
    
    scores = await db.customer_satisfaction_scores.find(
        {"operator_id": operator_id},
        {"_id": 0}
    ).sort([("calculation_year", -1), ("calculation_month", -1)]).limit(limit).to_list(limit)
    
    # Get operator info
    operator = await db.operators.find_one({"id": operator_id}, {"_id": 0, "password_hash": 0})
    
    # Calculate average
    avg_score = sum(s["css_score"] for s in scores) / len(scores) if scores else 0
    
    return {
        "operator_id": operator_id,
        "operator_name": operator.get("company_name") if operator else "Unknown",
        "current_status": operator.get("status") if operator else "unknown",
        "average_css_score": round(avg_score, 2),
        "history": scores
    }


@router.get("/leaderboard")
async def get_css_leaderboard(
    month: Optional[int] = None,
    year: Optional[int] = None,
    limit: int = Query(20, ge=1, le=50),
    current_user: dict = Depends(require_roles(["admin", "super_admin"]))
):
    """Get CSS leaderboard for operators"""
    db = get_database()
    
    # Default to current month
    now = datetime.now(timezone.utc)
    target_month = month or now.month
    target_year = year or now.year
    
    pipeline = [
        {"$match": {
            "calculation_month": target_month,
            "calculation_year": target_year
        }},
        {"$sort": {"css_score": -1}},
        {"$limit": limit},
        {"$lookup": {
            "from": "operators",
            "localField": "operator_id",
            "foreignField": "id",
            "as": "operator"
        }},
        {"$unwind": {"path": "$operator", "preserveNullAndEmptyArrays": True}},
        {"$project": {
            "_id": 0,
            "operator_id": 1,
            "operator_name": "$operator.company_name",
            "css_score": 1,
            "action_taken": 1,
            "score_trend": 1,
            "average_rating": 1,
            "total_bookings_month": 1
        }}
    ]
    
    leaderboard = await db.customer_satisfaction_scores.aggregate(pipeline).to_list(limit)
    
    return {
        "period": f"{target_month}/{target_year}",
        "leaderboard": leaderboard,
        "total_operators": len(leaderboard)
    }


@router.post("/bulk-calculate")
async def bulk_calculate_css(
    month: int = Query(..., ge=1, le=12),
    year: int = Query(..., ge=2024),
    current_user: dict = Depends(require_roles(["admin", "super_admin"]))
):
    """
    Calculate CSS for all active operators
    Used for monthly batch processing
    """
    db = get_database()
    
    # Get all active operators
    operators = await db.operators.find(
        {"status": {"$in": ["active", "verified"]}},
        {"id": 1}
    ).to_list(1000)
    
    results = {
        "processed": 0,
        "skipped": 0,
        "errors": [],
        "actions": {
            "none": 0,
            "rating_drop": 0,
            "suspension": 0,
            "delisting": 0
        }
    }
    
    for op in operators:
        try:
            # Check if already calculated
            existing = await db.customer_satisfaction_scores.find_one({
                "operator_id": op["id"],
                "calculation_month": month,
                "calculation_year": year
            })
            
            if existing:
                results["skipped"] += 1
                continue
            
            # Calculate score
            score_data = await calculate_css_score(db, op["id"], month, year)
            action, _ = await determine_css_action(score_data["css_score"])
            
            # Record (simplified - without full action processing)
            css_record = {
                "css_id": generate_css_id(),
                "operator_id": op["id"],
                "calculation_month": month,
                "calculation_year": year,
                "calculation_date": datetime.now(timezone.utc),
                "css_score": score_data["css_score"],
                "action_taken": action.value,
                "appeal_allowed": False,
                "calculated_by": current_user["id"],
                "created_at": datetime.now(timezone.utc)
            }
            
            await db.customer_satisfaction_scores.insert_one(css_record)
            results["processed"] += 1
            
            # Track actions
            if action == CSSAction.AUTOMATIC_DELISTING:
                results["actions"]["delisting"] += 1
            elif action == CSSAction.TEMPORARY_SUSPENSION:
                results["actions"]["suspension"] += 1
            elif action == CSSAction.RATING_DROP:
                results["actions"]["rating_drop"] += 1
            else:
                results["actions"]["none"] += 1
                
        except Exception as e:
            results["errors"].append({"operator_id": op["id"], "error": str(e)})
    
    return {
        "success": True,
        "period": f"{month}/{year}",
        "results": results,
        "message": f"Processed {results['processed']} operators, skipped {results['skipped']}"
    }
