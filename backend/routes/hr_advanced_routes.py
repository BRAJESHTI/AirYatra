"""
Advanced HR Routes - Part 2
- Sales Target Management
- Employee Expense Reimbursement
- Auto Salary Payment System
"""
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form, BackgroundTasks
from typing import Optional, List
from datetime import datetime, timezone, timedelta
from uuid import uuid4
from enum import Enum
import os
import base64
from database import get_database
from middleware import get_current_user, require_roles
from models import UserRole

router = APIRouter(prefix="/hr", tags=["HR Advanced"])


async def _send_expense_email(employee_id: str, subject: str, title: str, color: str, rows: list, footer: str):
    """Email employee about expense claim status change"""
    try:
        from services.email_service import email_service
        db = get_database()
        emp = await db.users.find_one({"id": employee_id}, {"_id": 0, "email": 1})
        if not emp or not emp.get("email"):
            return
        row_html = "".join(
            f'<tr><td style="padding:6px 12px;color:#64748b;font-size:14px;">{k}</td>'
            f'<td style="padding:6px 12px;color:#0f172a;font-size:14px;font-weight:600;">{v}</td></tr>'
            for k, v in rows
        )
        html = f"""
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
          <div style="background:#0f172a;padding:20px 24px;">
            <span style="color:#fff;font-size:20px;font-weight:bold;">AirYatra</span>
            <span style="color:#f97316;font-size:13px;margin-left:8px;">HRMS</span>
          </div>
          <div style="padding:24px;">
            <h2 style="color:{color};margin:0 0 16px;font-size:18px;">{title}</h2>
            <table style="width:100%;border-collapse:collapse;background:#f8fafc;border-radius:8px;">{row_html}</table>
            <p style="color:#64748b;font-size:12px;margin-top:20px;">{footer}</p>
          </div>
        </div>"""
        await email_service.send_email(to_email=emp["email"], subject=subject, html_body=html)
    except Exception as e:
        print(f"Expense email failed: {e}")


# ==================== ENUMS ====================

class ExpenseStatus(str, Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    HR_PENDING = "hr_pending"
    HR_APPROVED = "hr_approved"
    HR_REJECTED = "hr_rejected"
    FINANCE_PENDING = "finance_pending"
    FINANCE_APPROVED = "finance_approved"
    FINANCE_REJECTED = "finance_rejected"
    ADMIN_PENDING = "admin_pending"
    ADMIN_APPROVED = "admin_approved"
    ADMIN_REJECTED = "admin_rejected"
    APPROVED = "approved"
    REJECTED = "rejected"
    ADDED_TO_SALARY = "added_to_salary"
    PAID = "paid"

class ExpenseCategory(str, Enum):
    TRAVEL = "travel"
    FOOD = "food"
    ACCOMMODATION = "accommodation"
    FUEL = "fuel"
    OFFICE_SUPPLIES = "office_supplies"
    CLIENT_ENTERTAINMENT = "client_entertainment"
    TRAINING = "training"
    MEDICAL = "medical"
    COMMUNICATION = "communication"
    OTHER = "other"

class TargetType(str, Enum):
    MONTHLY = "monthly"
    QUARTERLY = "quarterly"
    YEARLY = "yearly"

class PaymentStatus(str, Enum):
    PENDING = "pending"
    HR_APPROVED = "hr_approved"
    ADMIN_APPROVED = "admin_approved"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


# ==================== SALES TARGET MANAGEMENT ====================

@router.post("/targets/create")
async def create_sales_target(
    target_data: dict,
    current_user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN])),
    db=Depends(get_database)
):
    """
    Create sales target for employee or team
    सेल्स टारगेट बनाएं
    """
    target_id = str(uuid4())
    
    target = {
        "id": target_id,
        "employee_id": target_data.get("employee_id"),  # None for team target
        "employee_name": target_data.get("employee_name"),
        "team_id": target_data.get("team_id"),
        "target_type": target_data.get("target_type", TargetType.MONTHLY.value),
        
        # Period
        "period_start": target_data["period_start"],
        "period_end": target_data["period_end"],
        "month": target_data.get("month"),
        "year": target_data.get("year"),
        
        # Targets
        "revenue_target": target_data.get("revenue_target", 0),
        "leads_target": target_data.get("leads_target", 0),
        "conversions_target": target_data.get("conversions_target", 0),
        "calls_target": target_data.get("calls_target", 0),
        "meetings_target": target_data.get("meetings_target", 0),
        
        # Achievement (will be updated)
        "revenue_achieved": 0,
        "leads_achieved": 0,
        "conversions_achieved": 0,
        "calls_achieved": 0,
        "meetings_achieved": 0,
        
        # Incentive Slabs
        "incentive_slabs": target_data.get("incentive_slabs", [
            {"min_percent": 80, "max_percent": 100, "bonus_percent": 0, "bonus_amount": 0},
            {"min_percent": 100, "max_percent": 110, "bonus_percent": 5, "bonus_amount": 5000},
            {"min_percent": 110, "max_percent": 125, "bonus_percent": 10, "bonus_amount": 10000},
            {"min_percent": 125, "max_percent": 150, "bonus_percent": 15, "bonus_amount": 20000},
            {"min_percent": 150, "max_percent": 999, "bonus_percent": 20, "bonus_amount": 30000},
        ]),
        
        "status": "active",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": current_user["id"]
    }
    
    await db.sales_targets.insert_one(target)
    
    return {
        "message": "Sales target created / सेल्स टारगेट बन गया",
        "target_id": target_id
    }


@router.get("/targets")
async def get_sales_targets(
    employee_id: Optional[str] = None,
    team_id: Optional[str] = None,
    month: Optional[int] = None,
    year: Optional[int] = None,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """Get sales targets"""
    query = {"status": "active"}
    
    if employee_id:
        query["employee_id"] = employee_id
    if team_id:
        query["team_id"] = team_id
    if month:
        query["month"] = month
    if year:
        query["year"] = year
    
    targets = await db.sales_targets.find(query, {"_id": 0}).to_list(100)
    
    # Calculate achievement percentage for each target
    for target in targets:
        revenue_target = target.get("revenue_target", 1)
        revenue_achieved = target.get("revenue_achieved", 0)
        target["revenue_percent"] = round((revenue_achieved / revenue_target) * 100, 2) if revenue_target > 0 else 0
        
        conversions_target = target.get("conversions_target", 1)
        conversions_achieved = target.get("conversions_achieved", 0)
        target["conversions_percent"] = round((conversions_achieved / conversions_target) * 100, 2) if conversions_target > 0 else 0
    
    return {"targets": targets}


@router.get("/targets/my")
async def get_my_targets(
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """Get current user's sales targets"""
    targets = await db.sales_targets.find(
        {"employee_id": current_user["id"], "status": "active"},
        {"_id": 0}
    ).sort("period_start", -1).to_list(12)
    
    return {"targets": targets}


@router.put("/targets/{target_id}/update-achievement")
async def update_target_achievement(
    target_id: str,
    achievement_data: dict,
    current_user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.SALES])),
    db=Depends(get_database)
):
    """Update target achievement"""
    update_fields = {}
    
    if "revenue_achieved" in achievement_data:
        update_fields["revenue_achieved"] = achievement_data["revenue_achieved"]
    if "leads_achieved" in achievement_data:
        update_fields["leads_achieved"] = achievement_data["leads_achieved"]
    if "conversions_achieved" in achievement_data:
        update_fields["conversions_achieved"] = achievement_data["conversions_achieved"]
    if "calls_achieved" in achievement_data:
        update_fields["calls_achieved"] = achievement_data["calls_achieved"]
    if "meetings_achieved" in achievement_data:
        update_fields["meetings_achieved"] = achievement_data["meetings_achieved"]
    
    update_fields["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.sales_targets.update_one(
        {"id": target_id},
        {"$set": update_fields}
    )
    
    return {"message": "Target achievement updated / टारगेट अचीवमेंट अपडेट हो गया"}


@router.get("/targets/leaderboard")
async def get_sales_leaderboard(
    month: Optional[int] = None,
    year: Optional[int] = None,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """Get sales leaderboard based on target achievement"""
    if not month:
        month = datetime.now().month
    if not year:
        year = datetime.now().year
    
    targets = await db.sales_targets.find({
        "month": month,
        "year": year,
        "status": "active"
    }, {"_id": 0}).to_list(100)
    
    # Calculate achievement and sort
    leaderboard = []
    for target in targets:
        if not target.get("employee_id"):
            continue
            
        revenue_target = target.get("revenue_target", 1)
        revenue_achieved = target.get("revenue_achieved", 0)
        achievement_percent = round((revenue_achieved / revenue_target) * 100, 2) if revenue_target > 0 else 0
        
        leaderboard.append({
            "employee_id": target["employee_id"],
            "employee_name": target.get("employee_name", "Unknown"),
            "revenue_target": revenue_target,
            "revenue_achieved": revenue_achieved,
            "achievement_percent": achievement_percent,
            "conversions_achieved": target.get("conversions_achieved", 0),
            "leads_achieved": target.get("leads_achieved", 0)
        })
    
    # Sort by achievement percent
    leaderboard.sort(key=lambda x: x["achievement_percent"], reverse=True)
    
    # Add rank
    for i, entry in enumerate(leaderboard):
        entry["rank"] = i + 1
    
    return {
        "period": f"{datetime(year, month, 1).strftime('%B %Y')}",
        "leaderboard": leaderboard
    }


# ==================== EXPENSE REIMBURSEMENT ====================

@router.post("/expense/create")
async def create_expense_claim(
    expense_data: dict,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """
    Create expense reimbursement claim
    खर्च प्रतिपूर्ति क्लेम बनाएं
    """
    expense_id = str(uuid4())
    
    expense = {
        "id": expense_id,
        "expense_number": f"EXP-{datetime.now().strftime('%Y%m%d')}-{expense_id[:6].upper()}",
        "employee_id": current_user["id"],
        "employee_name": current_user.get("full_name", current_user["email"]),
        "department": current_user.get("department", ""),
        
        # Expense Details
        "category": expense_data.get("category", ExpenseCategory.OTHER.value),
        "title": expense_data["title"],
        "description": expense_data.get("description", ""),
        "expense_date": expense_data["expense_date"],
        "amount": expense_data["amount"],
        "currency": "INR",
        
        # Itemized expenses (optional)
        "items": expense_data.get("items", []),
        
        # Supporting Documents
        "documents": expense_data.get("documents", []),  # List of {filename, url, type}
        
        # Approval Workflow
        "status": ExpenseStatus.DRAFT.value,
        "approval_flow": [
            {"role": "hr", "status": "pending", "approved_by": None, "approved_at": None, "comments": None},
            {"role": "finance", "status": "pending", "approved_by": None, "approved_at": None, "comments": None},
            {"role": "admin", "status": "pending", "approved_by": None, "approved_at": None, "comments": None}
        ],
        "current_approval_stage": 0,  # 0=HR, 1=Finance, 2=Admin
        
        # Payment
        "added_to_salary_month": None,
        "added_to_salary_year": None,
        "payment_status": "pending",
        "paid_at": None,
        "payment_reference": None,
        
        # Timestamps
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "submitted_at": None
    }
    
    await db.expense_claims.insert_one(expense)
    
    return {
        "message": "Expense claim created / खर्च क्लेम बन गया",
        "expense_id": expense_id,
        "expense_number": expense["expense_number"]
    }


@router.post("/expense/{expense_id}/upload-document")
async def upload_expense_document(
    expense_id: str,
    file: UploadFile = File(...),
    document_type: str = Form(default="receipt"),
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """Upload document for expense claim"""
    expense = await db.expense_claims.find_one({"id": expense_id, "employee_id": current_user["id"]})
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    
    # Read file content
    content = await file.read()
    
    # Save to uploads directory
    upload_dir = "/app/uploads/expense_documents"
    os.makedirs(upload_dir, exist_ok=True)
    
    file_ext = file.filename.split(".")[-1] if "." in file.filename else "pdf"
    saved_filename = f"{expense_id}_{str(uuid4())[:8]}.{file_ext}"
    file_path = f"{upload_dir}/{saved_filename}"
    
    with open(file_path, "wb") as f:
        f.write(content)
    
    document = {
        "id": str(uuid4()),
        "filename": file.filename,
        "saved_filename": saved_filename,
        "url": f"/api/uploads/expense_documents/{saved_filename}",
        "type": document_type,
        "size": len(content),
        "uploaded_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.expense_claims.update_one(
        {"id": expense_id},
        {"$push": {"documents": document}}
    )
    
    return {
        "message": "Document uploaded / दस्तावेज़ अपलोड हो गया",
        "document": document
    }


@router.put("/expense/{expense_id}/submit")
async def submit_expense_claim(
    expense_id: str,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """Submit expense claim for approval"""
    expense = await db.expense_claims.find_one({"id": expense_id, "employee_id": current_user["id"]})
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    
    if expense["status"] != ExpenseStatus.DRAFT.value:
        raise HTTPException(status_code=400, detail="Expense already submitted")
    
    if not expense.get("documents") or len(expense["documents"]) == 0:
        raise HTTPException(status_code=400, detail="Please attach at least one document / कृपया कम से कम एक दस्तावेज़ संलग्न करें")
    
    await db.expense_claims.update_one(
        {"id": expense_id},
        {"$set": {
            "status": ExpenseStatus.HR_PENDING.value,
            "submitted_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Create notification for HR
    await db.notifications.insert_one({
        "id": str(uuid4()),
        "user_role": "hr",
        "type": "expense_approval",
        "title": "New Expense Claim for Approval",
        "message": f"Expense claim {expense['expense_number']} (₹{expense['amount']}) submitted by {expense['employee_name']}",
        "reference_id": expense_id,
        "is_read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {"message": "Expense submitted for approval / खर्च अनुमोदन के लिए जमा"}


@router.get("/expense/my")
async def get_my_expenses(
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """Get current user's expense claims"""
    query = {"employee_id": current_user["id"]}
    if status:
        query["status"] = status
    
    expenses = await db.expense_claims.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    
    # Summary
    total_pending = sum(e["amount"] for e in expenses if e["status"] in ["hr_pending", "finance_pending", "admin_pending"])
    total_approved = sum(e["amount"] for e in expenses if e["status"] == "approved")
    total_paid = sum(e["amount"] for e in expenses if e["status"] in ["added_to_salary", "paid"])
    
    return {
        "expenses": expenses,
        "summary": {
            "total_claims": len(expenses),
            "total_pending": total_pending,
            "total_approved": total_approved,
            "total_paid": total_paid
        }
    }


@router.get("/expense/pending")
async def get_pending_expenses(
    role: str = "hr",  # hr, finance, admin
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """Get pending expenses for approval based on role"""
    status_map = {
        "hr": ExpenseStatus.HR_PENDING.value,
        "finance": ExpenseStatus.FINANCE_PENDING.value,
        "admin": ExpenseStatus.ADMIN_PENDING.value
    }
    
    status = status_map.get(role, ExpenseStatus.HR_PENDING.value)
    
    expenses = await db.expense_claims.find(
        {"status": status},
        {"_id": 0}
    ).sort("submitted_at", 1).to_list(100)
    
    return {
        "pending_expenses": expenses,
        "count": len(expenses),
        "total_amount": sum(e["amount"] for e in expenses)
    }


@router.put("/expense/{expense_id}/approve")
async def approve_expense(
    expense_id: str,
    approval_data: dict,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """
    Approve expense claim (HR -> Finance -> Admin)
    खर्च क्लेम स्वीकृत करें
    """
    expense = await db.expense_claims.find_one({"id": expense_id})
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    
    current_status = expense["status"]
    role = approval_data.get("role", "hr")
    comments = approval_data.get("comments", "")
    
    # Determine next status based on current status and approver role
    next_status_map = {
        ExpenseStatus.HR_PENDING.value: ExpenseStatus.FINANCE_PENDING.value,
        ExpenseStatus.FINANCE_PENDING.value: ExpenseStatus.ADMIN_PENDING.value,
        ExpenseStatus.ADMIN_PENDING.value: ExpenseStatus.APPROVED.value
    }
    
    next_status = next_status_map.get(current_status)
    if not next_status:
        raise HTTPException(status_code=400, detail="Invalid expense status for approval")
    
    # Update approval flow
    stage_map = {
        ExpenseStatus.HR_PENDING.value: 0,
        ExpenseStatus.FINANCE_PENDING.value: 1,
        ExpenseStatus.ADMIN_PENDING.value: 2
    }
    stage = stage_map.get(current_status, 0)
    
    approval_flow = expense.get("approval_flow", [])
    if stage < len(approval_flow):
        approval_flow[stage]["status"] = "approved"
        approval_flow[stage]["approved_by"] = current_user["id"]
        approval_flow[stage]["approver_name"] = current_user.get("full_name")
        approval_flow[stage]["approved_at"] = datetime.now(timezone.utc).isoformat()
        approval_flow[stage]["comments"] = comments
    
    await db.expense_claims.update_one(
        {"id": expense_id},
        {"$set": {
            "status": next_status,
            "approval_flow": approval_flow,
            "current_approval_stage": stage + 1,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Notify employee if fully approved
    if next_status == ExpenseStatus.APPROVED.value:
        await db.notifications.insert_one({
            "id": str(uuid4()),
            "user_id": expense["employee_id"],
            "type": "expense_approved",
            "title": "Expense Claim Approved!",
            "message": f"Your expense claim {expense['expense_number']} (₹{expense['amount']}) has been approved and will be added to your next salary.",
            "reference_id": expense_id,
            "is_read": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        background_tasks.add_task(
            _send_expense_email,
            expense["employee_id"],
            f"✅ Expense Approved — {expense['expense_number']} (₹{expense['amount']:,.0f})",
            "✅ Expense Claim Approved / खर्च क्लेम स्वीकृत",
            "#22c55e",
            [
                ("Claim", f"{expense['title']} ({expense['expense_number']})"),
                ("Amount", f"Rs. {expense['amount']:,.2f}"),
                ("Category", expense.get("category", "").replace("_", " ").title()),
                ("Status", "APPROVED"),
            ],
            "The amount will be reimbursed with your next salary payout.",
        )
    
    return {
        "message": f"Expense approved by {role.upper()} / खर्च {role.upper()} द्वारा स्वीकृत",
        "next_status": next_status
    }


@router.put("/expense/{expense_id}/reject")
async def reject_expense(
    expense_id: str,
    rejection_data: dict,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """Reject expense claim"""
    expense = await db.expense_claims.find_one({"id": expense_id})
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    
    role = rejection_data.get("role", "hr")
    reason = rejection_data.get("reason", "")
    
    status_map = {
        "hr": ExpenseStatus.HR_REJECTED.value,
        "finance": ExpenseStatus.FINANCE_REJECTED.value,
        "admin": ExpenseStatus.ADMIN_REJECTED.value
    }
    
    await db.expense_claims.update_one(
        {"id": expense_id},
        {"$set": {
            "status": status_map.get(role, ExpenseStatus.REJECTED.value),
            "rejection_reason": reason,
            "rejected_by": current_user["id"],
            "rejected_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Notify employee
    await db.notifications.insert_one({
        "id": str(uuid4()),
        "user_id": expense["employee_id"],
        "type": "expense_rejected",
        "title": "Expense Claim Rejected",
        "message": f"Your expense claim {expense['expense_number']} (₹{expense['amount']}) was rejected. Reason: {reason}",
        "reference_id": expense_id,
        "is_read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    background_tasks.add_task(
        _send_expense_email,
        expense["employee_id"],
        f"❌ Expense Rejected — {expense['expense_number']}",
        "❌ Expense Claim Rejected / खर्च क्लेम अस्वीकृत",
        "#ef4444",
        [
            ("Claim", f"{expense['title']} ({expense['expense_number']})"),
            ("Amount", f"Rs. {expense['amount']:,.2f}"),
            ("Rejected By", role.upper()),
            ("Reason", reason or "—"),
        ],
        "Please contact HR for clarification or resubmit with correct details.",
    )
    return {"message": "Expense rejected / खर्च अस्वीकृत"}


@router.post("/expense/add-to-salary")
async def add_expenses_to_salary(
    data: dict,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.FINANCE])),
    db=Depends(get_database)
):
    """Add approved expenses to monthly salary"""
    month = data.get("month", datetime.now().month)
    year = data.get("year", datetime.now().year)
    
    # Get all approved expenses not yet added to salary
    approved_expenses = await db.expense_claims.find({
        "status": ExpenseStatus.APPROVED.value,
        "added_to_salary_month": None
    }, {"_id": 0}).to_list(1000)
    
    added_count = 0
    total_amount = 0
    
    for expense in approved_expenses:
        # Update expense status
        await db.expense_claims.update_one(
            {"id": expense["id"]},
            {"$set": {
                "status": ExpenseStatus.ADDED_TO_SALARY.value,
                "added_to_salary_month": month,
                "added_to_salary_year": year,
                "added_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        # Update payroll if exists
        await db.payroll.update_one(
            {
                "employee_id": expense["employee_id"],
                "month": month,
                "year": year
            },
            {
                "$inc": {
                    "reimbursements": expense["amount"],
                    "net_salary": expense["amount"]
                },
                "$push": {
                    "expense_claims": {
                        "expense_id": expense["id"],
                        "expense_number": expense["expense_number"],
                        "amount": expense["amount"],
                        "category": expense["category"]
                    }
                }
            }
        )
        
        added_count += 1
        total_amount += expense["amount"]
        
        period_label = datetime(year, month, 1).strftime("%B %Y")
        background_tasks.add_task(
            _send_expense_email,
            expense["employee_id"],
            f"💰 Expense Reimbursed — {expense['expense_number']} (₹{expense['amount']:,.0f})",
            "💰 Expense Reimbursed / खर्च का भुगतान",
            "#f97316",
            [
                ("Claim", f"{expense['title']} ({expense['expense_number']})"),
                ("Amount", f"Rs. {expense['amount']:,.2f}"),
                ("Added To", f"{period_label} salary"),
                ("Status", "REIMBURSED"),
            ],
            "The amount has been added to your salary for this period. Check your payslip in the Employee Portal.",
        )
    
    return {
        "message": f"Added {added_count} expenses to salary / {added_count} खर्च सैलरी में जोड़े गए",
        "total_amount": total_amount,
        "month": month,
        "year": year
    }


# ==================== AUTO SALARY PAYMENT ====================

@router.get("/salary/bank-details/{employee_id}")
async def get_employee_bank_details(
    employee_id: str,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """Get employee bank details for salary payment"""
    # Check authorization
    if current_user["id"] != employee_id and "admin" not in current_user.get("roles", []):
        raise HTTPException(status_code=403, detail="Not authorized")
    
    bank_details = await db.employee_bank_details.find_one(
        {"employee_id": employee_id},
        {"_id": 0}
    )
    
    return {"bank_details": bank_details}


@router.post("/salary/bank-details")
async def save_employee_bank_details(
    bank_data: dict,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """Save employee bank details"""
    employee_id = bank_data.get("employee_id", current_user["id"])
    
    # Only admin can set others' bank details
    if employee_id != current_user["id"] and "admin" not in current_user.get("roles", []):
        raise HTTPException(status_code=403, detail="Not authorized")
    
    bank_details = {
        "employee_id": employee_id,
        "account_holder_name": bank_data["account_holder_name"],
        "bank_name": bank_data["bank_name"],
        "branch_name": bank_data.get("branch_name", ""),
        "account_number": bank_data["account_number"],
        "ifsc_code": bank_data["ifsc_code"],
        "account_type": bank_data.get("account_type", "savings"),
        "is_verified": False,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.employee_bank_details.update_one(
        {"employee_id": employee_id},
        {"$set": bank_details},
        upsert=True
    )
    
    return {"message": "Bank details saved / बैंक विवरण सहेजे गए"}


@router.post("/salary/calculate-auto")
async def calculate_auto_salary(
    data: dict,
    current_user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.HR])),
    db=Depends(get_database)
):
    """
    Auto calculate salary based on attendance
    उपस्थिति के आधार पर स्वचालित वेतन गणना
    """
    month = data.get("month", datetime.now().month)
    year = data.get("year", datetime.now().year)
    employee_ids = data.get("employee_ids")  # Optional - specific employees
    
    # Get salary config
    salary_config = await db.salary_config.find_one({"type": "salary_settings"}, {"_id": 0})
    working_days_in_month = salary_config.get("working_days_per_month", 26) if salary_config else 26
    
    # Get employees
    query = {"is_active": True}
    if employee_ids:
        query["id"] = {"$in": employee_ids}
    
    employees = await db.users.find(query, {"_id": 0}).to_list(500)
    
    calculations = []
    
    for emp in employees:
        # Get salary structure
        salary = await db.employee_salaries.find_one(
            {"employee_id": emp["id"], "status": "active"},
            {"_id": 0}
        )
        
        if not salary:
            continue
        
        # Get attendance
        start_date = f"{year}-{month:02d}-01"
        if month == 12:
            end_date = f"{year + 1}-01-01"
        else:
            end_date = f"{year}-{month + 1:02d}-01"
        
        attendance_records = await db.attendance.find({
            "employee_id": emp["id"],
            "date": {"$gte": start_date, "$lt": end_date}
        }, {"_id": 0}).to_list(31)
        
        present_days = len([a for a in attendance_records if a.get("status") == "present"])
        half_days = len([a for a in attendance_records if a.get("status") == "half_day"])
        leaves = len([a for a in attendance_records if a.get("status") == "on_leave"])
        effective_days = present_days + (half_days * 0.5)
        
        # Calculate pro-rata salary
        daily_rate = salary["gross_salary"] / working_days_in_month
        earned_gross = round(daily_rate * effective_days, 2)
        
        # Deductions
        pf = round(salary.get("basic_salary", 0) * 0.12 * (effective_days / working_days_in_month), 2)
        esi = round(earned_gross * 0.0075, 2) if earned_gross <= 21000 else 0
        pt = 200 if earned_gross > 15000 else 0
        
        # Get approved reimbursements
        reimbursements = await db.expense_claims.find({
            "employee_id": emp["id"],
            "status": ExpenseStatus.APPROVED.value,
            "added_to_salary_month": None
        }, {"_id": 0}).to_list(100)
        
        total_reimbursements = sum(r["amount"] for r in reimbursements)
        
        # Get incentives
        incentives_data = await db.incentive_calculations.find_one({
            "employee_id": emp["id"],
            "month": month,
            "year": year
        }, {"_id": 0})
        
        incentives = incentives_data.get("total_incentive", 0) if incentives_data else 0
        
        # Net salary
        total_deductions = pf + esi + pt
        net_salary = round(earned_gross + incentives + total_reimbursements - total_deductions, 2)
        
        calculation = {
            "employee_id": emp["id"],
            "employee_name": emp.get("full_name", emp["email"]),
            "month": month,
            "year": year,
            
            # Attendance
            "working_days": working_days_in_month,
            "present_days": present_days,
            "half_days": half_days,
            "leaves": leaves,
            "effective_days": effective_days,
            
            # Earnings
            "basic": round(salary.get("basic_salary", 0) * (effective_days / working_days_in_month), 2),
            "hra": round(salary.get("hra", 0) * (effective_days / working_days_in_month), 2),
            "allowances": round((salary.get("conveyance", 0) + salary.get("medical_allowance", 0) + salary.get("special_allowance", 0)) * (effective_days / working_days_in_month), 2),
            "incentives": incentives,
            "reimbursements": total_reimbursements,
            "gross_earnings": round(earned_gross + incentives + total_reimbursements, 2),
            
            # Deductions
            "pf": pf,
            "esi": esi,
            "professional_tax": pt,
            "total_deductions": total_deductions,
            
            # Net
            "net_salary": net_salary,
            
            "status": PaymentStatus.PENDING.value
        }
        
        calculations.append(calculation)
    
    return {
        "message": f"Salary calculated for {len(calculations)} employees",
        "period": f"{datetime(year, month, 1).strftime('%B %Y')}",
        "calculations": calculations,
        "total_payout": sum(c["net_salary"] for c in calculations)
    }


@router.post("/salary/initiate-payment")
async def initiate_salary_payment(
    payment_data: dict,
    current_user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN])),
    db=Depends(get_database)
):
    """
    Initiate auto salary payment after HR/Admin approval
    HR/Admin अनुमोदन के बाद स्वचालित वेतन भुगतान शुरू करें
    """
    month = payment_data.get("month", datetime.now().month)
    year = payment_data.get("year", datetime.now().year)
    payroll_ids = payment_data.get("payroll_ids", [])
    
    # Get approved payrolls
    query = {
        "month": month,
        "year": year,
        "status": "approved"
    }
    if payroll_ids:
        query["id"] = {"$in": payroll_ids}
    
    payrolls = await db.payroll.find(query, {"_id": 0}).to_list(500)
    
    payment_batch_id = str(uuid4())
    payments_initiated = []
    
    for payroll in payrolls:
        # Get bank details
        bank_details = await db.employee_bank_details.find_one(
            {"employee_id": payroll["employee_id"]},
            {"_id": 0}
        )
        
        if not bank_details:
            continue
        
        payment_id = str(uuid4())
        payment_record = {
            "id": payment_id,
            "batch_id": payment_batch_id,
            "payroll_id": payroll["id"],
            "employee_id": payroll["employee_id"],
            "employee_name": payroll["employee_name"],
            "amount": payroll["net_salary"],
            
            # Bank Details
            "bank_name": bank_details["bank_name"],
            "account_number": bank_details["account_number"][-4:].rjust(len(bank_details["account_number"]), "*"),  # Masked
            "ifsc_code": bank_details["ifsc_code"],
            
            # Status
            "status": PaymentStatus.PROCESSING.value,
            "initiated_by": current_user["id"],
            "initiated_at": datetime.now(timezone.utc).isoformat(),
            
            # Payment details (to be updated after actual transfer)
            "utr_number": None,
            "payment_date": None,
            "payment_mode": "NEFT/IMPS",
            "remarks": f"Salary for {datetime(year, month, 1).strftime('%B %Y')}"
        }
        
        await db.salary_payments.insert_one(payment_record)
        
        # Update payroll status
        await db.payroll.update_one(
            {"id": payroll["id"]},
            {"$set": {
                "status": "payment_processing",
                "payment_id": payment_id
            }}
        )
        
        payments_initiated.append({
            "payment_id": payment_id,
            "employee_name": payroll["employee_name"],
            "amount": payroll["net_salary"]
        })
    
    return {
        "message": f"Payment initiated for {len(payments_initiated)} employees",
        "batch_id": payment_batch_id,
        "payments": payments_initiated,
        "total_amount": sum(p["amount"] for p in payments_initiated),
        "note": "Actual bank transfer will be processed by integrated payment gateway"
    }


@router.put("/salary/payment/{payment_id}/complete")
async def complete_salary_payment(
    payment_id: str,
    completion_data: dict,
    current_user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.FINANCE])),
    db=Depends(get_database)
):
    """Mark salary payment as completed after bank transfer"""
    payment = await db.salary_payments.find_one({"id": payment_id})
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    
    await db.salary_payments.update_one(
        {"id": payment_id},
        {"$set": {
            "status": PaymentStatus.COMPLETED.value,
            "utr_number": completion_data.get("utr_number"),
            "payment_date": completion_data.get("payment_date", datetime.now(timezone.utc).isoformat()),
            "completed_by": current_user["id"],
            "completed_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Update payroll
    await db.payroll.update_one(
        {"id": payment["payroll_id"]},
        {"$set": {
            "status": "paid",
            "paid_at": datetime.now(timezone.utc).isoformat(),
            "payment_reference": completion_data.get("utr_number")
        }}
    )
    
    # Notify employee
    await db.notifications.insert_one({
        "id": str(uuid4()),
        "user_id": payment["employee_id"],
        "type": "salary_paid",
        "title": "Salary Credited! 💰",
        "message": f"Your salary of ₹{payment['amount']:,.2f} has been credited to your bank account.",
        "reference_id": payment_id,
        "is_read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {"message": "Payment marked as completed / भुगतान पूर्ण"}


@router.get("/salary/payment-history")
async def get_payment_history(
    employee_id: Optional[str] = None,
    month: Optional[int] = None,
    year: Optional[int] = None,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """Get salary payment history"""
    query = {}
    
    # Non-admin can only see their own
    if "admin" not in current_user.get("roles", []) and "finance" not in current_user.get("roles", []):
        query["employee_id"] = current_user["id"]
    elif employee_id:
        query["employee_id"] = employee_id
    
    if month and year:
        # Get payroll IDs for the month
        payrolls = await db.payroll.find(
            {"month": month, "year": year},
            {"id": 1}
        ).to_list(500)
        query["payroll_id"] = {"$in": [p["id"] for p in payrolls]}
    
    payments = await db.salary_payments.find(query, {"_id": 0}).sort("initiated_at", -1).to_list(100)
    
    return {
        "payments": payments,
        "total_paid": sum(p["amount"] for p in payments if p["status"] == PaymentStatus.COMPLETED.value)
    }
