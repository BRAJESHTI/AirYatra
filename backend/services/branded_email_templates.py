"""
AirYatra Branded Email Templates
Premium Dark Theme with Orange Accents
Mobile-Responsive Design
"""

from datetime import datetime
from typing import Dict, Any, Optional

# ==================== BASE TEMPLATE ====================

def get_base_template(theme: str = "dark") -> str:
    """Get base email template with theme support"""
    
    if theme == "light":
        return """
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Arial, sans-serif; 
            background: #f8fafc; 
            color: #1e293b; 
            margin: 0; 
            padding: 40px 20px;
            min-height: 100vh;
        }
        .container { 
            max-width: 600px; 
            margin: 0 auto; 
            background: #ffffff; 
            border-radius: 24px; 
            overflow: hidden;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.1);
            border: 1px solid #e2e8f0;
        }
        .header { 
            background: linear-gradient(135deg, #f97316 0%, #ea580c 50%, #c2410c 100%); 
            padding: 35px 30px;
            text-align: center;
            color: white;
        }
        .content { padding: 40px 30px; background: #ffffff; }
        .card { 
            background: #f8fafc; 
            border: 1px solid #e2e8f0; 
            border-radius: 16px; 
            padding: 20px; 
            margin-bottom: 20px;
        }
        .detail-row { 
            display: flex; 
            justify-content: space-between; 
            padding: 12px 0; 
            border-bottom: 1px solid #e2e8f0;
        }
        .detail-row:last-child { border-bottom: none; }
        .detail-label { color: #64748b; font-size: 14px; }
        .detail-value { color: #1e293b; font-weight: 600; font-size: 14px; }
        .cta-btn {
            display: inline-block;
            background: linear-gradient(135deg, #f97316 0%, #ea580c 100%);
            color: white;
            padding: 16px 40px;
            border-radius: 12px;
            text-decoration: none;
            font-weight: 700;
            font-size: 15px;
        }
        .footer { 
            background: #f1f5f9; 
            padding: 30px; 
            text-align: center; 
            border-top: 1px solid #e2e8f0;
            color: #64748b;
        }
        .highlight { color: #f97316; }
        .success { color: #22c55e; }
        .warning { color: #eab308; }
        .error { color: #ef4444; }
        """
    else:
        # Dark theme (default)
        return """
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Arial, sans-serif; 
            background: linear-gradient(180deg, #0f172a 0%, #1e293b 100%); 
            color: #f8fafc; 
            margin: 0; 
            padding: 40px 20px;
            min-height: 100vh;
        }
        .container { 
            max-width: 600px; 
            margin: 0 auto; 
            background: linear-gradient(145deg, #1e293b 0%, #0f172a 100%); 
            border-radius: 24px; 
            overflow: hidden;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
            border: 1px solid rgba(255, 255, 255, 0.1);
        }
        .header { 
            background: linear-gradient(135deg, #f97316 0%, #ea580c 50%, #c2410c 100%); 
            padding: 35px 30px;
            text-align: center;
            position: relative;
            overflow: hidden;
        }
        .header::before {
            content: '';
            position: absolute;
            top: -50%; left: -50%;
            width: 200%; height: 200%;
            background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 60%);
        }
        .logo-section {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 12px;
            margin-bottom: 15px;
            position: relative;
            z-index: 1;
        }
        .logo-icon {
            width: 50px; height: 50px;
            background: rgba(255,255,255,0.2);
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 28px;
        }
        .logo-text {
            font-size: 28px;
            font-weight: 800;
            letter-spacing: -0.5px;
            text-shadow: 0 2px 4px rgba(0,0,0,0.2);
            color: white;
        }
        .header-subtitle {
            font-size: 14px;
            opacity: 0.9;
            color: white;
            position: relative;
            z-index: 1;
        }
        .content { padding: 40px 30px; }
        .card { 
            background: rgba(30, 41, 59, 0.5); 
            border: 1px solid rgba(255, 255, 255, 0.1); 
            border-radius: 16px; 
            overflow: hidden;
            margin-bottom: 20px;
        }
        .card-header {
            background: rgba(249, 115, 22, 0.1);
            padding: 15px 20px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .card-header-icon {
            width: 32px; height: 32px;
            background: linear-gradient(135deg, #f97316, #ea580c);
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 16px;
        }
        .card-header-title {
            font-size: 16px;
            font-weight: 600;
            color: #f97316;
        }
        .card-body { padding: 5px 0; }
        .detail-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 14px 20px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        }
        .detail-row:last-child { border-bottom: none; }
        .detail-label { font-size: 14px; color: #94a3b8; }
        .detail-value { font-size: 14px; font-weight: 600; color: #f8fafc; }
        .cta-section { text-align: center; margin: 30px 0; }
        .cta-btn {
            display: inline-block;
            background: linear-gradient(135deg, #f97316 0%, #ea580c 100%);
            color: white;
            padding: 16px 40px;
            border-radius: 12px;
            text-decoration: none;
            font-weight: 700;
            font-size: 15px;
            letter-spacing: 0.5px;
            box-shadow: 0 10px 30px rgba(249, 115, 22, 0.3);
        }
        .info-box {
            background: rgba(59, 130, 246, 0.1);
            border: 1px solid rgba(59, 130, 246, 0.2);
            border-radius: 12px;
            padding: 16px 20px;
            font-size: 13px;
            color: #94a3b8;
            line-height: 1.6;
        }
        .footer {
            background: linear-gradient(180deg, rgba(15, 23, 42, 0.5) 0%, rgba(15, 23, 42, 0.8) 100%);
            padding: 30px;
            text-align: center;
            border-top: 1px solid rgba(255, 255, 255, 0.05);
        }
        .footer-logo { font-size: 20px; font-weight: 700; color: #f97316; margin-bottom: 10px; }
        .footer-tagline { font-size: 12px; color: #64748b; margin-bottom: 15px; }
        .footer-links { margin-bottom: 15px; }
        .footer-link { color: #94a3b8; text-decoration: none; font-size: 12px; margin: 0 10px; }
        .footer-copyright { font-size: 11px; color: #475569; }
        .highlight { color: #f97316; }
        .success { color: #22c55e; }
        .warning { color: #eab308; }
        .error { color: #ef4444; }
        .badge {
            display: inline-block;
            padding: 6px 16px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 700;
            letter-spacing: 0.5px;
        }
        .badge-success { background: rgba(34, 197, 94, 0.2); color: #22c55e; }
        .badge-warning { background: rgba(234, 179, 8, 0.2); color: #eab308; }
        .badge-error { background: rgba(239, 68, 68, 0.2); color: #ef4444; }
        .badge-info { background: rgba(59, 130, 246, 0.2); color: #3b82f6; }
        .big-icon { font-size: 48px; text-align: center; margin: 20px 0; }
        .price-display {
            font-size: 42px;
            font-weight: 800;
            color: #f97316;
            text-align: center;
            margin: 20px 0;
        }
        .price-label {
            font-size: 14px;
            color: #94a3b8;
            text-align: center;
        }
        @media only screen and (max-width: 600px) {
            body { padding: 20px 10px; }
            .container { border-radius: 16px; }
            .header { padding: 25px 20px; }
            .content { padding: 25px 20px; }
            .logo-text { font-size: 24px; }
            .detail-row { flex-direction: column; gap: 5px; align-items: flex-start; }
            .cta-btn { padding: 14px 30px; font-size: 14px; }
            .price-display { font-size: 36px; }
        }
        """


def get_email_header(title: str, subtitle: str = "India's Aviation Operating System", badge: str = None, badge_class: str = "badge-success") -> str:
    """Generate email header HTML"""
    badge_html = f'<div class="badge {badge_class}" style="margin-top: 15px;">{badge}</div>' if badge else ''
    return f"""
        <div class="header">
            <div class="logo-section">
                <div class="logo-icon">🚁</div>
                <span class="logo-text">AirYatra</span>
            </div>
            <div class="header-subtitle">{subtitle}</div>
            {badge_html}
        </div>
    """


def get_email_footer() -> str:
    """Generate email footer HTML"""
    return """
        <div class="footer">
            <div class="footer-logo">🚁 AirYatra</div>
            <div class="footer-tagline">Elevating India's Aviation Experience</div>
            <div class="footer-links">
                <a href="https://airyatra.co.in" class="footer-link">Website</a>
                <a href="https://airyatra.co.in/bookings" class="footer-link">My Bookings</a>
                <a href="https://airyatra.co.in/support" class="footer-link">Support</a>
                <a href="https://airyatra.co.in/contact" class="footer-link">Contact</a>
            </div>
            <div class="footer-copyright">
                © 2026 AirYatra Aviation Pvt Ltd. All rights reserved.<br>
                CIN: U62099MH2024PTC123456
            </div>
        </div>
    """


# ==================== EMAIL TEMPLATES ====================

def booking_confirmation_email(
    customer_name: str,
    booking_id: str,
    from_city: str,
    to_city: str,
    departure_date: str,
    departure_time: str,
    passenger_count: int,
    total_amount: str,
    payment_status: str = "Paid",
    aircraft_type: str = "Helicopter",
    operator_name: str = "AirYatra Partner",
    pnr: str = None,
    theme: str = "dark"
) -> Dict[str, str]:
    """Generate booking confirmation email"""
    
    subject = f"🚁 Booking Confirmed! #{booking_id} | {from_city} → {to_city} - AirYatra"
    
    html = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>{get_base_template(theme)}</style>
</head>
<body>
    <div class="container">
        {get_email_header("Booking Confirmed!", "Your helicopter journey awaits", "✅ CONFIRMED", "badge-success")}
        
        <div class="content">
            <p style="font-size: 16px; margin-bottom: 25px;">
                Namaste <strong class="highlight">{customer_name}</strong>! 🙏
            </p>
            <p style="color: #94a3b8; margin-bottom: 30px;">
                Your helicopter booking has been confirmed. Get ready for an amazing aerial experience!
            </p>
            
            <div class="big-icon">🎉</div>
            
            <!-- Flight Details Card -->
            <div class="card">
                <div class="card-header">
                    <div class="card-header-icon">✈️</div>
                    <span class="card-header-title">Flight Details</span>
                </div>
                <div class="card-body">
                    <div class="detail-row">
                        <span class="detail-label">Booking ID</span>
                        <span class="detail-value highlight">{booking_id}</span>
                    </div>
                    {f'<div class="detail-row"><span class="detail-label">PNR</span><span class="detail-value">{pnr}</span></div>' if pnr else ''}
                    <div class="detail-row">
                        <span class="detail-label">Route</span>
                        <span class="detail-value">{from_city} → {to_city}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Date</span>
                        <span class="detail-value">{departure_date}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Departure Time</span>
                        <span class="detail-value">{departure_time}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Passengers</span>
                        <span class="detail-value">{passenger_count} Pax</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Aircraft</span>
                        <span class="detail-value">{aircraft_type}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Operator</span>
                        <span class="detail-value">{operator_name}</span>
                    </div>
                </div>
            </div>
            
            <!-- Payment Card -->
            <div class="card">
                <div class="card-header">
                    <div class="card-header-icon">💰</div>
                    <span class="card-header-title">Payment Summary</span>
                </div>
                <div class="card-body">
                    <div class="price-display">₹{total_amount}</div>
                    <div class="price-label">Total Amount</div>
                    <div class="detail-row" style="margin-top: 15px;">
                        <span class="detail-label">Payment Status</span>
                        <span class="detail-value success">{payment_status}</span>
                    </div>
                </div>
            </div>
            
            <div class="cta-section">
                <a href="https://airyatra.co.in/bookings/{booking_id}" class="cta-btn">
                    View Booking Details →
                </a>
            </div>
            
            <div class="info-box">
                <strong>Important Instructions:</strong><br>
                • Please arrive at the helipad 30 minutes before departure<br>
                • Carry a valid government-issued photo ID (Aadhaar/Passport/DL)<br>
                • Maximum baggage allowed: 7 kg per passenger<br>
                • Weather conditions may affect flight timings
            </div>
        </div>
        
        {get_email_footer()}
    </div>
</body>
</html>
"""
    
    return {"subject": subject, "html": html}


def payment_receipt_email(
    customer_name: str,
    booking_id: str,
    transaction_id: str,
    amount: str,
    payment_method: str,
    payment_date: str,
    from_city: str,
    to_city: str,
    gst_amount: str = "0",
    invoice_number: str = None,
    theme: str = "dark"
) -> Dict[str, str]:
    """Generate payment receipt email"""
    
    subject = f"🧾 Payment Receipt | ₹{amount} | #{booking_id} - AirYatra"
    
    html = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>{get_base_template(theme)}</style>
</head>
<body>
    <div class="container">
        {get_email_header("Payment Successful!", "Thank you for your payment", "💳 PAID", "badge-success")}
        
        <div class="content">
            <p style="font-size: 16px; margin-bottom: 25px;">
                Namaste <strong class="highlight">{customer_name}</strong>! 🙏
            </p>
            <p style="color: #94a3b8; margin-bottom: 30px;">
                We have received your payment. Here's your official receipt.
            </p>
            
            <div class="big-icon">✅</div>
            
            <!-- Amount Display -->
            <div class="card" style="text-align: center; padding: 30px;">
                <div class="price-label">Amount Paid</div>
                <div class="price-display">₹{amount}</div>
                <div class="badge badge-success" style="margin-top: 10px;">PAYMENT SUCCESSFUL</div>
            </div>
            
            <!-- Transaction Details -->
            <div class="card">
                <div class="card-header">
                    <div class="card-header-icon">📋</div>
                    <span class="card-header-title">Transaction Details</span>
                </div>
                <div class="card-body">
                    <div class="detail-row">
                        <span class="detail-label">Transaction ID</span>
                        <span class="detail-value highlight">{transaction_id}</span>
                    </div>
                    {f'<div class="detail-row"><span class="detail-label">Invoice No.</span><span class="detail-value">{invoice_number}</span></div>' if invoice_number else ''}
                    <div class="detail-row">
                        <span class="detail-label">Booking ID</span>
                        <span class="detail-value">{booking_id}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Route</span>
                        <span class="detail-value">{from_city} → {to_city}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Payment Method</span>
                        <span class="detail-value">{payment_method}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Payment Date</span>
                        <span class="detail-value">{payment_date}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Base Amount</span>
                        <span class="detail-value">₹{float(amount.replace(",", "")) - float(gst_amount.replace(",", "")):,.2f}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">GST (18%)</span>
                        <span class="detail-value">₹{gst_amount}</span>
                    </div>
                    <div class="detail-row" style="border-top: 2px solid rgba(249, 115, 22, 0.3); margin-top: 10px; padding-top: 15px;">
                        <span class="detail-label" style="font-weight: 600;">Total Paid</span>
                        <span class="detail-value highlight" style="font-size: 18px;">₹{amount}</span>
                    </div>
                </div>
            </div>
            
            <div class="cta-section">
                <a href="https://airyatra.co.in/bookings/{booking_id}/invoice" class="cta-btn">
                    Download Invoice PDF →
                </a>
            </div>
            
            <div class="info-box">
                <strong>Note:</strong> This is a computer-generated receipt and does not require a signature. 
                For any queries related to this payment, please contact our support team with your Transaction ID.
            </div>
        </div>
        
        {get_email_footer()}
    </div>
</body>
</html>
"""
    
    return {"subject": subject, "html": html}


def flight_reminder_email(
    customer_name: str,
    booking_id: str,
    from_city: str,
    to_city: str,
    departure_date: str,
    departure_time: str,
    helipad_name: str,
    helipad_address: str,
    reporting_time: str,
    passenger_count: int,
    theme: str = "dark"
) -> Dict[str, str]:
    """Generate 24-hour flight reminder email"""
    
    subject = f"🔔 Flight Tomorrow! {from_city} → {to_city} | #{booking_id} - AirYatra"
    
    html = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>{get_base_template(theme)}</style>
</head>
<body>
    <div class="container">
        {get_email_header("Flight Reminder!", "Your flight is tomorrow", "⏰ 24 HOURS TO GO", "badge-warning")}
        
        <div class="content">
            <p style="font-size: 16px; margin-bottom: 25px;">
                Namaste <strong class="highlight">{customer_name}</strong>! 🙏
            </p>
            <p style="color: #94a3b8; margin-bottom: 30px;">
                This is a friendly reminder that your helicopter flight is scheduled for <strong>tomorrow</strong>!
            </p>
            
            <div class="big-icon">🚁</div>
            
            <!-- Flight Details -->
            <div class="card">
                <div class="card-header">
                    <div class="card-header-icon">✈️</div>
                    <span class="card-header-title">Flight Information</span>
                </div>
                <div class="card-body">
                    <div class="detail-row">
                        <span class="detail-label">Booking ID</span>
                        <span class="detail-value highlight">{booking_id}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Route</span>
                        <span class="detail-value">{from_city} → {to_city}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Date</span>
                        <span class="detail-value warning">{departure_date}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Departure Time</span>
                        <span class="detail-value" style="font-size: 18px;">{departure_time}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Reporting Time</span>
                        <span class="detail-value error">{reporting_time}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Passengers</span>
                        <span class="detail-value">{passenger_count} Pax</span>
                    </div>
                </div>
            </div>
            
            <!-- Helipad Location -->
            <div class="card">
                <div class="card-header">
                    <div class="card-header-icon">📍</div>
                    <span class="card-header-title">Departure Location</span>
                </div>
                <div class="card-body">
                    <div class="detail-row">
                        <span class="detail-label">Helipad</span>
                        <span class="detail-value">{helipad_name}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Address</span>
                        <span class="detail-value" style="max-width: 250px; text-align: right;">{helipad_address}</span>
                    </div>
                </div>
            </div>
            
            <div class="cta-section">
                <a href="https://maps.google.com/?q={helipad_address}" class="cta-btn">
                    Get Directions 📍
                </a>
            </div>
            
            <!-- Checklist -->
            <div class="card" style="background: rgba(34, 197, 94, 0.1); border-color: rgba(34, 197, 94, 0.3);">
                <div class="card-body" style="padding: 20px;">
                    <h4 style="color: #22c55e; margin-bottom: 15px;">✅ Pre-Flight Checklist</h4>
                    <ul style="color: #94a3b8; line-height: 2; padding-left: 20px;">
                        <li>Valid Government ID (Aadhaar/Passport/DL)</li>
                        <li>Booking confirmation (this email or app)</li>
                        <li>Arrive 30 minutes before departure</li>
                        <li>Maximum baggage: 7 kg per person</li>
                        <li>Wear comfortable clothing</li>
                        <li>Check weather updates</li>
                    </ul>
                </div>
            </div>
            
            <div class="info-box">
                <strong>Weather Advisory:</strong> Flight operations are subject to weather conditions. 
                In case of adverse weather, our team will contact you regarding rescheduling options.
                For any queries, call us at <strong class="highlight">1800-XXX-XXXX</strong> (Toll Free).
            </div>
        </div>
        
        {get_email_footer()}
    </div>
</body>
</html>
"""
    
    return {"subject": subject, "html": html}


def flight_rescheduled_email(
    customer_name: str,
    booking_id: str,
    from_city: str,
    to_city: str,
    old_date: str,
    old_time: str,
    new_date: str,
    new_time: str,
    reason: str = "Operational requirements",
    theme: str = "dark"
) -> Dict[str, str]:
    """Generate flight rescheduled notification email"""
    
    subject = f"📅 Flight Rescheduled | #{booking_id} | New: {new_date} - AirYatra"
    
    html = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>{get_base_template(theme)}</style>
</head>
<body>
    <div class="container">
        {get_email_header("Flight Rescheduled", "Important update about your booking", "📅 RESCHEDULED", "badge-warning")}
        
        <div class="content">
            <p style="font-size: 16px; margin-bottom: 25px;">
                Namaste <strong class="highlight">{customer_name}</strong>! 🙏
            </p>
            <p style="color: #94a3b8; margin-bottom: 30px;">
                We regret to inform you that your flight has been rescheduled. Please note the updated timings below.
            </p>
            
            <div class="big-icon">📅</div>
            
            <!-- Schedule Change Card -->
            <div class="card">
                <div class="card-header">
                    <div class="card-header-icon">🔄</div>
                    <span class="card-header-title">Schedule Update</span>
                </div>
                <div class="card-body">
                    <div class="detail-row">
                        <span class="detail-label">Booking ID</span>
                        <span class="detail-value highlight">{booking_id}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Route</span>
                        <span class="detail-value">{from_city} → {to_city}</span>
                    </div>
                </div>
            </div>
            
            <!-- Old vs New Schedule -->
            <div style="display: flex; gap: 15px; margin-bottom: 20px;">
                <div class="card" style="flex: 1; background: rgba(239, 68, 68, 0.1); border-color: rgba(239, 68, 68, 0.3);">
                    <div style="padding: 20px; text-align: center;">
                        <div style="font-size: 12px; color: #ef4444; margin-bottom: 10px;">❌ OLD SCHEDULE</div>
                        <div style="font-size: 18px; font-weight: 600; color: #94a3b8; text-decoration: line-through;">{old_date}</div>
                        <div style="font-size: 24px; font-weight: 700; color: #94a3b8; text-decoration: line-through;">{old_time}</div>
                    </div>
                </div>
                <div class="card" style="flex: 1; background: rgba(34, 197, 94, 0.1); border-color: rgba(34, 197, 94, 0.3);">
                    <div style="padding: 20px; text-align: center;">
                        <div style="font-size: 12px; color: #22c55e; margin-bottom: 10px;">✅ NEW SCHEDULE</div>
                        <div style="font-size: 18px; font-weight: 600; color: #22c55e;">{new_date}</div>
                        <div style="font-size: 24px; font-weight: 700; color: #22c55e;">{new_time}</div>
                    </div>
                </div>
            </div>
            
            <!-- Reason -->
            <div class="card">
                <div class="card-body" style="padding: 20px;">
                    <div class="detail-row" style="border: none;">
                        <span class="detail-label">Reason for Reschedule</span>
                        <span class="detail-value">{reason}</span>
                    </div>
                </div>
            </div>
            
            <div class="cta-section">
                <a href="https://airyatra.co.in/bookings/{booking_id}" class="cta-btn">
                    View Updated Booking →
                </a>
            </div>
            
            <div class="info-box">
                <strong>Not convenient?</strong> If the new schedule doesn't work for you, 
                you can request a different date or a full refund. Contact our support team 
                or use the "Request Change" option in your booking details.
            </div>
        </div>
        
        {get_email_footer()}
    </div>
</body>
</html>
"""
    
    return {"subject": subject, "html": html}


def flight_cancelled_email(
    customer_name: str,
    booking_id: str,
    from_city: str,
    to_city: str,
    departure_date: str,
    cancellation_reason: str,
    refund_amount: str,
    refund_status: str = "Processing",
    refund_timeline: str = "5-7 business days",
    cancelled_by: str = "Operator",
    theme: str = "dark"
) -> Dict[str, str]:
    """Generate flight cancellation email"""
    
    subject = f"❌ Flight Cancelled | #{booking_id} | Refund Initiated - AirYatra"
    
    html = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>{get_base_template(theme)}</style>
</head>
<body>
    <div class="container">
        {get_email_header("Flight Cancelled", "We're sorry for the inconvenience", "❌ CANCELLED", "badge-error")}
        
        <div class="content">
            <p style="font-size: 16px; margin-bottom: 25px;">
                Namaste <strong class="highlight">{customer_name}</strong>! 🙏
            </p>
            <p style="color: #94a3b8; margin-bottom: 30px;">
                We regret to inform you that your flight has been cancelled. A refund has been initiated to your original payment method.
            </p>
            
            <div class="big-icon">😔</div>
            
            <!-- Cancelled Flight Details -->
            <div class="card" style="background: rgba(239, 68, 68, 0.1); border-color: rgba(239, 68, 68, 0.3);">
                <div class="card-header" style="background: rgba(239, 68, 68, 0.2);">
                    <div class="card-header-icon" style="background: #ef4444;">❌</div>
                    <span class="card-header-title" style="color: #ef4444;">Cancelled Flight</span>
                </div>
                <div class="card-body">
                    <div class="detail-row">
                        <span class="detail-label">Booking ID</span>
                        <span class="detail-value">{booking_id}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Route</span>
                        <span class="detail-value">{from_city} → {to_city}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Scheduled Date</span>
                        <span class="detail-value">{departure_date}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Cancelled By</span>
                        <span class="detail-value">{cancelled_by}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Reason</span>
                        <span class="detail-value">{cancellation_reason}</span>
                    </div>
                </div>
            </div>
            
            <!-- Refund Details -->
            <div class="card" style="background: rgba(34, 197, 94, 0.1); border-color: rgba(34, 197, 94, 0.3);">
                <div class="card-header" style="background: rgba(34, 197, 94, 0.2);">
                    <div class="card-header-icon" style="background: #22c55e;">💰</div>
                    <span class="card-header-title" style="color: #22c55e;">Refund Details</span>
                </div>
                <div class="card-body">
                    <div class="price-display" style="color: #22c55e;">₹{refund_amount}</div>
                    <div class="price-label">Refund Amount</div>
                    <div class="detail-row" style="margin-top: 15px;">
                        <span class="detail-label">Refund Status</span>
                        <span class="detail-value success">{refund_status}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Expected Timeline</span>
                        <span class="detail-value">{refund_timeline}</span>
                    </div>
                </div>
            </div>
            
            <div class="cta-section">
                <a href="https://airyatra.co.in/bookings" class="cta-btn">
                    Book Another Flight →
                </a>
            </div>
            
            <div class="info-box">
                <strong>We apologize for the inconvenience.</strong> As a token of appreciation for your understanding, 
                we're offering you a <strong class="highlight">10% discount</strong> on your next booking. 
                Use code <strong class="highlight">SORRY10</strong> at checkout.
            </div>
        </div>
        
        {get_email_footer()}
    </div>
</body>
</html>
"""
    
    return {"subject": subject, "html": html}


def flight_completed_email(
    customer_name: str,
    booking_id: str,
    from_city: str,
    to_city: str,
    flight_date: str,
    flight_duration: str,
    pilot_name: str = None,
    theme: str = "dark"
) -> Dict[str, str]:
    """Generate post-flight thank you email"""
    
    subject = f"✈️ Thank You for Flying with AirYatra! | #{booking_id}"
    
    html = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>{get_base_template(theme)}</style>
</head>
<body>
    <div class="container">
        {get_email_header("Thank You!", "We hope you had an amazing flight", "🌟 COMPLETED", "badge-success")}
        
        <div class="content">
            <p style="font-size: 16px; margin-bottom: 25px;">
                Namaste <strong class="highlight">{customer_name}</strong>! 🙏
            </p>
            <p style="color: #94a3b8; margin-bottom: 30px;">
                Thank you for choosing AirYatra for your aerial journey! We hope you had an unforgettable experience.
            </p>
            
            <div class="big-icon">🎊</div>
            
            <!-- Flight Summary -->
            <div class="card">
                <div class="card-header">
                    <div class="card-header-icon">✈️</div>
                    <span class="card-header-title">Flight Summary</span>
                </div>
                <div class="card-body">
                    <div class="detail-row">
                        <span class="detail-label">Booking ID</span>
                        <span class="detail-value highlight">{booking_id}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Route</span>
                        <span class="detail-value">{from_city} → {to_city}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Flight Date</span>
                        <span class="detail-value">{flight_date}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Duration</span>
                        <span class="detail-value">{flight_duration}</span>
                    </div>
                    {f'<div class="detail-row"><span class="detail-label">Your Pilot</span><span class="detail-value">Capt. {pilot_name}</span></div>' if pilot_name else ''}
                </div>
            </div>
            
            <!-- Review Request -->
            <div class="card" style="background: rgba(249, 115, 22, 0.1); border-color: rgba(249, 115, 22, 0.3); text-align: center; padding: 30px;">
                <div style="font-size: 40px; margin-bottom: 15px;">⭐⭐⭐⭐⭐</div>
                <h3 style="color: #f97316; margin-bottom: 10px;">How was your experience?</h3>
                <p style="color: #94a3b8; font-size: 14px; margin-bottom: 20px;">
                    Your feedback helps us improve and serves other travelers. It only takes a minute!
                </p>
                <a href="https://airyatra.co.in/review/{booking_id}" class="cta-btn">
                    Rate Your Experience →
                </a>
            </div>
            
            <div class="info-box">
                <strong>Fly Again & Save!</strong> Book your next helicopter journey within 30 days 
                and get <strong class="highlight">15% off</strong>. Use code <strong class="highlight">FLYAGAIN15</strong> at checkout.
            </div>
        </div>
        
        {get_email_footer()}
    </div>
</body>
</html>
"""
    
    return {"subject": subject, "html": html}


def inquiry_received_email(
    customer_name: str,
    inquiry_id: str,
    from_city: str,
    to_city: str,
    travel_date: str,
    passenger_count: int,
    estimated_price: str = None,
    theme: str = "dark"
) -> Dict[str, str]:
    """Generate inquiry received confirmation email"""
    
    subject = f"📩 Inquiry Received | #{inquiry_id} | {from_city} → {to_city} - AirYatra"
    
    html = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>{get_base_template(theme)}</style>
</head>
<body>
    <div class="container">
        {get_email_header("Inquiry Received!", "We're finding the best options for you", "📩 RECEIVED", "badge-info")}
        
        <div class="content">
            <p style="font-size: 16px; margin-bottom: 25px;">
                Namaste <strong class="highlight">{customer_name}</strong>! 🙏
            </p>
            <p style="color: #94a3b8; margin-bottom: 30px;">
                Thank you for your helicopter booking inquiry. Our team is reviewing your request and will get back to you shortly with the best available options.
            </p>
            
            <div class="big-icon">🔍</div>
            
            <!-- Inquiry Details -->
            <div class="card">
                <div class="card-header">
                    <div class="card-header-icon">📋</div>
                    <span class="card-header-title">Your Inquiry Details</span>
                </div>
                <div class="card-body">
                    <div class="detail-row">
                        <span class="detail-label">Inquiry ID</span>
                        <span class="detail-value highlight">{inquiry_id}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Route</span>
                        <span class="detail-value">{from_city} → {to_city}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Travel Date</span>
                        <span class="detail-value">{travel_date}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Passengers</span>
                        <span class="detail-value">{passenger_count} Pax</span>
                    </div>
                    {f'<div class="detail-row"><span class="detail-label">Estimated Price</span><span class="detail-value highlight">₹{estimated_price}</span></div>' if estimated_price else ''}
                </div>
            </div>
            
            <!-- What's Next -->
            <div class="card" style="background: rgba(59, 130, 246, 0.1); border-color: rgba(59, 130, 246, 0.3);">
                <div style="padding: 20px;">
                    <h4 style="color: #3b82f6; margin-bottom: 15px;">📞 What happens next?</h4>
                    <ol style="color: #94a3b8; line-height: 2; padding-left: 20px;">
                        <li>Our team reviews your request (within 2 hours)</li>
                        <li>We check availability with partner operators</li>
                        <li>You receive quotes via email/WhatsApp/call</li>
                        <li>Choose your preferred option and book!</li>
                    </ol>
                </div>
            </div>
            
            <div class="cta-section">
                <a href="https://airyatra.co.in/inquiries/{inquiry_id}" class="cta-btn">
                    Track Inquiry Status →
                </a>
            </div>
            
            <div class="info-box">
                <strong>Need urgent assistance?</strong> Call us at <strong class="highlight">1800-XXX-XXXX</strong> (Toll Free) 
                or WhatsApp us at <strong class="highlight">+91 98XXX XXXXX</strong>. We're available 24/7!
            </div>
        </div>
        
        {get_email_footer()}
    </div>
</body>
</html>
"""
    
    return {"subject": subject, "html": html}


def otp_email(
    customer_name: str,
    otp: str,
    purpose: str = "login",
    validity_minutes: int = 10,
    theme: str = "dark"
) -> Dict[str, str]:
    """Generate OTP verification email"""
    
    purpose_text = {
        "login": "logging into your account",
        "signup": "completing your registration",
        "reset_password": "resetting your password",
        "verify_email": "verifying your email address",
        "payment": "authorizing your payment"
    }.get(purpose, purpose)
    
    subject = f"🔐 Your AirYatra OTP: {otp}"
    
    html = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>{get_base_template(theme)}</style>
</head>
<body>
    <div class="container">
        {get_email_header("Verification Code", "Secure your account", "🔐 OTP", "badge-info")}
        
        <div class="content">
            <p style="font-size: 16px; margin-bottom: 25px;">
                Namaste <strong class="highlight">{customer_name}</strong>! 🙏
            </p>
            <p style="color: #94a3b8; margin-bottom: 30px;">
                Use the following OTP for {purpose_text}:
            </p>
            
            <!-- OTP Display -->
            <div class="card" style="text-align: center; padding: 40px;">
                <div style="font-size: 48px; font-weight: 800; letter-spacing: 12px; color: #f97316; font-family: monospace;">
                    {otp}
                </div>
                <div style="font-size: 14px; color: #94a3b8; margin-top: 20px;">
                    Valid for <strong class="highlight">{validity_minutes} minutes</strong>
                </div>
            </div>
            
            <div class="info-box" style="background: rgba(239, 68, 68, 0.1); border-color: rgba(239, 68, 68, 0.2);">
                <strong style="color: #ef4444;">⚠️ Security Warning:</strong><br>
                • Never share this OTP with anyone, including AirYatra staff<br>
                • AirYatra will never call and ask for your OTP<br>
                • If you didn't request this, please ignore this email
            </div>
        </div>
        
        {get_email_footer()}
    </div>
</body>
</html>
"""
    
    return {"subject": subject, "html": html}


# ==================== TEMPLATE REGISTRY ====================

BRANDED_EMAIL_TEMPLATES = {
    "booking_confirmation": booking_confirmation_email,
    "payment_receipt": payment_receipt_email,
    "flight_reminder": flight_reminder_email,
    "flight_rescheduled": flight_rescheduled_email,
    "flight_cancelled": flight_cancelled_email,
    "flight_completed": flight_completed_email,
    "inquiry_received": inquiry_received_email,
    "otp": otp_email,
}


def get_branded_email(template_name: str, **kwargs) -> Optional[Dict[str, str]]:
    """
    Get a branded email template by name
    
    Args:
        template_name: Name of the template
        **kwargs: Template-specific parameters
        
    Returns:
        Dict with 'subject' and 'html' keys, or None if template not found
    """
    template_func = BRANDED_EMAIL_TEMPLATES.get(template_name)
    if template_func:
        return template_func(**kwargs)
    return None


def list_branded_templates() -> list:
    """List all available branded email templates"""
    return [
        {"id": "booking_confirmation", "name": "Booking Confirmation", "description": "Sent when booking is confirmed"},
        {"id": "payment_receipt", "name": "Payment Receipt", "description": "Sent after successful payment"},
        {"id": "flight_reminder", "name": "Flight Reminder (24h)", "description": "Sent 24 hours before flight"},
        {"id": "flight_rescheduled", "name": "Flight Rescheduled", "description": "Sent when flight is rescheduled"},
        {"id": "flight_cancelled", "name": "Flight Cancelled", "description": "Sent when flight is cancelled"},
        {"id": "flight_completed", "name": "Flight Completed", "description": "Thank you email after flight"},
        {"id": "inquiry_received", "name": "Inquiry Received", "description": "Sent when inquiry is submitted"},
        {"id": "otp", "name": "OTP Verification", "description": "OTP for various purposes"},
    ]
