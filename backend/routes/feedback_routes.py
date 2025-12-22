from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
from uuid import uuid4
from database import get_database
from middleware import get_current_user

router = APIRouter(prefix="/feedback", tags=["Feedback & Ratings"])

class CreateFeedbackRequest(BaseModel):
    booking_id: str
    overall_rating: int  # 1-5
    pilot_rating: Optional[int] = None
    aircraft_rating: Optional[int] = None
    punctuality_rating: Optional[int] = None
    service_rating: Optional[int] = None
    comment: Optional[str] = None
    recommend: bool = True

class OperatorResponseRequest(BaseModel):
    response: str

@router.post("/")
async def create_feedback(
    request: CreateFeedbackRequest,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """Create feedback for a completed booking"""
    # Verify booking exists and is completed
    booking = await db.bookings.find_one({"id": request.booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    if booking.get("customer_id") != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not your booking")
    
    if booking.get("status") != "completed":
        raise HTTPException(status_code=400, detail="Can only rate completed bookings")
    
    # Check if already rated
    existing = await db.feedback.find_one({"booking_id": request.booking_id})
    if existing:
        raise HTTPException(status_code=400, detail="Already rated this booking")
    
    feedback = {
        "id": str(uuid4()),
        "booking_id": request.booking_id,
        "customer_id": current_user["id"],
        "customer_name": current_user.get("full_name"),
        "operator_id": booking.get("operator_id"),
        "pilot_id": booking.get("pilot_id"),
        "aircraft_id": booking.get("aircraft_id"),
        "overall_rating": request.overall_rating,
        "pilot_rating": request.pilot_rating,
        "aircraft_rating": request.aircraft_rating,
        "punctuality_rating": request.punctuality_rating,
        "service_rating": request.service_rating,
        "comment": request.comment,
        "recommend": request.recommend,
        "operator_response": None,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.feedback.insert_one(feedback)
    
    # Update operator average rating
    await update_operator_rating(db, booking.get("operator_id"))
    
    return {"message": "Feedback submitted", "feedback": feedback}

async def update_operator_rating(db, operator_id: str):
    """Update operator's average rating"""
    if not operator_id:
        return
    
    pipeline = [
        {"$match": {"operator_id": operator_id}},
        {"$group": {
            "_id": None,
            "avg_rating": {"$avg": "$overall_rating"},
            "total_reviews": {"$sum": 1}
        }}
    ]
    
    result = await db.feedback.aggregate(pipeline).to_list(1)
    if result:
        await db.operators.update_one(
            {"id": operator_id},
            {"$set": {
                "average_rating": round(result[0]["avg_rating"], 1),
                "total_reviews": result[0]["total_reviews"]
            }}
        )

@router.get("/booking/{booking_id}")
async def get_booking_feedback(
    booking_id: str,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """Get feedback for a booking"""
    feedback = await db.feedback.find_one({"booking_id": booking_id}, {"_id": 0})
    return {"feedback": feedback}

@router.get("/operator/{operator_id}")
async def get_operator_feedback(
    operator_id: str,
    limit: int = 20,
    db=Depends(get_database)
):
    """Get all feedback for an operator"""
    feedback_list = await db.feedback.find(
        {"operator_id": operator_id},
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    # Get operator stats
    operator = await db.operators.find_one({"id": operator_id}, {"_id": 0})
    
    return {
        "feedback": feedback_list,
        "average_rating": operator.get("average_rating", 0) if operator else 0,
        "total_reviews": operator.get("total_reviews", 0) if operator else 0
    }

@router.post("/{feedback_id}/respond")
async def respond_to_feedback(
    feedback_id: str,
    request: OperatorResponseRequest,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """Operator responds to feedback"""
    feedback = await db.feedback.find_one({"id": feedback_id}, {"_id": 0})
    if not feedback:
        raise HTTPException(status_code=404, detail="Feedback not found")
    
    # Verify operator owns this feedback
    if "operator" in current_user.get("roles", []):
        operator = await db.operators.find_one({"user_id": current_user["id"]}, {"_id": 0})
        if not operator or operator["id"] != feedback.get("operator_id"):
            raise HTTPException(status_code=403, detail="Not your feedback")
    elif "admin" not in current_user.get("roles", []):
        raise HTTPException(status_code=403, detail="Access denied")
    
    await db.feedback.update_one(
        {"id": feedback_id},
        {"$set": {
            "operator_response": request.response,
            "response_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"message": "Response added"}

@router.get("/my-reviews")
async def get_my_reviews(
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """Get reviews submitted by current user"""
    reviews = await db.feedback.find(
        {"customer_id": current_user["id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    return {"reviews": reviews}
