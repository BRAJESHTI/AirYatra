"""
AI Reverse Auction Routes - Mode 2 Smart Pricing
AirYatra Aviation OS

This module implements the reverse auction system where:
1. Customer creates an auction request for a custom route
2. System notifies relevant operators
3. Operators submit competitive quotes within a time window (default 5 minutes)
4. Customer can view all quotes and select the best one
5. Selected quote becomes a confirmed booking

Collections:
- auctions: Auction requests from customers
- auction_quotes: Quotes submitted by operators
"""

from fastapi import APIRouter, HTTPException, Depends, Query, BackgroundTasks
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, timedelta, timezone
from bson import ObjectId
import uuid

from database import get_database
from middleware import get_current_user, require_roles

router = APIRouter(prefix="/auctions", tags=["Reverse Auction"])


# ============ MODELS ============

class AuctionRequest(BaseModel):
    """Customer's auction request for a custom route"""
    # Route Details
    origin: str
    origin_type: str = "city"  # city, airport, helipad, coordinates
    destination: str
    destination_type: str = "city"
    
    # Flight Details
    travel_date: str  # YYYY-MM-DD
    travel_time: Optional[str] = None  # HH:MM (preferred time)
    return_date: Optional[str] = None  # For round trips
    flight_type: str = "one_way"  # one_way, round_trip
    
    # Passengers & Aircraft
    passengers: int = Field(ge=1, le=20)
    aircraft_category: str = "helicopter"  # helicopter, light_jet, mid_jet, heavy_jet
    preferred_aircraft: Optional[str] = None  # Specific aircraft model preference
    
    # Special Requirements
    luggage_kg: Optional[int] = 0
    special_requirements: Optional[str] = None
    purpose: Optional[str] = None  # business, medical, tourism, pilgrimage
    
    # Auction Settings
    auction_duration_minutes: int = Field(default=5, ge=3, le=30)  # 3-30 minutes
    max_budget: Optional[float] = None  # Customer's max budget (optional)
    
    # Contact
    contact_name: str
    contact_phone: str
    contact_email: Optional[str] = None


class OperatorQuote(BaseModel):
    """Operator's quote for an auction"""
    # Aircraft Details
    aircraft_id: Optional[str] = None
    aircraft_type: str
    aircraft_model: str
    aircraft_registration: Optional[str] = None
    
    # Pricing Breakdown
    base_price: float = Field(ge=0)
    landing_charges: float = Field(default=0, ge=0)
    handling_charges: float = Field(default=0, ge=0)
    crew_charges: float = Field(default=0, ge=0)
    fuel_surcharge: float = Field(default=0, ge=0)
    other_charges: float = Field(default=0, ge=0)
    discount: float = Field(default=0, ge=0)
    
    # Flight Details
    estimated_flight_time: Optional[str] = None  # e.g., "1h 30m"
    departure_time: Optional[str] = None  # Proposed departure time
    
    # Validity
    quote_valid_hours: int = Field(default=24, ge=1, le=72)
    
    # Notes
    operator_notes: Optional[str] = None
    terms_conditions: Optional[str] = None


class QuoteSelection(BaseModel):
    """Customer's quote selection"""
    quote_id: str
    customer_notes: Optional[str] = None


# ============ CONSTANTS ============

AUCTION_STATUS = {
    "active": "active",           # Auction is live, accepting quotes
    "closed": "closed",           # Time expired, no quote selected
    "quote_selected": "quote_selected",  # Customer selected a quote
    "confirmed": "confirmed",     # Booking confirmed after payment
    "cancelled": "cancelled",     # Auction cancelled by customer
    "expired": "expired"          # No quotes received, expired
}

QUOTE_STATUS = {
    "pending": "pending",         # Quote submitted, awaiting selection
    "selected": "selected",       # Customer selected this quote
    "rejected": "rejected",       # Customer selected another quote
    "withdrawn": "withdrawn",     # Operator withdrew quote
    "expired": "expired"          # Auction expired without selection
}


# ============ HELPER FUNCTIONS ============

def calculate_quote_total(quote: dict) -> float:
    """Calculate total quote amount including GST"""
    subtotal = (
        quote.get("base_price", 0) +
        quote.get("landing_charges", 0) +
        quote.get("handling_charges", 0) +
        quote.get("crew_charges", 0) +
        quote.get("fuel_surcharge", 0) +
        quote.get("other_charges", 0) -
        quote.get("discount", 0)
    )
    gst = subtotal * 0.18  # 18% GST
    return round(subtotal + gst, 2)


def get_time_remaining(end_time: datetime) -> dict:
    """Calculate time remaining for auction"""
    now = datetime.now(timezone.utc)
    if isinstance(end_time, str):
        end_time = datetime.fromisoformat(end_time.replace('Z', '+00:00'))
    
    remaining = end_time - now
    
    if remaining.total_seconds() <= 0:
        return {"expired": True, "minutes": 0, "seconds": 0}
    
    minutes = int(remaining.total_seconds() // 60)
    seconds = int(remaining.total_seconds() % 60)
    
    return {
        "expired": False,
        "minutes": minutes,
        "seconds": seconds,
        "total_seconds": int(remaining.total_seconds())
    }


async def notify_operators_new_auction(auction: dict):
    """
    Send notifications to relevant operators about new auction
    In production, this would:
    - Send push notifications
    - Send SMS/WhatsApp alerts
    - Send email notifications
    For now, we'll just mark the auction as notified
    """
    db = get_database()
    
    # Find operators who can serve this route/aircraft category
    # Match both status field patterns (status="active" or is_active=true)
    operators = await db.users.find(
        {
            "roles": {"$in": ["operator"]},
            "$or": [
                {"status": "active"},
                {"status": {"$exists": False}, "is_active": True},
                {"is_active": True}
            ]
        },
        {"_id": 0, "id": 1, "email": 1, "name": 1}
    ).to_list(100)
    
    # In production: Send actual notifications here
    # For demo: Just log and update auction
    
    await db.auctions.update_one(
        {"id": auction["id"]},
        {
            "$set": {
                "operators_notified": len(operators),
                "notification_sent_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    return len(operators)


# ============ CUSTOMER ENDPOINTS ============

@router.post("/create")
async def create_auction(
    request: AuctionRequest,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    """
    Customer creates a new reverse auction for a custom route
    """
    db = get_database()
    
    # Validate travel date is in future
    travel_date = datetime.strptime(request.travel_date, "%Y-%m-%d")
    if travel_date.date() < datetime.now().date():
        raise HTTPException(status_code=400, detail="Travel date must be in the future")
    
    # Check for existing active auctions for same route/date by this user
    existing = await db.auctions.find_one({
        "customer_id": current_user["id"],
        "origin": request.origin,
        "destination": request.destination,
        "travel_date": request.travel_date,
        "status": "active"
    })
    
    if existing:
        raise HTTPException(
            status_code=400, 
            detail="You already have an active auction for this route and date"
        )
    
    # Calculate auction end time
    now = datetime.now(timezone.utc)
    end_time = now + timedelta(minutes=request.auction_duration_minutes)
    
    # Create auction document
    auction = {
        "id": str(uuid.uuid4()),
        "auction_number": f"AUC-{datetime.now().strftime('%Y%m%d')}-{str(uuid.uuid4())[:6].upper()}",
        
        # Customer Info
        "customer_id": current_user["id"],
        "customer_name": current_user.get("name", request.contact_name),
        "customer_email": current_user.get("email", request.contact_email),
        "contact_name": request.contact_name,
        "contact_phone": request.contact_phone,
        "contact_email": request.contact_email,
        
        # Route Details
        "origin": request.origin,
        "origin_type": request.origin_type,
        "destination": request.destination,
        "destination_type": request.destination_type,
        
        # Flight Details
        "travel_date": request.travel_date,
        "travel_time": request.travel_time,
        "return_date": request.return_date,
        "flight_type": request.flight_type,
        
        # Passengers & Aircraft
        "passengers": request.passengers,
        "aircraft_category": request.aircraft_category,
        "preferred_aircraft": request.preferred_aircraft,
        
        # Special Requirements
        "luggage_kg": request.luggage_kg,
        "special_requirements": request.special_requirements,
        "purpose": request.purpose,
        
        # Auction Settings
        "auction_duration_minutes": request.auction_duration_minutes,
        "max_budget": request.max_budget,
        
        # Timing
        "created_at": now.isoformat(),
        "start_time": now.isoformat(),
        "end_time": end_time.isoformat(),
        
        # Status
        "status": AUCTION_STATUS["active"],
        "quotes_count": 0,
        "selected_quote_id": None,
        "operators_notified": 0,
        
        # Metadata
        "mode": "reverse_auction",
        "version": "1.0"
    }
    
    await db.auctions.insert_one(auction)
    
    # Notify operators in background
    background_tasks.add_task(notify_operators_new_auction, auction)
    
    return {
        "success": True,
        "auction_id": auction["id"],
        "auction_number": auction["auction_number"],
        "end_time": auction["end_time"],
        "duration_minutes": request.auction_duration_minutes,
        "message": f"Auction created! Operators will be notified. You have {request.auction_duration_minutes} minutes to receive quotes."
    }


@router.get("/customer/active")
async def get_customer_active_auctions(
    current_user: dict = Depends(get_current_user)
):
    """
    Get all active auctions for the current customer
    """
    db = get_database()
    
    auctions = await db.auctions.find(
        {
            "customer_id": current_user["id"],
            "status": {"$in": ["active", "quote_selected"]}
        },
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    
    # Add time remaining and quotes count for each auction
    for auction in auctions:
        auction["time_remaining"] = get_time_remaining(auction["end_time"])
        
        # Get quotes for this auction
        quotes = await db.auction_quotes.find(
            {"auction_id": auction["id"], "status": {"$ne": "withdrawn"}},
            {"_id": 0}
        ).sort("total_amount", 1).to_list(50)
        
        auction["quotes"] = quotes
        auction["quotes_count"] = len(quotes)
        
        if quotes:
            auction["lowest_quote"] = quotes[0]["total_amount"]
            auction["highest_quote"] = quotes[-1]["total_amount"]
    
    return {
        "auctions": auctions,
        "count": len(auctions)
    }


@router.get("/customer/history")
async def get_customer_auction_history(
    status: Optional[str] = None,
    limit: int = Query(default=20, le=100),
    current_user: dict = Depends(get_current_user)
):
    """
    Get auction history for the current customer
    """
    db = get_database()
    
    query = {"customer_id": current_user["id"]}
    if status:
        query["status"] = status
    
    auctions = await db.auctions.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).to_list(limit)
    
    # Add quotes count
    for auction in auctions:
        quotes_count = await db.auction_quotes.count_documents({"auction_id": auction["id"]})
        auction["quotes_count"] = quotes_count
    
    return {
        "auctions": auctions,
        "count": len(auctions)
    }


@router.get("/{auction_id}")
async def get_auction_details(
    auction_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Get detailed auction information including all quotes
    Customer sees all quotes, Operator sees only their quote
    """
    db = get_database()
    
    auction = await db.auctions.find_one(
        {"id": auction_id},
        {"_id": 0}
    )
    
    if not auction:
        raise HTTPException(status_code=404, detail="Auction not found")
    
    # Check access permissions
    is_customer = auction["customer_id"] == current_user["id"]
    is_operator = "operator" in current_user.get("roles", [])
    is_admin = "admin" in current_user.get("roles", [])
    
    if not (is_customer or is_operator or is_admin):
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Add time remaining
    auction["time_remaining"] = get_time_remaining(auction["end_time"])
    
    # Get quotes based on role
    if is_customer or is_admin:
        # Customer/Admin sees all quotes
        quotes = await db.auction_quotes.find(
            {"auction_id": auction_id},
            {"_id": 0}
        ).sort("total_amount", 1).to_list(50)
    else:
        # Operator sees only their quote
        quotes = await db.auction_quotes.find(
            {"auction_id": auction_id, "operator_id": current_user["id"]},
            {"_id": 0}
        ).to_list(5)
    
    auction["quotes"] = quotes
    auction["quotes_count"] = len(quotes) if is_customer or is_admin else await db.auction_quotes.count_documents({"auction_id": auction_id})
    
    # If customer and quotes exist, highlight best quote
    if is_customer and quotes:
        auction["lowest_quote"] = quotes[0]["total_amount"]
        auction["recommended_quote_id"] = quotes[0]["id"]
    
    return auction


@router.post("/{auction_id}/select-quote")
async def select_quote(
    auction_id: str,
    selection: QuoteSelection,
    current_user: dict = Depends(get_current_user)
):
    """
    Customer selects a quote from the auction
    """
    db = get_database()
    
    # Get auction
    auction = await db.auctions.find_one({"id": auction_id}, {"_id": 0})
    
    if not auction:
        raise HTTPException(status_code=404, detail="Auction not found")
    
    if auction["customer_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Only the auction owner can select a quote")
    
    if auction["status"] != "active":
        raise HTTPException(status_code=400, detail=f"Auction is {auction['status']}, cannot select quote")
    
    # Get the selected quote
    quote = await db.auction_quotes.find_one(
        {"id": selection.quote_id, "auction_id": auction_id},
        {"_id": 0}
    )
    
    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found")
    
    if quote["status"] != "pending":
        raise HTTPException(status_code=400, detail=f"Quote is {quote['status']}, cannot select")
    
    now = datetime.now(timezone.utc).isoformat()
    
    # Update selected quote status
    await db.auction_quotes.update_one(
        {"id": selection.quote_id},
        {
            "$set": {
                "status": QUOTE_STATUS["selected"],
                "selected_at": now
            }
        }
    )
    
    # Reject all other quotes
    await db.auction_quotes.update_many(
        {"auction_id": auction_id, "id": {"$ne": selection.quote_id}},
        {
            "$set": {
                "status": QUOTE_STATUS["rejected"],
                "rejected_at": now
            }
        }
    )
    
    # Update auction status
    await db.auctions.update_one(
        {"id": auction_id},
        {
            "$set": {
                "status": AUCTION_STATUS["quote_selected"],
                "selected_quote_id": selection.quote_id,
                "selection_notes": selection.customer_notes,
                "selected_at": now
            }
        }
    )
    
    return {
        "success": True,
        "message": "Quote selected successfully! Proceed to payment to confirm booking.",
        "quote_id": selection.quote_id,
        "operator_id": quote["operator_id"],
        "operator_name": quote.get("operator_name"),
        "total_amount": quote["total_amount"],
        "next_step": "payment"
    }


@router.post("/{auction_id}/cancel")
async def cancel_auction(
    auction_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Customer cancels their auction
    """
    db = get_database()
    
    auction = await db.auctions.find_one({"id": auction_id}, {"_id": 0})
    
    if not auction:
        raise HTTPException(status_code=404, detail="Auction not found")
    
    if auction["customer_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Only the auction owner can cancel")
    
    if auction["status"] not in ["active", "quote_selected"]:
        raise HTTPException(status_code=400, detail=f"Cannot cancel auction with status: {auction['status']}")
    
    now = datetime.now(timezone.utc).isoformat()
    
    # Update auction
    await db.auctions.update_one(
        {"id": auction_id},
        {
            "$set": {
                "status": AUCTION_STATUS["cancelled"],
                "cancelled_at": now,
                "cancelled_by": current_user["id"]
            }
        }
    )
    
    # Expire all quotes
    await db.auction_quotes.update_many(
        {"auction_id": auction_id},
        {
            "$set": {
                "status": QUOTE_STATUS["expired"],
                "expired_at": now
            }
        }
    )
    
    return {
        "success": True,
        "message": "Auction cancelled successfully"
    }


# ============ OPERATOR ENDPOINTS ============

@router.get("/operator/pending")
async def get_pending_auctions_for_operator(
    aircraft_category: Optional[str] = None,
    current_user: dict = Depends(require_roles(["operator", "admin"]))
):
    """
    Get all active auctions that operator can bid on
    """
    db = get_database()
    
    query = {"status": "active"}
    if aircraft_category:
        query["aircraft_category"] = aircraft_category
    
    auctions = await db.auctions.find(
        query,
        {"_id": 0}
    ).sort("end_time", 1).to_list(50)
    
    # Add time remaining and check if operator already quoted
    for auction in auctions:
        auction["time_remaining"] = get_time_remaining(auction["end_time"])
        
        # Check if operator already submitted a quote
        existing_quote = await db.auction_quotes.find_one(
            {"auction_id": auction["id"], "operator_id": current_user["id"]},
            {"_id": 0, "id": 1, "total_amount": 1, "status": 1}
        )
        
        auction["has_quoted"] = existing_quote is not None
        auction["my_quote"] = existing_quote
        
        # Get total quotes count
        auction["total_quotes"] = await db.auction_quotes.count_documents({"auction_id": auction["id"]})
    
    # Filter out expired auctions
    active_auctions = [a for a in auctions if not a["time_remaining"]["expired"]]
    
    return {
        "auctions": active_auctions,
        "count": len(active_auctions)
    }


@router.post("/{auction_id}/quote")
async def submit_operator_quote(
    auction_id: str,
    quote: OperatorQuote,
    current_user: dict = Depends(require_roles(["operator"]))
):
    """
    Operator submits a quote for an auction
    """
    db = get_database()
    
    # Get auction
    auction = await db.auctions.find_one({"id": auction_id}, {"_id": 0})
    
    if not auction:
        raise HTTPException(status_code=404, detail="Auction not found")
    
    if auction["status"] != "active":
        raise HTTPException(status_code=400, detail=f"Auction is {auction['status']}, cannot submit quote")
    
    # Check if auction time hasn't expired
    time_remaining = get_time_remaining(auction["end_time"])
    if time_remaining["expired"]:
        raise HTTPException(status_code=400, detail="Auction has expired")
    
    # Check if operator already quoted
    existing_quote = await db.auction_quotes.find_one({
        "auction_id": auction_id,
        "operator_id": current_user["id"]
    })
    
    if existing_quote:
        raise HTTPException(
            status_code=400, 
            detail="You have already submitted a quote. Use update endpoint to modify."
        )
    
    # Calculate total
    quote_dict = quote.dict()
    subtotal = (
        quote_dict["base_price"] +
        quote_dict["landing_charges"] +
        quote_dict["handling_charges"] +
        quote_dict["crew_charges"] +
        quote_dict["fuel_surcharge"] +
        quote_dict["other_charges"] -
        quote_dict["discount"]
    )
    gst = round(subtotal * 0.18, 2)
    total = round(subtotal + gst, 2)
    
    # Get operator details
    operator = await db.users.find_one(
        {"id": current_user["id"]},
        {"_id": 0, "name": 1, "company_name": 1}
    )
    
    now = datetime.now(timezone.utc)
    
    # Create quote document
    quote_doc = {
        "id": str(uuid.uuid4()),
        "auction_id": auction_id,
        
        # Operator Info
        "operator_id": current_user["id"],
        "operator_name": operator.get("company_name") or operator.get("name", "Unknown"),
        "operator_email": current_user.get("email"),
        
        # Aircraft Details
        "aircraft_id": quote.aircraft_id,
        "aircraft_type": quote.aircraft_type,
        "aircraft_model": quote.aircraft_model,
        "aircraft_registration": quote.aircraft_registration,
        
        # Pricing
        "base_price": quote.base_price,
        "landing_charges": quote.landing_charges,
        "handling_charges": quote.handling_charges,
        "crew_charges": quote.crew_charges,
        "fuel_surcharge": quote.fuel_surcharge,
        "other_charges": quote.other_charges,
        "discount": quote.discount,
        "subtotal": round(subtotal, 2),
        "gst_amount": gst,
        "gst_rate": 18,
        "total_amount": total,
        
        # Flight Details
        "estimated_flight_time": quote.estimated_flight_time,
        "departure_time": quote.departure_time,
        
        # Validity
        "quote_valid_hours": quote.quote_valid_hours,
        "quote_valid_until": (now + timedelta(hours=quote.quote_valid_hours)).isoformat(),
        
        # Notes
        "operator_notes": quote.operator_notes,
        "terms_conditions": quote.terms_conditions,
        
        # Status
        "status": QUOTE_STATUS["pending"],
        "created_at": now.isoformat(),
        "updated_at": now.isoformat()
    }
    
    await db.auction_quotes.insert_one(quote_doc)
    
    # Update auction quotes count
    await db.auctions.update_one(
        {"id": auction_id},
        {"$inc": {"quotes_count": 1}}
    )
    
    return {
        "success": True,
        "quote_id": quote_doc["id"],
        "total_amount": total,
        "message": "Quote submitted successfully! Customer will be notified."
    }


@router.put("/{auction_id}/quote")
async def update_operator_quote(
    auction_id: str,
    quote: OperatorQuote,
    current_user: dict = Depends(require_roles(["operator"]))
):
    """
    Operator updates their existing quote
    """
    db = get_database()
    
    # Get auction
    auction = await db.auctions.find_one({"id": auction_id}, {"_id": 0})
    
    if not auction:
        raise HTTPException(status_code=404, detail="Auction not found")
    
    if auction["status"] != "active":
        raise HTTPException(status_code=400, detail=f"Auction is {auction['status']}, cannot update quote")
    
    # Check if auction time hasn't expired
    time_remaining = get_time_remaining(auction["end_time"])
    if time_remaining["expired"]:
        raise HTTPException(status_code=400, detail="Auction has expired")
    
    # Get existing quote
    existing_quote = await db.auction_quotes.find_one({
        "auction_id": auction_id,
        "operator_id": current_user["id"]
    })
    
    if not existing_quote:
        raise HTTPException(status_code=404, detail="You haven't submitted a quote yet")
    
    if existing_quote.get("status") != "pending":
        raise HTTPException(status_code=400, detail="Cannot update quote that is not pending")
    
    # Calculate new total
    quote_dict = quote.dict()
    subtotal = (
        quote_dict["base_price"] +
        quote_dict["landing_charges"] +
        quote_dict["handling_charges"] +
        quote_dict["crew_charges"] +
        quote_dict["fuel_surcharge"] +
        quote_dict["other_charges"] -
        quote_dict["discount"]
    )
    gst = round(subtotal * 0.18, 2)
    total = round(subtotal + gst, 2)
    
    now = datetime.now(timezone.utc)
    
    # Update quote
    update_data = {
        "aircraft_id": quote.aircraft_id,
        "aircraft_type": quote.aircraft_type,
        "aircraft_model": quote.aircraft_model,
        "aircraft_registration": quote.aircraft_registration,
        "base_price": quote.base_price,
        "landing_charges": quote.landing_charges,
        "handling_charges": quote.handling_charges,
        "crew_charges": quote.crew_charges,
        "fuel_surcharge": quote.fuel_surcharge,
        "other_charges": quote.other_charges,
        "discount": quote.discount,
        "subtotal": round(subtotal, 2),
        "gst_amount": gst,
        "total_amount": total,
        "estimated_flight_time": quote.estimated_flight_time,
        "departure_time": quote.departure_time,
        "quote_valid_hours": quote.quote_valid_hours,
        "quote_valid_until": (now + timedelta(hours=quote.quote_valid_hours)).isoformat(),
        "operator_notes": quote.operator_notes,
        "terms_conditions": quote.terms_conditions,
        "updated_at": now.isoformat()
    }
    
    await db.auction_quotes.update_one(
        {"id": existing_quote["id"]},
        {"$set": update_data}
    )
    
    return {
        "success": True,
        "quote_id": existing_quote["id"],
        "total_amount": total,
        "message": "Quote updated successfully!"
    }


@router.delete("/{auction_id}/quote")
async def withdraw_operator_quote(
    auction_id: str,
    current_user: dict = Depends(require_roles(["operator"]))
):
    """
    Operator withdraws their quote
    """
    db = get_database()
    
    # Get existing quote
    existing_quote = await db.auction_quotes.find_one({
        "auction_id": auction_id,
        "operator_id": current_user["id"]
    })
    
    if not existing_quote:
        raise HTTPException(status_code=404, detail="Quote not found")
    
    if existing_quote.get("status") == "selected":
        raise HTTPException(status_code=400, detail="Cannot withdraw a selected quote")
    
    now = datetime.now(timezone.utc).isoformat()
    
    await db.auction_quotes.update_one(
        {"id": existing_quote["id"]},
        {
            "$set": {
                "status": QUOTE_STATUS["withdrawn"],
                "withdrawn_at": now
            }
        }
    )
    
    # Decrement quotes count
    await db.auctions.update_one(
        {"id": auction_id},
        {"$inc": {"quotes_count": -1}}
    )
    
    return {
        "success": True,
        "message": "Quote withdrawn successfully"
    }


@router.get("/operator/my-quotes")
async def get_operator_quotes(
    status: Optional[str] = None,
    limit: int = Query(default=20, le=100),
    current_user: dict = Depends(require_roles(["operator"]))
):
    """
    Get all quotes submitted by this operator
    """
    db = get_database()
    
    query = {"operator_id": current_user["id"]}
    if status:
        query["status"] = status
    
    quotes = await db.auction_quotes.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).to_list(limit)
    
    # Add auction details for each quote
    for quote in quotes:
        auction = await db.auctions.find_one(
            {"id": quote["auction_id"]},
            {"_id": 0, "auction_number": 1, "origin": 1, "destination": 1, "travel_date": 1, "status": 1}
        )
        quote["auction"] = auction
    
    return {
        "quotes": quotes,
        "count": len(quotes)
    }


# ============ ADMIN ENDPOINTS ============

@router.get("/admin/all")
async def get_all_auctions_admin(
    status: Optional[str] = None,
    limit: int = Query(default=50, le=200),
    current_user: dict = Depends(require_roles(["admin"]))
):
    """
    Admin: Get all auctions
    """
    db = get_database()
    
    query = {}
    if status:
        query["status"] = status
    
    auctions = await db.auctions.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).to_list(limit)
    
    # Add summary stats
    for auction in auctions:
        auction["time_remaining"] = get_time_remaining(auction["end_time"])
    
    # Get stats
    total = await db.auctions.count_documents({})
    active = await db.auctions.count_documents({"status": "active"})
    completed = await db.auctions.count_documents({"status": {"$in": ["quote_selected", "confirmed"]}})
    
    return {
        "auctions": auctions,
        "count": len(auctions),
        "stats": {
            "total": total,
            "active": active,
            "completed": completed,
            "conversion_rate": round(completed / total * 100, 1) if total > 0 else 0
        }
    }


@router.get("/admin/stats")
async def get_auction_stats_admin(
    current_user: dict = Depends(require_roles(["admin"]))
):
    """
    Admin: Get auction system statistics
    """
    db = get_database()
    
    # Auction stats
    total_auctions = await db.auctions.count_documents({})
    active_auctions = await db.auctions.count_documents({"status": "active"})
    completed_auctions = await db.auctions.count_documents({"status": {"$in": ["quote_selected", "confirmed"]}})
    cancelled_auctions = await db.auctions.count_documents({"status": "cancelled"})
    expired_auctions = await db.auctions.count_documents({"status": {"$in": ["closed", "expired"]}})
    
    # Quote stats
    total_quotes = await db.auction_quotes.count_documents({})
    selected_quotes = await db.auction_quotes.count_documents({"status": "selected"})
    
    # Revenue from completed auctions
    pipeline = [
        {"$match": {"status": "selected"}},
        {"$group": {"_id": None, "total": {"$sum": "$total_amount"}}}
    ]
    revenue_result = await db.auction_quotes.aggregate(pipeline).to_list(1)
    total_revenue = revenue_result[0]["total"] if revenue_result else 0
    
    # Average quotes per auction
    avg_quotes = round(total_quotes / total_auctions, 1) if total_auctions > 0 else 0
    
    return {
        "auctions": {
            "total": total_auctions,
            "active": active_auctions,
            "completed": completed_auctions,
            "cancelled": cancelled_auctions,
            "expired": expired_auctions,
            "conversion_rate": round(completed_auctions / total_auctions * 100, 1) if total_auctions > 0 else 0
        },
        "quotes": {
            "total": total_quotes,
            "selected": selected_quotes,
            "avg_per_auction": avg_quotes,
            "selection_rate": round(selected_quotes / total_quotes * 100, 1) if total_quotes > 0 else 0
        },
        "revenue": {
            "total_selected": round(total_revenue, 2),
            "currency": "INR"
        }
    }


# ============ CRON JOB ENDPOINT ============

@router.post("/system/expire-auctions")
async def expire_old_auctions(
    current_user: dict = Depends(require_roles(["admin"]))
):
    """
    System endpoint to expire auctions that have passed their end time
    Should be called by a cron job every minute
    """
    db = get_database()
    
    now = datetime.now(timezone.utc).isoformat()
    
    # Find expired active auctions
    expired_auctions = await db.auctions.find({
        "status": "active",
        "end_time": {"$lt": now}
    }).to_list(100)
    
    expired_count = 0
    
    for auction in expired_auctions:
        # Check if any quotes were received
        quotes_count = await db.auction_quotes.count_documents({"auction_id": auction["id"]})
        
        new_status = AUCTION_STATUS["closed"] if quotes_count > 0 else AUCTION_STATUS["expired"]
        
        await db.auctions.update_one(
            {"id": auction["id"]},
            {
                "$set": {
                    "status": new_status,
                    "expired_at": now
                }
            }
        )
        
        # Expire all pending quotes
        await db.auction_quotes.update_many(
            {"auction_id": auction["id"], "status": "pending"},
            {
                "$set": {
                    "status": QUOTE_STATUS["expired"],
                    "expired_at": now
                }
            }
        )
        
        expired_count += 1
    
    return {
        "success": True,
        "expired_count": expired_count,
        "message": f"Processed {expired_count} expired auctions"
    }
