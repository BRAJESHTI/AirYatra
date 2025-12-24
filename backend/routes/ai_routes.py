from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, Dict, List
from datetime import datetime, timezone
from uuid import uuid4
from database import get_database
from middleware import get_current_user
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

class ChatbotRequest(BaseModel):
    message: str
    conversation_id: Optional[str] = None

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
            "route_recommendations": True,
            "chatbot": True
        }
    }

@router.post("/chat")
async def chat_with_ai(
    request: ChatbotRequest,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """
    AI-powered customer support chatbot
    ग्राहक सहायता के लिए AI चैटबॉट
    """
    user_id = current_user["id"]
    conversation_id = request.conversation_id or str(uuid4())
    
    # Get conversation history
    history = []
    if request.conversation_id:
        messages = await db.ai_chat_history.find(
            {"conversation_id": conversation_id},
            {"_id": 0}
        ).sort("created_at", 1).limit(10).to_list(10)
        history = [{"role": m["role"], "content": m["content"]} for m in messages]
    
    # Get user context
    user_context = {
        "name": current_user.get("full_name", "Guest"),
        "has_bookings": False,
        "recent_booking_id": None
    }
    
    # Check for recent bookings
    recent_booking = await db.bookings.find_one(
        {"customer_id": user_id},
        {"_id": 0, "id": 1, "booking_number": 1},
        sort=[("created_at", -1)]
    )
    if recent_booking:
        user_context["has_bookings"] = True
        user_context["recent_booking_id"] = recent_booking.get("booking_number", recent_booking["id"][:8])
    
    # Get AI response
    result = await ai_service.chat_with_support(
        user_message=request.message,
        conversation_history=history,
        user_context=user_context
    )
    
    # Save conversation history
    timestamp = datetime.now(timezone.utc).isoformat()
    
    # Save user message
    await db.ai_chat_history.insert_one({
        "id": str(uuid4()),
        "conversation_id": conversation_id,
        "user_id": user_id,
        "role": "user",
        "content": request.message,
        "created_at": timestamp
    })
    
    # Save AI response
    await db.ai_chat_history.insert_one({
        "id": str(uuid4()),
        "conversation_id": conversation_id,
        "user_id": user_id,
        "role": "assistant",
        "content": result["response"],
        "ai_generated": result.get("ai_generated", False),
        "model": result.get("model"),
        "created_at": timestamp
    })
    
    return {
        "response": result["response"],
        "conversation_id": conversation_id,
        "ai_generated": result.get("ai_generated", False)
    }

@router.get("/chat/history/{conversation_id}")
async def get_chat_history(
    conversation_id: str,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """Get AI chat conversation history"""
    messages = await db.ai_chat_history.find(
        {"conversation_id": conversation_id, "user_id": current_user["id"]},
        {"_id": 0}
    ).sort("created_at", 1).to_list(100)
    
    return {"conversation_id": conversation_id, "messages": messages}

@router.get("/chat/conversations")
async def get_ai_conversations(
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """Get user's AI chat conversations"""
    # Aggregate to get unique conversations with last message
    pipeline = [
        {"$match": {"user_id": current_user["id"]}},
        {"$sort": {"created_at": -1}},
        {"$group": {
            "_id": "$conversation_id",
            "last_message": {"$first": "$content"},
            "last_role": {"$first": "$role"},
            "updated_at": {"$first": "$created_at"}
        }},
        {"$sort": {"updated_at": -1}},
        {"$limit": 20}
    ]
    
    conversations = await db.ai_chat_history.aggregate(pipeline).to_list(20)
    
    return {
        "conversations": [
            {
                "conversation_id": c["_id"],
                "last_message": c["last_message"][:100] + "..." if len(c.get("last_message", "")) > 100 else c.get("last_message"),
                "last_role": c["last_role"],
                "updated_at": c["updated_at"]
            }
            for c in conversations
        ]
    }
