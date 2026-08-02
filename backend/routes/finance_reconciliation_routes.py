"""
AirYatra Finance ERP - Payment Reconciliation & Finance Reports
Auto-matching of gateway settlements with system transactions + PDF reports
"""
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from middleware import get_current_user, require_roles
from models import UserRole
from database import get_database
from datetime import datetime, timezone, timedelta
from typing import Optional, List
from pydantic import BaseModel
from io import BytesIO
import uuid

# ReportLab for PDF generation
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import inch, mm
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image, HRFlowable
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_RIGHT, TA_LEFT

router = APIRouter(prefix="/finance/reconciliation", tags=["finance-reconciliation"])


def serialize_doc(doc: dict) -> dict:
    """Remove MongoDB _id and convert datetime objects"""
    if doc is None:
        return None
    result = {k: v for k, v in doc.items() if k != "_id"}
    for k, v in result.items():
        if isinstance(v, datetime):
            result[k] = v.isoformat()
    return result


# ==================== PAYMENT RECONCILIATION ====================

class ReconciliationFilter(BaseModel):
    gateway: Optional[str] = None  # stripe, razorpay, all
    status: Optional[str] = None   # matched, unmatched, disputed, pending
    from_date: Optional[str] = None
    to_date: Optional[str] = None


@router.get("/summary")
async def get_reconciliation_summary(
    period: str = "month",
    current_user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.FINANCE_HEAD, UserRole.CFO]))
):
    """
    Get reconciliation summary - matched vs unmatched transactions
    """
    db = get_database()
    
    now = datetime.now(timezone.utc)
    if period == "week":
        start_date = now - timedelta(days=7)
    elif period == "month":
        start_date = now - timedelta(days=30)
    elif period == "quarter":
        start_date = now - timedelta(days=90)
    else:
        start_date = now - timedelta(days=30)
    
    # Get all payment transactions
    system_txns = await db.payment_transactions.find({
        "created_at": {"$gte": start_date}
    }).to_list(10000)
    
    # Get gateway settlements (Stripe)
    stripe_settlements = await db.stripe_settlements.find({
        "created_at": {"$gte": start_date}
    }).to_list(5000)
    
    # Get Razorpay settlements
    razorpay_settlements = await db.razorpay_settlements.find({
        "created_at": {"$gte": start_date}
    }).to_list(5000)
    
    # Count matched vs unmatched
    matched_count = 0
    unmatched_system = 0
    unmatched_gateway = 0
    disputed = 0
    total_matched_amount = 0
    total_unmatched_amount = 0
    
    # Check system transactions
    for txn in system_txns:
        if txn.get("reconciliation_status") == "matched":
            matched_count += 1
            total_matched_amount += txn.get("amount", 0)
        elif txn.get("reconciliation_status") == "disputed":
            disputed += 1
            total_unmatched_amount += txn.get("amount", 0)
        else:
            unmatched_system += 1
            total_unmatched_amount += txn.get("amount", 0)
    
    # Check gateway settlements not in system
    system_payment_ids = set(txn.get("gateway_payment_id") for txn in system_txns if txn.get("gateway_payment_id"))
    
    for settlement in stripe_settlements + razorpay_settlements:
        if settlement.get("payment_id") not in system_payment_ids:
            unmatched_gateway += 1
    
    return {
        "period": period,
        "summary": {
            "total_transactions": len(system_txns),
            "matched": matched_count,
            "unmatched_system": unmatched_system,
            "unmatched_gateway": unmatched_gateway,
            "disputed": disputed,
            "match_rate": round(matched_count / len(system_txns) * 100, 1) if system_txns else 0
        },
        "amounts": {
            "total_matched": total_matched_amount,
            "total_unmatched": total_unmatched_amount,
            "currency": "INR"
        },
        "by_gateway": {
            "stripe": {
                "transactions": len([t for t in system_txns if t.get("gateway") == "stripe"]),
                "settlements": len(stripe_settlements)
            },
            "razorpay": {
                "transactions": len([t for t in system_txns if t.get("gateway") == "razorpay"]),
                "settlements": len(razorpay_settlements)
            }
        }
    }


@router.get("/transactions")
async def get_reconciliation_transactions(
    gateway: Optional[str] = None,
    status: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    current_user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.FINANCE_HEAD, UserRole.CFO]))
):
    """
    Get list of transactions for reconciliation with filters
    """
    db = get_database()
    
    query = {}
    if gateway and gateway != "all":
        query["gateway"] = gateway
    if status:
        query["reconciliation_status"] = status
    if from_date:
        try:
            query["created_at"] = {"$gte": datetime.fromisoformat(from_date.replace("Z", "+00:00"))}
        except (ValueError, TypeError):
            pass
    if to_date:
        try:
            to_dt = datetime.fromisoformat(to_date.replace("Z", "+00:00"))
            if "created_at" in query:
                query["created_at"]["$lte"] = to_dt
            else:
                query["created_at"] = {"$lte": to_dt}
        except (ValueError, TypeError):
            pass
    
    total = await db.payment_transactions.count_documents(query)
    transactions = await db.payment_transactions.find(query).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    # Enrich with booking info
    enriched = []
    for txn in transactions:
        booking_id = txn.get("booking_id")
        booking = None
        if booking_id:
            booking = await db.inquiries.find_one({"id": booking_id}, {"_id": 0, "customer_name": 1, "service_type": 1})
        
        enriched.append({
            **serialize_doc(txn),
            "booking_info": booking
        })
    
    return {
        "transactions": enriched,
        "total": total,
        "page": skip // limit + 1,
        "has_more": (skip + limit) < total
    }


@router.post("/auto-match")
async def run_auto_reconciliation(
    gateway: Optional[str] = None,
    current_user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.FINANCE_HEAD, UserRole.CFO]))
):
    """
    Run automatic reconciliation - match system transactions with gateway settlements
    """
    db = get_database()
    
    matched_count = 0
    failed_count = 0
    errors = []
    
    # Get unmatched system transactions
    query = {"reconciliation_status": {"$nin": ["matched", "disputed"]}}
    if gateway and gateway != "all":
        query["gateway"] = gateway
    
    unmatched_txns = await db.payment_transactions.find(query).to_list(1000)
    
    for txn in unmatched_txns:
        try:
            gw = txn.get("gateway", "").lower()
            payment_id = txn.get("gateway_payment_id")
            
            if not payment_id:
                continue
            
            # Find matching settlement
            settlement = None
            if gw == "stripe":
                settlement = await db.stripe_payments.find_one({"payment_intent_id": payment_id})
                if not settlement:
                    settlement = await db.stripe_settlements.find_one({"payment_id": payment_id})
            elif gw == "razorpay":
                settlement = await db.razorpay_orders.find_one({"razorpay_payment_id": payment_id})
                if not settlement:
                    settlement = await db.razorpay_settlements.find_one({"payment_id": payment_id})
            
            if settlement:
                # Verify amounts match
                settlement_amount = settlement.get("amount", 0)
                # Stripe amounts are in cents/paise
                if gw == "stripe" and settlement.get("currency", "").lower() == "inr":
                    settlement_amount = settlement_amount / 100
                
                txn_amount = txn.get("amount", 0)
                
                # Allow small variance (rounding)
                if abs(settlement_amount - txn_amount) <= 1:
                    # Match found!
                    await db.payment_transactions.update_one(
                        {"id": txn["id"]},
                        {"$set": {
                            "reconciliation_status": "matched",
                            "reconciled_at": datetime.now(timezone.utc),
                            "reconciled_by": current_user.get("email"),
                            "settlement_id": str(settlement.get("_id", settlement.get("id", ""))),
                            "settlement_amount": settlement_amount
                        }}
                    )
                    matched_count += 1
                else:
                    # Amount mismatch - flag for review
                    await db.payment_transactions.update_one(
                        {"id": txn["id"]},
                        {"$set": {
                            "reconciliation_status": "disputed",
                            "dispute_reason": f"Amount mismatch: System ₹{txn_amount} vs Gateway ₹{settlement_amount}",
                            "flagged_at": datetime.now(timezone.utc)
                        }}
                    )
                    failed_count += 1
                    errors.append({
                        "txn_id": txn["id"],
                        "reason": f"Amount mismatch: ₹{txn_amount} vs ₹{settlement_amount}"
                    })
        except Exception as e:
            failed_count += 1
            errors.append({"txn_id": txn.get("id", "unknown"), "reason": str(e)})
    
    # Create reconciliation run log
    run_log = {
        "id": str(uuid.uuid4()),
        "run_type": "auto",
        "gateway": gateway or "all",
        "matched": matched_count,
        "failed": failed_count,
        "errors": errors[:10],  # Limit stored errors
        "run_by": current_user.get("email"),
        "created_at": datetime.now(timezone.utc)
    }
    await db.reconciliation_runs.insert_one(run_log)
    
    return {
        "success": True,
        "matched": matched_count,
        "failed": failed_count,
        "errors": errors[:5],
        "run_id": run_log["id"]
    }


@router.post("/manual-match")
async def manual_match_transaction(
    transaction_id: str,
    settlement_id: str,
    notes: Optional[str] = None,
    current_user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.FINANCE_HEAD, UserRole.CFO]))
):
    """
    Manually match a transaction with a settlement
    """
    db = get_database()
    
    # Find the transaction
    txn = await db.payment_transactions.find_one({"id": transaction_id})
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    # Update as matched
    await db.payment_transactions.update_one(
        {"id": transaction_id},
        {"$set": {
            "reconciliation_status": "matched",
            "reconciled_at": datetime.now(timezone.utc),
            "reconciled_by": current_user.get("email"),
            "settlement_id": settlement_id,
            "manual_match": True,
            "match_notes": notes
        }}
    )
    
    return {"success": True, "message": "Transaction manually matched"}


@router.post("/dispute")
async def dispute_transaction(
    transaction_id: str,
    reason: str,
    current_user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.FINANCE_HEAD, UserRole.CFO]))
):
    """
    Mark a transaction as disputed
    """
    db = get_database()
    
    await db.payment_transactions.update_one(
        {"id": transaction_id},
        {"$set": {
            "reconciliation_status": "disputed",
            "dispute_reason": reason,
            "disputed_by": current_user.get("email"),
            "disputed_at": datetime.now(timezone.utc)
        }}
    )
    
    return {"success": True, "message": "Transaction marked as disputed"}


# ==================== FINANCE REPORTS PDF ====================

class MonthlyReportRequest(BaseModel):
    month: int  # 1-12
    year: int
    include_sections: Optional[List[str]] = None  # revenue, expenses, reconciliation, etc.


def format_inr(amount: float) -> str:
    """Format amount in Indian currency style"""
    if amount >= 10000000:
        return f"₹{amount/10000000:.2f} Cr"
    elif amount >= 100000:
        return f"₹{amount/100000:.2f} L"
    else:
        return f"₹{amount:,.2f}"


@router.post("/reports/monthly-pdf")
async def generate_monthly_finance_report(
    request: MonthlyReportRequest,
    current_user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.FINANCE_HEAD, UserRole.CFO]))
):
    """
    Generate professional monthly finance report PDF
    """
    db = get_database()
    
    # Calculate date range
    start_date = datetime(request.year, request.month, 1, tzinfo=timezone.utc)
    if request.month == 12:
        end_date = datetime(request.year + 1, 1, 1, tzinfo=timezone.utc)
    else:
        end_date = datetime(request.year, request.month + 1, 1, tzinfo=timezone.utc)
    
    month_name = start_date.strftime("%B %Y")
    
    # Fetch data
    # 1. Revenue data
    paid_transactions = await db.payment_transactions.find({
        "status": "paid",
        "created_at": {"$gte": start_date, "$lt": end_date}
    }).to_list(10000)
    
    total_revenue = sum(t.get("amount", 0) for t in paid_transactions)
    advance_revenue = sum(t.get("amount", 0) for t in paid_transactions if t.get("payment_type") == "advance")
    balance_revenue = sum(t.get("amount", 0) for t in paid_transactions if t.get("payment_type") == "balance")
    
    # By gateway
    gateway_revenue = {}
    for txn in paid_transactions:
        gw = txn.get("gateway", "other")
        gateway_revenue[gw] = gateway_revenue.get(gw, 0) + txn.get("amount", 0)
    
    # 2. Bookings data
    bookings = await db.inquiries.find({
        "created_at": {"$gte": start_date.isoformat(), "$lt": end_date.isoformat()}
    }).to_list(5000)
    
    total_bookings = len(bookings)
    confirmed_bookings = len([b for b in bookings if b.get("status") in ["confirmed", "completed"]])
    
    # 3. Expenses data
    expenses = await db.expenses.find({
        "created_at": {"$gte": start_date, "$lt": end_date}
    }).to_list(5000)
    
    total_expenses = sum(e.get("amount", 0) for e in expenses)
    
    # Category-wise expenses
    expense_by_category = {}
    for exp in expenses:
        cat = exp.get("category", "Other")
        expense_by_category[cat] = expense_by_category.get(cat, 0) + exp.get("amount", 0)
    
    # 4. Reconciliation data
    matched_txns = len([t for t in paid_transactions if t.get("reconciliation_status") == "matched"])
    unmatched_txns = len([t for t in paid_transactions if t.get("reconciliation_status") != "matched"])
    
    # 5. Top customers
    customer_revenue = {}
    for txn in paid_transactions:
        user_id = txn.get("user_id")
        if user_id:
            customer_revenue[user_id] = customer_revenue.get(user_id, 0) + txn.get("amount", 0)
    
    top_customer_ids = sorted(customer_revenue.keys(), key=lambda x: customer_revenue[x], reverse=True)[:5]
    top_customers = []
    for uid in top_customer_ids:
        user = await db.users.find_one({"id": uid}, {"_id": 0, "full_name": 1, "email": 1})
        if user:
            top_customers.append({
                "name": user.get("full_name", "Unknown"),
                "email": user.get("email", ""),
                "revenue": customer_revenue[uid]
            })
    
    # Generate PDF
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=20*mm,
        leftMargin=20*mm,
        topMargin=20*mm,
        bottomMargin=20*mm
    )
    
    styles = getSampleStyleSheet()
    
    # Custom styles
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=24,
        textColor=colors.HexColor('#1e40af'),
        spaceAfter=20,
        alignment=TA_CENTER
    )
    
    subtitle_style = ParagraphStyle(
        'CustomSubtitle',
        parent=styles['Normal'],
        fontSize=14,
        textColor=colors.HexColor('#64748b'),
        spaceAfter=30,
        alignment=TA_CENTER
    )
    
    section_style = ParagraphStyle(
        'SectionHeader',
        parent=styles['Heading2'],
        fontSize=14,
        textColor=colors.HexColor('#0f172a'),
        spaceBefore=20,
        spaceAfter=10,
        borderPadding=5
    )
    
    normal_style = ParagraphStyle(
        'CustomNormal',
        parent=styles['Normal'],
        fontSize=10,
        textColor=colors.HexColor('#334155')
    )
    
    elements = []
    
    # Header
    elements.append(Paragraph("✈️ AirYatra", title_style))
    elements.append(Paragraph(f"Monthly Finance Report - {month_name}", subtitle_style))
    elements.append(HRFlowable(width="100%", thickness=2, color=colors.HexColor('#e2e8f0')))
    elements.append(Spacer(1, 20))
    
    # Report metadata
    meta_data = [
        ["Report Generated:", datetime.now(timezone.utc).strftime("%d %b %Y, %H:%M UTC")],
        ["Generated By:", current_user.get("email", "System")],
        ["Period:", f"1 {month_name} to {(end_date - timedelta(days=1)).strftime('%d %b %Y')}"]
    ]
    meta_table = Table(meta_data, colWidths=[120, 300])
    meta_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('TEXTCOLOR', (0, 0), (0, -1), colors.HexColor('#64748b')),
        ('TEXTCOLOR', (1, 0), (1, -1), colors.HexColor('#0f172a')),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ]))
    elements.append(meta_table)
    elements.append(Spacer(1, 30))
    
    # Executive Summary
    elements.append(Paragraph("📊 Executive Summary", section_style))
    
    net_profit = total_revenue - total_expenses
    profit_margin = (net_profit / total_revenue * 100) if total_revenue > 0 else 0
    
    summary_data = [
        ["Metric", "Value", "Status"],
        ["Total Revenue", format_inr(total_revenue), "✅" if total_revenue > 0 else "⚠️"],
        ["Total Expenses", format_inr(total_expenses), ""],
        ["Net Profit/Loss", format_inr(net_profit), "✅" if net_profit > 0 else "❌"],
        ["Profit Margin", f"{profit_margin:.1f}%", "✅" if profit_margin > 10 else "⚠️"],
        ["Total Bookings", str(total_bookings), ""],
        ["Confirmed Bookings", str(confirmed_bookings), ""],
        ["Conversion Rate", f"{(confirmed_bookings/total_bookings*100):.1f}%" if total_bookings > 0 else "0%", ""],
    ]
    
    summary_table = Table(summary_data, colWidths=[200, 150, 50])
    summary_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1e40af')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('ALIGN', (1, 0), (-1, -1), 'RIGHT'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f8fafc')]),
    ]))
    elements.append(summary_table)
    elements.append(Spacer(1, 30))
    
    # Revenue Breakdown
    elements.append(Paragraph("💰 Revenue Breakdown", section_style))
    
    revenue_data = [
        ["Category", "Amount", "% of Total"],
        ["Advance Payments", format_inr(advance_revenue), f"{(advance_revenue/total_revenue*100):.1f}%" if total_revenue > 0 else "0%"],
        ["Balance Payments", format_inr(balance_revenue), f"{(balance_revenue/total_revenue*100):.1f}%" if total_revenue > 0 else "0%"],
    ]
    
    # Add gateway breakdown
    for gw, amount in sorted(gateway_revenue.items(), key=lambda x: x[1], reverse=True):
        revenue_data.append([
            f"Via {gw.capitalize()}",
            format_inr(amount),
            f"{(amount/total_revenue*100):.1f}%" if total_revenue > 0 else "0%"
        ])
    
    revenue_table = Table(revenue_data, colWidths=[200, 120, 80])
    revenue_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#059669')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('ALIGN', (1, 0), (-1, -1), 'RIGHT'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
    ]))
    elements.append(revenue_table)
    elements.append(Spacer(1, 30))
    
    # Expenses Breakdown
    if expense_by_category:
        elements.append(Paragraph("📉 Expense Breakdown", section_style))
        
        expense_data = [["Category", "Amount", "% of Total"]]
        for cat, amount in sorted(expense_by_category.items(), key=lambda x: x[1], reverse=True):
            expense_data.append([
                cat,
                format_inr(amount),
                f"{(amount/total_expenses*100):.1f}%" if total_expenses > 0 else "0%"
            ])
        expense_data.append(["TOTAL", format_inr(total_expenses), "100%"])
        
        expense_table = Table(expense_data, colWidths=[200, 120, 80])
        expense_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#dc2626')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
            ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#fef2f2')),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('ALIGN', (1, 0), (-1, -1), 'RIGHT'),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ('TOPPADDING', (0, 0), (-1, -1), 8),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
        ]))
        elements.append(expense_table)
        elements.append(Spacer(1, 30))
    
    # Reconciliation Status
    elements.append(Paragraph("🔄 Payment Reconciliation", section_style))
    
    recon_data = [
        ["Status", "Count", "Percentage"],
        ["Matched", str(matched_txns), f"{(matched_txns/len(paid_transactions)*100):.1f}%" if paid_transactions else "0%"],
        ["Pending/Unmatched", str(unmatched_txns), f"{(unmatched_txns/len(paid_transactions)*100):.1f}%" if paid_transactions else "0%"],
        ["Total Transactions", str(len(paid_transactions)), "100%"],
    ]
    
    recon_table = Table(recon_data, colWidths=[200, 100, 100])
    recon_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#7c3aed')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('ALIGN', (1, 0), (-1, -1), 'CENTER'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
    ]))
    elements.append(recon_table)
    elements.append(Spacer(1, 30))
    
    # Top Customers
    if top_customers:
        elements.append(Paragraph("👥 Top Customers", section_style))
        
        customer_data = [["Rank", "Customer", "Email", "Revenue"]]
        for i, cust in enumerate(top_customers, 1):
            customer_data.append([
                f"#{i}",
                cust["name"],
                cust["email"],
                format_inr(cust["revenue"])
            ])
        
        customer_table = Table(customer_data, colWidths=[40, 150, 150, 80])
        customer_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#0891b2')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('ALIGN', (0, 0), (0, -1), 'CENTER'),
            ('ALIGN', (3, 0), (3, -1), 'RIGHT'),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ('TOPPADDING', (0, 0), (-1, -1), 8),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
        ]))
        elements.append(customer_table)
        elements.append(Spacer(1, 30))
    
    # Footer
    elements.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#e2e8f0')))
    elements.append(Spacer(1, 10))
    
    footer_style = ParagraphStyle(
        'Footer',
        parent=styles['Normal'],
        fontSize=8,
        textColor=colors.HexColor('#94a3b8'),
        alignment=TA_CENTER
    )
    elements.append(Paragraph(
        f"Generated by AirYatra Finance ERP | Confidential | Page 1 of 1",
        footer_style
    ))
    
    # Build PDF
    doc.build(elements)
    buffer.seek(0)
    
    filename = f"AirYatra_Finance_Report_{month_name.replace(' ', '_')}.pdf"
    
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/reports/quick-summary")
async def get_quick_finance_summary(
    month: int,
    year: int,
    current_user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.FINANCE_HEAD, UserRole.CFO]))
):
    """
    Get quick JSON summary for a month (preview before PDF generation)
    """
    db = get_database()
    
    start_date = datetime(year, month, 1, tzinfo=timezone.utc)
    if month == 12:
        end_date = datetime(year + 1, 1, 1, tzinfo=timezone.utc)
    else:
        end_date = datetime(year, month + 1, 1, tzinfo=timezone.utc)
    
    # Revenue
    paid_transactions = await db.payment_transactions.find({
        "status": "paid",
        "created_at": {"$gte": start_date, "$lt": end_date}
    }).to_list(10000)
    
    total_revenue = sum(t.get("amount", 0) for t in paid_transactions)
    
    # Expenses
    expenses = await db.expenses.find({
        "created_at": {"$gte": start_date, "$lt": end_date}
    }).to_list(5000)
    
    total_expenses = sum(e.get("amount", 0) for e in expenses)
    
    # Bookings
    bookings = await db.inquiries.find({
        "created_at": {"$gte": start_date.isoformat(), "$lt": end_date.isoformat()}
    }).to_list(5000)
    
    return {
        "month": start_date.strftime("%B %Y"),
        "revenue": total_revenue,
        "expenses": total_expenses,
        "net": total_revenue - total_expenses,
        "transactions": len(paid_transactions),
        "bookings": len(bookings),
        "ready_for_report": True
    }
