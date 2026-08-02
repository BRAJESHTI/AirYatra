"""
Route Intelligence Engine
Popular routes analysis, demand heatmap, profit per route, seasonal trends
"""
from collections import defaultdict
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends

from database import get_database
from middleware import require_roles

router = APIRouter(prefix="/analytics/routes", tags=["Route Intelligence"])


@router.get("/intelligence")
async def get_route_intelligence(
    current_user: dict = Depends(require_roles(["admin", "ceo", "operator"]))
):
    """
    Comprehensive route intelligence dashboard
    - Popular routes by bookings
    - Revenue per route
    - Demand trends
    - Seasonal patterns
    """
    db = get_database()
    
    now = datetime.now(timezone.utc)
    now - timedelta(days=180)
    now - timedelta(days=365)
    
    # Get all bookings and inquiries
    bookings = await db.bookings.find({}).to_list(5000)
    inquiries = await db.customer_inquiries.find({}).to_list(5000)
    
    # Combine for route analysis
    all_trips = []
    for b in bookings:
        all_trips.append({
            "from": b.get("departure_city") or b.get("from_location", ""),
            "to": b.get("arrival_city") or b.get("to_location", ""),
            "amount": b.get("total_amount", 0) or b.get("quoted_amount", 0),
            "date": b.get("created_at") or b.get("departure_date"),
            "status": b.get("status", ""),
            "payment_status": b.get("payment_status", "")
        })
    
    for inq in inquiries:
        if inq.get("status") in ["accepted", "paid", "completed"]:
            all_trips.append({
                "from": inq.get("from_location", ""),
                "to": inq.get("to_location", ""),
                "amount": inq.get("quoted_amount", 0) or inq.get("estimated_price", 0),
                "date": inq.get("created_at"),
                "status": inq.get("status", ""),
                "payment_status": inq.get("payment_status", "")
            })
    
    # Route aggregation
    route_stats = defaultdict(lambda: {
        "bookings": 0,
        "revenue": 0,
        "paid_bookings": 0,
        "avg_price": 0,
        "monthly_trend": defaultdict(int),
        "seasonal": {"Q1": 0, "Q2": 0, "Q3": 0, "Q4": 0}
    })
    
    for trip in all_trips:
        from_city = trip["from"].strip().title() if trip["from"] else "Unknown"
        to_city = trip["to"].strip().title() if trip["to"] else "Unknown"
        
        if from_city == "Unknown" or to_city == "Unknown":
            continue
            
        route_key = f"{from_city} → {to_city}"
        
        route_stats[route_key]["bookings"] += 1
        route_stats[route_key]["revenue"] += trip["amount"] or 0
        
        if trip["payment_status"] == "paid":
            route_stats[route_key]["paid_bookings"] += 1
        
        # Monthly trend
        try:
            if trip["date"]:
                if isinstance(trip["date"], str):
                    date_obj = datetime.fromisoformat(trip["date"].replace("Z", "+00:00"))
                else:
                    date_obj = trip["date"]
                
                month_key = date_obj.strftime("%Y-%m")
                route_stats[route_key]["monthly_trend"][month_key] += 1
                
                # Seasonal (Q1=Jan-Mar, Q2=Apr-Jun, Q3=Jul-Sep, Q4=Oct-Dec)
                quarter = f"Q{(date_obj.month - 1) // 3 + 1}"
                route_stats[route_key]["seasonal"][quarter] += 1
        except:
            pass
    
    # Calculate averages and sort
    popular_routes = []
    for route, stats in route_stats.items():
        if stats["bookings"] > 0:
            stats["avg_price"] = round(stats["revenue"] / stats["bookings"])
            stats["conversion_rate"] = round((stats["paid_bookings"] / stats["bookings"]) * 100, 1)
            
            # Find peak season
            peak_season = max(stats["seasonal"], key=stats["seasonal"].get)
            stats["peak_season"] = peak_season
            
            popular_routes.append({
                "route": route,
                "from_city": route.split(" → ")[0],
                "to_city": route.split(" → ")[1],
                **stats,
                "monthly_trend": dict(stats["monthly_trend"])
            })
    
    # Sort by bookings
    popular_routes.sort(key=lambda x: x["bookings"], reverse=True)
    
    # Top 10 routes
    top_routes = popular_routes[:10]
    
    # Revenue leaders (top 5 by revenue)
    revenue_leaders = sorted(popular_routes, key=lambda x: x["revenue"], reverse=True)[:5]
    
    # Emerging routes (low bookings but recent activity)
    emerging_routes = [r for r in popular_routes if r["bookings"] >= 2 and r["bookings"] <= 10][:5]
    
    # Demand heatmap data (city-wise)
    city_demand = defaultdict(lambda: {"outbound": 0, "inbound": 0, "total": 0})
    for route in popular_routes:
        city_demand[route["from_city"]]["outbound"] += route["bookings"]
        city_demand[route["from_city"]]["total"] += route["bookings"]
        city_demand[route["to_city"]]["inbound"] += route["bookings"]
        city_demand[route["to_city"]]["total"] += route["bookings"]
    
    # Sort cities by demand
    demand_heatmap = [
        {"city": city, **data}
        for city, data in sorted(city_demand.items(), key=lambda x: x[1]["total"], reverse=True)
    ][:15]
    
    # Seasonal trends (overall)
    overall_seasonal = {"Q1": 0, "Q2": 0, "Q3": 0, "Q4": 0}
    for route in popular_routes:
        for q in ["Q1", "Q2", "Q3", "Q4"]:
            overall_seasonal[q] += route["seasonal"][q]
    
    # Monthly trend (last 6 months)
    monthly_trend = defaultdict(int)
    for route in popular_routes:
        for month, count in route["monthly_trend"].items():
            monthly_trend[month] += count
    
    # Sort and get last 6 months
    sorted_months = sorted(monthly_trend.items())[-6:]
    
    # Summary stats
    total_routes = len(popular_routes)
    total_bookings = sum(r["bookings"] for r in popular_routes)
    total_revenue = sum(r["revenue"] for r in popular_routes)
    avg_route_revenue = round(total_revenue / total_routes) if total_routes > 0 else 0
    
    return {
        "summary": {
            "total_routes": total_routes,
            "total_bookings": total_bookings,
            "total_revenue": total_revenue,
            "avg_route_revenue": avg_route_revenue,
            "top_route": top_routes[0]["route"] if top_routes else None,
            "peak_season": max(overall_seasonal, key=overall_seasonal.get)
        },
        "top_routes": top_routes,
        "revenue_leaders": revenue_leaders,
        "emerging_routes": emerging_routes,
        "demand_heatmap": demand_heatmap,
        "seasonal_trends": overall_seasonal,
        "monthly_trend": [{"month": m, "bookings": c} for m, c in sorted_months],
        "generated_at": now.isoformat()
    }


@router.get("/profit-analysis")
async def get_route_profit_analysis(
    current_user: dict = Depends(require_roles(["admin", "ceo"]))
):
    """
    Profit analysis per route
    - Revenue vs estimated costs
    - Profit margins
    - Cost breakdown
    """
    db = get_database()
    
    # Get paid inquiries with pricing
    paid_inquiries = await db.customer_inquiries.find({
        "payment_status": "paid"
    }).to_list(2000)
    
    # Get operator pricing for cost estimation
    await db.operator_pricing.find({}).to_list(100)
    
    # Default cost assumptions (can be configured)
    DEFAULT_COST_PER_KM = 150  # ₹ per km operating cost
    PLATFORM_FEE_PERCENT = 15
    GST_PERCENT = 18
    
    route_profits = defaultdict(lambda: {
        "revenue": 0,
        "estimated_cost": 0,
        "platform_fee": 0,
        "gst": 0,
        "net_profit": 0,
        "bookings": 0,
        "avg_distance": 0,
        "total_distance": 0
    })
    
    for inq in paid_inquiries:
        from_city = (inq.get("from_location") or "").strip().title()
        to_city = (inq.get("to_location") or "").strip().title()
        
        if not from_city or not to_city:
            continue
        
        route_key = f"{from_city} → {to_city}"
        amount = inq.get("quoted_amount", 0) or 0
        distance = inq.get("distance_km", 100)  # Default 100km if not specified
        
        # Calculate costs
        operating_cost = distance * DEFAULT_COST_PER_KM
        platform_fee = amount * (PLATFORM_FEE_PERCENT / 100)
        gst = amount * (GST_PERCENT / 100)
        net_profit = amount - operating_cost - gst
        
        route_profits[route_key]["revenue"] += amount
        route_profits[route_key]["estimated_cost"] += operating_cost
        route_profits[route_key]["platform_fee"] += platform_fee
        route_profits[route_key]["gst"] += gst
        route_profits[route_key]["net_profit"] += net_profit
        route_profits[route_key]["bookings"] += 1
        route_profits[route_key]["total_distance"] += distance
    
    # Calculate averages and margins
    profit_analysis = []
    for route, data in route_profits.items():
        if data["bookings"] > 0:
            data["avg_distance"] = round(data["total_distance"] / data["bookings"])
            data["profit_margin"] = round((data["net_profit"] / data["revenue"]) * 100, 1) if data["revenue"] > 0 else 0
            data["avg_profit_per_booking"] = round(data["net_profit"] / data["bookings"])
            
            profit_analysis.append({
                "route": route,
                **data
            })
    
    # Sort by net profit
    profit_analysis.sort(key=lambda x: x["net_profit"], reverse=True)
    
    # Most profitable routes
    most_profitable = profit_analysis[:5]
    
    # Least profitable (potential optimization needed)
    least_profitable = sorted(profit_analysis, key=lambda x: x["profit_margin"])[:5]
    
    # Summary
    total_revenue = sum(r["revenue"] for r in profit_analysis)
    total_profit = sum(r["net_profit"] for r in profit_analysis)
    avg_margin = round((total_profit / total_revenue) * 100, 1) if total_revenue > 0 else 0
    
    return {
        "summary": {
            "total_revenue": total_revenue,
            "total_profit": total_profit,
            "avg_profit_margin": avg_margin,
            "total_routes_analyzed": len(profit_analysis),
            "cost_assumptions": {
                "cost_per_km": DEFAULT_COST_PER_KM,
                "platform_fee_percent": PLATFORM_FEE_PERCENT,
                "gst_percent": GST_PERCENT
            }
        },
        "most_profitable_routes": most_profitable,
        "needs_optimization": least_profitable,
        "all_routes": profit_analysis[:20],
        "generated_at": datetime.now(timezone.utc).isoformat()
    }


@router.get("/demand-forecast")
async def get_demand_forecast(
    current_user: dict = Depends(require_roles(["admin", "ceo", "operator"]))
):
    """
    Demand forecasting based on historical patterns
    - Next 30 days prediction
    - Peak periods
    - Recommended pricing adjustments
    """
    db = get_database()
    
    now = datetime.now(timezone.utc)
    
    # Get historical booking data
    bookings = await db.bookings.find({}).to_list(5000)
    inquiries = await db.customer_inquiries.find({}).to_list(5000)
    
    # Analyze day-of-week patterns
    dow_pattern = defaultdict(int)
    month_pattern = defaultdict(int)
    
    for b in bookings + inquiries:
        try:
            date_str = b.get("created_at") or b.get("departure_date")
            if date_str:
                if isinstance(date_str, str):
                    date_obj = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
                else:
                    date_obj = date_str
                
                dow_pattern[date_obj.strftime("%A")] += 1
                month_pattern[date_obj.strftime("%B")] += 1
        except:
            pass
    
    # Peak days
    peak_days = sorted(dow_pattern.items(), key=lambda x: x[1], reverse=True)
    
    # Peak months
    peak_months = sorted(month_pattern.items(), key=lambda x: x[1], reverse=True)
    
    # Upcoming events/festivals (hardcoded for India)
    upcoming_events = []
    current_month = now.month
    
    festivals = {
        1: [("Makar Sankranti", 14), ("Republic Day", 26)],
        2: [("Valentine's Day", 14)],
        3: [("Holi", 25)],
        4: [("Ram Navami", 17)],
        5: [("Buddha Purnima", 23)],
        8: [("Independence Day", 15), ("Raksha Bandhan", 19)],
        9: [("Ganesh Chaturthi", 7)],
        10: [("Dussehra", 12), ("Diwali", 31)],
        11: [("Guru Nanak Jayanti", 15)],
        12: [("Christmas", 25), ("New Year Eve", 31)]
    }
    
    # Get events for next 2 months
    for month_offset in range(3):
        check_month = (current_month + month_offset - 1) % 12 + 1
        if check_month in festivals:
            for event_name, day in festivals[check_month]:
                year = now.year if check_month >= current_month else now.year + 1
                event_date = datetime(year, check_month, day)
                if event_date > now:
                    upcoming_events.append({
                        "name": event_name,
                        "date": event_date.strftime("%Y-%m-%d"),
                        "days_away": (event_date - now).days,
                        "expected_demand": "High" if event_name in ["Diwali", "Holi", "Christmas", "Independence Day"] else "Medium"
                    })
    
    upcoming_events.sort(key=lambda x: x["days_away"])
    
    # Pricing recommendations
    pricing_recommendations = []
    
    # High demand days
    for day, count in peak_days[:3]:
        pricing_recommendations.append({
            "trigger": f"{day}s (Peak Day)",
            "recommendation": "Increase base price by 10-15%",
            "reason": f"Historical high demand: {count} bookings"
        })
    
    # Festival periods
    for event in upcoming_events[:3]:
        if event["expected_demand"] == "High":
            pricing_recommendations.append({
                "trigger": f"{event['name']} ({event['date']})",
                "recommendation": "Surge pricing 20-30%",
                "reason": "Festival/holiday period"
            })
    
    # Low demand periods
    for day, count in peak_days[-2:]:
        pricing_recommendations.append({
            "trigger": f"{day}s (Low Demand)",
            "recommendation": "Offer 5-10% discount",
            "reason": f"Lower demand: {count} bookings"
        })
    
    return {
        "day_of_week_pattern": [{"day": d, "bookings": c} for d, c in peak_days],
        "monthly_pattern": [{"month": m, "bookings": c} for m, c in peak_months],
        "upcoming_high_demand_events": upcoming_events[:5],
        "pricing_recommendations": pricing_recommendations,
        "forecast_summary": {
            "peak_day": peak_days[0][0] if peak_days else "N/A",
            "peak_month": peak_months[0][0] if peak_months else "N/A",
            "next_high_demand_event": upcoming_events[0]["name"] if upcoming_events else "None upcoming"
        },
        "generated_at": now.isoformat()
    }
