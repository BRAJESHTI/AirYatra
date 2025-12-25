from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, timezone, timedelta
from uuid import uuid4
from database import get_database
from routes.auth_routes import get_current_user

router = APIRouter(prefix="/support", tags=["Support & Helpdesk"])

# Models
class TicketCreate(BaseModel):
    subject: str = Field(..., min_length=5, max_length=200)
    description: str = Field(..., min_length=10)
    category: str = Field(default="general")  # booking, payment, operator, technical, general
    priority: str = Field(default="medium")  # low, medium, high, urgent
    booking_id: Optional[str] = None
    attachments: List[str] = []

class TicketUpdate(BaseModel):
    status: Optional[str] = None  # open, in_progress, waiting_customer, resolved, closed
    priority: Optional[str] = None
    assigned_to: Optional[str] = None
    internal_notes: Optional[str] = None

class TicketReply(BaseModel):
    message: str = Field(..., min_length=1)
    is_internal: bool = False  # Internal notes vs customer-visible reply

class SLAConfig(BaseModel):
    urgent_response_hours: int = 1
    urgent_resolution_hours: int = 4
    high_response_hours: int = 4
    high_resolution_hours: int = 24
    medium_response_hours: int = 8
    medium_resolution_hours: int = 48
    low_response_hours: int = 24
    low_resolution_hours: int = 72

# Helper functions
def calculate_sla_deadline(priority: str, sla_type: str, config: dict) -> datetime:
    """Calculate SLA deadline based on priority"""
    hours_map = {
        "urgent": {"response": config.get("urgent_response_hours", 1), "resolution": config.get("urgent_resolution_hours", 4)},
        "high": {"response": config.get("high_response_hours", 4), "resolution": config.get("high_resolution_hours", 24)},
        "medium": {"response": config.get("medium_response_hours", 8), "resolution": config.get("medium_resolution_hours", 48)},
        "low": {"response": config.get("low_response_hours", 24), "resolution": config.get("low_resolution_hours", 72)}
    }
    hours = hours_map.get(priority, hours_map["medium"])[sla_type]
    return datetime.now(timezone.utc) + timedelta(hours=hours)

# Customer Endpoints
@router.post("/tickets")
async def create_ticket(ticket: TicketCreate, current_user: dict = Depends(get_current_user)):
    """Create a new support ticket"""
    db = get_database()
    
    # Get SLA config
    sla_config = await db.settings.find_one({"type": "sla_config"}) or {}
    
    ticket_data = {
        "id": str(uuid4()),
        "ticket_number": f"TKT{datetime.now().strftime('%Y%m%d')}{str(uuid4())[:6].upper()}",
        "customer_id": current_user["id"],
        "customer_name": current_user.get("full_name", "Customer"),
        "customer_email": current_user.get("email"),
        "subject": ticket.subject,
        "description": ticket.description,
        "category": ticket.category,
        "priority": ticket.priority,
        "status": "open",
        "booking_id": ticket.booking_id,
        "attachments": ticket.attachments,
        "assigned_to": None,
        "assigned_name": None,
        "sla_response_deadline": calculate_sla_deadline(ticket.priority, "response", sla_config).isoformat(),
        "sla_resolution_deadline": calculate_sla_deadline(ticket.priority, "resolution", sla_config).isoformat(),
        "sla_response_met": None,
        "sla_resolution_met": None,
        "first_response_at": None,
        "resolved_at": None,
        "replies": [],
        "tags": [],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.support_tickets.insert_one(ticket_data)
    
    # Remove MongoDB _id for JSON serialization
    ticket_data.pop("_id", None)
    
    # Create notification for admin
    await db.notifications.insert_one({
        "id": str(uuid4()),
        "user_id": "admin",
        "type": "new_ticket",
        "title": f"New Support Ticket: {ticket.subject}",
        "message": f"Priority: {ticket.priority.upper()} - {ticket.description[:100]}...",
        "reference_id": ticket_data["id"],
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {"message": "Ticket created successfully", "ticket": ticket_data}

@router.get("/tickets/my")
async def get_my_tickets(
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get current user's tickets"""
    db = get_database()
    
    query = {"customer_id": current_user["id"]}
    if status:
        query["status"] = status
    
    tickets = await db.support_tickets.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    return {"tickets": tickets}

@router.get("/tickets/{ticket_id}")
async def get_ticket(ticket_id: str, current_user: dict = Depends(get_current_user)):
    """Get ticket details"""
    db = get_database()
    
    ticket = await db.support_tickets.find_one(
        {"id": ticket_id},
        {"_id": 0}
    )
    
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    # Check access
    is_admin = "admin" in current_user.get("roles", [])
    is_support = "support" in current_user.get("roles", [])
    is_owner = ticket["customer_id"] == current_user["id"]
    
    if not (is_admin or is_support or is_owner):
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Filter internal notes for customers
    if not (is_admin or is_support):
        ticket["replies"] = [r for r in ticket.get("replies", []) if not r.get("is_internal")]
    
    return ticket

@router.post("/tickets/{ticket_id}/reply")
async def add_reply(
    ticket_id: str,
    reply: TicketReply,
    current_user: dict = Depends(get_current_user)
):
    """Add reply to ticket"""
    db = get_database()
    
    ticket = await db.support_tickets.find_one({"id": ticket_id})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    is_admin = "admin" in current_user.get("roles", [])
    is_support = "support" in current_user.get("roles", [])
    is_owner = ticket["customer_id"] == current_user["id"]
    
    if not (is_admin or is_support or is_owner):
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Only staff can add internal notes
    if reply.is_internal and not (is_admin or is_support):
        reply.is_internal = False
    
    reply_data = {
        "id": str(uuid4()),
        "user_id": current_user["id"],
        "user_name": current_user.get("full_name", "User"),
        "user_role": "staff" if (is_admin or is_support) else "customer",
        "message": reply.message,
        "is_internal": reply.is_internal,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    update_data = {
        "$push": {"replies": reply_data},
        "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
    }
    
    # Check if this is first staff response (for SLA)
    if (is_admin or is_support) and not ticket.get("first_response_at") and not reply.is_internal:
        now = datetime.now(timezone.utc)
        sla_deadline = datetime.fromisoformat(ticket["sla_response_deadline"].replace('Z', '+00:00'))
        update_data["$set"]["first_response_at"] = now.isoformat()
        update_data["$set"]["sla_response_met"] = now <= sla_deadline
    
    await db.support_tickets.update_one({"id": ticket_id}, update_data)
    
    return {"message": "Reply added", "reply": reply_data}

# Admin/Support Endpoints
@router.get("/admin/tickets")
async def get_all_tickets(
    status: Optional[str] = None,
    priority: Optional[str] = None,
    category: Optional[str] = None,
    assigned_to: Optional[str] = None,
    sla_breached: Optional[bool] = None,
    skip: int = 0,
    limit: int = 50,
    current_user: dict = Depends(get_current_user)
):
    """Get all tickets (Admin/Support only)"""
    if not any(role in current_user.get("roles", []) for role in ["admin", "support"]):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    db = get_database()
    query = {}
    
    if status:
        query["status"] = status
    if priority:
        query["priority"] = priority
    if category:
        query["category"] = category
    if assigned_to:
        query["assigned_to"] = assigned_to
    if sla_breached:
        now = datetime.now(timezone.utc).isoformat()
        query["$or"] = [
            {"sla_response_deadline": {"$lt": now}, "first_response_at": None},
            {"sla_resolution_deadline": {"$lt": now}, "status": {"$nin": ["resolved", "closed"]}}
        ]
    
    tickets = await db.support_tickets.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.support_tickets.count_documents(query)
    
    return {"tickets": tickets, "total": total}

@router.get("/admin/dashboard")
async def get_support_dashboard(current_user: dict = Depends(get_current_user)):
    """Get support dashboard stats"""
    if not any(role in current_user.get("roles", []) for role in ["admin", "support"]):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    db = get_database()
    now = datetime.now(timezone.utc).isoformat()
    
    # Get counts by status
    pipeline = [
        {"$group": {"_id": "$status", "count": {"$sum": 1}}}
    ]
    status_counts = {}
    async for doc in db.support_tickets.aggregate(pipeline):
        status_counts[doc["_id"]] = doc["count"]
    
    # Get counts by priority
    pipeline = [
        {"$match": {"status": {"$nin": ["resolved", "closed"]}}},
        {"$group": {"_id": "$priority", "count": {"$sum": 1}}}
    ]
    priority_counts = {}
    async for doc in db.support_tickets.aggregate(pipeline):
        priority_counts[doc["_id"]] = doc["count"]
    
    # SLA breached count
    sla_breached = await db.support_tickets.count_documents({
        "$or": [
            {"sla_response_deadline": {"$lt": now}, "first_response_at": None},
            {"sla_resolution_deadline": {"$lt": now}, "status": {"$nin": ["resolved", "closed"]}}
        ]
    })
    
    # Unassigned count
    unassigned = await db.support_tickets.count_documents({
        "assigned_to": None,
        "status": {"$nin": ["resolved", "closed"]}
    })
    
    # Today's tickets
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0).isoformat()
    today_count = await db.support_tickets.count_documents({"created_at": {"$gte": today_start}})
    
    # Average resolution time (last 30 days)
    thirty_days_ago = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
    resolved_tickets = await db.support_tickets.find({
        "status": {"$in": ["resolved", "closed"]},
        "resolved_at": {"$gte": thirty_days_ago}
    }, {"_id": 0, "created_at": 1, "resolved_at": 1}).to_list(1000)
    
    avg_resolution_hours = 0
    if resolved_tickets:
        total_hours = sum(
            (datetime.fromisoformat(t["resolved_at"].replace('Z', '+00:00')) - 
             datetime.fromisoformat(t["created_at"].replace('Z', '+00:00'))).total_seconds() / 3600
            for t in resolved_tickets if t.get("resolved_at")
        )
        avg_resolution_hours = round(total_hours / len(resolved_tickets), 1)
    
    return {
        "status_counts": status_counts,
        "priority_counts": priority_counts,
        "sla_breached": sla_breached,
        "unassigned": unassigned,
        "today_tickets": today_count,
        "total_open": status_counts.get("open", 0) + status_counts.get("in_progress", 0) + status_counts.get("waiting_customer", 0),
        "avg_resolution_hours": avg_resolution_hours
    }

@router.put("/admin/tickets/{ticket_id}")
async def update_ticket(
    ticket_id: str,
    update: TicketUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update ticket (Admin/Support only)"""
    if not any(role in current_user.get("roles", []) for role in ["admin", "support"]):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    db = get_database()
    
    ticket = await db.support_tickets.find_one({"id": ticket_id})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
    
    if update.status:
        update_data["status"] = update.status
        if update.status in ["resolved", "closed"] and not ticket.get("resolved_at"):
            now = datetime.now(timezone.utc)
            update_data["resolved_at"] = now.isoformat()
            sla_deadline = datetime.fromisoformat(ticket["sla_resolution_deadline"].replace('Z', '+00:00'))
            update_data["sla_resolution_met"] = now <= sla_deadline
    
    if update.priority:
        update_data["priority"] = update.priority
    
    if update.assigned_to:
        update_data["assigned_to"] = update.assigned_to
        # Get assigned user name
        assigned_user = await db.users.find_one({"id": update.assigned_to})
        if assigned_user:
            update_data["assigned_name"] = assigned_user.get("full_name", "Agent")
    
    if update.internal_notes:
        # Add as internal reply
        reply_data = {
            "id": str(uuid4()),
            "user_id": current_user["id"],
            "user_name": current_user.get("full_name", "Agent"),
            "user_role": "staff",
            "message": update.internal_notes,
            "is_internal": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.support_tickets.update_one(
            {"id": ticket_id},
            {"$push": {"replies": reply_data}}
        )
    
    await db.support_tickets.update_one({"id": ticket_id}, {"$set": update_data})
    
    return {"message": "Ticket updated successfully"}

@router.get("/admin/sla-config")
async def get_sla_config(current_user: dict = Depends(get_current_user)):
    """Get SLA configuration"""
    if "admin" not in current_user.get("roles", []):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    db = get_database()
    config = await db.settings.find_one({"type": "sla_config"}, {"_id": 0})
    
    if not config:
        config = {
            "type": "sla_config",
            "urgent_response_hours": 1,
            "urgent_resolution_hours": 4,
            "high_response_hours": 4,
            "high_resolution_hours": 24,
            "medium_response_hours": 8,
            "medium_resolution_hours": 48,
            "low_response_hours": 24,
            "low_resolution_hours": 72
        }
    
    return config

@router.post("/admin/sla-config")
async def update_sla_config(config: SLAConfig, current_user: dict = Depends(get_current_user)):
    """Update SLA configuration"""
    if "admin" not in current_user.get("roles", []):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    db = get_database()
    
    config_data = {
        "type": "sla_config",
        **config.dict(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "updated_by": current_user["id"]
    }
    
    await db.settings.update_one(
        {"type": "sla_config"},
        {"$set": config_data},
        upsert=True
    )
    
    return {"message": "SLA configuration updated"}

@router.get("/admin/agents")
async def get_support_agents(current_user: dict = Depends(get_current_user)):
    """Get list of support agents"""
    if not any(role in current_user.get("roles", []) for role in ["admin", "support"]):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    db = get_database()
    
    agents = await db.users.find(
        {"roles": {"$in": ["admin", "support"]}},
        {"_id": 0, "id": 1, "full_name": 1, "email": 1, "roles": 1}
    ).to_list(100)
    
    # Get ticket counts per agent
    for agent in agents:
        agent["open_tickets"] = await db.support_tickets.count_documents({
            "assigned_to": agent["id"],
            "status": {"$nin": ["resolved", "closed"]}
        })
    
    return {"agents": agents}
