"""
HRMS Employee Management + Self-Service + Payslip PDF
"""
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import Response
from typing import Optional
from datetime import datetime, timezone
from uuid import uuid4
import io
from database import get_database
from middleware import get_current_user, require_roles
from models import UserRole
from auth import get_password_hash

router = APIRouter(prefix="/hr", tags=["HRMS Employees"])

STAFF_ROLES = ["employee", "hr", "sales", "finance", "support", "marketing", "operations"]
HR_ADMIN = [UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.HR]


# ==================== EMPLOYEE MANAGEMENT (Admin/HR) ====================

@router.post("/employees")
async def create_employee(
    data: dict,
    current_user: dict = Depends(require_roles(HR_ADMIN)),
    db=Depends(get_database)
):
    """Create employee account with optional salary structure"""
    email = (data.get("email") or "").strip().lower()
    if not email or not data.get("password") or not data.get("full_name"):
        raise HTTPException(status_code=400, detail="full_name, email and password are required")

    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    emp_count = await db.users.count_documents({"employee_code": {"$exists": True}})
    employee_code = f"EMP-{emp_count + 1:04d}"
    now = datetime.now(timezone.utc).isoformat()

    user = {
        "id": str(uuid4()),
        "full_name": data["full_name"],
        "email": email,
        "phone": data.get("phone", ""),
        "password_hash": get_password_hash(data["password"]),
        "roles": [data.get("role", "employee")] if data.get("role", "employee") in STAFF_ROLES else ["employee"],
        "employee_code": employee_code,
        "department": data.get("department", ""),
        "designation": data.get("designation", ""),
        "joining_date": data.get("joining_date", now[:10]),
        "is_active": True,
        "status": "active",
        "created_by": current_user["id"],
        "created_at": now,
        "updated_at": now,
    }
    await db.users.insert_one(dict(user))

    salary_id = None
    basic = float(data.get("basic_salary") or 0)
    if basic > 0:
        salary_id = str(uuid4())
        comps = {k: float(data.get(k) or 0) for k in ["hra", "conveyance", "medical_allowance", "special_allowance", "other_allowances"]}
        await db.employee_salaries.insert_one({
            "id": salary_id,
            "employee_id": user["id"],
            "effective_from": user["joining_date"],
            "basic_salary": basic,
            **comps,
            "gross_salary": basic + sum(comps.values()),
            "status": "active",
            "created_at": now,
            "created_by": current_user["id"],
        })

    return {
        "message": f"Employee created / कर्मचारी बन गया ({employee_code})",
        "employee_id": user["id"],
        "employee_code": employee_code,
        "salary_id": salary_id,
    }


@router.get("/employees")
async def list_employees(
    current_user: dict = Depends(require_roles(HR_ADMIN)),
    db=Depends(get_database)
):
    """List all staff with salary + today's attendance"""
    users = await db.users.find(
        {"roles": {"$in": STAFF_ROLES}},
        {"_id": 0, "password_hash": 0}
    ).sort("created_at", -1).to_list(500)

    today = datetime.now(timezone.utc).date().isoformat()
    result = []
    for u in users:
        salary = await db.employee_salaries.find_one(
            {"employee_id": u["id"], "status": "active"}, {"_id": 0, "gross_salary": 1}
        )
        att = await db.attendance.find_one({"employee_id": u["id"], "date": today}, {"_id": 0, "status": 1, "check_in_time": 1})
        u["gross_salary"] = salary.get("gross_salary") if salary else None
        u["today_status"] = att.get("status") if att else "not_marked"
        result.append(u)

    return {"employees": result, "count": len(result)}


@router.put("/employees/{employee_id}")
async def update_employee(
    employee_id: str,
    data: dict,
    current_user: dict = Depends(require_roles(HR_ADMIN)),
    db=Depends(get_database)
):
    """Update employee details / activate-deactivate"""
    allowed = ["full_name", "phone", "department", "designation", "joining_date"]
    update = {k: v for k, v in data.items() if k in allowed and v is not None}
    if "is_active" in data:
        update["is_active"] = bool(data["is_active"])
        update["status"] = "active" if data["is_active"] else "inactive"
    if not update:
        raise HTTPException(status_code=400, detail="No valid fields to update")
    update["updated_at"] = datetime.now(timezone.utc).isoformat()

    result = await db.users.update_one({"id": employee_id}, {"$set": update})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Employee not found")
    return {"message": "Employee updated / कर्मचारी अपडेट हो गया"}


# ==================== EMPLOYEE SELF-SERVICE OVERVIEW ====================

@router.get("/employee/overview")
async def employee_overview(
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """Self-service dashboard summary for logged-in employee"""
    uid = current_user["id"]
    now = datetime.now(timezone.utc)
    today = now.date().isoformat()
    month, year = now.month, now.year
    start = f"{year}-{month:02d}-01"
    end = f"{year + 1}-01-01" if month == 12 else f"{year}-{month + 1:02d}-01"

    today_att = await db.attendance.find_one({"employee_id": uid, "date": today}, {"_id": 0})
    month_att = await db.attendance.find({"employee_id": uid, "date": {"$gte": start, "$lt": end}}, {"_id": 0}).to_list(31)
    present = len([a for a in month_att if a.get("status") == "present"])
    half = len([a for a in month_att if a.get("status") == "half_day"])
    total_hours = round(sum(a.get("total_hours", 0) for a in month_att), 1)

    balance = await db.leave_balance.find_one({"employee_id": uid, "year": year}, {"_id": 0}) or {
        "casual": 12, "sick": 6, "earned": 15, "casual_used": 0, "sick_used": 0, "earned_used": 0
    }
    pending_leaves = await db.leaves.count_documents({"employee_id": uid, "status": "pending"})

    expenses = await db.expense_claims.find({"employee_id": uid}, {"_id": 0, "amount": 1, "status": 1}).to_list(200)
    exp_pending = sum(e["amount"] for e in expenses if e.get("status") in ["hr_pending", "finance_pending", "admin_pending"])
    exp_approved = sum(e["amount"] for e in expenses if e.get("status") in ["approved", "added_to_salary", "paid"])

    latest_slip = await db.payroll.find_one({"employee_id": uid}, {"_id": 0, "period": 1, "net_salary": 1, "status": 1, "id": 1}, sort=[("year", -1), ("month", -1)])
    salary = await db.employee_salaries.find_one({"employee_id": uid, "status": "active"}, {"_id": 0, "gross_salary": 1})

    return {
        "employee": {
            "name": current_user.get("full_name"),
            "employee_code": current_user.get("employee_code"),
            "department": current_user.get("department"),
            "designation": current_user.get("designation"),
        },
        "today_attendance": today_att,
        "month_summary": {"present_days": present, "half_days": half, "total_hours": total_hours},
        "leave_balance": balance,
        "pending_leaves": pending_leaves,
        "expenses": {"pending_amount": exp_pending, "approved_amount": exp_approved, "total_claims": len(expenses)},
        "latest_payslip": latest_slip,
        "gross_salary": salary.get("gross_salary") if salary else None,
    }


# ==================== PAYSLIP PDF ====================

def _generate_payslip_pdf(slip: dict, emp: dict) -> bytes:
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.colors import HexColor
    from reportlab.pdfgen import canvas

    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    w, h = A4
    navy, orange, grey = HexColor("#0f172a"), HexColor("#f97316"), HexColor("#64748b")

    c.setFillColor(navy)
    c.rect(0, h - 90, w, 90, fill=True, stroke=0)
    c.setFillColor(HexColor("#ffffff"))
    c.setFont("Helvetica-Bold", 20)
    c.drawString(40, h - 45, "AirYatra Aviation Pvt. Ltd.")
    c.setFont("Helvetica", 10)
    c.drawString(40, h - 62, "India's Aviation Operating System")
    c.setFillColor(orange)
    c.setFont("Helvetica-Bold", 13)
    c.drawRightString(w - 40, h - 45, "SALARY SLIP")
    c.setFillColor(HexColor("#ffffff"))
    c.setFont("Helvetica", 10)
    c.drawRightString(w - 40, h - 62, slip.get("period", ""))

    y = h - 125
    c.setFillColor(navy)
    c.setFont("Helvetica-Bold", 11)
    c.drawString(40, y, "Employee Details")
    c.setFont("Helvetica", 10)
    c.setFillColor(grey)
    details = [
        ("Name", emp.get("full_name", slip.get("employee_name", ""))),
        ("Employee Code", emp.get("employee_code", "-")),
        ("Department", emp.get("department") or "-"),
        ("Designation", emp.get("designation") or "-"),
        ("Days Worked", f'{slip.get("effective_working_days", 0)} / {slip.get("working_days_in_month", 26)}'),
        ("Status", (slip.get("status") or "draft").upper()),
    ]
    for i, (k, v) in enumerate(details):
        col_x = 40 if i % 2 == 0 else 310
        row_y = y - 18 - (i // 2) * 16
        c.setFillColor(grey)
        c.drawString(col_x, row_y, f"{k}:")
        c.setFillColor(navy)
        c.drawString(col_x + 90, row_y, str(v))

    y -= 90
    earnings = [
        ("Basic Salary", slip.get("basic_salary", 0)),
        ("HRA", slip.get("hra", 0)),
        ("Conveyance", slip.get("conveyance", 0)),
        ("Medical Allowance", slip.get("medical_allowance", 0)),
        ("Special Allowance", slip.get("special_allowance", 0)),
        ("Other Allowances", slip.get("other_allowances", 0)),
        ("Incentives", slip.get("incentives", 0)),
    ]
    deductions = [
        ("Provident Fund (PF)", slip.get("pf_deduction", 0)),
        ("ESI", slip.get("esi_deduction", 0)),
        ("Professional Tax", slip.get("professional_tax", 0)),
        ("TDS", slip.get("tds", 0)),
        ("Other Deductions", slip.get("other_deductions", 0)),
    ]

    def table(x, title, rows, total_label, total_val):
        ty = y
        c.setFillColor(orange)
        c.setFont("Helvetica-Bold", 11)
        c.drawString(x, ty, title)
        ty -= 20
        c.setFont("Helvetica", 10)
        for label, amt in rows:
            c.setFillColor(grey)
            c.drawString(x, ty, label)
            c.setFillColor(navy)
            c.drawRightString(x + 230, ty, f"Rs. {amt:,.2f}")
            ty -= 16
        c.setStrokeColor(grey)
        c.line(x, ty + 6, x + 230, ty + 6)
        c.setFillColor(navy)
        c.setFont("Helvetica-Bold", 10)
        c.drawString(x, ty - 6, total_label)
        c.drawRightString(x + 230, ty - 6, f"Rs. {total_val:,.2f}")

    table(40, "EARNINGS", earnings, "Gross Earnings", slip.get("gross_earnings", 0))
    table(320, "DEDUCTIONS", deductions, "Total Deductions", slip.get("total_deductions", 0))

    y -= 190
    c.setFillColor(orange)
    c.rect(40, y - 10, w - 80, 34, fill=True, stroke=0)
    c.setFillColor(HexColor("#ffffff"))
    c.setFont("Helvetica-Bold", 13)
    c.drawString(52, y + 1, "NET SALARY PAYABLE")
    c.drawRightString(w - 52, y + 1, f"Rs. {slip.get('net_salary', 0):,.2f}")

    c.setFillColor(grey)
    c.setFont("Helvetica", 8)
    c.drawString(40, 50, "This is a computer-generated salary slip and does not require a signature.")
    c.drawString(40, 38, f"Generated on {datetime.now(timezone.utc).strftime('%d %b %Y')} | AirYatra HRMS")
    c.showPage()
    c.save()
    return buf.getvalue()


@router.get("/payroll/{payroll_id}/payslip.pdf")
async def download_payslip(
    payroll_id: str,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """Download payslip PDF (owner or HR/Admin)"""
    slip = await db.payroll.find_one({"id": payroll_id}, {"_id": 0})
    if not slip:
        raise HTTPException(status_code=404, detail="Payslip not found")
    roles = current_user.get("roles", [])
    if slip["employee_id"] != current_user["id"] and not any(r in ["admin", "super_admin", "hr"] for r in roles):
        raise HTTPException(status_code=403, detail="Access denied")

    emp = await db.users.find_one({"id": slip["employee_id"]}, {"_id": 0, "password_hash": 0}) or {}
    pdf = _generate_payslip_pdf(slip, emp)
    fname = f"AirYatra_Payslip_{slip.get('period', '').replace(' ', '_')}_{slip['employee_id'][:6]}.pdf"
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{fname}"'},
    )
