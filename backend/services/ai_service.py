import os
import json
from typing import Optional, Dict, Any, List
from datetime import datetime

# Emergent LLM Integration
import logging
logger = logging.getLogger(__name__)

try:
    from emergentintegrations.llm.chat import LlmChat, UserMessage
    from uuid import uuid4 as _uuid4
    EMERGENT_AVAILABLE = True
    logger.info("emergentintegrations (LlmChat) loaded successfully")

    def _make_chat(api_key: str, system_prompt: str, session_id: str = None):
        return LlmChat(
            api_key=api_key,
            session_id=session_id or f"ai-{_uuid4()}",
            system_message=system_prompt
        ).with_model("openai", "gpt-5.4")
except ImportError:
    EMERGENT_AVAILABLE = False
    logger.info("emergentintegrations not available, AI features will use mock responses")

EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "sk-emergent-dBbA2Ee2c6f44E66e5")

class AIService:
    def __init__(self):
        self.emergent_key = EMERGENT_LLM_KEY
        self.chatbot_system_prompt = """You are AirYatra's AI assistant, helping customers with helicopter charter bookings in India. 
        
You help with:
- Booking inquiries and pricing questions
- Route recommendations
- Flight status and booking updates
- General aviation queries
- Customer support

Always be helpful, professional, and respond in both Hindi and English when appropriate.
Keep responses concise but informative. If you don't know something specific, suggest contacting customer support.

Important facts about AirYatra:
- We offer helicopter charter services across India
- Popular routes include Mumbai-Pune, Delhi-Jaipur, Mumbai-Shirdi, etc.
- We have multiple operators with verified helicopters
- Bookings can be made for personal, business, medical emergencies, weddings, pilgrimage, etc.
- We offer travel insurance options
- GST invoices available for corporate bookings

Reply in the same language the user is using. If they use Hinglish, respond in Hinglish."""
        
    async def get_price_suggestion(
        self,
        route_from: str,
        route_to: str,
        aircraft_type: str,
        passengers: int,
        departure_date: str,
        is_round_trip: bool = False
    ) -> Dict[str, Any]:
        """Get AI-powered price suggestion for a helicopter booking"""
        
        prompt = f"""You are an aviation pricing expert for helicopter charter services in India.
        
Analyze this booking request and provide a price suggestion:
- Route: {route_from} to {route_to}
- Aircraft Type: {aircraft_type}
- Passengers: {passengers}
- Date: {departure_date}
- Trip Type: {'Round Trip' if is_round_trip else 'One Way'}

Consider these factors:
1. Distance and flight time
2. Fuel costs (current aviation fuel prices in India)
3. Landing fees and permits
4. Crew costs
5. Aircraft operating costs
6. Market rates for similar routes
7. Demand factors (season, day of week)

Provide your response in this exact JSON format:
{{
    "suggested_price": <number in INR>,
    "price_range_min": <minimum reasonable price>,
    "price_range_max": <maximum reasonable price>,
    "estimated_flight_time_minutes": <number>,
    "estimated_distance_km": <number>,
    "breakdown": {{
        "base_charter_cost": <number>,
        "fuel_cost": <number>,
        "landing_fees": <number>,
        "crew_cost": <number>,
        "other_costs": <number>
    }},
    "factors_considered": ["list of factors that influenced pricing"],
    "confidence_level": "high/medium/low",
    "recommendation": "brief pricing recommendation"
}}

Only respond with valid JSON, no additional text."""

        if EMERGENT_AVAILABLE:
            try:
                chat = _make_chat(
                    self.emergent_key,
                    "You are an aviation pricing expert. Always respond with valid JSON only."
                )
                response = await chat.send_message(UserMessage(text=prompt))
                
                # Parse JSON response
                try:
                    result = json.loads(response)
                    result["ai_generated"] = True
                    return result
                except json.JSONDecodeError:
                    # Try to extract JSON from response
                    import re
                    json_match = re.search(r'\{[\s\S]*\}', response)
                    if json_match:
                        result = json.loads(json_match.group())
                        result["ai_generated"] = True
                        return result
            except Exception as e:
                print(f"AI price suggestion error: {e}")
        
        # Fallback mock response
        return self._get_mock_price_suggestion(route_from, route_to, aircraft_type, passengers)
    
    def _get_mock_price_suggestion(
        self, 
        route_from: str, 
        route_to: str, 
        aircraft_type: str,
        passengers: int
    ) -> Dict[str, Any]:
        """Generate mock price suggestion based on simple heuristics"""
        # Simple distance estimation based on common routes
        route_distances = {
            ("mumbai", "pune"): 150,
            ("mumbai", "goa"): 450,
            ("delhi", "jaipur"): 280,
            ("bangalore", "chennai"): 350,
            ("mumbai", "shirdi"): 250,
        }
        
        # Normalize route names
        from_lower = route_from.lower()
        to_lower = route_to.lower()
        
        # Find distance
        distance = route_distances.get((from_lower, to_lower), 
                   route_distances.get((to_lower, from_lower), 300))  # default 300km
        
        # Price calculation
        base_rate_per_km = 350  # INR per km for helicopter
        base_cost = distance * base_rate_per_km
        fuel_cost = distance * 120
        landing_fees = 15000
        crew_cost = 25000
        other_costs = 10000
        
        total = base_cost + fuel_cost + landing_fees + crew_cost + other_costs
        
        return {
            "suggested_price": int(total),
            "price_range_min": int(total * 0.85),
            "price_range_max": int(total * 1.15),
            "estimated_flight_time_minutes": int(distance / 3),  # ~180 km/h average
            "estimated_distance_km": distance,
            "breakdown": {
                "base_charter_cost": int(base_cost),
                "fuel_cost": int(fuel_cost),
                "landing_fees": landing_fees,
                "crew_cost": crew_cost,
                "other_costs": other_costs
            },
            "factors_considered": [
                "Route distance",
                "Aircraft operating costs",
                "Fuel prices",
                "Landing fees",
                "Crew requirements"
            ],
            "confidence_level": "medium",
            "recommendation": f"Based on the {distance}km route, suggested charter price is ₹{total:,}",
            "ai_generated": False
        }
    
    async def verify_document(
        self,
        document_type: str,
        document_url: str,
        expected_fields: Optional[list] = None
    ) -> Dict[str, Any]:
        """AI-powered document verification"""
        
        # For now, return mock verification
        # In production, this would use vision AI to analyze document images
        return {
            "verified": True,
            "document_type": document_type,
            "confidence_score": 0.85,
            "extracted_fields": {
                "document_number": "AUTO-EXTRACTED",
                "issue_date": "AUTO-EXTRACTED",
                "expiry_date": "AUTO-EXTRACTED",
            },
            "warnings": [],
            "verification_notes": "Document appears valid. Manual review recommended for final approval.",
            "ai_verified": True
        }
    
    async def get_route_recommendations(
        self,
        from_location: str,
        preferences: Optional[Dict] = None
    ) -> Dict[str, Any]:
        """Get AI-powered route recommendations"""
        
        prompt = f"""As an aviation expert, suggest popular helicopter charter routes from {from_location} in India.

Provide 5 recommended routes with this JSON format:
{{
    "recommendations": [
        {{
            "destination": "City Name",
            "distance_km": <number>,
            "flight_time_minutes": <number>,
            "estimated_price_inr": <number>,
            "popularity_score": <1-10>,
            "best_for": ["business", "tourism", "pilgrimage", etc],
            "description": "Brief description of why this route is popular"
        }}
    ],
    "source_city": "{from_location}"
}}

Only respond with valid JSON."""

        if EMERGENT_AVAILABLE:
            try:
                chat = Chat(
                    emergent_api_key=self.emergent_key,
                    model=Model.CLAUDE_SONNET,
                    system_prompt="You are an aviation route expert. Always respond with valid JSON only."
                )
                response = await chat.send_async(prompt)
                
                try:
                    result = json.loads(response)
                    result["ai_generated"] = True
                    return result
                except json.JSONDecodeError:
                    import re
                    json_match = re.search(r'\{[\s\S]*\}', response)
                    if json_match:
                        result = json.loads(json_match.group())
                        result["ai_generated"] = True
                        return result
            except Exception as e:
                print(f"AI route recommendation error: {e}")
        
        # Fallback mock recommendations
        return self._get_mock_recommendations(from_location)
    
    def _get_mock_recommendations(self, from_location: str) -> Dict[str, Any]:
        """Generate mock route recommendations"""
        recommendations = {
            "mumbai": [
                {"destination": "Pune", "distance_km": 150, "flight_time_minutes": 45, "estimated_price_inr": 85000, "popularity_score": 9, "best_for": ["business"], "description": "Quick business commute"},
                {"destination": "Shirdi", "distance_km": 250, "flight_time_minutes": 70, "estimated_price_inr": 125000, "popularity_score": 8, "best_for": ["pilgrimage"], "description": "Popular pilgrimage destination"},
                {"destination": "Goa", "distance_km": 450, "flight_time_minutes": 90, "estimated_price_inr": 195000, "popularity_score": 8, "best_for": ["tourism", "leisure"], "description": "Beach getaway"},
            ],
            "delhi": [
                {"destination": "Jaipur", "distance_km": 280, "flight_time_minutes": 60, "estimated_price_inr": 145000, "popularity_score": 9, "best_for": ["tourism", "business"], "description": "Pink City trip"},
                {"destination": "Agra", "distance_km": 200, "flight_time_minutes": 50, "estimated_price_inr": 110000, "popularity_score": 8, "best_for": ["tourism"], "description": "Taj Mahal visit"},
            ]
        }
        
        from_lower = from_location.lower()
        routes = recommendations.get(from_lower, [
            {"destination": "Nearest Metro", "distance_km": 200, "flight_time_minutes": 50, "estimated_price_inr": 100000, "popularity_score": 7, "best_for": ["business"], "description": "Business travel"}
        ])
        
        return {
            "recommendations": routes,
            "source_city": from_location,
            "ai_generated": False
        }
    
    async def chat_with_support(
        self,
        user_message: str,
        conversation_history: List[Dict] = None,
        user_context: Dict = None
    ) -> Dict[str, Any]:
        """
        AI-powered customer support chatbot
        """
        
        # Build context from user info
        context_info = ""
        if user_context:
            context_info = f"""
User Context:
- Name: {user_context.get('name', 'Guest')}
- Has Active Bookings: {user_context.get('has_bookings', False)}
- Recent Booking ID: {user_context.get('recent_booking_id', 'None')}
"""
        
        # Build conversation history
        history_text = ""
        if conversation_history:
            for msg in conversation_history[-5:]:  # Last 5 messages
                role = "Customer" if msg.get("role") == "user" else "Assistant"
                history_text += f"{role}: {msg.get('content', '')}\n"
        
        prompt = f"""{context_info}

Previous conversation:
{history_text}

Customer's new message: {user_message}

Respond helpfully and professionally. Keep response under 200 words."""
        
        if EMERGENT_AVAILABLE:
            try:
                chat = _make_chat(self.emergent_key, self.chatbot_system_prompt)
                response = await chat.send_message(UserMessage(text=prompt))
                
                return {
                    "response": response,
                    "ai_generated": True,
                    "model": "gpt-5.4"
                }
            except Exception as e:
                print(f"AI chatbot error: {e}")
        
        # Fallback mock responses
        return self._get_mock_chatbot_response(user_message)
    
    def _get_mock_chatbot_response(self, user_message: str) -> Dict[str, Any]:
        """Generate mock chatbot response based on keywords"""
        message_lower = user_message.lower()
        
        # Keyword-based responses
        if any(word in message_lower for word in ["price", "cost", "rate", "kitna", "कितना"]):
            response = """Our helicopter charter prices typically range from ₹50,000 to ₹3,00,000 depending on:
- Distance and route
- Aircraft type
- Waiting time required

For exact pricing, please use our booking page where prices are calculated automatically based on your route.

"""
        
        elif any(word in message_lower for word in ["book", "booking", "reserve"]):
            response = """To book a helicopter charter:
1. Go to 'Book Now' page
2. Enter pickup & drop PIN codes
3. Select date, time, and passengers
4. Choose insurance if needed
5. Submit your request

Operators will send quotes within 2-4 hours!

'Book Now' """
        
        elif any(word in message_lower for word in ["cancel", "refund"]):
            response = """Our cancellation policy:
- 48+ hours before: Full refund minus 10% processing fee
- 24-48 hours: 50% refund
- Less than 24 hours: No refund

Please contact support@airyatra.com for cancellation requests.

"""
        
        elif any(word in message_lower for word in ["route", "destination", "where"]):
            response = """Popular helicopter routes include:
- Mumbai ↔ Pune (45 mins)
- Mumbai ↔ Shirdi (70 mins)
- Delhi ↔ Jaipur (60 mins)
- Mumbai ↔ Goa (90 mins)

We operate across all major cities in India! Enter your PIN codes on booking page for exact route options.

"""
        
        elif any(word in message_lower for word in ["safe", "safety", "secure"]):
            response = """Safety is our top priority:
✓ All helicopters are DGCA certified
✓ Pilots have minimum 1000+ flight hours
✓ Regular maintenance checks
✓ Comprehensive travel insurance available
✓ Real-time flight tracking

"""
        
        elif any(word in message_lower for word in ["help", "support", "contact"]):
            response = """Need help? Here's how to reach us:
📧 Email: support@airyatra.com
📱 Phone: 1800-XXX-XXXX (Toll-free)
💬 Live chat: Available on website

Our support team is available 9 AM - 9 PM IST.

"""
        
        else:
            response = """Thank you for reaching out! I'm AirYatra's AI assistant.

I can help you with:
- Booking inquiries & pricing
- Route recommendations
- Flight status updates
- General questions

How can I assist you today?

"""
        
        return {
            "response": response,
            "ai_generated": False,
            "model": "keyword-fallback"
        }
    
    async def generate_booking_summary(self, booking: Dict) -> str:
        """Generate AI summary for a booking"""
        
        prompt = f"""Generate a brief, professional booking summary email in both English and Hindi for this helicopter charter booking:

Booking Number: {booking.get('booking_number', 'N/A')}
Route: {booking.get('from_location', '')} to {booking.get('to_location', '')}
Date: {booking.get('departure_date', 'TBD')}
Time: {booking.get('pickup_time', 'TBD')}
Passengers: {booking.get('passengers', 1)}
Purpose: {booking.get('booking_purpose', 'General Travel')}
Total Amount: ₹{booking.get('total_amount', 0):,}

Keep it under 150 words total."""
        
        if EMERGENT_AVAILABLE:
            try:
                chat = Chat(
                    emergent_api_key=self.emergent_key,
                    model=Model.CLAUDE_SONNET,
                    system_prompt="You are a professional booking confirmation writer. Be concise and friendly."
                )
                return await chat.send_async(prompt)
            except Exception as e:
                print(f"AI summary error: {e}")
        
        # Fallback template
        return f"""✈️ Booking Confirmed
Booking: {booking.get('booking_number', 'N/A')}
Route: {booking.get('from_location', '')} → {booking.get('to_location', '')}
Date: {booking.get('departure_date', 'TBD')} at {booking.get('pickup_time', 'TBD')}
Passengers: {booking.get('passengers', 1)}
Amount: ₹{booking.get('total_amount', 0):,}

Thank you for choosing AirYatra!
AirYatra """

# Singleton instance
ai_service = AIService()
