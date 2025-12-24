import logging
from config import settings

logger = logging.getLogger(__name__)

# Try to import emergentintegrations, fallback to mock if not available
EMERGENT_AVAILABLE = False
try:
    from emergentintegrations.llm.chat import LlmChat, UserMessage
    EMERGENT_AVAILABLE = True
except ImportError:
    logger.info("emergentintegrations not available, AI features will use mock responses")
    LlmChat = None
    UserMessage = None

class AIService:
    def __init__(self):
        self.api_key = settings.emergent_llm_key if hasattr(settings, 'emergent_llm_key') else ""
        self.model = "openai"
        self.model_name = "gpt-5.1"
        self.available = EMERGENT_AVAILABLE and bool(self.api_key)
    
    async def get_price_suggestion(self, route_data: dict) -> dict:
        """Get AI-powered price suggestion for a route"""
        if not self.available:
            return self._mock_price_suggestion(route_data)
        
        try:
            chat = LlmChat(
                api_key=self.api_key,
                session_id=f"price-suggestion-{route_data.get('booking_id', 'unknown')}",
                system_message="You are an expert aviation pricing analyst for helicopter charter services in India. Provide realistic price estimates based on route distance, aircraft type, and market conditions."
            ).with_model(self.model, self.model_name)
            
            prompt = f"""
            Calculate a reasonable price estimate for this helicopter charter:
            - From: {route_data.get('from_location', 'Unknown')}
            - To: {route_data.get('to_location', 'Unknown')}
            - Aircraft Type: {route_data.get('aircraft_type', 'Standard Helicopter')}
            - Passengers: {route_data.get('passengers', 1)}
            - Trip Type: {route_data.get('trip_type', 'one_way')}
            
            Provide the response in the following JSON format only:
            {{
                "base_price": <number>,
                "fuel_surcharge": <number>,
                "landing_fees": <number>,
                "total_estimated_price": <number>,
                "confidence_level": "high/medium/low",
                "reasoning": "brief explanation"
            }}
            """
            
            message = UserMessage(text=prompt)
            response = await chat.send_message(message)
            
            import json
            return json.loads(response)
        except Exception as e:
            logger.error(f"Error getting price suggestion: {e}")
            return self._mock_price_suggestion(route_data)
    
    def _mock_price_suggestion(self, route_data: dict) -> dict:
        """Mock price suggestion when AI is not available"""
        passengers = route_data.get('passengers', 1)
        base = 50000 + (passengers * 5000)
        return {
            "base_price": base,
            "fuel_surcharge": int(base * 0.15),
            "landing_fees": 5000,
            "total_estimated_price": int(base * 1.2),
            "confidence_level": "low",
            "reasoning": "Estimated price (AI unavailable)",
            "is_mock": True
        }
    
    async def verify_document(self, document_data: dict) -> dict:
        """AI-powered document verification"""
        if not self.available:
            return self._mock_document_verification(document_data)
        
        try:
            chat = LlmChat(
                api_key=self.api_key,
                session_id=f"doc-verify-{document_data.get('document_id', 'unknown')}",
                system_message="You are an aviation document verification expert. Analyze documents for authenticity and completeness."
            ).with_model(self.model, self.model_name)
            
            prompt = f"""
            Verify the following document:
            - Document Type: {document_data.get('document_type', 'Unknown')}
            - File Name: {document_data.get('file_name', 'Unknown')}
            - Uploaded By: {document_data.get('uploaded_by', 'Unknown')}
            
            Based on document standards for {document_data.get('document_type', 'Unknown')}, provide verification status.
            Respond in JSON format:
            {{
                "is_valid": true/false,
                "confidence_score": 0-100,
                "issues_found": ["issue1", "issue2"],
                "recommendations": "suggestions for improvement"
            }}
            """
            
            message = UserMessage(text=prompt)
            response = await chat.send_message(message)
            
            import json
            return json.loads(response)
        except Exception as e:
            logger.error(f"Error verifying document: {e}")
            return self._mock_document_verification(document_data)
    
    def _mock_document_verification(self, document_data: dict) -> dict:
        """Mock document verification when AI is not available"""
        return {
            "is_valid": True,
            "confidence_score": 70,
            "issues_found": [],
            "recommendations": "Manual verification recommended",
            "is_mock": True
        }
    
    async def get_route_recommendations(self, criteria: dict) -> list:
        """Get smart route recommendations"""
        if not self.available:
            return self._mock_route_recommendations(criteria)
        
        try:
            chat = LlmChat(
                api_key=self.api_key,
                session_id=f"route-recommend-{criteria.get('user_id', 'guest')}",
                system_message="You are a helicopter route planning expert for India. Suggest optimal routes considering safety, weather, and efficiency."
            ).with_model(self.model, self.model_name)
            
            prompt = f"""
            Suggest helicopter routes based on:
            - Origin: {criteria.get('origin', 'Not specified')}
            - Preferred Destination Type: {criteria.get('destination_type', 'Any')}
            - Budget Range: {criteria.get('budget_range', 'Any')}
            - Purpose: {criteria.get('purpose', 'Tourism')}
            
            Provide 3-5 route recommendations in JSON format:
            [
                {{
                    "from": "location",
                    "to": "location",
                    "distance_km": <number>,
                    "estimated_duration_minutes": <number>,
                    "estimated_price": <number>,
                    "highlights": "what makes this route special",
                    "best_season": "when to fly this route"
                }}
            ]
            """
            
            message = UserMessage(text=prompt)
            response = await chat.send_message(message)
            
            import json
            return json.loads(response)
        except Exception as e:
            logger.error(f"Error getting route recommendations: {e}")
            return self._mock_route_recommendations(criteria)
    
    def _mock_route_recommendations(self, criteria: dict) -> list:
        """Mock route recommendations when AI is not available"""
        return [
            {
                "from": "Delhi",
                "to": "Shimla",
                "distance_km": 350,
                "estimated_duration_minutes": 75,
                "estimated_price": 150000,
                "highlights": "Scenic Himalayan views",
                "best_season": "March-June, September-November",
                "is_mock": True
            },
            {
                "from": "Mumbai",
                "to": "Pune",
                "distance_km": 150,
                "estimated_duration_minutes": 40,
                "estimated_price": 85000,
                "highlights": "Quick business route",
                "best_season": "Year-round",
                "is_mock": True
            }
        ]

# Singleton instance
ai_service = AIService()
