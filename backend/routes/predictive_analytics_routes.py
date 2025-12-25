from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone, timedelta
from uuid import uuid4
import random
from database import get_database
from routes.auth_routes import get_current_user

router = APIRouter(prefix="/analytics-predict", tags=["Predictive Analytics"])

# Models
class DemandPredictionRequest(BaseModel):
    route: str  # "Delhi-Mumbai"
    date_range_start: str
    date_range_end: str

class RevenueForecast(BaseModel):
    period: str  # "weekly", "monthly", "quarterly"

class ChurnPredictionRequest(BaseModel):
    customer_id: Optional[str] = None
    segment: Optional[str] = None

# Helper Functions
def generate_demand_forecast(route: str, start_date: str, end_date: str) -> List[dict]:
    """Generate demand forecast (simulated - in production use ML model)"""
    forecasts = []
    start = datetime.strptime(start_date, "%Y-%m-%d")
    end = datetime.strptime(end_date, "%Y-%m-%d")
    
    current = start
    while current <= end:
        # Simulate demand based on day of week and seasonality
        base_demand = 15
        day_factor = 1.2 if current.weekday() in [4, 5, 6] else 1.0  # Weekend boost
        month_factor = 1.3 if current.month in [10, 11, 12, 1, 3, 4] else 1.0  # Peak season
        
        predicted_demand = int(base_demand * day_factor * month_factor * random.uniform(0.8, 1.2))
        confidence = random.uniform(0.75, 0.95)
        
        forecasts.append({
            "date": current.strftime("%Y-%m-%d"),
            "predicted_bookings": predicted_demand,
            "confidence": round(confidence, 2),
            "demand_level": "high" if predicted_demand > 20 else "medium" if predicted_demand > 10 else "low"
        })
        
        current += timedelta(days=1)
    
    return forecasts

def calculate_revenue_forecast(period: str, historical_data: List[dict]) -> dict:
    """Calculate revenue forecast based on historical data"""
    if not historical_data:
        # Generate sample forecast
        if period == "weekly":
            base = 500000
            periods = 4
        elif period == "monthly":
            base = 2000000
            periods = 3
        else:  # quarterly
            base = 6000000
            periods = 4
        
        forecasts = []
        for i in range(periods):
            growth = random.uniform(0.95, 1.15)
            forecasts.append({
                "period": f"Period {i+1}",
                "predicted_revenue": int(base * growth),
                "confidence": round(random.uniform(0.7, 0.9), 2),
                "growth_rate": round((growth - 1) * 100, 1)
            })
        
        return {
            "forecast_period": period,
            "predictions": forecasts,
            "total_predicted": sum(f["predicted_revenue"] for f in forecasts),
            "average_confidence": round(sum(f["confidence"] for f in forecasts) / len(forecasts), 2)
        }
    
    return {}

def predict_churn_risk(customer_data: dict) -> dict:
    """Predict customer churn risk"""
    # Simulated churn prediction
    risk_factors = []
    risk_score = 0
    
    days_since_booking = customer_data.get("days_since_last_booking", 90)
    if days_since_booking > 180:
        risk_score += 30
        risk_factors.append("No booking in 6+ months")
    elif days_since_booking > 90:
        risk_score += 15
        risk_factors.append("No booking in 3+ months")
    
    total_bookings = customer_data.get("total_bookings", 1)
    if total_bookings < 2:
        risk_score += 20
        risk_factors.append("Low booking frequency")
    
    cancelled_ratio = customer_data.get("cancellation_ratio", 0)
    if cancelled_ratio > 0.3:
        risk_score += 25
        risk_factors.append("High cancellation rate")
    
    support_tickets = customer_data.get("support_tickets", 0)
    if support_tickets > 3:
        risk_score += 15
        risk_factors.append("Multiple support issues")
    
    risk_level = "high" if risk_score > 50 else "medium" if risk_score > 25 else "low"
    
    return {
        "risk_score": min(risk_score, 100),
        "risk_level": risk_level,
        "risk_factors": risk_factors,
        "recommended_actions": [
            "Send personalized offer" if risk_level in ["high", "medium"] else None,
            "Schedule follow-up call" if risk_level == "high" else None,
            "Offer loyalty bonus" if risk_level == "medium" else None
        ]
    }

# API Endpoints
@router.post("/demand-forecast")
async def get_demand_forecast(request: DemandPredictionRequest, current_user: dict = Depends(get_current_user)):
    """Get demand forecast for a route"""
    forecasts = generate_demand_forecast(
        request.route,
        request.date_range_start,
        request.date_range_end
    )
    
    # Calculate summary
    total_predicted = sum(f["predicted_bookings"] for f in forecasts)
    avg_daily = total_predicted / len(forecasts) if forecasts else 0
    high_demand_days = len([f for f in forecasts if f["demand_level"] == "high"])
    
    return {
        "route": request.route,
        "period": f"{request.date_range_start} to {request.date_range_end}",
        "forecasts": forecasts,
        "summary": {
            "total_predicted_bookings": total_predicted,
            "average_daily_demand": round(avg_daily, 1),
            "high_demand_days": high_demand_days,
            "recommendation": "Consider adding extra slots" if high_demand_days > len(forecasts) * 0.3 else "Normal capacity sufficient"
        }
    }

@router.post("/revenue-forecast")
async def get_revenue_forecast(request: RevenueForecast, current_user: dict = Depends(get_current_user)):
    """Get revenue forecast"""
    if "admin" not in current_user.get("roles", []):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    db = get_database()
    
    # Get historical revenue data
    historical = []  # In production, fetch from DB
    
    forecast = calculate_revenue_forecast(request.period, historical)
    
    return forecast

@router.get("/churn-risk/{customer_id}")
async def get_churn_risk(customer_id: str, current_user: dict = Depends(get_current_user)):
    """Get churn risk for a customer"""
    if "admin" not in current_user.get("roles", []) and "sales" not in current_user.get("roles", []):
        raise HTTPException(status_code=403, detail="Access denied")
    
    db = get_database()
    
    # Get customer data
    customer = await db.users.find_one({"id": customer_id})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    # Get booking history
    bookings = await db.bookings.count_documents({"user_id": customer_id})
    last_booking = await db.bookings.find_one(
        {"user_id": customer_id},
        sort=[("created_at", -1)]
    )
    
    days_since = 0
    if last_booking:
        last_date = datetime.fromisoformat(last_booking["created_at"].replace('Z', '+00:00'))
        days_since = (datetime.now(timezone.utc) - last_date).days
    
    customer_data = {
        "days_since_last_booking": days_since,
        "total_bookings": bookings,
        "cancellation_ratio": 0.1,  # In production, calculate from actual data
        "support_tickets": 0
    }
    
    prediction = predict_churn_risk(customer_data)
    prediction["customer_id"] = customer_id
    prediction["customer_name"] = customer.get("full_name", "")
    
    return prediction

@router.get("/churn-risk-batch")
async def get_batch_churn_risk(current_user: dict = Depends(get_current_user)):
    """Get churn risk for all customers"""
    if "admin" not in current_user.get("roles", []):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    db = get_database()
    
    # Get all customers
    customers = await db.users.find(
        {"roles": {"$in": ["customer"]}},
        {"_id": 0, "id": 1, "full_name": 1, "email": 1}
    ).to_list(1000)
    
    high_risk = []
    medium_risk = []
    low_risk = []
    
    for customer in customers[:50]:  # Limit for performance
        # Simplified prediction
        prediction = predict_churn_risk({
            "days_since_last_booking": random.randint(10, 200),
            "total_bookings": random.randint(1, 10),
            "cancellation_ratio": random.uniform(0, 0.5),
            "support_tickets": random.randint(0, 5)
        })
        
        result = {
            "customer_id": customer["id"],
            "customer_name": customer.get("full_name", ""),
            "email": customer.get("email", ""),
            **prediction
        }
        
        if prediction["risk_level"] == "high":
            high_risk.append(result)
        elif prediction["risk_level"] == "medium":
            medium_risk.append(result)
        else:
            low_risk.append(result)
    
    return {
        "summary": {
            "high_risk_count": len(high_risk),
            "medium_risk_count": len(medium_risk),
            "low_risk_count": len(low_risk)
        },
        "high_risk_customers": high_risk,
        "medium_risk_customers": medium_risk[:10]  # Top 10
    }

@router.get("/seasonal-trends")
async def get_seasonal_trends(current_user: dict = Depends(get_current_user)):
    """Get seasonal booking trends"""
    # Simulated trends
    months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    trends = []
    
    for i, month in enumerate(months):
        # Peak: Oct-Dec, Mar-Apr
        if i in [9, 10, 11, 2, 3]:
            factor = random.uniform(1.3, 1.6)
        elif i in [5, 6, 7]:  # Low: Jun-Aug (monsoon)
            factor = random.uniform(0.6, 0.8)
        else:
            factor = random.uniform(0.9, 1.1)
        
        trends.append({
            "month": month,
            "demand_index": round(factor * 100),
            "season": "peak" if factor > 1.2 else "low" if factor < 0.8 else "normal",
            "recommended_pricing": "premium" if factor > 1.2 else "discount" if factor < 0.8 else "standard"
        })
    
    return {
        "year": datetime.now().year,
        "trends": trends,
        "peak_months": ["October", "November", "December", "March", "April"],
        "low_months": ["June", "July", "August"]
    }

@router.get("/route-performance")
async def get_route_performance(current_user: dict = Depends(get_current_user)):
    """Get route performance analytics"""
    if "admin" not in current_user.get("roles", []):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    routes = [
        {"route": "Delhi-Mumbai", "bookings": 245, "revenue": 12250000, "growth": 15.2},
        {"route": "Delhi-Jaipur", "bookings": 189, "revenue": 5670000, "growth": 8.5},
        {"route": "Mumbai-Pune", "bookings": 156, "revenue": 3900000, "growth": 22.1},
        {"route": "Bangalore-Chennai", "bookings": 134, "revenue": 4020000, "growth": -5.3},
        {"route": "Delhi-Chandigarh", "bookings": 98, "revenue": 2940000, "growth": 12.8}
    ]
    
    for route in routes:
        route["avg_booking_value"] = round(route["revenue"] / route["bookings"])
        route["trend"] = "up" if route["growth"] > 0 else "down"
        route["prediction_next_month"] = int(route["bookings"] * (1 + route["growth"]/100))
    
    return {
        "period": "Last 30 days",
        "routes": routes,
        "top_route": routes[0]["route"],
        "fastest_growing": max(routes, key=lambda x: x["growth"])["route"]
    }

@router.get("/dashboard")
async def get_analytics_dashboard(current_user: dict = Depends(get_current_user)):
    """Get predictive analytics dashboard"""
    if "admin" not in current_user.get("roles", []):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    return {
        "predictions": {
            "next_week_bookings": random.randint(80, 120),
            "next_month_revenue": random.randint(5000000, 8000000),
            "demand_trend": "increasing",
            "confidence": 0.82
        },
        "alerts": [
            {"type": "high_demand", "message": "Expected high demand for Delhi-Mumbai on Dec 25-31", "severity": "info"},
            {"type": "churn_risk", "message": "15 customers identified as high churn risk", "severity": "warning"}
        ],
        "recommendations": [
            "Add 2 extra slots for Delhi-Jaipur route on weekends",
            "Consider promotional pricing for June-July period",
            "Follow up with high-risk customers for retention"
        ]
    }
