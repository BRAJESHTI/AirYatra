"""
AirYatra Finance ERP - Treasury Management Routes
Complete Finance Command Center for Enterprise
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone, timedelta
from bson import ObjectId
from database import get_database
from enum import Enum

router = APIRouter(prefix="/finance", tags=["finance-erp"])

# ============== ENUMS ==============
class BankName(str, Enum):
    ICICI = "ICICI Bank"
    HDFC = "HDFC Bank"
    SBI = "State Bank of India"
    AXIS = "Axis Bank"
    BOB = "Bank of Baroda"
    YES = "Yes Bank"
    KOTAK = "Kotak Mahindra"
    PNB = "Punjab National Bank"
    CANARA = "Canara Bank"
    IDBI = "IDBI Bank"
    OTHER = "Other"

class AccountType(str, Enum):
    CURRENT = "current"
    SAVINGS = "savings"
    OVERDRAFT = "overdraft"
    FIXED_DEPOSIT = "fixed_deposit"
    CASH = "cash"

class TransactionType(str, Enum):
    CREDIT = "credit"
    DEBIT = "debit"
    TRANSFER = "transfer"

class PaymentStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"

# ============== MODELS ==============
class BankAccountCreate(BaseModel):
    bank_name: str
    account_name: str
    account_number: str
    ifsc_code: str
    branch: str
    account_type: str = "current"
    opening_balance: float = 0
    is_primary: bool = False
    notes: Optional[str] = None

class TransactionCreate(BaseModel):
    bank_account_id: str
    transaction_type: str  # credit, debit, transfer
    amount: float
    description: str
    category: str  # collection, payment, refund, salary, vendor, tax, etc.
    reference_number: Optional[str] = None
    counterparty: Optional[str] = None
    notes: Optional[str] = None

class CashEntryCreate(BaseModel):
    entry_type: str  # in, out
    amount: float
    description: str
    category: str
    received_from: Optional[str] = None
    paid_to: Optional[str] = None

# Helper functions
def serialize_doc(doc):
    if doc:
        doc["_id"] = str(doc["_id"])
    return doc

# ============== TREASURY DASHBOARD ==============
@router.get("/treasury/dashboard")
async def get_treasury_dashboard():
    """
    Finance Command Center - CEO/CFO Dashboard
    Shows complete financial overview
    """
    db = get_database()
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    
    # Get all bank accounts
    bank_accounts = await db.bank_accounts.find({"is_active": True}).to_list(length=50)
    total_bank_balance = sum(acc.get("current_balance", 0) for acc in bank_accounts)
    
    # Get cash balance
    cash_account = await db.cash_accounts.find_one({"is_active": True})
    cash_balance = cash_account.get("balance", 0) if cash_account else 0
    
    # Today's collections (credits)
    today_collections = await db.finance_transactions.find({
        "transaction_type": "credit",
        "created_at": {"$gte": today_start}
    }).to_list(length=500)
    total_today_collection = sum(t.get("amount", 0) for t in today_collections)
    
    # Today's payments (debits)
    today_payments = await db.finance_transactions.find({
        "transaction_type": "debit",
        "created_at": {"$gte": today_start}
    }).to_list(length=500)
    total_today_payment = sum(t.get("amount", 0) for t in today_payments)
    
    # Pending items
    pending_gst = await db.challans.count_documents({"type": "GST", "status": "pending"})
    pending_tds = await db.challans.count_documents({"type": "TDS", "status": "pending"})
    pending_pf = await db.challans.count_documents({"type": "PF", "status": "pending"})
    pending_esic = await db.challans.count_documents({"type": "ESIC", "status": "pending"})
    
    # Pending vendor payments
    pending_vendor_payments = await db.vendor_bills.find({
        "payment_status": "pending"
    }).to_list(length=100)
    total_pending_vendor = sum(b.get("amount", 0) for b in pending_vendor_payments)
    
    # Pending operator settlements
    pending_settlements = await db.operator_settlements.find({
        "status": "pending"
    }).to_list(length=100)
    total_pending_settlement = sum(s.get("amount", 0) for s in pending_settlements)
    
    # Pending refunds
    pending_refunds = await db.refunds.find({
        "status": "pending"
    }).to_list(length=100)
    total_pending_refunds = sum(r.get("amount", 0) for r in pending_refunds)
    
    # Pending salary
    pending_salary = await db.salary_payments.find({
        "status": "pending",
        "month": now.strftime("%Y-%m")
    }).to_list(length=200)
    total_pending_salary = sum(s.get("amount", 0) for s in pending_salary)
    
    # Upcoming EMIs (next 30 days)
    next_30_days = now + timedelta(days=30)
    upcoming_emis = await db.loans.find({
        "next_emi_date": {"$lte": next_30_days.isoformat()[:10]},
        "status": "active"
    }).to_list(length=20)
    total_upcoming_emi = sum(l.get("emi_amount", 0) for l in upcoming_emis)
    
    # Upcoming insurance premiums
    upcoming_insurance = await db.insurance_policies.find({
        "next_premium_date": {"$lte": next_30_days.isoformat()[:10]},
        "status": "active"
    }).to_list(length=20)
    total_upcoming_insurance = sum(i.get("premium_amount", 0) for i in upcoming_insurance)
    
    # Monthly revenue
    monthly_revenue = await db.finance_transactions.find({
        "transaction_type": "credit",
        "category": {"$in": ["booking", "collection", "payment_received"]},
        "created_at": {"$gte": month_start}
    }).to_list(length=1000)
    total_monthly_revenue = sum(t.get("amount", 0) for t in monthly_revenue)
    
    # Monthly expenses
    monthly_expenses = await db.finance_transactions.find({
        "transaction_type": "debit",
        "created_at": {"$gte": month_start}
    }).to_list(length=1000)
    total_monthly_expenses = sum(t.get("amount", 0) for t in monthly_expenses)
    
    # Calculate profit
    monthly_profit = total_monthly_revenue - total_monthly_expenses
    
    return {
        "summary": {
            "total_cash": cash_balance,
            "total_bank_balance": total_bank_balance,
            "total_available": cash_balance + total_bank_balance,
            "today_collection": total_today_collection,
            "today_payment": total_today_payment,
            "net_today": total_today_collection - total_today_payment
        },
        "pending": {
            "gst": pending_gst,
            "tds": pending_tds,
            "pf": pending_pf,
            "esic": pending_esic,
            "vendor_payments": len(pending_vendor_payments),
            "vendor_amount": total_pending_vendor,
            "operator_settlements": len(pending_settlements),
            "settlement_amount": total_pending_settlement,
            "refunds": len(pending_refunds),
            "refund_amount": total_pending_refunds,
            "salary_amount": total_pending_salary
        },
        "upcoming": {
            "emi_count": len(upcoming_emis),
            "emi_amount": total_upcoming_emi,
            "insurance_count": len(upcoming_insurance),
            "insurance_amount": total_upcoming_insurance
        },
        "monthly": {
            "revenue": total_monthly_revenue,
            "expenses": total_monthly_expenses,
            "profit": monthly_profit,
            "profit_margin": round((monthly_profit / total_monthly_revenue * 100) if total_monthly_revenue > 0 else 0, 2)
        },
        "bank_accounts_count": len(bank_accounts),
        "last_updated": now.isoformat(),
        "alerts": await get_finance_alerts(db)
    }

async def get_finance_alerts(db):
    """Get finance-related alerts"""
    alerts = []
    now = datetime.now(timezone.utc)
    
    # GST due alert (if approaching 20th)
    if now.day >= 15 and now.day <= 20:
        pending_gst = await db.challans.count_documents({"type": "GST", "status": "pending"})
        if pending_gst > 0:
            alerts.append({
                "type": "warning",
                "category": "GST",
                "message": f"GST payment due soon. {pending_gst} pending challans.",
                "priority": "high"
            })
    
    # TDS due alert (if approaching 7th)
    if now.day >= 1 and now.day <= 7:
        pending_tds = await db.challans.count_documents({"type": "TDS", "status": "pending"})
        if pending_tds > 0:
            alerts.append({
                "type": "warning",
                "category": "TDS",
                "message": f"TDS payment due by 7th. {pending_tds} pending.",
                "priority": "high"
            })
    
    # Low balance alert
    bank_accounts = await db.bank_accounts.find({"is_active": True}).to_list(length=50)
    for acc in bank_accounts:
        if acc.get("current_balance", 0) < acc.get("minimum_balance", 10000):
            alerts.append({
                "type": "danger",
                "category": "Bank",
                "message": f"Low balance in {acc.get('bank_name')} - {acc.get('account_name')}",
                "priority": "high"
            })
    
    # Overdue vendor payments
    overdue_vendors = await db.vendor_bills.count_documents({
        "payment_status": "pending",
        "due_date": {"$lt": now.isoformat()[:10]}
    })
    if overdue_vendors > 0:
        alerts.append({
            "type": "warning",
            "category": "Vendor",
            "message": f"{overdue_vendors} vendor payments overdue",
            "priority": "medium"
        })
    
    return alerts

# ============== BANK ACCOUNT MANAGEMENT ==============
@router.post("/bank-accounts")
async def create_bank_account(account: BankAccountCreate):
    """Create a new bank account"""
    db = get_database()
    
    # Check if account number already exists
    existing = await db.bank_accounts.find_one({"account_number": account.account_number})
    if existing:
        raise HTTPException(status_code=400, detail="Account number already exists")
    
    account_doc = {
        "bank_name": account.bank_name,
        "account_name": account.account_name,
        "account_number": account.account_number,
        "ifsc_code": account.ifsc_code,
        "branch": account.branch,
        "account_type": account.account_type,
        "opening_balance": account.opening_balance,
        "current_balance": account.opening_balance,
        "is_primary": account.is_primary,
        "is_active": True,
        "notes": account.notes,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }
    
    # If this is primary, unset other primary accounts
    if account.is_primary:
        await db.bank_accounts.update_many(
            {"is_primary": True},
            {"$set": {"is_primary": False}}
        )
    
    result = await db.bank_accounts.insert_one(account_doc)
    account_doc["_id"] = str(result.inserted_id)
    
    return {"success": True, "account": account_doc}

@router.get("/bank-accounts")
async def get_bank_accounts():
    """Get all bank accounts"""
    db = get_database()
    
    accounts = await db.bank_accounts.find({"is_active": True}).to_list(length=50)
    
    total_balance = sum(acc.get("current_balance", 0) for acc in accounts)
    
    return {
        "accounts": [serialize_doc(acc) for acc in accounts],
        "total_balance": total_balance,
        "count": len(accounts)
    }

@router.get("/bank-accounts/{account_id}")
async def get_bank_account(account_id: str):
    """Get single bank account with recent transactions"""
    db = get_database()
    
    account = await db.bank_accounts.find_one({"_id": ObjectId(account_id)})
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    
    # Get recent transactions
    transactions = await db.finance_transactions.find({
        "bank_account_id": account_id
    }).sort("created_at", -1).limit(50).to_list(length=50)
    
    return {
        "account": serialize_doc(account),
        "recent_transactions": [serialize_doc(t) for t in transactions]
    }

@router.put("/bank-accounts/{account_id}")
async def update_bank_account(account_id: str, updates: dict):
    """Update bank account"""
    db = get_database()
    
    updates["updated_at"] = datetime.now(timezone.utc)
    
    # If setting as primary, unset others
    if updates.get("is_primary"):
        await db.bank_accounts.update_many(
            {"is_primary": True, "_id": {"$ne": ObjectId(account_id)}},
            {"$set": {"is_primary": False}}
        )
    
    result = await db.bank_accounts.update_one(
        {"_id": ObjectId(account_id)},
        {"$set": updates}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Account not found")
    
    return {"success": True, "message": "Account updated"}

@router.delete("/bank-accounts/{account_id}")
async def deactivate_bank_account(account_id: str):
    """Deactivate bank account (soft delete)"""
    db = get_database()
    
    result = await db.bank_accounts.update_one(
        {"_id": ObjectId(account_id)},
        {"$set": {"is_active": False, "deactivated_at": datetime.now(timezone.utc)}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Account not found")
    
    return {"success": True, "message": "Account deactivated"}

# ============== TRANSACTIONS ==============
@router.post("/transactions")
async def create_transaction(transaction: TransactionCreate):
    """Record a financial transaction"""
    db = get_database()
    
    # Verify bank account exists
    account = await db.bank_accounts.find_one({"_id": ObjectId(transaction.bank_account_id)})
    if not account:
        raise HTTPException(status_code=404, detail="Bank account not found")
    
    trans_doc = {
        "bank_account_id": transaction.bank_account_id,
        "bank_name": account.get("bank_name"),
        "transaction_type": transaction.transaction_type,
        "amount": transaction.amount,
        "description": transaction.description,
        "category": transaction.category,
        "reference_number": transaction.reference_number,
        "counterparty": transaction.counterparty,
        "notes": transaction.notes,
        "balance_before": account.get("current_balance", 0),
        "created_at": datetime.now(timezone.utc),
        "created_by": None  # TODO: Add user context
    }
    
    # Calculate new balance
    if transaction.transaction_type == "credit":
        new_balance = account.get("current_balance", 0) + transaction.amount
    else:
        new_balance = account.get("current_balance", 0) - transaction.amount
    
    trans_doc["balance_after"] = new_balance
    
    # Update bank account balance
    await db.bank_accounts.update_one(
        {"_id": ObjectId(transaction.bank_account_id)},
        {"$set": {"current_balance": new_balance, "updated_at": datetime.now(timezone.utc)}}
    )
    
    # Insert transaction
    result = await db.finance_transactions.insert_one(trans_doc)
    trans_doc["_id"] = str(result.inserted_id)
    
    return {"success": True, "transaction": trans_doc, "new_balance": new_balance}

@router.get("/transactions")
async def get_transactions(
    bank_account_id: Optional[str] = None,
    transaction_type: Optional[str] = None,
    category: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    limit: int = 100,
    skip: int = 0
):
    """Get transactions with filters"""
    db = get_database()
    
    query = {}
    if bank_account_id:
        query["bank_account_id"] = bank_account_id
    if transaction_type:
        query["transaction_type"] = transaction_type
    if category:
        query["category"] = category
    if start_date:
        query["created_at"] = {"$gte": datetime.fromisoformat(start_date)}
    if end_date:
        if "created_at" in query:
            query["created_at"]["$lte"] = datetime.fromisoformat(end_date)
        else:
            query["created_at"] = {"$lte": datetime.fromisoformat(end_date)}
    
    transactions = await db.finance_transactions.find(query).sort("created_at", -1).skip(skip).limit(limit).to_list(length=limit)
    
    total = await db.finance_transactions.count_documents(query)
    
    # Calculate totals
    credits = sum(t.get("amount", 0) for t in transactions if t.get("transaction_type") == "credit")
    debits = sum(t.get("amount", 0) for t in transactions if t.get("transaction_type") == "debit")
    
    return {
        "transactions": [serialize_doc(t) for t in transactions],
        "total": total,
        "summary": {
            "credits": credits,
            "debits": debits,
            "net": credits - debits
        }
    }

# ============== CASH MANAGEMENT ==============
@router.post("/cash/entry")
async def create_cash_entry(entry: CashEntryCreate):
    """Record cash transaction"""
    db = get_database()
    
    # Get or create cash account
    cash_account = await db.cash_accounts.find_one({"is_active": True})
    if not cash_account:
        cash_account = {
            "name": "Main Cash Account",
            "balance": 0,
            "is_active": True,
            "created_at": datetime.now(timezone.utc)
        }
        result = await db.cash_accounts.insert_one(cash_account)
        cash_account["_id"] = result.inserted_id
    
    # Calculate new balance
    if entry.entry_type == "in":
        new_balance = cash_account.get("balance", 0) + entry.amount
    else:
        new_balance = cash_account.get("balance", 0) - entry.amount
    
    entry_doc = {
        "entry_type": entry.entry_type,
        "amount": entry.amount,
        "description": entry.description,
        "category": entry.category,
        "received_from": entry.received_from,
        "paid_to": entry.paid_to,
        "balance_before": cash_account.get("balance", 0),
        "balance_after": new_balance,
        "created_at": datetime.now(timezone.utc)
    }
    
    # Update cash balance
    await db.cash_accounts.update_one(
        {"_id": cash_account["_id"]},
        {"$set": {"balance": new_balance, "updated_at": datetime.now(timezone.utc)}}
    )
    
    # Insert entry
    result = await db.cash_entries.insert_one(entry_doc)
    entry_doc["_id"] = str(result.inserted_id)
    
    return {"success": True, "entry": entry_doc, "new_balance": new_balance}

@router.get("/cash/balance")
async def get_cash_balance():
    """Get current cash balance"""
    db = get_database()
    
    cash_account = await db.cash_accounts.find_one({"is_active": True})
    
    return {
        "balance": cash_account.get("balance", 0) if cash_account else 0,
        "last_updated": cash_account.get("updated_at") if cash_account else None
    }

@router.get("/cash/entries")
async def get_cash_entries(limit: int = 50):
    """Get cash entries"""
    db = get_database()
    
    entries = await db.cash_entries.find({}).sort("created_at", -1).limit(limit).to_list(length=limit)
    
    return {"entries": [serialize_doc(e) for e in entries]}

# ============== FINANCE SUMMARY ==============
@router.get("/summary/daily")
async def get_daily_summary(date: Optional[str] = None):
    """Get daily financial summary"""
    db = get_database()
    
    if date:
        target_date = datetime.fromisoformat(date)
    else:
        target_date = datetime.now(timezone.utc)
    
    day_start = target_date.replace(hour=0, minute=0, second=0, microsecond=0)
    day_end = day_start + timedelta(days=1)
    
    # Get transactions
    transactions = await db.finance_transactions.find({
        "created_at": {"$gte": day_start, "$lt": day_end}
    }).to_list(length=500)
    
    # Categorize
    collections = sum(t.get("amount", 0) for t in transactions if t.get("transaction_type") == "credit")
    payments = sum(t.get("amount", 0) for t in transactions if t.get("transaction_type") == "debit")
    
    # Get cash entries
    cash_entries = await db.cash_entries.find({
        "created_at": {"$gte": day_start, "$lt": day_end}
    }).to_list(length=100)
    
    cash_in = sum(e.get("amount", 0) for e in cash_entries if e.get("entry_type") == "in")
    cash_out = sum(e.get("amount", 0) for e in cash_entries if e.get("entry_type") == "out")
    
    return {
        "date": day_start.strftime("%Y-%m-%d"),
        "bank": {
            "collections": collections,
            "payments": payments,
            "net": collections - payments,
            "transaction_count": len(transactions)
        },
        "cash": {
            "received": cash_in,
            "paid": cash_out,
            "net": cash_in - cash_out,
            "entry_count": len(cash_entries)
        },
        "total": {
            "inflow": collections + cash_in,
            "outflow": payments + cash_out,
            "net": (collections + cash_in) - (payments + cash_out)
        }
    }

@router.get("/summary/monthly")
async def get_monthly_summary(month: Optional[str] = None):
    """Get monthly financial summary"""
    db = get_database()
    
    if month:
        year, mon = map(int, month.split("-"))
        month_start = datetime(year, mon, 1, tzinfo=timezone.utc)
    else:
        now = datetime.now(timezone.utc)
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    
    if month_start.month == 12:
        month_end = month_start.replace(year=month_start.year + 1, month=1)
    else:
        month_end = month_start.replace(month=month_start.month + 1)
    
    # Get all transactions for the month
    transactions = await db.finance_transactions.find({
        "created_at": {"$gte": month_start, "$lt": month_end}
    }).to_list(length=5000)
    
    # Categorize by type
    categories = {}
    for t in transactions:
        cat = t.get("category", "other")
        if cat not in categories:
            categories[cat] = {"credit": 0, "debit": 0}
        if t.get("transaction_type") == "credit":
            categories[cat]["credit"] += t.get("amount", 0)
        else:
            categories[cat]["debit"] += t.get("amount", 0)
    
    total_credit = sum(t.get("amount", 0) for t in transactions if t.get("transaction_type") == "credit")
    total_debit = sum(t.get("amount", 0) for t in transactions if t.get("transaction_type") == "debit")
    
    return {
        "month": month_start.strftime("%Y-%m"),
        "total_credit": total_credit,
        "total_debit": total_debit,
        "net": total_credit - total_debit,
        "categories": categories,
        "transaction_count": len(transactions)
    }

# ============== CASH FLOW FORECAST ==============
@router.get("/forecast/cashflow")
async def get_cashflow_forecast():
    """AI-powered cash flow forecast for next 30 days"""
    db = get_database()
    
    now = datetime.now(timezone.utc)
    
    # Current balances
    bank_accounts = await db.bank_accounts.find({"is_active": True}).to_list(length=50)
    current_bank = sum(acc.get("current_balance", 0) for acc in bank_accounts)
    
    cash_account = await db.cash_accounts.find_one({"is_active": True})
    current_cash = cash_account.get("balance", 0) if cash_account else 0
    
    current_total = current_bank + current_cash
    
    # Expected inflows (bookings, collections)
    expected_collections = await db.bookings.find({
        "payment_status": "pending",
        "status": {"$in": ["confirmed", "in_progress"]}
    }).to_list(length=100)
    expected_inflow = sum(b.get("final_price", 0) for b in expected_collections)
    
    # Expected outflows
    # Pending vendor payments
    pending_vendors = await db.vendor_bills.find({"payment_status": "pending"}).to_list(length=100)
    expected_vendor_outflow = sum(v.get("amount", 0) for v in pending_vendors)
    
    # Pending salaries
    pending_salary = await db.salary_payments.find({"status": "pending"}).to_list(length=200)
    expected_salary_outflow = sum(s.get("amount", 0) for s in pending_salary)
    
    # Pending operator settlements
    pending_settlements = await db.operator_settlements.find({"status": "pending"}).to_list(length=100)
    expected_settlement_outflow = sum(s.get("amount", 0) for s in pending_settlements)
    
    # EMIs due
    upcoming_emis = await db.loans.find({"status": "active"}).to_list(length=20)
    expected_emi_outflow = sum(l.get("emi_amount", 0) for l in upcoming_emis)
    
    # Calculate forecast
    total_expected_outflow = expected_vendor_outflow + expected_salary_outflow + expected_settlement_outflow + expected_emi_outflow
    
    forecast_balance = current_total + expected_inflow - total_expected_outflow
    
    # Generate AI insights
    insights = []
    if forecast_balance < 0:
        insights.append({
            "type": "danger",
            "message": f"⚠️ Cash flow may become negative. Shortfall: ₹{abs(forecast_balance):,.0f}"
        })
    elif forecast_balance < current_total * 0.2:
        insights.append({
            "type": "warning", 
            "message": "⚠️ Cash reserves will be low. Consider expediting collections."
        })
    else:
        insights.append({
            "type": "success",
            "message": "✅ Cash flow looks healthy for next 30 days."
        })
    
    if expected_vendor_outflow > expected_inflow * 0.5:
        insights.append({
            "type": "info",
            "message": "💡 Vendor payments are high. Consider negotiating payment terms."
        })
    
    return {
        "current": {
            "bank_balance": current_bank,
            "cash_balance": current_cash,
            "total": current_total
        },
        "expected_inflow": {
            "collections": expected_inflow,
            "total": expected_inflow
        },
        "expected_outflow": {
            "vendor_payments": expected_vendor_outflow,
            "salaries": expected_salary_outflow,
            "operator_settlements": expected_settlement_outflow,
            "emis": expected_emi_outflow,
            "total": total_expected_outflow
        },
        "forecast": {
            "projected_balance": forecast_balance,
            "net_change": expected_inflow - total_expected_outflow,
            "health": "good" if forecast_balance > current_total * 0.3 else "warning" if forecast_balance > 0 else "critical"
        },
        "ai_insights": insights,
        "forecast_period": "Next 30 days"
    }
