"""Monthly GST/TDS Reports: bookings + refunds with invoice & refund details.
Downloadable as Excel/PDF. Access: Accounts/Finance/Admin/CEO."""
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from datetime import datetime, timezone
import io
import logging

from database import get_database
from middleware import get_current_user

router = APIRouter(prefix="/gst-reports", tags=["GST/TDS Reports"])
logger = logging.getLogger(__name__)

ALLOWED_ROLES = {"accounts", "finance", "admin", "super_admin", "ceo"}
GST_RATE = 5.0   # Aviation charter GST (2.5% CGST + 2.5% SGST)
TDS_RATE = 1.0   # Sec 194-O e-commerce TDS on taxable value


def _require_access(user: dict):
    if not ALLOWED_ROLES & set(user.get("roles", [])):
        raise HTTPException(status_code=403, detail="Accounts/Finance/Admin/CEO access required")


def _month_range(month: str):
    try:
        y, m = int(month[:4]), int(month[5:7])
    except Exception:
        raise HTTPException(status_code=400, detail="month must be YYYY-MM")
    start = f"{y:04d}-{m:02d}-01"
    ny, nm = (y + 1, 1) if m == 12 else (y, m + 1)
    end = f"{ny:04d}-{nm:02d}-01"
    return start, end


def _amt(b):
    return float(b.get("amount_paid") or b.get("final_price") or b.get("total_amount") or b.get("estimated_price") or 0)


async def _collect(db, month: str):
    start, end = _month_range(month)
    proj = {"_id": 0, "id": 1, "booking_number": 1, "inquiry_number": 1, "customer_id": 1,
            "customer_name": 1, "created_at": 1, "departure_date": 1, "travel_date": 1,
            "from_location": 1, "to_location": 1, "pickup_location": 1, "drop_location": 1,
            "status": 1, "payment_status": 1, "amount_paid": 1, "final_price": 1,
            "total_amount": 1, "estimated_price": 1}
    q = {"created_at": {"$gte": start, "$lt": end}}
    bookings = await db.bookings.find(q, proj).sort("created_at", 1).to_list(2000)
    bookings += await db.inquiries.find(q, proj).sort("created_at", 1).to_list(2000)

    ids = [b["id"] for b in bookings]
    cust_ids = list({b.get("customer_id") for b in bookings if b.get("customer_id")})
    users = {u["id"]: u.get("full_name") or u.get("email")
             async for u in db.users.find({"id": {"$in": cust_ids}}, {"_id": 0, "id": 1, "full_name": 1, "email": 1})}
    inv_map = {}
    async for l in db.invoice_email_log.find(
            {"booking_id": {"$in": ids}, "status": "sent"}, {"_id": 0, "booking_id": 1, "sent_at": 1}):
        if l["booking_id"] not in inv_map:
            inv_map[l["booking_id"]] = l.get("sent_at")
    refund_map = {}
    async for r in db.refund_requests.find(
            {"$or": [{"booking_id": {"$in": ids}},
                     {"status": "approved", "approved_at": {"$gte": start, "$lt": end}}]},
            {"_id": 0}):
        refund_map.setdefault(r["booking_id"], r)

    rows = []
    for b in bookings:
        ref = b.get("booking_number") or b.get("inquiry_number") or b["id"][:8]
        amount = _amt(b)
        taxable = round(amount / (1 + GST_RATE / 100), 2) if amount else 0.0
        gst = round(amount - taxable, 2)
        tds = round(taxable * TDS_RATE / 100, 2)
        inv_date = inv_map.get(b["id"])
        rf = refund_map.get(b["id"])
        rows.append({
            "client_name": b.get("customer_name") or users.get(b.get("customer_id")) or "N/A",
            "booking_id": ref,
            "booking_date": (b.get("created_at") or "")[:10],
            "travel_date": (b.get("departure_date") or b.get("travel_date") or "")[:10],
            "route": f"{b.get('from_location') or b.get('pickup_location') or 'N/A'} → {b.get('to_location') or b.get('drop_location') or 'N/A'}",
            "amount": amount,
            "taxable_value": taxable,
            "gst_amount": gst,
            "cgst": round(gst / 2, 2),
            "sgst": round(gst / 2, 2),
            "tds_amount": tds,
            "invoice_no": f"INV-GST-{ref}" if inv_date else "—",
            "invoice_date": (inv_date or "")[:10] or "—",
            "refund_id": (rf.get("gateway_refund_id") or f"REF-{rf['id'][:8].upper()}") if rf else "—",
            "refund_date": ((rf.get("gateway_refund_at") or rf.get("approved_at") or "")[:10] or "—") if rf else "—",
            "refund_amount": rf["refundable_amount"] if rf else 0.0,
            "payment_status": b.get("payment_status") or "pending",
            "status": b.get("status") or "",
        })

    refunds = []
    approved = await db.refund_requests.find(
        {"status": "approved", "approved_at": {"$gte": start, "$lt": end}},
        {"_id": 0}).sort("approved_at", 1).to_list(1000)
    for r in approved:
        refunds.append({
            "refund_id": r.get("gateway_refund_id") or f"REF-{r['id'][:8].upper()}",
            "booking_id": r.get("booking_ref"),
            "refund_type": r.get("refund_type"),
            "initiated_by": r.get("initiated_by"),
            "amount_paid": r.get("amount_paid", 0),
            "deduction_pct": r.get("deduction_pct", 0),
            "refund_amount": r.get("refundable_amount", 0),
            "refund_date": (r.get("gateway_refund_at") or r.get("approved_at") or "")[:10],
            "gateway_status": "processed" if r.get("gateway_refund_id") else ("manual" if r.get("manual_processed") else "pending_gateway"),
        })

    summary = {
        "month": month,
        "total_bookings": len(rows),
        "total_amount": round(sum(r["amount"] for r in rows), 2),
        "total_taxable": round(sum(r["taxable_value"] for r in rows), 2),
        "total_gst": round(sum(r["gst_amount"] for r in rows), 2),
        "total_tds": round(sum(r["tds_amount"] for r in rows), 2),
        "total_refunds": len(refunds),
        "total_refund_amount": round(sum(r["refund_amount"] for r in refunds), 2),
        "gst_rate": GST_RATE,
        "tds_rate": TDS_RATE,
    }
    return rows, refunds, summary


@router.get("/monthly")
async def monthly_report(month: str, user: dict = Depends(get_current_user)):
    """JSON preview: month = YYYY-MM"""
    _require_access(user)
    db = get_database()
    rows, refunds, summary = await _collect(db, month)
    return {"summary": summary, "bookings": rows, "refunds": refunds}


BOOKING_HEADERS = ["Client Name", "Booking ID", "Booking Date", "Travel Date", "Route",
                   "Amount (₹)", "Taxable Value (₹)", f"GST @{GST_RATE:.0f}% (₹)", "CGST (₹)", "SGST (₹)",
                   f"TDS @{TDS_RATE:.0f}% (₹)", "Invoice No", "Invoice Date", "Refund ID", "Refund Date",
                   "Refund Amount (₹)", "Payment Status", "Booking Status"]
BOOKING_KEYS = ["client_name", "booking_id", "booking_date", "travel_date", "route", "amount",
                "taxable_value", "gst_amount", "cgst", "sgst", "tds_amount", "invoice_no",
                "invoice_date", "refund_id", "refund_date", "refund_amount", "payment_status", "status"]
REFUND_HEADERS = ["Refund ID", "Booking ID", "Type", "Initiated By", "Amount Paid (₹)",
                  "Deduction %", "Refund Amount (₹)", "Refund Date", "Gateway Status"]
REFUND_KEYS = ["refund_id", "booking_id", "refund_type", "initiated_by", "amount_paid",
               "deduction_pct", "refund_amount", "refund_date", "gateway_status"]


def _build_xlsx(rows, refunds, summary):
    from openpyxl import Workbook
    from openpyxl.styles import Font, PatternFill
    wb = Workbook()
    head_font = Font(bold=True, color="FFFFFF")
    head_fill = PatternFill("solid", fgColor="F97316")

    ws = wb.active
    ws.title = "Bookings GST-TDS"
    ws.append([f"AirYatra GST/TDS Report — {summary['month']} (GST @{GST_RATE:.0f}%, TDS @{TDS_RATE:.0f}%)"])
    ws["A1"].font = Font(bold=True, size=13)
    ws.append([])
    ws.append(BOOKING_HEADERS)
    for c in ws[3]:
        c.font, c.fill = head_font, head_fill
    for r in rows:
        ws.append([r[k] for k in BOOKING_KEYS])
    ws.append([])
    ws.append(["TOTALS", "", "", "", "", summary["total_amount"], summary["total_taxable"],
               summary["total_gst"], round(summary["total_gst"] / 2, 2), round(summary["total_gst"] / 2, 2),
               summary["total_tds"], "", "", "", "", summary["total_refund_amount"], "", ""])
    ws[ws.max_row][0].font = Font(bold=True)
    for i, w in enumerate([22, 20, 12, 12, 28, 13, 15, 13, 11, 11, 12, 22, 12, 20, 12, 15, 14, 16], start=1):
        ws.column_dimensions[ws.cell(row=3, column=i).column_letter].width = w

    ws2 = wb.create_sheet("Refunds")
    ws2.append([f"Refunds Approved — {summary['month']}"])
    ws2["A1"].font = Font(bold=True, size=13)
    ws2.append([])
    ws2.append(REFUND_HEADERS)
    for c in ws2[3]:
        c.font, c.fill = head_font, head_fill
    for r in refunds:
        ws2.append([r[k] for k in REFUND_KEYS])
    ws2.append([])
    ws2.append(["TOTAL", "", "", "", "", "", summary["total_refund_amount"], "", ""])
    ws2[ws2.max_row][0].font = Font(bold=True)
    for i, w in enumerate([22, 20, 12, 16, 15, 12, 16, 12, 15], start=1):
        ws2.column_dimensions[ws2.cell(row=3, column=i).column_letter].width = w

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return buf


def _build_pdf(rows, refunds, summary):
    from reportlab.lib.pagesizes import A4, landscape
    from reportlab.lib import colors
    from reportlab.lib.styles import getSampleStyleSheet
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=landscape(A4), leftMargin=16, rightMargin=16, topMargin=20, bottomMargin=20)
    styles = getSampleStyleSheet()
    elems = [Paragraph(f"AirYatra GST/TDS Report — {summary['month']}", styles["Title"]),
             Paragraph(f"Bookings: {summary['total_bookings']} | Total: ₹{summary['total_amount']:,.0f} | "
                       f"Taxable: ₹{summary['total_taxable']:,.0f} | GST @{GST_RATE:.0f}%: ₹{summary['total_gst']:,.0f} | "
                       f"TDS @{TDS_RATE:.0f}%: ₹{summary['total_tds']:,.0f} | Refunds: {summary['total_refunds']} "
                       f"(₹{summary['total_refund_amount']:,.0f})", styles["Normal"]),
             Spacer(1, 10)]
    pdf_headers = ["Client", "Booking ID", "Bkg Date", "Travel", "Amount", "Taxable", "GST", "TDS",
                   "Invoice No", "Inv Date", "Refund ID", "Ref Date", "Ref Amt", "Pay Status"]
    pdf_keys = ["client_name", "booking_id", "booking_date", "travel_date", "amount", "taxable_value",
                "gst_amount", "tds_amount", "invoice_no", "invoice_date", "refund_id", "refund_date",
                "refund_amount", "payment_status"]
    data = [pdf_headers]
    for r in rows:
        data.append([str(r[k])[:22] if isinstance(r[k], str) else f"{r[k]:,.0f}" for k in pdf_keys])
    data.append(["TOTAL", "", "", "", f"{summary['total_amount']:,.0f}", f"{summary['total_taxable']:,.0f}",
                 f"{summary['total_gst']:,.0f}", f"{summary['total_tds']:,.0f}", "", "", "", "",
                 f"{summary['total_refund_amount']:,.0f}", ""])
    t = Table(data, repeatRows=1)
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f97316")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTSIZE", (0, 0), (-1, -1), 6.2),
        ("GRID", (0, 0), (-1, -1), 0.4, colors.grey),
        ("ROWBACKGROUNDS", (0, 1), (-1, -2), [colors.white, colors.HexColor("#fff7ed")]),
        ("BACKGROUND", (0, -1), (-1, -1), colors.HexColor("#fde68a")),
        ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
    ]))
    elems.append(t)
    if refunds:
        elems += [Spacer(1, 14), Paragraph("Refunds Approved This Month", styles["Heading2"])]
        rdata = [REFUND_HEADERS]
        for r in refunds:
            rdata.append([str(r[k])[:24] if isinstance(r[k], str) else f"{r[k]:,.0f}" for k in REFUND_KEYS])
        rt = Table(rdata, repeatRows=1)
        rt.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#ef4444")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTSIZE", (0, 0), (-1, -1), 7),
            ("GRID", (0, 0), (-1, -1), 0.4, colors.grey),
        ]))
        elems.append(rt)
    doc.build(elems)
    buf.seek(0)
    return buf


@router.get("/monthly/export")
async def export_monthly_report(month: str, format: str = "xlsx", user: dict = Depends(get_current_user)):
    """Download Excel/PDF: month=YYYY-MM, format=xlsx|pdf"""
    _require_access(user)
    if format not in ("xlsx", "pdf"):
        raise HTTPException(status_code=400, detail="format must be xlsx or pdf")
    db = get_database()
    rows, refunds, summary = await _collect(db, month)
    if format == "pdf":
        buf = _build_pdf(rows, refunds, summary)
        media, ext = "application/pdf", "pdf"
    else:
        buf = _build_xlsx(rows, refunds, summary)
        media, ext = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "xlsx"
    fname = f"AirYatra_GST_TDS_Report_{month}.{ext}"
    return StreamingResponse(buf, media_type=media,
                             headers={"Content-Disposition": f'attachment; filename="{fname}"'})
