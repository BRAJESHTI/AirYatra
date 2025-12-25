from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
from uuid import uuid4
import os
from database import get_database
from routes.auth_routes import get_current_user

router = APIRouter(prefix="/chatbot", tags=["AI Chatbot"])

# Try to import AI service
try:
    from ai_service import get_ai_response
    AI_AVAILABLE = True
except:
    AI_AVAILABLE = False

# Models
class ChatMessage(BaseModel):
    message: str
    session_id: Optional[str] = None
    context: dict = {}

class ChatFeedback(BaseModel):
    message_id: str
    helpful: bool
    feedback_text: Optional[str] = None

# Predefined responses for common queries
FAQ_RESPONSES = {
    "booking": "To book a helicopter ride:\n1. Visit our booking page\n2. Select origin and destination\n3. Choose date and time\n4. Enter passenger details\n5. Make payment\n\nNeed help with a specific step?",
    "cancel": "To cancel a booking:\n1. Go to 'My Bookings'\n2. Select the booking to cancel\n3. Click 'Cancel Booking'\n4. Confirm cancellation\n\nNote: Cancellation charges may apply based on timing.",
    "price": "Our pricing depends on:\n- Route distance\n- Aircraft type\n- Number of passengers\n- Season/demand\n\nUse our booking page for instant quotes!",
    "safety": "Your safety is our top priority:\n- All aircraft are DGCA certified\n- Pilots have 1000+ flight hours\n- Regular maintenance checks\n- Weather monitoring before every flight\n- Insurance coverage included",
    "baggage": "Baggage allowance:\n- Standard: 10 kg per passenger\n- Premium: 15 kg per passenger\n- Excess baggage may be charged extra\n\nPlease pack light for helicopter rides!",
    "payment": "We accept:\n- Credit/Debit Cards\n- UPI\n- Net Banking\n- Wallets\n\nAll payments are secure and encrypted.",
    "refund": "Refund policy:\n- 24+ hours before: Full refund\n- 12-24 hours: 50% refund\n- Less than 12 hours: No refund\n\nRefunds processed within 5-7 business days."
}

# Intent detection keywords
INTENT_KEYWORDS = {
    "booking": ["book", "reserve", "schedule", "how to book", "booking process"],
    "cancel": ["cancel", "cancellation", "cancel booking", "refund"],
    "price": ["price", "cost", "fare", "charges", "how much", "rate"],
    "safety": ["safe", "safety", "secure", "accident", "insurance"],
    "baggage": ["baggage", "luggage", "bag", "weight", "carry"],
    "payment": ["payment", "pay", "card", "upi", "wallet"],
    "refund": ["refund", "money back", "return"]
}

def detect_intent(message: str) -> Optional[str]:
    """Detect user intent from message"""
    message_lower = message.lower()
    for intent, keywords in INTENT_KEYWORDS.items():
        for keyword in keywords:
            if keyword in message_lower:
                return intent
    return None

async def get_chatbot_response(message: str, context: dict, db) -> dict:
    """Get response from chatbot"""
    # First, try FAQ matching
    intent = detect_intent(message)
    if intent and intent in FAQ_RESPONSES:
        return {
            "response": FAQ_RESPONSES[intent],
            "source": "faq",
            "intent": intent,
            "suggestions": get_suggestions(intent)
        }
    
    # Try AI response if available
    if AI_AVAILABLE:
        try:
            system_prompt = """You are AirYatra's helpful booking assistant. Help users with:
            - Booking helicopter rides
            - Understanding pricing
            - Cancellation and refunds
            - Safety information
            - General queries
            
            Be concise, friendly, and helpful. If you don't know something, say so."""
            
            ai_response = await get_ai_response(message, system_prompt)
            return {
                "response": ai_response,
                "source": "ai",
                "suggestions": ["Book a ride", "Check prices", "View my bookings"]
            }
        except Exception as e:
            print(f"AI error: {e}")
    
    # Default response
    return {
        "response": "I'm here to help! You can ask me about:\n- How to book a ride\n- Pricing and fares\n- Cancellation policy\n- Safety measures\n- Baggage allowance\n\nWhat would you like to know?",
        "source": "default",
        "suggestions": ["How to book?", "What's the price?", "Is it safe?"]
    }

def get_suggestions(intent: str) -> List[str]:
    """Get follow-up suggestions based on intent"""
    suggestions_map = {
        "booking": ["Check prices", "View available dates", "Contact support"],
        "cancel": ["View refund policy", "Contact support", "Modify booking"],
        "price": ["Book now", "Compare routes", "Check discounts"],
        "safety": ["View certifications", "Meet our pilots", "Insurance details"],
        "baggage": ["Book extra baggage", "Packing tips", "Contact support"],
        "payment": ["Book now", "View payment options", "Need help?"],
        "refund": ["Check booking status", "Contact support", "View policy"]
    }
    return suggestions_map.get(intent, ["Book a ride", "Contact support", "View FAQ"])

# API Endpoints
@router.post("/chat")
async def chat(message: ChatMessage, current_user: dict = Depends(get_current_user)):
    """Send a message to the chatbot"""
    db = get_database()
    
    # Create or get session
    session_id = message.session_id or str(uuid4())
    
    # Get response
    response_data = await get_chatbot_response(message.message, message.context, db)
    
    # Store conversation
    message_record = {
        "id": str(uuid4()),
        "session_id": session_id,
        "user_id": current_user["id"],
        "user_message": message.message,
        "bot_response": response_data["response"],
        "source": response_data["source"],
        "intent": response_data.get("intent"),
        "context": message.context,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.chatbot_conversations.insert_one(message_record)
    
    return {
        "session_id": session_id,
        "message_id": message_record["id"],
        "response": response_data["response"],
        "suggestions": response_data.get("suggestions", []),
        "source": response_data["source"]
    }

@router.get("/history/{session_id}")
async def get_chat_history(session_id: str, current_user: dict = Depends(get_current_user)):
    """Get chat history for a session"""
    db = get_database()
    
    messages = await db.chatbot_conversations.find(
        {"session_id": session_id, "user_id": current_user["id"]},
        {"_id": 0}
    ).sort("created_at", 1).to_list(100)
    
    return {"session_id": session_id, "messages": messages}

@router.post("/feedback")
async def submit_feedback(feedback: ChatFeedback, current_user: dict = Depends(get_current_user)):
    """Submit feedback for a chatbot response"""
    db = get_database()
    
    await db.chatbot_conversations.update_one(
        {"id": feedback.message_id},
        {
            "$set": {
                "feedback_helpful": feedback.helpful,
                "feedback_text": feedback.feedback_text,
                "feedback_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    return {"message": "Feedback submitted. Thank you!"}

@router.get("/faq")
async def get_faq():
    """Get list of FAQ topics"""
    return {
        "topics": [
            {"id": "booking", "title": "How to Book", "preview": "Learn how to book a helicopter ride"},
            {"id": "price", "title": "Pricing", "preview": "Understanding our pricing structure"},
            {"id": "cancel", "title": "Cancellation", "preview": "Cancellation and refund policy"},
            {"id": "safety", "title": "Safety", "preview": "Our safety measures and certifications"},
            {"id": "baggage", "title": "Baggage", "preview": "Baggage allowance and restrictions"},
            {"id": "payment", "title": "Payment", "preview": "Accepted payment methods"},
            {"id": "refund", "title": "Refunds", "preview": "Refund process and timelines"}
        ]
    }

@router.get("/faq/{topic}")
async def get_faq_answer(topic: str):
    """Get FAQ answer for a topic"""
    if topic not in FAQ_RESPONSES:
        raise HTTPException(status_code=404, detail="Topic not found")
    
    return {
        "topic": topic,
        "answer": FAQ_RESPONSES[topic],
        "suggestions": get_suggestions(topic)
    }

@router.get("/admin/stats")
async def get_chatbot_stats(current_user: dict = Depends(get_current_user)):
    """Get chatbot usage statistics"""
    if "admin" not in current_user.get("roles", []):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    db = get_database()
    
    total_conversations = await db.chatbot_conversations.count_documents({})
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0).isoformat()
    today_conversations = await db.chatbot_conversations.count_documents({"created_at": {"$gte": today}})
    
    # Intent breakdown
    pipeline = [
        {"$match": {"intent": {"$ne": None}}},
        {"$group": {"_id": "$intent", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]
    intents = {}
    async for doc in db.chatbot_conversations.aggregate(pipeline):
        intents[doc["_id"]] = doc["count"]
    
    # Feedback stats
    helpful = await db.chatbot_conversations.count_documents({"feedback_helpful": True})
    not_helpful = await db.chatbot_conversations.count_documents({"feedback_helpful": False})
    
    return {
        "total_conversations": total_conversations,
        "conversations_today": today_conversations,
        "intent_breakdown": intents,
        "feedback": {
            "helpful": helpful,
            "not_helpful": not_helpful,
            "satisfaction_rate": round(helpful / (helpful + not_helpful) * 100, 1) if (helpful + not_helpful) > 0 else 0
        },
        "ai_available": AI_AVAILABLE
    }
