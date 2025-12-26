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



# ==================== MULTI-GATEWAY & APPROVAL WORKFLOW ====================

from services.payment_gateway_service import payment_gateway_manager, PaymentGateway
from services.approval_workflow import ApprovalWorkflow, TDSConfigManager, ApprovalType, ApprovalStatus


@router.get("/gateways/available")
async def get_available_gateways(
    current_user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.FINANCE]))
):
    """Get list of available payment gateways / उपलब्ध पेमेंट गेटवे"""
    gateways = payment_gateway_manager.get_available_gateways()
    return {
        "gateways": gateways,
        "default_gateway": payment_gateway_manager.default_gateway
    }


@router.post("/gateways/config")
async def update_gateway_config(
    config: dict,
    current_user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN])),
    db=Depends(get_database)
):
    """Update gateway configuration / गेटवे कॉन्फ़िगरेशन अपडेट करें"""
    gateway_name = config.get("gateway")
    credentials = config.get("credentials", {})
    
    # Store encrypted credentials
    await db.gateway_config.update_one(
        {"gateway": gateway_name},
        {"$set": {
            "gateway": gateway_name,
            "is_active": config.get("is_active", True),
            "credentials_set": bool(credentials),
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "updated_by": current_user["id"]
        }},
        upsert=True
    )
    
    return {"message": f"{gateway_name} configuration updated / कॉन्फ़िगरेशन अपडेट हो गया"}


# ==================== APPROVAL WORKFLOW ENDPOINTS ====================

@router.post("/approval/create")
async def create_approval_request(
    data: dict,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """Create approval request for payment / पेमेंट के लिए अनुमोदन अनुरोध बनाएं"""
    workflow = ApprovalWorkflow(db)
    
    result = await workflow.create_approval_request(
        request_type=data.get("type", ApprovalType.BULK_TRANSFER.value),
        reference_id=data["reference_id"],
        amount=data["amount"],
        requestor_id=current_user["id"],
        requestor_name=current_user.get("full_name", current_user.get("email")),
        details=data.get("details", {}),
        requires_hr=data.get("requires_hr", True),
        requires_finance=data.get("requires_finance", True),
        requires_admin=data.get("requires_admin", True)
    )
    
    return result


@router.get("/approval/pending")
async def get_pending_approvals(
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """Get pending approvals for current user's role / लंबित अनुमोदन प्राप्त करें"""
    workflow = ApprovalWorkflow(db)
    role = current_user.get("role", "")
    
    approvals = await workflow.get_pending_approvals(role=role, user_id=current_user["id"])
    
    return {
        "pending_approvals": approvals,
        "count": len(approvals),
        "user_role": role
    }


@router.post("/approval/{approval_id}/approve/hr")
async def approve_by_hr(
    approval_id: str,
    data: dict,
    current_user: dict = Depends(require_roles([UserRole.HR, UserRole.ADMIN, UserRole.SUPER_ADMIN])),
    db=Depends(get_database)
):
    """HR approval / HR अनुमोदन"""
    workflow = ApprovalWorkflow(db)
    
    result = await workflow.approve_by_hr(
        approval_id=approval_id,
        approver_id=current_user["id"],
        approver_name=current_user.get("full_name", current_user.get("email")),
        comments=data.get("comments", "")
    )
    
    return result


@router.post("/approval/{approval_id}/approve/finance")
async def approve_by_finance(
    approval_id: str,
    data: dict,
    current_user: dict = Depends(require_roles([UserRole.FINANCE, UserRole.ADMIN, UserRole.SUPER_ADMIN])),
    db=Depends(get_database)
):
    """Finance approval / Finance अनुमोदन"""
    workflow = ApprovalWorkflow(db)
    
    result = await workflow.approve_by_finance(
        approval_id=approval_id,
        approver_id=current_user["id"],
        approver_name=current_user.get("full_name", current_user.get("email")),
        comments=data.get("comments", "")
    )
    
    return result


@router.post("/approval/{approval_id}/approve/admin")
async def approve_by_admin(
    approval_id: str,
    data: dict,
    current_user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN])),
    db=Depends(get_database)
):
    """Admin final approval / Admin अंतिम अनुमोदन"""
    workflow = ApprovalWorkflow(db)
    
    result = await workflow.approve_by_admin(
        approval_id=approval_id,
        approver_id=current_user["id"],
        approver_name=current_user.get("full_name", current_user.get("email")),
        comments=data.get("comments", "")
    )
    
    return result


@router.post("/approval/{approval_id}/admin-override")
async def admin_override_approve(
    approval_id: str,
    data: dict,
    current_user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN])),
    db=Depends(get_database)
):
    """
    Admin override - Approve directly without HR/Finance
    Admin override - HR/Finance के बिना सीधे अनुमोदित करें
    """
    workflow = ApprovalWorkflow(db)
    
    result = await workflow.admin_override_approve(
        approval_id=approval_id,
        admin_id=current_user["id"],
        admin_name=current_user.get("full_name", current_user.get("email")),
        reason=data.get("reason", "Admin override")
    )
    
    return result


@router.post("/approval/{approval_id}/reject")
async def reject_approval(
    approval_id: str,
    data: dict,
    current_user: dict = Depends(require_roles([UserRole.HR, UserRole.FINANCE, UserRole.ADMIN, UserRole.SUPER_ADMIN])),
    db=Depends(get_database)
):
    """Reject approval request / अनुमोदन अनुरोध अस्वीकार करें"""
    workflow = ApprovalWorkflow(db)
    
    result = await workflow.reject(
        approval_id=approval_id,
        rejector_id=current_user["id"],
        rejector_name=current_user.get("full_name", current_user.get("email")),
        rejector_role=current_user.get("role", "unknown"),
        reason=data.get("reason", "No reason provided")
    )
    
    return result


@router.get("/approval/history")
async def get_approval_history(
    type: Optional[str] = None,
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """Get approval history / अनुमोदन इतिहास प्राप्त करें"""
    workflow = ApprovalWorkflow(db)
    
    history = await workflow.get_approval_history(
        approval_type=type,
        status=status
    )
    
    return {"history": history, "count": len(history)}


# ==================== TDS CONFIGURATION ====================

@router.get("/tds/config")
async def get_tds_config(
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """Get TDS configuration / TDS कॉन्फ़िगरेशन प्राप्त करें"""
    tds_manager = TDSConfigManager(db)
    config = await tds_manager.get_tds_config()
    return config


@router.post("/tds/config")
async def update_tds_config(
    data: dict,
    current_user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.FINANCE])),
    db=Depends(get_database)
):
    """Update TDS configuration / TDS कॉन्फ़िगरेशन अपडेट करें"""
    tds_manager = TDSConfigManager(db)
    
    config = await tds_manager.update_tds_config(
        rates=data.get("rates"),
        custom_rates=data.get("custom_rates"),
        updater_id=current_user["id"]
    )
    
    return {"message": "TDS configuration updated / TDS कॉन्फ़िगरेशन अपडेट हो गया", "config": config}


@router.post("/tds/custom-rate")
async def add_custom_tds_rate(
    data: dict,
    current_user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.FINANCE])),
    db=Depends(get_database)
):
    """Add custom TDS rate for vendor / वेंडर के लिए कस्टम TDS रेट जोड़ें"""
    tds_manager = TDSConfigManager(db)
    
    custom_rate = await tds_manager.add_custom_rate(
        vendor_id=data["vendor_id"],
        vendor_name=data["vendor_name"],
        tds_section=data["tds_section"],
        custom_rate=data["rate"],
        reason=data.get("reason", ""),
        updater_id=current_user["id"]
    )
    
    return {"message": "Custom TDS rate added / कस्टम TDS रेट जोड़ा गया", "custom_rate": custom_rate}


@router.post("/tds/calculate")
async def calculate_tds(
    data: dict,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """Calculate TDS for amount / राशि के लिए TDS की गणना करें"""
    tds_manager = TDSConfigManager(db)
    
    result = await tds_manager.calculate_tds(
        vendor_id=data.get("vendor_id", ""),
        vendor_type=data.get("vendor_type", "individual"),
        tds_section=data["tds_section"],
        amount=data["amount"],
        has_pan=data.get("has_pan", True)
    )
    
    return result


@router.get("/tds/sections")
async def get_tds_sections(
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """Get all TDS sections with rates / सभी TDS सेक्शन प्राप्त करें"""
    tds_manager = TDSConfigManager(db)
    sections = await tds_manager.get_tds_sections()
    return {"sections": sections}


# ==================== MULTI-GATEWAY SALARY TRANSFER ====================

@router.post("/salary/multi-gateway/transfer")
async def multi_gateway_salary_transfer(
    data: dict,
    current_user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.FINANCE])),
    db=Depends(get_database)
):
    """
    Process salary transfer using selected gateway
    चयनित गेटवे का उपयोग करके सैलरी ट्रांसफर करें
    """
    gateway_name = data.get("gateway", "razorpayx")
    approval_id = data.get("approval_id")
    month = data.get("month", datetime.now().month)
    year = data.get("year", datetime.now().year)
    mode = data.get("mode", "NEFT")
    
    # Check if approval is required and approved
    if approval_id:
        workflow = ApprovalWorkflow(db)
        is_approved = await workflow.is_approved(approval_id)
        if not is_approved:
            raise HTTPException(status_code=400, detail="Approval pending / अनुमोदन लंबित है")
    
    # Get approved payrolls
    payrolls = await db.payroll.find({
        "month": month,
        "year": year,
        "status": "approved"
    }, {"_id": 0}).to_list(500)
    
    if not payrolls:
        raise HTTPException(status_code=400, detail="No approved payrolls found / कोई अनुमोदित पेरोल नहीं मिला")
    
    # Prepare employee data with bank details
    employees = []
    missing_bank_details = []
    
    for payroll in payrolls:
        bank_details = await db.employee_bank_details.find_one(
            {"employee_id": payroll["employee_id"]},
            {"_id": 0}
        )
        
        if not bank_details:
            missing_bank_details.append({
                "employee_id": payroll["employee_id"],
                "employee_name": payroll.get("employee_name")
            })
            continue
        
        employees.append({
            "employee_id": payroll["employee_id"],
            "name": payroll.get("employee_name", ""),
            "email": payroll.get("email", ""),
            "phone": payroll.get("phone", ""),
            "account_number": bank_details["account_number"],
            "ifsc_code": bank_details["ifsc_code"],
            "account_holder_name": bank_details.get("account_holder_name", payroll.get("employee_name")),
            "bank_name": bank_details.get("bank_name"),
            "amount": payroll["net_salary"]
        })
    
    if not employees:
        raise HTTPException(status_code=400, detail="No employees with bank details found / बैंक विवरण वाले कोई कर्मचारी नहीं मिले")
    
    # Process bulk transfer
    result = await payment_gateway_manager.process_bulk_salary(
        gateway_name=gateway_name,
        employees=employees,
        mode=mode
    )
    
    # Create batch record
    batch_id = str(uuid4())
    batch_number = f"BATCH-{gateway_name.upper()}-{datetime.now().strftime('%Y%m%d%H%M%S')}"
    
    batch_record = {
        "id": batch_id,
        "batch_number": batch_number,
        "type": "salary",
        "gateway": gateway_name,
        "month": month,
        "year": year,
        "total_count": len(employees),
        "success_count": result.get("successful", 0),
        "failed_count": result.get("failed", 0),
        "missing_bank_details": len(missing_bank_details),
        "total_amount": sum(e["amount"] for e in employees),
        "payment_mode": mode,
        "status": "processing",
        "approval_id": approval_id,
        "initiated_by": current_user["id"],
        "initiated_at": datetime.now(timezone.utc).isoformat(),
        "results": result.get("results", [])
    }
    
    await db.payment_batches.insert_one(batch_record)
    
    # Update payroll statuses
    for payout in result.get("results", []):
        if payout.get("success"):
            await db.payroll.update_one(
                {"employee_id": payout.get("employee_id")},
                {"$set": {
                    "status": "payment_processing",
                    "payment_batch_id": batch_id,
                    "payment_gateway": gateway_name,
                    "utr_number": payout.get("utr")
                }}
            )
    
    return {
        "message": f"Bulk salary transfer initiated via {gateway_name} / {gateway_name} के माध्यम से बल्क सैलरी ट्रांसफर शुरू",
        "batch_id": batch_id,
        "batch_number": batch_number,
        "gateway": gateway_name,
        "is_mock": result.get("mock", not payment_gateway_manager.get_gateway(gateway_name).is_configured if hasattr(payment_gateway_manager.get_gateway(gateway_name), 'is_configured') else True),
        "summary": {
            "total_employees": len(employees),
            "successful": result.get("successful", 0),
            "failed": result.get("failed", 0),
            "missing_bank_details": len(missing_bank_details),
            "total_amount": sum(e["amount"] for e in employees)
        },
        "missing_bank_details": missing_bank_details
    }


@router.post("/vendor/multi-gateway/payment")
async def multi_gateway_vendor_payment(
    data: dict,
    current_user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.FINANCE])),
    db=Depends(get_database)
):
    """
    Process vendor payment using selected gateway with TDS
    चयनित गेटवे और TDS के साथ वेंडर पेमेंट करें
    """
    gateway_name = data.get("gateway", "razorpayx")
    bill_ids = data.get("bill_ids", [])
    mode = data.get("mode", "NEFT")
    approval_id = data.get("approval_id")
    
    # Check approval if required
    if approval_id:
        workflow = ApprovalWorkflow(db)
        is_approved = await workflow.is_approved(approval_id)
        if not is_approved:
            raise HTTPException(status_code=400, detail="Approval pending / अनुमोदन लंबित है")
    
    # Get approved unpaid bills
    query = {"status": "approved", "payment_status": "unpaid"}
    if bill_ids:
        query["id"] = {"$in": bill_ids}
    
    bills = await db.vendor_bills.find(query, {"_id": 0}).to_list(100)
    
    if not bills:
        raise HTTPException(status_code=400, detail="No approved unpaid bills found / कोई अनुमोदित अवैतनिक बिल नहीं मिला")
    
    successful_payments = []
    failed_payments = []
    total_gross = 0
    total_tds = 0
    total_net = 0
    
    for bill in bills:
        vendor = await db.vendors.find_one({"id": bill["vendor_id"]}, {"_id": 0})
        if not vendor or not vendor.get("account_number"):
            failed_payments.append({
                "bill_id": bill["id"],
                "vendor_name": bill["vendor_name"],
                "reason": "Bank details not found"
            })
            continue
        
        vendor_data = {
            "vendor_id": vendor["id"],
            "name": vendor["name"],
            "email": vendor.get("email", ""),
            "phone": vendor.get("phone", ""),
            "account_number": vendor["account_number"],
            "ifsc_code": vendor["ifsc_code"],
            "account_holder_name": vendor.get("account_holder_name", vendor["name"])
        }
        
        result = await payment_gateway_manager.process_vendor_payment(
            gateway_name=gateway_name,
            vendor_data=vendor_data,
            gross_amount=bill["gross_amount"],
            tds_amount=bill["tds_amount"],
            mode=mode,
            reference_id=f"VEN_{bill['id'][:8]}"
        )
        
        if result.get("success"):
            # Update bill status
            await db.vendor_bills.update_one(
                {"id": bill["id"]},
                {"$set": {
                    "payment_status": "processing",
                    "payment_gateway": gateway_name,
                    "payment_reference": result.get("payout_id"),
                    "utr_number": result.get("utr")
                }}
            )
            
            successful_payments.append({
                "bill_id": bill["id"],
                "bill_number": bill["bill_number"],
                "vendor_name": bill["vendor_name"],
                "gross_amount": bill["gross_amount"],
                "tds_deducted": bill["tds_amount"],
                "net_paid": bill["net_payable"],
                "utr": result.get("utr"),
                "gateway": gateway_name
            })
            
            total_gross += bill["gross_amount"]
            total_tds += bill["tds_amount"]
            total_net += bill["net_payable"]
        else:
            failed_payments.append({
                "bill_id": bill["id"],
                "vendor_name": bill["vendor_name"],
                "reason": result.get("error", "Unknown error")
            })
    
    # Create batch record
    batch_id = str(uuid4())
    batch_number = f"BATCH-VEN-{gateway_name.upper()}-{datetime.now().strftime('%Y%m%d%H%M%S')}"
    
    await db.payment_batches.insert_one({
        "id": batch_id,
        "batch_number": batch_number,
        "type": "vendor",
        "gateway": gateway_name,
        "total_count": len(bills),
        "success_count": len(successful_payments),
        "failed_count": len(failed_payments),
        "total_gross": total_gross,
        "total_tds": total_tds,
        "total_net": total_net,
        "payment_mode": mode,
        "status": "processing",
        "approval_id": approval_id,
        "initiated_by": current_user["id"],
        "initiated_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {
        "message": f"Vendor payments initiated via {gateway_name} / {gateway_name} के माध्यम से वेंडर पेमेंट शुरू",
        "batch_id": batch_id,
        "batch_number": batch_number,
        "gateway": gateway_name,
        "summary": {
            "total_bills": len(bills),
            "successful": len(successful_payments),
            "failed": len(failed_payments),
            "total_gross": total_gross,
            "total_tds_deducted": total_tds,
            "total_net_paid": total_net
        },
        "successful_payments": successful_payments,
        "failed_payments": failed_payments
    }


# ==================== AUTO SALARY PAYMENT ====================

@router.post("/salary/auto-run")
async def create_auto_salary_run(
    data: dict,
    current_user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.HR])),
    db=Depends(get_database)
):
    """
    Create auto salary run with approval workflow
    अनुमोदन वर्कफ़्लो के साथ ऑटो सैलरी रन बनाएं
    """
    month = data.get("month", datetime.now().month)
    year = data.get("year", datetime.now().year)
    gateway = data.get("gateway", "razorpayx")
    mode = data.get("mode", "NEFT")
    
    # Check for existing run
    existing = await db.salary_runs.find_one({
        "month": month,
        "year": year,
        "status": {"$nin": ["cancelled", "rejected"]}
    })
    
    if existing:
        raise HTTPException(
            status_code=400, 
            detail=f"Salary run already exists for {month}/{year} with status: {existing['status']}"
        )
    
    # Get approved payrolls
    payrolls = await db.payroll.find({
        "month": month,
        "year": year,
        "status": "approved"
    }, {"_id": 0}).to_list(500)
    
    if not payrolls:
        raise HTTPException(status_code=400, detail="No approved payrolls found for this period")
    
    total_amount = sum(p["net_salary"] for p in payrolls)
    
    # Create salary run
    run_id = str(uuid4())
    run_number = f"SALRUN-{year}{str(month).zfill(2)}-{run_id[:6].upper()}"
    
    salary_run = {
        "id": run_id,
        "run_number": run_number,
        "month": month,
        "year": year,
        "employee_count": len(payrolls),
        "total_gross": sum(p.get("gross_earnings", p["net_salary"]) for p in payrolls),
        "total_deductions": sum(p.get("total_deductions", 0) for p in payrolls),
        "total_net": total_amount,
        "gateway": gateway,
        "payment_mode": mode,
        "status": "pending_approval",
        "approval_id": None,
        "created_by": current_user["id"],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.salary_runs.insert_one(salary_run)
    
    # Create approval request
    workflow = ApprovalWorkflow(db)
    approval = await workflow.create_approval_request(
        request_type=ApprovalType.SALARY_RUN,
        reference_id=run_id,
        amount=total_amount,
        requestor_id=current_user["id"],
        requestor_name=current_user.get("full_name", current_user.get("email")),
        details={
            "run_number": run_number,
            "month": month,
            "year": year,
            "employee_count": len(payrolls),
            "gateway": gateway
        },
        requires_hr=True,
        requires_finance=True,
        requires_admin=True
    )
    
    # Update run with approval ID
    await db.salary_runs.update_one(
        {"id": run_id},
        {"$set": {"approval_id": approval["approval_id"]}}
    )
    
    return {
        "message": "Salary run created and sent for approval / सैलरी रन बनाया गया और अनुमोदन के लिए भेजा गया",
        "run_id": run_id,
        "run_number": run_number,
        "approval_id": approval["approval_id"],
        "summary": {
            "employee_count": len(payrolls),
            "total_amount": total_amount,
            "gateway": gateway
        },
        "approval_flow": "HR → Finance → Admin → Auto Transfer"
    }


@router.post("/salary/auto-run/{run_id}/execute")
async def execute_auto_salary_run(
    run_id: str,
    current_user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN])),
    db=Depends(get_database)
):
    """
    Execute approved salary run - Auto transfer to bank accounts
    अनुमोदित सैलरी रन निष्पादित करें - बैंक खातों में ऑटो ट्रांसफर
    """
    # Get salary run
    run = await db.salary_runs.find_one({"id": run_id}, {"_id": 0})
    if not run:
        raise HTTPException(status_code=404, detail="Salary run not found")
    
    # Check approval status
    if run.get("approval_id"):
        workflow = ApprovalWorkflow(db)
        is_approved = await workflow.is_approved(run["approval_id"])
        if not is_approved:
            raise HTTPException(status_code=400, detail="Salary run not approved yet / सैलरी रन अभी तक अनुमोदित नहीं है")
    
    if run["status"] in ["processing", "completed"]:
        raise HTTPException(status_code=400, detail=f"Salary run already {run['status']}")
    
    # Update status to processing
    await db.salary_runs.update_one(
        {"id": run_id},
        {"$set": {
            "status": "processing",
            "execution_started_at": datetime.now(timezone.utc).isoformat(),
            "executed_by": current_user["id"]
        }}
    )
    
    # Process transfer
    transfer_result = await multi_gateway_salary_transfer(
        data={
            "gateway": run["gateway"],
            "month": run["month"],
            "year": run["year"],
            "mode": run["payment_mode"],
            "approval_id": run["approval_id"]
        },
        current_user=current_user,
        db=db
    )
    
    # Update salary run with results
    await db.salary_runs.update_one(
        {"id": run_id},
        {"$set": {
            "status": "completed" if transfer_result["summary"]["failed"] == 0 else "partially_completed",
            "batch_id": transfer_result["batch_id"],
            "execution_completed_at": datetime.now(timezone.utc).isoformat(),
            "execution_summary": transfer_result["summary"]
        }}
    )
    
    return {
        "message": "Salary run executed / सैलरी रन निष्पादित हो गया",
        "run_id": run_id,
        "run_number": run["run_number"],
        **transfer_result
    }


@router.get("/salary/auto-runs")
async def get_salary_runs(
    status: Optional[str] = None,
    year: Optional[int] = None,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """Get all salary runs / सभी सैलरी रन प्राप्त करें"""
    query = {}
    if status:
        query["status"] = status
    if year:
        query["year"] = year
    
    runs = await db.salary_runs.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    
    return {"salary_runs": runs, "count": len(runs)}


@router.get("/salary/auto-run/{run_id}")
async def get_salary_run_details(
    run_id: str,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """Get salary run details with approval status"""
    run = await db.salary_runs.find_one({"id": run_id}, {"_id": 0})
    if not run:
        raise HTTPException(status_code=404, detail="Salary run not found")
    
    # Get approval details
    approval = None
    if run.get("approval_id"):
        approval = await db.approval_requests.find_one({"id": run["approval_id"]}, {"_id": 0})
    
    # Get batch details if executed
    batch = None
    if run.get("batch_id"):
        batch = await db.payment_batches.find_one({"id": run["batch_id"]}, {"_id": 0})
    
    return {
        "salary_run": run,
        "approval": approval,
        "batch": batch
    }


# ==================== EMPLOYEE BANK DETAILS ====================

@router.post("/employee/bank-details")
async def add_employee_bank_details(
    data: dict,
    current_user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.HR])),
    db=Depends(get_database)
):
    """Add/Update employee bank details / कर्मचारी बैंक विवरण जोड़ें"""
    employee_id = data["employee_id"]
    
    bank_details = {
        "employee_id": employee_id,
        "bank_name": data["bank_name"],
        "account_number": data["account_number"],
        "ifsc_code": data["ifsc_code"],
        "account_holder_name": data["account_holder_name"],
        "account_type": data.get("account_type", "savings"),
        "is_verified": False,
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "updated_by": current_user["id"]
    }
    
    await db.employee_bank_details.update_one(
        {"employee_id": employee_id},
        {"$set": bank_details},
        upsert=True
    )
    
    return {"message": "Bank details saved / बैंक विवरण सहेजे गए", "employee_id": employee_id}


@router.get("/employee/{employee_id}/bank-details")
async def get_employee_bank_details(
    employee_id: str,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """Get employee bank details"""
    details = await db.employee_bank_details.find_one(
        {"employee_id": employee_id},
        {"_id": 0}
    )
    
    if not details:
        raise HTTPException(status_code=404, detail="Bank details not found")
    
    # Mask account number for security
    if details.get("account_number"):
        details["account_number_masked"] = details["account_number"][-4:].rjust(len(details["account_number"]), "*")
    
    return details


# ==================== FINANCE DASHBOARD ====================

@router.get("/finance/dashboard")
async def get_finance_dashboard(
    current_user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.FINANCE])),
    db=Depends(get_database)
):
    """Get finance dashboard data / फाइनेंस डैशबोर्ड डेटा प्राप्त करें"""
    
    # Pending approvals
    pending_approvals = await db.approval_requests.count_documents({
        "status": {"$in": ["pending_hr", "pending_finance", "pending_admin"]}
    })
    
    # Today's transactions
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    today_transactions = await db.payment_transactions.find({
        "initiated_at": {"$gte": today_start.isoformat()}
    }, {"_id": 0}).to_list(100)
    
    # Pending vendor bills
    pending_bills = await db.vendor_bills.count_documents({
        "payment_status": "unpaid",
        "status": "approved"
    })
    
    # Recent salary runs
    recent_runs = await db.salary_runs.find(
        {}, {"_id": 0}
    ).sort("created_at", -1).to_list(5)
    
    # Gateway status
    gateways = payment_gateway_manager.get_available_gateways()
    
    # TDS summary this quarter
    current_quarter = f"Q{((datetime.now().month - 1) // 3) + 1}"
    tds_entries = await db.tds_entries.find({
        "quarter": current_quarter
    }, {"_id": 0}).to_list(100)
    
    total_tds_quarter = sum(e.get("total_tds", 0) for e in tds_entries)
    
    return {
        "pending_approvals": pending_approvals,
        "today_transactions": {
            "count": len(today_transactions),
            "total_amount": sum(t.get("net_amount", 0) for t in today_transactions)
        },
        "pending_vendor_bills": pending_bills,
        "recent_salary_runs": recent_runs,
        "gateways": gateways,
        "tds_summary": {
            "quarter": current_quarter,
            "total_tds": total_tds_quarter,
            "entries_count": len(tds_entries)
        }
    }
