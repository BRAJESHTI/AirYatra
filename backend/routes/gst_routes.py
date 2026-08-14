"""
GST Compliance & Management System
- GSTR-1, GSTR-3B Filing
- GST Payment Tracking
- Input/Output Tax Credit (ITC)
- Vendor GST Compliance & Auto Reminders
"""
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone, timedelta
from uuid import uuid4
from enum import Enum
from database import get_database
from routes.auth_routes import get_current_user
from middleware import require_roles
from models import UserRole
import logging
import os

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/gst", tags=["GST Compliance"])


class GSTReturnType(str, Enum):
    GSTR1 = "GSTR-1"  # Outward supplies
    GSTR3B = "GSTR-3B"  # Monthly summary
    GSTR2A = "GSTR-2A"  # Auto-populated purchases
    GSTR2B = "GSTR-2B"  # ITC statement
    GSTR9 = "GSTR-9"  # Annual return


class GSTFilingStatus(str, Enum):
    PENDING = "pending"
    DRAFT = "draft"
    FILED = "filed"
    ACCEPTED = "accepted"
    REJECTED = "rejected"


class GSTPaymentStatus(str, Enum):
    UNPAID = "unpaid"
    PARTIAL = "partial"
    PAID = "paid"
    REFUND_CLAIMED = "refund_claimed"


# ==================== GST CONFIGURATION ====================

@router.get("/config")
async def get_gst_config(
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """Get GST configuration / GST कॉन्फ़िगरेशन"""
    config = await db.gst_config.find_one({"id": "gst_settings"}, {"_id": 0})
    if not config:
        # Default config
        config = {
            "id": "gst_settings",
            "company_gstin": "",
            "company_name": "AirYatra Aviation Pvt Ltd",
            "state_code": "07",  # Delhi
            "state_name": "Delhi",
            "gst_rates": [0, 5, 12, 18, 28],
            "default_rate": 18,
            "filing_frequency": "monthly",  # monthly/quarterly
            "auto_reminder_enabled": True,
            "reminder_days_before_due": [7, 3, 1],
            "vendor_reminder_template": "Dear {vendor_name},\n\nThis is a reminder that your invoice {invoice_number} dated {invoice_date} for ₹{amount} has not appeared in our GSTR-2A/2B.\n\nPlease file your GSTR-1 at the earliest to avoid ITC issues.\n\nRegards,\nAirYatra Finance Team"
        }
    return config


@router.post("/config")
async def update_gst_config(
    data: dict,
    current_user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.FINANCE])),
    db=Depends(get_database)
):
    """Update GST configuration / GST कॉन्फ़िगरेशन अपडेट करें"""
    data["id"] = "gst_settings"
    data["updated_at"] = datetime.now(timezone.utc).isoformat()
    data["updated_by"] = current_user["id"]
    
    await db.gst_config.update_one(
        {"id": "gst_settings"},
        {"$set": data},
        upsert=True
    )
    
    return {"message": "GST configuration updated"}


# ==================== GST RETURNS FILING ====================

@router.post("/returns/create")
async def create_gst_return(
    data: dict,
    current_user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.FINANCE])),
    db=Depends(get_database)
):
    """Create GST return for filing / GST रिटर्न बनाएं"""
    return_type = data.get("return_type", GSTReturnType.GSTR3B.value)
    month = data.get("month", datetime.now().month)
    year = data.get("year", datetime.now().year)
    
    # Check for existing return
    existing = await db.gst_returns.find_one({
        "return_type": return_type,
        "month": month,
        "year": year,
        "status": {"$nin": ["cancelled"]}
    })
    
    if existing:
        raise HTTPException(status_code=400, detail=f"GST return already exists for {month}/{year}")
    
    return_id = str(uuid4())
    return_number = f"{return_type}-{year}{str(month).zfill(2)}-{return_id[:6].upper()}"
    
    # Calculate GST based on return type
    if return_type == GSTReturnType.GSTR1.value:
        # Outward supplies - from invoices
        gst_data = await _calculate_gstr1_data(db, month, year)
    else:
        # GSTR-3B - summary
        gst_data = await _calculate_gstr3b_data(db, month, year)
    
    gst_return = {
        "id": return_id,
        "return_number": return_number,
        "return_type": return_type,
        "month": month,
        "year": year,
        "period": f"{_get_month_name(month)} {year}",
        
        # GST Data
        "outward_taxable": gst_data.get("outward_taxable", 0),
        "outward_exempt": gst_data.get("outward_exempt", 0),
        "outward_nil_rated": gst_data.get("outward_nil_rated", 0),
        "inward_taxable": gst_data.get("inward_taxable", 0),
        "inward_reverse_charge": gst_data.get("inward_reverse_charge", 0),
        
        # Tax amounts
        "cgst_output": gst_data.get("cgst_output", 0),
        "sgst_output": gst_data.get("sgst_output", 0),
        "igst_output": gst_data.get("igst_output", 0),
        "cess_output": gst_data.get("cess_output", 0),
        
        "cgst_input": gst_data.get("cgst_input", 0),
        "sgst_input": gst_data.get("sgst_input", 0),
        "igst_input": gst_data.get("igst_input", 0),
        "cess_input": gst_data.get("cess_input", 0),
        
        # Net liability
        "cgst_payable": gst_data.get("cgst_output", 0) - gst_data.get("cgst_input", 0),
        "sgst_payable": gst_data.get("sgst_output", 0) - gst_data.get("sgst_input", 0),
        "igst_payable": gst_data.get("igst_output", 0) - gst_data.get("igst_input", 0),
        "cess_payable": gst_data.get("cess_output", 0) - gst_data.get("cess_input", 0),
        "total_tax_payable": gst_data.get("total_payable", 0),
        
        # Invoice counts
        "total_invoices": gst_data.get("total_invoices", 0),
        "b2b_invoices": gst_data.get("b2b_invoices", 0),
        "b2c_invoices": gst_data.get("b2c_invoices", 0),
        
        # Status
        "status": GSTFilingStatus.DRAFT.value,
        "payment_status": GSTPaymentStatus.UNPAID.value,
        
        # Filing details
        "arn": None,  # Acknowledgment Reference Number
        "filed_at": None,
        "due_date": _get_gst_due_date(return_type, month, year),
        
        # Audit
        "created_by": current_user["id"],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.gst_returns.insert_one(gst_return)
    
    return {
        "message": f"{return_type} created for {_get_month_name(month)} {year}",
        "return_id": return_id,
        "return_number": return_number,
        "summary": {
            "total_tax_payable": gst_return["total_tax_payable"],
            "cgst": gst_return["cgst_payable"],
            "sgst": gst_return["sgst_payable"],
            "igst": gst_return["igst_payable"],
            "due_date": gst_return["due_date"]
        }
    }


@router.get("/returns")
async def get_gst_returns(
    return_type: Optional[str] = None,
    year: Optional[int] = None,
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """Get all GST returns"""
    query = {}
    if return_type:
        query["return_type"] = return_type
    if year:
        query["year"] = year
    if status:
        query["status"] = status
    
    returns = await db.gst_returns.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    
    return {"returns": returns, "count": len(returns)}


@router.get("/returns/{return_id}")
async def get_gst_return_details(
    return_id: str,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """Get GST return details with invoices"""
    gst_return = await db.gst_returns.find_one({"id": return_id}, {"_id": 0})
    if not gst_return:
        raise HTTPException(status_code=404, detail="GST return not found")
    
    # Get related invoices
    invoices = await db.invoices.find({
        "month": gst_return["month"],
        "year": gst_return["year"]
    }, {"_id": 0}).to_list(500)
    
    return {
        "return": gst_return,
        "invoices": invoices
    }


@router.post("/returns/{return_id}/file")
async def file_gst_return(
    return_id: str,
    data: dict,
    current_user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.FINANCE])),
    db=Depends(get_database)
):
    """Mark GST return as filed / GST रिटर्न फाइल करें"""
    gst_return = await db.gst_returns.find_one({"id": return_id})
    if not gst_return:
        raise HTTPException(status_code=404, detail="GST return not found")
    
    if gst_return["status"] == GSTFilingStatus.FILED.value:
        raise HTTPException(status_code=400, detail="Return already filed")
    
    arn = data.get("arn", f"AA{gst_return['year']}{str(gst_return['month']).zfill(2)}{uuid4().hex[:10].upper()}")
    
    await db.gst_returns.update_one(
        {"id": return_id},
        {"$set": {
            "status": GSTFilingStatus.FILED.value,
            "arn": arn,
            "filed_at": datetime.now(timezone.utc).isoformat(),
            "filed_by": current_user["id"],
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {
        "message": "GST return filed successfully",
        "arn": arn
    }


# ==================== GST PAYMENTS ====================

@router.post("/payments/record")
async def record_gst_payment(
    data: dict,
    current_user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.FINANCE])),
    db=Depends(get_database)
):
    """Record GST payment / GST भुगतान दर्ज करें"""
    payment_id = str(uuid4())
    challan_number = data.get("challan_number", f"CHL{datetime.now().strftime('%Y%m%d%H%M%S')}")
    
    payment = {
        "id": payment_id,
        "challan_number": challan_number,
        "return_id": data.get("return_id"),
        "return_type": data.get("return_type"),
        "month": data.get("month"),
        "year": data.get("year"),
        "period": f"{_get_month_name(data.get('month', 1))} {data.get('year', 2025)}",
        
        # Payment breakup
        "cgst_paid": data.get("cgst_paid", 0),
        "sgst_paid": data.get("sgst_paid", 0),
        "igst_paid": data.get("igst_paid", 0),
        "cess_paid": data.get("cess_paid", 0),
        "interest_paid": data.get("interest_paid", 0),
        "late_fee_paid": data.get("late_fee_paid", 0),
        "total_paid": data.get("cgst_paid", 0) + data.get("sgst_paid", 0) + data.get("igst_paid", 0) + data.get("cess_paid", 0) + data.get("interest_paid", 0) + data.get("late_fee_paid", 0),
        
        # Payment details
        "payment_mode": data.get("payment_mode", "netbanking"),  # netbanking, neft, rtgs, cash
        "bank_name": data.get("bank_name"),
        "bank_reference": data.get("bank_reference"),
        "payment_date": data.get("payment_date", datetime.now(timezone.utc).isoformat()),
        
        # Status
        "status": "completed",
        
        # Audit
        "created_by": current_user["id"],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.gst_payments.insert_one(payment)
    
    # Update return payment status
    if data.get("return_id"):
        gst_return = await db.gst_returns.find_one({"id": data["return_id"]})
        if gst_return:
            total_paid = payment["total_paid"]
            total_payable = gst_return.get("total_tax_payable", 0)
            
            if total_paid >= total_payable:
                status = GSTPaymentStatus.PAID.value
            elif total_paid > 0:
                status = GSTPaymentStatus.PARTIAL.value
            else:
                status = GSTPaymentStatus.UNPAID.value
            
            await db.gst_returns.update_one(
                {"id": data["return_id"]},
                {"$set": {
                    "payment_status": status,
                    "amount_paid": total_paid,
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }}
            )
    
    return {
        "message": "GST payment recorded",
        "payment_id": payment_id,
        "challan_number": challan_number
    }


@router.get("/payments")
async def get_gst_payments(
    year: Optional[int] = None,
    month: Optional[int] = None,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """Get GST payments history / GST भुगतान इतिहास"""
    query = {}
    if year:
        query["year"] = year
    if month:
        query["month"] = month
    
    payments = await db.gst_payments.find(query, {"_id": 0}).sort("payment_date", -1).to_list(100)
    
    # Calculate totals
    total_cgst = sum(p.get("cgst_paid", 0) for p in payments)
    total_sgst = sum(p.get("sgst_paid", 0) for p in payments)
    total_igst = sum(p.get("igst_paid", 0) for p in payments)
    total_paid = sum(p.get("total_paid", 0) for p in payments)
    
    return {
        "payments": payments,
        "count": len(payments),
        "summary": {
            "total_cgst": total_cgst,
            "total_sgst": total_sgst,
            "total_igst": total_igst,
            "total_paid": total_paid
        }
    }


# ==================== INPUT/OUTPUT TAX CREDIT ====================

@router.get("/itc/summary")
async def get_itc_summary(
    month: Optional[int] = None,
    year: Optional[int] = None,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """Get Input/Output Tax Credit summary"""
    month = month or datetime.now().month
    year = year or datetime.now().year
    
    # Output GST (from sales invoices)
    output_data = await _calculate_output_gst(db, month, year)
    
    # Input GST (from purchase/vendor bills)
    input_data = await _calculate_input_gst(db, month, year)
    
    # Net position
    net_cgst = output_data["cgst"] - input_data["cgst"]
    net_sgst = output_data["sgst"] - input_data["sgst"]
    net_igst = output_data["igst"] - input_data["igst"]
    net_total = net_cgst + net_sgst + net_igst
    
    return {
        "period": f"{_get_month_name(month)} {year}",
        "month": month,
        "year": year,
        
        "output_tax": {
            "taxable_value": output_data["taxable_value"],
            "cgst": output_data["cgst"],
            "sgst": output_data["sgst"],
            "igst": output_data["igst"],
            "total": output_data["total"],
            "invoice_count": output_data["count"]
        },
        
        "input_tax": {
            "taxable_value": input_data["taxable_value"],
            "cgst": input_data["cgst"],
            "sgst": input_data["sgst"],
            "igst": input_data["igst"],
            "total": input_data["total"],
            "bill_count": input_data["count"],
            "eligible_itc": input_data["eligible"],
            "ineligible_itc": input_data["ineligible"]
        },
        
        "net_liability": {
            "cgst": max(net_cgst, 0),
            "sgst": max(net_sgst, 0),
            "igst": max(net_igst, 0),
            "total_payable": max(net_total, 0),
            "itc_carryforward": abs(min(net_total, 0)) if net_total < 0 else 0
        },
        
        "itc_utilization": {
            "cgst_utilized": min(output_data["cgst"], input_data["cgst"]),
            "sgst_utilized": min(output_data["sgst"], input_data["sgst"]),
            "igst_utilized": min(output_data["igst"], input_data["igst"]),
            "cross_utilization": _calculate_cross_utilization(output_data, input_data)
        }
    }


@router.get("/itc/details")
async def get_itc_details(
    month: int,
    year: int,
    type: str = "all",  # input, output, all
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """Get detailed ITC entries"""
    result = {"input": [], "output": []}
    
    if type in ["input", "all"]:
        # Get vendor bills with GST
        bills = await db.vendor_bills.find({
            "month": month,
            "year": year,
            "gst_applicable": True
        }, {"_id": 0}).to_list(500)
        
        for bill in bills:
            result["input"].append({
                "id": bill.get("id"),
                "bill_number": bill.get("bill_number"),
                "vendor_name": bill.get("vendor_name"),
                "vendor_gstin": bill.get("vendor_gstin"),
                "invoice_date": bill.get("invoice_date"),
                "taxable_value": bill.get("taxable_value", 0),
                "cgst": bill.get("cgst_amount", 0),
                "sgst": bill.get("sgst_amount", 0),
                "igst": bill.get("igst_amount", 0),
                "total_gst": bill.get("gst_amount", 0),
                "itc_eligible": bill.get("itc_eligible", True),
                "gstr2a_matched": bill.get("gstr2a_matched", False)
            })
    
    if type in ["output", "all"]:
        # Get sales invoices with GST
        invoices = await db.invoices.find({
            "month": month,
            "year": year
        }, {"_id": 0}).to_list(500)
        
        for inv in invoices:
            result["output"].append({
                "id": inv.get("id"),
                "invoice_number": inv.get("invoice_number"),
                "customer_name": inv.get("customer_name"),
                "customer_gstin": inv.get("customer_gstin"),
                "invoice_date": inv.get("invoice_date"),
                "taxable_value": inv.get("taxable_value", 0),
                "cgst": inv.get("cgst_amount", 0),
                "sgst": inv.get("sgst_amount", 0),
                "igst": inv.get("igst_amount", 0),
                "total_gst": inv.get("gst_amount", 0),
                "gstr1_reported": inv.get("gstr1_reported", False)
            })
    
    return result


# ==================== VENDOR GST COMPLIANCE ====================

@router.get("/vendors/compliance")
async def get_vendor_gst_compliance(
    month: Optional[int] = None,
    year: Optional[int] = None,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """Get vendor GST compliance status"""
    month = month or datetime.now().month
    year = year or datetime.now().year
    
    # Get all vendor bills for the period
    bills = await db.vendor_bills.find({
        "month": month,
        "year": year
    }, {"_id": 0}).to_list(500)
    
    # Group by vendor
    vendor_data = {}
    for bill in bills:
        vendor_id = bill.get("vendor_id")
        if vendor_id not in vendor_data:
            vendor_data[vendor_id] = {
                "vendor_id": vendor_id,
                "vendor_name": bill.get("vendor_name"),
                "vendor_gstin": bill.get("vendor_gstin"),
                "total_bills": 0,
                "total_amount": 0,
                "total_gst": 0,
                "matched_in_gstr2a": 0,
                "not_matched": 0,
                "compliance_score": 0,
                "bills": []
            }
        
        vendor_data[vendor_id]["total_bills"] += 1
        vendor_data[vendor_id]["total_amount"] += bill.get("gross_amount", 0)
        vendor_data[vendor_id]["total_gst"] += bill.get("gst_amount", 0)
        
        if bill.get("gstr2a_matched"):
            vendor_data[vendor_id]["matched_in_gstr2a"] += 1
        else:
            vendor_data[vendor_id]["not_matched"] += 1
        
        vendor_data[vendor_id]["bills"].append({
            "bill_number": bill.get("bill_number"),
            "invoice_date": bill.get("invoice_date"),
            "amount": bill.get("gross_amount"),
            "gst": bill.get("gst_amount"),
            "gstr2a_matched": bill.get("gstr2a_matched", False)
        })
    
    # Calculate compliance score
    vendors = []
    compliant_count = 0
    non_compliant_count = 0
    at_risk_gst = 0
    
    for vendor_id, data in vendor_data.items():
        if data["total_bills"] > 0:
            data["compliance_score"] = round((data["matched_in_gstr2a"] / data["total_bills"]) * 100)
        
        if data["compliance_score"] >= 90:
            data["status"] = "compliant"
            compliant_count += 1
        elif data["compliance_score"] >= 50:
            data["status"] = "partial"
            at_risk_gst += data["total_gst"] * (1 - data["compliance_score"]/100)
        else:
            data["status"] = "non_compliant"
            non_compliant_count += 1
            at_risk_gst += data["total_gst"] * (1 - data["compliance_score"]/100)
        
        vendors.append(data)
    
    # Sort by compliance score (lowest first)
    vendors.sort(key=lambda x: x["compliance_score"])
    
    return {
        "period": f"{_get_month_name(month)} {year}",
        "summary": {
            "total_vendors": len(vendors),
            "compliant": compliant_count,
            "non_compliant": non_compliant_count,
            "at_risk_itc": round(at_risk_gst, 2)
        },
        "vendors": vendors
    }


@router.post("/vendors/{vendor_id}/send-reminder")
async def send_vendor_gst_reminder(
    vendor_id: str,
    data: dict,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.FINANCE])),
    db=Depends(get_database)
):
    """Send GST reminder to vendor"""
    vendor = await db.vendors.find_one({"id": vendor_id}, {"_id": 0})
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    
    if not vendor.get("email"):
        raise HTTPException(status_code=400, detail="Vendor email not found")
    
    # Get pending bills
    bills = data.get("bill_ids", [])
    if not bills:
        # Get all non-matched bills
        non_matched = await db.vendor_bills.find({
            "vendor_id": vendor_id,
            "gstr2a_matched": {"$ne": True}
        }, {"_id": 0, "bill_number": 1, "invoice_date": 1, "gross_amount": 1}).to_list(50)
        bills = non_matched
    
    # Create reminder record
    reminder_id = str(uuid4())
    reminder = {
        "id": reminder_id,
        "vendor_id": vendor_id,
        "vendor_name": vendor.get("name"),
        "vendor_email": vendor.get("email"),
        "bills": bills,
        "message": data.get("message", ""),
        "status": "sent",
        "sent_at": datetime.now(timezone.utc).isoformat(),
        "sent_by": current_user["id"]
    }
    
    await db.gst_reminders.insert_one(reminder)
    
    # Send email in background
    background_tasks.add_task(
        _send_gst_reminder_email,
        vendor.get("email"),
        vendor.get("name"),
        bills,
        data.get("message")
    )
    
    return {
        "message": f"Reminder sent to {vendor.get('name')}",
        "reminder_id": reminder_id,
        "email": vendor.get("email")
    }


@router.post("/vendors/send-bulk-reminders")
async def send_bulk_gst_reminders(
    data: dict,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.FINANCE])),
    db=Depends(get_database)
):
    """Send reminders to all non-compliant vendors"""
    month = data.get("month", datetime.now().month)
    year = data.get("year", datetime.now().year)
    min_compliance = data.get("min_compliance", 90)  # Send to vendors below this score
    
    # Get non-compliant vendors
    compliance = await get_vendor_gst_compliance(month, year, current_user, db)
    
    sent_count = 0
    failed_count = 0
    reminders = []
    
    for vendor in compliance["vendors"]:
        if vendor["compliance_score"] < min_compliance and vendor.get("not_matched", 0) > 0:
            # Get vendor email
            vendor_doc = await db.vendors.find_one({"id": vendor["vendor_id"]}, {"_id": 0})
            if vendor_doc and vendor_doc.get("email"):
                reminder_id = str(uuid4())
                reminder = {
                    "id": reminder_id,
                    "vendor_id": vendor["vendor_id"],
                    "vendor_name": vendor["vendor_name"],
                    "vendor_email": vendor_doc.get("email"),
                    "bills": vendor["bills"],
                    "compliance_score": vendor["compliance_score"],
                    "status": "sent",
                    "sent_at": datetime.now(timezone.utc).isoformat(),
                    "sent_by": current_user["id"],
                    "is_bulk": True
                }
                
                await db.gst_reminders.insert_one(reminder)
                
                # Queue email
                background_tasks.add_task(
                    _send_gst_reminder_email,
                    vendor_doc.get("email"),
                    vendor["vendor_name"],
                    [b for b in vendor["bills"] if not b.get("gstr2a_matched")],
                    None
                )
                
                sent_count += 1
                reminders.append({
                    "vendor_name": vendor["vendor_name"],
                    "email": vendor_doc.get("email"),
                    "pending_bills": vendor["not_matched"]
                })
            else:
                failed_count += 1
    
    return {
        "message": f"Sent {sent_count} reminders",
        "sent": sent_count,
        "failed": failed_count,
        "reminders": reminders
    }


@router.get("/vendors/reminders")
async def get_gst_reminders(
    vendor_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """Get GST reminder history / GST रिमाइंडर इतिहास"""
    query = {}
    if vendor_id:
        query["vendor_id"] = vendor_id
    
    reminders = await db.gst_reminders.find(query, {"_id": 0}).sort("sent_at", -1).to_list(100)
    
    return {"reminders": reminders, "count": len(reminders)}


@router.post("/vendors/reconcile-gstr2a")
async def reconcile_gstr2a(
    data: dict,
    current_user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.FINANCE])),
    db=Depends(get_database)
):
    """
    Reconcile vendor bills with GSTR-2A data
    वेंडर बिल को GSTR-2A से मिलाएं
    
    In production, this would integrate with GST portal API
    """
    month = data.get("month", datetime.now().month)
    year = data.get("year", datetime.now().year)
    
    # Get GSTR-2A data (in production, fetch from GST portal)
    # For now, simulate with uploaded data or manual entries
    gstr2a_data = data.get("gstr2a_entries", [])
    
    matched = 0
    unmatched = 0
    
    # Get all vendor bills for the period
    bills = await db.vendor_bills.find({
        "month": month,
        "year": year
    }).to_list(500)
    
    for bill in bills:
        # Check if bill exists in GSTR-2A
        bill_matched = False
        for entry in gstr2a_data:
            if (entry.get("invoice_number") == bill.get("vendor_invoice_number") and
                entry.get("gstin") == bill.get("vendor_gstin")):
                bill_matched = True
                break
        
        await db.vendor_bills.update_one(
            {"id": bill["id"]},
            {"$set": {
                "gstr2a_matched": bill_matched,
                "gstr2a_reconciled_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        if bill_matched:
            matched += 1
        else:
            unmatched += 1
    
    return {
        "message": "Reconciliation complete",
        "matched": matched,
        "unmatched": unmatched,
        "total": matched + unmatched
    }


# ==================== GST DASHBOARD ====================

@router.get("/dashboard")
async def get_gst_dashboard(
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """Get GST dashboard overview / GST डैशबोर्ड"""
    current_month = datetime.now().month
    current_year = datetime.now().year
    
    # Get current period ITC summary
    itc_summary = await get_itc_summary(current_month, current_year, current_user, db)
    
    # Pending returns
    pending_returns = await db.gst_returns.count_documents({
        "status": {"$in": [GSTFilingStatus.PENDING.value, GSTFilingStatus.DRAFT.value]}
    })
    
    # Unpaid GST
    unpaid_returns = await db.gst_returns.find({
        "payment_status": GSTPaymentStatus.UNPAID.value,
        "total_tax_payable": {"$gt": 0}
    }, {"_id": 0, "return_type": 1, "period": 1, "total_tax_payable": 1}).to_list(10)
    
    total_unpaid = sum(r.get("total_tax_payable", 0) for r in unpaid_returns)
    
    # Vendor compliance
    compliance = await get_vendor_gst_compliance(current_month, current_year, current_user, db)
    
    # Recent payments
    recent_payments = await db.gst_payments.find(
        {}, {"_id": 0}
    ).sort("payment_date", -1).to_list(5)
    
    # Upcoming due dates
    upcoming_due = await db.gst_returns.find({
        "status": {"$ne": GSTFilingStatus.FILED.value},
        "due_date": {"$gte": datetime.now(timezone.utc).isoformat()}
    }, {"_id": 0, "return_type": 1, "period": 1, "due_date": 1}).sort("due_date", 1).to_list(5)
    
    return {
        "current_period": f"{_get_month_name(current_month)} {current_year}",
        
        "itc_summary": {
            "output_gst": itc_summary["output_tax"]["total"],
            "input_gst": itc_summary["input_tax"]["total"],
            "net_payable": itc_summary["net_liability"]["total_payable"],
            "itc_available": itc_summary["input_tax"]["eligible_itc"]
        },
        
        "filing_status": {
            "pending_returns": pending_returns,
            "upcoming_due_dates": upcoming_due
        },
        
        "payment_status": {
            "total_unpaid": total_unpaid,
            "unpaid_returns": unpaid_returns,
            "recent_payments": recent_payments
        },
        
        "vendor_compliance": {
            "total_vendors": compliance["summary"]["total_vendors"],
            "non_compliant": compliance["summary"]["non_compliant"],
            "at_risk_itc": compliance["summary"]["at_risk_itc"]
        }
    }


# ==================== HELPER FUNCTIONS ====================

async def _calculate_gstr1_data(db, month: int, year: int) -> Dict[str, Any]:
    """Calculate GSTR-1 data from invoices"""
    invoices = await db.invoices.find({
        "month": month,
        "year": year
    }, {"_id": 0}).to_list(1000)
    
    b2b_invoices = [i for i in invoices if i.get("customer_gstin")]
    b2c_invoices = [i for i in invoices if not i.get("customer_gstin")]
    
    total_taxable = sum(i.get("taxable_value", 0) for i in invoices)
    cgst = sum(i.get("cgst_amount", 0) for i in invoices)
    sgst = sum(i.get("sgst_amount", 0) for i in invoices)
    igst = sum(i.get("igst_amount", 0) for i in invoices)
    
    return {
        "outward_taxable": total_taxable,
        "cgst_output": cgst,
        "sgst_output": sgst,
        "igst_output": igst,
        "total_invoices": len(invoices),
        "b2b_invoices": len(b2b_invoices),
        "b2c_invoices": len(b2c_invoices),
        "total_payable": cgst + sgst + igst
    }


async def _calculate_gstr3b_data(db, month: int, year: int) -> Dict[str, Any]:
    """Calculate GSTR-3B summary data"""
    # Output from invoices
    output = await _calculate_gstr1_data(db, month, year)
    
    # Input from vendor bills
    bills = await db.vendor_bills.find({
        "month": month,
        "year": year,
        "gst_applicable": True,
        "itc_eligible": True
    }, {"_id": 0}).to_list(1000)
    
    cgst_input = sum(b.get("cgst_amount", 0) for b in bills)
    sgst_input = sum(b.get("sgst_amount", 0) for b in bills)
    igst_input = sum(b.get("igst_amount", 0) for b in bills)
    
    return {
        **output,
        "inward_taxable": sum(b.get("taxable_value", 0) for b in bills),
        "cgst_input": cgst_input,
        "sgst_input": sgst_input,
        "igst_input": igst_input,
        "total_payable": max(0, output["cgst_output"] - cgst_input + output["sgst_output"] - sgst_input + output["igst_output"] - igst_input)
    }


async def _calculate_output_gst(db, month: int, year: int) -> Dict[str, Any]:
    """Calculate output GST from sales"""
    invoices = await db.invoices.find({
        "month": month,
        "year": year
    }, {"_id": 0}).to_list(1000)
    
    return {
        "taxable_value": sum(i.get("taxable_value", 0) for i in invoices),
        "cgst": sum(i.get("cgst_amount", 0) for i in invoices),
        "sgst": sum(i.get("sgst_amount", 0) for i in invoices),
        "igst": sum(i.get("igst_amount", 0) for i in invoices),
        "total": sum(i.get("gst_amount", 0) for i in invoices),
        "count": len(invoices)
    }


async def _calculate_input_gst(db, month: int, year: int) -> Dict[str, Any]:
    """Calculate input GST from purchases"""
    bills = await db.vendor_bills.find({
        "month": month,
        "year": year,
        "gst_applicable": True
    }, {"_id": 0}).to_list(1000)
    
    eligible_bills = [b for b in bills if b.get("itc_eligible", True)]
    ineligible_bills = [b for b in bills if not b.get("itc_eligible", True)]
    
    return {
        "taxable_value": sum(b.get("taxable_value", 0) for b in bills),
        "cgst": sum(b.get("cgst_amount", 0) for b in eligible_bills),
        "sgst": sum(b.get("sgst_amount", 0) for b in eligible_bills),
        "igst": sum(b.get("igst_amount", 0) for b in eligible_bills),
        "total": sum(b.get("gst_amount", 0) for b in eligible_bills),
        "count": len(bills),
        "eligible": sum(b.get("gst_amount", 0) for b in eligible_bills),
        "ineligible": sum(b.get("gst_amount", 0) for b in ineligible_bills)
    }


def _calculate_cross_utilization(output: Dict, input_data: Dict) -> Dict[str, Any]:
    """Calculate ITC cross-utilization as per GST rules"""
    # IGST can be used for CGST/SGST after IGST liability
    # CGST can be used for IGST (not SGST)
    # SGST can be used for IGST (not CGST)
    
    igst_excess = max(0, input_data["igst"] - output["igst"])
    cgst_from_igst = min(igst_excess / 2, max(0, output["cgst"] - input_data["cgst"]))
    sgst_from_igst = min(igst_excess / 2, max(0, output["sgst"] - input_data["sgst"]))
    
    return {
        "igst_to_cgst": cgst_from_igst,
        "igst_to_sgst": sgst_from_igst,
        "cgst_to_igst": 0,
        "sgst_to_igst": 0
    }


def _get_gst_due_date(return_type: str, month: int, year: int) -> str:
    """Get GST return due date"""
    if return_type == GSTReturnType.GSTR1.value:
        # GSTR-1: 11th of next month
        if month == 12:
            due = datetime(year + 1, 1, 11)
        else:
            due = datetime(year, month + 1, 11)
    elif return_type == GSTReturnType.GSTR3B.value:
        # GSTR-3B: 20th of next month
        if month == 12:
            due = datetime(year + 1, 1, 20)
        else:
            due = datetime(year, month + 1, 20)
    else:
        due = datetime(year, month + 1, 20)
    
    return due.strftime("%Y-%m-%d")


def _get_month_name(month: int) -> str:
    """Get month name"""
    months = ["", "January", "February", "March", "April", "May", "June",
              "July", "August", "September", "October", "November", "December"]
    return months[month] if 1 <= month <= 12 else ""


async def _send_gst_reminder_email(email: str, vendor_name: str, bills: List[Dict], custom_message: str = None):
    """Send GST reminder email to vendor"""
    try:
        # Get email service
        from services.email_service import send_email
        
        bill_list = "\n".join([
            f"- {b.get('bill_number', 'N/A')} dated {b.get('invoice_date', 'N/A')} for ₹{b.get('amount', 0):,.2f}"
            for b in bills[:10]  # Limit to 10 bills
        ])
        
        if custom_message:
            body = custom_message
        else:
            body = f"""Dear {vendor_name},

This is a reminder regarding your GST compliance.

The following invoices have not appeared in our GSTR-2A/2B:

{bill_list}

Please ensure your GSTR-1 is filed correctly to avoid any ITC issues on our end.

If you believe this is an error, please contact our finance team.

Regards,
AirYatra Finance Team

---
This is a reminder regarding your GST compliance.
Please file your GSTR-1 correctly.
"""
        
        await send_email(
            to_email=email,
            subject="GST Compliance Reminder - Pending GSTR-1 Filing",
            body=body
        )
        
        logger.info(f"GST reminder sent to {email}")
    except Exception as e:
        logger.error(f"Failed to send GST reminder to {email}: {e}")
