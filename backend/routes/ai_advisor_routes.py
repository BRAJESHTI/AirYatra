"""
AI Business Advisor Routes
CEO Chatbot for sales insights, profit tracking, and marketing suggestions
Uses Emergent LLM Key with GPT-4o
"""
from fastapi import APIRouter, HTTPException, Depends, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, timezone, timedelta
from bson import ObjectId
from database import get_database
from middleware import get_current_user
import os
import json
import asyncio

# Emergent LLM Integration
from emergentintegrations.llm.chat import LlmChat, UserMessage, TextDelta, StreamDone
from dotenv import load_dotenv

load_dotenv()

router = APIRouter(prefix="/ai-advisor", tags=["AI Business Advisor"])

EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY")

# ============== MODELS ==============

class ChatMessage(BaseModel):
    message: str = Field(..., description="User message")
    session_id: Optional[str] = Field(None, description="Chat session ID for context")
    context_type: Optional[str] = Field("general", description="Context type: general, sales, marketing, profit, hr")

class QuickPrompt(BaseModel):
    prompt_type: str = Field(..., description="Type: sales_report, marketing_ideas, profit_analysis, hr_summary, customer_insights")

# ============== HELPER FUNCTIONS ==============

async def get_business_context(db, context_type: str = "general") -> dict:
    """Fetch real-time business metrics from database"""
    
    now = datetime.now(timezone.utc)
    today = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_ago = today - timedelta(days=7)
    month_ago = today - timedelta(days=30)
    
    context = {}
    
    try:
        # Revenue & Bookings
        if context_type in ["general", "sales", "profit"]:
            # Total bookings
            total_bookings = await db.bookings.count_documents({})
            this_month_bookings = await db.bookings.count_documents({
                "created_at": {"$gte": month_ago.isoformat()}
            })
            
            # Revenue from paid inquiries
            paid_inquiries = await db.customer_inquiries.find({
                "payment_status": "paid"
            }).to_list(1000)
            total_revenue = sum(inq.get("quoted_amount", 0) for inq in paid_inquiries)
            
            this_month_inquiries = await db.customer_inquiries.find({
                "payment_status": "paid",
                "created_at": {"$gte": month_ago.isoformat()}
            }).to_list(500)
            this_month_revenue = sum(inq.get("quoted_amount", 0) for inq in this_month_inquiries)
            
            context["revenue"] = {
                "total": total_revenue,
                "this_month": this_month_revenue,
                "currency": "INR"
            }
            context["bookings"] = {
                "total": total_bookings,
                "this_month": this_month_bookings
            }
        
        # Customer Metrics
        if context_type in ["general", "sales", "customer"]:
            total_customers = await db.users.count_documents({"roles": "customer"})
            new_customers = await db.users.count_documents({
                "roles": "customer",
                "created_at": {"$gte": month_ago.isoformat()}
            })
            
            context["customers"] = {
                "total": total_customers,
                "new_this_month": new_customers
            }
        
        # Fleet & Operations
        if context_type in ["general", "operations"]:
            total_aircraft = await db.fleet.count_documents({"status": "active"})
            total_operators = await db.users.count_documents({"roles": "operator"})
            total_pilots = await db.pilots.count_documents({})
            
            context["fleet"] = {
                "total_aircraft": total_aircraft,
                "total_operators": total_operators,
                "total_pilots": total_pilots
            }
        
        # HR Metrics
        if context_type in ["general", "hr"]:
            total_employees = await db.users.count_documents({"roles": "employee"})
            pending_leaves = await db.hr_leave_requests.count_documents({"status": "pending"})
            pending_expenses = await db.expense_claims.count_documents({"status": "pending"})
            
            context["hr"] = {
                "total_employees": total_employees,
                "pending_leave_requests": pending_leaves,
                "pending_expense_claims": pending_expenses
            }
        
        # Marketing & Loyalty
        if context_type in ["general", "marketing"]:
            active_vouchers = await db.promo_vouchers.count_documents({"status": "active"})
            loyalty_members = await db.loyalty_profiles.count_documents({})
            
            # Membership breakdown
            memberships = await db.memberships.aggregate([
                {"$group": {"_id": "$tier", "count": {"$sum": 1}}}
            ]).to_list(10)
            
            context["marketing"] = {
                "active_vouchers": active_vouchers,
                "loyalty_members": loyalty_members,
                "membership_breakdown": {m["_id"]: m["count"] for m in memberships}
            }
        
        # Pending Actions
        pending_approvals = await db.approval_requests.count_documents({"status": "pending"})
        context["pending_actions"] = {
            "approvals": pending_approvals
        }
        
    except Exception as e:
        context["error"] = str(e)
    
    return context


def build_system_prompt(context: dict, context_type: str) -> str:
    """Build system prompt with business context"""
    
    base_prompt = """You are AirYatra AI Business Advisor™, an intelligent assistant for the CEO and leadership team of AirYatra - India's premier helicopter charter aggregator platform.

Your role is to:
1. Analyze business metrics and provide actionable insights
2. Suggest growth strategies based on data
3. Help with marketing content creation
4. Provide HR and operational recommendations
5. Answer business-related questions in a clear, executive-friendly manner

Communication Style:
- Be concise but insightful
- Use bullet points for clarity
- Include specific numbers when relevant
- Suggest actionable next steps
- Use occasional Hindi/Hinglish phrases to connect better (e.g., "Bahut badiya growth hai!")
- Format currency as ₹ (Indian Rupees)

Current Business Context:
"""
    
    context_str = json.dumps(context, indent=2, default=str)
    
    return base_prompt + context_str + """

Remember:
- Always be positive but realistic
- Focus on opportunities, not just problems
- Provide specific, actionable recommendations
- Reference actual data when making suggestions
"""


# ============== CHAT ENDPOINTS ==============

@router.post("/chat")
async def chat_with_advisor(
    data: ChatMessage,
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """
    Chat with AI Business Advisor (Non-streaming)
    For quick responses without SSE
    """
    db = get_database()
    
    # Only allow admin/ceo roles - NOT operator (external partners shouldn't see company-wide data)
    user_roles = current_user.get("roles", [])
    if not any(role in user_roles for role in ["admin", "ceo"]):
        raise HTTPException(status_code=403, detail="Access denied. CEO/Admin role required.")
    
    if not EMERGENT_LLM_KEY:
        raise HTTPException(status_code=500, detail="AI service not configured")
    
    # Get business context
    context = await get_business_context(db, data.context_type)
    system_prompt = build_system_prompt(context, data.context_type)
    
    # Generate session ID if not provided
    session_id = data.session_id or f"advisor_{current_user.get('id')}_{datetime.now().strftime('%Y%m%d%H%M%S')}"
    
    # Initialize chat
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=session_id,
        system_message=system_prompt
    ).with_model("openai", "gpt-4o")
    
    # Load chat history
    history = await db.ai_advisor_chats.find(
        {"session_id": session_id}
    ).sort("timestamp", 1).limit(10).to_list(10)
    
    for msg in history:
        if msg.get("role") == "user":
            chat.add_user_message(msg["content"])
        elif msg.get("role") == "assistant":
            chat.add_assistant_message(msg["content"])
    
    # Get response
    user_message = UserMessage(text=data.message)
    response_text = ""
    
    async for event in chat.stream_message(user_message):
        if isinstance(event, TextDelta):
            response_text += event.content
        elif isinstance(event, StreamDone):
            break
    
    # Save to history
    timestamp = datetime.now(timezone.utc)
    await db.ai_advisor_chats.insert_many([
        {
            "session_id": session_id,
            "user_id": current_user.get("id"),
            "role": "user",
            "content": data.message,
            "timestamp": timestamp
        },
        {
            "session_id": session_id,
            "user_id": current_user.get("id"),
            "role": "assistant",
            "content": response_text,
            "timestamp": timestamp + timedelta(milliseconds=100)
        }
    ])
    
    return {
        "response": response_text,
        "session_id": session_id,
        "context_type": data.context_type,
        "timestamp": timestamp.isoformat()
    }


@router.post("/chat/stream")
async def chat_with_advisor_stream(
    data: ChatMessage,
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """
    Chat with AI Business Advisor (Streaming SSE)
    Real-time token streaming for better UX
    """
    db = get_database()
    
    # Only allow admin/ceo roles - NOT operator (external partners shouldn't see company-wide data)
    user_roles = current_user.get("roles", [])
    if not any(role in user_roles for role in ["admin", "ceo"]):
        raise HTTPException(status_code=403, detail="Access denied. CEO/Admin role required.")
    
    if not EMERGENT_LLM_KEY:
        raise HTTPException(status_code=500, detail="AI service not configured")
    
    # Get business context
    context = await get_business_context(db, data.context_type)
    system_prompt = build_system_prompt(context, data.context_type)
    
    session_id = data.session_id or f"advisor_{current_user.get('id')}_{datetime.now().strftime('%Y%m%d%H%M%S')}"
    
    async def generate():
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=session_id,
            system_message=system_prompt
        ).with_model("openai", "gpt-4o")
        
        # Load history
        history = await db.ai_advisor_chats.find(
            {"session_id": session_id}
        ).sort("timestamp", 1).limit(10).to_list(10)
        
        for msg in history:
            if msg.get("role") == "user":
                chat.add_user_message(msg["content"])
            elif msg.get("role") == "assistant":
                chat.add_assistant_message(msg["content"])
        
        user_message = UserMessage(text=data.message)
        full_response = ""
        
        async for event in chat.stream_message(user_message):
            if isinstance(event, TextDelta):
                full_response += event.content
                yield f"data: {json.dumps({'type': 'token', 'content': event.content})}\n\n"
            elif isinstance(event, StreamDone):
                break
        
        # Save to history
        timestamp = datetime.now(timezone.utc)
        await db.ai_advisor_chats.insert_many([
            {"session_id": session_id, "user_id": current_user.get("id"), "role": "user", "content": data.message, "timestamp": timestamp},
            {"session_id": session_id, "user_id": current_user.get("id"), "role": "assistant", "content": full_response, "timestamp": timestamp}
        ])
        
        yield f"data: {json.dumps({'type': 'done', 'session_id': session_id})}\n\n"
    
    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"}
    )


# ============== QUICK PROMPTS ==============

@router.post("/quick-prompt")
async def quick_prompt(
    data: QuickPrompt,
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """
    Pre-built quick prompts for common CEO needs
    """
    db = get_database()
    
    user_roles = current_user.get("roles", [])
    if not any(role in user_roles for role in ["admin", "ceo", "operator"]):
        raise HTTPException(status_code=403, detail="Access denied")
    
    prompts = {
        "sales_report": {
            "message": "Give me a detailed sales report for this month. Include total revenue, number of bookings, average ticket size, top routes, and comparison with last month. Suggest 3 actions to improve sales.",
            "context_type": "sales"
        },
        "marketing_ideas": {
            "message": "Generate 5 creative marketing campaign ideas for AirYatra targeting HNI customers and corporate clients. Include social media hooks, partnership ideas, and seasonal promotions. Focus on festive season (Diwali, wedding season).",
            "context_type": "marketing"
        },
        "profit_analysis": {
            "message": "Analyze our current profit margins and cost structure. Identify top 3 areas where we can reduce costs and top 3 areas where we can increase revenue. Be specific with numbers.",
            "context_type": "profit"
        },
        "hr_summary": {
            "message": "Give me an HR summary - total team size, pending leave requests, expense claims awaiting approval, and any staffing concerns. Suggest improvements for team productivity.",
            "context_type": "hr"
        },
        "customer_insights": {
            "message": "Analyze our customer base. Who are our top customers by revenue? What's our customer retention rate? Which routes are most popular? Suggest personalized outreach strategies.",
            "context_type": "customer"
        },
        "weekly_briefing": {
            "message": "Prepare a weekly business briefing for the board. Cover: key metrics (revenue, bookings, customers), operational highlights, risks/issues, and top 3 priorities for next week.",
            "context_type": "general"
        }
    }
    
    if data.prompt_type not in prompts:
        raise HTTPException(status_code=400, detail=f"Invalid prompt type. Available: {list(prompts.keys())}")
    
    prompt_config = prompts[data.prompt_type]
    
    # Use chat endpoint
    return await chat_with_advisor(
        ChatMessage(
            message=prompt_config["message"],
            context_type=prompt_config["context_type"]
        ),
        request,
        current_user
    )


# ============== MARKETING CONTENT GENERATOR ==============

@router.post("/generate-marketing")
async def generate_marketing_content(
    content_type: str,  # "social_post", "email", "sms", "whatsapp"
    campaign_theme: str,
    target_audience: str = "HNI customers",
    current_user: dict = Depends(get_current_user)
):
    """
    Generate marketing content for campaigns
    """
    db = get_database()
    
    user_roles = current_user.get("roles", [])
    if not any(role in user_roles for role in ["admin", "ceo", "operator"]):
        raise HTTPException(status_code=403, detail="Access denied")
    
    if not EMERGENT_LLM_KEY:
        raise HTTPException(status_code=500, detail="AI service not configured")
    
    content_instructions = {
        "social_post": "Create 3 engaging social media posts (Instagram/LinkedIn) with emojis, hashtags, and call-to-action. Keep under 280 characters for Twitter version too.",
        "email": "Write a professional marketing email with subject line, preview text, and body. Include AirYatra branding and clear CTA.",
        "sms": "Write 3 SMS templates (under 160 characters each) with urgency and clear offer.",
        "whatsapp": "Write 3 WhatsApp message templates with friendly tone, emojis, and quick-reply buttons suggestions."
    }
    
    instruction = content_instructions.get(content_type, content_instructions["social_post"])
    
    prompt = f"""Generate marketing content for AirYatra helicopter charter services.

Campaign Theme: {campaign_theme}
Target Audience: {target_audience}
Content Type: {content_type}

{instruction}

Brand Voice: Premium but approachable, emphasize safety, comfort, and time-saving. Use occasional Hindi phrases for Indian audience connection.

Include:
- Main offer/hook
- Emotional appeal (luxury, exclusivity, convenience)
- Clear call-to-action
- AirYatra brand mention
"""
    
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"marketing_{datetime.now().strftime('%Y%m%d%H%M%S')}",
        system_message="You are a creative marketing expert for premium aviation services in India."
    ).with_model("openai", "gpt-4o")
    
    response = ""
    async for event in chat.stream_message(UserMessage(text=prompt)):
        if isinstance(event, TextDelta):
            response += event.content
        elif isinstance(event, StreamDone):
            break
    
    # Save generated content
    await db.marketing_content.insert_one({
        "id": f"mkt_{ObjectId()}",
        "content_type": content_type,
        "campaign_theme": campaign_theme,
        "target_audience": target_audience,
        "generated_content": response,
        "created_by": current_user.get("id"),
        "created_at": datetime.now(timezone.utc)
    })
    
    return {
        "content": response,
        "content_type": content_type,
        "campaign_theme": campaign_theme,
        "generated_at": datetime.now(timezone.utc).isoformat()
    }


# ============== CHAT HISTORY ==============

@router.get("/history")
async def get_chat_history(
    session_id: Optional[str] = None,
    limit: int = 50,
    current_user: dict = Depends(get_current_user)
):
    """Get chat history for current user"""
    db = get_database()
    
    user_id = current_user.get("id")
    query = {"user_id": user_id}
    if session_id:
        query["session_id"] = session_id
    
    messages = await db.ai_advisor_chats.find(
        query, {"_id": 0}
    ).sort("timestamp", -1).limit(limit).to_list(limit)
    
    return {"messages": messages[::-1], "total": len(messages)}


@router.get("/sessions")
async def get_chat_sessions(
    current_user: dict = Depends(get_current_user)
):
    """Get list of chat sessions"""
    db = get_database()
    
    user_id = current_user.get("id")
    
    sessions = await db.ai_advisor_chats.aggregate([
        {"$match": {"user_id": user_id}},
        {"$group": {
            "_id": "$session_id",
            "message_count": {"$sum": 1},
            "last_message": {"$last": "$timestamp"},
            "first_message": {"$first": "$timestamp"}
        }},
        {"$sort": {"last_message": -1}},
        {"$limit": 20}
    ]).to_list(20)
    
    return {"sessions": sessions}


@router.delete("/session/{session_id}")
async def delete_chat_session(
    session_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a chat session"""
    db = get_database()
    
    user_id = current_user.get("id")
    
    result = await db.ai_advisor_chats.delete_many({
        "session_id": session_id,
        "user_id": user_id
    })
    
    return {"deleted": result.deleted_count}
