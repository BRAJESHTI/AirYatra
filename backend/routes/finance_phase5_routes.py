"""
AirYatra Finance ERP - Phase 5 Advanced Features
Audit Trail, PDF Export, Expense Analytics, Multi-Currency Support
"""
from fastapi import APIRouter, HTTPException, Response
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone, timedelta
from database import get_database
import uuid
import io
import httpx
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch, cm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image
from reportlab.lib.enums import TA_CENTER, TA_RIGHT, TA_LEFT

router = APIRouter(prefix="/finance/phase5", tags=["finance-erp-phase5"])

# Helper
def serialize_doc(doc):
    if doc:
        doc["_id"] = str(doc["_id"])
    return doc

# ============== MODELS ==============
class AuditLogCreate(BaseModel):
    action: str
    module: str
    entity_type: str
    entity_id: str
    description: str
    old_value: Optional[dict] = None
    new_value: Optional[dict] = None
    user_id: Optional[str] = None
    user_email: Optional[str] = None
    ip_address: Optional[str] = None

class InvoiceRequest(BaseModel):
    booking_id: Optional[str] = None
    invoice_number: Optional[str] = None
    customer_name: str
    customer_address: str
    customer_gst: Optional[str] = None
    items: List[dict]
    subtotal: float
    gst_rate: float = 18.0
    gst_amount: float
    total: float
    notes: Optional[str] = None

class CurrencyConversion(BaseModel):
    from_currency: str = "USD"
    to_currency: str = "INR"
    amount: float

# ============== AUDIT TRAIL ==============
@router.post("/audit/log")
async def create_audit_log(log: AuditLogCreate):
    """Create an audit log entry"""
    db = get_database()
    
    log_doc = {
        "id": str(uuid.uuid4()),
        "action": log.action,
        "module": log.module,
        "entity_type": log.entity_type,
        "entity_id": log.entity_id,
        "description": log.description,
        "old_value": log.old_value,
        "new_value": log.new_value,
        "user_id": log.user_id,
        "user_email": log.user_email,
        "ip_address": log.ip_address,
        "created_at": datetime.now(timezone.utc)
    }
    
    await db.finance_audit_logs.insert_one(log_doc)
    return {"success": True, "log_id": log_doc["id"]}

@router.get("/audit/logs")
async def get_audit_logs(
    module: Optional[str] = None,
    action: Optional[str] = None,
    entity_type: Optional[str] = None,
    user_email: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = 100,
    skip: int = 0
):
    """Get audit logs with filters"""
    db = get_database()
    
    query = {}
    
    if module:
        query["module"] = module
    if action:
        query["action"] = action
    if entity_type:
        query["entity_type"] = entity_type
    if user_email:
        query["user_email"] = {"$regex": user_email, "$options": "i"}
    if search:
        query["$or"] = [
            {"description": {"$regex": search, "$options": "i"}},
            {"entity_id": {"$regex": search, "$options": "i"}}
        ]
    if from_date:
        query["created_at"] = {"$gte": from_date}
    if to_date:
        if "created_at" in query:
            query["created_at"]["$lte"] = to_date
        else:
            query["created_at"] = {"$lte": to_date}
    
    total = await db.finance_audit_logs.count_documents(query)
    logs = await db.finance_audit_logs.find(query).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    # Get unique values for filters
    all_logs = await db.finance_audit_logs.find({}).to_list(5000)
    modules = list(set(l.get("module", "") for l in all_logs if l.get("module")))
    actions = list(set(l.get("action", "") for l in all_logs if l.get("action")))
    entity_types = list(set(l.get("entity_type", "") for l in all_logs if l.get("entity_type")))
    
    return {
        "logs": [serialize_doc(l) for l in logs],
        "total": total,
        "page": skip // limit + 1,
        "filters": {
            "modules": sorted(modules),
            "actions": sorted(actions),
            "entity_types": sorted(entity_types)
        }
    }

@router.get("/audit/stats")
async def get_audit_stats():
    """Get audit log statistics"""
    db = get_database()
    
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = now - timedelta(days=7)
    month_start = now - timedelta(days=30)
    
    # Get all logs
    all_logs = await db.finance_audit_logs.find({}).to_list(10000)
    
    # Today's activity
    today_logs = [l for l in all_logs if l.get("created_at", datetime.min) >= today_start.isoformat() if isinstance(l.get("created_at"), str)]
    
    # By module
    by_module = {}
    for log in all_logs:
        module = log.get("module", "unknown")
        by_module[module] = by_module.get(module, 0) + 1
    
    # By action
    by_action = {}
    for log in all_logs:
        action = log.get("action", "unknown")
        by_action[action] = by_action.get(action, 0) + 1
    
    # Recent users
    recent_users = {}
    for log in all_logs[-100:]:
        email = log.get("user_email", "system")
        recent_users[email] = recent_users.get(email, 0) + 1
    
    return {
        "total_logs": len(all_logs),
        "today_count": len(today_logs),
        "by_module": by_module,
        "by_action": by_action,
        "recent_users": dict(sorted(recent_users.items(), key=lambda x: x[1], reverse=True)[:10])
    }

# ============== PDF INVOICE EXPORT ==============
@router.post("/invoice/generate")
async def generate_invoice(invoice: InvoiceRequest):
    """Generate a PDF invoice"""
    
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=1*cm, leftMargin=1*cm, topMargin=1*cm, bottomMargin=1*cm)
    
    styles = getSampleStyleSheet()
    
    # Custom styles
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=24,
        textColor=colors.HexColor('#1e3a5f'),
        alignment=TA_CENTER,
        spaceAfter=20
    )
    
    subtitle_style = ParagraphStyle(
        'Subtitle',
        parent=styles['Normal'],
        fontSize=10,
        textColor=colors.grey,
        alignment=TA_CENTER,
        spaceAfter=30
    )
    
    header_style = ParagraphStyle(
        'Header',
        parent=styles['Heading2'],
        fontSize=14,
        textColor=colors.HexColor('#1e3a5f'),
        spaceAfter=10
    )
    
    normal_style = ParagraphStyle(
        'CustomNormal',
        parent=styles['Normal'],
        fontSize=10,
        spaceAfter=5
    )
    
    elements = []
    
    # Company Header
    elements.append(Paragraph("✈️ AirYatra", title_style))
    elements.append(Paragraph("India's Premium Helicopter Booking Platform", subtitle_style))
    elements.append(Paragraph("GSTIN: 27AABCU9603R1ZM | CIN: U62200MH2024PTC123456", 
                              ParagraphStyle('Small', fontSize=8, alignment=TA_CENTER, textColor=colors.grey)))
    elements.append(Spacer(1, 20))
    
    # Invoice Title
    invoice_num = invoice.invoice_number or f"AY-INV-{datetime.now().strftime('%Y%m%d')}-{str(uuid.uuid4())[:4].upper()}"
    elements.append(Paragraph(f"TAX INVOICE", 
                              ParagraphStyle('InvTitle', fontSize=16, alignment=TA_CENTER, 
                                            textColor=colors.white, backColor=colors.HexColor('#1e3a5f'),
                                            spaceBefore=10, spaceAfter=10)))
    elements.append(Spacer(1, 10))
    
    # Invoice Details Table
    invoice_details = [
        ["Invoice Number:", invoice_num, "Date:", datetime.now().strftime("%d-%b-%Y")],
        ["Booking ID:", invoice.booking_id or "N/A", "Due Date:", (datetime.now() + timedelta(days=7)).strftime("%d-%b-%Y")]
    ]
    
    inv_table = Table(invoice_details, colWidths=[2.5*cm, 5*cm, 2.5*cm, 5*cm])
    inv_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTNAME', (2, 0), (2, -1), 'Helvetica-Bold'),
        ('TEXTCOLOR', (0, 0), (0, -1), colors.HexColor('#1e3a5f')),
        ('TEXTCOLOR', (2, 0), (2, -1), colors.HexColor('#1e3a5f')),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
    ]))
    elements.append(inv_table)
    elements.append(Spacer(1, 20))
    
    # Bill To Section
    elements.append(Paragraph("BILL TO:", header_style))
    elements.append(Paragraph(f"<b>{invoice.customer_name}</b>", normal_style))
    elements.append(Paragraph(invoice.customer_address.replace('\n', '<br/>'), normal_style))
    if invoice.customer_gst:
        elements.append(Paragraph(f"GSTIN: {invoice.customer_gst}", normal_style))
    elements.append(Spacer(1, 20))
    
    # Items Table
    items_data = [["S.No", "Description", "HSN/SAC", "Qty", "Rate (₹)", "Amount (₹)"]]
    for i, item in enumerate(invoice.items, 1):
        items_data.append([
            str(i),
            item.get("description", ""),
            item.get("hsn_code", "996311"),
            str(item.get("quantity", 1)),
            f"{item.get('rate', 0):,.2f}",
            f"{item.get('amount', 0):,.2f}"
        ])
    
    items_table = Table(items_data, colWidths=[1*cm, 7*cm, 2*cm, 1.5*cm, 2.5*cm, 3*cm])
    items_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1e3a5f')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
        ('ALIGN', (3, 1), (-1, -1), 'RIGHT'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
    ]))
    elements.append(items_table)
    elements.append(Spacer(1, 10))
    
    # Totals Table
    gst_half = invoice.gst_amount / 2
    totals_data = [
        ["", "Subtotal:", f"₹ {invoice.subtotal:,.2f}"],
        ["", f"CGST ({invoice.gst_rate/2}%):", f"₹ {gst_half:,.2f}"],
        ["", f"SGST ({invoice.gst_rate/2}%):", f"₹ {gst_half:,.2f}"],
        ["", "Grand Total:", f"₹ {invoice.total:,.2f}"]
    ]
    
    totals_table = Table(totals_data, colWidths=[10*cm, 4*cm, 3*cm])
    totals_table.setStyle(TableStyle([
        ('FONTNAME', (1, -1), (-1, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('ALIGN', (1, 0), (-1, -1), 'RIGHT'),
        ('LINEABOVE', (1, -1), (-1, -1), 1, colors.HexColor('#1e3a5f')),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('BACKGROUND', (1, -1), (-1, -1), colors.HexColor('#e8f4f8')),
    ]))
    elements.append(totals_table)
    elements.append(Spacer(1, 20))
    
    # Amount in Words
    def number_to_words(num):
        ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
                'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
        tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']
        
        if num < 20:
            return ones[int(num)]
        elif num < 100:
            return tens[int(num) // 10] + (' ' + ones[int(num) % 10] if num % 10 else '')
        elif num < 1000:
            return ones[int(num) // 100] + ' Hundred' + (' ' + number_to_words(num % 100) if num % 100 else '')
        elif num < 100000:
            return number_to_words(num // 1000) + ' Thousand' + (' ' + number_to_words(num % 1000) if num % 1000 else '')
        elif num < 10000000:
            return number_to_words(num // 100000) + ' Lakh' + (' ' + number_to_words(num % 100000) if num % 100000 else '')
        else:
            return number_to_words(num // 10000000) + ' Crore' + (' ' + number_to_words(num % 10000000) if num % 10000000 else '')
    
    amount_words = number_to_words(int(invoice.total)) + " Rupees Only"
    elements.append(Paragraph(f"<b>Amount in Words:</b> {amount_words}", normal_style))
    elements.append(Spacer(1, 20))
    
    # Notes
    if invoice.notes:
        elements.append(Paragraph("<b>Notes:</b>", normal_style))
        elements.append(Paragraph(invoice.notes, normal_style))
        elements.append(Spacer(1, 10))
    
    # Terms & Bank Details
    elements.append(Paragraph("<b>Bank Details for Payment:</b>", header_style))
    bank_info = """
    Bank: ICICI Bank | A/C: 123456789012 | IFSC: ICIC0001234
    Branch: Mumbai Main | A/C Name: AirYatra Aviation Pvt Ltd
    """
    elements.append(Paragraph(bank_info, ParagraphStyle('Bank', fontSize=9, textColor=colors.grey)))
    elements.append(Spacer(1, 20))
    
    # Footer
    elements.append(Paragraph("This is a computer-generated invoice. No signature required.", 
                              ParagraphStyle('Footer', fontSize=8, alignment=TA_CENTER, textColor=colors.grey)))
    elements.append(Paragraph("Thank you for flying with AirYatra! ✈️", 
                              ParagraphStyle('Thanks', fontSize=10, alignment=TA_CENTER, 
                                            textColor=colors.HexColor('#1e3a5f'), spaceBefore=10)))
    
    doc.build(elements)
    buffer.seek(0)
    
    # Store invoice record
    db = get_database()
    await db.invoices.insert_one({
        "invoice_number": invoice_num,
        "customer_name": invoice.customer_name,
        "total": invoice.total,
        "gst_amount": invoice.gst_amount,
        "created_at": datetime.now(timezone.utc)
    })
    
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=Invoice_{invoice_num}.pdf"}
    )

@router.get("/invoice/list")
async def get_invoices(limit: int = 50):
    """Get list of generated invoices"""
    db = get_database()
    invoices = await db.invoices.find({}).sort("created_at", -1).to_list(limit)
    return {"invoices": [serialize_doc(i) for i in invoices]}

# ============== EXPENSE ANALYTICS ==============
@router.get("/analytics/expenses")
async def get_expense_analytics(
    period: str = "month",  # day, week, month, quarter, year
    category: Optional[str] = None
):
    """Get expense analytics with trends"""
    db = get_database()
    
    now = datetime.now(timezone.utc)
    
    # Define period ranges
    if period == "day":
        periods = 30  # Last 30 days
        delta = timedelta(days=1)
        format_str = "%Y-%m-%d"
    elif period == "week":
        periods = 12  # Last 12 weeks
        delta = timedelta(weeks=1)
        format_str = "%Y-W%W"
    elif period == "month":
        periods = 12  # Last 12 months
        delta = timedelta(days=30)
        format_str = "%Y-%m"
    elif period == "quarter":
        periods = 8  # Last 8 quarters
        delta = timedelta(days=90)
        format_str = "%Y-Q"
    else:  # year
        periods = 5
        delta = timedelta(days=365)
        format_str = "%Y"
    
    # Get all transactions
    transactions = await db.finance_transactions.find({
        "transaction_type": "debit"
    }).to_list(10000)
    
    # Get all vendor bills
    bills = await db.vendor_bills.find({}).to_list(10000)
    
    # Aggregate by period and category
    expense_by_period = {}
    expense_by_category = {}
    category_trend = {}
    
    for txn in transactions:
        try:
            txn_date = txn.get("created_at", "")
            if isinstance(txn_date, str):
                dt = datetime.fromisoformat(txn_date.replace("Z", "+00:00"))
            else:
                dt = txn_date
            
            if period == "quarter":
                period_key = f"{dt.year}-Q{(dt.month-1)//3 + 1}"
            else:
                period_key = dt.strftime(format_str)
            
            cat = txn.get("category", "uncategorized")
            amount = txn.get("amount", 0)
            
            # By period
            if period_key not in expense_by_period:
                expense_by_period[period_key] = 0
            expense_by_period[period_key] += amount
            
            # By category
            if cat not in expense_by_category:
                expense_by_category[cat] = 0
            expense_by_category[cat] += amount
            
            # Category trend
            if cat not in category_trend:
                category_trend[cat] = {}
            if period_key not in category_trend[cat]:
                category_trend[cat][period_key] = 0
            category_trend[cat][period_key] += amount
            
        except (ValueError, TypeError, AttributeError):
            pass
    
    # Add bills to analytics
    for bill in bills:
        try:
            bill_date = bill.get("created_at", bill.get("invoice_date", ""))
            if isinstance(bill_date, str):
                dt = datetime.fromisoformat(bill_date.replace("Z", "+00:00"))
            else:
                dt = bill_date
            
            if period == "quarter":
                period_key = f"{dt.year}-Q{(dt.month-1)//3 + 1}"
            else:
                period_key = dt.strftime(format_str)
            
            cat = bill.get("category", "vendor")
            amount = bill.get("amount", 0)
            
            if period_key not in expense_by_period:
                expense_by_period[period_key] = 0
            expense_by_period[period_key] += amount
            
            if cat not in expense_by_category:
                expense_by_category[cat] = 0
            expense_by_category[cat] += amount
            
        except (ValueError, TypeError, AttributeError):
            pass
    
    # Calculate totals and averages
    total_expense = sum(expense_by_category.values())
    avg_monthly = total_expense / 12 if total_expense > 0 else 0
    
    # Top categories
    top_categories = sorted(expense_by_category.items(), key=lambda x: x[1], reverse=True)[:10]
    
    # Month-over-month growth
    sorted_periods = sorted(expense_by_period.keys())
    growth = []
    for i in range(1, len(sorted_periods)):
        prev = expense_by_period.get(sorted_periods[i-1], 0)
        curr = expense_by_period.get(sorted_periods[i], 0)
        if prev > 0:
            growth_rate = ((curr - prev) / prev) * 100
        else:
            growth_rate = 0
        growth.append({
            "period": sorted_periods[i],
            "amount": curr,
            "growth_rate": round(growth_rate, 1)
        })
    
    return {
        "total_expense": total_expense,
        "average_monthly": avg_monthly,
        "expense_by_period": dict(sorted(expense_by_period.items())),
        "expense_by_category": expense_by_category,
        "top_categories": [{"category": c, "amount": a} for c, a in top_categories],
        "category_trend": category_trend,
        "growth_trend": growth,
        "period": period
    }

@router.get("/analytics/category/{category}")
async def get_category_drilldown(category: str):
    """Get detailed breakdown for a specific category"""
    db = get_database()
    
    # Get transactions in this category
    transactions = await db.finance_transactions.find({
        "transaction_type": "debit",
        "category": category
    }).sort("created_at", -1).to_list(500)
    
    # Get bills in this category
    bills = await db.vendor_bills.find({
        "category": category
    }).sort("created_at", -1).to_list(500)
    
    # Aggregate by vendor/counterparty
    by_vendor = {}
    for txn in transactions:
        vendor = txn.get("counterparty", txn.get("description", "Unknown"))
        by_vendor[vendor] = by_vendor.get(vendor, 0) + txn.get("amount", 0)
    
    for bill in bills:
        vendor = bill.get("vendor_name", "Unknown")
        by_vendor[vendor] = by_vendor.get(vendor, 0) + bill.get("amount", 0)
    
    # Monthly trend
    monthly_trend = {}
    for txn in transactions:
        try:
            dt = datetime.fromisoformat(str(txn.get("created_at", "")).replace("Z", "+00:00"))
            month = dt.strftime("%Y-%m")
            monthly_trend[month] = monthly_trend.get(month, 0) + txn.get("amount", 0)
        except (ValueError, TypeError, AttributeError):
            pass
    
    return {
        "category": category,
        "total_amount": sum(by_vendor.values()),
        "transaction_count": len(transactions) + len(bills),
        "by_vendor": dict(sorted(by_vendor.items(), key=lambda x: x[1], reverse=True)[:20]),
        "monthly_trend": dict(sorted(monthly_trend.items())),
        "recent_transactions": [serialize_doc(t) for t in transactions[:20]]
    }

# ============== MULTI-CURRENCY SUPPORT ==============
# Exchange rates cache
_exchange_rates_cache = {
    "rates": {},
    "last_updated": None
}

@router.get("/currency/rates")
async def get_exchange_rates():
    """Get live exchange rates"""
    global _exchange_rates_cache
    
    now = datetime.now(timezone.utc)
    
    # Check cache (refresh every 1 hour)
    if _exchange_rates_cache["last_updated"] and \
       (now - _exchange_rates_cache["last_updated"]).seconds < 3600:
        return {
            "rates": _exchange_rates_cache["rates"],
            "base": "INR",
            "last_updated": _exchange_rates_cache["last_updated"].isoformat(),
            "cached": True
        }
    
    try:
        # Use a free exchange rate API
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://api.exchangerate-api.com/v4/latest/INR",
                timeout=10.0
            )
            data = response.json()
            
            # Store rates for common currencies
            rates = {
                "USD": round(1 / data["rates"].get("USD", 83), 4),
                "EUR": round(1 / data["rates"].get("EUR", 91), 4),
                "GBP": round(1 / data["rates"].get("GBP", 105), 4),
                "AED": round(1 / data["rates"].get("AED", 22.6), 4),
                "SGD": round(1 / data["rates"].get("SGD", 62), 4),
                "JPY": round(1 / data["rates"].get("JPY", 0.55), 4),
                "AUD": round(1 / data["rates"].get("AUD", 55), 4),
                "CAD": round(1 / data["rates"].get("CAD", 62), 4),
                "CHF": round(1 / data["rates"].get("CHF", 95), 4),
                "INR": 1.0
            }
            
            _exchange_rates_cache["rates"] = rates
            _exchange_rates_cache["last_updated"] = now
            
            return {
                "rates": rates,
                "base": "INR",
                "last_updated": now.isoformat(),
                "cached": False
            }
    except Exception as e:
        # Fallback to hardcoded rates
        fallback_rates = {
            "USD": 83.50,
            "EUR": 91.20,
            "GBP": 105.80,
            "AED": 22.73,
            "SGD": 62.10,
            "JPY": 0.56,
            "AUD": 54.80,
            "CAD": 61.50,
            "CHF": 94.20,
            "INR": 1.0
        }
        return {
            "rates": fallback_rates,
            "base": "INR",
            "last_updated": now.isoformat(),
            "cached": True,
            "fallback": True,
            "error": str(e)
        }

@router.post("/currency/convert")
async def convert_currency(conversion: CurrencyConversion):
    """Convert between currencies"""
    rates_response = await get_exchange_rates()
    rates = rates_response["rates"]
    
    from_rate = rates.get(conversion.from_currency, 1)
    to_rate = rates.get(conversion.to_currency, 1)
    
    if conversion.from_currency == "INR":
        result = conversion.amount / to_rate
    elif conversion.to_currency == "INR":
        result = conversion.amount * from_rate
    else:
        # Convert via INR
        inr_amount = conversion.amount * from_rate
        result = inr_amount / to_rate
    
    return {
        "from_currency": conversion.from_currency,
        "to_currency": conversion.to_currency,
        "original_amount": conversion.amount,
        "converted_amount": round(result, 2),
        "rate_used": round(from_rate / to_rate, 4) if to_rate else 0,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }

@router.post("/currency/vendor-payment")
async def create_forex_vendor_payment(
    vendor_name: str,
    amount_foreign: float,
    currency: str,
    description: Optional[str] = None
):
    """Create a vendor payment with forex conversion"""
    db = get_database()
    
    # Get exchange rate
    rates_response = await get_exchange_rates()
    rates = rates_response["rates"]
    rate = rates.get(currency, 83.50)
    
    # Calculate INR amount
    inr_amount = amount_foreign * rate
    
    payment_doc = {
        "id": str(uuid.uuid4()),
        "vendor_name": vendor_name,
        "original_currency": currency,
        "original_amount": amount_foreign,
        "exchange_rate": rate,
        "inr_amount": round(inr_amount, 2),
        "description": description,
        "status": "pending",
        "created_at": datetime.now(timezone.utc)
    }
    
    await db.forex_payments.insert_one(payment_doc)
    
    # Create audit log
    await create_audit_log(AuditLogCreate(
        action="create",
        module="forex",
        entity_type="payment",
        entity_id=payment_doc["id"],
        description=f"Created forex payment: {currency} {amount_foreign:,.2f} = ₹{inr_amount:,.2f}"
    ))
    
    return {
        "success": True,
        "payment": serialize_doc(payment_doc),
        "conversion": {
            "from": f"{currency} {amount_foreign:,.2f}",
            "to": f"INR {inr_amount:,.2f}",
            "rate": rate
        }
    }

@router.get("/currency/payments")
async def get_forex_payments(limit: int = 50):
    """Get forex payment history"""
    db = get_database()
    payments = await db.forex_payments.find({}).sort("created_at", -1).to_list(limit)
    
    total_inr = sum(p.get("inr_amount", 0) for p in payments)
    by_currency = {}
    for p in payments:
        cur = p.get("original_currency", "USD")
        by_currency[cur] = by_currency.get(cur, 0) + p.get("original_amount", 0)
    
    return {
        "payments": [serialize_doc(p) for p in payments],
        "total_inr": total_inr,
        "by_currency": by_currency
    }
