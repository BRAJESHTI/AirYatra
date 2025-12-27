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
    "host": os.environ.get("SMTP_HOST", "mail.airyatra.co.in"),
    "port": int(os.environ.get("SMTP_PORT", 465)),
    "username": os.environ.get("SMTP_USER", "info@airyatra.co.in"),
    "password": os.environ.get("SMTP_PASSWORD", ""),
    "from_email": os.environ.get("SMTP_FROM_EMAIL", "info@airyatra.co.in"),
    "from_name": os.environ.get("SMTP_FROM_NAME", "AirYatra"),
    "use_tls": True,  # SSL on port 465
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
            
            # Send email
            await aiosmtplib.send(
                msg,
                hostname=self.config['host'],
                port=self.config['port'],
                username=self.config['username'],
                password=self.config['password'],
                use_tls=True,
                tls_context=context
            )
            
            logger.info(f"Email sent successfully to {to_email}: {subject}")
            return {"success": True, "message": "Email sent successfully"}
            
        except Exception as e:
            logger.error(f"Failed to send email to {to_email}: {str(e)}")
            return {"success": False, "error": str(e)}
    
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


# Singleton instance
email_service = EmailService()
