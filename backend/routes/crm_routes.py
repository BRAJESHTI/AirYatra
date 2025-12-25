"""
CRM System Routes
Lead Management, Sales Team, Task Management, Call Records
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from typing import Optional, List
from datetime import datetime, timezone, timedelta
from uuid import uuid4
from pydantic import BaseModel, EmailStr
from enum import Enum
import logging
import random

from database import get_database
from middleware import get_current_user, require_roles
from models import UserRole

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/crm", tags=["CRM"])


# ============== ENUMS ==============

class LeadSource(str, Enum):
    FACEBOOK = "facebook"
    WHATSAPP = "whatsapp"
    EMAIL = "email"
    GMAIL = "gmail"
    INDIAMART = "indiamart"
    JUSTDIAL = "justdial"
    SULEKHA = "sulekha"
    WEBSITE = "website"
    REFERRAL = "referral"
    WALK_IN = "walk_in"
    PHONE_INQUIRY = "phone_inquiry"
    OTHER = "other"

class LeadStatus(str, Enum):
    NEW = "new"
    CONTACTED = "contacted"
    QUALIFIED = "qualified"
    PROPOSAL_SENT = "proposal_sent"
    NEGOTIATION = "negotiation"
    WON = "won"
    LOST = "lost"
    FOLLOW_UP = "follow_up"
    NOT_INTERESTED = "not_interested"

class LeadPriority(str, Enum):
    HOT = "hot"
    WARM = "warm"
    COLD = "cold"

class TaskStatus(str, Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    OVERDUE = "overdue"

class CallType(str, Enum):
    INCOMING = "incoming"
    OUTGOING = "outgoing"
    MISSED = "missed"

class CallOutcome(str, Enum):
    CONNECTED = "connected"
    NO_ANSWER = "no_answer"
    BUSY = "busy"
    CALLBACK_REQUESTED = "callback_requested"
    VOICEMAIL = "voicemail"
    WRONG_NUMBER = "wrong_number"


# ============== LEAD MANAGEMENT ==============

@router.post("/leads")
async def create_lead(
    lead_data: dict,
    user: dict = Depends(get_current_user)
):
    """Create a new lead manually or from webhook"""
    db = get_database()
    
    lead_id = str(uuid4())
    lead_number = f"LD{datetime.now(timezone.utc).strftime('%Y%m%d')}{lead_id[:6].upper()}"
    
    # Auto-assign to sales team member
    assigned_to = lead_data.get("assigned_to")
    if not assigned_to:
        assigned_to = await auto_assign_lead(db)
    
    lead = {
        "id": lead_id,
        "lead_number": lead_number,
        
        # Contact Info
        "name": lead_data.get("name", ""),
        "email": lead_data.get("email"),
        "phone": lead_data.get("phone"),
        "alternate_phone": lead_data.get("alternate_phone"),
        "company_name": lead_data.get("company_name"),
        "designation": lead_data.get("designation"),
        
        # Location
        "city": lead_data.get("city"),
        "state": lead_data.get("state"),
        "address": lead_data.get("address"),
        
        # Lead Details
        "source": lead_data.get("source", LeadSource.WEBSITE.value),
        "source_details": lead_data.get("source_details"),  # Campaign name, ad id, etc.
        "status": LeadStatus.NEW.value,
        "priority": lead_data.get("priority", LeadPriority.WARM.value),
        
        # Requirements
        "service_interested": lead_data.get("service_interested"),  # helicopter, chartered_plane
        "route_from": lead_data.get("route_from"),
        "route_to": lead_data.get("route_to"),
        "travel_date": lead_data.get("travel_date"),
        "passengers": lead_data.get("passengers"),
        "budget_range": lead_data.get("budget_range"),
        "requirements": lead_data.get("requirements"),
        
        # Assignment
        "assigned_to": assigned_to,
        "assigned_at": datetime.now(timezone.utc).isoformat() if assigned_to else None,
        "assignment_deadline": (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat() if assigned_to else None,
        "reassignment_count": 0,
        
        # Conversion
        "is_converted": False,
        "converted_to_customer_id": None,
        "converted_at": None,
        "converted_by": None,
        
        # Follow-up
        "next_follow_up": lead_data.get("next_follow_up"),
        "follow_up_notes": [],
        
        # Activity tracking
        "last_activity_at": datetime.now(timezone.utc).isoformat(),
        "total_calls": 0,
        "total_emails": 0,
        
        # Metadata
        "tags": lead_data.get("tags", []),
        "notes": lead_data.get("notes"),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "created_by": user["id"]
    }
    
    await db.crm_leads.insert_one(lead)
    
    # Create initial task for the assigned person
    if assigned_to:
        await create_lead_task(db, lead_id, assigned_to, "Initial Contact", 
            "Make first contact with the lead within 1 hour", 1)
    
    logger.info(f"Lead created: {lead_number} from {lead['source']}")
    
    return {
        "message": "Lead created successfully",
        "lead_id": lead_id,
        "lead_number": lead_number,
        "assigned_to": assigned_to
    }


@router.post("/leads/webhook/{source}")
async def webhook_create_lead(
    source: str,
    lead_data: dict
):
    """
    Webhook endpoint for auto-fetching leads from external sources
    Facebook, WhatsApp, Indiamart, Justdial, Sulekha, etc.
    """
    db = get_database()
    
    # Map external source to our source enum
    source_mapping = {
        "facebook": LeadSource.FACEBOOK.value,
        "fb": LeadSource.FACEBOOK.value,
        "whatsapp": LeadSource.WHATSAPP.value,
        "wa": LeadSource.WHATSAPP.value,
        "indiamart": LeadSource.INDIAMART.value,
        "justdial": LeadSource.JUSTDIAL.value,
        "jd": LeadSource.JUSTDIAL.value,
        "sulekha": LeadSource.SULEKHA.value,
        "email": LeadSource.EMAIL.value,
        "gmail": LeadSource.GMAIL.value,
        "website": LeadSource.WEBSITE.value
    }
    
    lead_source = source_mapping.get(source.lower(), LeadSource.OTHER.value)
    
    # Extract lead data based on source format
    name = lead_data.get("name") or lead_data.get("full_name") or lead_data.get("customer_name") or ""
    email = lead_data.get("email") or lead_data.get("email_id") or lead_data.get("customer_email")
    phone = lead_data.get("phone") or lead_data.get("mobile") or lead_data.get("contact") or lead_data.get("customer_mobile")
    
    # Check for duplicate
    existing = await db.crm_leads.find_one({
        "$or": [
            {"phone": phone} if phone else {"id": None},
            {"email": email} if email else {"id": None}
        ]
    })
    
    if existing:
        # Update existing lead with new inquiry
        await db.crm_leads.update_one(
            {"id": existing["id"]},
            {
                "$push": {
                    "follow_up_notes": {
                        "date": datetime.now(timezone.utc).isoformat(),
                        "note": f"New inquiry from {lead_source}: {lead_data.get('requirements', lead_data.get('message', ''))}",
                        "source": lead_source
                    }
                },
                "$set": {
                    "last_activity_at": datetime.now(timezone.utc).isoformat(),
                    "status": LeadStatus.FOLLOW_UP.value if existing["status"] in ["lost", "not_interested"] else existing["status"]
                }
            }
        )
        return {"message": "Existing lead updated", "lead_id": existing["id"], "duplicate": True}
    
    lead_id = str(uuid4())
    lead_number = f"LD{datetime.now(timezone.utc).strftime('%Y%m%d')}{lead_id[:6].upper()}"
    
    # Auto-assign
    assigned_to = await auto_assign_lead(db)
    
    lead = {
        "id": lead_id,
        "lead_number": lead_number,
        "name": name,
        "email": email,
        "phone": phone,
        "company_name": lead_data.get("company") or lead_data.get("company_name"),
        "city": lead_data.get("city") or lead_data.get("location"),
        "state": lead_data.get("state"),
        "source": lead_source,
        "source_details": {
            "raw_data": lead_data,
            "webhook_source": source,
            "received_at": datetime.now(timezone.utc).isoformat()
        },
        "status": LeadStatus.NEW.value,
        "priority": LeadPriority.WARM.value,
        "requirements": lead_data.get("requirements") or lead_data.get("message") or lead_data.get("query"),
        "assigned_to": assigned_to,
        "assigned_at": datetime.now(timezone.utc).isoformat() if assigned_to else None,
        "assignment_deadline": (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat() if assigned_to else None,
        "reassignment_count": 0,
        "is_converted": False,
        "last_activity_at": datetime.now(timezone.utc).isoformat(),
        "total_calls": 0,
        "total_emails": 0,
        "tags": [lead_source],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "created_by": "webhook"
    }
    
    await db.crm_leads.insert_one(lead)
    
    # Create task
    if assigned_to:
        await create_lead_task(db, lead_id, assigned_to, "Initial Contact - Webhook Lead",
            f"New lead from {lead_source}. Contact within 1 hour!", 1)
    
    logger.info(f"Webhook lead created: {lead_number} from {source}")
    
    return {
        "message": "Lead created from webhook",
        "lead_id": lead_id,
        "lead_number": lead_number,
        "source": lead_source
    }


async def auto_assign_lead(db):
    """Auto-assign lead to sales team member with least workload"""
    # Get active sales team members
    sales_team = await db.users.find({
        "roles": {"$in": ["sales", "sales_manager"]},
        "is_active": True
    }, {"_id": 0, "id": 1, "full_name": 1}).to_list(100)
    
    if not sales_team:
        return None
    
    # Find member with least pending leads
    workloads = []
    for member in sales_team:
        pending_count = await db.crm_leads.count_documents({
            "assigned_to": member["id"],
            "status": {"$in": ["new", "contacted", "follow_up"]}
        })
        workloads.append((member["id"], pending_count))
    
    # Sort by workload (ascending) and pick the one with least work
    workloads.sort(key=lambda x: x[1])
    return workloads[0][0] if workloads else None


async def create_lead_task(db, lead_id, assigned_to, title, description, priority_hours):
    """Create a task for lead follow-up"""
    task_id = str(uuid4())
    task = {
        "id": task_id,
        "lead_id": lead_id,
        "assigned_to": assigned_to,
        "title": title,
        "description": description,
        "due_date": (datetime.now(timezone.utc) + timedelta(hours=priority_hours)).isoformat(),
        "status": TaskStatus.PENDING.value,
        "priority": "high" if priority_hours <= 1 else "medium",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.crm_tasks.insert_one(task)
    return task_id


@router.get("/leads")
async def get_leads(
    status: Optional[str] = None,
    source: Optional[str] = None,
    assigned_to: Optional[str] = None,
    priority: Optional[str] = None,
    search: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    page: int = 1,
    limit: int = 20,
    user: dict = Depends(get_current_user)
):
    """Get leads with filters"""
    db = get_database()
    
    query = {}
    
    # Filter based on role
    if "admin" not in user.get("roles", []) and "super_admin" not in user.get("roles", []):
        # Sales can only see their assigned leads
        query["assigned_to"] = user["id"]
    elif assigned_to:
        query["assigned_to"] = assigned_to
    
    if status:
        query["status"] = status
    if source:
        query["source"] = source
    if priority:
        query["priority"] = priority
    
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}},
            {"phone": {"$regex": search, "$options": "i"}},
            {"lead_number": {"$regex": search, "$options": "i"}},
            {"company_name": {"$regex": search, "$options": "i"}}
        ]
    
    if from_date:
        query["created_at"] = {"$gte": from_date}
    if to_date:
        if "created_at" in query:
            query["created_at"]["$lte"] = to_date
        else:
            query["created_at"] = {"$lte": to_date}
    
    skip = (page - 1) * limit
    
    leads = await db.crm_leads.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.crm_leads.count_documents(query)
    
    # Enrich with assigned user info
    for lead in leads:
        if lead.get("assigned_to"):
            assignee = await db.users.find_one({"id": lead["assigned_to"]}, {"_id": 0, "full_name": 1, "email": 1})
            lead["assigned_to_name"] = assignee.get("full_name") if assignee else None
    
    return {
        "leads": leads,
        "total": total,
        "page": page,
        "pages": (total + limit - 1) // limit
    }


@router.get("/leads/{lead_id}")
async def get_lead(
    lead_id: str,
    user: dict = Depends(get_current_user)
):
    """Get lead details with activity history"""
    db = get_database()
    
    lead = await db.crm_leads.find_one({"id": lead_id}, {"_id": 0})
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    # Get assigned user info
    if lead.get("assigned_to"):
        assignee = await db.users.find_one({"id": lead["assigned_to"]}, {"_id": 0, "full_name": 1, "email": 1, "phone": 1})
        lead["assigned_to_details"] = assignee
    
    # Get call history
    calls = await db.crm_calls.find({"lead_id": lead_id}, {"_id": 0}).sort("created_at", -1).to_list(50)
    
    # Get tasks
    tasks = await db.crm_tasks.find({"lead_id": lead_id}, {"_id": 0}).sort("due_date", 1).to_list(20)
    
    # Get activity log
    activities = await db.crm_activities.find({"lead_id": lead_id}, {"_id": 0}).sort("created_at", -1).to_list(50)
    
    return {
        "lead": lead,
        "calls": calls,
        "tasks": tasks,
        "activities": activities
    }


@router.put("/leads/{lead_id}")
async def update_lead(
    lead_id: str,
    update_data: dict,
    user: dict = Depends(get_current_user)
):
    """Update lead details"""
    db = get_database()
    
    lead = await db.crm_leads.find_one({"id": lead_id})
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    # Track status change
    old_status = lead.get("status")
    new_status = update_data.get("status", old_status)
    
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    update_data["last_activity_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.crm_leads.update_one(
        {"id": lead_id},
        {"$set": update_data}
    )
    
    # Log activity
    if old_status != new_status:
        await db.crm_activities.insert_one({
            "id": str(uuid4()),
            "lead_id": lead_id,
            "type": "status_change",
            "description": f"Status changed from {old_status} to {new_status}",
            "user_id": user["id"],
            "user_name": user.get("full_name"),
            "created_at": datetime.now(timezone.utc).isoformat()
        })
    
    return {"message": "Lead updated successfully"}


@router.post("/leads/{lead_id}/assign")
async def assign_lead(
    lead_id: str,
    assign_data: dict,
    user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN]))
):
    """Assign or reassign lead to sales team member"""
    db = get_database()
    
    lead = await db.crm_leads.find_one({"id": lead_id})
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    new_assignee = assign_data["assigned_to"]
    old_assignee = lead.get("assigned_to")
    
    await db.crm_leads.update_one(
        {"id": lead_id},
        {
            "$set": {
                "assigned_to": new_assignee,
                "assigned_at": datetime.now(timezone.utc).isoformat(),
                "assignment_deadline": (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            },
            "$inc": {"reassignment_count": 1}
        }
    )
    
    # Log activity
    await db.crm_activities.insert_one({
        "id": str(uuid4()),
        "lead_id": lead_id,
        "type": "assignment",
        "description": f"Lead reassigned from {old_assignee} to {new_assignee}",
        "user_id": user["id"],
        "user_name": user.get("full_name"),
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    # Create task for new assignee
    await create_lead_task(db, lead_id, new_assignee, "Urgent: Reassigned Lead",
        "This lead was reassigned to you. Contact immediately!", 1)
    
    return {"message": "Lead assigned successfully"}


@router.post("/leads/{lead_id}/convert")
async def convert_lead_to_customer(
    lead_id: str,
    conversion_data: dict,
    user: dict = Depends(get_current_user)
):
    """Convert lead to customer"""
    db = get_database()
    
    lead = await db.crm_leads.find_one({"id": lead_id})
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    if lead.get("is_converted"):
        raise HTTPException(status_code=400, detail="Lead already converted")
    
    # Create customer record
    customer_id = str(uuid4())
    customer = {
        "id": customer_id,
        "lead_id": lead_id,
        "name": lead.get("name"),
        "email": lead.get("email"),
        "phone": lead.get("phone"),
        "company_name": lead.get("company_name"),
        "city": lead.get("city"),
        "state": lead.get("state"),
        "source": lead.get("source"),
        "converted_at": datetime.now(timezone.utc).isoformat(),
        "converted_by": user["id"],
        "notes": conversion_data.get("notes"),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.crm_customers.insert_one(customer)
    
    # Update lead
    await db.crm_leads.update_one(
        {"id": lead_id},
        {
            "$set": {
                "is_converted": True,
                "converted_to_customer_id": customer_id,
                "converted_at": datetime.now(timezone.utc).isoformat(),
                "converted_by": user["id"],
                "status": LeadStatus.WON.value,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    # Log activity
    await db.crm_activities.insert_one({
        "id": str(uuid4()),
        "lead_id": lead_id,
        "type": "conversion",
        "description": "Lead converted to customer",
        "user_id": user["id"],
        "user_name": user.get("full_name"),
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {
        "message": "Lead converted to customer successfully",
        "customer_id": customer_id
    }


# ============== CALL MANAGEMENT ==============

@router.post("/calls")
async def log_call(
    call_data: dict,
    user: dict = Depends(get_current_user)
):
    """Log a call record"""
    db = get_database()
    
    call_id = str(uuid4())
    
    call = {
        "id": call_id,
        "lead_id": call_data.get("lead_id"),
        "customer_id": call_data.get("customer_id"),
        
        # Call details
        "call_type": call_data.get("call_type", CallType.OUTGOING.value),
        "phone_number": call_data.get("phone_number"),
        "duration_seconds": call_data.get("duration_seconds", 0),
        "outcome": call_data.get("outcome", CallOutcome.CONNECTED.value),
        
        # Recording
        "recording_url": call_data.get("recording_url"),
        "has_recording": bool(call_data.get("recording_url")),
        
        # Notes
        "notes": call_data.get("notes"),
        "follow_up_required": call_data.get("follow_up_required", False),
        "next_follow_up": call_data.get("next_follow_up"),
        
        # Agent
        "agent_id": user["id"],
        "agent_name": user.get("full_name"),
        
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.crm_calls.insert_one(call)
    
    # Update lead's call count and last activity
    if call_data.get("lead_id"):
        await db.crm_leads.update_one(
            {"id": call_data["lead_id"]},
            {
                "$inc": {"total_calls": 1},
                "$set": {
                    "last_activity_at": datetime.now(timezone.utc).isoformat(),
                    "status": LeadStatus.CONTACTED.value if call["outcome"] == "connected" else None
                }
            }
        )
        
        # Log activity
        await db.crm_activities.insert_one({
            "id": str(uuid4()),
            "lead_id": call_data["lead_id"],
            "type": "call",
            "description": f"{call['call_type'].title()} call - {call['outcome']} ({call['duration_seconds']}s)",
            "user_id": user["id"],
            "user_name": user.get("full_name"),
            "created_at": datetime.now(timezone.utc).isoformat()
        })
    
    return {"message": "Call logged successfully", "call_id": call_id}


@router.get("/calls")
async def get_calls(
    lead_id: Optional[str] = None,
    agent_id: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    limit: int = 50,
    user: dict = Depends(get_current_user)
):
    """Get call records"""
    db = get_database()
    
    query = {}
    
    if lead_id:
        query["lead_id"] = lead_id
    
    # Non-admin can only see their calls
    if "admin" not in user.get("roles", []) and "super_admin" not in user.get("roles", []):
        query["agent_id"] = user["id"]
    elif agent_id:
        query["agent_id"] = agent_id
    
    if from_date:
        query["created_at"] = {"$gte": from_date}
    if to_date:
        if "created_at" in query:
            query["created_at"]["$lte"] = to_date
        else:
            query["created_at"] = {"$lte": to_date}
    
    calls = await db.crm_calls.find(query, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    
    return {"calls": calls, "total": len(calls)}


# ============== TASK MANAGEMENT ==============

@router.post("/tasks")
async def create_task(
    task_data: dict,
    user: dict = Depends(get_current_user)
):
    """Create a task"""
    db = get_database()
    
    task_id = str(uuid4())
    
    task = {
        "id": task_id,
        "lead_id": task_data.get("lead_id"),
        "customer_id": task_data.get("customer_id"),
        "assigned_to": task_data.get("assigned_to", user["id"]),
        "title": task_data["title"],
        "description": task_data.get("description"),
        "due_date": task_data["due_date"],
        "priority": task_data.get("priority", "medium"),
        "status": TaskStatus.PENDING.value,
        "reminder_at": task_data.get("reminder_at"),
        "created_by": user["id"],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.crm_tasks.insert_one(task)
    
    return {"message": "Task created successfully", "task_id": task_id}


@router.get("/tasks")
async def get_tasks(
    status: Optional[str] = None,
    assigned_to: Optional[str] = None,
    lead_id: Optional[str] = None,
    priority: Optional[str] = None,
    overdue_only: bool = False,
    user: dict = Depends(get_current_user)
):
    """Get tasks"""
    db = get_database()
    
    query = {}
    
    # Non-admin can only see their tasks
    if "admin" not in user.get("roles", []) and "super_admin" not in user.get("roles", []):
        query["assigned_to"] = user["id"]
    elif assigned_to:
        query["assigned_to"] = assigned_to
    
    if status:
        query["status"] = status
    if lead_id:
        query["lead_id"] = lead_id
    if priority:
        query["priority"] = priority
    
    if overdue_only:
        query["due_date"] = {"$lt": datetime.now(timezone.utc).isoformat()}
        query["status"] = {"$ne": TaskStatus.COMPLETED.value}
    
    tasks = await db.crm_tasks.find(query, {"_id": 0}).sort("due_date", 1).to_list(100)
    
    return {"tasks": tasks, "total": len(tasks)}


@router.put("/tasks/{task_id}")
async def update_task(
    task_id: str,
    update_data: dict,
    user: dict = Depends(get_current_user)
):
    """Update task"""
    db = get_database()
    
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    if update_data.get("status") == TaskStatus.COMPLETED.value:
        update_data["completed_at"] = datetime.now(timezone.utc).isoformat()
        update_data["completed_by"] = user["id"]
    
    await db.crm_tasks.update_one(
        {"id": task_id},
        {"$set": update_data}
    )
    
    return {"message": "Task updated successfully"}


# ============== SALES TARGETS ==============

@router.post("/targets")
async def create_sales_target(
    target_data: dict,
    user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN]))
):
    """Create sales target for team member"""
    db = get_database()
    
    target_id = str(uuid4())
    
    target = {
        "id": target_id,
        "sales_person_id": target_data["sales_person_id"],
        "period_type": target_data.get("period_type", "monthly"),  # daily, weekly, monthly, quarterly
        "period_start": target_data["period_start"],
        "period_end": target_data["period_end"],
        
        # Targets
        "leads_target": target_data.get("leads_target", 0),
        "calls_target": target_data.get("calls_target", 0),
        "conversions_target": target_data.get("conversions_target", 0),
        "revenue_target": target_data.get("revenue_target", 0),
        
        # Achieved (will be updated)
        "leads_achieved": 0,
        "calls_achieved": 0,
        "conversions_achieved": 0,
        "revenue_achieved": 0,
        
        "created_by": user["id"],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.crm_targets.insert_one(target)
    
    return {"message": "Target created successfully", "target_id": target_id}


@router.get("/targets")
async def get_sales_targets(
    sales_person_id: Optional[str] = None,
    period_type: Optional[str] = None,
    user: dict = Depends(get_current_user)
):
    """Get sales targets"""
    db = get_database()
    
    query = {}
    
    if "admin" not in user.get("roles", []) and "super_admin" not in user.get("roles", []):
        query["sales_person_id"] = user["id"]
    elif sales_person_id:
        query["sales_person_id"] = sales_person_id
    
    if period_type:
        query["period_type"] = period_type
    
    targets = await db.crm_targets.find(query, {"_id": 0}).sort("period_start", -1).to_list(50)
    
    # Enrich with sales person info
    for target in targets:
        sp = await db.users.find_one({"id": target["sales_person_id"]}, {"_id": 0, "full_name": 1})
        target["sales_person_name"] = sp.get("full_name") if sp else None
    
    return {"targets": targets}


# ============== DASHBOARD & ANALYTICS ==============

@router.get("/dashboard")
async def get_crm_dashboard(
    user: dict = Depends(get_current_user)
):
    """Get CRM dashboard stats"""
    db = get_database()
    
    is_admin = "admin" in user.get("roles", []) or "super_admin" in user.get("roles", [])
    
    # Base query
    query = {} if is_admin else {"assigned_to": user["id"]}
    
    # Today's date
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    this_month = today.replace(day=1)
    
    # Lead stats
    total_leads = await db.crm_leads.count_documents(query)
    new_leads = await db.crm_leads.count_documents({**query, "status": "new"})
    today_leads = await db.crm_leads.count_documents({**query, "created_at": {"$gte": today.isoformat()}})
    
    # Conversion stats
    converted = await db.crm_leads.count_documents({**query, "is_converted": True})
    conversion_rate = (converted / total_leads * 100) if total_leads > 0 else 0
    
    # Call stats
    call_query = {} if is_admin else {"agent_id": user["id"]}
    today_calls = await db.crm_calls.count_documents({**call_query, "created_at": {"$gte": today.isoformat()}})
    month_calls = await db.crm_calls.count_documents({**call_query, "created_at": {"$gte": this_month.isoformat()}})
    
    # Task stats
    task_query = {} if is_admin else {"assigned_to": user["id"]}
    pending_tasks = await db.crm_tasks.count_documents({**task_query, "status": "pending"})
    overdue_tasks = await db.crm_tasks.count_documents({
        **task_query, 
        "status": {"$ne": "completed"},
        "due_date": {"$lt": datetime.now(timezone.utc).isoformat()}
    })
    
    # Lead sources breakdown
    pipeline = [
        {"$match": query},
        {"$group": {"_id": "$source", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]
    source_breakdown = await db.crm_leads.aggregate(pipeline).to_list(20)
    
    # Status breakdown
    status_pipeline = [
        {"$match": query},
        {"$group": {"_id": "$status", "count": {"$sum": 1}}}
    ]
    status_breakdown = await db.crm_leads.aggregate(status_pipeline).to_list(20)
    
    # Recent leads
    recent_leads = await db.crm_leads.find(query, {"_id": 0}).sort("created_at", -1).limit(5).to_list(5)
    
    # Urgent leads (not worked in 1 hour)
    one_hour_ago = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
    urgent_leads = await db.crm_leads.find({
        **query,
        "status": "new",
        "created_at": {"$lt": one_hour_ago}
    }, {"_id": 0}).limit(10).to_list(10)
    
    return {
        "summary": {
            "total_leads": total_leads,
            "new_leads": new_leads,
            "today_leads": today_leads,
            "converted": converted,
            "conversion_rate": round(conversion_rate, 1),
            "today_calls": today_calls,
            "month_calls": month_calls,
            "pending_tasks": pending_tasks,
            "overdue_tasks": overdue_tasks
        },
        "source_breakdown": [{"source": s["_id"], "count": s["count"]} for s in source_breakdown],
        "status_breakdown": [{"status": s["_id"], "count": s["count"]} for s in status_breakdown],
        "recent_leads": recent_leads,
        "urgent_leads": urgent_leads
    }


@router.get("/sales-team")
async def get_sales_team_performance(
    user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN]))
):
    """Get sales team performance"""
    db = get_database()
    
    # Get all sales team members
    sales_team = await db.users.find({
        "roles": {"$in": ["sales", "sales_manager"]},
        "is_active": True
    }, {"_id": 0, "id": 1, "full_name": 1, "email": 1}).to_list(100)
    
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    this_month = today.replace(day=1)
    
    performance = []
    for member in sales_team:
        # Leads
        total_leads = await db.crm_leads.count_documents({"assigned_to": member["id"]})
        converted = await db.crm_leads.count_documents({"assigned_to": member["id"], "is_converted": True})
        
        # Calls
        today_calls = await db.crm_calls.count_documents({
            "agent_id": member["id"],
            "created_at": {"$gte": today.isoformat()}
        })
        month_calls = await db.crm_calls.count_documents({
            "agent_id": member["id"],
            "created_at": {"$gte": this_month.isoformat()}
        })
        
        # Pending tasks
        pending_tasks = await db.crm_tasks.count_documents({
            "assigned_to": member["id"],
            "status": "pending"
        })
        
        performance.append({
            "id": member["id"],
            "name": member["full_name"],
            "email": member["email"],
            "total_leads": total_leads,
            "converted": converted,
            "conversion_rate": round((converted / total_leads * 100) if total_leads > 0 else 0, 1),
            "today_calls": today_calls,
            "month_calls": month_calls,
            "pending_tasks": pending_tasks
        })
    
    return {"team": performance}


# ============== AUTO-REASSIGNMENT JOB ==============

@router.post("/auto-reassign")
async def auto_reassign_stale_leads(
    user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN]))
):
    """Auto-reassign leads not worked on within 1 hour"""
    db = get_database()
    
    one_hour_ago = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
    
    # Find stale leads
    stale_leads = await db.crm_leads.find({
        "status": "new",
        "assigned_at": {"$lt": one_hour_ago},
        "reassignment_count": {"$lt": 3}  # Max 3 reassignments
    }, {"_id": 0}).to_list(100)
    
    reassigned = 0
    for lead in stale_leads:
        new_assignee = await auto_assign_lead(db)
        if new_assignee and new_assignee != lead.get("assigned_to"):
            await db.crm_leads.update_one(
                {"id": lead["id"]},
                {
                    "$set": {
                        "assigned_to": new_assignee,
                        "assigned_at": datetime.now(timezone.utc).isoformat(),
                        "assignment_deadline": (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat()
                    },
                    "$inc": {"reassignment_count": 1}
                }
            )
            
            # Create urgent task
            await create_lead_task(db, lead["id"], new_assignee, "URGENT: Reassigned Stale Lead",
                "This lead was auto-reassigned due to inactivity. Contact immediately!", 0.5)
            
            reassigned += 1
    
    return {"message": f"Auto-reassigned {reassigned} stale leads"}
