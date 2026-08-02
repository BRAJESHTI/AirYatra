"""
AI Sales Advisor Routes
Marketing recommendations - Which states/corporates to target
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone, timedelta
from database import get_database
import os

router = APIRouter(prefix="/ai-sales", tags=["ai-sales"])

# State-wise market data (India aviation market insights)
STATE_MARKET_DATA = {
    "maharashtra": {
        "potential": "very_high",
        "corporate_density": 850,
        "avg_booking_value": 125000,
        "growth_rate": 22,
        "top_cities": ["Mumbai", "Pune", "Nashik", "Nagpur"],
        "key_sectors": ["IT", "Finance", "Manufacturing", "Entertainment"],
        "competition": "high"
    },
    "karnataka": {
        "potential": "very_high",
        "corporate_density": 720,
        "avg_booking_value": 115000,
        "growth_rate": 28,
        "top_cities": ["Bangalore", "Mysore", "Mangalore"],
        "key_sectors": ["IT", "Startups", "Aerospace", "Biotech"],
        "competition": "high"
    },
    "delhi_ncr": {
        "potential": "very_high",
        "corporate_density": 950,
        "avg_booking_value": 145000,
        "growth_rate": 18,
        "top_cities": ["Delhi", "Gurgaon", "Noida", "Faridabad"],
        "key_sectors": ["Government", "Finance", "Media", "Consulting"],
        "competition": "very_high"
    },
    "tamil_nadu": {
        "potential": "high",
        "corporate_density": 580,
        "avg_booking_value": 95000,
        "growth_rate": 20,
        "top_cities": ["Chennai", "Coimbatore", "Madurai"],
        "key_sectors": ["Automobile", "IT", "Manufacturing", "Healthcare"],
        "competition": "medium"
    },
    "telangana": {
        "potential": "high",
        "corporate_density": 520,
        "avg_booking_value": 105000,
        "growth_rate": 32,
        "top_cities": ["Hyderabad", "Warangal"],
        "key_sectors": ["IT", "Pharma", "Film Industry"],
        "competition": "medium"
    },
    "gujarat": {
        "potential": "high",
        "corporate_density": 680,
        "avg_booking_value": 135000,
        "growth_rate": 25,
        "top_cities": ["Ahmedabad", "Surat", "Vadodara", "Rajkot"],
        "key_sectors": ["Diamond", "Textile", "Petrochemical", "MSME"],
        "competition": "low"
    },
    "rajasthan": {
        "potential": "medium",
        "corporate_density": 320,
        "avg_booking_value": 110000,
        "growth_rate": 35,
        "top_cities": ["Jaipur", "Udaipur", "Jodhpur"],
        "key_sectors": ["Tourism", "Mining", "Textile", "Gems"],
        "competition": "low"
    },
    "kerala": {
        "potential": "medium",
        "corporate_density": 280,
        "avg_booking_value": 85000,
        "growth_rate": 18,
        "top_cities": ["Kochi", "Trivandrum", "Calicut"],
        "key_sectors": ["Tourism", "IT", "Healthcare", "Spices"],
        "competition": "low"
    },
    "west_bengal": {
        "potential": "medium",
        "corporate_density": 420,
        "avg_booking_value": 90000,
        "growth_rate": 15,
        "top_cities": ["Kolkata", "Siliguri"],
        "key_sectors": ["Steel", "Tea", "Jute", "IT"],
        "competition": "low"
    },
    "punjab": {
        "potential": "medium",
        "corporate_density": 350,
        "avg_booking_value": 100000,
        "growth_rate": 20,
        "top_cities": ["Chandigarh", "Ludhiana", "Amritsar"],
        "key_sectors": ["Agriculture", "Manufacturing", "NRI"],
        "competition": "low"
    }
}

# Corporate segment data
CORPORATE_SEGMENTS = {
    "it_tech": {
        "name": "IT & Technology",
        "potential_clients": 2500,
        "avg_deal_value": 500000,
        "conversion_rate": 8,
        "decision_time_days": 45,
        "key_events": ["Tech Summits", "Product Launches", "Client Visits"]
    },
    "finance_banking": {
        "name": "Finance & Banking",
        "potential_clients": 1800,
        "avg_deal_value": 750000,
        "conversion_rate": 12,
        "decision_time_days": 60,
        "key_events": ["Board Meetings", "Investor Relations", "Branch Visits"]
    },
    "pharma_healthcare": {
        "name": "Pharma & Healthcare",
        "potential_clients": 1200,
        "avg_deal_value": 450000,
        "conversion_rate": 10,
        "decision_time_days": 30,
        "key_events": ["Medical Emergencies", "Conference", "Plant Visits"]
    },
    "manufacturing": {
        "name": "Manufacturing",
        "potential_clients": 2000,
        "avg_deal_value": 350000,
        "conversion_rate": 6,
        "decision_time_days": 50,
        "key_events": ["Plant Inspections", "Supplier Meetings", "Emergencies"]
    },
    "media_entertainment": {
        "name": "Media & Entertainment",
        "potential_clients": 800,
        "avg_deal_value": 600000,
        "conversion_rate": 15,
        "decision_time_days": 15,
        "key_events": ["Film Shoots", "Celebrity Travel", "Events"]
    },
    "real_estate": {
        "name": "Real Estate",
        "potential_clients": 1500,
        "avg_deal_value": 550000,
        "conversion_rate": 9,
        "decision_time_days": 20,
        "key_events": ["Site Visits", "Investor Tours", "Project Launches"]
    },
    "wedding_events": {
        "name": "Weddings & Events",
        "potential_clients": 5000,
        "avg_deal_value": 250000,
        "conversion_rate": 5,
        "decision_time_days": 90,
        "key_events": ["Wedding Season", "Corporate Events", "Destination Events"]
    }
}

@router.get("/state-recommendations")
async def get_state_recommendations():
    """Get AI recommendations for which states to target"""
    db = get_database()
    
    # Get current booking distribution
    state_bookings = {}
    bookings = await db.bookings.find({}).to_list(length=1000)
    
    for booking in bookings:
        origin = booking.get("origin", "").lower()
        for state, data in STATE_MARKET_DATA.items():
            if any(city.lower() in origin for city in data["top_cities"]):
                state_bookings[state] = state_bookings.get(state, 0) + 1
                break
    
    recommendations = []
    
    for state, data in STATE_MARKET_DATA.items():
        current_bookings = state_bookings.get(state, 0)
        market_potential = data["corporate_density"] * data["growth_rate"] / 100
        penetration = (current_bookings / max(market_potential, 1)) * 100
        
        # Calculate opportunity score
        opportunity_score = (
            (data["growth_rate"] * 2) +
            (100 - penetration) +
            (data["avg_booking_value"] / 10000) -
            (30 if data["competition"] == "high" else 10 if data["competition"] == "medium" else 0)
        )
        
        recommendation = {
            "state": state.replace("_", " ").title(),
            "opportunity_score": round(opportunity_score, 1),
            "current_bookings": current_bookings,
            "market_potential": data["potential"],
            "growth_rate": data["growth_rate"],
            "avg_booking_value": data["avg_booking_value"],
            "penetration_percent": round(penetration, 1),
            "competition": data["competition"],
            "top_cities": data["top_cities"],
            "key_sectors": data["key_sectors"],
            "recommendation": ""
        }
        
        # Generate recommendation text
        if penetration < 20 and data["potential"] in ["very_high", "high"]:
            recommendation["recommendation"] = f"🔥 HIGH PRIORITY: {state.replace('_', ' ').title()} में {data['growth_rate']}% growth है। यहाँ Marketing Campaign शुरू करें!"
            recommendation["priority"] = "high"
        elif penetration < 40:
            recommendation["recommendation"] = f"📈 EXPAND: {state.replace('_', ' ').title()} में scope है। {', '.join(data['key_sectors'][:2])} sectors target करें।"
            recommendation["priority"] = "medium"
        else:
            recommendation["recommendation"] = f"✅ MAINTAIN: {state.replace('_', ' ').title()} में अच्छी presence है। Customer retention पर focus करें।"
            recommendation["priority"] = "low"
        
        recommendations.append(recommendation)
    
    # Sort by opportunity score
    recommendations.sort(key=lambda x: x["opportunity_score"], reverse=True)
    
    return {
        "recommendations": recommendations,
        "top_3_states": [r["state"] for r in recommendations[:3]],
        "total_states_analyzed": len(recommendations),
        "ai_summary": f"Top opportunity: {recommendations[0]['state']} with {recommendations[0]['growth_rate']}% growth rate. Focus on {', '.join(recommendations[0]['key_sectors'][:2])} sectors."
    }

@router.get("/corporate-recommendations")
async def get_corporate_recommendations():
    """Get AI recommendations for which corporate segments to target"""
    db = get_database()
    
    # Get current corporate bookings
    segment_bookings = await db.bookings.count_documents({"booking_type": "corporate"})
    
    recommendations = []
    
    for segment_id, data in CORPORATE_SEGMENTS.items():
        potential_revenue = data["potential_clients"] * data["avg_deal_value"] * (data["conversion_rate"] / 100)
        
        recommendation = {
            "segment_id": segment_id,
            "segment_name": data["name"],
            "potential_clients": data["potential_clients"],
            "avg_deal_value": data["avg_deal_value"],
            "conversion_rate": data["conversion_rate"],
            "decision_time_days": data["decision_time_days"],
            "potential_revenue": potential_revenue,
            "key_events": data["key_events"],
            "recommendation": ""
        }
        
        # Generate recommendation
        if data["conversion_rate"] >= 10:
            recommendation["recommendation"] = f"🎯 HOT SEGMENT: {data['name']} में {data['conversion_rate']}% conversion rate है। Priority target करें!"
            recommendation["priority"] = "high"
        elif data["avg_deal_value"] >= 500000:
            recommendation["recommendation"] = f"💰 HIGH VALUE: {data['name']} की avg deal ₹{data['avg_deal_value']/100000:.1f}L है। Quality leads पर focus करें।"
            recommendation["priority"] = "medium"
        else:
            recommendation["recommendation"] = f"📊 VOLUME PLAY: {data['name']} में {data['potential_clients']} potential clients हैं।"
            recommendation["priority"] = "low"
        
        recommendations.append(recommendation)
    
    # Sort by potential revenue
    recommendations.sort(key=lambda x: x["potential_revenue"], reverse=True)
    
    return {
        "recommendations": recommendations,
        "top_segment": recommendations[0]["segment_name"],
        "total_potential_revenue": sum(r["potential_revenue"] for r in recommendations),
        "ai_summary": f"Top corporate segment: {recommendations[0]['segment_name']} with ₹{recommendations[0]['potential_revenue']/10000000:.1f}Cr potential. Target during {', '.join(recommendations[0]['key_events'][:2])}."
    }

@router.get("/marketing-campaigns")
async def get_marketing_campaign_suggestions():
    """Get AI-generated marketing campaign suggestions"""
    
    # Get current month for seasonal recommendations
    current_month = datetime.now().month
    
    campaigns = []
    
    # Seasonal campaigns
    if current_month in [10, 11, 12, 1, 2]:
        campaigns.append({
            "campaign_name": "Wedding Season Special",
            "type": "seasonal",
            "target_audience": "Wedding planners, Event managers, HNI families",
            "channels": ["Instagram", "Facebook", "Google Ads", "Wedding portals"],
            "budget_range": "₹2-5 Lakhs/month",
            "expected_roi": "3.5x",
            "message": "🎊 Wedding Season में Helicopter Entry/Exit offer करें। Destination wedding market target करें।",
            "priority": "high"
        })
    
    if current_month in [4, 5, 6]:
        campaigns.append({
            "campaign_name": "Summer Escape",
            "type": "seasonal",
            "target_audience": "Families, Tourists, Hill station travelers",
            "channels": ["Travel portals", "Instagram", "YouTube"],
            "budget_range": "₹1-3 Lakhs/month",
            "expected_roi": "2.5x",
            "message": "☀️ Summer में Hill Station helicopter tours promote करें।",
            "priority": "medium"
        })
    
    # Always-on campaigns
    campaigns.extend([
        {
            "campaign_name": "Corporate Express",
            "type": "b2b",
            "target_audience": "CXOs, Business travelers, Corporate admins",
            "channels": ["LinkedIn Ads", "Email marketing", "Industry events"],
            "budget_range": "₹3-7 Lakhs/month",
            "expected_roi": "4x",
            "message": "💼 Corporate clients के लिए Time-saving messaging use करें। ROI calculator share करें।",
            "priority": "high"
        },
        {
            "campaign_name": "Pilgrimage Premium",
            "type": "religious",
            "target_audience": "Religious travelers, Senior citizens, NRIs",
            "channels": ["Facebook", "WhatsApp", "Religious channels"],
            "budget_range": "₹1-2 Lakhs/month",
            "expected_roi": "3x",
            "message": "🙏 Shirdi, Tirupati, Vaishno Devi routes पर focus करें। Senior-friendly messaging।",
            "priority": "medium"
        },
        {
            "campaign_name": "Medical Emergency Network",
            "type": "healthcare",
            "target_audience": "Hospitals, Insurance companies, Corporates",
            "channels": ["Direct sales", "Healthcare conferences", "LinkedIn"],
            "budget_range": "₹2-4 Lakhs/month",
            "expected_roi": "5x",
            "message": "🏥 Hospitals के साथ tie-up करें। Emergency evacuation contracts।",
            "priority": "high"
        },
        {
            "campaign_name": "Influencer Partnerships",
            "type": "digital",
            "target_audience": "Luxury travelers, Young professionals",
            "channels": ["Instagram Reels", "YouTube", "Travel influencers"],
            "budget_range": "₹50K-2 Lakhs/month",
            "expected_roi": "2x",
            "message": "📱 Travel influencers को complimentary rides offer करें। UGC generate करें।",
            "priority": "low"
        }
    ])
    
    # Sort by priority
    priority_order = {"high": 0, "medium": 1, "low": 2}
    campaigns.sort(key=lambda x: priority_order.get(x["priority"], 2))
    
    return {
        "campaigns": campaigns,
        "total_campaigns": len(campaigns),
        "recommended_monthly_budget": "₹8-15 Lakhs",
        "ai_summary": f"इस महीने {campaigns[0]['campaign_name']} पर focus करें। Expected ROI: {campaigns[0]['expected_roi']}।"
    }

@router.get("/competitor-analysis")
async def get_competitor_analysis():
    """Get competitor analysis and positioning recommendations"""
    
    competitors = [
        {
            "name": "BLADE India",
            "strength": "Brand awareness, Urban routes",
            "weakness": "Limited fleet, Premium pricing",
            "market_share": "35%",
            "positioning": "Ultra-premium urban mobility"
        },
        {
            "name": "HeliTaxii",
            "strength": "Affordable pricing, Wide coverage",
            "weakness": "Service quality, Brand perception",
            "market_share": "20%",
            "positioning": "Budget helicopter travel"
        },
        {
            "name": "Thumby Aviation",
            "strength": "Corporate contracts, B2B focus",
            "weakness": "Limited B2C presence",
            "market_share": "15%",
            "positioning": "Corporate aviation partner"
        },
        {
            "name": "Pawan Hans",
            "strength": "Government backing, Pan-India presence",
            "weakness": "Slow processes, Limited flexibility",
            "market_share": "25%",
            "positioning": "Government & PSU aviation"
        }
    ]
    
    airyatra_positioning = {
        "recommended_position": "India's Aviation Operating System - Technology-first platform",
        "unique_selling_points": [
            "AI-powered pricing & recommendations",
            "Multi-operator aggregator model",
            "Enterprise-grade security (2FA, Audit trails)",
            "Real-time tracking & Command Center",
            "Seamless booking experience"
        ],
        "target_gap": "Tech-savvy corporates & premium individuals who want transparency & convenience",
        "key_differentiators": [
            "Only platform with AI Business Advisor",
            "Multi-language support (9 Indian languages)",
            "Operator ERP integration",
            "Live command center for safety"
        ]
    }
    
    return {
        "competitors": competitors,
        "airyatra_positioning": airyatra_positioning,
        "strategic_recommendations": [
            "🎯 Technology को USP बनाएं - AI features highlight करें",
            "💪 Aggregator model का advantage communicate करें - More choices, Better prices",
            "🔒 Security features से Corporate trust build करें",
            "📱 Digital-first experience से young professionals target करें"
        ]
    }

@router.get("/sales-forecast")
async def get_sales_forecast():
    """Get AI-generated sales forecast"""
    db = get_database()
    
    # Get historical data
    thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)
    sixty_days_ago = datetime.now(timezone.utc) - timedelta(days=60)
    
    last_30_bookings = await db.bookings.count_documents({"created_at": {"$gte": thirty_days_ago}})
    prev_30_bookings = await db.bookings.count_documents({
        "created_at": {"$gte": sixty_days_ago, "$lt": thirty_days_ago}
    })
    
    # Calculate growth
    growth_rate = ((last_30_bookings - prev_30_bookings) / max(prev_30_bookings, 1)) * 100
    
    # Forecast next 3 months
    forecasts = []
    base_bookings = last_30_bookings
    
    months = ["Next Month", "Month 2", "Month 3"]
    for i, month in enumerate(months):
        # Apply growth with seasonal adjustment
        seasonal_factor = 1.2 if datetime.now().month + i in [10, 11, 12, 1, 2] else 1.0
        projected = int(base_bookings * (1 + growth_rate/100) * seasonal_factor)
        
        forecasts.append({
            "period": month,
            "projected_bookings": projected,
            "projected_revenue": projected * 95000,  # Avg booking value
            "confidence": 85 - (i * 10)  # Confidence decreases for further months
        })
        
        base_bookings = projected
    
    return {
        "current_metrics": {
            "last_30_days_bookings": last_30_bookings,
            "previous_30_days_bookings": prev_30_bookings,
            "growth_rate": round(growth_rate, 1)
        },
        "forecast": forecasts,
        "total_projected_revenue": sum(f["projected_revenue"] for f in forecasts),
        "ai_summary": f"पिछले 30 दिनों में {growth_rate:.1f}% growth। अगले 3 महीनों में ~₹{sum(f['projected_revenue'] for f in forecasts)/10000000:.1f}Cr revenue expected।"
    }
