from fastapi import APIRouter, Depends, Query
from database import get_database
from middleware import get_current_user
import re

router = APIRouter(prefix="/search", tags=["Global Search"])


@router.get("/global")
async def global_search(
    q: str = Query(..., min_length=1, max_length=100),
    limit: int = Query(20, ge=1, le=50),
    current_user: dict = Depends(get_current_user)
):
    """
    Global search across bookings, customers, operators, invoices, aircraft, pilots
    Returns categorized results for the universal search (Ctrl+K)
    """
    db = get_database()
    results = []
    search_term = q.strip()
    
    # Create regex pattern for case-insensitive search
    search_pattern = {"$regex": re.escape(search_term), "$options": "i"}
    
    user_roles = current_user.get("roles", [])
    is_admin = "admin" in user_roles
    is_operator = "operator" in user_roles
    is_customer = "customer" in user_roles
    
    # Determine which collections to search based on user role
    search_collections = []
    
    if is_admin:
        search_collections = ["bookings", "users", "operators", "invoices", "aircraft", "pilots", "inquiries"]
    elif is_operator:
        search_collections = ["bookings", "aircraft", "pilots", "inquiries"]
    elif is_customer:
        search_collections = ["bookings", "inquiries"]
    
    # Search Bookings
    if "bookings" in search_collections:
        try:
            booking_query = {
                "$or": [
                    {"booking_id": search_pattern},
                    {"customer_name": search_pattern},
                    {"customer_email": search_pattern},
                    {"departure_city": search_pattern},
                    {"arrival_city": search_pattern},
                    {"operator_name": search_pattern}
                ]
            }
            
            # Filter by operator if not admin
            if is_operator and not is_admin:
                operator = await db.operators.find_one({"user_id": current_user["id"]}, {"_id": 0, "id": 1})
                if operator:
                    booking_query["operator_id"] = operator["id"]
            elif is_customer and not is_admin:
                booking_query["customer_id"] = current_user["id"]
            
            bookings = await db.bookings.find(
                booking_query, 
                {"_id": 0, "booking_id": 1, "customer_name": 1, "departure_city": 1, "arrival_city": 1, "status": 1, "travel_date": 1}
            ).limit(5).to_list(5)
            
            for b in bookings:
                results.append({
                    "id": b.get("booking_id"),
                    "title": f"Booking #{b.get('booking_id', 'N/A')[:8]}",
                    "subtitle": f"{b.get('departure_city', '')} → {b.get('arrival_city', '')} • {b.get('customer_name', '')}",
                    "category": "bookings",
                    "path": f"/admin/bookings/{b.get('booking_id')}",
                    "status": b.get("status")
                })
        except Exception as e:
            print(f"Booking search error: {e}")
    
    # Search Customers (Users)
    if "users" in search_collections:
        try:
            users = await db.users.find(
                {
                    "$and": [
                        {"roles": "customer"},
                        {"$or": [
                            {"full_name": search_pattern},
                            {"email": search_pattern},
                            {"phone": search_pattern}
                        ]}
                    ]
                },
                {"_id": 0, "id": 1, "full_name": 1, "email": 1, "phone": 1}
            ).limit(5).to_list(5)
            
            for u in users:
                results.append({
                    "id": u.get("id"),
                    "title": u.get("full_name", "Unknown"),
                    "subtitle": f"{u.get('email', '')} • {u.get('phone', '')}",
                    "category": "customers",
                    "path": f"/admin/customers/{u.get('id')}"
                })
        except Exception as e:
            print(f"User search error: {e}")
    
    # Search Operators
    if "operators" in search_collections:
        try:
            operators = await db.operators.find(
                {
                    "$or": [
                        {"company_name": search_pattern},
                        {"contact_email": search_pattern},
                        {"contact_phone": search_pattern},
                        {"city": search_pattern}
                    ]
                },
                {"_id": 0, "id": 1, "company_name": 1, "contact_email": 1, "city": 1, "status": 1}
            ).limit(5).to_list(5)
            
            for o in operators:
                results.append({
                    "id": o.get("id"),
                    "title": o.get("company_name", "Unknown Operator"),
                    "subtitle": f"{o.get('city', '')} • {o.get('contact_email', '')}",
                    "category": "operators",
                    "path": f"/admin/operators/{o.get('id')}",
                    "status": o.get("status")
                })
        except Exception as e:
            print(f"Operator search error: {e}")
    
    # Search Invoices
    if "invoices" in search_collections:
        try:
            invoices = await db.invoices.find(
                {
                    "$or": [
                        {"invoice_number": search_pattern},
                        {"customer_name": search_pattern},
                        {"customer_email": search_pattern}
                    ]
                },
                {"_id": 0, "id": 1, "invoice_number": 1, "customer_name": 1, "total_amount": 1, "status": 1}
            ).limit(5).to_list(5)
            
            for inv in invoices:
                results.append({
                    "id": inv.get("id"),
                    "title": f"Invoice #{inv.get('invoice_number', 'N/A')}",
                    "subtitle": f"{inv.get('customer_name', '')} • ₹{inv.get('total_amount', 0):,.0f}",
                    "category": "invoices",
                    "path": f"/admin/invoices/{inv.get('id')}",
                    "status": inv.get("status")
                })
        except Exception as e:
            print(f"Invoice search error: {e}")
    
    # Search Aircraft
    if "aircraft" in search_collections:
        try:
            aircraft_query = {
                "$or": [
                    {"registration": search_pattern},
                    {"model": search_pattern},
                    {"type": search_pattern},
                    {"manufacturer": search_pattern}
                ]
            }
            
            if is_operator and not is_admin:
                operator = await db.operators.find_one({"user_id": current_user["id"]}, {"_id": 0, "id": 1})
                if operator:
                    aircraft_query["operator_id"] = operator["id"]
            
            aircraft = await db.aircraft.find(
                aircraft_query,
                {"_id": 0, "id": 1, "registration": 1, "model": 1, "type": 1, "capacity": 1}
            ).limit(5).to_list(5)
            
            for a in aircraft:
                results.append({
                    "id": a.get("id"),
                    "title": a.get("registration", "Unknown"),
                    "subtitle": f"{a.get('model', '')} • {a.get('type', '')} • {a.get('capacity', 0)} seats",
                    "category": "aircraft",
                    "path": f"/operator/fleet/{a.get('id')}"
                })
        except Exception as e:
            print(f"Aircraft search error: {e}")
    
    # Search Pilots
    if "pilots" in search_collections:
        try:
            pilot_query = {
                "$or": [
                    {"name": search_pattern},
                    {"license_number": search_pattern},
                    {"phone": search_pattern}
                ]
            }
            
            if is_operator and not is_admin:
                operator = await db.operators.find_one({"user_id": current_user["id"]}, {"_id": 0, "id": 1})
                if operator:
                    pilot_query["operator_id"] = operator["id"]
            
            pilots = await db.pilots.find(
                pilot_query,
                {"_id": 0, "id": 1, "name": 1, "license_number": 1, "phone": 1, "experience_years": 1}
            ).limit(5).to_list(5)
            
            for p in pilots:
                results.append({
                    "id": p.get("id"),
                    "title": p.get("name", "Unknown"),
                    "subtitle": f"License: {p.get('license_number', 'N/A')} • {p.get('experience_years', 0)} years exp",
                    "category": "pilots",
                    "path": f"/operator/pilots/{p.get('id')}"
                })
        except Exception as e:
            print(f"Pilot search error: {e}")
    
    # Search Inquiries
    if "inquiries" in search_collections:
        try:
            inquiry_query = {
                "$or": [
                    {"customer_name": search_pattern},
                    {"customer_email": search_pattern},
                    {"departure_city": search_pattern},
                    {"arrival_city": search_pattern}
                ]
            }
            
            if is_customer and not is_admin:
                inquiry_query["customer_id"] = current_user["id"]
            
            inquiries = await db.inquiries.find(
                inquiry_query,
                {"_id": 0, "id": 1, "customer_name": 1, "departure_city": 1, "arrival_city": 1, "status": 1}
            ).limit(5).to_list(5)
            
            for inq in inquiries:
                results.append({
                    "id": inq.get("id"),
                    "title": f"Inquiry: {inq.get('departure_city', '')} → {inq.get('arrival_city', '')}",
                    "subtitle": f"{inq.get('customer_name', '')} • {inq.get('status', '')}",
                    "category": "inquiries",
                    "path": f"/admin/inquiries/{inq.get('id')}"
                })
        except Exception as e:
            print(f"Inquiry search error: {e}")
    
    # Sort by relevance (exact matches first, then partial)
    def relevance_score(item):
        title = item.get("title", "").lower()
        subtitle = item.get("subtitle", "").lower()
        term = search_term.lower()
        
        if term == title:
            return 0
        elif title.startswith(term):
            return 1
        elif term in title:
            return 2
        elif term in subtitle:
            return 3
        return 4
    
    results.sort(key=relevance_score)
    
    return {
        "query": search_term,
        "results": results[:limit],
        "total": len(results)
    }
