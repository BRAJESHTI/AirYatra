from emergentintegrations.llm.chat import LlmChat, UserMessage
from config import settings
import logging

logger = logging.getLogger(__name__)

class AIService:
    def __init__(self):
        self.api_key = settings.emergent_llm_key
        self.model = "openai"
        self.model_name = "gpt-5.1"
    
    async def get_price_suggestion(self, route_data: dict) -> dict:
        """Get AI-powered price suggestion for a route"""
        try:
            chat = LlmChat(
                api_key=self.api_key,
                session_id=f"price-suggestion-{route_data['booking_id']}",
                system_message="You are an expert aviation pricing analyst for helicopter charter services in India. Provide realistic price estimates based on route distance, aircraft type, and market conditions."
            ).with_model(self.model, self.model_name)
            
            prompt = f"""
            Calculate a reasonable price estimate for this helicopter charter:
            - From: {route_data['from_location']}
            - To: {route_data['to_location']}
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
            return {
                "base_price": 0,
                "total_estimated_price": 0,
                "confidence_level": "low",
                "reasoning": "Error calculating price"
            }
    
    async def verify_document(self, document_data: dict) -> dict:
        """AI-powered document verification"""
        try:
            chat = LlmChat(
                api_key=self.api_key,
                session_id=f"doc-verify-{document_data['document_id']}",
                system_message="You are an aviation document verification expert. Analyze documents for authenticity and completeness."
            ).with_model(self.model, self.model_name)
            
            prompt = f"""
            Verify the following document:
            - Document Type: {document_data['document_type']}
            - File Name: {document_data['file_name']}
            - Uploaded By: {document_data.get('uploaded_by', 'Unknown')}
            
            Based on document standards for {document_data['document_type']}, provide verification status.
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
            return {
                "is_valid": False,
                "confidence_score": 0,
                "issues_found": ["Verification failed"],
                "recommendations": "Manual verification required"
            }
    
    async def get_route_recommendations(self, criteria: dict) -> list:
        """Get smart route recommendations"""
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
            return []

ai_service = AIService()