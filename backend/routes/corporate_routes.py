"""
AirYatra Corporate Travel Console Routes
Centralized booking for corporate travel managers
"""
from fastapi import APIRouter, HTTPException, Depends, Query, Body
from typing import List, Optional
from datetime import datetime, timedelta
from bson import ObjectId
import uuid
import secrets
from database import get_database
from models import (
    CorporateCreate, CorporateUpdate, EmployeeCreate, EmployeeUpdate,
    DepartmentBudget, BookingApprovalCreate, ApprovalAction, TravelPolicy,
    CorporateStatus, EmployeeRole, CorporateApprovalStatus, BudgetPeriod
)

router = APIRouter(prefix="/corporate", tags=["Corporate"])

def generate_corporate_id() -> str:
    """Generate unique corporate account ID"""
    return f"CORP-{secrets.token_hex(4).upper()}"

def generate_employee_code(corporate_id: str) -> str:
    """Generate unique employee code"""
    return f"{corporate_id[:8]}-EMP-{secrets.token_hex(3).upper()}"

# ============ CORPORATE ACCOUNT MANAGEMENT ============

@router.post("/register")
async def register_corporate(corporate: CorporateCreate):
    """Register new corporate account"""
    db = get_database()
    
    # Check if company already registered
    existing = await db.corporates.find_one({
        "$or": [
            {"registration_number": corporate.registration_number},
            {"gst_number": corporate.gst_number}
        ]
    })
    
    if existing:
        raise HTTPException(
            status_code=400,
            detail="Company already registered with this registration/GST number"
        )
    
    now = datetime.utcnow()
    corporate_id = generate_corporate_id()
    
    corporate_doc = {
        "corporate_id": corporate_id,
        "company_name": corporate.company_name,
        "registration_number": corporate.registration_number,
        "gst_number": corporate.gst_number,
        "industry": corporate.industry,
        "company_size": corporate.company_size,
        "address": corporate.address,
        "city": corporate.city,
        "state": corporate.state,
        "pincode": corporate.pincode,
        "primary_contact_name": corporate.primary_contact_name,
        "primary_contact_email": corporate.primary_contact_email,
        "primary_contact_phone": corporate.primary_contact_phone,
        "admin_email": corporate.admin_email,
        "admin_name": corporate.admin_name,
        "billing_address": corporate.billing_address or corporate.address,
        "status": CorporateStatus.PENDING.value,
        "credit_limit": 0,
        "credit_limit_requested": corporate.credit_limit_requested,
        "credit_used": 0,
        "total_bookings": 0,
        "total_spend": 0,
        "departments": [],
        "employees": [],
        "created_at": now,
        "updated_at": now
    }
    
    result = await db.corporates.insert_one(corporate_doc)
    
    # Create default travel policy
    default_policy = {
        "corporate_id": corporate_id,
        "max_booking_amount": 500000,
        "advance_booking_days": 7,
        "requires_purpose": True,
        "allowed_aircraft_types": [],
        "blackout_dates": [],
        "auto_approve_below": 25000,
        "weekend_booking_allowed": True,
        "international_allowed": False,
        "created_at": now,
        "updated_at": now
    }
    await db.travel_policies.insert_one(default_policy)
    
    corporate_doc["id"] = str(result.inserted_id)
    corporate_doc.pop("_id", None)
    default_policy.pop("_id", None)
    
    return {
        "success": True,
        "message": "Corporate account registration submitted. Pending admin approval.",
        "corporate_id": corporate_id,
        "corporate": corporate_doc
    }

@router.get("/account/{corporate_id}")
async def get_corporate_account(corporate_id: str):
    """Get corporate account details"""
    db = get_database()
    
    corporate = await db.corporates.find_one(
        {"corporate_id": corporate_id},
        {"_id": 0}
    )
    
    if not corporate:
        raise HTTPException(status_code=404, detail="Corporate account not found")
    
    # Get employee count
    employees_count = await db.corporate_employees.count_documents({
        "corporate_id": corporate_id,
        "is_active": True
    })
    
    corporate["employees_count"] = employees_count
    corporate["credit_available"] = corporate["credit_limit"] - corporate["credit_used"]
    
    return {
        "success": True,
        "corporate": corporate
    }

@router.put("/account/{corporate_id}")
async def update_corporate_account(corporate_id: str, update: CorporateUpdate):
    """Update corporate account details"""
    db = get_database()
    
    update_data = {k: v for k, v in update.dict().items() if v is not None}
    update_data["updated_at"] = datetime.utcnow()
    
    result = await db.corporates.update_one(
        {"corporate_id": corporate_id},
        {"$set": update_data}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Corporate account not found")
    
    return {
        "success": True,
        "message": "Corporate account updated successfully"
    }

@router.post("/account/{corporate_id}/approve")
async def approve_corporate_account(
    corporate_id: str, 
    credit_limit: float = Body(..., embed=True),
    admin_notes: str = Body("", embed=True)
):
    """Approve corporate account (Admin only)"""
    db = get_database()
    
    result = await db.corporates.update_one(
        {"corporate_id": corporate_id, "status": "pending"},
        {
            "$set": {
                "status": "approved",
                "credit_limit": credit_limit,
                "admin_notes": admin_notes,
                "approved_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            }
        }
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Corporate account not found or already processed")
    
    return {
        "success": True,
        "message": f"Corporate account approved with credit limit of ₹{credit_limit:,.2f}"
    }

# ============ EMPLOYEE MANAGEMENT ============

@router.post("/employee/add")
async def add_employee(employee: EmployeeCreate):
    """Add employee to corporate account"""
    db = get_database()
    
    # Verify corporate account
    corporate = await db.corporates.find_one({"corporate_id": employee.corporate_id})
    if not corporate:
        raise HTTPException(status_code=404, detail="Corporate account not found")
    
    # Check if employee email already exists
    existing = await db.corporate_employees.find_one({
        "corporate_id": employee.corporate_id,
        "email": employee.email
    })
    
    if existing:
        raise HTTPException(status_code=400, detail="Employee with this email already exists")
    
    now = datetime.utcnow()
    employee_code = generate_employee_code(employee.corporate_id)
    
    employee_doc = {
        "employee_code": employee_code,
        "corporate_id": employee.corporate_id,
        "user_id": None,  # Will be linked when employee registers
        "name": employee.name,
        "email": employee.email,
        "phone": employee.phone,
        "department": employee.department,
        "designation": employee.designation,
        "role": employee.role.value,
        "travel_budget": employee.travel_budget,
        "budget_used": 0,
        "can_book_for_others": employee.can_book_for_others,
        "requires_approval": employee.requires_approval,
        "approval_limit": employee.approval_limit,
        "is_active": True,
        "bookings_count": 0,
        "total_spend": 0,
        "created_at": now,
        "updated_at": now
    }
    
    result = await db.corporate_employees.insert_one(employee_doc)
    
    # Update corporate departments if new
    if employee.department not in corporate.get("departments", []):
        await db.corporates.update_one(
            {"corporate_id": employee.corporate_id},
            {"$addToSet": {"departments": employee.department}}
        )
    
    employee_doc["id"] = str(result.inserted_id)
    employee_doc.pop("_id", None)
    
    return {
        "success": True,
        "message": f"Employee {employee.name} added successfully",
        "employee_code": employee_code,
        "employee": employee_doc
    }

@router.get("/employees/{corporate_id}")
async def get_corporate_employees(
    corporate_id: str,
    department: Optional[str] = None,
    role: Optional[str] = None,
    active_only: bool = True
):
    """Get all employees of a corporate account"""
    db = get_database()
    
    query = {"corporate_id": corporate_id}
    if active_only:
        query["is_active"] = True
    if department:
        query["department"] = department
    if role:
        query["role"] = role
    
    employees = await db.corporate_employees.find(
        query,
        {"_id": 0}
    ).to_list(length=500)
    
    for emp in employees:
        emp["budget_remaining"] = emp["travel_budget"] - emp["budget_used"]
    
    return {
        "success": True,
        "count": len(employees),
        "employees": employees
    }

@router.put("/employee/{employee_code}")
async def update_employee(employee_code: str, update: EmployeeUpdate):
    """Update employee details"""
    db = get_database()
    
    update_data = {k: v for k, v in update.dict().items() if v is not None}
    if "role" in update_data:
        update_data["role"] = update_data["role"].value
    update_data["updated_at"] = datetime.utcnow()
    
    result = await db.corporate_employees.update_one(
        {"employee_code": employee_code},
        {"$set": update_data}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    return {
        "success": True,
        "message": "Employee updated successfully"
    }

@router.delete("/employee/{employee_code}")
async def deactivate_employee(employee_code: str):
    """Deactivate employee (soft delete)"""
    db = get_database()
    
    result = await db.corporate_employees.update_one(
        {"employee_code": employee_code},
        {
            "$set": {
                "is_active": False,
                "deactivated_at": datetime.utcnow()
            }
        }
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    return {
        "success": True,
        "message": "Employee deactivated successfully"
    }

# ============ DEPARTMENT BUDGET ============

@router.post("/budget/department")
async def set_department_budget(budget: DepartmentBudget):
    """Set or update department budget"""
    db = get_database()
    
    now = datetime.utcnow()
    
    # Calculate period end date
    if budget.period == BudgetPeriod.MONTHLY:
        end_date = budget.start_date + timedelta(days=30)
    elif budget.period == BudgetPeriod.QUARTERLY:
        end_date = budget.start_date + timedelta(days=90)
    else:
        end_date = budget.start_date + timedelta(days=365)
    
    budget_doc = {
        "corporate_id": budget.corporate_id,
        "department": budget.department,
        "budget_amount": budget.budget_amount,
        "budget_used": 0,
        "period": budget.period.value,
        "start_date": budget.start_date,
        "end_date": end_date,
        "alert_threshold": budget.alert_threshold,
        "alert_triggered": False,
        "created_at": now,
        "updated_at": now
    }
    
    # Upsert budget
    result = await db.department_budgets.update_one(
        {
            "corporate_id": budget.corporate_id,
            "department": budget.department,
            "start_date": budget.start_date
        },
        {"$set": budget_doc},
        upsert=True
    )
    
    return {
        "success": True,
        "message": f"Budget set for {budget.department} department"
    }

@router.get("/budget/{corporate_id}")
async def get_department_budgets(corporate_id: str):
    """Get all department budgets"""
    db = get_database()
    
    budgets = await db.department_budgets.find(
        {"corporate_id": corporate_id},
        {"_id": 0}
    ).to_list(length=100)
    
    for budget in budgets:
        budget["budget_remaining"] = budget["budget_amount"] - budget["budget_used"]
        budget["utilization_percent"] = (budget["budget_used"] / budget["budget_amount"]) * 100 if budget["budget_amount"] > 0 else 0
    
    return {
        "success": True,
        "budgets": budgets
    }

# ============ BOOKING APPROVAL WORKFLOW ============

@router.post("/booking/request-approval")
async def request_booking_approval(approval: BookingApprovalCreate):
    """Request approval for a corporate booking"""
    db = get_database()
    
    # Get employee details
    employee = await db.corporate_employees.find_one({"employee_code": approval.employee_id})
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    # Check if auto-approval applies
    policy = await db.travel_policies.find_one({"corporate_id": approval.corporate_id})
    
    status = CorporateApprovalStatus.PENDING.value
    if policy and approval.amount <= policy.get("auto_approve_below", 0):
        status = CorporateApprovalStatus.AUTO_APPROVED.value
    elif not employee.get("requires_approval", True):
        status = CorporateApprovalStatus.AUTO_APPROVED.value
    elif approval.amount <= employee.get("approval_limit", 0):
        status = CorporateApprovalStatus.AUTO_APPROVED.value
    
    now = datetime.utcnow()
    
    approval_doc = {
        "approval_id": f"APR-{uuid.uuid4().hex[:8].upper()}",
        "corporate_id": approval.corporate_id,
        "booking_id": approval.booking_id,
        "employee_id": approval.employee_id,
        "employee_name": employee["name"],
        "amount": approval.amount,
        "purpose": approval.purpose,
        "urgency": approval.urgency,
        "status": status,
        "approver_id": None,
        "approver_name": None,
        "approved_at": now if status == CorporateApprovalStatus.AUTO_APPROVED.value else None,
        "rejection_reason": None,
        "created_at": now,
        "updated_at": now
    }
    
    await db.booking_approvals.insert_one(approval_doc)
    approval_doc.pop("_id", None)
    
    return {
        "success": True,
        "status": status,
        "message": "Booking auto-approved" if status == CorporateApprovalStatus.AUTO_APPROVED.value else "Booking sent for approval",
        "approval": approval_doc
    }

@router.get("/approvals/pending/{corporate_id}")
async def get_pending_approvals(corporate_id: str):
    """Get pending booking approvals"""
    db = get_database()
    
    approvals = await db.booking_approvals.find(
        {"corporate_id": corporate_id, "status": "pending"},
        {"_id": 0}
    ).sort("created_at", -1).to_list(length=100)
    
    return {
        "success": True,
        "count": len(approvals),
        "approvals": approvals
    }

@router.post("/approvals/action")
async def process_approval(action: ApprovalAction, approver_id: str = Query(...)):
    """Approve or reject a booking request"""
    db = get_database()
    
    # Get approver details
    approver = await db.corporate_employees.find_one({"employee_code": approver_id})
    if not approver or approver["role"] not in ["admin", "manager", "approver"]:
        raise HTTPException(status_code=403, detail="Not authorized to approve bookings")
    
    now = datetime.utcnow()
    
    update_data = {
        "status": "approved" if action.action == "approve" else "rejected",
        "approver_id": approver_id,
        "approver_name": approver["name"],
        "approved_at": now if action.action == "approve" else None,
        "rejection_reason": action.comments if action.action == "reject" else None,
        "updated_at": now
    }
    
    result = await db.booking_approvals.update_one(
        {"approval_id": action.approval_id, "status": "pending"},
        {"$set": update_data}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Approval request not found or already processed")
    
    return {
        "success": True,
        "message": f"Booking {action.action}d successfully"
    }

# ============ TRAVEL POLICY ============

@router.get("/policy/{corporate_id}")
async def get_travel_policy(corporate_id: str):
    """Get corporate travel policy"""
    db = get_database()
    
    policy = await db.travel_policies.find_one(
        {"corporate_id": corporate_id},
        {"_id": 0}
    )
    
    if not policy:
        raise HTTPException(status_code=404, detail="Travel policy not found")
    
    return {
        "success": True,
        "policy": policy
    }

@router.put("/policy/{corporate_id}")
async def update_travel_policy(corporate_id: str, policy: TravelPolicy):
    """Update corporate travel policy"""
    db = get_database()
    
    policy_data = policy.dict()
    policy_data["updated_at"] = datetime.utcnow()
    
    result = await db.travel_policies.update_one(
        {"corporate_id": corporate_id},
        {"$set": policy_data}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Travel policy not found")
    
    return {
        "success": True,
        "message": "Travel policy updated successfully"
    }

# ============ CORPORATE ANALYTICS ============

@router.get("/analytics/{corporate_id}")
async def get_corporate_analytics(
    corporate_id: str,
    period: str = "monthly"  # monthly, quarterly, yearly
):
    """Get corporate travel analytics"""
    db = get_database()
    
    # Determine date range
    now = datetime.utcnow()
    if period == "monthly":
        start_date = now - timedelta(days=30)
    elif period == "quarterly":
        start_date = now - timedelta(days=90)
    else:
        start_date = now - timedelta(days=365)
    
    # Get corporate details
    corporate = await db.corporates.find_one(
        {"corporate_id": corporate_id},
        {"_id": 0}
    )
    
    if not corporate:
        raise HTTPException(status_code=404, detail="Corporate account not found")
    
    # Get department-wise spend
    dept_spend_pipeline = [
        {"$match": {"corporate_id": corporate_id}},
        {"$group": {
            "_id": "$department",
            "total_spend": {"$sum": "$total_spend"},
            "bookings_count": {"$sum": "$bookings_count"}
        }}
    ]
    dept_spend = await db.corporate_employees.aggregate(dept_spend_pipeline).to_list(length=50)
    
    # Get top travelers
    top_travelers = await db.corporate_employees.find(
        {"corporate_id": corporate_id, "is_active": True},
        {"_id": 0, "name": 1, "department": 1, "total_spend": 1, "bookings_count": 1}
    ).sort("total_spend", -1).limit(10).to_list(length=10)
    
    return {
        "success": True,
        "analytics": {
            "corporate_id": corporate_id,
            "period": period,
            "total_bookings": corporate.get("total_bookings", 0),
            "total_spend": corporate.get("total_spend", 0),
            "credit_used": corporate.get("credit_used", 0),
            "credit_available": corporate.get("credit_limit", 0) - corporate.get("credit_used", 0),
            "department_wise_spend": {d["_id"]: d for d in dept_spend},
            "top_travelers": top_travelers,
            "average_booking_value": corporate.get("total_spend", 0) / max(corporate.get("total_bookings", 1), 1)
        }
    }

# ============ CORPORATE LISTING (Admin) ============

@router.get("/list")
async def list_corporate_accounts(
    status: Optional[str] = None,
    skip: int = 0,
    limit: int = 50
):
    """List all corporate accounts (Admin)"""
    db = get_database()
    
    query = {}
    if status:
        query["status"] = status
    
    corporates = await db.corporates.find(
        query,
        {"_id": 0}
    ).skip(skip).limit(limit).to_list(length=limit)
    
    total = await db.corporates.count_documents(query)
    
    return {
        "success": True,
        "total": total,
        "corporates": corporates
    }
