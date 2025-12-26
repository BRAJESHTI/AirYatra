"""
Payment Gateway Integration & Auto Transfer System
- Bank API Integration (Razorpay/PayU/Custom)
- Bulk Salary Transfer
- Vendor Bill Payment with TDS
- Payment Reconciliation & Reversal
"""
from fastapi import APIRouter, HTTPException, Depends
from typing import Optional, List
from datetime import datetime, timezone
from uuid import uuid4
from enum import Enum
from decimal import Decimal, ROUND_HALF_UP
from database import get_database
from middleware import get_current_user, require_roles
from models import UserRole
import os
import logging

router = APIRouter(prefix="/payments", tags=["Payment Gateway"])
logger = logging.getLogger(__name__)


# ==================== ENUMS ====================

class PaymentMode(str, Enum):
    NEFT = "neft"
    RTGS = "rtgs"
    IMPS = "imps"
    UPI = "upi"

class TransactionType(str, Enum):
    SALARY = "salary"
    VENDOR = "vendor"
    REIMBURSEMENT = "reimbursement"
    REFUND = "refund"
    REVERSAL = "reversal"

class TransactionStatus(str, Enum):
    PENDING = "pending"
    INITIATED = "initiated"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    REVERSED = "reversed"

class TDSSection(str, Enum):
    SEC_194C = "194C"  # Contractor - 1%/2%
    SEC_194J = "194J"  # Professional - 10%
    SEC_194H = "194H"  # Commission - 5%
    SEC_194I = "194I"  # Rent - 10%
    SEC_194A = "194A"  # Interest - 10%
    NONE = "none"


# ==================== TDS RATES ====================
TDS_RATES = {
    "194C": {"individual": 1.0, "company": 2.0},
    "194J": {"individual": 10.0, "company": 10.0},
    "194H": {"individual": 5.0, "company": 5.0},
    "194I": {"individual": 10.0, "company": 10.0},
    "194A": {"individual": 10.0, "company": 10.0},
    "none": {"individual": 0, "company": 0}
}


# ==================== BANK API SIMULATION ====================
# In production, replace with actual Razorpay/PayU/Bank API

class BankAPIClient:
    """
    Bank API Client for fund transfers
    Replace with actual bank API in production
    """
    
    @staticmethod
    async def initiate_transfer(
        amount: float,
        beneficiary_account: str,
        beneficiary_ifsc: str,
        beneficiary_name: str,
        mode: str = "NEFT",
        narration: str = ""
    ) -> dict:
        """Initiate bank transfer"""
        # Generate mock UTR
        utr = f"UTR{datetime.now().strftime('%Y%m%d%H%M%S')}{str(uuid4())[:6].upper()}"
        
        # In production, call actual bank API:
        # response = await razorpay.transfers.create({...})
        # response = await bank_api.fund_transfer({...})
        
        return {
            "status": "success",
            "transaction_id": str(uuid4()),
            "utr_number": utr,
            "mode": mode,
            "amount": amount,
            "beneficiary": beneficiary_name,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
    
    @staticmethod
    async def check_status(transaction_id: str) -> dict:
        """Check transfer status"""
        return {
            "status": "completed",
            "transaction_id": transaction_id,
            "completed_at": datetime.now(timezone.utc).isoformat()
        }
    
    @staticmethod
    async def reverse_transfer(transaction_id: str, reason: str) -> dict:
        """Reverse a transfer"""
        return {
            "status": "reversed",
            "original_transaction": transaction_id,
            "reversal_id": str(uuid4()),
            "reason": reason,
            "reversed_at": datetime.now(timezone.utc).isoformat()
        }


bank_client = BankAPIClient()


# ==================== BULK SALARY TRANSFER ====================

@router.post("/salary/bulk-transfer")
async def initiate_bulk_salary_transfer(
    data: dict,
    current_user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.FINANCE])),
    db=Depends(get_database)
):
    """
    Initiate bulk salary transfer for all approved payrolls
    बल्क सैलरी ट्रांसफर
    """
    month = data.get("month", datetime.now().month)
    year = data.get("year", datetime.now().year)
    payment_mode = data.get("mode", PaymentMode.NEFT.value)
    
    # Get approved payrolls
    payrolls = await db.payroll.find({
        "month": month,
        "year": year,
        "status": "approved"
    }, {"_id": 0}).to_list(500)
    
    if not payrolls:
        raise HTTPException(status_code=400, detail="No approved payrolls found for this period")
    
    # Create batch
    batch_id = str(uuid4())
    batch_number = f"BATCH-SAL-{datetime.now().strftime('%Y%m%d%H%M%S')}"
    
    successful_transfers = []
    failed_transfers = []
    total_amount = 0
    
    for payroll in payrolls:
        # Get employee bank details
        bank_details = await db.employee_bank_details.find_one(
            {"employee_id": payroll["employee_id"]},
            {"_id": 0}
        )
        
        if not bank_details:
            failed_transfers.append({
                "employee_id": payroll["employee_id"],
                "employee_name": payroll.get("employee_name"),
                "reason": "Bank details not found"
            })
            continue
        
        try:
            # Initiate transfer via Bank API
            transfer_result = await bank_client.initiate_transfer(
                amount=payroll["net_salary"],
                beneficiary_account=bank_details["account_number"],
                beneficiary_ifsc=bank_details["ifsc_code"],
                beneficiary_name=bank_details["account_holder_name"],
                mode=payment_mode,
                narration=f"Salary {datetime(year, month, 1).strftime('%b %Y')} - {payroll.get('employee_name', '')}"
            )
            
            # Create transaction record
            transaction_id = str(uuid4())
            transaction = {
                "id": transaction_id,
                "batch_id": batch_id,
                "batch_number": batch_number,
                "type": TransactionType.SALARY.value,
                "reference_id": payroll["id"],
                
                # Employee details
                "employee_id": payroll["employee_id"],
                "employee_name": payroll.get("employee_name"),
                
                # Amount
                "gross_amount": payroll.get("gross_earnings", payroll["net_salary"]),
                "deductions": payroll.get("total_deductions", 0),
                "net_amount": payroll["net_salary"],
                
                # Bank details
                "beneficiary_name": bank_details["account_holder_name"],
                "beneficiary_account": bank_details["account_number"][-4:].rjust(len(bank_details["account_number"]), "*"),
                "beneficiary_ifsc": bank_details["ifsc_code"],
                "bank_name": bank_details["bank_name"],
                
                # Transfer details
                "payment_mode": payment_mode,
                "utr_number": transfer_result["utr_number"],
                "bank_transaction_id": transfer_result["transaction_id"],
                
                # Status
                "status": TransactionStatus.PROCESSING.value,
                
                # Timestamps
                "initiated_at": datetime.now(timezone.utc).isoformat(),
                "initiated_by": current_user["id"],
                "completed_at": None,
                "reversed_at": None
            }
            
            await db.payment_transactions.insert_one(transaction)
            
            # Update payroll status
            await db.payroll.update_one(
                {"id": payroll["id"]},
                {"$set": {
                    "status": "payment_processing",
                    "payment_batch_id": batch_id,
                    "payment_transaction_id": transaction_id
                }}
            )
            
            successful_transfers.append({
                "employee_id": payroll["employee_id"],
                "employee_name": payroll.get("employee_name"),
                "amount": payroll["net_salary"],
                "utr": transfer_result["utr_number"],
                "transaction_id": transaction_id
            })
            
            total_amount += payroll["net_salary"]
            
        except Exception as e:
            logger.error(f"Transfer failed for {payroll['employee_id']}: {e}")
            failed_transfers.append({
                "employee_id": payroll["employee_id"],
                "employee_name": payroll.get("employee_name"),
                "reason": str(e)
            })
    
    # Create batch record
    batch_record = {
        "id": batch_id,
        "batch_number": batch_number,
        "type": "salary",
        "month": month,
        "year": year,
        "total_count": len(payrolls),
        "success_count": len(successful_transfers),
        "failed_count": len(failed_transfers),
        "total_amount": total_amount,
        "payment_mode": payment_mode,
        "status": "processing",
        "initiated_by": current_user["id"],
        "initiated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.payment_batches.insert_one(batch_record)
    
    return {
        "message": f"Bulk salary transfer initiated / बल्क सैलरी ट्रांसफर शुरू",
        "batch_id": batch_id,
        "batch_number": batch_number,
        "summary": {
            "total_employees": len(payrolls),
            "successful": len(successful_transfers),
            "failed": len(failed_transfers),
            "total_amount": total_amount
        },
        "successful_transfers": successful_transfers,
        "failed_transfers": failed_transfers
    }


@router.post("/salary/transfer/{transaction_id}/complete")
async def complete_salary_transfer(
    transaction_id: str,
    completion_data: dict,
    current_user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.FINANCE])),
    db=Depends(get_database)
):
    """
    Mark salary transfer as completed and create accounting entry
    सैलरी ट्रांसफर पूर्ण करें
    """
    transaction = await db.payment_transactions.find_one({"id": transaction_id})
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    # Update transaction
    await db.payment_transactions.update_one(
        {"id": transaction_id},
        {"$set": {
            "status": TransactionStatus.COMPLETED.value,
            "completed_at": datetime.now(timezone.utc).isoformat(),
            "bank_reference": completion_data.get("bank_reference"),
            "actual_utr": completion_data.get("utr_number", transaction["utr_number"])
        }}
    )
    
    # Update payroll
    await db.payroll.update_one(
        {"id": transaction["reference_id"]},
        {"$set": {
            "status": "paid",
            "paid_at": datetime.now(timezone.utc).isoformat(),
            "payment_reference": completion_data.get("utr_number", transaction["utr_number"])
        }}
    )
    
    # Create accounting entry (Journal Entry)
    journal_entry = {
        "id": str(uuid4()),
        "entry_number": f"JE-SAL-{datetime.now().strftime('%Y%m%d%H%M%S')}",
        "type": "salary_payment",
        "reference_type": "payment_transaction",
        "reference_id": transaction_id,
        "date": datetime.now(timezone.utc).isoformat(),
        "narration": f"Salary payment to {transaction['employee_name']}",
        
        # Debit & Credit entries
        "entries": [
            {
                "account": "Salary Expense",
                "account_code": "5001",
                "debit": transaction["gross_amount"],
                "credit": 0
            },
            {
                "account": "PF Payable",
                "account_code": "2101",
                "debit": 0,
                "credit": transaction.get("deductions", 0) * 0.4  # Approx PF portion
            },
            {
                "account": "Bank Account",
                "account_code": "1001",
                "debit": 0,
                "credit": transaction["net_amount"]
            }
        ],
        
        "total_debit": transaction["gross_amount"],
        "total_credit": transaction["gross_amount"],
        "is_balanced": True,
        
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": current_user["id"]
    }
    
    await db.journal_entries.insert_one(journal_entry)
    
    # Notify employee
    await db.notifications.insert_one({
        "id": str(uuid4()),
        "user_id": transaction["employee_id"],
        "type": "salary_credited",
        "title": "Salary Credited! 💰",
        "message": f"₹{transaction['net_amount']:,.2f} credited to your account. UTR: {transaction['utr_number']}",
        "reference_id": transaction_id,
        "is_read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {
        "message": "Payment completed and accounting entry created",
        "transaction_id": transaction_id,
        "journal_entry_id": journal_entry["id"]
    }


@router.post("/salary/transfer/{transaction_id}/reverse")
async def reverse_salary_transfer(
    transaction_id: str,
    reversal_data: dict,
    current_user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN])),
    db=Depends(get_database)
):
    """
    Reverse a salary transfer (bank reversal + accounting entry)
    सैलरी ट्रांसफर रिवर्सल
    """
    transaction = await db.payment_transactions.find_one({"id": transaction_id})
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    if transaction["status"] == TransactionStatus.REVERSED.value:
        raise HTTPException(status_code=400, detail="Transaction already reversed")
    
    reason = reversal_data.get("reason", "Manual reversal")
    
    # Call bank API for reversal (if supported)
    reversal_result = await bank_client.reverse_transfer(
        transaction["bank_transaction_id"],
        reason
    )
    
    # Create reversal transaction
    reversal_id = str(uuid4())
    reversal_transaction = {
        "id": reversal_id,
        "type": TransactionType.REVERSAL.value,
        "original_transaction_id": transaction_id,
        "reference_id": transaction["reference_id"],
        
        "employee_id": transaction["employee_id"],
        "employee_name": transaction["employee_name"],
        
        "amount": -transaction["net_amount"],  # Negative amount
        "reason": reason,
        
        "status": TransactionStatus.COMPLETED.value,
        "reversal_utr": reversal_result.get("reversal_id"),
        
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": current_user["id"]
    }
    
    await db.payment_transactions.insert_one(reversal_transaction)
    
    # Update original transaction
    await db.payment_transactions.update_one(
        {"id": transaction_id},
        {"$set": {
            "status": TransactionStatus.REVERSED.value,
            "reversed_at": datetime.now(timezone.utc).isoformat(),
            "reversal_id": reversal_id,
            "reversal_reason": reason
        }}
    )
    
    # Update payroll status
    await db.payroll.update_one(
        {"id": transaction["reference_id"]},
        {"$set": {
            "status": "payment_reversed",
            "reversal_reason": reason
        }}
    )
    
    # Create reversal journal entry
    reversal_entry = {
        "id": str(uuid4()),
        "entry_number": f"JE-REV-{datetime.now().strftime('%Y%m%d%H%M%S')}",
        "type": "salary_reversal",
        "reference_type": "reversal_transaction",
        "reference_id": reversal_id,
        "original_entry_reference": transaction_id,
        "date": datetime.now(timezone.utc).isoformat(),
        "narration": f"Reversal of salary payment to {transaction['employee_name']} - {reason}",
        
        "entries": [
            {
                "account": "Bank Account",
                "account_code": "1001",
                "debit": transaction["net_amount"],
                "credit": 0
            },
            {
                "account": "Salary Expense",
                "account_code": "5001",
                "debit": 0,
                "credit": transaction["gross_amount"]
            },
            {
                "account": "PF Payable",
                "account_code": "2101",
                "debit": transaction.get("deductions", 0) * 0.4,
                "credit": 0
            }
        ],
        
        "is_reversal": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": current_user["id"]
    }
    
    await db.journal_entries.insert_one(reversal_entry)
    
    return {
        "message": "Salary transfer reversed / सैलरी ट्रांसफर रिवर्स हो गया",
        "reversal_id": reversal_id,
        "original_transaction": transaction_id,
        "journal_entry_id": reversal_entry["id"]
    }


# ==================== VENDOR MANAGEMENT ====================

@router.post("/vendor/create")
async def create_vendor(
    vendor_data: dict,
    current_user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.FINANCE])),
    db=Depends(get_database)
):
    """
    Create vendor with TDS configuration
    वेंडर बनाएं
    """
    vendor_id = str(uuid4())
    
    vendor = {
        "id": vendor_id,
        "vendor_code": f"VEN-{datetime.now().strftime('%Y%m%d')}-{vendor_id[:6].upper()}",
        "name": vendor_data["name"],
        "type": vendor_data.get("type", "individual"),  # individual/company
        "pan_number": vendor_data.get("pan_number"),
        "gst_number": vendor_data.get("gst_number"),
        "address": vendor_data.get("address", ""),
        "city": vendor_data.get("city", ""),
        "state": vendor_data.get("state", ""),
        "pincode": vendor_data.get("pincode", ""),
        "contact_person": vendor_data.get("contact_person", ""),
        "phone": vendor_data.get("phone", ""),
        "email": vendor_data.get("email", ""),
        
        # Bank Details
        "bank_name": vendor_data.get("bank_name"),
        "account_number": vendor_data.get("account_number"),
        "ifsc_code": vendor_data.get("ifsc_code"),
        "account_holder_name": vendor_data.get("account_holder_name"),
        
        # TDS Configuration
        "tds_section": vendor_data.get("tds_section", TDSSection.NONE.value),
        "tds_rate": vendor_data.get("tds_rate"),  # Override rate if needed
        "tds_threshold": vendor_data.get("tds_threshold", 30000),  # Threshold for TDS deduction
        
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": current_user["id"]
    }
    
    # Auto-calculate TDS rate if not provided
    if not vendor.get("tds_rate") and vendor["tds_section"] != "none":
        vendor_type = "company" if vendor["type"] == "company" else "individual"
        vendor["tds_rate"] = TDS_RATES.get(vendor["tds_section"], {}).get(vendor_type, 0)
    
    await db.vendors.insert_one(vendor)
    
    return {
        "message": "Vendor created / वेंडर बन गया",
        "vendor_id": vendor_id,
        "vendor_code": vendor["vendor_code"]
    }


@router.get("/vendor/list")
async def get_vendors(
    search: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """Get all vendors"""
    query = {"is_active": True}
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"vendor_code": {"$regex": search, "$options": "i"}}
        ]
    
    vendors = await db.vendors.find(query, {"_id": 0}).to_list(500)
    return {"vendors": vendors}


# ==================== VENDOR BILL & PAYMENT ====================

@router.post("/vendor/bill/create")
async def create_vendor_bill(
    bill_data: dict,
    current_user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.FINANCE])),
    db=Depends(get_database)
):
    """
    Create vendor bill with auto TDS calculation
    वेंडर बिल बनाएं (TDS कटौती सहित)
    """
    vendor = await db.vendors.find_one({"id": bill_data["vendor_id"]}, {"_id": 0})
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    
    bill_id = str(uuid4())
    bill_amount = float(bill_data["amount"])
    
    # Calculate TDS
    tds_amount = 0
    tds_applicable = False
    
    if vendor["tds_section"] != "none" and bill_amount >= vendor.get("tds_threshold", 30000):
        tds_applicable = True
        tds_rate = vendor.get("tds_rate", 0)
        tds_amount = round(bill_amount * (tds_rate / 100), 2)
    
    net_payable = bill_amount - tds_amount
    
    bill = {
        "id": bill_id,
        "bill_number": f"BILL-{datetime.now().strftime('%Y%m%d')}-{bill_id[:6].upper()}",
        "vendor_id": vendor["id"],
        "vendor_name": vendor["name"],
        "vendor_code": vendor["vendor_code"],
        
        # Bill Details
        "invoice_number": bill_data.get("invoice_number", ""),
        "invoice_date": bill_data.get("invoice_date"),
        "due_date": bill_data.get("due_date"),
        "description": bill_data.get("description", ""),
        "category": bill_data.get("category", "general"),
        
        # Line Items
        "items": bill_data.get("items", [
            {"description": bill_data.get("description", "Services"), "amount": bill_amount}
        ]),
        
        # Amounts
        "gross_amount": bill_amount,
        "gst_amount": bill_data.get("gst_amount", 0),
        
        # TDS Details
        "tds_applicable": tds_applicable,
        "tds_section": vendor["tds_section"],
        "tds_rate": vendor.get("tds_rate", 0),
        "tds_amount": tds_amount,
        
        "net_payable": net_payable,
        
        # Status
        "status": "pending",  # pending, approved, paid, cancelled
        "payment_status": "unpaid",
        
        # Approval
        "approved_by": None,
        "approved_at": None,
        
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": current_user["id"]
    }
    
    await db.vendor_bills.insert_one(bill)
    
    return {
        "message": "Vendor bill created / वेंडर बिल बन गया",
        "bill_id": bill_id,
        "bill_number": bill["bill_number"],
        "tds_details": {
            "tds_applicable": tds_applicable,
            "tds_section": vendor["tds_section"],
            "tds_rate": vendor.get("tds_rate", 0),
            "tds_amount": tds_amount
        },
        "net_payable": net_payable
    }


@router.get("/vendor/bills")
async def get_vendor_bills(
    vendor_id: Optional[str] = None,
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """Get vendor bills"""
    query = {}
    if vendor_id:
        query["vendor_id"] = vendor_id
    if status:
        query["status"] = status
    
    bills = await db.vendor_bills.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    
    summary = {
        "total_bills": len(bills),
        "total_amount": sum(b["gross_amount"] for b in bills),
        "total_tds": sum(b["tds_amount"] for b in bills),
        "total_payable": sum(b["net_payable"] for b in bills),
        "unpaid_count": len([b for b in bills if b["payment_status"] == "unpaid"])
    }
    
    return {"bills": bills, "summary": summary}


@router.put("/vendor/bill/{bill_id}/approve")
async def approve_vendor_bill(
    bill_id: str,
    current_user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.FINANCE])),
    db=Depends(get_database)
):
    """Approve vendor bill for payment"""
    await db.vendor_bills.update_one(
        {"id": bill_id},
        {"$set": {
            "status": "approved",
            "approved_by": current_user["id"],
            "approved_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"message": "Bill approved / बिल स्वीकृत"}


@router.post("/vendor/bill/bulk-payment")
async def process_bulk_vendor_payment(
    data: dict,
    current_user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.FINANCE])),
    db=Depends(get_database)
):
    """
    Process bulk vendor payment with TDS
    बल्क वेंडर पेमेंट (TDS कटौती सहित)
    """
    bill_ids = data.get("bill_ids", [])
    payment_mode = data.get("mode", PaymentMode.NEFT.value)
    
    # Get approved bills
    if bill_ids:
        bills = await db.vendor_bills.find({
            "id": {"$in": bill_ids},
            "status": "approved",
            "payment_status": "unpaid"
        }, {"_id": 0}).to_list(100)
    else:
        bills = await db.vendor_bills.find({
            "status": "approved",
            "payment_status": "unpaid"
        }, {"_id": 0}).to_list(100)
    
    if not bills:
        raise HTTPException(status_code=400, detail="No approved unpaid bills found")
    
    batch_id = str(uuid4())
    batch_number = f"BATCH-VEN-{datetime.now().strftime('%Y%m%d%H%M%S')}"
    
    successful_payments = []
    failed_payments = []
    total_paid = 0
    total_tds = 0
    
    for bill in bills:
        vendor = await db.vendors.find_one({"id": bill["vendor_id"]}, {"_id": 0})
        if not vendor or not vendor.get("account_number"):
            failed_payments.append({
                "bill_id": bill["id"],
                "vendor_name": bill["vendor_name"],
                "reason": "Bank details not found"
            })
            continue
        
        try:
            # Initiate transfer
            transfer_result = await bank_client.initiate_transfer(
                amount=bill["net_payable"],
                beneficiary_account=vendor["account_number"],
                beneficiary_ifsc=vendor["ifsc_code"],
                beneficiary_name=vendor.get("account_holder_name", vendor["name"]),
                mode=payment_mode,
                narration=f"Payment for {bill['bill_number']} - {bill.get('description', '')}"
            )
            
            # Create transaction
            transaction_id = str(uuid4())
            transaction = {
                "id": transaction_id,
                "batch_id": batch_id,
                "batch_number": batch_number,
                "type": TransactionType.VENDOR.value,
                "reference_id": bill["id"],
                
                "vendor_id": bill["vendor_id"],
                "vendor_name": bill["vendor_name"],
                "bill_number": bill["bill_number"],
                
                "gross_amount": bill["gross_amount"],
                "tds_section": bill["tds_section"],
                "tds_rate": bill["tds_rate"],
                "tds_amount": bill["tds_amount"],
                "net_amount": bill["net_payable"],
                
                "beneficiary_name": vendor.get("account_holder_name", vendor["name"]),
                "beneficiary_account": vendor["account_number"][-4:].rjust(len(vendor["account_number"]), "*"),
                "beneficiary_ifsc": vendor["ifsc_code"],
                
                "payment_mode": payment_mode,
                "utr_number": transfer_result["utr_number"],
                "bank_transaction_id": transfer_result["transaction_id"],
                
                "status": TransactionStatus.PROCESSING.value,
                "initiated_at": datetime.now(timezone.utc).isoformat(),
                "initiated_by": current_user["id"]
            }
            
            await db.payment_transactions.insert_one(transaction)
            
            # Update bill
            await db.vendor_bills.update_one(
                {"id": bill["id"]},
                {"$set": {
                    "payment_status": "processing",
                    "payment_batch_id": batch_id,
                    "payment_transaction_id": transaction_id
                }}
            )
            
            successful_payments.append({
                "bill_id": bill["id"],
                "bill_number": bill["bill_number"],
                "vendor_name": bill["vendor_name"],
                "gross_amount": bill["gross_amount"],
                "tds_deducted": bill["tds_amount"],
                "net_paid": bill["net_payable"],
                "utr": transfer_result["utr_number"]
            })
            
            total_paid += bill["net_payable"]
            total_tds += bill["tds_amount"]
            
        except Exception as e:
            failed_payments.append({
                "bill_id": bill["id"],
                "vendor_name": bill["vendor_name"],
                "reason": str(e)
            })
    
    # Create batch record
    batch = {
        "id": batch_id,
        "batch_number": batch_number,
        "type": "vendor",
        "total_count": len(bills),
        "success_count": len(successful_payments),
        "failed_count": len(failed_payments),
        "total_gross": sum(b["gross_amount"] for b in bills),
        "total_tds": total_tds,
        "total_paid": total_paid,
        "payment_mode": payment_mode,
        "status": "processing",
        "initiated_by": current_user["id"],
        "initiated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.payment_batches.insert_one(batch)
    
    # Create TDS entry for the quarter
    if total_tds > 0:
        await db.tds_entries.insert_one({
            "id": str(uuid4()),
            "batch_id": batch_id,
            "quarter": f"Q{((datetime.now().month - 1) // 3) + 1}",
            "financial_year": f"{datetime.now().year}-{datetime.now().year + 1}" if datetime.now().month >= 4 else f"{datetime.now().year - 1}-{datetime.now().year}",
            "total_tds": total_tds,
            "vendor_count": len(successful_payments),
            "entries": [{
                "vendor_id": p.get("vendor_id"),
                "vendor_name": p["vendor_name"],
                "tds_amount": p["tds_deducted"]
            } for p in successful_payments if p.get("tds_deducted", 0) > 0],
            "created_at": datetime.now(timezone.utc).isoformat()
        })
    
    return {
        "message": f"Bulk vendor payment initiated / बल्क वेंडर पेमेंट शुरू",
        "batch_id": batch_id,
        "batch_number": batch_number,
        "summary": {
            "total_bills": len(bills),
            "successful": len(successful_payments),
            "failed": len(failed_payments),
            "total_gross": sum(b["gross_amount"] for b in bills),
            "total_tds_deducted": total_tds,
            "total_paid": total_paid
        },
        "successful_payments": successful_payments,
        "failed_payments": failed_payments
    }


@router.post("/vendor/payment/{transaction_id}/complete")
async def complete_vendor_payment(
    transaction_id: str,
    completion_data: dict,
    current_user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.FINANCE])),
    db=Depends(get_database)
):
    """Complete vendor payment and create accounting entry"""
    transaction = await db.payment_transactions.find_one({"id": transaction_id})
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    # Update transaction
    await db.payment_transactions.update_one(
        {"id": transaction_id},
        {"$set": {
            "status": TransactionStatus.COMPLETED.value,
            "completed_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Update bill
    await db.vendor_bills.update_one(
        {"id": transaction["reference_id"]},
        {"$set": {
            "status": "paid",
            "payment_status": "paid",
            "paid_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Create accounting entry
    journal_entry = {
        "id": str(uuid4()),
        "entry_number": f"JE-VEN-{datetime.now().strftime('%Y%m%d%H%M%S')}",
        "type": "vendor_payment",
        "reference_id": transaction_id,
        "date": datetime.now(timezone.utc).isoformat(),
        "narration": f"Payment to {transaction['vendor_name']} - {transaction['bill_number']}",
        
        "entries": [
            {
                "account": "Vendor Payable",
                "account_code": "2001",
                "debit": transaction["gross_amount"],
                "credit": 0
            },
            {
                "account": "TDS Payable",
                "account_code": "2102",
                "debit": 0,
                "credit": transaction["tds_amount"]
            },
            {
                "account": "Bank Account",
                "account_code": "1001",
                "debit": 0,
                "credit": transaction["net_amount"]
            }
        ],
        
        "total_debit": transaction["gross_amount"],
        "total_credit": transaction["gross_amount"],
        "is_balanced": True,
        
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": current_user["id"]
    }
    
    await db.journal_entries.insert_one(journal_entry)
    
    return {
        "message": "Vendor payment completed / वेंडर पेमेंट पूर्ण",
        "journal_entry_id": journal_entry["id"]
    }


# ==================== TDS REPORTS ====================

@router.get("/tds/summary")
async def get_tds_summary(
    quarter: Optional[str] = None,
    financial_year: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """Get TDS summary for filing"""
    query = {}
    if quarter:
        query["quarter"] = quarter
    if financial_year:
        query["financial_year"] = financial_year
    
    tds_entries = await db.tds_entries.find(query, {"_id": 0}).to_list(100)
    
    # Aggregate by section
    section_wise = {}
    for entry in tds_entries:
        for item in entry.get("entries", []):
            section = entry.get("tds_section", "194C")
            if section not in section_wise:
                section_wise[section] = {"count": 0, "amount": 0}
            section_wise[section]["count"] += 1
            section_wise[section]["amount"] += item.get("tds_amount", 0)
    
    return {
        "tds_entries": tds_entries,
        "section_wise_summary": section_wise,
        "total_tds": sum(e["total_tds"] for e in tds_entries)
    }


# ==================== PAYMENT RECONCILIATION ====================

@router.get("/reconciliation/pending")
async def get_pending_reconciliation(
    current_user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.FINANCE])),
    db=Depends(get_database)
):
    """Get transactions pending reconciliation"""
    pending = await db.payment_transactions.find({
        "status": TransactionStatus.PROCESSING.value
    }, {"_id": 0}).to_list(500)
    
    return {
        "pending_transactions": pending,
        "count": len(pending),
        "total_amount": sum(t["net_amount"] for t in pending)
    }


@router.get("/batches")
async def get_payment_batches(
    type: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """Get payment batches"""
    query = {}
    if type:
        query["type"] = type
    
    batches = await db.payment_batches.find(query, {"_id": 0}).sort("initiated_at", -1).to_list(100)
    return {"batches": batches}
