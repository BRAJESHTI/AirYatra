"""Seed demo corporate account, employees, budgets and bookings (idempotent)"""
import asyncio
import os
import sys
import uuid
from datetime import datetime, timezone

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

from motor.motor_asyncio import AsyncIOMotorClient
from auth import get_password_hash

CORP_ID = "CORP-DEMO26"
ADMIN_EMAIL = "corporate@airyatra.co.in"


async def main():
    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    db = client[os.environ["DB_NAME"]]
    now = datetime.now(timezone.utc)
    now_iso = datetime.now(timezone.utc).isoformat()

    # 1. Corporate admin user
    user = await db.users.find_one({"email": ADMIN_EMAIL})
    if not user:
        await db.users.insert_one({
            "id": str(uuid.uuid4()),
            "email": ADMIN_EMAIL,
            "full_name": "Rajesh Verma",
            "phone": "+919999900021",
            "password_hash": get_password_hash("Corporate@123"),
            "roles": ["customer"],
            "is_active": True,
            "otp_enabled": False,
            "login_shield_bypass": True,
            "totp_enabled": False,
            "region": "IN",
            "created_at": now_iso,
            "updated_at": now_iso,
        })
        print("created user", ADMIN_EMAIL)
    else:
        print("user exists", ADMIN_EMAIL)

    # 2. Idempotent guard: skip if demo corporate already seeded
    existing_corp = await db.corporates.find_one({"corporate_id": CORP_ID})
    if existing_corp:
        print(f"Demo corporate {CORP_ID} already exists. Skipping seed (idempotent).")
        client.close()
        return

    # 3. Corporate account (approved)
    await db.corporates.insert_one({
        "corporate_id": CORP_ID,
        "company_name": "TechVista Solutions Pvt Ltd",
        "registration_number": "U72900MH2019PTC123456",
        "gst_number": "27AATCV1234F1Z5",
        "industry": "Technology",
        "company_size": "201-500",
        "address": "Level 8, Vista Tower, BKC",
        "city": "Mumbai",
        "state": "Maharashtra",
        "pincode": "400051",
        "primary_contact_name": "Rajesh Verma",
        "primary_contact_email": ADMIN_EMAIL,
        "primary_contact_phone": "+919999900021",
        "admin_email": ADMIN_EMAIL,
        "admin_name": "Rajesh Verma",
        "billing_address": "Level 8, Vista Tower, BKC, Mumbai 400051",
        "status": "approved",
        "credit_limit": 2000000,
        "credit_limit_requested": 2000000,
        "credit_used": 265000,
        "total_bookings": 2,
        "total_spend": 265000,
        "departments": ["Sales", "Finance", "Operations", "Marketing"],
        "employees": [],
        "created_at": now,
        "updated_at": now,
    })

    # 4. Travel policy
    await db.travel_policies.insert_one({
        "corporate_id": CORP_ID,
        "max_booking_amount": 500000,
        "advance_booking_days": 7,
        "requires_purpose": True,
        "allowed_aircraft_types": [],
        "blackout_dates": [],
        "auto_approve_below": 25000,
        "weekend_booking_allowed": True,
        "international_allowed": False,
        "created_at": now,
        "updated_at": now,
    })

    # 5. Employees
    employees = [
        ("CORP-DEM-EMP-SALES1", "Rohit Sharma", "rohit.sharma@techvista.in", "Sales", "Sales Head", "approver", 500000, 165000, False, 100000, 1, 165000),
        ("CORP-DEM-EMP-FIN001", "Anita Desai", "anita.desai@techvista.in", "Finance", "Finance Manager", "traveler", 300000, 100000, True, 30000, 1, 100000),
        ("CORP-DEM-EMP-OPS001", "Vikram Patel", "vikram.patel@techvista.in", "Operations", "Operations Lead", "booker", 250000, 0, True, 50000, 0, 0),
        ("CORP-DEM-EMP-MKT001", "Sneha Iyer", "sneha.iyer@techvista.in", "Marketing", "Marketing Executive", "traveler", 200000, 0, True, 20000, 0, 0),
    ]
    for code, name, email, dept, desig, role, budget, used, req_appr, limit, bcount, spend in employees:
        await db.corporate_employees.insert_one({
            "employee_code": code,
            "corporate_id": CORP_ID,
            "user_id": None,
            "name": name,
            "email": email,
            "phone": "+919888800001",
            "department": dept,
            "designation": desig,
            "role": role,
            "travel_budget": budget,
            "budget_used": used,
            "can_book_for_others": role in ["booker", "approver"],
            "requires_approval": req_appr,
            "approval_limit": limit,
            "is_active": True,
            "bookings_count": bcount,
            "total_spend": spend,
            "created_at": now,
            "updated_at": now,
        })

    # 6. Department budgets
    for dept, amount, used in [("Sales", 600000, 165000), ("Finance", 400000, 100000), ("Marketing", 250000, 0)]:
        await db.department_budgets.insert_one({
            "corporate_id": CORP_ID,
            "department": dept,
            "budget_amount": amount,
            "budget_used": used,
            "period": "monthly",
            "start_date": now,
            "end_date": now,
            "alert_threshold": 80,
            "alert_triggered": False,
            "created_at": now,
            "updated_at": now,
        })

    # 7. Corporate bookings (2 confirmed + 1 pending approval)
    def pricing(amount):
        base = round(amount / 1.18, 2)
        return {"base_fare": base, "gst_rate": 18, "gst_amount": round(amount - base, 2), "total_amount": amount}

    bookings = [
        ("cb-demo-001", "CB-DEMO01", "CORP-DEM-EMP-SALES1", "Rohit Sharma", "Sales", "Mumbai", "Delhi", "2026-08-20", 165000, "confirmed", "auto_approved", "Client meeting - Delhi HQ"),
        ("cb-demo-002", "CB-DEMO02", "CORP-DEM-EMP-FIN001", "Anita Desai", "Finance", "Mumbai", "Pune", "2026-08-15", 100000, "confirmed", "approved", "Quarterly audit visit"),
        ("cb-demo-003", "CB-DEMO03", "CORP-DEM-EMP-MKT001", "Sneha Iyer", "Marketing", "Mumbai", "Goa", "2026-09-05", 85000, "pending_approval", "pending", "Brand launch event"),
    ]
    for bid, bnum, ecode, ename, dept, frm, to, date, amount, status, appr, purpose in bookings:
        await db.corporate_bookings.insert_one({
            "id": bid,
            "booking_number": bnum,
            "corporate_id": CORP_ID,
            "employee_code": ecode,
            "employee_name": ename,
            "department": dept,
            "passenger_name": ename,
            "from_location": frm,
            "to_location": to,
            "travel_date": date,
            "travel_time": "09:00",
            "passengers": 2,
            "aircraft_type": "helicopter",
            "purpose": purpose,
            "urgency": "normal",
            "final_price": amount,
            "pricing": pricing(amount),
            "status": status,
            "approval_status": appr,
            "created_at": now,
            "updated_at": now,
        })

    # 8. Pending approval for booking 3
    await db.booking_approvals.insert_one({
        "approval_id": "APR-DEMO0001",
        "corporate_id": CORP_ID,
        "booking_id": "cb-demo-003",
        "booking_number": "CB-DEMO03",
        "employee_id": "CORP-DEM-EMP-MKT001",
        "employee_name": "Sneha Iyer",
        "department": "Marketing",
        "route": "Mumbai -> Goa",
        "travel_date": "2026-09-05",
        "amount": 85000,
        "purpose": "Brand launch event",
        "urgency": "normal",
        "status": "pending",
        "approver_id": None,
        "approver_name": None,
        "approved_at": None,
        "rejection_reason": None,
        "created_at": now,
        "updated_at": now,
    })

    print("Seeded corporate demo:", CORP_ID)


asyncio.run(main())
