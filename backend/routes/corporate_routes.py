"""
AirYatra Corporate Travel Console Routes
Centralized booking for corporate travel managers
"""
from fastapi import APIRouter, HTTPException, Depends, Query, Body, BackgroundTasks
from fastapi.responses import HTMLResponse
from typing import List, Optional
from datetime import datetime, timedelta, timezone
from bson import ObjectId
from pydantic import BaseModel
from urllib.parse import quote
import os
import uuid
import secrets
from database import get_database
from middleware import get_current_user
from services.email_service import email_service
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

# ============ MY CORPORATE ACCOUNT (Auth) ============

@router.put("/credit-alert-settings")
async def set_credit_alert_threshold(
    threshold_amount: float = Body(..., embed=True),
    current_user: dict = Depends(get_current_user),
):
    """Corporate admin sets the low-credit alert threshold (₹)"""
    db = get_database()
    if threshold_amount < 0:
        raise HTTPException(status_code=400, detail="Threshold cannot be negative")
    corporate = await db.corporates.find_one({"admin_email": current_user.get("email")}, {"_id": 0, "corporate_id": 1})
    if not corporate:
        raise HTTPException(status_code=404, detail="Corporate account not found for this admin")
    await db.corporates.update_one(
        {"corporate_id": corporate["corporate_id"]},
        {"$set": {"credit_alert_threshold": threshold_amount, "credit_alert_active": False}})
    from services.credit_alert_service import schedule_credit_alert
    schedule_credit_alert(db, corporate["corporate_id"])
    return {"success": True, "message": f"Credit alert threshold set to ₹{threshold_amount:,.0f}", "corporate_id": corporate["corporate_id"]}


@router.get("/my-account")
async def get_my_corporate_account(current_user: dict = Depends(get_current_user)):
    """Resolve corporate account for the logged-in user (corp admin or employee)"""
    db = get_database()
    email = current_user.get("email")

    employee = None
    corporate = await db.corporates.find_one({"admin_email": email}, {"_id": 0})
    if not corporate:
        employee = await db.corporate_employees.find_one({"email": email, "is_active": True}, {"_id": 0})
        if employee:
            corporate = await db.corporates.find_one({"corporate_id": employee["corporate_id"]}, {"_id": 0})

    if not corporate:
        return {"success": True, "corporate": None}

    corporate["credit_available"] = corporate.get("credit_limit", 0) - corporate.get("credit_used", 0)
    return {
        "success": True,
        "corporate": corporate,
        "employee_code": (employee or {}).get("employee_code", "CORP-ADMIN"),
        "corp_role": (employee or {}).get("role", "admin"),
    }

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
    
    now = datetime.now(timezone.utc)
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
    update_data["updated_at"] = datetime.now(timezone.utc)
    
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
                "approved_at": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc)
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
    
    now = datetime.now(timezone.utc)
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
    update_data["updated_at"] = datetime.now(timezone.utc)
    
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
                "deactivated_at": datetime.now(timezone.utc)
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
    
    now = datetime.now(timezone.utc)
    
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
    
    now = datetime.now(timezone.utc)
    
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
    
    # Get approver details (CORP-ADMIN = corporate account owner)
    if approver_id == "CORP-ADMIN":
        approver_name = "Corporate Admin"
    else:
        approver = await db.corporate_employees.find_one({"employee_code": approver_id})
        if not approver or approver["role"] not in ["admin", "manager", "approver"]:
            raise HTTPException(status_code=403, detail="Not authorized to approve bookings")
        approver_name = approver["name"]
    
    approval = await db.booking_approvals.find_one({"approval_id": action.approval_id}, {"_id": 0})
    if not approval:
        raise HTTPException(status_code=404, detail="Approval request not found")
    if approval.get("status") != "pending":
        raise HTTPException(status_code=400, detail="Approval already processed")
    
    new_status = await _finalize_approval(
        db, approval, "approve" if action.action == "approve" else "reject",
        approver_id=approver_id,
        approver_name=approver_name,
        comments=action.comments,
    )
    
    return {
        "success": True,
        "message": f"Booking {new_status}"
    }

# ============ CORPORATE BOOKING MANAGEMENT ============

class CorporateBookingCreate(BaseModel):
    corporate_id: str
    employee_code: str
    from_location: str
    to_location: str
    travel_date: str
    travel_time: Optional[str] = "09:00"
    passengers: int = 1
    aircraft_type: str = "helicopter"
    purpose: str
    urgency: str = "normal"
    estimated_amount: float


async def _apply_corporate_booking_spend(db, booking: dict):
    """Update employee + corporate spend counters for an approved booking"""
    amount = booking.get("final_price", 0)
    await db.corporate_employees.update_one(
        {"employee_code": booking["employee_code"]},
        {"$inc": {"budget_used": amount, "bookings_count": 1, "total_spend": amount}},
    )
    await db.corporates.update_one(
        {"corporate_id": booking["corporate_id"]},
        {"$inc": {"total_bookings": 1, "total_spend": amount, "credit_used": amount}},
    )
    await db.department_budgets.update_one(
        {"corporate_id": booking["corporate_id"], "department": booking.get("department")},
        {"$inc": {"budget_used": amount}},
    )
    from services.credit_alert_service import schedule_credit_alert
    schedule_credit_alert(db, booking["corporate_id"])


@router.post("/booking/create")
async def create_corporate_booking(req: CorporateBookingCreate, background_tasks: BackgroundTasks):
    """Create employee booking with policy checks + approval workflow"""
    db = get_database()

    corporate = await db.corporates.find_one({"corporate_id": req.corporate_id}, {"_id": 0})
    if not corporate:
        raise HTTPException(status_code=404, detail="Corporate account not found")

    employee = await db.corporate_employees.find_one(
        {"employee_code": req.employee_code, "corporate_id": req.corporate_id, "is_active": True}, {"_id": 0}
    )
    if not employee:
        raise HTTPException(status_code=404, detail="Active employee not found")

    policy = await db.travel_policies.find_one({"corporate_id": req.corporate_id}, {"_id": 0}) or {}
    max_amount = policy.get("max_booking_amount", 500000)
    if req.estimated_amount > max_amount:
        raise HTTPException(status_code=400, detail=f"Amount exceeds travel policy limit of Rs.{max_amount:,.0f}")

    budget_remaining = employee.get("travel_budget", 0) - employee.get("budget_used", 0)
    if req.estimated_amount > budget_remaining:
        raise HTTPException(status_code=400, detail=f"Employee travel budget exceeded. Remaining: Rs.{budget_remaining:,.0f}")

    auto_approved = (
        req.estimated_amount <= policy.get("auto_approve_below", 0)
        or not employee.get("requires_approval", True)
        or req.estimated_amount <= employee.get("approval_limit", 0)
    )

    now = datetime.now(timezone.utc)
    booking_id = str(uuid.uuid4())
    booking_number = f"CB-{secrets.token_hex(3).upper()}"
    base_fare = round(req.estimated_amount / 1.18, 2)
    gst_amount = round(req.estimated_amount - base_fare, 2)

    booking_doc = {
        "id": booking_id,
        "booking_number": booking_number,
        "corporate_id": req.corporate_id,
        "employee_code": req.employee_code,
        "employee_name": employee.get("name"),
        "department": employee.get("department"),
        "passenger_name": employee.get("name"),
        "from_location": req.from_location,
        "to_location": req.to_location,
        "travel_date": req.travel_date,
        "travel_time": req.travel_time,
        "passengers": req.passengers,
        "aircraft_type": req.aircraft_type,
        "purpose": req.purpose,
        "urgency": req.urgency,
        "final_price": req.estimated_amount,
        "pricing": {
            "base_fare": base_fare,
            "gst_rate": 18,
            "gst_amount": gst_amount,
            "total_amount": req.estimated_amount,
        },
        "status": "confirmed" if auto_approved else "pending_approval",
        "approval_status": "auto_approved" if auto_approved else "pending",
        "created_at": now,
        "updated_at": now,
    }
    await db.corporate_bookings.insert_one(booking_doc)
    booking_doc.pop("_id", None)

    approval_doc = None
    if auto_approved:
        await _apply_corporate_booking_spend(db, booking_doc)
    else:
        approval_doc = {
            "approval_id": f"APR-{uuid.uuid4().hex[:8].upper()}",
            "email_action_token": secrets.token_urlsafe(32),
            "corporate_id": req.corporate_id,
            "booking_id": booking_id,
            "booking_number": booking_number,
            "employee_id": req.employee_code,
            "employee_name": employee.get("name"),
            "department": employee.get("department"),
            "route": f"{req.from_location} -> {req.to_location}",
            "travel_date": req.travel_date,
            "amount": req.estimated_amount,
            "purpose": req.purpose,
            "urgency": req.urgency,
            "status": "pending",
            "approver_id": None,
            "approver_name": None,
            "approved_at": None,
            "rejection_reason": None,
            "created_at": now,
            "updated_at": now,
        }
        await db.booking_approvals.insert_one(approval_doc)
        approval_doc.pop("_id", None)
        background_tasks.add_task(_send_approval_request_emails, corporate, dict(approval_doc), booking_doc)

    return {
        "success": True,
        "auto_approved": auto_approved,
        "message": "Booking auto-approved and confirmed" if auto_approved else "Booking sent for approval",
        "booking": booking_doc,
        "approval": approval_doc,
    }


async def _finalize_approval(db, approval: dict, action: str, approver_id: str, approver_name: str, comments: Optional[str] = None) -> str:
    """Shared approve/reject logic: updates approval doc, linked booking and spend counters"""
    now = datetime.now(timezone.utc)
    new_status = "approved" if action == "approve" else "rejected"

    await db.booking_approvals.update_one(
        {"approval_id": approval["approval_id"], "status": "pending"},
        {"$set": {
            "status": new_status,
            "approver_id": approver_id,
            "approver_name": approver_name,
            "approved_at": now if new_status == "approved" else None,
            "rejection_reason": comments if new_status == "rejected" else None,
            "updated_at": now
        }}
    )

    booking = await db.corporate_bookings.find_one({"id": approval.get("booking_id")}, {"_id": 0})
    if booking:
        await db.corporate_bookings.update_one(
            {"id": booking["id"]},
            {"$set": {
                "status": "confirmed" if new_status == "approved" else "rejected",
                "approval_status": new_status,
                "updated_at": now
            }}
        )
        if new_status == "approved":
            await _apply_corporate_booking_spend(db, booking)

    return new_status


APPROVAL_EMAIL_TEMPLATE = """
<div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;background:#0f172a;border-radius:16px;overflow:hidden">
  <div style="background:linear-gradient(135deg,#f97316,#ea580c);padding:28px 32px">
    <h1 style="color:#fff;margin:0;font-size:22px">AirYatra Corporate</h1>
    <p style="color:#ffedd5;margin:6px 0 0;font-size:14px">Booking Approval Required</p>
  </div>
  <div style="padding:28px 32px;color:#e2e8f0">
    <p style="font-size:15px;margin:0 0 18px">A new booking request needs your decision:</p>
    <table style="width:100%;border-collapse:collapse;font-size:14px">
      <tr><td style="padding:8px 0;color:#94a3b8">Employee</td><td style="padding:8px 0;text-align:right;font-weight:bold">{employee_name} ({department})</td></tr>
      <tr><td style="padding:8px 0;color:#94a3b8">Route</td><td style="padding:8px 0;text-align:right;font-weight:bold">{route}</td></tr>
      <tr><td style="padding:8px 0;color:#94a3b8">Travel Date</td><td style="padding:8px 0;text-align:right">{travel_date}</td></tr>
      <tr><td style="padding:8px 0;color:#94a3b8">Purpose</td><td style="padding:8px 0;text-align:right">{purpose}</td></tr>
      <tr><td style="padding:8px 0;color:#94a3b8">Urgency</td><td style="padding:8px 0;text-align:right;text-transform:capitalize">{urgency}</td></tr>
      <tr><td style="padding:12px 0;color:#94a3b8;border-top:1px solid #334155;font-size:16px">Amount</td><td style="padding:12px 0;text-align:right;border-top:1px solid #334155;font-size:20px;font-weight:bold;color:#fb923c">Rs. {amount:,.0f}</td></tr>
    </table>
    <div style="margin:28px 0;text-align:center">
      <a href="{approve_url}" style="display:inline-block;background:#16a34a;color:#fff;text-decoration:none;padding:14px 36px;border-radius:10px;font-weight:bold;font-size:15px;margin:0 6px 10px">APPROVE</a>
      <a href="{reject_url}" style="display:inline-block;background:#dc2626;color:#fff;text-decoration:none;padding:14px 36px;border-radius:10px;font-weight:bold;font-size:15px;margin:0 6px 10px">REJECT</a>
    </div>
    <p style="font-size:12px;color:#64748b;margin:0">Or review in the Corporate Dashboard: <a href="{dashboard_url}" style="color:#fb923c">{dashboard_url}</a></p>
    <p style="font-size:12px;color:#64748b;margin:8px 0 0">Booking Ref: {booking_number} &bull; Approval ID: {approval_id}</p>
  </div>
  <div style="background:#1e293b;padding:16px 32px;text-align:center">
    <p style="color:#64748b;font-size:11px;margin:0">AirYatra Aviation Pvt Ltd &bull; This is an automated approval alert for {company_name}</p>
  </div>
</div>
"""


async def _send_approval_request_emails(corporate: dict, approval: dict, booking: dict):
    """Email all approvers with one-click approve/reject links"""
    db = get_database()
    base_url = os.environ.get("FRONTEND_URL", "").rstrip("/")
    token = approval.get("email_action_token")
    if not token or not base_url:
        return

    recipients = set()
    if corporate.get("admin_email"):
        recipients.add(corporate["admin_email"])
    approvers = await db.corporate_employees.find(
        {"corporate_id": corporate["corporate_id"], "is_active": True, "role": {"$in": ["admin", "manager", "approver"]}},
        {"_id": 0, "email": 1}
    ).to_list(50)
    for a in approvers:
        if a.get("email"):
            recipients.add(a["email"])

    sent = []
    for email in recipients:
        approve_url = f"{base_url}/api/corporate/approvals/email-action?token={token}&action=approve&by={quote(email)}"
        reject_url = f"{base_url}/api/corporate/approvals/email-action?token={token}&action=reject&by={quote(email)}"
        html = APPROVAL_EMAIL_TEMPLATE.format(
            employee_name=approval.get("employee_name", ""),
            department=approval.get("department", ""),
            route=approval.get("route", ""),
            travel_date=approval.get("travel_date", ""),
            purpose=approval.get("purpose", ""),
            urgency=approval.get("urgency", "normal"),
            amount=approval.get("amount", 0),
            approve_url=approve_url,
            reject_url=reject_url,
            dashboard_url=f"{base_url}/corporate",
            booking_number=approval.get("booking_number", ""),
            approval_id=approval.get("approval_id", ""),
            company_name=corporate.get("company_name", ""),
        )
        try:
            await email_service.send_email(
                to_email=email,
                subject=f"[Action Required] Booking approval: {approval.get('employee_name')} - Rs.{approval.get('amount', 0):,.0f} ({approval.get('route')})",
                html_body=html,
            )
            sent.append(email)
        except Exception:
            pass

    await db.booking_approvals.update_one(
        {"approval_id": approval["approval_id"]},
        {"$set": {"alert_emails_sent": sent, "alert_emails_sent_at": datetime.now(timezone.utc)}}
    )


def _email_action_page(title: str, message: str, success: bool) -> str:
    color = "#16a34a" if success else "#f59e0b"
    icon = "&#10004;" if success else "&#9888;"
    return f"""
<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>{title} - AirYatra</title></head>
<body style="margin:0;background:#0f172a;font-family:Arial,Helvetica,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh">
  <div style="max-width:440px;margin:40px 16px;background:#1e293b;border:1px solid #334155;border-radius:16px;padding:40px 32px;text-align:center">
    <div style="width:64px;height:64px;border-radius:50%;background:{color}22;color:{color};font-size:30px;line-height:64px;margin:0 auto 20px">{icon}</div>
    <h1 style="color:#fff;font-size:22px;margin:0 0 12px">{title}</h1>
    <p style="color:#94a3b8;font-size:14px;margin:0 0 24px">{message}</p>
    <a href="/corporate" style="display:inline-block;background:#f97316;color:#fff;text-decoration:none;padding:12px 28px;border-radius:10px;font-weight:bold;font-size:14px">Open Corporate Dashboard</a>
    <p style="color:#475569;font-size:11px;margin:24px 0 0">AirYatra Aviation Pvt Ltd</p>
  </div>
</body></html>
"""


@router.get("/approvals/email-action")
async def approval_email_action(token: str, action: str, by: str = "Email Approver"):
    """One-click approve/reject from email link (token-guarded, single-use)"""
    db = get_database()

    if action not in ["approve", "reject"]:
        return HTMLResponse(_email_action_page("Invalid Link", "This approval link is not valid.", False), status_code=400)

    approval = await db.booking_approvals.find_one({"email_action_token": token}, {"_id": 0})
    if not approval:
        return HTMLResponse(_email_action_page("Link Invalid or Expired", "This approval link is invalid or has expired.", False), status_code=404)

    if approval.get("status") != "pending":
        actioned_by = approval.get("approver_name") or "another approver"
        return HTMLResponse(_email_action_page(
            "Already Processed",
            f"This booking request was already <b>{approval.get('status')}</b> by {actioned_by}.",
            False
        ))

    new_status = await _finalize_approval(
        db, approval, action,
        approver_id="EMAIL-LINK",
        approver_name=by,
        comments="Rejected via email link" if action == "reject" else None,
    )

    if new_status == "approved":
        return HTMLResponse(_email_action_page(
            "Booking Approved",
            f"Booking <b>{approval.get('booking_number', '')}</b> for {approval.get('employee_name')} (Rs. {approval.get('amount', 0):,.0f}) has been approved and confirmed.",
            True
        ))
    return HTMLResponse(_email_action_page(
        "Booking Rejected",
        f"Booking <b>{approval.get('booking_number', '')}</b> for {approval.get('employee_name')} has been rejected.",
        True
    ))



@router.get("/bookings/{corporate_id}")
async def list_corporate_bookings(
    corporate_id: str,
    status: Optional[str] = None,
    employee_code: Optional[str] = None,
    limit: int = 100,
):
    """List all employee bookings for a corporate"""
    db = get_database()
    query = {"corporate_id": corporate_id}
    if status:
        query["status"] = status
    if employee_code:
        query["employee_code"] = employee_code
    bookings = await db.corporate_bookings.find(query, {"_id": 0}).sort("created_at", -1).to_list(length=limit)
    return {"success": True, "count": len(bookings), "bookings": bookings}


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
    policy_data["updated_at"] = datetime.now(timezone.utc)
    
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
    now = datetime.now(timezone.utc)
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



# ============ GST INVOICE GENERATION ============

from fastapi.responses import StreamingResponse, Response
from io import BytesIO

def _generate_gst_invoice_pdf(corporate: dict, booking: dict, invoice_data: dict) -> bytes:
    """Generate GST-compliant invoice PDF for corporate booking"""
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import mm
    from reportlab.pdfgen import canvas
    from reportlab.platypus import Table, TableStyle
    from datetime import datetime, timezone
    
    buffer = BytesIO()
    c = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4
    
    # Colors
    orange = colors.HexColor('#f97316')
    dark = colors.HexColor('#0f172a')
    gray = colors.HexColor('#64748b')
    
    # Header
    c.setFillColor(dark)
    c.rect(0, height - 120, width, 120, fill=1, stroke=0)
    
    # Company Logo & Name
    c.setFillColor(orange)
    c.setFont("Helvetica-Bold", 32)
    c.drawString(30, height - 55, "AirYatra")
    
    c.setFillColor(colors.white)
    c.setFont("Helvetica", 10)
    c.drawString(30, height - 75, "India's Aviation Super Ecosystem")
    c.drawString(30, height - 90, "GSTIN: 27AABCT1234L1ZH")
    c.drawString(30, height - 105, "CIN: U62099MH2024PTC123456")
    
    # TAX INVOICE Label
    c.setFont("Helvetica-Bold", 24)
    c.drawRightString(width - 30, height - 50, "TAX INVOICE")
    
    # Invoice Details
    c.setFont("Helvetica", 10)
    invoice_num = invoice_data.get("invoice_number", f"INV-GST-{booking.get('booking_number', 'N/A')}")
    c.drawRightString(width - 30, height - 70, f"Invoice #: {invoice_num}")
    c.drawRightString(width - 30, height - 85, f"Date: {datetime.now(timezone.utc).strftime('%d %b %Y')}")
    c.drawRightString(width - 30, height - 100, f"Place of Supply: {invoice_data.get('place_of_supply', 'Maharashtra')}")
    
    # Reset colors
    c.setFillColor(colors.black)
    
    # Bill To / Ship To Section
    y = height - 160
    
    # Bill To (Corporate)
    c.setFont("Helvetica-Bold", 11)
    c.drawString(30, y, "Bill To:")
    c.setFont("Helvetica", 10)
    c.drawString(30, y - 15, corporate.get("company_name", ""))
    c.drawString(30, y - 30, f"GSTIN: {corporate.get('gst_number', 'N/A')}")
    c.drawString(30, y - 45, corporate.get("address", ""))
    c.drawString(30, y - 60, f"{corporate.get('city', '')}, {corporate.get('state', '')} - {corporate.get('pincode', '')}")
    
    # Ship To (Passenger)
    c.setFont("Helvetica-Bold", 11)
    c.drawString(width/2 + 20, y, "Service Recipient:")
    c.setFont("Helvetica", 10)
    c.drawString(width/2 + 20, y - 15, booking.get("passenger_name", booking.get("customer_name", "")))
    c.drawString(width/2 + 20, y - 30, f"Booking #: {booking.get('booking_number', 'N/A')}")
    c.drawString(width/2 + 20, y - 45, f"Route: {booking.get('from_location', '')} → {booking.get('to_location', '')}")
    c.drawString(width/2 + 20, y - 60, f"Date: {booking.get('travel_date', booking.get('departure_date', 'N/A'))}")
    
    # HSN/SAC Code Box
    y = height - 260
    c.setFillColor(dark)
    c.rect(30, y - 5, width - 60, 30, fill=1, stroke=0)
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 10)
    c.drawString(40, y + 5, "SAC Code")
    c.drawString(150, y + 5, "Description")
    c.drawString(350, y + 5, "Qty")
    c.drawString(400, y + 5, "Rate (₹)")
    c.drawRightString(width - 40, y + 5, "Amount (₹)")
    
    # Line Items
    c.setFillColor(colors.black)
    c.setFont("Helvetica", 10)
    y = y - 35
    
    pricing = booking.get("pricing", {})
    base_fare = pricing.get("base_fare", booking.get("final_price", 0))
    
    items = [
        ("996411", "Air Charter Services", 1, base_fare),
    ]
    
    repositioning = pricing.get("repositioning_charge", 0)
    if repositioning > 0:
        items.append(("996411", "Aircraft Repositioning", 1, repositioning))
    
    landing = pricing.get("landing_charges", 0)
    if landing > 0:
        items.append(("996421", "Landing & Parking Charges", 1, landing))
    
    handling = pricing.get("handling_charges", 0)
    if handling > 0:
        items.append(("996411", "Ground Handling Services", 1, handling))
    
    for sac, desc, qty, amount in items:
        c.drawString(40, y, sac)
        c.drawString(150, y, desc)
        c.drawString(350, y, str(qty))
        c.drawString(400, y, f"{amount:,.0f}")
        c.drawRightString(width - 40, y, f"{amount:,.0f}")
        y -= 20
    
    # Subtotal
    subtotal = sum(amt for _, _, _, amt in items)
    y -= 10
    c.setStrokeColor(gray)
    c.line(30, y + 5, width - 30, y + 5)
    y -= 15
    
    c.setFont("Helvetica-Bold", 10)
    c.drawString(350, y, "Taxable Value:")
    c.drawRightString(width - 40, y, f"₹{subtotal:,.0f}")
    y -= 20
    
    # GST Breakdown (CGST + SGST for intra-state, IGST for inter-state)
    gst_rate = pricing.get("gst_rate", 18)
    gst_amount = pricing.get("gst_amount", subtotal * gst_rate / 100)
    
    is_interstate = invoice_data.get("is_interstate", False)
    
    if is_interstate:
        c.setFont("Helvetica", 10)
        c.drawString(350, y, f"IGST @ {gst_rate}%:")
        c.drawRightString(width - 40, y, f"₹{gst_amount:,.0f}")
        y -= 20
    else:
        half_gst = gst_amount / 2
        c.setFont("Helvetica", 10)
        c.drawString(350, y, f"CGST @ {gst_rate/2}%:")
        c.drawRightString(width - 40, y, f"₹{half_gst:,.0f}")
        y -= 20
        c.drawString(350, y, f"SGST @ {gst_rate/2}%:")
        c.drawRightString(width - 40, y, f"₹{half_gst:,.0f}")
        y -= 20
    
    # Total
    total = subtotal + gst_amount
    y -= 10
    c.setFillColor(dark)
    c.rect(300, y - 5, width - 330, 35, fill=1, stroke=0)
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 12)
    c.drawString(310, y + 10, "TOTAL AMOUNT:")
    c.drawRightString(width - 40, y + 10, f"₹{total:,.0f}")
    
    # Amount in Words
    c.setFillColor(colors.black)
    c.setFont("Helvetica", 9)
    y -= 40
    amount_words = invoice_data.get("amount_in_words", f"Rupees {int(total):,} Only")
    c.drawString(30, y, f"Amount in Words: {amount_words}")
    
    # Bank Details
    y -= 40
    c.setFont("Helvetica-Bold", 10)
    c.drawString(30, y, "Bank Details for Payment:")
    c.setFont("Helvetica", 9)
    c.drawString(30, y - 15, "Account Name: AirYatra Aviation Pvt Ltd")
    c.drawString(30, y - 30, "Account No: 1234567890123")
    c.drawString(30, y - 45, "IFSC: HDFC0001234")
    c.drawString(30, y - 60, "Bank: HDFC Bank, Mumbai")
    
    # Terms & Conditions
    c.drawString(width/2 + 20, y, "Terms & Conditions:")
    c.setFont("Helvetica", 8)
    c.drawString(width/2 + 20, y - 15, "1. Payment due within 30 days")
    c.drawString(width/2 + 20, y - 30, "2. Subject to Mumbai jurisdiction")
    c.drawString(width/2 + 20, y - 45, "3. E&OE (Errors & Omissions Excepted)")
    
    # Footer
    c.setFillColor(gray)
    c.setFont("Helvetica", 8)
    footer_y = 40
    c.drawString(30, footer_y + 10, "This is a computer-generated invoice and does not require a physical signature.")
    c.drawString(30, footer_y - 5, "AirYatra Aviation Pvt Ltd | Regd. Office: Mumbai, Maharashtra | support@airyatra.co.in")
    c.drawRightString(width - 30, footer_y - 5, "Page 1 of 1")
    
    c.save()
    buffer.seek(0)
    return buffer.getvalue()


@router.get("/invoice/{booking_id}/gst")
async def generate_gst_invoice(
    booking_id: str,
    corporate_id: str = Query(..., description="Corporate account ID")
):
    """Generate GST-compliant invoice PDF for corporate booking"""
    db = get_database()
    
    # Get corporate details
    corporate = await db.corporates.find_one(
        {"corporate_id": corporate_id},
        {"_id": 0}
    )
    
    if not corporate:
        raise HTTPException(status_code=404, detail="Corporate account not found")
    
    if not corporate.get("gst_number"):
        raise HTTPException(status_code=400, detail="Corporate account does not have GST number")
    
    # Get booking (corporate bookings first, then platform bookings/inquiries)
    booking = await db.corporate_bookings.find_one({"id": booking_id}, {"_id": 0})
    if not booking:
        booking = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not booking:
        booking = await db.inquiries.find_one({"id": booking_id}, {"_id": 0})
    
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    if booking.get("approval_status") in ["pending", "rejected"]:
        raise HTTPException(status_code=400, detail="Invoice available only for approved bookings")
    
    # Determine if interstate (different state than corporate)
    booking_state = booking.get("to_location", "").split("(")[0].strip() if "(" in booking.get("to_location", "") else ""
    is_interstate = booking_state.lower() != corporate.get("state", "").lower() if booking_state else False
    
    invoice_data = {
        "invoice_number": f"INV-GST-{booking.get('booking_number', booking_id[:8])}",
        "place_of_supply": corporate.get("state", "Maharashtra"),
        "is_interstate": is_interstate,
        "amount_in_words": f"Rupees {int(booking.get('pricing', {}).get('total_amount', booking.get('final_price', 0))):,} Only"
    }
    
    # Generate PDF
    try:
        pdf_bytes = _generate_gst_invoice_pdf(corporate, booking, invoice_data)
        if not pdf_bytes or not pdf_bytes.startswith(b"%PDF"):
            raise HTTPException(status_code=500, detail="Generated GST invoice is not a valid PDF")
        filename = f"AirYatra_GST_Invoice_{booking.get('booking_number', booking_id[:8])}.pdf"
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"',
                "Content-Length": str(len(pdf_bytes)),
                "Cache-Control": "no-store",
                "X-Content-Type-Options": "nosniff",
            },
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate invoice: {str(e)}")
