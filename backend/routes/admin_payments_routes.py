"""
Admin Payments Dashboard API
Shows daily collections, pending balances, and payment history for admins
"""
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from fastapi.responses import Response
from datetime import datetime, timezone, timedelta
from uuid import uuid4
from database import get_database
from middleware import get_current_user
import csv
import io

router = APIRouter(prefix="/admin/payments", tags=["Admin Payments"])


def _require_admin(user: dict):
    """Check if user is admin or super_admin"""
    roles = user.get("roles", [])
    if not any(r in ["admin", "super_admin"] for r in roles):
        raise HTTPException(status_code=403, detail="Admin access required")


@router.get("/dashboard")
async def get_payments_dashboard(
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """Get admin payments dashboard with KPIs, daily collections, pending balances"""
    _require_admin(current_user)
    
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today_start - timedelta(days=7)
    month_start = today_start.replace(day=1)
    
    # Get all paid transactions
    all_paid = await db.payment_transactions.find(
        {"payment_status": "paid"},
        {"_id": 0}
    ).to_list(10000)
    
    # Today's collections
    today_paid = [
        t for t in all_paid
        if t.get("updated_at", "")[:10] == today_start.strftime("%Y-%m-%d")
    ]
    today_total = sum(float(t.get("amount", 0)) for t in today_paid)
    today_count = len(today_paid)
    
    # This week's collections
    week_paid = [
        t for t in all_paid
        if t.get("updated_at", "")[:10] >= week_start.strftime("%Y-%m-%d")
    ]
    week_total = sum(float(t.get("amount", 0)) for t in week_paid)
    
    # This month's collections
    month_paid = [
        t for t in all_paid
        if t.get("updated_at", "")[:7] == month_start.strftime("%Y-%m")
    ]
    month_total = sum(float(t.get("amount", 0)) for t in month_paid)
    
    # Total all-time collections
    all_time_total = sum(float(t.get("amount", 0)) for t in all_paid)
    
    # Get bookings/inquiries with pending balances (paid but not fully_paid)
    pending_balance_bookings = await db.inquiries.find(
        {"payment_status": "paid"},  # Has paid advance but not fully_paid
        {"_id": 0, "id": 1, "inquiry_number": 1, "customer_name": 1, "customer_email": 1,
         "payment_status": 1, "accepted_quote": 1, "estimated_price": 1, "from_location": 1, 
         "to_location": 1, "departure_date": 1}
    ).to_list(500)
    
    # Calculate remaining balance for each
    pending_balances = []
    total_pending = 0.0
    
    for booking in pending_balance_bookings:
        total_amount = float(booking.get("accepted_quote", {}).get("amount") or booking.get("estimated_price") or 0)
        if total_amount <= 0:
            continue
            
        # Get paid transactions for this booking
        txns = await db.payment_transactions.find(
            {"booking_id": booking["id"], "payment_status": "paid"},
            {"_id": 0, "amount": 1, "voucher_discount": 1}
        ).to_list(10)
        
        credited = sum(float(t.get("amount", 0)) + float(t.get("voucher_discount", 0)) for t in txns)
        remaining = max(0.0, round(total_amount - credited, 2))
        
        if remaining > 0:
            pending_balances.append({
                "booking_id": booking["id"],
                "inquiry_number": booking.get("inquiry_number", ""),
                "customer_name": booking.get("customer_name", ""),
                "customer_email": booking.get("customer_email", ""),
                "route": f"{booking.get('from_location', '')} → {booking.get('to_location', '')}",
                "departure_date": booking.get("departure_date", ""),
                "total_amount": total_amount,
                "paid": round(credited, 2),
                "remaining": remaining,
            })
            total_pending += remaining
    
    # Get recent transactions (last 50)
    recent_txns = await db.payment_transactions.find(
        {"payment_status": "paid"},
        {"_id": 0}
    ).sort("updated_at", -1).limit(50).to_list(50)
    
    # Enrich with customer and booking info
    enriched_txns = []
    for txn in recent_txns:
        customer = await db.users.find_one(
            {"id": txn.get("customer_id")},
            {"_id": 0, "full_name": 1, "email": 1}
        )
        booking = await db.inquiries.find_one(
            {"id": txn.get("booking_id")},
            {"_id": 0, "inquiry_number": 1, "from_location": 1, "to_location": 1}
        ) or {}
        
        enriched_txns.append({
            "id": txn.get("id"),
            "session_id": txn.get("session_id"),
            "booking_id": txn.get("booking_id"),
            "inquiry_number": booking.get("inquiry_number", txn.get("booking_id", "")[:8]),
            "customer_name": (customer or {}).get("full_name", "Unknown"),
            "customer_email": (customer or {}).get("email", ""),
            "route": f"{booking.get('from_location', '')} → {booking.get('to_location', '')}",
            "payment_type": txn.get("payment_type", "advance"),
            "amount": txn.get("amount", 0),
            "voucher_discount": txn.get("voucher_discount", 0),
            "gateway": txn.get("gateway", "stripe_test"),
            "paid_at": txn.get("updated_at", ""),
        })
    
    # Daily breakdown for last 7 days (for chart)
    daily_breakdown = []
    for i in range(7):
        day = today_start - timedelta(days=i)
        day_str = day.strftime("%Y-%m-%d")
        day_txns = [t for t in all_paid if t.get("updated_at", "")[:10] == day_str]
        daily_breakdown.append({
            "date": day_str,
            "label": day.strftime("%d %b"),
            "amount": sum(float(t.get("amount", 0)) for t in day_txns),
            "count": len(day_txns),
        })
    daily_breakdown.reverse()  # Oldest to newest
    
    return {
        "kpis": {
            "today_total": round(today_total, 2),
            "today_count": today_count,
            "week_total": round(week_total, 2),
            "month_total": round(month_total, 2),
            "all_time_total": round(all_time_total, 2),
            "pending_balance_total": round(total_pending, 2),
            "pending_balance_count": len(pending_balances),
        },
        "pending_balances": pending_balances[:20],  # Top 20
        "recent_transactions": enriched_txns,
        "daily_breakdown": daily_breakdown,
    }


@router.get("/transactions")
async def get_all_transactions(
    page: int = 1,
    limit: int = 50,
    status: str = None,
    payment_type: str = None,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """Get paginated payment transactions with filters"""
    _require_admin(current_user)
    
    query = {}
    if status:
        query["payment_status"] = status
    if payment_type:
        query["payment_type"] = payment_type
    
    total = await db.payment_transactions.count_documents(query)
    skip = (page - 1) * limit
    
    txns = await db.payment_transactions.find(
        query, {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    # Enrich with customer info
    enriched = []
    for txn in txns:
        customer = await db.users.find_one(
            {"id": txn.get("customer_id")},
            {"_id": 0, "full_name": 1, "email": 1}
        )
        enriched.append({
            **txn,
            "customer_name": (customer or {}).get("full_name", "Unknown"),
            "customer_email": (customer or {}).get("email", ""),
        })
    
    return {
        "transactions": enriched,
        "total": total,
        "page": page,
        "limit": limit,
        "pages": (total + limit - 1) // limit,
    }


# ==================== QUICK PAYMENT LINK ====================

@router.post("/generate-payment-link/{booking_id}")
async def generate_payment_link(
    booking_id: str,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """Generate a shareable payment link for balance collection (Admin only)"""
    _require_admin(current_user)
    
    # Find booking/inquiry
    booking = await db.inquiries.find_one({"id": booking_id}, {"_id": 0})
    if not booking:
        booking = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    # Check if balance is pending
    if booking.get("payment_status") == "fully_paid":
        raise HTTPException(status_code=400, detail="Already fully paid")
    if booking.get("payment_status") != "paid":
        raise HTTPException(status_code=400, detail="Advance payment not yet done")
    
    # Calculate remaining balance
    total_amount = float(booking.get("accepted_quote", {}).get("amount") or booking.get("estimated_price") or 0)
    txns = await db.payment_transactions.find(
        {"booking_id": booking_id, "payment_status": "paid"},
        {"_id": 0, "amount": 1, "voucher_discount": 1}
    ).to_list(10)
    credited = sum(float(t.get("amount", 0)) + float(t.get("voucher_discount", 0)) for t in txns)
    remaining = max(0.0, round(total_amount - credited, 2))
    
    if remaining <= 0:
        raise HTTPException(status_code=400, detail="No balance remaining")
    
    # Generate unique payment token
    payment_token = str(uuid4())[:12].upper()
    
    # Store payment link in DB
    await db.payment_links.insert_one({
        "id": str(uuid4()),
        "token": payment_token,
        "booking_id": booking_id,
        "customer_id": booking.get("customer_id"),
        "amount": remaining,
        "status": "active",
        "created_by": current_user["id"],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
    })
    
    # Generate shareable links
    base_url = "https://airyatra.co.in"  # Will be replaced with actual domain
    payment_url = f"{base_url}/pay/{payment_token}"
    
    customer_name = booking.get("customer_name", "Customer")
    route = f"{booking.get('from_location', '')} → {booking.get('to_location', '')}"
    inquiry_number = booking.get("inquiry_number", booking_id[:8])
    
    # WhatsApp message template
    whatsapp_msg = f"""🚁 *AirYatra Payment Reminder*

Namaste {customer_name}! 🙏

Aapki helicopter booking *#{inquiry_number}* ke liye remaining balance due hai:

📍 Route: {route}
💰 Amount Due: ₹{remaining:,.0f}

👉 Pay securely: {payment_url}

Payment link 7 days tak valid hai.

Questions? Reply to this message or call us.

Thank you for choosing AirYatra! ✈️"""
    
    # URL encode the message for WhatsApp
    import urllib.parse
    encoded_msg = urllib.parse.quote(whatsapp_msg)
    whatsapp_url = f"https://wa.me/?text={encoded_msg}"
    
    return {
        "success": True,
        "payment_url": payment_url,
        "token": payment_token,
        "amount": remaining,
        "booking_id": booking_id,
        "inquiry_number": inquiry_number,
        "customer_name": customer_name,
        "route": route,
        "whatsapp_url": whatsapp_url,
        "whatsapp_message": whatsapp_msg,
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
    }


@router.get("/payment-link-qr/{token}")
async def get_payment_link_qr(
    token: str,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """Generate QR code for payment link (Admin only)"""
    _require_admin(current_user)
    
    # Verify payment link exists
    payment_link = await db.payment_links.find_one(
        {"token": token},
        {"_id": 0}
    )
    
    if not payment_link:
        raise HTTPException(status_code=404, detail="Payment link not found")
    
    # Generate QR code
    import qrcode
    from io import BytesIO
    
    payment_url = f"https://airyatra.co.in/pay/{token}"
    
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_H,
        box_size=10,
        border=4,
    )
    qr.add_data(payment_url)
    qr.make(fit=True)
    
    # Create image with orange color
    img = qr.make_image(fill_color="#f97316", back_color="white")
    
    # Save to bytes
    buffer = BytesIO()
    img.save(buffer, format='PNG')
    buffer.seek(0)
    
    return Response(
        content=buffer.getvalue(),
        media_type="image/png",
        headers={"Content-Disposition": f'inline; filename="AirYatra_Payment_QR_{token}.png"'}
    )


# ==================== BALANCE REMINDER EMAILS ====================

async def _send_balance_reminder_email(db, booking: dict, remaining: float):
    """Send balance reminder email to customer"""
    try:
        customer = await db.users.find_one(
            {"id": booking.get("customer_id")},
            {"_id": 0, "email": 1, "full_name": 1}
        )
        if not customer or not customer.get("email"):
            return {"success": False, "error": "Customer email not found"}
        
        from services.email_service import email_service
        
        customer_name = customer.get("full_name", "Customer")
        inquiry_number = booking.get("inquiry_number", booking.get("id", "")[:8])
        route = f"{booking.get('from_location', '')} → {booking.get('to_location', '')}"
        departure_date = booking.get("departure_date", "")
        
        subject = f"⏰ Payment Reminder - ₹{remaining:,.0f} Balance Due | Booking #{inquiry_number}"
        
        html_body = f"""
<!DOCTYPE html>
<html>
<head>
    <style>
        body {{ font-family: 'Segoe UI', Arial, sans-serif; background: #1a1a2e; color: #ffffff; margin: 0; padding: 20px; }}
        .container {{ max-width: 600px; margin: 0 auto; background: #16213e; border-radius: 16px; overflow: hidden; }}
        .header {{ background: linear-gradient(135deg, #f97316, #ea580c); padding: 30px; text-align: center; }}
        .content {{ padding: 30px; }}
        .amount-box {{ background: #1a1a2e; border-radius: 12px; padding: 25px; text-align: center; margin: 20px 0; border: 2px solid #f97316; }}
        .amount {{ font-size: 36px; font-weight: bold; color: #f97316; }}
        .info-row {{ display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #2a2a4e; }}
        .btn {{ display: inline-block; background: #22c55e; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; margin-top: 15px; }}
        .footer {{ background: #0f0f1e; padding: 20px; text-align: center; font-size: 12px; color: #64748b; }}
        .urgent {{ background: #fef3c7; color: #92400e; padding: 15px; border-radius: 8px; margin: 20px 0; }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div style="font-size:50px;">⏰</div>
            <h1 style="margin:10px 0 0;">Payment Reminder</h1>
            <p style="margin:5px 0 0; opacity:0.9;">Remaining Balance Due</p>
        </div>
        <div class="content">
            <p>Namaste <strong>{customer_name}</strong>,</p>
            <p>Aapki helicopter booking ke liye remaining balance due hai. Please complete your payment to confirm your flight.</p>
            
            <div class="amount-box">
                <p style="margin:0 0 10px; color:#94a3b8;">Balance Amount Due</p>
                <div class="amount">₹{remaining:,.0f}</div>
            </div>
            
            <div style="background:#1a1a2e; border-radius:12px; padding:20px; margin:15px 0;">
                <h3 style="margin-top:0; color:#f97316;">📋 Booking Details</h3>
                <div class="info-row">
                    <span style="color:#94a3b8;">Booking Ref:</span>
                    <span style="font-weight:600;">#{inquiry_number}</span>
                </div>
                <div class="info-row">
                    <span style="color:#94a3b8;">Route:</span>
                    <span style="font-weight:600;">{route}</span>
                </div>
                <div class="info-row">
                    <span style="color:#94a3b8;">Departure Date:</span>
                    <span style="font-weight:600;">{departure_date}</span>
                </div>
            </div>
            
            <div class="urgent">
                ⚠️ <strong>Important:</strong> Please complete payment before your departure date to avoid any last-minute issues.
            </div>
            
            <p style="text-align:center;">
                <a href="https://airyatra.co.in/customer/inquiries" class="btn">💳 Pay Now</a>
            </p>
            
            <p style="color:#94a3b8; font-size:13px; text-align:center; margin-top:20px;">
                Need help? Contact us at info@airyatra.co.in or reply to this email.
            </p>
        </div>
        <div class="footer">
            <p>AirYatra - India's Premium Helicopter Booking Platform</p>
            <p>© 2025 AirYatra Aviation Pvt. Ltd. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
"""
        
        result = await email_service.send_email(
            to_email=customer["email"],
            subject=subject,
            html_body=html_body
        )
        return result
    except Exception as e:
        return {"success": False, "error": str(e)}


@router.post("/send-balance-reminder/{booking_id}")
async def send_balance_reminder(
    booking_id: str,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """Send balance reminder email to customer (Admin only)"""
    _require_admin(current_user)
    
    # Find booking
    booking = await db.inquiries.find_one({"id": booking_id}, {"_id": 0})
    if not booking:
        booking = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    # Check balance
    if booking.get("payment_status") == "fully_paid":
        raise HTTPException(status_code=400, detail="Already fully paid")
    if booking.get("payment_status") != "paid":
        raise HTTPException(status_code=400, detail="Advance payment not yet done")
    
    # Calculate remaining
    total_amount = float(booking.get("accepted_quote", {}).get("amount") or booking.get("estimated_price") or 0)
    txns = await db.payment_transactions.find(
        {"booking_id": booking_id, "payment_status": "paid"},
        {"_id": 0, "amount": 1, "voucher_discount": 1}
    ).to_list(10)
    credited = sum(float(t.get("amount", 0)) + float(t.get("voucher_discount", 0)) for t in txns)
    remaining = max(0.0, round(total_amount - credited, 2))
    
    if remaining <= 0:
        raise HTTPException(status_code=400, detail="No balance remaining")
    
    # Send email
    result = await _send_balance_reminder_email(db, booking, remaining)
    
    # Log reminder
    await db.balance_reminders.insert_one({
        "id": str(uuid4()),
        "booking_id": booking_id,
        "customer_id": booking.get("customer_id"),
        "amount": remaining,
        "sent_by": current_user["id"],
        "sent_at": datetime.now(timezone.utc).isoformat(),
        "result": result,
    })
    
    return {
        "success": result.get("success", False),
        "message": "Reminder email sent successfully" if result.get("success") else f"Failed: {result.get('error', 'Unknown error')}",
        "customer_email": booking.get("customer_email"),
        "amount": remaining,
    }


# ==================== PAYMENT ANALYTICS EXPORT (CSV) ====================

@router.get("/export/csv")
async def export_payments_csv(
    start_date: str = None,  # YYYY-MM-DD
    end_date: str = None,    # YYYY-MM-DD
    report_type: str = "transactions",  # transactions, daily_summary, pending_balances
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """Export payment data as CSV for accounts team (Admin only)"""
    _require_admin(current_user)
    
    now = datetime.now(timezone.utc)
    
    # Default date range: last 30 days
    if not end_date:
        end_date = now.strftime("%Y-%m-%d")
    if not start_date:
        start_date = (now - timedelta(days=30)).strftime("%Y-%m-%d")
    
    output = io.StringIO()
    # UTF-8 BOM for Excel compatibility
    output.write('\ufeff')
    
    if report_type == "transactions":
        # All transactions in date range
        txns = await db.payment_transactions.find(
            {
                "payment_status": "paid",
                "updated_at": {"$gte": start_date, "$lte": end_date + "T23:59:59"}
            },
            {"_id": 0}
        ).sort("updated_at", -1).to_list(10000)
        
        writer = csv.writer(output)
        writer.writerow([
            "Date", "Transaction ID", "Booking Ref", "Customer Name", "Customer Email",
            "Route", "Payment Type", "Amount (INR)", "Voucher Discount", "Gateway", "Session ID"
        ])
        
        for txn in txns:
            customer = await db.users.find_one(
                {"id": txn.get("customer_id")},
                {"_id": 0, "full_name": 1, "email": 1}
            )
            booking = await db.inquiries.find_one(
                {"id": txn.get("booking_id")},
                {"_id": 0, "inquiry_number": 1, "from_location": 1, "to_location": 1}
            ) or {}
            
            writer.writerow([
                txn.get("updated_at", "")[:10],
                txn.get("id", "")[:8],
                booking.get("inquiry_number", txn.get("booking_id", "")[:8]),
                (customer or {}).get("full_name", ""),
                (customer or {}).get("email", ""),
                f"{booking.get('from_location', '')} → {booking.get('to_location', '')}",
                txn.get("payment_type", "advance").title(),
                txn.get("amount", 0),
                txn.get("voucher_discount", 0),
                txn.get("gateway", ""),
                txn.get("session_id", "")[:20],
            ])
        
        filename = f"AirYatra_Transactions_{start_date}_to_{end_date}.csv"
        
    elif report_type == "daily_summary":
        # Daily collection summary
        txns = await db.payment_transactions.find(
            {
                "payment_status": "paid",
                "updated_at": {"$gte": start_date, "$lte": end_date + "T23:59:59"}
            },
            {"_id": 0, "updated_at": 1, "amount": 1, "payment_type": 1}
        ).to_list(10000)
        
        # Aggregate by date
        daily_data = {}
        for txn in txns:
            date = txn.get("updated_at", "")[:10]
            if date not in daily_data:
                daily_data[date] = {"advance": 0, "balance": 0, "count": 0}
            daily_data[date]["count"] += 1
            if txn.get("payment_type") == "balance":
                daily_data[date]["balance"] += float(txn.get("amount", 0))
            else:
                daily_data[date]["advance"] += float(txn.get("amount", 0))
        
        writer = csv.writer(output)
        writer.writerow(["Date", "Advance Payments (INR)", "Balance Payments (INR)", "Total (INR)", "Transaction Count"])
        
        for date in sorted(daily_data.keys()):
            d = daily_data[date]
            writer.writerow([
                date,
                d["advance"],
                d["balance"],
                d["advance"] + d["balance"],
                d["count"]
            ])
        
        # Add totals row
        total_advance = sum(d["advance"] for d in daily_data.values())
        total_balance = sum(d["balance"] for d in daily_data.values())
        total_count = sum(d["count"] for d in daily_data.values())
        writer.writerow([])
        writer.writerow(["TOTAL", total_advance, total_balance, total_advance + total_balance, total_count])
        
        filename = f"AirYatra_DailySummary_{start_date}_to_{end_date}.csv"
        
    elif report_type == "pending_balances":
        # Pending balances report
        pending_bookings = await db.inquiries.find(
            {"payment_status": "paid"},
            {"_id": 0, "id": 1, "inquiry_number": 1, "customer_name": 1, "customer_email": 1,
             "accepted_quote": 1, "estimated_price": 1, "from_location": 1, "to_location": 1,
             "departure_date": 1, "customer_phone": 1}
        ).to_list(500)
        
        writer = csv.writer(output)
        writer.writerow([
            "Booking Ref", "Customer Name", "Customer Email", "Customer Phone",
            "Route", "Departure Date", "Total Amount", "Paid Amount", "Balance Due"
        ])
        
        total_pending = 0
        for booking in pending_bookings:
            total_amount = float(booking.get("accepted_quote", {}).get("amount") or booking.get("estimated_price") or 0)
            if total_amount <= 0:
                continue
            
            txns = await db.payment_transactions.find(
                {"booking_id": booking["id"], "payment_status": "paid"},
                {"_id": 0, "amount": 1, "voucher_discount": 1}
            ).to_list(10)
            credited = sum(float(t.get("amount", 0)) + float(t.get("voucher_discount", 0)) for t in txns)
            remaining = max(0.0, round(total_amount - credited, 2))
            
            if remaining > 0:
                writer.writerow([
                    booking.get("inquiry_number", booking["id"][:8]),
                    booking.get("customer_name", ""),
                    booking.get("customer_email", ""),
                    booking.get("customer_phone", ""),
                    f"{booking.get('from_location', '')} → {booking.get('to_location', '')}",
                    booking.get("departure_date", ""),
                    total_amount,
                    round(credited, 2),
                    remaining,
                ])
                total_pending += remaining
        
        writer.writerow([])
        writer.writerow(["", "", "", "", "", "TOTAL PENDING:", "", "", total_pending])
        
        filename = f"AirYatra_PendingBalances_{now.strftime('%Y%m%d')}.csv"
    
    else:
        raise HTTPException(status_code=400, detail="Invalid report_type. Use: transactions, daily_summary, pending_balances")
    
    csv_content = output.getvalue()
    output.close()
    
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )
