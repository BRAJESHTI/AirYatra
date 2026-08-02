"""
Predictive Maintenance AI
AI-based maintenance alerts, pattern analysis, and predictions
"""
import random
from collections import defaultdict
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends

from database import get_database
from middleware import require_roles

router = APIRouter(prefix="/maintenance/ai", tags=["Predictive Maintenance AI"])


@router.get("/predictions")
async def get_maintenance_predictions(
    current_user: dict = Depends(require_roles(["admin", "ceo", "operator"]))
):
    """
    AI-based maintenance predictions
    - Hours-based predictions
    - Pattern analysis
    - Risk scoring
    """
    db = get_database()
    
    now = datetime.now(timezone.utc)
    
    # Get fleet data
    fleet = await db.fleet.find({"status": "active"}).to_list(500)
    maintenance_records = await db.maintenance_records.find({}).to_list(5000)
    flight_logs = await db.flight_logs.find({}).to_list(10000)
    
    # Aircraft maintenance analysis
    predictions = []
    high_risk_count = 0
    medium_risk_count = 0
    
    for aircraft in fleet:
        aircraft_id = aircraft.get("id") or str(aircraft.get("_id"))
        registration = aircraft.get("registration", "Unknown")
        aircraft_type = aircraft.get("type") or aircraft.get("aircraft_type", "Unknown")
        
        # Get flight hours
        total_hours = aircraft.get("total_flight_hours", 0)
        hours_since_maintenance = aircraft.get("hours_since_maintenance", 0)
        last_maintenance = aircraft.get("last_maintenance_date")
        
        # Calculate flight hours from logs if not available
        if total_hours == 0:
            aircraft_flights = [f for f in flight_logs if f.get("aircraft_id") == aircraft_id]
            total_hours = sum(f.get("flight_duration_hours", 1.5) for f in aircraft_flights)
        
        # Maintenance interval (100 hours standard for helicopters)
        maintenance_interval = 100
        hours_until_due = maintenance_interval - hours_since_maintenance
        
        # Risk calculation
        if hours_until_due <= 0:
            risk_level = "critical"
            risk_score = 95
            high_risk_count += 1
            recommendation = "OVERDUE - Schedule maintenance immediately"
        elif hours_until_due <= 10:
            risk_level = "high"
            risk_score = 80
            high_risk_count += 1
            recommendation = "Schedule maintenance within 5 flight hours"
        elif hours_until_due <= 25:
            risk_level = "medium"
            risk_score = 50
            medium_risk_count += 1
            recommendation = "Plan maintenance within 2 weeks"
        elif hours_until_due <= 50:
            risk_level = "low"
            risk_score = 25
            recommendation = "Maintenance due in ~1 month"
        else:
            risk_level = "optimal"
            risk_score = 10
            recommendation = "Aircraft in good condition"
        
        # Pattern analysis (simulated AI insights)
        patterns = []
        
        # Check for frequent issues (mock pattern detection)
        aircraft_maintenance = [m for m in maintenance_records if m.get("aircraft_id") == aircraft_id]
        if len(aircraft_maintenance) > 3:
            common_issues = defaultdict(int)
            for m in aircraft_maintenance:
                issue = m.get("maintenance_type", "General")
                common_issues[issue] += 1
            
            most_common = max(common_issues.items(), key=lambda x: x[1]) if common_issues else ("None", 0)
            if most_common[1] >= 2:
                patterns.append({
                    "type": "recurring_issue",
                    "description": f"Recurring {most_common[0]} issues detected ({most_common[1]} times)",
                    "severity": "medium"
                })
        
        # Seasonal pattern (more maintenance in monsoon)
        current_month = now.month
        if current_month in [6, 7, 8, 9]:  # Monsoon season
            patterns.append({
                "type": "seasonal",
                "description": "Monsoon season - increased humidity checks recommended",
                "severity": "info"
            })
        
        # Age-based recommendation
        manufacture_year = aircraft.get("manufacture_year", 2020)
        aircraft_age = now.year - manufacture_year
        if aircraft_age > 15:
            patterns.append({
                "type": "age_related",
                "description": f"Aircraft is {aircraft_age} years old - consider structural inspection",
                "severity": "medium"
            })
            risk_score = min(100, risk_score + 10)
        
        # Predicted next maintenance date
        avg_daily_hours = total_hours / max(1, (now - datetime(manufacture_year, 1, 1, tzinfo=timezone.utc)).days) * 365 / 365
        if avg_daily_hours > 0:
            days_until_due = hours_until_due / max(0.1, avg_daily_hours)
        else:
            days_until_due = 30
        
        predicted_date = now + timedelta(days=max(0, days_until_due))
        
        predictions.append({
            "aircraft_id": aircraft_id,
            "registration": registration,
            "aircraft_type": aircraft_type,
            "total_flight_hours": round(total_hours, 1),
            "hours_since_maintenance": round(hours_since_maintenance, 1),
            "hours_until_due": round(hours_until_due, 1),
            "risk_level": risk_level,
            "risk_score": risk_score,
            "recommendation": recommendation,
            "predicted_maintenance_date": predicted_date.strftime("%Y-%m-%d"),
            "patterns_detected": patterns,
            "last_maintenance": last_maintenance
        })
    
    # Sort by risk score (highest first)
    predictions.sort(key=lambda x: x["risk_score"], reverse=True)
    
    # Fleet health summary
    total_aircraft = len(predictions)
    healthy_count = len([p for p in predictions if p["risk_level"] in ["optimal", "low"]])
    
    return {
        "summary": {
            "total_aircraft": total_aircraft,
            "critical_alerts": high_risk_count,
            "medium_alerts": medium_risk_count,
            "healthy_aircraft": healthy_count,
            "fleet_health_score": round((healthy_count / max(1, total_aircraft)) * 100),
            "next_maintenance_due": predictions[0]["registration"] if predictions and predictions[0]["risk_score"] > 50 else None
        },
        "predictions": predictions,
        "ai_insights": [
            {
                "type": "trend",
                "title": "Maintenance Trend",
                "insight": f"{high_risk_count} aircraft need immediate attention",
                "action": "Review critical aircraft and schedule maintenance"
            },
            {
                "type": "optimization",
                "title": "Cost Optimization",
                "insight": "Group maintenance for aircraft due within 2 weeks to save 15% on hangar costs",
                "action": "Batch schedule maintenance"
            },
            {
                "type": "prediction",
                "title": "30-Day Forecast",
                "insight": f"Estimated {medium_risk_count + high_risk_count} maintenance events in next 30 days",
                "action": "Allocate budget and technician time"
            }
        ],
        "generated_at": now.isoformat()
    }


@router.get("/component-health")
async def get_component_health(
    current_user: dict = Depends(require_roles(["admin", "operator"]))
):
    """
    Component-level health monitoring
    - Engine hours
    - Rotor conditions
    - Avionics status
    """
    db = get_database()
    
    fleet = await db.fleet.find({"status": "active"}).to_list(500)
    
    component_health = []
    
    for aircraft in fleet:
        registration = aircraft.get("registration", "Unknown")
        
        # Simulated component data (in real scenario, this comes from aircraft sensors)
        components = {
            "engine": {
                "name": "Main Engine",
                "hours_used": aircraft.get("engine_hours", random.randint(500, 2000)),
                "max_hours": 3000,
                "condition": "good",
                "last_inspection": "2026-07-15"
            },
            "main_rotor": {
                "name": "Main Rotor Assembly",
                "hours_used": aircraft.get("rotor_hours", random.randint(400, 1500)),
                "max_hours": 2500,
                "condition": "good",
                "last_inspection": "2026-07-20"
            },
            "tail_rotor": {
                "name": "Tail Rotor",
                "hours_used": random.randint(400, 1500),
                "max_hours": 2500,
                "condition": "good",
                "last_inspection": "2026-07-20"
            },
            "transmission": {
                "name": "Main Gearbox",
                "hours_used": random.randint(600, 2000),
                "max_hours": 4000,
                "condition": "good",
                "last_inspection": "2026-06-10"
            },
            "avionics": {
                "name": "Avionics Suite",
                "hours_used": random.randint(800, 3000),
                "max_hours": 5000,
                "condition": "good",
                "last_inspection": "2026-08-01"
            }
        }
        
        # Calculate health percentage and update condition
        for comp in components.values():
            health_pct = round(100 - (comp["hours_used"] / comp["max_hours"]) * 100)
            comp["health_percentage"] = max(0, health_pct)
            
            if health_pct <= 20:
                comp["condition"] = "critical"
            elif health_pct <= 40:
                comp["condition"] = "fair"
            elif health_pct <= 60:
                comp["condition"] = "good"
            else:
                comp["condition"] = "excellent"
        
        component_health.append({
            "aircraft_id": str(aircraft.get("id") or aircraft.get("_id")),
            "registration": registration,
            "components": components,
            "overall_health": round(sum(c["health_percentage"] for c in components.values()) / len(components))
        })
    
    return {
        "aircraft_components": component_health,
        "component_types": ["engine", "main_rotor", "tail_rotor", "transmission", "avionics"],
        "generated_at": datetime.now(timezone.utc).isoformat()
    }


@router.get("/cost-forecast")
async def get_maintenance_cost_forecast(
    months: int = 6,
    current_user: dict = Depends(require_roles(["admin", "ceo"]))
):
    """
    Maintenance cost forecasting
    - Monthly cost predictions
    - Budget recommendations
    """
    db = get_database()
    
    now = datetime.now(timezone.utc)
    
    # Get historical maintenance costs
    maintenance_records = await db.maintenance_records.find({}).to_list(1000)
    fleet_count = await db.fleet.count_documents({"status": "active"})
    
    # Calculate average monthly cost
    monthly_costs = defaultdict(float)
    for record in maintenance_records:
        try:
            date_str = record.get("completed_at") or record.get("created_at")
            if date_str:
                if isinstance(date_str, str):
                    date_obj = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
                else:
                    date_obj = date_str
                month_key = date_obj.strftime("%Y-%m")
                cost = record.get("actual_cost", 0) or record.get("estimated_cost", 50000)
                monthly_costs[month_key] += cost
        except:
            pass
    
    # Average monthly cost
    if monthly_costs:
        avg_monthly_cost = sum(monthly_costs.values()) / len(monthly_costs)
    else:
        avg_monthly_cost = fleet_count * 75000  # Default estimate per aircraft
    
    # Generate forecast
    forecast = []
    for i in range(months):
        future_date = now + timedelta(days=30 * (i + 1))
        
        # Seasonal adjustment (monsoon = higher costs)
        month = future_date.month
        seasonal_factor = 1.2 if month in [6, 7, 8, 9] else 1.0
        
        # Random variation (+/- 15%)
        variation = random.uniform(0.85, 1.15)
        
        predicted_cost = round(avg_monthly_cost * seasonal_factor * variation)
        
        forecast.append({
            "month": future_date.strftime("%B %Y"),
            "month_key": future_date.strftime("%Y-%m"),
            "predicted_cost": predicted_cost,
            "seasonal_factor": seasonal_factor,
            "confidence": "high" if i < 2 else "medium" if i < 4 else "low"
        })
    
    total_forecast = sum(f["predicted_cost"] for f in forecast)
    
    return {
        "forecast": forecast,
        "summary": {
            "total_forecast_cost": total_forecast,
            "avg_monthly_cost": round(avg_monthly_cost),
            "forecast_period_months": months,
            "fleet_size": fleet_count,
            "cost_per_aircraft": round(total_forecast / max(1, fleet_count) / months)
        },
        "budget_recommendations": [
            {
                "category": "Routine Maintenance",
                "percentage": 60,
                "amount": round(total_forecast * 0.6)
            },
            {
                "category": "Emergency Repairs",
                "percentage": 20,
                "amount": round(total_forecast * 0.2)
            },
            {
                "category": "Parts & Inventory",
                "percentage": 15,
                "amount": round(total_forecast * 0.15)
            },
            {
                "category": "Contingency",
                "percentage": 5,
                "amount": round(total_forecast * 0.05)
            }
        ],
        "generated_at": now.isoformat()
    }


@router.post("/schedule-recommendation")
async def get_schedule_recommendation(
    aircraft_ids: list | None = None,
    current_user: dict = Depends(require_roles(["admin", "operator"]))
):
    """
    AI-recommended maintenance schedule
    - Optimal timing
    - Resource allocation
    """
    get_database()
    
    now = datetime.now(timezone.utc)
    
    # Get predictions
    predictions_data = await get_maintenance_predictions(current_user)
    predictions = predictions_data["predictions"]
    
    if aircraft_ids:
        predictions = [p for p in predictions if p["aircraft_id"] in aircraft_ids]
    
    # Generate schedule recommendations
    schedule = []
    
    # Group by urgency
    critical = [p for p in predictions if p["risk_level"] == "critical"]
    high = [p for p in predictions if p["risk_level"] == "high"]
    medium = [p for p in predictions if p["risk_level"] == "medium"]
    
    # Schedule critical within 3 days
    for idx, aircraft in enumerate(critical):
        schedule.append({
            "aircraft_id": aircraft["aircraft_id"],
            "registration": aircraft["registration"],
            "recommended_date": (now + timedelta(days=idx + 1)).strftime("%Y-%m-%d"),
            "priority": "critical",
            "estimated_duration_hours": 8,
            "estimated_cost": 150000,
            "reason": aircraft["recommendation"]
        })
    
    # Schedule high within 2 weeks
    for idx, aircraft in enumerate(high):
        schedule.append({
            "aircraft_id": aircraft["aircraft_id"],
            "registration": aircraft["registration"],
            "recommended_date": (now + timedelta(days=3 + idx * 2)).strftime("%Y-%m-%d"),
            "priority": "high",
            "estimated_duration_hours": 6,
            "estimated_cost": 100000,
            "reason": aircraft["recommendation"]
        })
    
    # Schedule medium within month
    for idx, aircraft in enumerate(medium):
        schedule.append({
            "aircraft_id": aircraft["aircraft_id"],
            "registration": aircraft["registration"],
            "recommended_date": (now + timedelta(days=14 + idx * 3)).strftime("%Y-%m-%d"),
            "priority": "medium",
            "estimated_duration_hours": 4,
            "estimated_cost": 75000,
            "reason": aircraft["recommendation"]
        })
    
    total_cost = sum(s["estimated_cost"] for s in schedule)
    total_hours = sum(s["estimated_duration_hours"] for s in schedule)
    
    return {
        "recommended_schedule": schedule,
        "summary": {
            "total_aircraft": len(schedule),
            "critical_count": len(critical),
            "total_estimated_cost": total_cost,
            "total_labor_hours": total_hours,
            "recommended_technicians": max(1, total_hours // 40)  # 40 hours per technician per week
        },
        "optimization_tips": [
            "Consider batching critical aircraft maintenance to reduce setup time",
            "Order common parts in bulk for 10-15% savings",
            "Schedule medium priority during low-demand periods"
        ],
        "generated_at": now.isoformat()
    }
