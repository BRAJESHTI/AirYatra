from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
from uuid import uuid4
from database import get_database
from routes.auth_routes import get_current_user

router = APIRouter(prefix="/accounting", tags=["Accounting Integration"])

# Models
class AccountingConnection(BaseModel):
    provider: str  # tally, zoho, quickbooks
    api_key: Optional[str] = None
    company_id: Optional[str] = None
    settings: dict = {}

class InvoiceExport(BaseModel):
    invoice_ids: List[str]
    format: str = "json"  # json, xml, csv

class ExpenseEntry(BaseModel):
    category: str
    amount: float
    description: str
    date: str
    vendor: Optional[str] = None
    invoice_number: Optional[str] = None
    payment_mode: str = "cash"
    tax_amount: float = 0

class LedgerEntry(BaseModel):
    account_name: str
    debit: float = 0
    credit: float = 0
    narration: str
    reference: Optional[str] = None

# Predefined Chart of Accounts
CHART_OF_ACCOUNTS = {
    "assets": [
        {"code": "1001", "name": "Cash in Hand", "type": "current_asset"},
        {"code": "1002", "name": "Bank Account", "type": "current_asset"},
        {"code": "1003", "name": "Accounts Receivable", "type": "current_asset"},
        {"code": "1101", "name": "Aircraft", "type": "fixed_asset"},
        {"code": "1102", "name": "Equipment", "type": "fixed_asset"}
    ],
    "liabilities": [
        {"code": "2001", "name": "Accounts Payable", "type": "current_liability"},
        {"code": "2002", "name": "GST Payable", "type": "current_liability"},
        {"code": "2003", "name": "TDS Payable", "type": "current_liability"}
    ],
    "income": [
        {"code": "4001", "name": "Charter Revenue", "type": "operating_income"},
        {"code": "4002", "name": "Landing Fee Income", "type": "operating_income"},
        {"code": "4003", "name": "Insurance Revenue", "type": "other_income"}
    ],
    "expenses": [
        {"code": "5001", "name": "Fuel Expenses", "type": "operating_expense"},
        {"code": "5002", "name": "Pilot Salaries", "type": "operating_expense"},
        {"code": "5003", "name": "Maintenance", "type": "operating_expense"},
        {"code": "5004", "name": "Landing Fees", "type": "operating_expense"},
        {"code": "5005", "name": "Insurance Premium", "type": "operating_expense"},
        {"code": "5006", "name": "Marketing", "type": "admin_expense"},
        {"code": "5007", "name": "Office Expenses", "type": "admin_expense"}
    ]
}

# Helper Functions
def format_tally_xml(invoice: dict) -> str:
    """Format invoice data for Tally import"""
    return f"""<ENVELOPE>
<HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER>
<BODY>
<IMPORTDATA>
<REQUESTDESC><REPORTNAME>Vouchers</REPORTNAME></REQUESTDESC>
<REQUESTDATA>
<TALLYMESSAGE>
<VOUCHER VCHTYPE="Sales">
<DATE>{invoice.get('date', '')}</DATE>
<VOUCHERNUMBER>{invoice.get('invoice_number', '')}</VOUCHERNUMBER>
<PARTYLEDGERNAME>{invoice.get('customer_name', '')}</PARTYLEDGERNAME>
<AMOUNT>{invoice.get('total_amount', 0)}</AMOUNT>
</VOUCHER>
</TALLYMESSAGE>
</REQUESTDATA>
</IMPORTDATA>
</BODY>
</ENVELOPE>"""

def calculate_gst(amount: float, gst_rate: float = 18) -> dict:
    """Calculate GST breakdown"""
    gst_amount = amount * gst_rate / 100
    return {
        "base_amount": round(amount, 2),
        "cgst": round(gst_amount / 2, 2),
        "sgst": round(gst_amount / 2, 2),
        "igst": 0,  # For interstate
        "total_gst": round(gst_amount, 2),
        "total_with_gst": round(amount + gst_amount, 2)
    }

# API Endpoints
@router.get("/providers")
async def get_accounting_providers():
    """Get supported accounting software"""
    return {
        "providers": [
            {"id": "tally", "name": "Tally Prime", "formats": ["xml", "json"]},
            {"id": "zoho", "name": "Zoho Books", "formats": ["json", "csv"]},
            {"id": "quickbooks", "name": "QuickBooks", "formats": ["json", "csv"]},
            {"id": "manual", "name": "Manual Export", "formats": ["csv", "pdf"]}
        ]
    }

@router.post("/connect")
async def connect_accounting(connection: AccountingConnection, current_user: dict = Depends(get_current_user)):
    """Connect to accounting software"""
    if "admin" not in current_user.get("roles", []):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    db = get_database()
    
    connection_data = {
        "id": str(uuid4()),
        "provider": connection.provider,
        "api_key": connection.api_key,
        "company_id": connection.company_id,
        "settings": connection.settings,
        "connected_by": current_user["id"],
        "connected_at": datetime.now(timezone.utc).isoformat(),
        "is_active": True
    }
    
    await db.accounting_connections.update_one(
        {"provider": connection.provider},
        {"$set": connection_data},
        upsert=True
    )
    
    return {"message": f"Connected to {connection.provider}", "connection_id": connection_data["id"]}

@router.get("/chart-of-accounts")
async def get_chart_of_accounts(current_user: dict = Depends(get_current_user)):
    """Get chart of accounts"""
    return {"chart_of_accounts": CHART_OF_ACCOUNTS}

@router.post("/export-invoices")
async def export_invoices(export: InvoiceExport, current_user: dict = Depends(get_current_user)):
    """Export invoices for accounting software"""
    if "admin" not in current_user.get("roles", []):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    db = get_database()
    
    invoices = await db.invoices.find(
        {"id": {"$in": export.invoice_ids}},
        {"_id": 0}
    ).to_list(100)
    
    if export.format == "xml":
        # Tally format
        xml_data = "\n".join([format_tally_xml(inv) for inv in invoices])
        return {"format": "xml", "data": xml_data, "count": len(invoices)}
    
    elif export.format == "csv":
        # CSV format
        headers = ["Invoice No", "Date", "Customer", "Amount", "GST", "Total"]
        rows = []
        for inv in invoices:
            rows.append([
                inv.get("invoice_number", ""),
                inv.get("date", ""),
                inv.get("customer_name", ""),
                inv.get("amount", 0),
                inv.get("gst_amount", 0),
                inv.get("total_amount", 0)
            ])
        return {"format": "csv", "headers": headers, "rows": rows, "count": len(invoices)}
    
    return {"format": "json", "invoices": invoices, "count": len(invoices)}

@router.post("/expense")
async def record_expense(expense: ExpenseEntry, current_user: dict = Depends(get_current_user)):
    """Record an expense"""
    if "admin" not in current_user.get("roles", []) and "finance" not in current_user.get("roles", []):
        raise HTTPException(status_code=403, detail="Access denied")
    
    db = get_database()
    
    expense_data = {
        "id": str(uuid4()),
        **expense.dict(),
        "total_amount": expense.amount + expense.tax_amount,
        "recorded_by": current_user["id"],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "synced": False
    }
    
    await db.expenses.insert_one(expense_data)
    expense_data.pop("_id", None)
    
    return {"message": "Expense recorded", "expense": expense_data}

@router.get("/expenses")
async def get_expenses(start_date: Optional[str] = None, end_date: Optional[str] = None, category: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    """Get expenses"""
    if "admin" not in current_user.get("roles", []) and "finance" not in current_user.get("roles", []):
        raise HTTPException(status_code=403, detail="Access denied")
    
    db = get_database()
    
    query = {}
    if start_date:
        query["date"] = {"$gte": start_date}
    if end_date:
        query.setdefault("date", {})["$lte"] = end_date
    if category:
        query["category"] = category
    
    expenses = await db.expenses.find(query, {"_id": 0}).sort("date", -1).to_list(500)
    
    total = sum(e.get("total_amount", 0) for e in expenses)
    
    return {"expenses": expenses, "total": total, "count": len(expenses)}

@router.post("/ledger-entry")
async def create_ledger_entry(entry: LedgerEntry, current_user: dict = Depends(get_current_user)):
    """Create a ledger entry"""
    if "admin" not in current_user.get("roles", []) and "finance" not in current_user.get("roles", []):
        raise HTTPException(status_code=403, detail="Access denied")
    
    db = get_database()
    
    entry_data = {
        "id": str(uuid4()),
        **entry.dict(),
        "date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "created_by": current_user["id"],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.ledger_entries.insert_one(entry_data)
    entry_data.pop("_id", None)
    
    return {"message": "Ledger entry created", "entry": entry_data}

@router.get("/trial-balance")
async def get_trial_balance(as_of_date: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    """Get trial balance"""
    if "admin" not in current_user.get("roles", []) and "finance" not in current_user.get("roles", []):
        raise HTTPException(status_code=403, detail="Access denied")
    
    db = get_database()
    
    date_filter = as_of_date or datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    pipeline = [
        {"$match": {"date": {"$lte": date_filter}}},
        {"$group": {
            "_id": "$account_name",
            "total_debit": {"$sum": "$debit"},
            "total_credit": {"$sum": "$credit"}
        }},
        {"$sort": {"_id": 1}}
    ]
    
    balances = []
    async for doc in db.ledger_entries.aggregate(pipeline):
        balances.append({
            "account": doc["_id"],
            "debit": doc["total_debit"],
            "credit": doc["total_credit"],
            "balance": doc["total_debit"] - doc["total_credit"]
        })
    
    total_debit = sum(b["debit"] for b in balances)
    total_credit = sum(b["credit"] for b in balances)
    
    return {
        "as_of_date": date_filter,
        "accounts": balances,
        "totals": {
            "debit": total_debit,
            "credit": total_credit,
            "balanced": abs(total_debit - total_credit) < 0.01
        }
    }

@router.get("/profit-loss")
async def get_profit_loss(start_date: str, end_date: str, current_user: dict = Depends(get_current_user)):
    """Get profit & loss statement"""
    if "admin" not in current_user.get("roles", []) and "finance" not in current_user.get("roles", []):
        raise HTTPException(status_code=403, detail="Access denied")
    
    db = get_database()
    
    # Get revenue from bookings
    revenue_pipeline = [
        {"$match": {"created_at": {"$gte": start_date, "$lte": end_date}, "status": "confirmed"}},
        {"$group": {"_id": None, "total": {"$sum": "$total_amount"}}}
    ]
    revenue_result = await db.bookings.aggregate(revenue_pipeline).to_list(1)
    revenue = revenue_result[0]["total"] if revenue_result else 0
    
    # Get expenses
    expense_pipeline = [
        {"$match": {"date": {"$gte": start_date, "$lte": end_date}}},
        {"$group": {"_id": "$category", "total": {"$sum": "$total_amount"}}}
    ]
    expenses_by_category = {}
    total_expenses = 0
    async for doc in db.expenses.aggregate(expense_pipeline):
        expenses_by_category[doc["_id"]] = doc["total"]
        total_expenses += doc["total"]
    
    return {
        "period": f"{start_date} to {end_date}",
        "revenue": {
            "charter_income": revenue,
            "other_income": 0,
            "total_revenue": revenue
        },
        "expenses": {
            "by_category": expenses_by_category,
            "total_expenses": total_expenses
        },
        "net_profit": revenue - total_expenses,
        "profit_margin": round((revenue - total_expenses) / revenue * 100, 1) if revenue > 0 else 0
    }

@router.get("/gst-report")
async def get_gst_report(month: str, year: int, current_user: dict = Depends(get_current_user)):
    """Get GST report for filing"""
    if "admin" not in current_user.get("roles", []) and "finance" not in current_user.get("roles", []):
        raise HTTPException(status_code=403, detail="Access denied")
    
    db = get_database()
    
    # Simulated GST data
    return {
        "period": f"{month} {year}",
        "outward_supplies": {
            "taxable_value": 5000000,
            "cgst": 450000,
            "sgst": 450000,
            "igst": 0,
            "total_tax": 900000
        },
        "inward_supplies": {
            "taxable_value": 1500000,
            "cgst": 135000,
            "sgst": 135000,
            "igst": 0,
            "total_tax": 270000
        },
        "net_liability": {
            "cgst": 315000,
            "sgst": 315000,
            "igst": 0,
            "total": 630000
        },
        "filing_status": "pending"
    }
