"""Auto-email PDF invoice to customer the moment a payment succeeds (all gateways)."""
import asyncio
import logging
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

GATEWAY_LABELS = {
    "razorpay": "Razorpay (Secure)",
    "stripe": "Stripe (Secure)",
    "cashfree": "Cashfree (Secure)",
    "paypal": "PayPal (Secure)",
    "wallet": "AirYatra Wallet",
}


def _stage(payment_status: str) -> str:
    return "full" if payment_status == "fully_paid" else "advance"


async def send_invoice_email(db, booking_id: str, gateway: str = "") -> dict:
    booking = await db.inquiries.find_one({"id": booking_id}, {"_id": 0}) or \
              await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not booking:
        return {"success": False, "error": "Booking not found"}

    stage = _stage(booking.get("payment_status") or "paid")
    key = f"{booking_id}:{stage}"

    # Atomic idempotency claim (verify endpoint + webhook can both fire)
    claim = await db.invoice_email_log.update_one(
        {"key": key},
        {"$setOnInsert": {
            "key": key, "booking_id": booking_id, "stage": stage, "gateway": gateway,
            "status": "sending", "created_at": datetime.now(timezone.utc).isoformat(),
        }},
        upsert=True,
    )
    if not claim.upserted_id:
        return {"success": True, "skipped": "invoice email already sent for this stage"}

    customer = await db.users.find_one({"id": booking.get("customer_id")}, {"_id": 0}) or {}
    to_email = customer.get("email") or booking.get("customer_email") or booking.get("email")
    if not to_email:
        await db.invoice_email_log.update_one({"key": key}, {"$set": {"status": "no_email"}})
        return {"success": False, "error": "No customer email"}

    if not customer:
        customer = {"full_name": booking.get("customer_name", "Customer"), "email": to_email}

    payment = await db.payment_transactions.find_one(
        {"booking_id": booking_id, "payment_status": "paid"},
        {"_id": 0}, sort=[("created_at", -1)],
    )

    from routes.customer_routes import _generate_invoice_pdf
    pdf_bytes = _generate_invoice_pdf(booking, customer, payment)
    if not pdf_bytes or not pdf_bytes.startswith(b"%PDF"):
        await db.invoice_email_log.update_one({"key": key}, {"$set": {"status": "pdf_failed"}})
        return {"success": False, "error": "Invoice PDF generation failed"}

    booking_ref = booking.get("booking_number") or booking.get("inquiry_number") or booking_id[:8]
    invoice_num = f"INV-{booking_ref}"
    customer_name = customer.get("full_name", "Customer")
    route = f"{booking.get('from_location', 'N/A')} → {booking.get('to_location', 'N/A')}"
    amount = float((payment or {}).get("amount") or booking.get("total_amount") or 0)
    gateway_label = GATEWAY_LABELS.get(gateway, gateway.title() or "Online")
    paid_at = datetime.now(timezone.utc).strftime("%d %b %Y, %H:%M UTC")
    stage_label = "Full Payment Received" if stage == "full" else "Advance Payment Received"

    subject = f"🧾 Your AirYatra Invoice {invoice_num} - Payment Successful"
    html_body = f"""
<!DOCTYPE html>
<html>
<head>
    <style>
        body {{ font-family: 'Segoe UI', Arial, sans-serif; background: #1a1a2e; color: #ffffff; margin: 0; padding: 20px; }}
        .container {{ max-width: 600px; margin: 0 auto; background: #16213e; border-radius: 16px; overflow: hidden; }}
        .header {{ background: linear-gradient(135deg, #f97316, #ea580c); padding: 30px; text-align: center; }}
        .content {{ padding: 30px; }}
        .invoice-box {{ background: #1a1a2e; border-radius: 12px; padding: 20px; margin: 15px 0; border: 2px dashed #f97316; }}
        .info-row {{ display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #2a2a4e; }}
        .info-row:last-child {{ border-bottom: none; }}
        .highlight {{ color: #f97316; font-weight: 600; }}
        .amount {{ font-size: 28px; font-weight: bold; color: #22c55e; }}
        .footer {{ background: #0f0f1e; padding: 20px; text-align: center; font-size: 12px; color: #64748b; }}
        .btn {{ display: inline-block; background: #f97316; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin-top: 15px; }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div style="font-size:50px;">🧾</div>
            <h1 style="margin:10px 0 0;">Invoice Ready!</h1>
            <p style="margin:5px 0 0; opacity:0.9;">{stage_label}</p>
        </div>
        <div class="content">
            <p>Namaste <strong>{customer_name}</strong>,</p>
            <p>Aapka payment successfully receive ho gaya hai. Aapka <strong>Tax Invoice PDF</strong> is email ke saath attached hai — download link dhundhne ki zaroorat nahi!</p>

            <div class="invoice-box">
                <h3 style="margin-top:0; color:#f97316; text-align:center;">📄 Invoice Details</h3>
                <div class="info-row">
                    <span style="color:#94a3b8;">Invoice No:</span>
                    <span class="highlight">{invoice_num}</span>
                </div>
                <div class="info-row">
                    <span style="color:#94a3b8;">Booking Ref:</span>
                    <span style="font-weight:600;">{booking_ref}</span>
                </div>
                <div class="info-row">
                    <span style="color:#94a3b8;">Route:</span>
                    <span style="font-weight:600;">{route}</span>
                </div>
                <div class="info-row">
                    <span style="color:#94a3b8;">Amount Paid:</span>
                    <span class="amount">₹{amount:,.0f}</span>
                </div>
                <div class="info-row">
                    <span style="color:#94a3b8;">Payment Gateway:</span>
                    <span style="font-weight:600;">{gateway_label}</span>
                </div>
                <div class="info-row">
                    <span style="color:#94a3b8;">Date & Time:</span>
                    <span style="font-weight:600;">{paid_at}</span>
                </div>
            </div>

            <p style="color:#fbbf24; font-size:14px; background:#422006; padding:15px; border-radius:8px; margin-top:20px;">
                📎 <strong>Invoice PDF attached</strong> - Apne records aur tax purposes ke liye save kar lein.
            </p>

            <p style="text-align:center;">
                <a href="https://airyatra.co.in/customer/inquiries" class="btn">View My Bookings</a>
            </p>
        </div>
        <div class="footer">
            <p>AirYatra - India's Premium Helicopter Booking Platform</p>
            <p>📞 Support: info@airyatra.co.in</p>
            <p>© 2026 AirYatra Aviation Pvt. Ltd. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
"""

    from services.email_service import email_service
    result = await email_service.send_email(
        to_email=to_email,
        subject=subject,
        html_body=html_body,
        attachments=[{"filename": f"AirYatra_Invoice_{booking_ref}.pdf", "content": pdf_bytes}],
    )

    await db.invoice_email_log.update_one(
        {"key": key},
        {"$set": {
            "status": "sent" if result.get("success") else "failed",
            "to_email": to_email,
            "error": result.get("error"),
            "sent_at": datetime.now(timezone.utc).isoformat(),
        }},
    )
    if result.get("success"):
        logger.info(f"Invoice email sent to {to_email} for booking {booking_id} ({stage}, {gateway})")
    else:
        logger.error(f"Invoice email FAILED for booking {booking_id}: {result.get('error')}")

    # Corporate booking? Auto-email GST invoice to corporate admin too
    try:
        await _send_corporate_gst_email(db, booking, booking_id, stage, to_email)
    except Exception as e:
        logger.error(f"Corporate GST invoice email failed for {booking_id}: {e}")

    return result


async def _send_corporate_gst_email(db, booking: dict, booking_id: str, stage: str, customer_email: str = None):
    corp = None
    if booking.get("corporate_id"):
        corp = await db.corporates.find_one({"corporate_id": booking["corporate_id"]}, {"_id": 0})
    if not corp and customer_email:
        corp = await db.corporates.find_one({"admin_email": customer_email}, {"_id": 0})
        if not corp:
            emp = await db.corporate_employees.find_one({"email": customer_email, "is_active": True}, {"_id": 0})
            if emp:
                corp = await db.corporates.find_one({"corporate_id": emp["corporate_id"]}, {"_id": 0})
    if not corp or not corp.get("admin_email") or not corp.get("gst_number"):
        return

    key = f"{booking_id}:{stage}:corp"
    claim = await db.invoice_email_log.update_one(
        {"key": key},
        {"$setOnInsert": {
            "key": key, "booking_id": booking_id, "stage": stage, "type": "corporate_gst",
            "corporate_id": corp.get("corporate_id"), "status": "sending",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }},
        upsert=True,
    )
    if not claim.upserted_id:
        return

    booking_ref = booking.get("booking_number") or booking.get("inquiry_number") or booking_id[:8]
    total = booking.get("pricing", {}).get("total_amount") or booking.get("final_price") or booking.get("total_amount") or 0
    invoice_data = {
        "invoice_number": f"INV-GST-{booking_ref}",
        "place_of_supply": corp.get("state", "Maharashtra"),
        "is_interstate": False,
        "amount_in_words": f"Rupees {int(float(total)):,} Only",
    }
    from routes.corporate_routes import _generate_gst_invoice_pdf
    pdf_bytes = _generate_gst_invoice_pdf(corp, booking, invoice_data)
    if not pdf_bytes or not pdf_bytes.startswith(b"%PDF"):
        await db.invoice_email_log.update_one({"key": key}, {"$set": {"status": "pdf_failed"}})
        return

    route = f"{booking.get('from_location', 'N/A')} → {booking.get('to_location', 'N/A')}"
    html_body = f"""
<!DOCTYPE html>
<html><body style="font-family:'Segoe UI',Arial,sans-serif;background:#0f172a;color:#fff;margin:0;padding:20px;">
  <div style="max-width:600px;margin:0 auto;background:#1e293b;border-radius:16px;overflow:hidden;">
    <div style="background:linear-gradient(135deg,#2563eb,#1d4ed8);padding:28px;text-align:center;">
      <div style="font-size:44px;">🏢</div>
      <h1 style="margin:8px 0 0;">GST Invoice Ready</h1>
      <p style="margin:4px 0 0;opacity:0.9;">Corporate Booking Payment Received</p>
    </div>
    <div style="padding:28px;">
      <p>Dear <strong>{corp.get('company_name')}</strong> Admin,</p>
      <p>Aapki company booking ka payment successfully receive hua hai. GST-compliant Tax Invoice is email ke saath attached hai.</p>
      <table style="width:100%;border-collapse:collapse;margin:14px 0;">
        <tr><td style="padding:8px 0;color:#94a3b8;">Invoice No:</td><td style="text-align:right;color:#60a5fa;font-weight:600;">{invoice_data['invoice_number']}</td></tr>
        <tr><td style="padding:8px 0;color:#94a3b8;">Booking Ref:</td><td style="text-align:right;font-weight:600;">{booking_ref}</td></tr>
        <tr><td style="padding:8px 0;color:#94a3b8;">Route:</td><td style="text-align:right;font-weight:600;">{route}</td></tr>
        <tr><td style="padding:8px 0;color:#94a3b8;">GSTIN:</td><td style="text-align:right;font-weight:600;">{corp.get('gst_number')}</td></tr>
        <tr><td style="padding:8px 0;color:#94a3b8;">Amount:</td><td style="text-align:right;color:#22c55e;font-size:20px;font-weight:bold;">₹{float(total):,.0f}</td></tr>
      </table>
      <p style="color:#93c5fd;font-size:13px;background:#1e3a8a33;padding:12px;border-radius:8px;">📎 GST Invoice PDF attached — input tax credit claim ke liye save karein.</p>
    </div>
    <div style="background:#0f172a;padding:16px;text-align:center;font-size:12px;color:#64748b;">
      <p>AirYatra Corporate • info@airyatra.co.in</p>
    </div>
  </div>
</body></html>
"""
    from services.email_service import email_service
    result = await email_service.send_email(
        to_email=corp["admin_email"],
        subject=f"🏢 GST Invoice {invoice_data['invoice_number']} - {corp.get('company_name')} | AirYatra",
        html_body=html_body,
        attachments=[{"filename": f"AirYatra_GST_Invoice_{booking_ref}.pdf", "content": pdf_bytes}],
    )
    await db.invoice_email_log.update_one(
        {"key": key},
        {"$set": {"status": "sent" if result.get("success") else "failed",
                  "to_email": corp["admin_email"], "error": result.get("error"),
                  "sent_at": datetime.now(timezone.utc).isoformat()}},
    )
    if result.get("success"):
        logger.info(f"Corporate GST invoice emailed to {corp['admin_email']} for booking {booking_id}")


def schedule_invoice_email(db, booking_id: str, gateway: str = ""):
    """Fire-and-forget so payment API response is never delayed by SMTP."""
    async def _run():
        try:
            await send_invoice_email(db, booking_id, gateway)
        except Exception as e:
            logger.error(f"Invoice email task crashed for booking {booking_id}: {e}")
    try:
        asyncio.create_task(_run())
    except RuntimeError:
        logger.error(f"No running event loop; invoice email skipped for {booking_id}")
