from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, Dict, List
from datetime import datetime, timezone
from uuid import uuid4
from database import get_database
from auth import get_current_user
from services.ai_service import ai_service

router = APIRouter(prefix="/ai", tags=["AI Services"])

class PriceSuggestionRequest(BaseModel):
    route_from: str
    route_to: str
    aircraft_type: str
    passengers: int
    departure_date: str
    is_round_trip: bool = False

class DocumentVerificationRequest(BaseModel):
    document_type: str
    document_url: str
    expected_fields: Optional[List[str]] = None

class RouteRecommendationRequest(BaseModel):
    from_location: str
    preferences: Optional[Dict] = None

@router.post("/price-suggestion")
async def get_price_suggestion(
    request: PriceSuggestionRequest,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """Get AI-powered price suggestion for a booking"""
    
    result = await ai_service.get_price_suggestion(
        route_from=request.route_from,
        route_to=request.route_to,
        aircraft_type=request.aircraft_type,
        passengers=request.passengers,
        departure_date=request.departure_date,
        is_round_trip=request.is_round_trip
    )
    
    # Log the AI suggestion
    await db.ai_logs.insert_one({
        "id": str(uuid4()),
        "type": "price_suggestion",
        "user_id": current_user["id"],
        "request": request.dict(),
        "response": result,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return result

@router.post("/verify-document")
async def verify_document(
    request: DocumentVerificationRequest,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """AI-powered document verification"""
    
    result = await ai_service.verify_document(
        document_type=request.document_type,
        document_url=request.document_url,
        expected_fields=request.expected_fields
    )
    
    # Log verification
    await db.ai_logs.insert_one({
        "id": str(uuid4()),
        "type": "document_verification",
        "user_id": current_user["id"],
        "document_type": request.document_type,
        "result": result,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return result

@router.post("/route-recommendations")
async def get_route_recommendations(
    request: RouteRecommendationRequest,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """Get AI-powered route recommendations"""
    
    result = await ai_service.get_route_recommendations(
        from_location=request.from_location,
        preferences=request.preferences
    )
    
    return result

@router.get("/health")
async def ai_health_check():
    """Check AI service health"""
    return {
        "status": "operational",
        "services": {
            "price_suggestion": True,
            "document_verification": True,
            "route_recommendations": True
        }
    }
