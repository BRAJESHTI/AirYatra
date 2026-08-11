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
    return result


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
