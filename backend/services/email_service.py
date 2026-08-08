"""
AirYatra Email Service
SMTP Configuration: Hostinger
Features: Multi-template, Multi-recipient, HTML emails
"""

import os
import ssl
import logging
import asyncio
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email import encoders
from typing import Optional, List, Dict, Any
from datetime import datetime
import aiosmtplib
from jinja2 import Environment, BaseLoader

logger = logging.getLogger(__name__)

# ==================== SMTP CONFIGURATION ====================

SMTP_CONFIG = {
    "host": os.environ.get("SMTP_HOST", "smtp.gmail.com"),
    "port": int(os.environ.get("SMTP_PORT", 587)),
    "username": os.environ.get("SMTP_USER", "airyatraadmin@gmail.com"),
    "password": os.environ.get("SMTP_PASSWORD", ""),
    "from_email": os.environ.get("SMTP_FROM_EMAIL", "airyatraadmin@gmail.com"),
    "from_name": os.environ.get("SMTP_FROM_NAME", "AirYatra"),
    "use_tls": False,  # Use STARTTLS for Gmail (port 587)
    "start_tls": True,  # Gmail requires STARTTLS
}

# ==================== EMAIL TEMPLATES ====================

EMAIL_TEMPLATES = {
    # ===== INQUIRY TEMPLATES =====
    "inquiry_customer": {
        "subject": "🚁 Your Helicopter Booking Inquiry #{inquiry_id} - AirYatra",
        "body": """
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; background: #1a1a2e; color: #ffffff; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: #16213e; border-radius: 16px; overflow: hidden; }
        .header { background: linear-gradient(135deg, #f97316, #ea580c); padding: 30px; text-align: center; }
        .header h1 { margin: 0; font-size: 28px; }
        .header p { margin: 10px 0 0; opacity: 0.9; }
        .content { padding: 30px; }
        .info-box { background: #1a1a2e; border-radius: 12px; padding: 20px; margin: 15px 0; }
        .info-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #2a2a4e; }
        .info-row:last-child { border-bottom: none; }
        .label { color: #94a3b8; }
        .value { color: #ffffff; font-weight: 600; }
        .highlight { color: #f97316; }
        .price-box { background: linear-gradient(135deg, #f97316, #ea580c); border-radius: 12px; padding: 20px; text-align: center; margin: 20px 0; }
        .price { font-size: 32px; font-weight: bold; }
        .btn { display: inline-block; background: #f97316; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; margin: 10px 5px; }
        .footer { background: #0f0f1e; padding: 20px; text-align: center; font-size: 12px; color: #64748b; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚁 Inquiry Received!</h1>
            <p>Thank you for choosing AirYatra</p>
        </div>
        <div class="content">
            <p>Namaste <strong>{{ customer_name }}</strong>,</p>
            <p>Aapki helicopter booking inquiry successfully submit ho gayi hai. Humare operators jald hi aapse contact karenge.</p>
            
            <div class="info-box">
                <h3 style="margin-top:0; color:#f97316;">📋 Inquiry Details</h3>
                <div class="info-row">
                    <span class="label">Inquiry ID:</span>
                    <span class="value highlight">#{{ inquiry_id }}</span>
                </div>
                <div class="info-row">
                    <span class="label">Flight Type:</span>
                    <span class="value">{{ flight_type }}</span>
                </div>
                <div class="info-row">
                    <span class="label">Purpose:</span>
                    <span class="value">{{ booking_purpose }}</span>
                </div>
            </div>
            
            <div class="info-box">
                <h3 style="margin-top:0; color:#22c55e;">📍 Route Details</h3>
                <div class="info-row">
                    <span class="label">From:</span>
                    <span class="value">{{ pickup_location }}</span>
                </div>
                <div class="info-row">
                    <span class="label">To:</span>
                    <span class="value">{{ drop_location }}</span>
                </div>
                <div class="info-row">
                    <span class="label">Date:</span>
                    <span class="value">{{ departure_date }}</span>
                </div>
                <div class="info-row">
                    <span class="label">Time:</span>
                    <span class="value">{{ departure_time }}</span>
                </div>
                <div class="info-row">
                    <span class="label">Passengers:</span>
                    <span class="value">{{ passenger_count }}</span>
                </div>
            </div>
            
            <div class="price-box">
                <p style="margin:0 0 5px; opacity:0.9;">Estimated Price / अनुमानित मूल्य</p>
                <div class="price">₹{{ estimated_price }}</div>
                <p style="margin:5px 0 0; font-size:12px; opacity:0.8;">*Final price operator द्वारा confirm होगी</p>
            </div>
            
            <p style="text-align:center;">
                <a href="{{ tracking_url }}" class="btn">Track Inquiry Status</a>
            </p>
            
            <p style="color:#94a3b8; font-size:14px;">
                <strong>Next Steps:</strong><br>
                1. Operators will review your inquiry<br>
                2. You'll receive quotes within 2-4 hours<br>
                3. Compare & accept the best quote<br>
                4. Make payment & confirm booking
            </p>
        </div>
        <div class="footer">
            <p>AirYatra - India's Premium Helicopter Booking Platform</p>
            <p>📞 Support: +91-XXXXXXXXXX | 📧 info@airyatra.co.in</p>
            <p>© 2025 AirYatra. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
"""
    },
    
    "inquiry_operator": {
        "subject": "🔔 New Booking Lead #{inquiry_id} - {{ pickup_location }} → {{ drop_location }}",
        "body": """
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; background: #1a1a2e; color: #ffffff; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: #16213e; border-radius: 16px; overflow: hidden; }
        .header { background: linear-gradient(135deg, #22c55e, #16a34a); padding: 30px; text-align: center; }
        .urgent { background: #ef4444; color: white; padding: 5px 15px; border-radius: 20px; font-size: 12px; display: inline-block; margin-top: 10px; }
        .content { padding: 30px; }
        .info-box { background: #1a1a2e; border-radius: 12px; padding: 20px; margin: 15px 0; }
        .info-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #2a2a4e; }
        .info-row:last-child { border-bottom: none; }
        .label { color: #94a3b8; }
        .value { color: #ffffff; font-weight: 600; }
        .highlight { color: #22c55e; }
        .btn { display: inline-block; background: #22c55e; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; }
        .btn-secondary { background: #3b82f6; }
        .footer { background: #0f0f1e; padding: 20px; text-align: center; font-size: 12px; color: #64748b; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🆕 New Booking Lead!</h1>
            <p>A customer is looking for helicopter service</p>
            <span class="urgent">⏰ Respond within 2 hours</span>
        </div>
        <div class="content">
            <p>Dear <strong>{{ operator_name }}</strong>,</p>
            <p>Ek naya booking inquiry aaya hai jo aapke service area mein hai. Jaldi quote bhejein!</p>
            
            <div class="info-box">
                <h3 style="margin-top:0; color:#22c55e;">📋 Lead Details</h3>
                <div class="info-row">
                    <span class="label">Inquiry ID:</span>
                    <span class="value highlight">#{{ inquiry_id }}</span>
                </div>
                <div class="info-row">
                    <span class="label">Customer:</span>
                    <span class="value">{{ customer_name }}</span>
                </div>
                <div class="info-row">
                    <span class="label">Phone:</span>
                    <span class="value">{{ customer_phone }}</span>
                </div>
                <div class="info-row">
                    <span class="label">Purpose:</span>
                    <span class="value">{{ booking_purpose }}</span>
                </div>
            </div>
            
            <div class="info-box">
                <h3 style="margin-top:0; color:#f97316;">🗺️ Route Information</h3>
                <div class="info-row">
                    <span class="label">From:</span>
                    <span class="value">{{ pickup_location }}</span>
                </div>
                <div class="info-row">
                    <span class="label">To:</span>
                    <span class="value">{{ drop_location }}</span>
                </div>
                <div class="info-row">
                    <span class="label">Distance:</span>
                    <span class="value">{{ distance_km }} km</span>
                </div>
                <div class="info-row">
                    <span class="label">Date:</span>
                    <span class="value">{{ departure_date }}</span>
                </div>
                <div class="info-row">
                    <span class="label">Time:</span>
                    <span class="value">{{ departure_time }}</span>
                </div>
                <div class="info-row">
                    <span class="label">Passengers:</span>
                    <span class="value">{{ passenger_count }}</span>
                </div>
            </div>
            
            <div class="info-box" style="border: 2px solid #f97316;">
                <h3 style="margin-top:0; color:#f97316;">💰 Estimated Value</h3>
                <div class="info-row">
                    <span class="label">Customer's Budget:</span>
                    <span class="value" style="font-size:24px; color:#f97316;">₹{{ estimated_price }}</span>
                </div>
                <div class="info-row">
                    <span class="label">Your Potential Earning:</span>
                    <span class="value" style="color:#22c55e;">₹{{ operator_earning }} (after commission)</span>
                </div>
            </div>
            
            <p style="text-align:center;">
                <a href="{{ quote_url }}" class="btn">Submit Quote Now</a>
                <a href="{{ dashboard_url }}" class="btn btn-secondary">View in Dashboard</a>
            </p>
            
            <p style="color:#fbbf24; font-size:14px; background:#422006; padding:15px; border-radius:8px;">
                ⚠️ <strong>Important:</strong> Quick response = Higher chances of winning this booking!
            </p>
        </div>
        <div class="footer">
            <p>AirYatra Operator Portal</p>
            <p>© 2025 AirYatra. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
"""
    },
    
    "inquiry_admin": {
        "subject": "📊 New Inquiry #{inquiry_id} - ₹{{ estimated_price }} | {{ pickup_location }} → {{ drop_location }}",
        "body": """
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; background: #f1f5f9; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { background: #1e293b; color: white; padding: 20px; }
        .content { padding: 20px; }
        .metric { display: inline-block; background: #f1f5f9; padding: 15px 20px; border-radius: 8px; margin: 5px; text-align: center; }
        .metric-value { font-size: 24px; font-weight: bold; color: #f97316; }
        .metric-label { font-size: 12px; color: #64748b; }
        table { width: 100%; border-collapse: collapse; margin: 15px 0; }
        td { padding: 10px; border-bottom: 1px solid #e2e8f0; }
        .footer { background: #f8fafc; padding: 15px; text-align: center; font-size: 12px; color: #64748b; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2 style="margin:0;">📊 New Inquiry Alert</h2>
            <p style="margin:5px 0 0; opacity:0.8;">Admin Dashboard Notification</p>
        </div>
        <div class="content">
            <div style="text-align:center; margin-bottom:20px;">
                <div class="metric">
                    <div class="metric-value">₹{{ estimated_price }}</div>
                    <div class="metric-label">Estimated Value</div>
                </div>
                <div class="metric">
                    <div class="metric-value">₹{{ platform_commission }}</div>
                    <div class="metric-label">Platform Commission</div>
                </div>
            </div>
            
            <table>
                <tr><td><strong>Inquiry ID:</strong></td><td>#{{ inquiry_id }}</td></tr>
                <tr><td><strong>Customer:</strong></td><td>{{ customer_name }} ({{ customer_email }})</td></tr>
                <tr><td><strong>Route:</strong></td><td>{{ pickup_location }} → {{ drop_location }}</td></tr>
                <tr><td><strong>Date:</strong></td><td>{{ departure_date }} at {{ departure_time }}</td></tr>
                <tr><td><strong>Purpose:</strong></td><td>{{ booking_purpose }}</td></tr>
                <tr><td><strong>Passengers:</strong></td><td>{{ passenger_count }}</td></tr>
                <tr><td><strong>Operators Notified:</strong></td><td>{{ operators_notified }}</td></tr>
                <tr><td><strong>Status:</strong></td><td>{{ status }}</td></tr>
            </table>
            
            <p style="text-align:center;">
                <a href="{{ admin_url }}" style="background:#1e293b; color:white; padding:10px 20px; border-radius:5px; text-decoration:none;">View in Admin Panel</a>
            </p>
        </div>
        <div class="footer">
            <p>AirYatra Admin System | Auto-generated notification</p>
        </div>
    </div>
</body>
</html>
"""
    },
    
    # ===== QUOTE TEMPLATES =====
    "quote_customer": {
        "subject": "💰 New Quote Received for Inquiry #{inquiry_id} - ₹{{ quoted_price }} | AirYatra",
        "body": """
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; background: #1a1a2e; color: #ffffff; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: #16213e; border-radius: 16px; overflow: hidden; }
        .header { background: linear-gradient(135deg, #3b82f6, #1d4ed8); padding: 30px; text-align: center; }
        .content { padding: 30px; }
        .quote-box { background: linear-gradient(135deg, #22c55e, #16a34a); border-radius: 12px; padding: 25px; text-align: center; margin: 20px 0; }
        .price { font-size: 36px; font-weight: bold; }
        .info-box { background: #1a1a2e; border-radius: 12px; padding: 20px; margin: 15px 0; }
        .info-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #2a2a4e; }
        .btn { display: inline-block; background: #22c55e; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; margin: 5px; }
        .btn-outline { background: transparent; border: 2px solid #f97316; color: #f97316; }
        .footer { background: #0f0f1e; padding: 20px; text-align: center; font-size: 12px; color: #64748b; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>💰 Quote Received!</h1>
            <p>An operator has sent you a quote</p>
        </div>
        <div class="content">
            <p>Namaste <strong>{{ customer_name }}</strong>,</p>
            <p>Aapki inquiry ke liye ek operator ne quote bheja hai. Details neeche dekhen:</p>
            
            <div class="quote-box">
                <p style="margin:0 0 10px; opacity:0.9;">Quoted Price / उद्धृत मूल्य</p>
                <div class="price">₹{{ quoted_price }}</div>
                <p style="margin:10px 0 0; font-size:14px;">by {{ operator_name }}</p>
            </div>
            
            <div class="info-box">
                <h3 style="margin-top:0; color:#3b82f6;">🚁 Operator Details</h3>
                <div class="info-row">
                    <span style="color:#94a3b8;">Company:</span>
                    <span style="font-weight:600;">{{ operator_company }}</span>
                </div>
                <div class="info-row">
                    <span style="color:#94a3b8;">Rating:</span>
                    <span style="font-weight:600;">⭐ {{ operator_rating }}/5</span>
                </div>
                <div class="info-row">
                    <span style="color:#94a3b8;">Helicopter:</span>
                    <span style="font-weight:600;">{{ helicopter_model }}</span>
                </div>
                <div class="info-row">
                    <span style="color:#94a3b8;">Valid Till:</span>
                    <span style="font-weight:600;">{{ quote_validity }}</span>
                </div>
            </div>
            
            <div class="info-box">
                <h3 style="margin-top:0; color:#f97316;">📋 Quote Breakdown</h3>
                <div class="info-row">
                    <span style="color:#94a3b8;">Base Price:</span>
                    <span>₹{{ base_price }}</span>
                </div>
                <div class="info-row">
                    <span style="color:#94a3b8;">Taxes & Fees:</span>
                    <span>₹{{ taxes }}</span>
                </div>
                <div class="info-row" style="border-top:2px solid #f97316; padding-top:15px;">
                    <span style="font-weight:600;">Total:</span>
                    <span style="font-weight:600; color:#22c55e; font-size:20px;">₹{{ quoted_price }}</span>
                </div>
            </div>
            
            <p style="text-align:center; margin-top:25px;">
                <a href="{{ accept_url }}" class="btn">✅ Accept Quote</a>
                <a href="{{ compare_url }}" class="btn btn-outline">Compare All Quotes</a>
            </p>
            
            <p style="color:#94a3b8; font-size:13px; text-align:center;">
                Quote valid for 24 hours. Accepting the quote will initiate payment process.
            </p>
        </div>
        <div class="footer">
            <p>AirYatra - India's Premium Helicopter Booking Platform</p>
            <p>© 2025 AirYatra. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
"""
    },
    
    # ===== BOOKING CONFIRMED TEMPLATES =====
    "booking_confirmed_customer": {
        "subject": "✅ Booking Confirmed! #{booking_id} - {{ pickup_location }} → {{ drop_location }} | AirYatra",
        "body": """
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; background: #1a1a2e; color: #ffffff; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: #16213e; border-radius: 16px; overflow: hidden; }
        .header { background: linear-gradient(135deg, #22c55e, #16a34a); padding: 30px; text-align: center; }
        .success-icon { font-size: 60px; }
        .content { padding: 30px; }
        .booking-card { background: #1a1a2e; border-radius: 12px; padding: 20px; margin: 15px 0; border-left: 4px solid #22c55e; }
        .info-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #2a2a4e; }
        .qr-box { background: white; padding: 20px; border-radius: 12px; text-align: center; margin: 20px 0; }
        .btn { display: inline-block; background: #f97316; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; }
        .footer { background: #0f0f1e; padding: 20px; text-align: center; font-size: 12px; color: #64748b; }
        .checklist { background: #1e3a5f; padding: 20px; border-radius: 12px; margin: 20px 0; }
        .checklist li { padding: 8px 0; color: #94a3b8; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="success-icon">✅</div>
            <h1>Booking Confirmed!</h1>
            <p>Your helicopter is ready to fly</p>
        </div>
        <div class="content">
            <p>Namaste <strong>{{ customer_name }}</strong>,</p>
            <p>🎉 Congratulations! Aapki helicopter booking confirm ho gayi hai. Neeche saari details hain:</p>
            
            <div class="booking-card">
                <h3 style="margin-top:0; color:#22c55e;">🎫 Booking Details</h3>
                <div class="info-row">
                    <span style="color:#94a3b8;">Booking ID:</span>
                    <span style="font-weight:600; color:#f97316;">#{{ booking_id }}</span>
                </div>
                <div class="info-row">
                    <span style="color:#94a3b8;">Status:</span>
                    <span style="color:#22c55e; font-weight:600;">✅ CONFIRMED</span>
                </div>
                <div class="info-row">
                    <span style="color:#94a3b8;">Payment:</span>
                    <span style="color:#22c55e;">₹{{ amount_paid }} Paid</span>
                </div>
            </div>
            
            <div class="booking-card">
                <h3 style="margin-top:0; color:#3b82f6;">🗓️ Flight Schedule</h3>
                <div class="info-row">
                    <span style="color:#94a3b8;">Date:</span>
                    <span style="font-weight:600;">{{ departure_date }}</span>
                </div>
                <div class="info-row">
                    <span style="color:#94a3b8;">Time:</span>
                    <span style="font-weight:600;">{{ departure_time }}</span>
                </div>
                <div class="info-row">
                    <span style="color:#94a3b8;">From:</span>
                    <span style="font-weight:600;">{{ pickup_location }}</span>
                </div>
                <div class="info-row">
                    <span style="color:#94a3b8;">To:</span>
                    <span style="font-weight:600;">{{ drop_location }}</span>
                </div>
            </div>
            
            <div class="booking-card">
                <h3 style="margin-top:0; color:#f97316;">🚁 Operator & Helicopter</h3>
                <div class="info-row">
                    <span style="color:#94a3b8;">Operator:</span>
                    <span style="font-weight:600;">{{ operator_name }}</span>
                </div>
                <div class="info-row">
                    <span style="color:#94a3b8;">Helicopter:</span>
                    <span style="font-weight:600;">{{ helicopter_model }}</span>
                </div>
                <div class="info-row">
                    <span style="color:#94a3b8;">Pilot:</span>
                    <span style="font-weight:600;">{{ pilot_name }}</span>
                </div>
                <div class="info-row">
                    <span style="color:#94a3b8;">Contact:</span>
                    <span style="font-weight:600;">{{ operator_phone }}</span>
                </div>
            </div>
            
            <div class="checklist">
                <h3 style="margin-top:0; color:#fbbf24;">📋 Pre-Flight Checklist</h3>
                <ul style="margin:0; padding-left:20px;">
                    <li>✅ Carry valid Photo ID (Aadhar/Passport)</li>
                    <li>✅ Arrive 30 minutes before departure</li>
                    <li>✅ Max luggage: 10 kg per person</li>
                    <li>✅ No inflammable items allowed</li>
                    <li>✅ Follow pilot's instructions</li>
                </ul>
            </div>
            
            <p style="text-align:center; margin-top:25px;">
                <a href="{{ booking_url }}" class="btn">📄 View Full Booking</a>
            </p>
            
            <p style="color:#94a3b8; font-size:13px; background:#1e3a5f; padding:15px; border-radius:8px; margin-top:20px;">
                <strong>Emergency Contact:</strong><br>
                📞 24x7 Helpline: +91-XXXXXXXXXX<br>
                📧 support@airyatra.co.in
            </p>
        </div>
        <div class="footer">
            <p>AirYatra - India's Premium Helicopter Booking Platform</p>
            <p>Wishing you a safe and pleasant flight! 🚁</p>
            <p>© 2025 AirYatra. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
"""
    },
    
    "booking_confirmed_operator": {
        "subject": "🎯 New Booking Assignment #{booking_id} - ₹{{ operator_payout }} Payout | AirYatra",
        "body": """
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; background: #1a1a2e; color: #ffffff; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: #16213e; border-radius: 16px; overflow: hidden; }
        .header { background: linear-gradient(135deg, #22c55e, #16a34a); padding: 30px; text-align: center; }
        .content { padding: 30px; }
        .payout-box { background: linear-gradient(135deg, #f97316, #ea580c); border-radius: 12px; padding: 25px; text-align: center; margin: 20px 0; }
        .info-box { background: #1a1a2e; border-radius: 12px; padding: 20px; margin: 15px 0; }
        .info-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #2a2a4e; }
        .btn { display: inline-block; background: #22c55e; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; }
        .footer { background: #0f0f1e; padding: 20px; text-align: center; font-size: 12px; color: #64748b; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎯 Booking Assigned!</h1>
            <p>New confirmed booking for your fleet</p>
        </div>
        <div class="content">
            <p>Dear <strong>{{ operator_name }}</strong>,</p>
            <p>Congratulations! Ek naya booking aapko assign ho gaya hai. Customer ne payment complete kar diya hai.</p>
            
            <div class="payout-box">
                <p style="margin:0 0 10px; opacity:0.9;">Your Payout / आपका भुगतान</p>
                <div style="font-size:36px; font-weight:bold;">₹{{ operator_payout }}</div>
                <p style="margin:10px 0 0; font-size:14px;">After platform commission</p>
            </div>
            
            <div class="info-box">
                <h3 style="margin-top:0; color:#22c55e;">👤 Customer Details</h3>
                <div class="info-row">
                    <span style="color:#94a3b8;">Name:</span>
                    <span style="font-weight:600;">{{ customer_name }}</span>
                </div>
                <div class="info-row">
                    <span style="color:#94a3b8;">Phone:</span>
                    <span style="font-weight:600;">{{ customer_phone }}</span>
                </div>
                <div class="info-row">
                    <span style="color:#94a3b8;">Email:</span>
                    <span style="font-weight:600;">{{ customer_email }}</span>
                </div>
                <div class="info-row">
                    <span style="color:#94a3b8;">Passengers:</span>
                    <span style="font-weight:600;">{{ passenger_count }}</span>
                </div>
            </div>
            
            <div class="info-box">
                <h3 style="margin-top:0; color:#3b82f6;">🗓️ Flight Details</h3>
                <div class="info-row">
                    <span style="color:#94a3b8;">Booking ID:</span>
                    <span style="font-weight:600; color:#f97316;">#{{ booking_id }}</span>
                </div>
                <div class="info-row">
                    <span style="color:#94a3b8;">Date:</span>
                    <span style="font-weight:600;">{{ departure_date }}</span>
                </div>
                <div class="info-row">
                    <span style="color:#94a3b8;">Time:</span>
                    <span style="font-weight:600;">{{ departure_time }}</span>
                </div>
                <div class="info-row">
                    <span style="color:#94a3b8;">From:</span>
                    <span style="font-weight:600;">{{ pickup_location }}</span>
                </div>
                <div class="info-row">
                    <span style="color:#94a3b8;">To:</span>
                    <span style="font-weight:600;">{{ drop_location }}</span>
                </div>
                <div class="info-row">
                    <span style="color:#94a3b8;">Purpose:</span>
                    <span style="font-weight:600;">{{ booking_purpose }}</span>
                </div>
            </div>
            
            <div class="info-box" style="border:2px solid #fbbf24;">
                <h3 style="margin-top:0; color:#fbbf24;">⚠️ Action Required</h3>
                <ul style="margin:0; padding-left:20px; color:#94a3b8;">
                    <li>Assign pilot and helicopter</li>
                    <li>Confirm availability with customer</li>
                    <li>Update status in dashboard</li>
                    <li>Reach pickup location 30 min early</li>
                </ul>
            </div>
            
            <p style="text-align:center; margin-top:25px;">
                <a href="{{ dashboard_url }}" class="btn">Open Dashboard</a>
            </p>
        </div>
        <div class="footer">
            <p>AirYatra Operator Portal</p>
            <p>© 2025 AirYatra. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
"""
    },
    
    "booking_confirmed_admin": {
        "subject": "💰 Booking Confirmed #{booking_id} - Revenue ₹{{ total_amount }} | Commission ₹{{ platform_commission }}",
        "body": """
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; background: #f1f5f9; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; }
        .header { background: #22c55e; color: white; padding: 20px; }
        .content { padding: 20px; }
        .metrics { display: flex; justify-content: space-around; margin: 20px 0; }
        .metric { text-align: center; padding: 15px; background: #f1f5f9; border-radius: 8px; flex: 1; margin: 5px; }
        .metric-value { font-size: 24px; font-weight: bold; color: #22c55e; }
        .metric-label { font-size: 12px; color: #64748b; }
        table { width: 100%; border-collapse: collapse; }
        td { padding: 10px; border-bottom: 1px solid #e2e8f0; }
        .footer { background: #f8fafc; padding: 15px; text-align: center; font-size: 12px; color: #64748b; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2 style="margin:0;">💰 Booking Confirmed</h2>
        </div>
        <div class="content">
            <div class="metrics">
                <div class="metric">
                    <div class="metric-value">₹{{ total_amount }}</div>
                    <div class="metric-label">Total Revenue</div>
                </div>
                <div class="metric">
                    <div class="metric-value" style="color:#f97316;">₹{{ platform_commission }}</div>
                    <div class="metric-label">Platform Earning</div>
                </div>
                <div class="metric">
                    <div class="metric-value" style="color:#3b82f6;">₹{{ operator_payout }}</div>
                    <div class="metric-label">Operator Payout</div>
                </div>
            </div>
            
            <table>
                <tr><td><strong>Booking ID:</strong></td><td>#{{ booking_id }}</td></tr>
                <tr><td><strong>Customer:</strong></td><td>{{ customer_name }}</td></tr>
                <tr><td><strong>Operator:</strong></td><td>{{ operator_name }}</td></tr>
                <tr><td><strong>Route:</strong></td><td>{{ pickup_location }} → {{ drop_location }}</td></tr>
                <tr><td><strong>Date:</strong></td><td>{{ departure_date }}</td></tr>
                <tr><td><strong>Payment Method:</strong></td><td>{{ payment_method }}</td></tr>
                <tr><td><strong>Transaction ID:</strong></td><td>{{ transaction_id }}</td></tr>
            </table>
        </div>
        <div class="footer">
            <p>AirYatra Admin System</p>
        </div>
    </div>
</body>
</html>
"""
    },
    
    # ===== PAYMENT TEMPLATES =====
    "payment_received_customer": {
        "subject": "💳 Payment Successful - ₹{{ amount }} | Booking #{booking_id} | AirYatra",
        "body": """
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; background: #1a1a2e; color: #ffffff; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: #16213e; border-radius: 16px; overflow: hidden; }
        .header { background: linear-gradient(135deg, #22c55e, #16a34a); padding: 30px; text-align: center; }
        .content { padding: 30px; }
        .receipt-box { background: #1a1a2e; border-radius: 12px; padding: 20px; margin: 15px 0; border: 2px dashed #22c55e; }
        .info-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #2a2a4e; }
        .footer { background: #0f0f1e; padding: 20px; text-align: center; font-size: 12px; color: #64748b; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div style="font-size:60px;">💳</div>
            <h1>Payment Successful!</h1>
        </div>
        <div class="content">
            <p>Namaste <strong>{{ customer_name }}</strong>,</p>
            <p>Aapka payment successfully receive ho gaya hai. Receipt details neeche hain:</p>
            
            <div class="receipt-box">
                <h3 style="margin-top:0; color:#22c55e; text-align:center;">🧾 Payment Receipt</h3>
                <div class="info-row">
                    <span style="color:#94a3b8;">Receipt No:</span>
                    <span style="font-weight:600;">#{{ receipt_no }}</span>
                </div>
                <div class="info-row">
                    <span style="color:#94a3b8;">Booking ID:</span>
                    <span style="font-weight:600;">#{{ booking_id }}</span>
                </div>
                <div class="info-row">
                    <span style="color:#94a3b8;">Amount Paid:</span>
                    <span style="font-weight:600; color:#22c55e; font-size:24px;">₹{{ amount }}</span>
                </div>
                <div class="info-row">
                    <span style="color:#94a3b8;">Payment Method:</span>
                    <span style="font-weight:600;">{{ payment_method }}</span>
                </div>
                <div class="info-row">
                    <span style="color:#94a3b8;">Transaction ID:</span>
                    <span style="font-weight:600;">{{ transaction_id }}</span>
                </div>
                <div class="info-row">
                    <span style="color:#94a3b8;">Date & Time:</span>
                    <span style="font-weight:600;">{{ payment_date }}</span>
                </div>
            </div>
            
            <p style="color:#94a3b8; font-size:13px; text-align:center;">
                This is a computer-generated receipt and doesn't require signature.
            </p>
        </div>
        <div class="footer">
            <p>AirYatra - India's Premium Helicopter Booking Platform</p>
            <p>© 2025 AirYatra. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
"""
    },
    
    # ===== CANCELLATION TEMPLATES =====
    "booking_cancelled_customer": {
        "subject": "❌ Booking Cancelled #{booking_id} - Refund ₹{{ refund_amount }} | AirYatra",
        "body": """
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; background: #1a1a2e; color: #ffffff; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: #16213e; border-radius: 16px; overflow: hidden; }
        .header { background: linear-gradient(135deg, #ef4444, #dc2626); padding: 30px; text-align: center; }
        .content { padding: 30px; }
        .refund-box { background: #1a1a2e; border-radius: 12px; padding: 20px; margin: 15px 0; border: 2px solid #22c55e; }
        .info-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #2a2a4e; }
        .footer { background: #0f0f1e; padding: 20px; text-align: center; font-size: 12px; color: #64748b; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div style="font-size:60px;">❌</div>
            <h1>Booking Cancelled</h1>
        </div>
        <div class="content">
            <p>Namaste <strong>{{ customer_name }}</strong>,</p>
            <p>Aapki booking cancel ho gayi hai. Refund details neeche hain:</p>
            
            <div class="refund-box">
                <h3 style="margin-top:0; color:#22c55e;">💰 Refund Details</h3>
                <div class="info-row">
                    <span style="color:#94a3b8;">Original Amount:</span>
                    <span>₹{{ original_amount }}</span>
                </div>
                <div class="info-row">
                    <span style="color:#94a3b8;">Cancellation Charge:</span>
                    <span style="color:#ef4444;">- ₹{{ cancellation_charge }}</span>
                </div>
                <div class="info-row" style="border-top:2px solid #22c55e; padding-top:15px;">
                    <span style="font-weight:600;">Refund Amount:</span>
                    <span style="font-weight:600; color:#22c55e; font-size:24px;">₹{{ refund_amount }}</span>
                </div>
                <div class="info-row">
                    <span style="color:#94a3b8;">Refund Timeline:</span>
                    <span>5-7 business days</span>
                </div>
            </div>
            
            <p style="color:#94a3b8; font-size:14px;">
                <strong>Cancellation Reason:</strong> {{ cancellation_reason }}
            </p>
        </div>
        <div class="footer">
            <p>AirYatra - We hope to serve you again soon! 🚁</p>
            <p>© 2025 AirYatra. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
"""
    },
    
    # ===== FLIGHT COMPLETED TEMPLATES =====
    "flight_completed_customer": {
        "subject": "🎉 Flight Completed! Please Rate Your Experience | AirYatra",
        "body": """
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; background: #1a1a2e; color: #ffffff; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: #16213e; border-radius: 16px; overflow: hidden; }
        .header { background: linear-gradient(135deg, #8b5cf6, #7c3aed); padding: 30px; text-align: center; }
        .content { padding: 30px; }
        .rating-box { background: #1a1a2e; border-radius: 12px; padding: 30px; margin: 20px 0; text-align: center; }
        .stars { font-size: 40px; }
        .btn { display: inline-block; background: #f97316; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; }
        .footer { background: #0f0f1e; padding: 20px; text-align: center; font-size: 12px; color: #64748b; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div style="font-size:60px;">🎉</div>
            <h1>Flight Completed!</h1>
            <p>Thank you for flying with us</p>
        </div>
        <div class="content">
            <p>Namaste <strong>{{ customer_name }}</strong>,</p>
            <p>Hum umeed karte hain ki aapka helicopter experience accha raha! Please apna feedback share karein:</p>
            
            <div class="rating-box">
                <p style="margin-bottom:15px; color:#94a3b8;">How was your flight?</p>
                <div class="stars">⭐⭐⭐⭐⭐</div>
                <p style="margin-top:20px;">
                    <a href="{{ review_url }}" class="btn">Rate & Review</a>
                </p>
            </div>
            
            <p style="color:#94a3b8; font-size:14px; text-align:center;">
                Your feedback helps us improve and helps other travelers choose wisely.
            </p>
        </div>
        <div class="footer">
            <p>AirYatra - India's Premium Helicopter Booking Platform</p>
            <p>© 2025 AirYatra. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
"""
    },
    
    "flight_completed_operator": {
        "subject": "✅ Flight #{booking_id} Completed - Payout ₹{{ payout_amount }} Processing | AirYatra",
        "body": """
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; background: #f1f5f9; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; }
        .header { background: #22c55e; color: white; padding: 20px; }
        .content { padding: 20px; }
        .payout-box { background: #f0fdf4; border: 2px solid #22c55e; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0; }
        .footer { background: #f8fafc; padding: 15px; text-align: center; font-size: 12px; color: #64748b; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2 style="margin:0;">✅ Flight Completed Successfully</h2>
        </div>
        <div class="content">
            <p>Dear <strong>{{ operator_name }}</strong>,</p>
            <p>Booking #{{ booking_id }} ka flight successfully complete ho gaya hai.</p>
            
            <div class="payout-box">
                <p style="margin:0 0 10px; color:#16a34a;">Your Payout</p>
                <div style="font-size:32px; font-weight:bold; color:#22c55e;">₹{{ payout_amount }}</div>
                <p style="margin:10px 0 0; font-size:14px; color:#64748b;">Will be credited within 2-3 business days</p>
            </div>
            
            <p style="color:#64748b;">
                Customer feedback email has been sent. Positive reviews will boost your profile visibility.
            </p>
        </div>
        <div class="footer">
            <p>AirYatra Operator Portal</p>
        </div>
    </div>
</body>
</html>
"""
    },
    
    # ===== OTP/SECURITY TEMPLATES =====
    "otp_login": {
        "subject": "🔐 AirYatra Login Verification Code",
        "body": """
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; background: #1a1a2e; color: #ffffff; margin: 0; padding: 20px; }
        .container { max-width: 500px; margin: 0 auto; background: #16213e; border-radius: 16px; overflow: hidden; }
        .header { background: linear-gradient(135deg, #3b82f6, #1d4ed8); padding: 30px; text-align: center; }
        .header-icon { font-size: 50px; }
        .content { padding: 30px; text-align: center; }
        .otp-box { background: linear-gradient(135deg, #f97316, #ea580c); border-radius: 16px; padding: 25px; margin: 25px 0; }
        .otp-code { font-size: 42px; font-weight: bold; letter-spacing: 8px; font-family: 'Courier New', monospace; }
        .expiry { background: #1a1a2e; border-radius: 8px; padding: 12px; margin: 20px 0; font-size: 14px; color: #fbbf24; }
        .warning { background: #7f1d1d; border: 1px solid #ef4444; border-radius: 8px; padding: 15px; margin: 20px 0; text-align: left; }
        .warning-title { color: #ef4444; font-weight: 600; margin-bottom: 8px; }
        .footer { background: #0f0f1e; padding: 20px; text-align: center; font-size: 12px; color: #64748b; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="header-icon">🔐</div>
            <h1 style="margin:10px 0 0;">Login Verification</h1>
            <p style="margin:5px 0 0; opacity:0.9;">AirYatra Security</p>
        </div>
        <div class="content">
            <p>Namaste <strong>{{ user_name }}</strong>,</p>
            <p>Aapke AirYatra account mein login ke liye OTP hai:</p>
            
            <div class="otp-box">
                <div class="otp-code">{{ otp_code }}</div>
            </div>
            
            <div class="expiry">
                ⏱️ This OTP will expire in <strong>{{ expiry_minutes }} minutes</strong>
            </div>
            
            <div class="warning">
                <div class="warning-title">⚠️ Security Notice</div>
                <p style="margin:0; font-size:13px; color:#fca5a5;">
                    • Never share this OTP with anyone<br>
                    • AirYatra will never call and ask for OTP<br>
                    • If you didn't request this, ignore this email
                </p>
            </div>
            
            <p style="color:#94a3b8; font-size:13px;">
                Login attempt from: {{ device_info }}<br>
                IP: {{ ip_address }}<br>
                Time: {{ timestamp }}
            </p>
        </div>
        <div class="footer">
            <p>AirYatra - Enterprise Aviation Security</p>
            <p>© 2025 AirYatra Aviation Pvt. Ltd.</p>
        </div>
    </div>
</body>
</html>
"""
    },
    
    "new_device_login": {
        "subject": "🚨 New Device Login Detected - AirYatra Security Alert",
        "body": """
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; background: #1a1a2e; color: #ffffff; margin: 0; padding: 20px; }
        .container { max-width: 500px; margin: 0 auto; background: #16213e; border-radius: 16px; overflow: hidden; }
        .header { background: linear-gradient(135deg, #ef4444, #dc2626); padding: 30px; text-align: center; }
        .content { padding: 30px; }
        .device-box { background: #1a1a2e; border-radius: 12px; padding: 20px; margin: 20px 0; border-left: 4px solid #fbbf24; }
        .info-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #2a2a4e; }
        .info-row:last-child { border-bottom: none; }
        .btn { display: inline-block; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin: 5px; }
        .btn-danger { background: #ef4444; color: white; }
        .btn-secondary { background: #3b82f6; color: white; }
        .footer { background: #0f0f1e; padding: 20px; text-align: center; font-size: 12px; color: #64748b; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div style="font-size:50px;">🚨</div>
            <h1 style="margin:10px 0 0;">New Login Detected</h1>
        </div>
        <div class="content">
            <p>Namaste <strong>{{ user_name }}</strong>,</p>
            <p>Aapke AirYatra account mein ek <strong>naye device</strong> se login hua hai:</p>
            
            <div class="device-box">
                <h4 style="margin:0 0 15px; color:#fbbf24;">📱 Device Details</h4>
                <div class="info-row">
                    <span style="color:#94a3b8;">Device:</span>
                    <span style="font-weight:600;">{{ device_name }}</span>
                </div>
                <div class="info-row">
                    <span style="color:#94a3b8;">Location:</span>
                    <span style="font-weight:600;">{{ location }}</span>
                </div>
                <div class="info-row">
                    <span style="color:#94a3b8;">IP Address:</span>
                    <span style="font-weight:600;">{{ ip_address }}</span>
                </div>
                <div class="info-row">
                    <span style="color:#94a3b8;">Time:</span>
                    <span style="font-weight:600;">{{ timestamp }}</span>
                </div>
            </div>
            
            <p style="text-align:center;">
                <span style="color:#22c55e;">✅ If this was you, no action needed.</span>
            </p>
            
            <p style="text-align:center; margin-top:20px;">
                <a href="{{ secure_account_url }}" class="btn btn-danger">🔒 Secure My Account</a>
                <a href="{{ sessions_url }}" class="btn btn-secondary">View All Sessions</a>
            </p>
            
            <p style="color:#ef4444; font-size:13px; background:#450a0a; padding:15px; border-radius:8px; margin-top:20px;">
                ⚠️ <strong>Wasn't you?</strong> Click "Secure My Account" immediately to logout from all devices and change your password.
            </p>
        </div>
        <div class="footer">
            <p>AirYatra Security Team</p>
            <p>© 2025 AirYatra Aviation Pvt. Ltd.</p>
        </div>
    </div>
</body>
</html>
"""
    },
    
    "device_trusted": {
        "subject": "✅ Device Trusted - AirYatra Security",
        "body": """
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; background: #1a1a2e; color: #ffffff; margin: 0; padding: 20px; }
        .container { max-width: 500px; margin: 0 auto; background: #16213e; border-radius: 16px; overflow: hidden; }
        .header { background: linear-gradient(135deg, #22c55e, #16a34a); padding: 30px; text-align: center; }
        .content { padding: 30px; text-align: center; }
        .device-box { background: #1a1a2e; border-radius: 12px; padding: 20px; margin: 20px 0; }
        .footer { background: #0f0f1e; padding: 20px; text-align: center; font-size: 12px; color: #64748b; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div style="font-size:50px;">✅</div>
            <h1 style="margin:10px 0 0;">Device Trusted</h1>
        </div>
        <div class="content">
            <p>Namaste <strong>{{ user_name }}</strong>,</p>
            <p>Aapne ye device trust kar diya hai. Ab is device se login karne pe OTP nahi maanga jayega.</p>
            
            <div class="device-box">
                <h4 style="margin:0 0 10px; color:#22c55e;">📱 {{ device_name }}</h4>
                <p style="color:#94a3b8; margin:0;">Trusted for {{ trust_days }} days</p>
                <p style="color:#94a3b8; margin:5px 0 0;">Expires: {{ expires_at }}</p>
            </div>
            
            <p style="color:#94a3b8; font-size:13px;">
                You can manage trusted devices from your account settings anytime.
            </p>
        </div>
        <div class="footer">
            <p>AirYatra Security</p>
            <p>© 2025 AirYatra Aviation Pvt. Ltd.</p>
        </div>
    </div>
</body>
</html>
"""
    },
    
    # ===== CRITICAL SECURITY ALERT FOR ADMIN/CEO/HR =====
    "critical_security_alert": {
        "subject": "🚨 CRITICAL SECURITY ALERT - {{ alert_type }} - AirYatra Login Shield",
        "body": """
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; background: #1a1a2e; color: #ffffff; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: #16213e; border-radius: 16px; overflow: hidden; border: 2px solid #dc2626; }
        .header { background: linear-gradient(135deg, #dc2626, #991b1b); padding: 30px; text-align: center; }
        .header-icon { font-size: 60px; animation: pulse 2s infinite; }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        .content { padding: 30px; }
        .alert-badge { display: inline-block; background: #dc2626; color: white; padding: 8px 16px; border-radius: 20px; font-weight: bold; font-size: 14px; margin-bottom: 20px; }
        .info-card { background: #1a1a2e; border-radius: 12px; padding: 20px; margin: 15px 0; border-left: 4px solid #dc2626; }
        .info-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #2a2a4e; }
        .info-row:last-child { border-bottom: none; }
        .info-label { color: #94a3b8; font-size: 13px; }
        .info-value { color: #ffffff; font-weight: 600; text-align: right; }
        .risk-factors { background: #450a0a; border-radius: 8px; padding: 15px; margin: 15px 0; }
        .risk-factor { display: flex; align-items: center; gap: 8px; padding: 5px 0; color: #fca5a5; font-size: 13px; }
        .location-map { background: #1a1a2e; border-radius: 12px; padding: 15px; margin: 15px 0; text-align: center; }
        .btn { display: inline-block; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; margin: 5px; }
        .btn-danger { background: #dc2626; color: white; }
        .btn-secondary { background: #3b82f6; color: white; }
        .footer { background: #0f0f1e; padding: 20px; text-align: center; font-size: 12px; color: #64748b; }
        .timestamp { color: #94a3b8; font-size: 11px; margin-top: 20px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="header-icon">🚨</div>
            <h1 style="margin:10px 0 0; font-size: 24px;">CRITICAL SECURITY ALERT</h1>
            <p style="margin:5px 0 0; opacity:0.9; font-size: 14px;">Login Shield AI™ has detected suspicious activity</p>
        </div>
        
        <div class="content">
            <div class="alert-badge">⚠️ {{ alert_type }}</div>
            
            <p style="color:#fca5a5; font-size: 16px; margin-bottom: 20px;">
                <strong>Immediate attention required!</strong> A {{ risk_level }} risk login attempt has been detected.
            </p>
            
            <!-- User Information -->
            <div class="info-card">
                <h4 style="margin:0 0 15px; color:#f97316;">👤 User Information</h4>
                <div class="info-row">
                    <span class="info-label">User Name</span>
                    <span class="info-value">{{ user_name }}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Email</span>
                    <span class="info-value">{{ user_email }}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Role</span>
                    <span class="info-value">{{ user_role }}</span>
                </div>
            </div>
            
            <!-- Location & Device -->
            <div class="info-card">
                <h4 style="margin:0 0 15px; color:#f97316;">📍 Location & Device</h4>
                <div class="info-row">
                    <span class="info-label">IP Address</span>
                    <span class="info-value" style="color:#ef4444;">{{ ip_address }}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Location</span>
                    <span class="info-value">{{ location_city }}, {{ location_country }}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">ISP</span>
                    <span class="info-value">{{ isp }}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Device</span>
                    <span class="info-value">{{ device_name }}</span>
                </div>
                {% if is_vpn %}
                <div class="info-row">
                    <span class="info-label">VPN/Proxy</span>
                    <span class="info-value" style="color:#ef4444;">⚠️ DETECTED</span>
                </div>
                {% endif %}
            </div>
            
            <!-- Risk Assessment -->
            <div class="info-card">
                <h4 style="margin:0 0 15px; color:#f97316;">🛡️ Risk Assessment</h4>
                <div class="info-row">
                    <span class="info-label">Risk Score</span>
                    <span class="info-value" style="color:#ef4444; font-size: 20px;">{{ risk_score }}/100</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Risk Level</span>
                    <span class="info-value" style="color:#ef4444;">🔴 {{ risk_level }}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Action Taken</span>
                    <span class="info-value">{{ action_taken }}</span>
                </div>
            </div>
            
            <!-- Risk Factors -->
            <div class="risk-factors">
                <h4 style="margin:0 0 10px; color:#ef4444;">⚠️ Risk Factors Detected</h4>
                {% for factor in risk_factors %}
                <div class="risk-factor">
                    <span>•</span>
                    <span>{{ factor }}</span>
                </div>
                {% endfor %}
            </div>
            
            <!-- Action Buttons -->
            <div style="text-align: center; margin-top: 25px;">
                <a href="{{ dashboard_url }}" class="btn btn-danger">🔒 View in Dashboard</a>
                <a href="{{ block_user_url }}" class="btn btn-secondary">🚫 Block User</a>
            </div>
            
            <p class="timestamp">
                Detected at: {{ timestamp }}<br>
                Alert ID: {{ alert_id }}<br>
                You are receiving this because you are an {{ recipient_role }}
            </p>
        </div>
        
        <div class="footer">
            <p><strong>AirYatra Login Shield AI™</strong></p>
            <p>Enterprise Security Operations Center</p>
            <p style="color:#ef4444; margin-top:10px;">This is an automated security alert. Do not reply to this email.</p>
            <p>© 2025 AirYatra Aviation Pvt. Ltd.</p>
        </div>
    </div>
</body>
</html>
"""
    },
    
    # ===== ACCOUNT LOCKOUT TEMPLATES =====
    "account_locked": {
        "subject": "🔒 Account Locked - Security Alert | AirYatra",
        "body": """
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; background: #1a1a2e; color: #ffffff; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: #16213e; border-radius: 16px; overflow: hidden; }
        .header { background: linear-gradient(135deg, #dc2626, #b91c1c); padding: 30px; text-align: center; }
        .header h1 { margin: 0; font-size: 24px; }
        .content { padding: 30px; }
        .alert-box { background: #7f1d1d; border: 2px solid #dc2626; border-radius: 12px; padding: 20px; margin: 15px 0; }
        .info-box { background: #1a1a2e; border-radius: 12px; padding: 20px; margin: 15px 0; }
        .info-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #2a2a4e; }
        .info-row:last-child { border-bottom: none; }
        .btn { display: inline-block; background: #22c55e; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; margin: 10px 5px; }
        .btn-secondary { background: #3b82f6; }
        .footer { background: #0f0f1e; padding: 20px; text-align: center; font-size: 12px; color: #64748b; }
        .warning { color: #fbbf24; font-weight: 600; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div style="font-size:60px;">🔒</div>
            <h1>Account Temporarily Locked</h1>
            <p style="margin:10px 0 0; opacity:0.9;">Security Protection Activated</p>
        </div>
        <div class="content">
            <div class="alert-box">
                <p style="margin:0; font-size:16px;">
                    <strong>⚠️ Multiple Failed Login Attempts Detected</strong>
                </p>
                <p style="margin:10px 0 0; opacity:0.9;">
                    Your AirYatra account has been temporarily locked after {{ max_attempts }} unsuccessful login attempts.
                </p>
            </div>
            
            <div class="info-box">
                <h3 style="margin-top:0; color:#f97316;">📋 Lockout Details</h3>
                <div class="info-row">
                    <span style="color:#94a3b8;">Account Email:</span>
                    <span style="font-weight:600;">{{ email }}</span>
                </div>
                <div class="info-row">
                    <span style="color:#94a3b8;">IP Address:</span>
                    <span style="font-weight:600;">{{ ip_address }}</span>
                </div>
                <div class="info-row">
                    <span style="color:#94a3b8;">Auto-Unlock In:</span>
                    <span style="font-weight:600; color:#22c55e;">{{ lockout_minutes }} minutes</span>
                </div>
                <div class="info-row">
                    <span style="color:#94a3b8;">Timestamp:</span>
                    <span style="font-weight:600;">{{ timestamp }}</span>
                </div>
            </div>
            
            <p style="color:#94a3b8;">If this was you, simply wait {{ lockout_minutes }} minutes or click the button below to unlock immediately:</p>
            
            <p style="text-align:center; margin:25px 0;">
                <a href="{{ unlock_url }}" class="btn">🔓 Unlock My Account</a>
            </p>
            
            <div class="info-box" style="border: 1px solid #fbbf24;">
                <p style="margin:0; color:#fbbf24;">
                    <strong>⚠️ Wasn't You?</strong>
                </p>
                <p style="margin:10px 0 0; color:#94a3b8;">
                    If you did not attempt these logins, someone may be trying to access your account. We recommend:
                </p>
                <ul style="color:#94a3b8; margin:10px 0 0; padding-left:20px;">
                    <li>Change your password immediately after unlocking</li>
                    <li>Enable Two-Factor Authentication (2FA)</li>
                    <li>Review your recent login activity</li>
                </ul>
            </div>
            
            <p style="color:#64748b; font-size:12px; margin-top:20px;">
                This unlock link expires in 60 minutes. If it expires, you can wait for auto-unlock or contact support.
            </p>
        </div>
        <div class="footer">
            <p><strong>AirYatra Security Team</strong></p>
            <p>This is an automated security notification.</p>
            <p>© 2025 AirYatra Aviation Pvt. Ltd.</p>
        </div>
    </div>
</body>
</html>
"""
    },
}

# ==================== EMAIL SERVICE CLASS ====================

class EmailService:
    """AirYatra Email Service with SMTP"""
    
    def __init__(self):
        self.config = SMTP_CONFIG
        self.templates = EMAIL_TEMPLATES
        self.jinja_env = Environment(loader=BaseLoader())
        
    def _render_template(self, template_str: str, data: Dict[str, Any]) -> str:
        """Render Jinja2 template with data"""
        try:
            template = self.jinja_env.from_string(template_str)
            return template.render(**data)
        except Exception as e:
            logger.error(f"Template rendering error: {e}")
            return template_str
    
    async def send_email(
        self,
        to_email: str,
        subject: str,
        html_body: str,
        cc: Optional[List[str]] = None,
        bcc: Optional[List[str]] = None,
        attachments: Optional[List[Dict]] = None
    ) -> Dict[str, Any]:
        """Send email via SMTP"""
        try:
            # Create message
            msg = MIMEMultipart('alternative')
            msg['From'] = f"{self.config['from_name']} <{self.config['from_email']}>"
            msg['To'] = to_email
            msg['Subject'] = subject
            
            if cc:
                msg['Cc'] = ', '.join(cc)
            
            # Attach HTML body
            html_part = MIMEText(html_body, 'html', 'utf-8')
            msg.attach(html_part)
            
            # Add attachments if any
            if attachments:
                for attachment in attachments:
                    part = MIMEBase('application', 'octet-stream')
                    part.set_payload(attachment['content'])
                    encoders.encode_base64(part)
                    part.add_header('Content-Disposition', f"attachment; filename={attachment['filename']}")
                    msg.attach(part)
            
            # Collect all recipients
            recipients = [to_email]
            if cc:
                recipients.extend(cc)
            if bcc:
                recipients.extend(bcc)
            
            # Create SSL context
            context = ssl.create_default_context()
            
            # Check if using STARTTLS (Gmail) or direct TLS (Hostinger)
            use_starttls = self.config.get('start_tls', False)
            use_direct_tls = self.config.get('use_tls', True) and not use_starttls
            
            # Send email
            await aiosmtplib.send(
                msg,
                hostname=self.config['host'],
                port=self.config['port'],
                username=self.config['username'],
                password=self.config['password'],
                use_tls=use_direct_tls,
                start_tls=use_starttls,
                tls_context=context
            )
            
            logger.info(f"Email sent successfully to {to_email}: {subject}")
            return {"success": True, "message": "Email sent successfully"}
            
        except Exception as e:
            logger.error(f"Failed to send email to {to_email}: {str(e)}")
            return {"success": False, "error": str(e)}
    
    async def send_email_with_attachment(
        self,
        to_email: str,
        subject: str,
        html_content: str,
        attachment_content: bytes,
        attachment_filename: str,
        attachment_type: str = "application/pdf"
    ) -> Dict[str, Any]:
        """
        Simplified method to send email with a single attachment.
        Used by scheduled reports.
        """
        attachments = [{
            "content": attachment_content,
            "filename": attachment_filename
        }]
        
        return await self.send_email(
            to_email=to_email,
            subject=subject,
            html_body=html_content,
            attachments=attachments
        )
    
    async def send_template_email(
        self,
        template_name: str,
        to_email: str,
        data: Dict[str, Any],
        cc: Optional[List[str]] = None,
        bcc: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """Send email using predefined template"""
        
        if template_name not in self.templates:
            logger.error(f"Template not found: {template_name}")
            return {"success": False, "error": f"Template '{template_name}' not found"}
        
        template = self.templates[template_name]
        
        # Render subject and body
        subject = self._render_template(template['subject'], data)
        body = self._render_template(template['body'], data)
        
        return await self.send_email(to_email, subject, body, cc, bcc)
    
    # ==================== CONVENIENCE METHODS ====================
    
    async def send_inquiry_emails(self, inquiry_data: Dict[str, Any], operators: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Send inquiry notification to customer, operators, and admin"""
        results = {"customer": None, "operators": [], "admin": None}
        
        # Common data
        base_data = {
            "inquiry_id": inquiry_data.get("id", "")[:8].upper(),
            "customer_name": inquiry_data.get("customer_name", "Customer"),
            "customer_email": inquiry_data.get("customer_email", ""),
            "customer_phone": inquiry_data.get("customer_phone", ""),
            "pickup_location": inquiry_data.get("pickup_location", ""),
            "drop_location": inquiry_data.get("drop_location", ""),
            "departure_date": inquiry_data.get("departure_date", ""),
            "departure_time": inquiry_data.get("pickup_time", ""),
            "passenger_count": inquiry_data.get("total_passengers", 1),
            "flight_type": inquiry_data.get("udan_prakar", "one_way"),
            "booking_purpose": inquiry_data.get("booking_purpose", "personal"),
            "distance_km": inquiry_data.get("distance_km", 0),
            "estimated_price": f"{inquiry_data.get('estimated_price', 0):,}",
            "tracking_url": f"https://airyatra.co.in/inquiry/{inquiry_data.get('id', '')}",
            "status": inquiry_data.get("status", "pending"),
        }
        
        # 1. Send to Customer
        if inquiry_data.get("customer_email"):
            results["customer"] = await self.send_template_email(
                "inquiry_customer",
                inquiry_data["customer_email"],
                base_data
            )
        
        # 2. Send to Operators
        for operator in operators:
            operator_data = {
                **base_data,
                "operator_name": operator.get("company_name", "Operator"),
                "operator_earning": f"{int(inquiry_data.get('estimated_price', 0) * 0.88):,}",
                "quote_url": f"https://airyatra.co.in/operator/quote/{inquiry_data.get('id', '')}",
                "dashboard_url": "https://airyatra.co.in/operator/dashboard",
            }
            
            if operator.get("email"):
                result = await self.send_template_email(
                    "inquiry_operator",
                    operator["email"],
                    operator_data
                )
                results["operators"].append({"email": operator["email"], "result": result})
        
        # 3. Send to Admin
        admin_data = {
            **base_data,
            "platform_commission": f"{int(inquiry_data.get('estimated_price', 0) * 0.12):,}",
            "operators_notified": len(operators),
            "admin_url": "https://airyatra.co.in/admin/inquiries",
        }
        results["admin"] = await self.send_template_email(
            "inquiry_admin",
            "admin@airyatra.co.in",
            admin_data
        )
        
        return results
    
    async def send_booking_confirmed_emails(self, booking_data: Dict[str, Any]) -> Dict[str, Any]:
        """Send booking confirmation to customer, operator, and admin"""
        results = {"customer": None, "operator": None, "admin": None}
        
        base_data = {
            "booking_id": booking_data.get("id", "")[:8].upper(),
            "customer_name": booking_data.get("customer_name", "Customer"),
            "customer_email": booking_data.get("customer_email", ""),
            "customer_phone": booking_data.get("customer_phone", ""),
            "pickup_location": booking_data.get("pickup_location", ""),
            "drop_location": booking_data.get("drop_location", ""),
            "departure_date": booking_data.get("departure_date", ""),
            "departure_time": booking_data.get("pickup_time", ""),
            "passenger_count": booking_data.get("total_passengers", 1),
            "booking_purpose": booking_data.get("booking_purpose", "personal"),
            "total_amount": f"{booking_data.get('total_amount', 0):,}",
            "amount_paid": f"{booking_data.get('amount_paid', 0):,}",
            "operator_name": booking_data.get("operator_name", ""),
            "operator_phone": booking_data.get("operator_phone", ""),
            "helicopter_model": booking_data.get("helicopter_model", ""),
            "pilot_name": booking_data.get("pilot_name", "To be assigned"),
            "operator_payout": f"{booking_data.get('operator_payout', 0):,}",
            "platform_commission": f"{booking_data.get('platform_commission', 0):,}",
            "payment_method": booking_data.get("payment_method", ""),
            "transaction_id": booking_data.get("transaction_id", ""),
            "booking_url": f"https://airyatra.co.in/booking/{booking_data.get('id', '')}",
            "dashboard_url": "https://airyatra.co.in/operator/dashboard",
        }
        
        # 1. Customer
        if booking_data.get("customer_email"):
            results["customer"] = await self.send_template_email(
                "booking_confirmed_customer",
                booking_data["customer_email"],
                base_data
            )
        
        # 2. Operator
        if booking_data.get("operator_email"):
            results["operator"] = await self.send_template_email(
                "booking_confirmed_operator",
                booking_data["operator_email"],
                base_data
            )
        
        # 3. Admin
        results["admin"] = await self.send_template_email(
            "booking_confirmed_admin",
            "admin@airyatra.co.in",
            base_data
        )
        
        return results
    
    async def send_quote_email(self, quote_data: Dict[str, Any]) -> Dict[str, Any]:
        """Send quote notification to customer"""
        data = {
            "inquiry_id": quote_data.get("inquiry_id", "")[:8].upper(),
            "customer_name": quote_data.get("customer_name", "Customer"),
            "quoted_price": f"{quote_data.get('quoted_price', 0):,}",
            "operator_name": quote_data.get("operator_name", ""),
            "operator_company": quote_data.get("operator_company", ""),
            "operator_rating": quote_data.get("operator_rating", "4.5"),
            "helicopter_model": quote_data.get("helicopter_model", ""),
            "quote_validity": quote_data.get("validity", "24 hours"),
            "base_price": f"{quote_data.get('base_price', 0):,}",
            "taxes": f"{quote_data.get('taxes', 0):,}",
            "accept_url": f"https://airyatra.co.in/quote/accept/{quote_data.get('quote_id', '')}",
            "compare_url": f"https://airyatra.co.in/inquiry/{quote_data.get('inquiry_id', '')}",
        }
        
        return await self.send_template_email(
            "quote_customer",
            quote_data.get("customer_email", ""),
            data
        )
    
    async def send_payment_receipt(self, payment_data: Dict[str, Any]) -> Dict[str, Any]:
        """Send payment receipt to customer"""
        data = {
            "customer_name": payment_data.get("customer_name", "Customer"),
            "booking_id": payment_data.get("booking_id", "")[:8].upper(),
            "receipt_no": payment_data.get("receipt_no", ""),
            "amount": f"{payment_data.get('amount', 0):,}",
            "payment_method": payment_data.get("payment_method", ""),
            "transaction_id": payment_data.get("transaction_id", ""),
            "payment_date": payment_data.get("payment_date", datetime.now().strftime("%d %b %Y, %I:%M %p")),
        }
        
        return await self.send_template_email(
            "payment_received_customer",
            payment_data.get("customer_email", ""),
            data
        )
    
    async def send_cancellation_emails(self, cancellation_data: Dict[str, Any]) -> Dict[str, Any]:
        """Send cancellation notification to customer"""
        data = {
            "customer_name": cancellation_data.get("customer_name", "Customer"),
            "booking_id": cancellation_data.get("booking_id", "")[:8].upper(),
            "original_amount": f"{cancellation_data.get('original_amount', 0):,}",
            "cancellation_charge": f"{cancellation_data.get('cancellation_charge', 0):,}",
            "refund_amount": f"{cancellation_data.get('refund_amount', 0):,}",
            "cancellation_reason": cancellation_data.get("reason", "Customer requested"),
        }
        
        return await self.send_template_email(
            "booking_cancelled_customer",
            cancellation_data.get("customer_email", ""),
            data
        )
    
    async def send_flight_completed_emails(self, booking_data: Dict[str, Any]) -> Dict[str, Any]:
        """Send flight completion emails"""
        results = {"customer": None, "operator": None}
        
        # Customer - Feedback request
        customer_data = {
            "customer_name": booking_data.get("customer_name", "Customer"),
            "review_url": f"https://airyatra.co.in/review/{booking_data.get('id', '')}",
        }
        
        if booking_data.get("customer_email"):
            results["customer"] = await self.send_template_email(
                "flight_completed_customer",
                booking_data["customer_email"],
                customer_data
            )
        
        # Operator - Payout info
        operator_data = {
            "operator_name": booking_data.get("operator_name", ""),
            "booking_id": booking_data.get("id", "")[:8].upper(),
            "payout_amount": f"{booking_data.get('operator_payout', 0):,}",
        }
        
        if booking_data.get("operator_email"):
            results["operator"] = await self.send_template_email(
                "flight_completed_operator",
                booking_data["operator_email"],
                operator_data
            )
        
        return results
    
    # ===== OTP / SECURITY EMAIL METHODS =====
    
    async def send_otp_email(
        self,
        to_email: str,
        user_name: str,
        otp_code: str,
        expiry_minutes: int = 5,
        device_info: str = "Unknown",
        ip_address: str = "Unknown"
    ) -> Dict[str, Any]:
        """Send OTP email for login verification"""
        from datetime import datetime
        
        data = {
            "user_name": user_name,
            "otp_code": otp_code,
            "expiry_minutes": expiry_minutes,
            "device_info": device_info,
            "ip_address": ip_address,
            "timestamp": datetime.now().strftime("%d %b %Y, %I:%M %p IST"),
        }
        
        return await self.send_template_email("otp_login", to_email, data)
    
    async def send_new_device_alert(
        self,
        to_email: str,
        user_name: str,
        device_name: str,
        ip_address: str,
        location: str = "Unknown"
    ) -> Dict[str, Any]:
        """Send alert when login from new device"""
        from datetime import datetime
        
        data = {
            "user_name": user_name,
            "device_name": device_name,
            "ip_address": ip_address,
            "location": location,
            "timestamp": datetime.now().strftime("%d %b %Y, %I:%M %p IST"),
            "secure_account_url": "https://airyatra.co.in/account/security",
            "sessions_url": "https://airyatra.co.in/account/sessions",
        }
        
        return await self.send_template_email("new_device_login", to_email, data)
    
    async def send_device_trusted_email(
        self,
        to_email: str,
        user_name: str,
        device_name: str,
        trust_days: int,
        expires_at: str
    ) -> Dict[str, Any]:
        """Send confirmation when device is trusted"""
        data = {
            "user_name": user_name,
            "device_name": device_name,
            "trust_days": trust_days,
            "expires_at": expires_at,
        }
        
        return await self.send_template_email("device_trusted", to_email, data)

    async def send_account_locked_email(
        self,
        to_email: str,
        unlock_token: str,
        lockout_minutes: int = 30,
        ip_address: str = "Unknown"
    ) -> Dict[str, Any]:
        """Send account locked notification with unlock link"""
        from datetime import datetime
        import os
        
        # Generate unlock URL
        frontend_url = os.environ.get("FRONTEND_URL", "https://airyatra-corporate.preview.emergentagent.com")
        unlock_url = f"{frontend_url}/unlock-account?email={to_email}&token={unlock_token}"
        
        data = {
            "email": to_email,
            "max_attempts": 5,
            "lockout_minutes": lockout_minutes,
            "ip_address": ip_address,
            "timestamp": datetime.now().strftime("%d %b %Y, %I:%M %p IST"),
            "unlock_url": unlock_url,
        }
        
        return await self.send_template_email("account_locked", to_email, data)


    async def send_payment_receipt_with_pdf(
        self,
        to_email: str,
        customer_name: str,
        txn: Dict[str, Any],
        booking: Dict[str, Any],
        pdf_bytes: bytes
    ) -> Dict[str, Any]:
        """Send payment receipt email with PDF attachment"""
        
        payment_type_label = "Remaining Balance" if txn.get("payment_type") == "balance" else "Advance Payment"
        receipt_no = f"AYR-{txn.get('id', '')[:8].upper()}"
        amount = txn.get("amount", 0)
        paid_at = (txn.get("updated_at") or "")[:19].replace("T", " ")
        route = f"{booking.get('from_location', '')} → {booking.get('to_location', '')}"
        booking_ref = booking.get('inquiry_number') or booking.get('booking_number') or txn.get('booking_id', '')[:12]
        
        subject = f"💳 Payment Receipt {receipt_no} - ₹{amount:,.0f} | AirYatra"
        
        html_body = f"""
<!DOCTYPE html>
<html>
<head>
    <style>
        body {{ font-family: 'Segoe UI', Arial, sans-serif; background: #1a1a2e; color: #ffffff; margin: 0; padding: 20px; }}
        .container {{ max-width: 600px; margin: 0 auto; background: #16213e; border-radius: 16px; overflow: hidden; }}
        .header {{ background: linear-gradient(135deg, #22c55e, #16a34a); padding: 30px; text-align: center; }}
        .content {{ padding: 30px; }}
        .receipt-box {{ background: #1a1a2e; border-radius: 12px; padding: 20px; margin: 15px 0; border: 2px dashed #22c55e; }}
        .info-row {{ display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #2a2a4e; }}
        .info-row:last-child {{ border-bottom: none; }}
        .highlight {{ color: #22c55e; font-weight: 600; }}
        .amount {{ font-size: 28px; font-weight: bold; color: #22c55e; }}
        .footer {{ background: #0f0f1e; padding: 20px; text-align: center; font-size: 12px; color: #64748b; }}
        .btn {{ display: inline-block; background: #f97316; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin-top: 15px; }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div style="font-size:50px;">✅</div>
            <h1 style="margin:10px 0 0;">Payment Successful!</h1>
            <p style="margin:5px 0 0; opacity:0.9;">{payment_type_label}</p>
        </div>
        <div class="content">
            <p>Namaste <strong>{customer_name}</strong>,</p>
            <p>Aapka payment successfully receive ho gaya hai. PDF Receipt attached hai, download karke apne records mein rakhein.</p>
            
            <div class="receipt-box">
                <h3 style="margin-top:0; color:#22c55e; text-align:center;">🧾 Payment Summary</h3>
                <div class="info-row">
                    <span style="color:#94a3b8;">Receipt No:</span>
                    <span class="highlight">{receipt_no}</span>
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
                    <span style="color:#94a3b8;">Payment Type:</span>
                    <span style="font-weight:600;">{payment_type_label}</span>
                </div>
                <div class="info-row">
                    <span style="color:#94a3b8;">Amount Paid:</span>
                    <span class="amount">₹{amount:,.0f}</span>
                </div>
                <div class="info-row">
                    <span style="color:#94a3b8;">Date & Time:</span>
                    <span style="font-weight:600;">{paid_at} UTC</span>
                </div>
                <div class="info-row">
                    <span style="color:#94a3b8;">Gateway:</span>
                    <span style="font-weight:600;">Stripe (Secure)</span>
                </div>
            </div>
            
            <p style="color:#fbbf24; font-size:14px; background:#422006; padding:15px; border-radius:8px; margin-top:20px;">
                📎 <strong>PDF Receipt attached</strong> - Please save it for your records and tax purposes.
            </p>
            
            <p style="text-align:center;">
                <a href="https://airyatra.co.in/customer/inquiries" class="btn">View My Bookings</a>
            </p>
        </div>
        <div class="footer">
            <p>AirYatra - India's Premium Helicopter Booking Platform</p>
            <p>📞 Support: info@airyatra.co.in</p>
            <p>© 2025 AirYatra Aviation Pvt. Ltd. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
"""
        
        # Prepare attachment
        attachments = [{
            "filename": f"AirYatra_Receipt_{receipt_no}.pdf",
            "content": pdf_bytes,
        }]
        
        return await self.send_email(
            to_email=to_email,
            subject=subject,
            html_body=html_body,
            attachments=attachments
        )

    async def send_booking_confirmation(
        self,
        to_email: str,
        booking_data: dict
    ) -> Dict[str, Any]:
        """Send booking confirmation email with PDF receipt attachment"""
        from services.pdf_service import pdf_service
        
        customer_name = booking_data.get('customer_name', booking_data.get('name', 'Customer'))
        booking_id = booking_data.get('booking_id', booking_data.get('id', 'N/A'))
        route = f"{booking_data.get('from_location', booking_data.get('origin', 'N/A'))} → {booking_data.get('to_location', booking_data.get('destination', 'N/A'))}"
        travel_date = booking_data.get('travel_date', booking_data.get('departure_date', 'N/A'))
        total_amount = booking_data.get('total_amount', booking_data.get('amount', 0))
        
        subject = f"✈️ Booking Confirmed #{booking_id} | AirYatra"
        
        html_body = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {{ font-family: 'Segoe UI', Arial, sans-serif; background: #1a1a2e; color: #ffffff; margin: 0; padding: 20px; }}
                .container {{ max-width: 600px; margin: 0 auto; background: #16213e; border-radius: 16px; overflow: hidden; }}
                .header {{ background: linear-gradient(135deg, #f97316, #ea580c); padding: 30px; text-align: center; }}
                .header h1 {{ margin: 0; font-size: 28px; color: white; }}
                .header p {{ margin: 10px 0 0; color: rgba(255,255,255,0.9); }}
                .content {{ padding: 30px; }}
                .booking-id {{ background: #1a1a2e; border-radius: 12px; padding: 15px; text-align: center; margin-bottom: 25px; }}
                .booking-id .label {{ color: #64748b; font-size: 12px; }}
                .booking-id .value {{ color: #f97316; font-size: 24px; font-weight: bold; }}
                .flight-card {{ background: #1a1a2e; border-radius: 12px; padding: 20px; margin-bottom: 20px; }}
                .route {{ display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; }}
                .city {{ text-align: center; }}
                .city .name {{ font-size: 20px; font-weight: bold; color: white; }}
                .city .label {{ font-size: 11px; color: #64748b; }}
                .arrow {{ color: #f97316; font-size: 24px; }}
                .detail-row {{ display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #2a2a4e; }}
                .detail-row:last-child {{ border-bottom: none; }}
                .detail-label {{ color: #64748b; }}
                .detail-value {{ color: white; font-weight: 600; }}
                .total {{ background: linear-gradient(135deg, #f97316, #ea580c); border-radius: 12px; padding: 20px; text-align: center; margin: 20px 0; }}
                .total .label {{ color: rgba(255,255,255,0.8); font-size: 14px; }}
                .total .amount {{ font-size: 32px; font-weight: bold; color: white; }}
                .cta-button {{ display: block; background: #22c55e; color: white; text-align: center; padding: 15px 30px; border-radius: 8px; text-decoration: none; font-weight: 600; margin: 20px 0; }}
                .footer {{ background: #0f0f1e; padding: 20px; text-align: center; }}
                .footer p {{ margin: 5px 0; color: #64748b; font-size: 12px; }}
                .attachment-note {{ background: #1e3a5f; border-radius: 8px; padding: 15px; margin-top: 20px; text-align: center; }}
                .attachment-note p {{ color: #94a3b8; margin: 0; font-size: 13px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>Booking Confirmed! 🎉</h1>
                    <p>Your AirYatra flight is booked</p>
                </div>
                
                <div class="content">
                    <p>Namaste <strong>{customer_name}</strong>,</p>
                    <p>Thank you for booking with AirYatra! Your flight has been confirmed.</p>
                    
                    <div class="booking-id">
                        <div class="label">BOOKING ID</div>
                        <div class="value">{booking_id}</div>
                    </div>
                    
                    <div class="flight-card">
                        <div class="route">
                            <div class="city">
                                <div class="name">{booking_data.get('from_location', booking_data.get('origin', 'N/A'))}</div>
                                <div class="label">DEPARTURE</div>
                            </div>
                            <div class="arrow">✈️</div>
                            <div class="city">
                                <div class="name">{booking_data.get('to_location', booking_data.get('destination', 'N/A'))}</div>
                                <div class="label">ARRIVAL</div>
                            </div>
                        </div>
                        
                        <div class="detail-row">
                            <span class="detail-label">Date</span>
                            <span class="detail-value">{travel_date}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Aircraft</span>
                            <span class="detail-value">{booking_data.get('aircraft_type', 'Helicopter')}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Passengers</span>
                            <span class="detail-value">{booking_data.get('passengers', booking_data.get('passenger_count', 1))}</span>
                        </div>
                    </div>
                    
                    <div class="total">
                        <div class="label">TOTAL AMOUNT</div>
                        <div class="amount">₹{total_amount:,.2f}</div>
                    </div>
                    
                    <div class="attachment-note">
                        <p>📎 Your detailed receipt is attached to this email as a PDF</p>
                    </div>
                    
                    <p style="color: #94a3b8; font-size: 13px; margin-top: 20px;">
                        <strong>Important:</strong><br>
                        • Please arrive at the helipad 30 minutes before departure<br>
                        • Carry a valid government-issued photo ID<br>
                        • Baggage limit: 7kg per passenger
                    </p>
                </div>
                
                <div class="footer">
                    <p>Questions? Contact us at support@airyatra.com</p>
                    <p>AirYatra Aviation Pvt Ltd</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        # Generate PDF receipt
        pdf_bytes = pdf_service.generate_booking_receipt(booking_data)
        
        attachments = [{
            "filename": f"AirYatra_Booking_{booking_id}.pdf",
            "content": pdf_bytes,
        }]
        
        return await self.send_email(
            to_email=to_email,
            subject=subject,
            html_body=html_body,
            attachments=attachments
        )


    async def send_password_reset_otp(
        self,
        to_email: str,
        user_name: str,
        otp_code: str,
        expiry_minutes: int = 5,
        ip_address: str = "Unknown"
    ) -> Dict[str, Any]:
        """Send OTP email for password reset"""
        from datetime import datetime
        
        subject = "🔐 AirYatra Password Reset OTP"
        
        html_body = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: Arial, sans-serif; background-color: #0f172a; margin: 0; padding: 40px 20px;">
            <div style="max-width: 500px; margin: 0 auto; background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); border-radius: 16px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.3);">
                <!-- Header -->
                <div style="background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); padding: 30px; text-align: center;">
                    <h1 style="color: white; margin: 0; font-size: 28px;">🔐 Password Reset</h1>
                    <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 14px;">पासवर्ड रीसेट</p>
                </div>
                
                <!-- Content -->
                <div style="padding: 40px 30px;">
                    <p style="color: #e2e8f0; font-size: 16px; margin-bottom: 20px;">
                        Hello <strong>{user_name}</strong>,
                    </p>
                    
                    <p style="color: #94a3b8; font-size: 14px; margin-bottom: 30px;">
                        We received a request to reset your password. Use the OTP below to proceed:
                    </p>
                    
                    <!-- OTP Box -->
                    <div style="background: #1e293b; border: 2px solid #f97316; border-radius: 12px; padding: 25px; text-align: center; margin-bottom: 30px;">
                        <p style="color: #94a3b8; font-size: 12px; margin: 0 0 10px 0; text-transform: uppercase; letter-spacing: 1px;">Your OTP Code</p>
                        <p style="color: #f97316; font-size: 36px; font-weight: bold; letter-spacing: 8px; margin: 0; font-family: monospace;">{otp_code}</p>
                        <p style="color: #94a3b8; font-size: 12px; margin: 10px 0 0 0;">⏱️ Valid for {expiry_minutes} minutes</p>
                    </div>
                    
                    <!-- Security Notice -->
                    <div style="background: rgba(239, 68, 68, 0.1); border-left: 4px solid #ef4444; padding: 15px; margin-bottom: 20px;">
                        <p style="color: #f87171; font-size: 13px; margin: 0;">
                            ⚠️ If you didn't request this, please ignore this email or contact support immediately.
                        </p>
                    </div>
                    
                    <p style="color: #64748b; font-size: 12px;">
                        Request IP: {ip_address}<br>
                        Time: {datetime.now().strftime("%d %b %Y, %I:%M %p IST")}
                    </p>
                </div>
                
                <!-- Footer -->
                <div style="background: #0f172a; padding: 20px; text-align: center; border-top: 1px solid #1e293b;">
                    <p style="color: #64748b; font-size: 12px; margin: 0;">
                        AirYatra Aviation Pvt Ltd<br>
                        Need help? Contact support@airyatra.co.in
                    </p>
                </div>
            </div>
        </body>
        </html>
        """
        
        return await self.send_email(
            to_email=to_email,
            subject=subject,
            html_body=html_body
        )

    async def send_password_changed_confirmation(
        self,
        to_email: str,
        user_name: str,
        ip_address: str = "Unknown"
    ) -> Dict[str, Any]:
        """Send confirmation email when password is changed"""
        from datetime import datetime
        
        subject = "✅ AirYatra Password Changed Successfully"
        
        html_body = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: Arial, sans-serif; background-color: #0f172a; margin: 0; padding: 40px 20px;">
            <div style="max-width: 500px; margin: 0 auto; background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); border-radius: 16px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.3);">
                <!-- Header -->
                <div style="background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); padding: 30px; text-align: center;">
                    <h1 style="color: white; margin: 0; font-size: 28px;">✅ Password Changed</h1>
                    <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 14px;">पासवर्ड बदल गया</p>
                </div>
                
                <!-- Content -->
                <div style="padding: 40px 30px;">
                    <p style="color: #e2e8f0; font-size: 16px; margin-bottom: 20px;">
                        Hello <strong>{user_name}</strong>,
                    </p>
                    
                    <p style="color: #94a3b8; font-size: 14px; margin-bottom: 20px;">
                        Your password has been successfully changed. You can now login with your new password.
                    </p>
                    
                    <div style="background: #1e293b; border-radius: 12px; padding: 20px; margin-bottom: 20px;">
                        <p style="color: #64748b; font-size: 12px; margin: 0;">
                            📍 Changed from IP: {ip_address}<br>
                            🕐 Time: {datetime.now().strftime("%d %b %Y, %I:%M %p IST")}
                        </p>
                    </div>
                    
                    <!-- Security Notice -->
                    <div style="background: rgba(239, 68, 68, 0.1); border-left: 4px solid #ef4444; padding: 15px; margin-bottom: 20px;">
                        <p style="color: #f87171; font-size: 13px; margin: 0;">
                            ⚠️ If you didn't make this change, please contact support immediately at support@airyatra.co.in
                        </p>
                    </div>
                    
                    <a href="https://airyatra.co.in/login" style="display: inline-block; background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); color: white; text-decoration: none; padding: 12px 30px; border-radius: 8px; font-weight: bold;">
                        Login Now →
                    </a>
                </div>
                
                <!-- Footer -->
                <div style="background: #0f172a; padding: 20px; text-align: center; border-top: 1px solid #1e293b;">
                    <p style="color: #64748b; font-size: 12px; margin: 0;">
                        AirYatra Aviation Pvt Ltd
                    </p>
                </div>
            </div>
        </body>
        </html>
        """
        
        return await self.send_email(
            to_email=to_email,
            subject=subject,
            html_body=html_body
        )


# Singleton instance
email_service = EmailService()
