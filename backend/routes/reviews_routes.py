from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, timezone
from uuid import uuid4
from database import get_database
from routes.auth_routes import get_current_user

router = APIRouter(prefix="/reviews", tags=["Reviews & Ratings"])

# Models
class ReviewCreate(BaseModel):
    booking_id: str
    overall_rating: int = Field(..., ge=1, le=5)
    pilot_rating: Optional[int] = Field(None, ge=1, le=5)
    aircraft_rating: Optional[int] = Field(None, ge=1, le=5)
    service_rating: Optional[int] = Field(None, ge=1, le=5)
    punctuality_rating: Optional[int] = Field(None, ge=1, le=5)
    value_rating: Optional[int] = Field(None, ge=1, le=5)
    title: Optional[str] = Field(None, max_length=100)
    comment: Optional[str] = Field(None, max_length=1000)
    would_recommend: bool = True
    travel_type: Optional[str] = None  # business, leisure, medical, pilgrimage

class ReviewResponse(BaseModel):
    response: str = Field(..., max_length=500)

class ReviewReport(BaseModel):
    reason: str  # inappropriate, fake, spam, other
    details: Optional[str] = None

# Customer Endpoints
@router.post("/")
async def create_review(review: ReviewCreate, current_user: dict = Depends(get_current_user)):
    """Create a review for a completed booking"""
    db = get_database()
    
    # Verify booking exists and belongs to user
    booking = await db.bookings.find_one({
        "id": review.booking_id,
        "customer_id": current_user["id"]
    })
    
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    if booking.get("status") != "completed":
        raise HTTPException(status_code=400, detail="Can only review completed bookings")
    
    # Check if already reviewed
    existing = await db.reviews.find_one({"booking_id": review.booking_id})
    if existing:
        raise HTTPException(status_code=400, detail="Booking already reviewed")
    
    # Calculate average rating
    ratings = [review.overall_rating]
    if review.pilot_rating: ratings.append(review.pilot_rating)
    if review.aircraft_rating: ratings.append(review.aircraft_rating)
    if review.service_rating: ratings.append(review.service_rating)
    if review.punctuality_rating: ratings.append(review.punctuality_rating)
    if review.value_rating: ratings.append(review.value_rating)
    avg_rating = round(sum(ratings) / len(ratings), 1)
    
    review_data = {
        "id": str(uuid4()),
        "booking_id": review.booking_id,
        "customer_id": current_user["id"],
        "customer_name": current_user.get("full_name", "Customer"),
        "operator_id": booking.get("operator_id"),
        "operator_name": booking.get("operator_name"),
        "aircraft_id": booking.get("aircraft_id"),
        "pilot_id": booking.get("pilot_id"),
        "route": f"{booking.get('origin', '')} → {booking.get('destination', '')}",
        "journey_date": booking.get("journey_date"),
        "overall_rating": review.overall_rating,
        "pilot_rating": review.pilot_rating,
        "aircraft_rating": review.aircraft_rating,
        "service_rating": review.service_rating,
        "punctuality_rating": review.punctuality_rating,
        "value_rating": review.value_rating,
        "average_rating": avg_rating,
        "title": review.title,
        "comment": review.comment,
        "would_recommend": review.would_recommend,
        "travel_type": review.travel_type,
        "status": "published",  # published, hidden, flagged
        "helpful_count": 0,
        "operator_response": None,
        "operator_response_at": None,
        "reported": False,
        "verified_booking": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.reviews.insert_one(review_data)
    
    # Update operator's average rating
    if booking.get("operator_id"):
        await update_operator_rating(db, booking["operator_id"])
    
    # Mark booking as reviewed
    await db.bookings.update_one(
        {"id": review.booking_id},
        {"$set": {"reviewed": True, "review_id": review_data["id"]}}
    )
    
    return {"message": "Review submitted successfully", "review": review_data}

async def update_operator_rating(db, operator_id: str):
    """Update operator's aggregate rating"""
    pipeline = [
        {"$match": {"operator_id": operator_id, "status": "published"}},
        {"$group": {
            "_id": None,
            "avg_rating": {"$avg": "$average_rating"},
            "total_reviews": {"$sum": 1},
            "would_recommend_count": {"$sum": {"$cond": ["$would_recommend", 1, 0]}}
        }}
    ]
    
    result = await db.reviews.aggregate(pipeline).to_list(1)
    
    if result:
        stats = result[0]
        recommend_percent = round((stats["would_recommend_count"] / stats["total_reviews"]) * 100) if stats["total_reviews"] > 0 else 0
        
        await db.operators.update_one(
            {"id": operator_id},
            {"$set": {
                "rating": round(stats["avg_rating"], 1),
                "total_reviews": stats["total_reviews"],
                "recommend_percent": recommend_percent
            }}
        )

@router.get("/my")
async def get_my_reviews(current_user: dict = Depends(get_current_user)):
    """Get current user's reviews"""
    db = get_database()
    
    reviews = await db.reviews.find(
        {"customer_id": current_user["id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    return {"reviews": reviews}

@router.get("/pending")
async def get_pending_reviews(current_user: dict = Depends(get_current_user)):
    """Get bookings pending review"""
    db = get_database()
    
    # Get completed bookings without reviews
    bookings = await db.bookings.find(
        {
            "customer_id": current_user["id"],
            "status": "completed",
            "reviewed": {"$ne": True}
        },
        {"_id": 0, "id": 1, "booking_number": 1, "origin": 1, "destination": 1, 
         "journey_date": 1, "operator_name": 1, "aircraft_type": 1}
    ).sort("journey_date", -1).to_list(20)
    
    return {"pending_reviews": bookings}

@router.post("/{review_id}/helpful")
async def mark_helpful(review_id: str, current_user: dict = Depends(get_current_user)):
    """Mark a review as helpful"""
    db = get_database()
    
    # Check if user already marked this review
    existing = await db.review_helpful.find_one({
        "review_id": review_id,
        "user_id": current_user["id"]
    })
    
    if existing:
        raise HTTPException(status_code=400, detail="Already marked as helpful")
    
    await db.review_helpful.insert_one({
        "review_id": review_id,
        "user_id": current_user["id"],
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    await db.reviews.update_one(
        {"id": review_id},
        {"$inc": {"helpful_count": 1}}
    )
    
    return {"message": "Marked as helpful"}

@router.post("/{review_id}/report")
async def report_review(
    review_id: str,
    report: ReviewReport,
    current_user: dict = Depends(get_current_user)
):
    """Report a review"""
    db = get_database()
    
    review = await db.reviews.find_one({"id": review_id})
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    
    report_data = {
        "id": str(uuid4()),
        "review_id": review_id,
        "reported_by": current_user["id"],
        "reason": report.reason,
        "details": report.details,
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.review_reports.insert_one(report_data)
    await db.reviews.update_one({"id": review_id}, {"$set": {"reported": True}})
    
    return {"message": "Review reported for moderation"}

# Public Endpoints
@router.get("/operator/{operator_id}")
async def get_operator_reviews(
    operator_id: str,
    rating: Optional[int] = None,
    sort: str = "recent",  # recent, helpful, rating_high, rating_low
    skip: int = 0,
    limit: int = 20
):
    """Get reviews for an operator (public)"""
    db = get_database()
    
    query = {"operator_id": operator_id, "status": "published"}
    if rating:
        query["overall_rating"] = rating
    
    sort_field = {
        "recent": ("created_at", -1),
        "helpful": ("helpful_count", -1),
        "rating_high": ("overall_rating", -1),
        "rating_low": ("overall_rating", 1)
    }.get(sort, ("created_at", -1))
    
    reviews = await db.reviews.find(query, {"_id": 0}).sort(*sort_field).skip(skip).limit(limit).to_list(limit)
    
    # Get aggregate stats
    stats_pipeline = [
        {"$match": {"operator_id": operator_id, "status": "published"}},
        {"$group": {
            "_id": None,
            "average_rating": {"$avg": "$overall_rating"},
            "total_reviews": {"$sum": 1},
            "rating_5": {"$sum": {"$cond": [{"$eq": ["$overall_rating", 5]}, 1, 0]}},
            "rating_4": {"$sum": {"$cond": [{"$eq": ["$overall_rating", 4]}, 1, 0]}},
            "rating_3": {"$sum": {"$cond": [{"$eq": ["$overall_rating", 3]}, 1, 0]}},
            "rating_2": {"$sum": {"$cond": [{"$eq": ["$overall_rating", 2]}, 1, 0]}},
            "rating_1": {"$sum": {"$cond": [{"$eq": ["$overall_rating", 1]}, 1, 0]}},
            "recommend_percent": {"$avg": {"$cond": ["$would_recommend", 100, 0]}}
        }}
    ]
    
    stats_result = await db.reviews.aggregate(stats_pipeline).to_list(1)
    stats = stats_result[0] if stats_result else {
        "average_rating": 0, "total_reviews": 0, "recommend_percent": 0,
        "rating_5": 0, "rating_4": 0, "rating_3": 0, "rating_2": 0, "rating_1": 0
    }
    
    return {
        "reviews": reviews,
        "stats": {
            "average_rating": round(stats.get("average_rating", 0), 1),
            "total_reviews": stats.get("total_reviews", 0),
            "recommend_percent": round(stats.get("recommend_percent", 0)),
            "rating_distribution": {
                5: stats.get("rating_5", 0),
                4: stats.get("rating_4", 0),
                3: stats.get("rating_3", 0),
                2: stats.get("rating_2", 0),
                1: stats.get("rating_1", 0)
            }
        }
    }

# Operator Endpoints
@router.get("/operator/my/reviews")
async def get_my_operator_reviews(
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get reviews for current operator"""
    if "operator" not in current_user.get("roles", []):
        raise HTTPException(status_code=403, detail="Operator access required")
    
    db = get_database()
    
    # Get operator profile
    operator = await db.operators.find_one({"user_id": current_user["id"]})
    if not operator:
        raise HTTPException(status_code=404, detail="Operator profile not found")
    
    query = {"operator_id": operator["id"]}
    if status:
        query["status"] = status
    
    reviews = await db.reviews.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    
    return {"reviews": reviews}

@router.post("/operator/{review_id}/respond")
async def respond_to_review(
    review_id: str,
    response: ReviewResponse,
    current_user: dict = Depends(get_current_user)
):
    """Respond to a review (Operator only)"""
    if "operator" not in current_user.get("roles", []):
        raise HTTPException(status_code=403, detail="Operator access required")
    
    db = get_database()
    
    # Get operator profile
    operator = await db.operators.find_one({"user_id": current_user["id"]})
    if not operator:
        raise HTTPException(status_code=404, detail="Operator profile not found")
    
    review = await db.reviews.find_one({"id": review_id, "operator_id": operator["id"]})
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    
    if review.get("operator_response"):
        raise HTTPException(status_code=400, detail="Already responded to this review")
    
    await db.reviews.update_one(
        {"id": review_id},
        {"$set": {
            "operator_response": response.response,
            "operator_response_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"message": "Response added successfully"}

# Admin Endpoints
@router.get("/admin/all")
async def get_all_reviews(
    status: Optional[str] = None,
    reported: Optional[bool] = None,
    skip: int = 0,
    limit: int = 50,
    current_user: dict = Depends(get_current_user)
):
    """Get all reviews (Admin/Support)"""
    if not {"admin", "super_admin", "support"} & set(current_user.get("roles", [])):
        raise HTTPException(status_code=403, detail="Admin/Support access required")
    
    db = get_database()
    
    query = {}
    if status:
        query["status"] = status
    if reported is not None:
        query["reported"] = reported
    
    reviews = await db.reviews.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.reviews.count_documents(query)
    
    return {"reviews": reviews, "total": total}

@router.put("/admin/{review_id}/moderate")
async def moderate_review(
    review_id: str,
    action: str = Query(..., regex="^(publish|hide|delete)$"),
    current_user: dict = Depends(get_current_user)
):
    """Moderate a review (Admin only)"""
    if "admin" not in current_user.get("roles", []):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    db = get_database()
    
    review = await db.reviews.find_one({"id": review_id})
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    
    if action == "delete":
        await db.reviews.delete_one({"id": review_id})
        message = "Review deleted"
    else:
        new_status = "published" if action == "publish" else "hidden"
        await db.reviews.update_one(
            {"id": review_id},
            {"$set": {"status": new_status, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
        message = f"Review {action}ed"
    
    # Update operator rating
    if review.get("operator_id"):
        await update_operator_rating(db, review["operator_id"])
    
    return {"message": message}

@router.get("/admin/reports")
async def get_review_reports(
    status: str = "pending",
    current_user: dict = Depends(get_current_user)
):
    """Get reported reviews (Admin/Support)"""
    if not {"admin", "super_admin", "support"} & set(current_user.get("roles", [])):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    db = get_database()
    
    reports = await db.review_reports.find(
        {"status": status},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    # Enrich with review details
    for report in reports:
        review = await db.reviews.find_one({"id": report["review_id"]}, {"_id": 0})
        report["review"] = review
    
    return {"reports": reports}
