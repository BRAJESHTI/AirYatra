"""
HR Management Routes
Incentives, Attendance, Salary, Leave Management
"""
from fastapi import APIRouter, HTTPException, Depends, Query, BackgroundTasks
from typing import Optional, List
from datetime import datetime, timezone, timedelta, date
from uuid import uuid4
from pydantic import BaseModel
from enum import Enum
from database import get_database
from middleware import get_current_user, require_roles
from models import UserRole

router = APIRouter(prefix="/hr", tags=["HR Management"])


# ============== ENUMS ==============

class IncentiveType(str, Enum):
    PER_LEAD = "per_lead"
    PER_CONVERSION = "per_conversion"
    REVENUE_PERCENT = "revenue_percent"
    TARGET_BONUS = "target_bonus"
    PERFORMANCE_BONUS = "performance_bonus"

class LeaveType(str, Enum):
    CASUAL = "casual"
    SICK = "sick"
    EARNED = "earned"
    UNPAID = "unpaid"
    MATERNITY = "maternity"
    PATERNITY = "paternity"

class LeaveStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    CANCELLED = "cancelled"

class AttendanceStatus(str, Enum):
    PRESENT = "present"
    ABSENT = "absent"
    HALF_DAY = "half_day"
    ON_LEAVE = "on_leave"
    HOLIDAY = "holiday"
    WORK_FROM_HOME = "wfh"

class EmployeeType(str, Enum):
    SALES = "sales"
    SALES_MANAGER = "sales_manager"
    OFFICE_STAFF = "office_staff"
    FIELD_EXECUTIVE = "field_executive"
    ADMIN = "admin"
    MANAGER = "manager"


# ==================== INCENTIVE CONFIGURATION ====================

@router.get("/incentive-config")
async def get_incentive_config(
    current_user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN])),
    db=Depends(get_database)
):
    """Get incentive configuration settings"""
    config = await db.incentive_config.find_one({"type": "incentive_settings"}, {"_id": 0})
    
    if not config:
        # Default configuration
        config = {
            "type": "incentive_settings",
            "incentives_enabled": True,
            
            # Per Lead Incentive
            "per_lead_enabled": True,
            "per_lead_amount": 100,  # ₹100 per lead
            "per_lead_qualified_only": False,  # Only for qualified leads
            
            # Per Conversion Incentive
            "per_conversion_enabled": True,
            "per_conversion_amount": 500,  # ₹500 per conversion
            "per_conversion_min_value": 0,  # Minimum booking value
            
            # Revenue Percentage
            "revenue_percent_enabled": True,
            "revenue_percent": 1,  # 1% of revenue
            "revenue_percent_cap": 50000,  # Max ₹50,000 per month
            
            # Target Achievement Bonus
            "target_bonus_enabled": True,
            "target_bonus_slabs": [
                {"min_percent": 100, "max_percent": 110, "bonus_amount": 5000, "bonus_percent": 0},
                {"min_percent": 110, "max_percent": 125, "bonus_amount": 10000, "bonus_percent": 0},
                {"min_percent": 125, "max_percent": 150, "bonus_amount": 15000, "bonus_percent": 5},
                {"min_percent": 150, "max_percent": 999, "bonus_amount": 25000, "bonus_percent": 10},
            ],
            
            # Performance Bonus (Quarterly)
            "performance_bonus_enabled": True,
            "performance_bonus_criteria": {
                "min_conversions": 10,
                "min_revenue": 500000,
                "bonus_amount": 10000
            },
            
            # Deductions for missed targets
            "penalty_enabled": False,
            "penalty_below_percent": 50,  # If below 50% target
            "penalty_amount": 0,
        }
        await db.incentive_config.insert_one(config)
    
    return config


@router.post("/incentive-config")
async def update_incentive_config(
    config_data: dict,
    current_user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN])),
    db=Depends(get_database)
):
    """Update incentive configuration"""
    config_data["type"] = "incentive_settings"
    config_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    config_data["updated_by"] = current_user["id"]
    
    await db.incentive_config.update_one(
        {"type": "incentive_settings"},
        {"$set": config_data},
        upsert=True
    )
    
    # Audit log
    await db.audit_logs.insert_one({
        "id": str(uuid4()),
        "action": "incentive_config_update",
        "entity_type": "hr_settings",
        "user_id": current_user["id"],
        "user_name": current_user.get("full_name"),
        "changes": {"incentives_enabled": config_data.get("incentives_enabled")},
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {"message": "Incentive configuration updated"}


@router.get("/incentive-calculation/{employee_id}")
async def calculate_employee_incentives(
    employee_id: str,
    month: Optional[int] = None,
    year: Optional[int] = None,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """Calculate incentives for an employee for a given month"""
    if not month:
        month = datetime.now().month
    if not year:
        year = datetime.now().year
    
    # Get incentive config
    config = await db.incentive_config.find_one({"type": "incentive_settings"}, {"_id": 0})
    if not config or not config.get("incentives_enabled"):
        return {"message": "Incentives are disabled", "total_incentive": 0}
    
    # Calculate date range
    start_date = datetime(year, month, 1, tzinfo=timezone.utc)
    if month == 12:
        end_date = datetime(year + 1, 1, 1, tzinfo=timezone.utc)
    else:
        end_date = datetime(year, month + 1, 1, tzinfo=timezone.utc)
    
    incentive_breakdown = {
        "employee_id": employee_id,
        "month": month,
        "year": year,
        "period": f"{start_date.strftime('%B %Y')}",
    }
    
    total_incentive = 0
    
    # 1. Per Lead Incentive
    if config.get("per_lead_enabled"):
        lead_query = {
            "assigned_to": employee_id,
            "created_at": {"$gte": start_date.isoformat(), "$lt": end_date.isoformat()}
        }
        if config.get("per_lead_qualified_only"):
            lead_query["status"] = {"$in": ["qualified", "proposal_sent", "negotiation", "won"]}
        
        lead_count = await db.crm_leads.count_documents(lead_query)
        lead_incentive = lead_count * config.get("per_lead_amount", 0)
        
        incentive_breakdown["leads"] = {
            "count": lead_count,
            "rate": config.get("per_lead_amount", 0),
            "amount": lead_incentive
        }
        total_incentive += lead_incentive
    
    # 2. Per Conversion Incentive
    if config.get("per_conversion_enabled"):
        conversion_count = await db.crm_leads.count_documents({
            "assigned_to": employee_id,
            "status": "won",
            "converted_at": {"$gte": start_date.isoformat(), "$lt": end_date.isoformat()}
        })
        conversion_incentive = conversion_count * config.get("per_conversion_amount", 0)
        
        incentive_breakdown["conversions"] = {
            "count": conversion_count,
            "rate": config.get("per_conversion_amount", 0),
            "amount": conversion_incentive
        }
        total_incentive += conversion_incentive
    
    # 3. Revenue Percentage
    if config.get("revenue_percent_enabled"):
        # Get bookings from converted leads
        pipeline = [
            {"$match": {
                "sales_person_id": employee_id,
                "status": {"$in": ["confirmed", "completed"]},
                "created_at": {"$gte": start_date.isoformat(), "$lt": end_date.isoformat()}
            }},
            {"$group": {"_id": None, "total_revenue": {"$sum": "$total_amount"}}}
        ]
        revenue_result = await db.bookings.aggregate(pipeline).to_list(1)
        total_revenue = revenue_result[0]["total_revenue"] if revenue_result else 0
        
        revenue_incentive = total_revenue * (config.get("revenue_percent", 0) / 100)
        revenue_cap = config.get("revenue_percent_cap", 50000)
        revenue_incentive = min(revenue_incentive, revenue_cap)
        
        incentive_breakdown["revenue"] = {
            "total_revenue": total_revenue,
            "percent": config.get("revenue_percent", 0),
            "cap": revenue_cap,
            "amount": round(revenue_incentive, 2)
        }
        total_incentive += revenue_incentive
    
    # 4. Target Achievement Bonus
    if config.get("target_bonus_enabled"):
        # Get target for this period
        target = await db.crm_targets.find_one({
            "sales_person_id": employee_id,
            "period_start": {"$lte": end_date.isoformat()},
            "period_end": {"$gte": start_date.isoformat()}
        }, {"_id": 0})
        
        if target:
            # Calculate achievement percentage
            actual_conversions = incentive_breakdown.get("conversions", {}).get("count", 0)
            target_conversions = target.get("conversions_target", 1)
            achievement_percent = (actual_conversions / target_conversions * 100) if target_conversions > 0 else 0
            
            # Find applicable slab
            target_bonus = 0
            applicable_slab = None
            for slab in config.get("target_bonus_slabs", []):
                if slab["min_percent"] <= achievement_percent < slab["max_percent"]:
                    target_bonus = slab["bonus_amount"]
                    if slab.get("bonus_percent"):
                        target_bonus += total_incentive * (slab["bonus_percent"] / 100)
                    applicable_slab = slab
                    break
            
            incentive_breakdown["target_achievement"] = {
                "target_conversions": target_conversions,
                "actual_conversions": actual_conversions,
                "achievement_percent": round(achievement_percent, 2),
                "applicable_slab": applicable_slab,
                "amount": round(target_bonus, 2)
            }
            total_incentive += target_bonus
    
    incentive_breakdown["total_incentive"] = round(total_incentive, 2)
    
    return incentive_breakdown


@router.get("/incentive-report")
async def get_incentive_report(
    month: Optional[int] = None,
    year: Optional[int] = None,
    current_user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN])),
    db=Depends(get_database)
):
    """Get incentive report for all employees"""
    if not month:
        month = datetime.now().month
    if not year:
        year = datetime.now().year
    
    # Get all sales employees
    sales_users = await db.users.find({
        "role": {"$in": ["sales", "sales_manager"]},
        "status": "active"
    }, {"_id": 0, "id": 1, "full_name": 1, "email": 1, "role": 1}).to_list(100)
    
    report = []
    for user in sales_users:
        incentives = await calculate_employee_incentives(
            user["id"], month, year, current_user, db
        )
        incentives["employee_name"] = user.get("full_name", user["email"])
        incentives["employee_email"] = user["email"]
        incentives["role"] = user["role"]
        report.append(incentives)
    
    return {
        "period": f"{datetime(year, month, 1).strftime('%B %Y')}",
        "report": report,
        "total_incentives": sum(r.get("total_incentive", 0) for r in report)
    }


# ==================== ATTENDANCE MANAGEMENT ====================

@router.post("/attendance/check-in")
async def check_in(
    location_data: dict,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """Employee check-in with location"""
    today = datetime.now(timezone.utc).date().isoformat()
    
    # Check if already checked in today
    existing = await db.attendance.find_one({
        "employee_id": current_user["id"],
        "date": today,
        "check_out_time": None
    })
    
    if existing:
        raise HTTPException(status_code=400, detail="Already checked in today")
    
    attendance_id = str(uuid4())
    check_in_time = datetime.now(timezone.utc)
    
    attendance = {
        "id": attendance_id,
        "employee_id": current_user["id"],
        "employee_name": current_user.get("full_name", current_user["email"]),
        "date": today,
        "check_in_time": check_in_time.isoformat(),
        "check_in_location": {
            "latitude": location_data.get("latitude"),
            "longitude": location_data.get("longitude"),
            "address": location_data.get("address", ""),
            "accuracy": location_data.get("accuracy")
        },
        "check_out_time": None,
        "check_out_location": None,
        "total_hours": 0,
        "status": AttendanceStatus.PRESENT.value,
        "notes": location_data.get("notes", ""),
        "created_at": check_in_time.isoformat()
    }
    
    await db.attendance.insert_one(attendance)
    
    return {
        "message": "Check-in successful",
        "attendance_id": attendance_id,
        "check_in_time": check_in_time.isoformat()
    }


@router.post("/attendance/check-out")
async def check_out(
    location_data: dict,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """Employee check-out with location"""
    today = datetime.now(timezone.utc).date().isoformat()
    
    # Find today's check-in
    attendance = await db.attendance.find_one({
        "employee_id": current_user["id"],
        "date": today,
        "check_out_time": None
    })
    
    if not attendance:
        raise HTTPException(status_code=400, detail="No check-in found for today")
    
    check_out_time = datetime.now(timezone.utc)
    check_in_time = datetime.fromisoformat(attendance["check_in_time"].replace('Z', '+00:00'))
    
    # Calculate total hours
    total_seconds = (check_out_time - check_in_time).total_seconds()
    total_hours = round(total_seconds / 3600, 2)
    
    # Determine status (half day if less than 4 hours)
    status = AttendanceStatus.PRESENT.value if total_hours >= 4 else AttendanceStatus.HALF_DAY.value
    
    await db.attendance.update_one(
        {"id": attendance["id"]},
        {"$set": {
            "check_out_time": check_out_time.isoformat(),
            "check_out_location": {
                "latitude": location_data.get("latitude"),
                "longitude": location_data.get("longitude"),
                "address": location_data.get("address", ""),
                "accuracy": location_data.get("accuracy")
            },
            "total_hours": total_hours,
            "status": status
        }}
    )
    
    return {
        "message": "Check-out successful",
        "check_out_time": check_out_time.isoformat(),
        "total_hours": total_hours,
        "status": status
    }


@router.get("/attendance/my")
async def get_my_attendance(
    month: Optional[int] = None,
    year: Optional[int] = None,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """Get current user's attendance for a month"""
    if not month:
        month = datetime.now().month
    if not year:
        year = datetime.now().year
    
    start_date = f"{year}-{month:02d}-01"
    if month == 12:
        end_date = f"{year + 1}-01-01"
    else:
        end_date = f"{year}-{month + 1:02d}-01"
    
    attendance = await db.attendance.find({
        "employee_id": current_user["id"],
        "date": {"$gte": start_date, "$lt": end_date}
    }, {"_id": 0}).sort("date", -1).to_list(31)
    
    # Calculate summary
    present_days = len([a for a in attendance if a["status"] == "present"])
    half_days = len([a for a in attendance if a["status"] == "half_day"])
    total_hours = sum(a.get("total_hours", 0) for a in attendance)
    
    return {
        "month": month,
        "year": year,
        "attendance": attendance,
        "summary": {
            "present_days": present_days,
            "half_days": half_days,
            "total_working_days": present_days + (half_days * 0.5),
            "total_hours": round(total_hours, 2),
            "average_hours": round(total_hours / max(len(attendance), 1), 2)
        }
    }


@router.get("/attendance/report")
async def get_attendance_report(
    month: Optional[int] = None,
    year: Optional[int] = None,
    department: Optional[str] = None,
    current_user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN])),
    db=Depends(get_database)
):
    """Get attendance report for all employees (Admin)"""
    if not month:
        month = datetime.now().month
    if not year:
        year = datetime.now().year
    
    start_date = f"{year}-{month:02d}-01"
    if month == 12:
        end_date = f"{year + 1}-01-01"
    else:
        end_date = f"{year}-{month + 1:02d}-01"
    
    # Get all employees
    user_query = {"status": "active"}
    if department:
        user_query["department"] = department
    
    employees = await db.users.find(user_query, {"_id": 0, "id": 1, "full_name": 1, "email": 1, "role": 1, "department": 1}).to_list(500)
    
    report = []
    for emp in employees:
        attendance = await db.attendance.find({
            "employee_id": emp["id"],
            "date": {"$gte": start_date, "$lt": end_date}
        }, {"_id": 0}).to_list(31)
        
        present_days = len([a for a in attendance if a.get("status") == "present"])
        half_days = len([a for a in attendance if a.get("status") == "half_day"])
        absent_days = len([a for a in attendance if a.get("status") == "absent"])
        total_hours = sum(a.get("total_hours", 0) for a in attendance)
        
        report.append({
            "employee_id": emp["id"],
            "employee_name": emp.get("full_name", emp["email"]),
            "email": emp["email"],
            "role": emp.get("role"),
            "department": emp.get("department"),
            "present_days": present_days,
            "half_days": half_days,
            "absent_days": absent_days,
            "total_hours": round(total_hours, 2),
            "attendance_records": attendance
        })
    
    return {
        "period": f"{datetime(year, month, 1).strftime('%B %Y')}",
        "report": report,
        "summary": {
            "total_employees": len(report),
            "avg_present_days": round(sum(r["present_days"] for r in report) / max(len(report), 1), 1)
        }
    }


# ==================== LEAVE MANAGEMENT ====================

def _leave_email_html(title: str, color: str, rows: list, footer: str) -> str:
    row_html = "".join(
        f'<tr><td style="padding:6px 12px;color:#64748b;font-size:14px;">{k}</td>'
        f'<td style="padding:6px 12px;color:#0f172a;font-size:14px;font-weight:600;">{v}</td></tr>'
        for k, v in rows
    )
    return f"""
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


async def _notify_hr_leave_applied(leave: dict):
    """Email HR/Admin when a new leave application is submitted"""
    try:
        from services.email_service import email_service
        db = get_database()
        hr_users = await db.users.find(
            {"roles": {"$in": ["hr", "admin"]}, "is_active": True}, {"_id": 0, "email": 1}
        ).to_list(10)
        html = _leave_email_html(
            "📩 New Leave Application",
            "#f97316",
            [
                ("Employee", leave["employee_name"]),
                ("Leave Type", leave["leave_type"].title()),
                ("Duration", f'{leave["start_date"]} → {leave["end_date"]} ({leave["days"]} day(s))'),
                ("Reason", leave.get("reason") or "—"),
            ],
            "Login to the HR Dashboard → Payroll → Leave Management to approve or reject.",
        )
        for u in hr_users:
            await email_service.send_email(
                to_email=u["email"],
                subject=f"New Leave Application — {leave['employee_name']} ({leave['days']} day(s))",
                html_body=html,
            )
    except Exception as e:
        print(f"Leave HR email failed: {e}")


async def _notify_employee_leave_decision(leave_id: str, approved: bool, reason: str = ""):
    """Email employee when their leave is approved/rejected"""
    try:
        from services.email_service import email_service
        db = get_database()
        leave = await db.leaves.find_one({"id": leave_id}, {"_id": 0})
        if not leave:
            return
        emp = await db.users.find_one({"id": leave["employee_id"]}, {"_id": 0, "email": 1, "full_name": 1})
        if not emp or not emp.get("email"):
            return
        if approved:
            title, color, footer = "✅ Leave Approved", "#22c55e", "Enjoy your time off! Your leave balance has been updated."
        else:
            title, color, footer = "❌ Leave Rejected", "#ef4444", "Please contact HR for more details."
        rows = [
            ("Leave Type", leave["leave_type"].title()),
            ("Duration", f'{leave["start_date"]} → {leave["end_date"]} ({leave["days"]} day(s))'),
            ("Status", "APPROVED" if approved else "REJECTED"),
        ]
        if not approved and reason:
            rows.append(("Rejection Reason", reason))
        await email_service.send_email(
            to_email=emp["email"],
            subject=f"Your leave has been {'approved ✅' if approved else 'rejected'} — AirYatra HRMS",
            html_body=_leave_email_html(title, color, rows, footer),
        )
    except Exception as e:
        print(f"Leave decision email failed: {e}")


@router.post("/leave/apply")
async def apply_leave(
    leave_data: dict,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """Apply for leave"""
    leave_id = str(uuid4())
    
    leave = {
        "id": leave_id,
        "employee_id": current_user["id"],
        "employee_name": current_user.get("full_name", current_user["email"]),
        "leave_type": leave_data.get("leave_type", LeaveType.CASUAL.value),
        "start_date": leave_data["start_date"],
        "end_date": leave_data["end_date"],
        "reason": leave_data.get("reason", ""),
        "status": LeaveStatus.PENDING.value,
        "approved_by": None,
        "approved_at": None,
        "rejection_reason": None,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    # Calculate number of days
    start = datetime.fromisoformat(leave_data["start_date"])
    end = datetime.fromisoformat(leave_data["end_date"])
    leave["days"] = (end - start).days + 1
    
    await db.leaves.insert_one(dict(leave))
    background_tasks.add_task(_notify_hr_leave_applied, leave)
    
    return {
        "message": "Leave application submitted",
        "leave_id": leave_id,
        "days": leave["days"]
    }


@router.get("/leave/my")
async def get_my_leaves(
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """Get current user's leave applications"""
    query = {"employee_id": current_user["id"]}
    if status:
        query["status"] = status
    
    leaves = await db.leaves.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    
    # Get leave balance
    balance = await db.leave_balance.find_one(
        {"employee_id": current_user["id"], "year": datetime.now().year},
        {"_id": 0}
    )
    
    if not balance:
        balance = {
            "casual": 12,
            "sick": 6,
            "earned": 15,
            "casual_used": 0,
            "sick_used": 0,
            "earned_used": 0
        }
    
    return {
        "leaves": leaves,
        "balance": balance
    }


@router.put("/leave/{leave_id}/approve")
async def approve_leave(
    leave_id: str,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.HR])),
    db=Depends(get_database)
):
    """Approve a leave application"""
    leave = await db.leaves.find_one({"id": leave_id})
    if not leave:
        raise HTTPException(status_code=404, detail="Leave not found")
    
    await db.leaves.update_one(
        {"id": leave_id},
        {"$set": {
            "status": LeaveStatus.APPROVED.value,
            "approved_by": current_user["id"],
            "approved_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Update leave balance
    leave_type = leave["leave_type"]
    await db.leave_balance.update_one(
        {"employee_id": leave["employee_id"], "year": datetime.now().year},
        {"$inc": {f"{leave_type}_used": leave["days"]}},
        upsert=True
    )
    
    # Mark attendance as on_leave for those dates
    start = datetime.fromisoformat(leave["start_date"])
    end = datetime.fromisoformat(leave["end_date"])
    current = start
    while current <= end:
        await db.attendance.update_one(
            {"employee_id": leave["employee_id"], "date": current.date().isoformat()},
            {"$set": {
                "status": AttendanceStatus.ON_LEAVE.value,
                "leave_type": leave_type
            }},
            upsert=True
        )
        current += timedelta(days=1)
    
    background_tasks.add_task(_notify_employee_leave_decision, leave_id, True)
    return {"message": "Leave approved"}


@router.put("/leave/{leave_id}/reject")
async def reject_leave(
    leave_id: str,
    rejection_data: dict,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.HR])),
    db=Depends(get_database)
):
    """Reject a leave application"""
    await db.leaves.update_one(
        {"id": leave_id},
        {"$set": {
            "status": LeaveStatus.REJECTED.value,
            "approved_by": current_user["id"],
            "approved_at": datetime.now(timezone.utc).isoformat(),
            "rejection_reason": rejection_data.get("reason", "")
        }}
    )
    
    background_tasks.add_task(_notify_employee_leave_decision, leave_id, False, rejection_data.get("reason", ""))
    return {"message": "Leave rejected"}


@router.get("/leave/pending")
async def get_pending_leaves(
    current_user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.HR])),
    db=Depends(get_database)
):
    """Get all pending leave applications (HR/Admin)"""
    leaves = await db.leaves.find(
        {"status": LeaveStatus.PENDING.value},
        {"_id": 0}
    ).sort("created_at", 1).to_list(100)
    
    return {"pending_leaves": leaves, "count": len(leaves)}


@router.get("/leave/all")
async def get_all_leaves(
    status: Optional[str] = None,
    current_user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.HR])),
    db=Depends(get_database)
):
    """All leave applications with optional status filter (HR/Admin)"""
    query = {}
    if status:
        query["status"] = status
    leaves = await db.leaves.find(query, {"_id": 0}).sort("created_at", -1).to_list(200)
    counts = {}
    for s in ["pending", "approved", "rejected"]:
        counts[s] = await db.leaves.count_documents({"status": s})
    return {"leaves": leaves, "counts": counts}


# ==================== SALARY MANAGEMENT ====================

@router.get("/salary-config")
async def get_salary_config(
    current_user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN])),
    db=Depends(get_database)
):
    """Get salary configuration"""
    config = await db.salary_config.find_one({"type": "salary_settings"}, {"_id": 0})
    
    if not config:
        config = {
            "type": "salary_settings",
            "pf_enabled": True,
            "pf_percent": 12,  # Employee contribution
            "pf_employer_percent": 12,
            "esi_enabled": True,
            "esi_percent": 0.75,  # Employee contribution
            "esi_employer_percent": 3.25,
            "esi_limit": 21000,  # ESI applicable if salary <= 21000
            "tds_enabled": True,
            "professional_tax": 200,
            "working_days_per_month": 26,
            "overtime_rate_multiplier": 1.5,
        }
        await db.salary_config.insert_one(config)
    
    return config


@router.post("/salary-config")
async def update_salary_config(
    config_data: dict,
    current_user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN])),
    db=Depends(get_database)
):
    """Update salary configuration"""
    config_data["type"] = "salary_settings"
    config_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.salary_config.update_one(
        {"type": "salary_settings"},
        {"$set": config_data},
        upsert=True
    )
    
    return {"message": "Salary configuration updated"}


@router.post("/employee-salary")
async def set_employee_salary(
    salary_data: dict,
    current_user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN])),
    db=Depends(get_database)
):
    """Set salary structure for an employee"""
    salary_id = str(uuid4())
    
    salary = {
        "id": salary_id,
        "employee_id": salary_data["employee_id"],
        "effective_from": salary_data.get("effective_from", datetime.now(timezone.utc).date().isoformat()),
        
        # Earnings
        "basic_salary": salary_data.get("basic_salary", 0),
        "hra": salary_data.get("hra", 0),
        "conveyance": salary_data.get("conveyance", 0),
        "medical_allowance": salary_data.get("medical_allowance", 0),
        "special_allowance": salary_data.get("special_allowance", 0),
        "other_allowances": salary_data.get("other_allowances", 0),
        
        # Gross
        "gross_salary": (
            salary_data.get("basic_salary", 0) +
            salary_data.get("hra", 0) +
            salary_data.get("conveyance", 0) +
            salary_data.get("medical_allowance", 0) +
            salary_data.get("special_allowance", 0) +
            salary_data.get("other_allowances", 0)
        ),
        
        "status": "active",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": current_user["id"]
    }
    
    # Deactivate previous salary record
    await db.employee_salaries.update_many(
        {"employee_id": salary_data["employee_id"], "status": "active"},
        {"$set": {"status": "inactive"}}
    )
    
    await db.employee_salaries.insert_one(salary)
    
    return {"message": "Salary structure set", "salary_id": salary_id}


@router.get("/employee-salary/{employee_id}")
async def get_employee_salary(
    employee_id: str,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """Get employee's salary structure"""
    # Check if user is viewing own salary or is admin
    if current_user["id"] != employee_id and current_user.get("role") not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    salary = await db.employee_salaries.find_one(
        {"employee_id": employee_id, "status": "active"},
        {"_id": 0}
    )
    
    if not salary:
        return {"message": "No salary structure found", "salary": None}
    
    return {"salary": salary}


@router.post("/payroll/generate")
async def generate_payroll(
    payroll_data: dict,
    current_user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN])),
    db=Depends(get_database)
):
    """Generate monthly payroll for all employees or specific employee"""
    month = payroll_data.get("month", datetime.now().month)
    year = payroll_data.get("year", datetime.now().year)
    employee_id = payroll_data.get("employee_id")  # Optional - if None, generate for all
    
    # Get salary config
    salary_config = await db.salary_config.find_one({"type": "salary_settings"}, {"_id": 0})
    if not salary_config:
        raise HTTPException(status_code=400, detail="Salary configuration not found")
    
    # Get employees
    if employee_id:
        employees = [await db.users.find_one({"id": employee_id}, {"_id": 0})]
    else:
        employees = await db.users.find({"status": "active"}, {"_id": 0}).to_list(500)
    
    payroll_records = []
    
    for emp in employees:
        if not emp:
            continue
        
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
        
        attendance = await db.attendance.find({
            "employee_id": emp["id"],
            "date": {"$gte": start_date, "$lt": end_date}
        }).to_list(31)
        
        present_days = len([a for a in attendance if a.get("status") == "present"])
        half_days = len([a for a in attendance if a.get("status") == "half_day"])
        
        # Company holidays count as paid days (skip if employee already has attendance that day)
        month_holidays = await db.company_holidays.find(
            {"date": {"$gte": start_date, "$lt": end_date}}, {"_id": 0, "date": 1}
        ).to_list(40)
        att_dates = {a.get("date") for a in attendance}
        holiday_days = len([h for h in month_holidays if h["date"] not in att_dates])
        
        working_days = present_days + (half_days * 0.5) + holiday_days
        
        # Calculate pro-rata salary
        working_days_in_month = salary_config.get("working_days_per_month", 26)
        daily_rate = salary["gross_salary"] / working_days_in_month
        earned_gross = daily_rate * working_days
        
        # Calculate deductions
        pf_deduction = 0
        esi_deduction = 0
        
        if salary_config.get("pf_enabled"):
            pf_deduction = salary["basic_salary"] * (salary_config.get("pf_percent", 12) / 100)
            pf_deduction = min(pf_deduction * (working_days / working_days_in_month), 1800)  # Cap at 1800
        
        if salary_config.get("esi_enabled") and salary["gross_salary"] <= salary_config.get("esi_limit", 21000):
            esi_deduction = earned_gross * (salary_config.get("esi_percent", 0.75) / 100)
        
        professional_tax = salary_config.get("professional_tax", 200) if earned_gross > 15000 else 0
        
        # Get incentives
        incentives = await calculate_employee_incentives(emp["id"], month, year, current_user, db)
        incentive_amount = incentives.get("total_incentive", 0)
        
        # Calculate net salary
        total_deductions = pf_deduction + esi_deduction + professional_tax
        net_salary = earned_gross + incentive_amount - total_deductions
        
        payroll_id = str(uuid4())
        payroll_record = {
            "id": payroll_id,
            "employee_id": emp["id"],
            "employee_name": emp.get("full_name", emp["email"]),
            "month": month,
            "year": year,
            "period": f"{datetime(year, month, 1).strftime('%B %Y')}",
            
            # Attendance
            "working_days_in_month": working_days_in_month,
            "present_days": present_days,
            "half_days": half_days,
            "holiday_days": holiday_days,
            "effective_working_days": working_days,
            
            # Earnings
            "basic_salary": round(salary["basic_salary"] * (working_days / working_days_in_month), 2),
            "hra": round(salary["hra"] * (working_days / working_days_in_month), 2),
            "conveyance": round(salary["conveyance"] * (working_days / working_days_in_month), 2),
            "medical_allowance": round(salary["medical_allowance"] * (working_days / working_days_in_month), 2),
            "special_allowance": round(salary["special_allowance"] * (working_days / working_days_in_month), 2),
            "other_allowances": round(salary["other_allowances"] * (working_days / working_days_in_month), 2),
            "incentives": round(incentive_amount, 2),
            "gross_earnings": round(earned_gross + incentive_amount, 2),
            
            # Deductions
            "pf_deduction": round(pf_deduction, 2),
            "esi_deduction": round(esi_deduction, 2),
            "professional_tax": professional_tax,
            "tds": 0,  # Can be calculated based on annual income
            "other_deductions": 0,
            "total_deductions": round(total_deductions, 2),
            
            # Net
            "net_salary": round(net_salary, 2),
            
            "status": "draft",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "created_by": current_user["id"]
        }
        
        # Check if already exists
        existing = await db.payroll.find_one({
            "employee_id": emp["id"],
            "month": month,
            "year": year
        })
        
        if existing:
            payroll_record["id"] = existing["id"]
            await db.payroll.update_one(
                {"id": existing["id"]},
                {"$set": payroll_record}
            )
        else:
            await db.payroll.insert_one(dict(payroll_record))
        
        payroll_records.append(payroll_record)
    
    return {
        "message": f"Payroll generated for {len(payroll_records)} employees",
        "period": f"{datetime(year, month, 1).strftime('%B %Y')}",
        "records": payroll_records
    }


@router.get("/payroll")
async def get_payroll(
    month: Optional[int] = None,
    year: Optional[int] = None,
    status: Optional[str] = None,
    current_user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN])),
    db=Depends(get_database)
):
    """Get payroll records"""
    if not month:
        month = datetime.now().month
    if not year:
        year = datetime.now().year
    
    query = {"month": month, "year": year}
    if status:
        query["status"] = status
    
    records = await db.payroll.find(query, {"_id": 0}).to_list(500)
    
    return {
        "period": f"{datetime(year, month, 1).strftime('%B %Y')}",
        "records": records,
        "summary": {
            "total_employees": len(records),
            "total_gross": sum(r.get("gross_earnings", 0) for r in records),
            "total_deductions": sum(r.get("total_deductions", 0) for r in records),
            "total_net": sum(r.get("net_salary", 0) for r in records)
        }
    }


@router.get("/payroll/my-salary-slip")
async def get_my_salary_slip(
    month: Optional[int] = None,
    year: Optional[int] = None,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """Get current user's salary slip"""
    if not month:
        month = datetime.now().month
    if not year:
        year = datetime.now().year
    
    slip = await db.payroll.find_one({
        "employee_id": current_user["id"],
        "month": month,
        "year": year
    }, {"_id": 0})
    
    if not slip:
        return {"message": "Salary slip not found", "slip": None}
    
    return {"slip": slip}


@router.put("/payroll/{payroll_id}/approve")
async def approve_payroll(
    payroll_id: str,
    current_user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN])),
    db=Depends(get_database)
):
    """Approve payroll for payment"""
    await db.payroll.update_one(
        {"id": payroll_id},
        {"$set": {
            "status": "approved",
            "approved_by": current_user["id"],
            "approved_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"message": "Payroll approved"}


@router.put("/payroll/{payroll_id}/mark-paid")
async def mark_payroll_paid(
    payroll_id: str,
    payment_data: dict,
    current_user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN])),
    db=Depends(get_database)
):
    """Mark payroll as paid"""
    await db.payroll.update_one(
        {"id": payroll_id},
        {"$set": {
            "status": "paid",
            "paid_at": datetime.now(timezone.utc).isoformat(),
            "payment_reference": payment_data.get("reference"),
            "payment_mode": payment_data.get("mode", "bank_transfer")
        }}
    )
    
    return {"message": "Payroll marked as paid"}
