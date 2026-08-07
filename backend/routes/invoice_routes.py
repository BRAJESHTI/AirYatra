from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, timezone, timedelta
from uuid import uuid4
from database import get_database
from routes.auth_routes import get_current_user
from models import InvoiceItem, InvoiceCreate, InvoiceUpdate, InvoiceStatus, InvoiceType

router = APIRouter(prefix="/invoices", tags=["Invoice & Billing"])

# Models (RefundCreate kept local as it's invoice-specific)
class RefundCreate(BaseModel):
    invoice_id: str
    amount: float
    reason: str
    refund_mode: str = "original"  # original, bank_transfer, wallet

# Helper Functions
def generate_invoice_number(prefix: str = "INV") -> str:
    """Generate unique invoice number"""
    now = datetime.now()
    return f"{prefix}{now.strftime('%Y%m%d')}{str(uuid4())[:6].upper()}"

def calculate_invoice_totals(items: List[dict]) -> dict:
    """Calculate invoice totals with GST breakdown"""
    subtotal = 0
    total_discount = 0
    cgst = 0
    sgst = 0
    igst = 0
    
    for item in items:
        item_total = item["quantity"] * item["unit_price"]
        discount = item_total * (item.get("discount_percent", 0) / 100)
        taxable = item_total - discount
        gst_amount = taxable * (item.get("gst_percent", 18) / 100)
        
        subtotal += item_total
        total_discount += discount
        # Assuming intra-state (CGST + SGST split)
        cgst += gst_amount / 2
        sgst += gst_amount / 2
    
    return {
        "subtotal": round(subtotal, 2),
        "discount": round(total_discount, 2),
        "taxable_amount": round(subtotal - total_discount, 2),
        "cgst": round(cgst, 2),
        "sgst": round(sgst, 2),
        "igst": round(igst, 2),
        "total_tax": round(cgst + sgst + igst, 2),
        "grand_total": round(subtotal - total_discount + cgst + sgst + igst, 2)
    }

# API Endpoints
@router.post("/")
async def create_invoice(invoice: InvoiceCreate, current_user: dict = Depends(get_current_user)):
    """Create a new invoice"""
    if "admin" not in current_user.get("roles", []) and "operator" not in current_user.get("roles", []):
        raise HTTPException(status_code=403, detail="Permission denied")
    
    db = get_database()
    
    # Get company settings
    settings = await db.settings.find_one({"type": "invoice_settings"}) or {}
    
    items_data = [item.dict() for item in invoice.items]
    totals = calculate_invoice_totals(items_data)
    
    invoice_data = {
        "id": str(uuid4()),
        "invoice_number": generate_invoice_number("INV" if invoice.invoice_type == "tax_invoice" else "PRO" if invoice.invoice_type == "proforma" else "CN"),
        "invoice_type": invoice.invoice_type,
        "booking_id": invoice.booking_id,
        "customer_id": invoice.customer_id,
        "customer_name": invoice.customer_name,
        "customer_email": invoice.customer_email,
        "customer_phone": invoice.customer_phone,
        "customer_gstin": invoice.customer_gstin,
        "customer_address": invoice.customer_address,
        "billing_address": invoice.billing_address or invoice.customer_address,
        # Company details from settings
        "company_name": settings.get("company_name", "AirYatra Aviation Pvt. Ltd."),
        "company_gstin": settings.get("company_gstin", ""),
        "company_address": settings.get("company_address", ""),
        "company_pan": settings.get("company_pan", ""),
        # Items & Totals
        "items": items_data,
        **totals,
        "notes": invoice.notes,
        "status": "draft",  # draft, sent, paid, cancelled, overdue
        "payment_status": "unpaid",  # unpaid, partial, paid
        "amount_paid": 0,
        "amount_due": totals["grand_total"],
        "invoice_date": datetime.now(timezone.utc).isoformat(),
        "due_date": (datetime.now(timezone.utc) + timedelta(days=invoice.due_days)).isoformat(),
        "created_by": current_user["id"],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.invoices.insert_one(invoice_data)
    invoice_data.pop("_id", None)
    
    return {"message": "Invoice created successfully", "invoice": invoice_data}

@router.get("/")
async def get_invoices(
    status: Optional[str] = None,
    invoice_type: Optional[str] = None,
    customer_id: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    current_user: dict = Depends(get_current_user)
):
    """Get all invoices"""
    db = get_database()
    
    query = {}
    if status:
        query["status"] = status
    if invoice_type:
        query["invoice_type"] = invoice_type
    if customer_id:
        query["customer_id"] = customer_id
    if from_date:
        query["invoice_date"] = {"$gte": from_date}
    if to_date:
        query.setdefault("invoice_date", {})["$lte"] = to_date
    
    invoices = await db.invoices.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.invoices.count_documents(query)
    
    return {"invoices": invoices, "total": total}

@router.get("/dashboard")
async def get_invoice_dashboard(current_user: dict = Depends(get_current_user)):
    """Get invoice dashboard stats"""
    db = get_database()
    
    # Current month
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0).isoformat()
    
    # Stats
    total_invoices = await db.invoices.count_documents({"invoice_type": "tax_invoice"})
    pending_amount = 0
    overdue_count = 0
    this_month_revenue = 0
    
    # Calculate pending and overdue
    pipeline = [
        {"$match": {"invoice_type": "tax_invoice", "payment_status": {"$ne": "paid"}}},
        {"$group": {"_id": None, "total_due": {"$sum": "$amount_due"}}}
    ]
    result = await db.invoices.aggregate(pipeline).to_list(1)
    pending_amount = result[0]["total_due"] if result else 0
    
    overdue_count = await db.invoices.count_documents({
        "due_date": {"$lt": now.isoformat()},
        "payment_status": {"$ne": "paid"}
    })
    
    # This month revenue
    pipeline = [
        {"$match": {"invoice_type": "tax_invoice", "payment_status": "paid", "invoice_date": {"$gte": month_start}}},
        {"$group": {"_id": None, "revenue": {"$sum": "$grand_total"}}}
    ]
    result = await db.invoices.aggregate(pipeline).to_list(1)
    this_month_revenue = result[0]["revenue"] if result else 0
    
    # GST Summary
    gst_pipeline = [
        {"$match": {"invoice_type": "tax_invoice", "invoice_date": {"$gte": month_start}}},
        {"$group": {
            "_id": None,
            "total_cgst": {"$sum": "$cgst"},
            "total_sgst": {"$sum": "$sgst"},
            "total_igst": {"$sum": "$igst"},
            "total_taxable": {"$sum": "$taxable_amount"}
        }}
    ]
    gst_result = await db.invoices.aggregate(gst_pipeline).to_list(1)
    gst_summary = gst_result[0] if gst_result else {"total_cgst": 0, "total_sgst": 0, "total_igst": 0, "total_taxable": 0}
    
    return {
        "total_invoices": total_invoices,
        "pending_amount": round(pending_amount, 2),
        "overdue_count": overdue_count,
        "this_month_revenue": round(this_month_revenue, 2),
        "gst_summary": {
            "cgst": round(gst_summary.get("total_cgst", 0), 2),
            "sgst": round(gst_summary.get("total_sgst", 0), 2),
            "igst": round(gst_summary.get("total_igst", 0), 2),
            "total_taxable": round(gst_summary.get("total_taxable", 0), 2)
        }
    }

@router.get("/{invoice_id}")
async def get_invoice(invoice_id: str, current_user: dict = Depends(get_current_user)):
    """Get invoice details"""
    db = get_database()
    invoice = await db.invoices.find_one({"id": invoice_id}, {"_id": 0})
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return invoice

@router.put("/{invoice_id}/status")
async def update_invoice_status(
    invoice_id: str,
    status: str = Query(..., regex="^(draft|sent|paid|cancelled)$"),
    current_user: dict = Depends(get_current_user)
):
    """Update invoice status"""
    db = get_database()
    
    update_data = {"status": status, "updated_at": datetime.now(timezone.utc).isoformat()}
    if status == "paid":
        invoice = await db.invoices.find_one({"id": invoice_id})
        if invoice:
            update_data["payment_status"] = "paid"
            update_data["amount_paid"] = invoice["grand_total"]
            update_data["amount_due"] = 0
            update_data["paid_at"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.invoices.update_one({"id": invoice_id}, {"$set": update_data})
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    return {"message": f"Invoice status updated to {status}"}

@router.post("/{invoice_id}/payment")
async def record_payment(
    invoice_id: str,
    amount: float,
    payment_mode: str = "bank_transfer",
    reference: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Record a payment against invoice"""
    db = get_database()
    
    invoice = await db.invoices.find_one({"id": invoice_id})
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    new_paid = invoice.get("amount_paid", 0) + amount
    new_due = invoice["grand_total"] - new_paid
    
    payment_status = "paid" if new_due <= 0 else "partial"
    
    # Record payment
    payment_record = {
        "id": str(uuid4()),
        "invoice_id": invoice_id,
        "amount": amount,
        "payment_mode": payment_mode,
        "reference": reference,
        "recorded_by": current_user["id"],
        "recorded_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.invoice_payments.insert_one(payment_record)
    
    await db.invoices.update_one(
        {"id": invoice_id},
        {"$set": {
            "amount_paid": new_paid,
            "amount_due": max(0, new_due),
            "payment_status": payment_status,
            "status": "paid" if payment_status == "paid" else invoice["status"],
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"message": "Payment recorded", "new_balance": max(0, new_due)}

@router.post("/refund")
async def create_refund(refund: RefundCreate, current_user: dict = Depends(get_current_user)):
    """Create a refund/credit note"""
    if "admin" not in current_user.get("roles", []):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    db = get_database()
    
    invoice = await db.invoices.find_one({"id": refund.invoice_id})
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    refund_data = {
        "id": str(uuid4()),
        "refund_number": generate_invoice_number("REF"),
        "invoice_id": refund.invoice_id,
        "invoice_number": invoice["invoice_number"],
        "customer_id": invoice["customer_id"],
        "customer_name": invoice["customer_name"],
        "amount": refund.amount,
        "reason": refund.reason,
        "refund_mode": refund.refund_mode,
        "status": "pending",  # pending, processed, rejected
        "created_by": current_user["id"],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.refunds.insert_one(refund_data)
    refund_data.pop("_id", None)
    
    return {"message": "Refund request created", "refund": refund_data}

@router.get("/refunds/list")
async def get_refunds(
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get all refunds"""
    db = get_database()
    
    query = {}
    if status:
        query["status"] = status
    
    refunds = await db.refunds.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    return {"refunds": refunds}

@router.get("/settings/config")
async def get_invoice_settings(current_user: dict = Depends(get_current_user)):
    """Get invoice settings"""
    db = get_database()
    settings = await db.settings.find_one({"type": "invoice_settings"}, {"_id": 0})
    
    if not settings:
        settings = {
            "type": "invoice_settings",
            "company_name": "AirYatra Aviation Pvt. Ltd.",
            "company_gstin": "",
            "company_pan": "",
            "company_address": "",
            "default_gst_percent": 18,
            "default_due_days": 30,
            "invoice_prefix": "INV",
            "invoice_footer": "Thank you for flying with AirYatra!"
        }
    
    return settings

@router.post("/settings/config")
async def update_invoice_settings(settings: dict, current_user: dict = Depends(get_current_user)):
    """Update invoice settings"""
    if "admin" not in current_user.get("roles", []):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    db = get_database()
    settings["type"] = "invoice_settings"
    settings["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.settings.update_one(
        {"type": "invoice_settings"},
        {"$set": settings},
        upsert=True
    )
    
    return {"message": "Invoice settings updated"}

@router.get("/reports/gst")
async def get_gst_report(
    month: int = Query(..., ge=1, le=12),
    year: int = Query(..., ge=2020),
    current_user: dict = Depends(get_current_user)
):
    """Get GST report for filing"""
    if "admin" not in current_user.get("roles", []):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    db = get_database()
    
    start_date = datetime(year, month, 1, tzinfo=timezone.utc).isoformat()
    if month == 12:
        end_date = datetime(year + 1, 1, 1, tzinfo=timezone.utc).isoformat()
    else:
        end_date = datetime(year, month + 1, 1, tzinfo=timezone.utc).isoformat()
    
    invoices = await db.invoices.find({
        "invoice_type": "tax_invoice",
        "invoice_date": {"$gte": start_date, "$lt": end_date}
    }, {"_id": 0}).to_list(1000)
    
    # Aggregate
    total_taxable = sum(i.get("taxable_amount", 0) for i in invoices)
    total_cgst = sum(i.get("cgst", 0) for i in invoices)
    total_sgst = sum(i.get("sgst", 0) for i in invoices)
    total_igst = sum(i.get("igst", 0) for i in invoices)
    
    return {
        "period": f"{month:02d}/{year}",
        "total_invoices": len(invoices),
        "total_taxable_value": round(total_taxable, 2),
        "cgst": round(total_cgst, 2),
        "sgst": round(total_sgst, 2),
        "igst": round(total_igst, 2),
        "total_gst": round(total_cgst + total_sgst + total_igst, 2),
        "invoices": invoices
    }



# ==================== GST INVOICE PDF DOWNLOAD ====================

from fastapi.responses import StreamingResponse
from services.gst_invoice_service import gst_invoice_generator


@router.get("/download/{invoice_id}")
async def download_invoice_pdf(
    invoice_id: str,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """
    Download GST-compliant tax invoice as PDF.
    
    Features:
    - Company GSTIN and details
    - Customer billing info
    - HSN/SAC codes
    - GST breakup (CGST+SGST or IGST)
    - QR code for verification
    - Amount in words
    """
    # Find invoice
    invoice = await db.invoices.find_one({"id": invoice_id}, {"_id": 0})
    
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    # Check authorization
    user_roles = current_user.get("roles", [])
    is_admin = any(r in user_roles for r in ["admin", "super_admin", "operator", "finance"])
    
    if not is_admin and invoice.get("customer_id") != current_user.get("id"):
        raise HTTPException(status_code=403, detail="Not authorized to access this invoice")
    
    # Get customer details
    customer = await db.users.find_one({"id": invoice.get("customer_id")}, {"_id": 0})
    
    # Get booking if linked
    booking = None
    if invoice.get("booking_id"):
        booking = await db.inquiries.find_one({"id": invoice.get("booking_id")}, {"_id": 0})
        if not booking:
            booking = await db.bookings.find_one({"id": invoice.get("booking_id")}, {"_id": 0})
    
    # Prepare invoice data for PDF
    invoice_data = {
        "invoice_number": invoice.get("invoice_number", f"INV-{invoice_id[:8]}"),
        "invoice_date": invoice.get("created_at", datetime.now()).strftime("%d-%m-%Y") if isinstance(invoice.get("created_at"), datetime) else str(invoice.get("created_at", ""))[:10],
        "booking_id": invoice.get("booking_id", invoice_id),
        "customer_name": invoice.get("customer_name") or (customer.get("full_name", customer.get("name", "Customer")) if customer else "Customer"),
        "customer_address": invoice.get("billing_address", {}).get("full_address", "Address not provided") if isinstance(invoice.get("billing_address"), dict) else "Address not provided",
        "customer_gstin": invoice.get("customer_gstin", customer.get("gstin", "") if customer else ""),
        "customer_email": customer.get("email", "") if customer else invoice.get("customer_email", ""),
        "customer_phone": customer.get("phone", "") if customer else invoice.get("customer_phone", ""),
        "from_city": booking.get("from_city", "Mumbai") if booking else "Mumbai",
        "to_city": booking.get("to_city", "Destination") if booking else "Destination",
        "departure_date": booking.get("departure_date", "") if booking else "",
        "aircraft_type": booking.get("aircraft_type", "Helicopter") if booking else "Helicopter",
        "passenger_count": booking.get("passenger_count", 1) if booking else 1,
        "pnr": booking.get("pnr", invoice_id[:8].upper()) if booking else invoice_id[:8].upper(),
        "base_amount": float(invoice.get("taxable_amount", invoice.get("subtotal", 0))),
        "gst_amount": float(invoice.get("cgst", 0)) + float(invoice.get("sgst", 0)) + float(invoice.get("igst", 0)),
        "total_amount": float(invoice.get("total_amount", invoice.get("grand_total", 0))),
        "payment_method": invoice.get("payment_method", "Online"),
        "transaction_id": invoice.get("transaction_id", "N/A"),
        "payment_date": datetime.now().strftime("%d-%m-%Y"),
        "is_interstate": float(invoice.get("igst", 0)) > 0
    }
    
    # Generate PDF
    pdf_buffer = gst_invoice_generator.generate_invoice(invoice_data)
    
    filename = f"AirYatra_Invoice_{invoice_data['invoice_number'].replace('/', '_')}.pdf"
    
    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename={filename}",
            "Cache-Control": "no-cache"
        }
    )


@router.get("/download-by-booking/{booking_id}")
async def download_invoice_by_booking(
    booking_id: str,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """
    Download invoice PDF by booking ID.
    Creates invoice record if not exists.
    """
    # Find or create invoice for booking
    invoice = await db.invoices.find_one({"booking_id": booking_id}, {"_id": 0})
    
    if not invoice:
        # Get booking to create invoice
        booking = await db.inquiries.find_one({"id": booking_id}, {"_id": 0})
        if not booking:
            booking = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
        
        if not booking:
            raise HTTPException(status_code=404, detail="Booking not found")
        
        # Check authorization
        user_roles = current_user.get("roles", [])
        is_admin = any(r in user_roles for r in ["admin", "super_admin", "operator"])
        
        if not is_admin and booking.get("user_id") != current_user.get("id"):
            raise HTTPException(status_code=403, detail="Not authorized")
        
        # Create invoice record
        total_amount = float(booking.get("total_amount", booking.get("amount", 0)))
        gst_rate = 0.05
        taxable = total_amount / (1 + gst_rate)
        gst = total_amount - taxable
        
        invoice = {
            "id": str(uuid4()),
            "invoice_number": generate_invoice_number("TAX"),
            "invoice_type": "tax_invoice",
            "booking_id": booking_id,
            "customer_id": booking.get("user_id"),
            "customer_name": booking.get("customer_name", "Customer"),
            "subtotal": round(taxable, 2),
            "taxable_amount": round(taxable, 2),
            "cgst": round(gst / 2, 2),
            "sgst": round(gst / 2, 2),
            "igst": 0,
            "total_amount": round(total_amount, 2),
            "grand_total": round(total_amount, 2),
            "status": "paid",
            "created_at": datetime.now(timezone.utc)
        }
        
        await db.invoices.insert_one(invoice)
    
    # Now download using invoice ID
    return await download_invoice_pdf(invoice["id"], current_user, db)
