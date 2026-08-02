"""
AirYatra Finance ERP - Advanced Treasury Routes
Government Challans, Compliance Dashboard, Bank Reconciliation
"""
from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone, timedelta
from bson import ObjectId
from database import get_database
from enum import Enum
import uuid

router = APIRouter(prefix="/finance/advanced", tags=["finance-erp-advanced"])

# ============== ENUMS ==============
class ChallanType(str, Enum):
    GST = "GST"
    TDS = "TDS"
    PF = "PF"
    ESIC = "ESIC"
    PT = "PT"  # Professional Tax
    IT = "IT"  # Income Tax Advance

class ChallanStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    PAID = "paid"
    OVERDUE = "overdue"
    CANCELLED = "cancelled"

class ReconciliationStatus(str, Enum):
    PENDING = "pending"
    MATCHED = "matched"
    UNMATCHED = "unmatched"
    PARTIAL = "partial"
    IGNORED = "ignored"

# ============== MODELS ==============
class ChallanCreate(BaseModel):
    challan_type: str
    period: str  # e.g., "Jul-2026", "Q1-2026"
    due_date: str
    amount: float
    description: Optional[str] = None
    reference_number: Optional[str] = None
    notes: Optional[str] = None

class BankStatementEntry(BaseModel):
    transaction_date: str
    description: str
    reference: Optional[str] = None
    debit: float = 0
    credit: float = 0
    balance: float = 0
    bank_account_id: str

class VendorPaymentApproval(BaseModel):
    bill_id: str
    otp_code: str
    payment_mode: str = "NEFT"  # NEFT, RTGS, IMPS, UPI
    scheduled_date: Optional[str] = None
    remarks: Optional[str] = None

# Helper functions
def serialize_doc(doc):
    if doc:
        doc["_id"] = str(doc["_id"])
    return doc

def get_challan_due_dates():
    """Get standard due dates for various challans"""
    now = datetime.now(timezone.utc)
    return {
        "GST": 20,  # 20th of next month
        "TDS": 7,   # 7th of next month
        "PF": 15,   # 15th of next month
        "ESIC": 15, # 15th of next month
        "PT": 30,   # End of month
        "IT": 15    # 15th (quarterly advance tax)
    }

# ============== GOVERNMENT CHALLANS ==============
@router.post("/challans")
async def create_challan(challan: ChallanCreate):
    """Create a new government challan"""
    db = get_database()
    
    challan_doc = {
        "id": str(uuid.uuid4()),
        "challan_number": f"CHL-{datetime.now().strftime('%Y%m%d')}-{str(uuid.uuid4())[:4].upper()}",
        "challan_type": challan.challan_type,
        "period": challan.period,
        "due_date": challan.due_date,
        "amount": challan.amount,
        "description": challan.description,
        "reference_number": challan.reference_number,
        "notes": challan.notes,
        "status": "pending",
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }
    
    await db.challans.insert_one(challan_doc)
    
    return {"success": True, "challan": serialize_doc(challan_doc)}

@router.get("/challans")
async def get_challans(
    challan_type: Optional[str] = None,
    status: Optional[str] = None,
    period: Optional[str] = None
):
    """Get all challans with filters"""
    db = get_database()
    
    query = {}
    if challan_type:
        query["challan_type"] = challan_type
    if status:
        query["status"] = status
    if period:
        query["period"] = period
    
    challans = await db.challans.find(query).sort("due_date", 1).to_list(length=500)
    
    # Check for overdue challans
    now = datetime.now(timezone.utc)
    for challan in challans:
        if challan.get("status") == "pending":
            due_date = datetime.fromisoformat(challan["due_date"]) if isinstance(challan["due_date"], str) else challan["due_date"]
            if isinstance(due_date, str):
                due_date = datetime.fromisoformat(due_date.replace("Z", "+00:00"))
            if due_date.replace(tzinfo=timezone.utc) < now:
                challan["status"] = "overdue"
                await db.challans.update_one(
                    {"id": challan["id"]},
                    {"$set": {"status": "overdue"}}
                )
    
    # Summary by type
    summary = {}
    for ctype in ["GST", "TDS", "PF", "ESIC", "PT", "IT"]:
        type_challans = [c for c in challans if c.get("challan_type") == ctype]
        summary[ctype] = {
            "pending_count": len([c for c in type_challans if c.get("status") in ["pending", "overdue"]]),
            "pending_amount": sum(c.get("amount", 0) for c in type_challans if c.get("status") in ["pending", "overdue"]),
            "paid_count": len([c for c in type_challans if c.get("status") == "paid"]),
            "overdue_count": len([c for c in type_challans if c.get("status") == "overdue"])
        }
    
    return {
        "challans": [serialize_doc(c) for c in challans],
        "summary": summary,
        "total_pending": sum(c.get("amount", 0) for c in challans if c.get("status") in ["pending", "overdue"])
    }

@router.put("/challans/{challan_id}/pay")
async def mark_challan_paid(challan_id: str, payment_ref: Optional[str] = None):
    """Mark challan as paid"""
    db = get_database()
    
    result = await db.challans.update_one(
        {"id": challan_id},
        {"$set": {
            "status": "paid",
            "paid_at": datetime.now(timezone.utc),
            "payment_reference": payment_ref,
            "updated_at": datetime.now(timezone.utc)
        }}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Challan not found")
    
    return {"success": True, "message": "Challan marked as paid"}

@router.get("/challans/upcoming")
async def get_upcoming_challans():
    """Get upcoming challan deadlines"""
    db = get_database()
    
    now = datetime.now(timezone.utc)
    next_30_days = now + timedelta(days=30)
    
    # Get all pending/overdue challans
    challans = await db.challans.find({
        "status": {"$in": ["pending", "overdue"]}
    }).sort("due_date", 1).to_list(length=100)
    
    upcoming = []
    for challan in challans:
        due_date_str = challan.get("due_date", "")
        try:
            if isinstance(due_date_str, str):
                due_date = datetime.fromisoformat(due_date_str.replace("Z", "+00:00"))
            else:
                due_date = due_date_str
            
            days_remaining = (due_date.replace(tzinfo=timezone.utc) - now).days
            
            upcoming.append({
                **serialize_doc(challan),
                "days_remaining": days_remaining,
                "urgency": "critical" if days_remaining <= 3 else "warning" if days_remaining <= 7 else "normal"
            })
        except (ValueError, TypeError, AttributeError):
            pass
    
    return {"upcoming": upcoming}

# ============== COMPLIANCE DASHBOARD ==============
@router.get("/compliance/dashboard")
async def get_compliance_dashboard():
    """Get unified compliance dashboard"""
    db = get_database()
    
    now = datetime.now(timezone.utc)
    
    # Get all pending challans
    pending_challans = await db.challans.find({
        "status": {"$in": ["pending", "overdue"]}
    }).to_list(length=500)
    
    # Group by type
    compliance_status = {}
    for ctype in ["GST", "TDS", "PF", "ESIC", "PT", "IT"]:
        type_challans = [c for c in pending_challans if c.get("challan_type") == ctype]
        overdue = [c for c in type_challans if c.get("status") == "overdue"]
        
        compliance_status[ctype] = {
            "pending_count": len(type_challans),
            "pending_amount": sum(c.get("amount", 0) for c in type_challans),
            "overdue_count": len(overdue),
            "overdue_amount": sum(c.get("amount", 0) for c in overdue),
            "status": "overdue" if overdue else "pending" if type_challans else "compliant",
            "next_due": type_challans[0].get("due_date") if type_challans else None
        }
    
    # Get pending vendor TDS
    pending_vendor_tds = await db.vendor_bills.count_documents({
        "tds_applicable": True,
        "tds_deposited": {"$ne": True},
        "payment_status": "paid"
    })
    
    # Calculate overall compliance score
    total_items = len(pending_challans) + pending_vendor_tds
    overdue_items = len([c for c in pending_challans if c.get("status") == "overdue"])
    
    if total_items == 0:
        compliance_score = 100
    else:
        compliance_score = max(0, 100 - (overdue_items * 20) - (total_items * 2))
    
    # Get upcoming deadlines (next 7 days)
    critical_deadlines = []
    for challan in pending_challans:
        try:
            due_date_str = challan.get("due_date", "")
            if isinstance(due_date_str, str):
                due_date = datetime.fromisoformat(due_date_str.replace("Z", "+00:00"))
            else:
                due_date = due_date_str
            
            days_remaining = (due_date.replace(tzinfo=timezone.utc) - now).days
            
            if days_remaining <= 7:
                critical_deadlines.append({
                    "type": challan.get("challan_type"),
                    "period": challan.get("period"),
                    "amount": challan.get("amount"),
                    "due_date": challan.get("due_date"),
                    "days_remaining": days_remaining,
                    "urgency": "critical" if days_remaining <= 3 else "warning"
                })
        except (ValueError, TypeError, AttributeError):
            pass
    
    return {
        "compliance_score": compliance_score,
        "overall_status": "critical" if overdue_items > 0 else "warning" if total_items > 3 else "good",
        "compliance_by_type": compliance_status,
        "critical_deadlines": sorted(critical_deadlines, key=lambda x: x.get("days_remaining", 999)),
        "summary": {
            "total_pending": len(pending_challans),
            "total_pending_amount": sum(c.get("amount", 0) for c in pending_challans),
            "overdue_count": overdue_items,
            "pending_vendor_tds": pending_vendor_tds
        },
        "last_updated": now.isoformat()
    }

@router.get("/compliance/calendar")
async def get_compliance_calendar():
    """Get compliance calendar with all due dates"""
    db = get_database()
    
    now = datetime.now(timezone.utc)
    current_month = now.month
    current_year = now.year
    
    # Standard due dates
    due_dates = get_challan_due_dates()
    
    calendar_events = []
    
    # Generate events for current and next 2 months
    for month_offset in range(3):
        month = (current_month + month_offset - 1) % 12 + 1
        year = current_year + ((current_month + month_offset - 1) // 12)
        
        for challan_type, day in due_dates.items():
            try:
                due_date = datetime(year, month, min(day, 28))  # Handle Feb
                
                # Check if challan exists for this period
                period = f"{due_date.strftime('%b')}-{year}"
                existing = await db.challans.find_one({
                    "challan_type": challan_type,
                    "period": period
                })
                
                calendar_events.append({
                    "date": due_date.strftime("%Y-%m-%d"),
                    "type": challan_type,
                    "period": period,
                    "has_challan": existing is not None,
                    "status": existing.get("status") if existing else "not_created",
                    "amount": existing.get("amount") if existing else None
                })
            except (ValueError, TypeError, AttributeError):
                pass
    
    return {"calendar_events": calendar_events}

# ============== BANK RECONCILIATION ==============
@router.post("/reconciliation/upload-statement")
async def upload_bank_statement(entries: List[BankStatementEntry]):
    """Upload bank statement entries for reconciliation"""
    db = get_database()
    
    statement_id = str(uuid.uuid4())
    
    for entry in entries:
        entry_doc = {
            "id": str(uuid.uuid4()),
            "statement_id": statement_id,
            "bank_account_id": entry.bank_account_id,
            "transaction_date": entry.transaction_date,
            "description": entry.description,
            "reference": entry.reference,
            "debit": entry.debit,
            "credit": entry.credit,
            "balance": entry.balance,
            "reconciliation_status": "pending",
            "matched_transaction_id": None,
            "created_at": datetime.now(timezone.utc)
        }
        await db.bank_statement_entries.insert_one(entry_doc)
    
    return {
        "success": True,
        "statement_id": statement_id,
        "entries_uploaded": len(entries)
    }

@router.get("/reconciliation/entries")
async def get_reconciliation_entries(
    bank_account_id: Optional[str] = None,
    status: Optional[str] = None,
    statement_id: Optional[str] = None
):
    """Get bank statement entries for reconciliation"""
    db = get_database()
    
    query = {}
    if bank_account_id:
        query["bank_account_id"] = bank_account_id
    if status:
        query["reconciliation_status"] = status
    if statement_id:
        query["statement_id"] = statement_id
    
    entries = await db.bank_statement_entries.find(query).sort("transaction_date", -1).to_list(length=500)
    
    # Get summary
    total_entries = len(entries)
    matched = len([e for e in entries if e.get("reconciliation_status") == "matched"])
    unmatched = len([e for e in entries if e.get("reconciliation_status") == "unmatched"])
    pending = len([e for e in entries if e.get("reconciliation_status") == "pending"])
    
    return {
        "entries": [serialize_doc(e) for e in entries],
        "summary": {
            "total": total_entries,
            "matched": matched,
            "unmatched": unmatched,
            "pending": pending,
            "reconciliation_rate": round((matched / total_entries * 100) if total_entries > 0 else 0, 1)
        }
    }

@router.post("/reconciliation/auto-match")
async def auto_match_transactions(bank_account_id: str):
    """Automatically match bank statement entries with recorded transactions"""
    db = get_database()
    
    # Get unreconciled bank statement entries
    entries = await db.bank_statement_entries.find({
        "bank_account_id": bank_account_id,
        "reconciliation_status": "pending"
    }).to_list(length=500)
    
    # Get recorded transactions
    transactions = await db.finance_transactions.find({
        "bank_account_id": bank_account_id
    }).to_list(length=1000)
    
    matched_count = 0
    
    for entry in entries:
        entry_amount = entry.get("credit", 0) if entry.get("credit", 0) > 0 else -entry.get("debit", 0)
        entry_date = entry.get("transaction_date", "")
        
        # Try to find matching transaction
        for txn in transactions:
            txn_amount = txn.get("amount", 0) if txn.get("transaction_type") == "credit" else -txn.get("amount", 0)
            txn_date = txn.get("created_at", "")
            
            # Match by amount and approximate date (within 2 days)
            if abs(entry_amount - txn_amount) < 1:  # Allow ₹1 tolerance
                try:
                    entry_dt = datetime.fromisoformat(entry_date.replace("Z", "+00:00")) if isinstance(entry_date, str) else entry_date
                    txn_dt = datetime.fromisoformat(str(txn_date).replace("Z", "+00:00")) if isinstance(txn_date, str) else txn_date
                    
                    if abs((entry_dt - txn_dt).days) <= 2:
                        # Match found!
                        await db.bank_statement_entries.update_one(
                            {"id": entry["id"]},
                            {"$set": {
                                "reconciliation_status": "matched",
                                "matched_transaction_id": str(txn.get("_id")),
                                "matched_at": datetime.now(timezone.utc)
                            }}
                        )
                        matched_count += 1
                        break
                except (ValueError, TypeError, AttributeError):
                    pass
    
    # Mark remaining as unmatched
    await db.bank_statement_entries.update_many(
        {
            "bank_account_id": bank_account_id,
            "reconciliation_status": "pending"
        },
        {"$set": {"reconciliation_status": "unmatched"}}
    )
    
    return {
        "success": True,
        "matched_count": matched_count,
        "total_processed": len(entries)
    }

@router.put("/reconciliation/entries/{entry_id}/match")
async def manual_match_entry(entry_id: str, transaction_id: str):
    """Manually match a bank statement entry with a transaction"""
    db = get_database()
    
    result = await db.bank_statement_entries.update_one(
        {"id": entry_id},
        {"$set": {
            "reconciliation_status": "matched",
            "matched_transaction_id": transaction_id,
            "matched_at": datetime.now(timezone.utc),
            "manual_match": True
        }}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Entry not found")
    
    return {"success": True, "message": "Entry matched successfully"}

@router.put("/reconciliation/entries/{entry_id}/ignore")
async def ignore_entry(entry_id: str, reason: Optional[str] = None):
    """Mark an entry as ignored (e.g., bank charges, interest)"""
    db = get_database()
    
    result = await db.bank_statement_entries.update_one(
        {"id": entry_id},
        {"$set": {
            "reconciliation_status": "ignored",
            "ignore_reason": reason,
            "ignored_at": datetime.now(timezone.utc)
        }}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Entry not found")
    
    return {"success": True, "message": "Entry ignored"}

@router.get("/reconciliation/summary")
async def get_reconciliation_summary(bank_account_id: Optional[str] = None):
    """Get overall reconciliation summary"""
    db = get_database()
    
    query = {}
    if bank_account_id:
        query["bank_account_id"] = bank_account_id
    
    entries = await db.bank_statement_entries.find(query).to_list(length=5000)
    
    total_credits = sum(e.get("credit", 0) for e in entries)
    total_debits = sum(e.get("debit", 0) for e in entries)
    
    matched_entries = [e for e in entries if e.get("reconciliation_status") == "matched"]
    matched_credits = sum(e.get("credit", 0) for e in matched_entries)
    matched_debits = sum(e.get("debit", 0) for e in matched_entries)
    
    unmatched_entries = [e for e in entries if e.get("reconciliation_status") == "unmatched"]
    
    return {
        "total_entries": len(entries),
        "matched_entries": len(matched_entries),
        "unmatched_entries": len(unmatched_entries),
        "ignored_entries": len([e for e in entries if e.get("reconciliation_status") == "ignored"]),
        "bank_balance": {
            "total_credits": total_credits,
            "total_debits": total_debits,
            "net": total_credits - total_debits
        },
        "reconciled_amount": {
            "credits": matched_credits,
            "debits": matched_debits,
            "net": matched_credits - matched_debits
        },
        "unreconciled_amount": {
            "credits": total_credits - matched_credits,
            "debits": total_debits - matched_debits
        },
        "reconciliation_rate": round((len(matched_entries) / len(entries) * 100) if entries else 0, 1),
        "unmatched_items": [serialize_doc(e) for e in unmatched_entries[:10]]  # Top 10 unmatched
    }

# ============== VENDOR PAYMENT WITH OTP ==============
@router.post("/vendor-payment/initiate")
async def initiate_vendor_payment(bill_id: str, background_tasks: BackgroundTasks):
    """Initiate vendor payment - sends OTP for approval"""
    db = get_database()
    
    # Get bill
    bill = await db.vendor_bills.find_one({"id": bill_id})
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")
    
    if bill.get("payment_status") == "paid":
        raise HTTPException(status_code=400, detail="Bill already paid")
    
    # Generate OTP
    otp = str(uuid.uuid4().int)[:6]
    
    # Store OTP (expires in 10 minutes)
    await db.payment_otps.insert_one({
        "bill_id": bill_id,
        "otp": otp,
        "created_at": datetime.now(timezone.utc),
        "expires_at": datetime.now(timezone.utc) + timedelta(minutes=10),
        "used": False
    })
    
    # TODO: Send OTP via email/SMS in production
    
    return {
        "success": True,
        "message": "OTP sent for payment approval",
        "bill_id": bill_id,
        "amount": bill.get("net_payable", bill.get("amount")),
        "vendor": bill.get("vendor_name"),
        "otp_valid_minutes": 10,
        # For testing - remove in production
        "test_otp": otp
    }

@router.post("/vendor-payment/approve")
async def approve_vendor_payment(approval: VendorPaymentApproval):
    """Approve vendor payment with OTP"""
    db = get_database()
    
    # Verify OTP
    otp_record = await db.payment_otps.find_one({
        "bill_id": approval.bill_id,
        "otp": approval.otp_code,
        "used": False
    })
    
    if not otp_record:
        raise HTTPException(status_code=400, detail="Invalid or expired OTP")
    
    # Check expiry
    if datetime.now(timezone.utc) > otp_record.get("expires_at", datetime.now(timezone.utc)):
        raise HTTPException(status_code=400, detail="OTP expired")
    
    # Mark OTP as used
    await db.payment_otps.update_one(
        {"_id": otp_record["_id"]},
        {"$set": {"used": True}}
    )
    
    # Get bill
    bill = await db.vendor_bills.find_one({"id": approval.bill_id})
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")
    
    # Create payment record
    payment_doc = {
        "id": str(uuid.uuid4()),
        "bill_id": approval.bill_id,
        "vendor_id": bill.get("vendor_id"),
        "amount": bill.get("net_payable", bill.get("amount")),
        "payment_mode": approval.payment_mode,
        "scheduled_date": approval.scheduled_date or datetime.now(timezone.utc).isoformat(),
        "status": "approved",
        "approved_at": datetime.now(timezone.utc),
        "remarks": approval.remarks,
        "created_at": datetime.now(timezone.utc)
    }
    
    await db.vendor_payments.insert_one(payment_doc)
    
    # Update bill status
    await db.vendor_bills.update_one(
        {"id": approval.bill_id},
        {"$set": {
            "payment_status": "processing",
            "approved_at": datetime.now(timezone.utc),
            "payment_mode": approval.payment_mode
        }}
    )
    
    return {
        "success": True,
        "message": "Payment approved successfully",
        "payment_id": payment_doc["id"],
        "payment_mode": approval.payment_mode,
        "amount": payment_doc["amount"]
    }

@router.get("/vendor-payment/pending")
async def get_pending_vendor_payments():
    """Get all pending vendor payments awaiting approval or processing"""
    db = get_database()
    
    # Get pending bills
    pending_bills = await db.vendor_bills.find({
        "payment_status": {"$in": ["pending", "approved", "processing"]}
    }).to_list(length=100)
    
    # Get vendor details
    vendor_ids = list(set(b.get("vendor_id") for b in pending_bills if b.get("vendor_id")))
    vendors = await db.vendors.find({"id": {"$in": vendor_ids}}).to_list(length=100)
    vendor_map = {v["id"]: v for v in vendors}
    
    # Enrich bills
    for bill in pending_bills:
        vendor = vendor_map.get(bill.get("vendor_id"), {})
        bill["vendor_name"] = vendor.get("name", "Unknown")
        bill["vendor_bank"] = vendor.get("bank_name", "")
        bill["vendor_account"] = vendor.get("account_number", "")[-4:] if vendor.get("account_number") else ""
    
    return {
        "pending_bills": [serialize_doc(b) for b in pending_bills],
        "total_amount": sum(b.get("net_payable", b.get("amount", 0)) for b in pending_bills)
    }
