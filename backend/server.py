from fastapi import FastAPI, APIRouter
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from starlette.middleware.gzip import GZipMiddleware
from pathlib import Path
import os
import logging
from database import connect_to_mongo, close_mongo_connection
from scheduler import start_scheduler, stop_scheduler

# Alert Scheduler for Template Performance Alerts
try:
    from services.alert_scheduler_service import start_scheduler as start_alert_scheduler, stop_scheduler as stop_alert_scheduler
    ALERT_SCHEDULER_AVAILABLE = True
except ImportError:
    ALERT_SCHEDULER_AVAILABLE = False
    start_alert_scheduler = lambda: None
    stop_alert_scheduler = lambda: None

# High-Performance Modules (50K+ users)
from ultra_performance_middleware import (
    FastCacheMiddleware,
    FastRateLimitMiddleware,
    FastHeadersMiddleware,
    KeepaliveMiddleware,
    get_performance_stats
)
from db_optimization import optimize_database

# Security Middleware (Rate Limiting, Audit Logging, Session, Encryption)
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from security_middleware import limiter, init_security_middleware

# Import route modules
from routes import auth_routes, booking_routes, quote_routes, fleet_routes
from routes import document_routes, admin_routes, ai_routes, payment_routes, operator_routes
from routes import pilot_document_routes, aircraft_document_routes
from routes import flight_record_routes, fuel_record_routes, live_tracking_routes, landing_permission_routes
from routes import admin_landing_permission_routes, admin_settlement_routes, admin_audit_routes
from routes import regional_manager_routes, notification_routes
from routes import settings_routes, chat_routes, feedback_routes, analytics_routes, customer_routes
from routes import pincode_routes, verification_routes, reports_routes, journey_routes
from routes import verification_gst_pan_routes
from routes import websocket_chat_routes
from routes import admin_user_routes, admin_operator_management_routes
from routes import admin_booking_management_routes, admin_approval_routes
from routes import pincode_live_routes, settlement_automation_routes
from routes import inquiry_broadcast_routes
from routes import google_auth_routes
from routes import landing_infrastructure_routes
from routes import referral_routes
from routes import crm_routes
from routes import scheduler_routes
from routes import hr_routes
from routes import hr_employee_routes
from routes import operator_erp_routes
from routes import stripe_payment_routes
from routes import field_tracking_routes
from routes import support_routes
from routes import reviews_routes
from routes import weather_routes
from routes import invoice_routes
from routes import loyalty_routes
from routes import aviation_exchange_routes
from routes import ceo_routes
from routes import partner_routes
from routes import marketing_routes
from routes import maintenance_routes
from routes import pricing_routes
from routes import route_optimization_routes
from routes import insurance_routes
from routes import knowledge_routes
from routes import sos_routes
# Production Advanced Features
from routes import flight_tracking_live_routes
from routes import document_verification_routes
from routes import multileg_booking_routes
from routes import inventory_routes
from routes import dgca_compliance_routes
# Medium Priority Features
from routes import push_notification_routes
from routes import boarding_pass_routes
from routes import currency_routes
from routes import predictive_analytics_routes
from routes import voice_video_routes
# Low Priority Features
from routes import chatbot_routes
from routes import two_factor_auth_routes
from routes import calendar_sync_routes
from routes import accounting_routes
# Advanced Integrations
from routes import twilio_routes
from routes import tally_routes
from routes import zoho_routes
# HR Advanced Features
from routes import hr_advanced_routes
# Payment Gateway & Auto Transfer
from routes import payment_gateway_routes
# GST Compliance
from routes import gst_routes
# Aviation-Grade Pricing Engine
from routes import pricing_engine_routes
# Email Service
from routes import email_routes
# Phase 1: Premium Services
from routes import membership_routes
from routes import corporate_routes
from routes import document_vault_routes
from routes import admin_payments_routes
from routes import search_routes
from routes import document_master_routes
from routes import customer_kyc_routes
from routes import kyc_verification_routes
from routes import ai_advisor_routes
from routes import pilot_mobile_routes
from routes import pilot_chat_routes
from routes import pilot_availability_routes
from routes import revenue_analytics_routes
# New Features: Notification Center, Command Center, AI Pricing
from routes import notification_center_routes
from routes import command_center_routes
from routes import ai_pricing_routes
from routes import content_routes
# Razorpay Payment Gateway
from routes import razorpay_routes
# AI Sales Advisor
from routes import ai_sales_routes
# AI Report Generator
from routes import ai_reports_routes
# Favorites/Bookmarks
from routes import favorites_routes
# Finance ERP - Treasury Management System
from routes import finance_treasury_routes
# Finance ERP - Advanced (Challans, Compliance, Reconciliation)
from routes import finance_advanced_routes
# Finance ERP - Phase 4 (Budget, AI Assistant, Reminders, Bills)
from routes import finance_phase4_routes
# Finance ERP - Phase 5 (Audit, PDF, Analytics, Multi-Currency)
from routes import finance_phase5_routes
# Finance ERP - Dashboard Analytics (Revenue Trends, Gateway Reconciliation)
from routes import finance_analytics_routes
# Finance ERP - Payment Reconciliation & Reports
from routes import finance_reconciliation_routes
# Finance ERP - Scheduled Reports & Settlement Sync
from routes import finance_scheduled_routes
# Smart Pricing & Legal - Phase 1
from routes import fixed_route_pricing_routes
from routes import legal_routes
# AI Reverse Auction - Phase 2
from routes import auction_routes
# Aircraft Catalog & Price Breakup - Phase 3-5
from routes import aircraft_catalog_routes
from routes import price_breakup_routes
# AI Compliance Monitor
from routes import compliance_monitor_routes
# Admin Document Verification
from routes import admin_document_routes
# Emergency Booking Priority System
from routes import emergency_booking_routes
# Verification Rule Engine
from routes import verification_engine_routes
# AI Smart Comparison
from routes import ai_comparison_routes
# AI Repositioning Engine (Fixed Routes + Reverse Auction)
from routes import ai_repositioning_routes
# Complete Verification Rule Engine (18-point system with Sandbox.co.in)
from routes import vre_routes
# API Control Center - Centralized API Management
from routes import api_control_routes
# Complaint Management & CSS Calculator
from routes import complaint_routes
from routes import css_routes
# Discount Management
from routes import discount_routes

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(
    title="AirYatra API",
    description="Helicopter and Air Charter Aggregator Platform",
    version="1.0.0"
)

# Security: Rate Limiting via slowapi
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS middleware - SECURITY: Use specific origins, not '*' in production
# Set CORS_ORIGINS in .env to restrict allowed origins
allowed_origins = os.environ.get('CORS_ORIGINS', 'https://aviation-erp-2.preview.emergentagent.com').split(',')
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=allowed_origins,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Requested-With"],
)

# ==================== HIGH-PERFORMANCE MIDDLEWARE STACK ====================
# Order matters! Processed in reverse order (bottom to top)

# 1. GZip Compression - Reduces response size by 60-80%
app.add_middleware(GZipMiddleware, minimum_size=500)

# 2. Connection Keepalive - Reuse connections
app.add_middleware(KeepaliveMiddleware)

# 3. Performance Headers - Timing & security headers
app.add_middleware(FastHeadersMiddleware)

# 4. Rate Limiting - 50 req/sec per user, burst 100 (supports 50K+ users)
app.add_middleware(FastRateLimitMiddleware)

# 5. Multi-Layer Response Caching - L1 (memory) + L2 (Redis)
app.add_middleware(FastCacheMiddleware)

# Create API router with /api prefix
api_router = APIRouter(prefix="/api")

# Include all route modules
api_router.include_router(auth_routes.router)
api_router.include_router(booking_routes.router)
api_router.include_router(quote_routes.router)
api_router.include_router(fleet_routes.router)
api_router.include_router(document_routes.router)
api_router.include_router(admin_routes.router)
api_router.include_router(ai_routes.router)
api_router.include_router(payment_routes.router)
api_router.include_router(operator_routes.router)
api_router.include_router(pilot_document_routes.router)
api_router.include_router(aircraft_document_routes.router)
api_router.include_router(flight_record_routes.router)
api_router.include_router(fuel_record_routes.router)
api_router.include_router(live_tracking_routes.router)
api_router.include_router(landing_permission_routes.router)
api_router.include_router(landing_infrastructure_routes.router)
api_router.include_router(admin_landing_permission_routes.router)
api_router.include_router(admin_settlement_routes.router)
api_router.include_router(admin_audit_routes.router)
api_router.include_router(regional_manager_routes.router)
api_router.include_router(notification_routes.router)
api_router.include_router(settings_routes.router)
api_router.include_router(chat_routes.router)
api_router.include_router(feedback_routes.router)
api_router.include_router(analytics_routes.router)
api_router.include_router(customer_routes.router)
api_router.include_router(pincode_routes.router)
api_router.include_router(verification_routes.router)
api_router.include_router(reports_routes.router)
api_router.include_router(journey_routes.router)
api_router.include_router(verification_gst_pan_routes.router)
api_router.include_router(websocket_chat_routes.router)
api_router.include_router(admin_user_routes.router)
api_router.include_router(referral_routes.router)
api_router.include_router(admin_operator_management_routes.router)
api_router.include_router(admin_booking_management_routes.router)
api_router.include_router(admin_approval_routes.router)
api_router.include_router(pincode_live_routes.router)
api_router.include_router(settlement_automation_routes.router)
api_router.include_router(inquiry_broadcast_routes.router)
api_router.include_router(google_auth_routes.router)
api_router.include_router(crm_routes.router)
api_router.include_router(scheduler_routes.router)
api_router.include_router(hr_routes.router)
api_router.include_router(hr_employee_routes.router)
api_router.include_router(operator_erp_routes.router)
api_router.include_router(stripe_payment_routes.router)
api_router.include_router(field_tracking_routes.router)
api_router.include_router(support_routes.router)
api_router.include_router(reviews_routes.router)
api_router.include_router(weather_routes.router)
api_router.include_router(invoice_routes.router)
api_router.include_router(loyalty_routes.router)
api_router.include_router(aviation_exchange_routes.router)
api_router.include_router(ceo_routes.router)
api_router.include_router(partner_routes.router)
api_router.include_router(partner_routes.api_router)
api_router.include_router(marketing_routes.router)
api_router.include_router(maintenance_routes.router)
api_router.include_router(search_routes.router)
api_router.include_router(pricing_routes.router)
api_router.include_router(route_optimization_routes.router)
api_router.include_router(insurance_routes.router)
api_router.include_router(knowledge_routes.router)
api_router.include_router(sos_routes.router)
# Production Advanced Features
api_router.include_router(flight_tracking_live_routes.router)
api_router.include_router(document_verification_routes.router)
api_router.include_router(multileg_booking_routes.router)
api_router.include_router(inventory_routes.router)
api_router.include_router(dgca_compliance_routes.router)
# Medium Priority Features
api_router.include_router(push_notification_routes.router)
api_router.include_router(boarding_pass_routes.router)
api_router.include_router(currency_routes.router)
api_router.include_router(predictive_analytics_routes.router)
api_router.include_router(voice_video_routes.router)
# Low Priority Features
api_router.include_router(chatbot_routes.router)
api_router.include_router(two_factor_auth_routes.router)
api_router.include_router(calendar_sync_routes.router)
api_router.include_router(accounting_routes.router)
# Advanced Integrations
api_router.include_router(twilio_routes.router)
api_router.include_router(tally_routes.router)
api_router.include_router(zoho_routes.router)
# HR Advanced Features
api_router.include_router(hr_advanced_routes.router)
# Payment Gateway & Auto Transfer
api_router.include_router(payment_gateway_routes.router)
# GST Compliance
api_router.include_router(gst_routes.router)
# Aviation-Grade Pricing Engine
api_router.include_router(pricing_engine_routes.router)
# Email Service
api_router.include_router(email_routes.router)
# Phase 1: Premium Services
api_router.include_router(membership_routes.router)
api_router.include_router(corporate_routes.router)
api_router.include_router(document_vault_routes.router)
api_router.include_router(admin_payments_routes.router)
# Document Master & Verification APIs
api_router.include_router(document_master_routes.router)
# Customer KYC Documents
api_router.include_router(customer_kyc_routes.router)
# KYC Verification Service (Sandbox Mode)
api_router.include_router(kyc_verification_routes.router)
# AI Business Advisor
api_router.include_router(ai_advisor_routes.router)

# Analytics Routes
from routes import route_intelligence_routes
from routes import predictive_maintenance_routes
from routes import hangar_management_routes
from routes import admin_analytics_routes
from routes import operations_map_routes
api_router.include_router(route_intelligence_routes.router)
api_router.include_router(predictive_maintenance_routes.router)
api_router.include_router(hangar_management_routes.router)
api_router.include_router(admin_analytics_routes.router)
api_router.include_router(operations_map_routes.router)

# Pilot Mobile Portal (PWA)
api_router.include_router(pilot_mobile_routes.router)

# Pilot Chat
api_router.include_router(pilot_chat_routes.router)

# Pilot Availability
api_router.include_router(pilot_availability_routes.router)

# Revenue Analytics
api_router.include_router(revenue_analytics_routes.router)

# Content & Blog Routes
from routes import content_routes
api_router.include_router(content_routes.router)

# New Features: Notification Center, Command Center, AI Pricing
api_router.include_router(notification_center_routes.router)
api_router.include_router(command_center_routes.router)
api_router.include_router(ai_pricing_routes.router)

# Razorpay Payment Gateway
api_router.include_router(razorpay_routes.router)

# AI Sales Advisor
api_router.include_router(ai_sales_routes.router)

# AI Report Generator
api_router.include_router(ai_reports_routes.router)

# Favorites/Bookmarks
api_router.include_router(favorites_routes.router)

# Finance ERP - Treasury Management System
api_router.include_router(finance_treasury_routes.router)

# Finance ERP - Advanced (Challans, Compliance, Reconciliation)
api_router.include_router(finance_advanced_routes.router)

# Finance ERP - Phase 4 (Budget, AI Assistant, Reminders, Bills)
api_router.include_router(finance_phase4_routes.router)

# Finance ERP - Phase 5 (Audit, PDF, Analytics, Multi-Currency)
api_router.include_router(finance_phase5_routes.router)

# Finance ERP - Dashboard Analytics (Revenue Trends, Gateway Reconciliation)
api_router.include_router(finance_analytics_routes.router)

# Finance ERP - Payment Reconciliation & Reports
api_router.include_router(finance_reconciliation_routes.router)

# Finance ERP - Scheduled Reports & Settlement Sync
api_router.include_router(finance_scheduled_routes.router)

# Smart Pricing & Legal - Phase 1
api_router.include_router(fixed_route_pricing_routes.router)
api_router.include_router(legal_routes.router)

# AI Reverse Auction - Phase 2
api_router.include_router(auction_routes.router)

# Aircraft Catalog & Price Breakup - Phase 3-5
api_router.include_router(aircraft_catalog_routes.router)
api_router.include_router(price_breakup_routes.router)

# AI Compliance Monitor
api_router.include_router(compliance_monitor_routes.router)

# Admin Document Verification
api_router.include_router(admin_document_routes.router)

# Emergency Booking Priority System
api_router.include_router(emergency_booking_routes.router)

# Verification Rule Engine
api_router.include_router(verification_engine_routes.router)

# AI Smart Comparison
api_router.include_router(ai_comparison_routes.router)

# AI Repositioning Engine
api_router.include_router(ai_repositioning_routes.router)

# Complete VRE (18-point Verification Rule Engine with Sandbox.co.in)
api_router.include_router(vre_routes.router)

# API Control Center - Centralized API Management
api_router.include_router(api_control_routes.router)

# Complaint Management & CSS Calculator
api_router.include_router(complaint_routes.router)
api_router.include_router(css_routes.router)

# Discount Management
api_router.include_router(discount_routes.router)

# Template Management
from routes import template_routes
api_router.include_router(template_routes.router)

# Include API router in main app
app.include_router(api_router)

# Create uploads directory for village documents
uploads_dir = Path("/app/uploads")
uploads_dir.mkdir(exist_ok=True)
village_docs_dir = uploads_dir / "village_documents"
village_docs_dir.mkdir(exist_ok=True)

# SECURITY: Create secure upload directory for sensitive files (KYC, etc.)
# These are NOT served via static mount - use authenticated download endpoints
secure_uploads_dir = Path("/app/secure_uploads")
secure_uploads_dir.mkdir(exist_ok=True)
(secure_uploads_dir / "kyc").mkdir(exist_ok=True)
(secure_uploads_dir / "pilot_documents").mkdir(exist_ok=True)

# Mount static files for NON-SENSITIVE uploads only (general assets, NOT KYC/documents)
# WARNING: Do NOT put sensitive files in /app/uploads - use secure_uploads instead
app.mount("/api/uploads", StaticFiles(directory=str(uploads_dir)), name="uploads")

# Health check endpoint
@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "airyatra-api",
        "version": "3.0.0-highperf",
        "capacity": "50K+ concurrent users",
        "optimizations": [
            "gzip-compression",
            "response-cache",
            "token-bucket-rate-limit",
            "connection-pooling-200",
            "57-db-indexes",
            "keepalive"
        ]
    }

# Performance stats endpoint
@app.get("/api/performance/stats")
async def performance_stats():
    """Get comprehensive performance statistics"""
    return {
        "performance": get_performance_stats(),
        "capacity": {
            "target_users": "50,000+",
            "rate_limit": "50 req/sec per user",
            "burst": "100 requests",
            "db_pool_size": 200
        }
    }

# Startup event
@app.on_event("startup")
async def startup_event():
    logger.info("Starting AirYatra High-Performance API...")
    
    # Connect to MongoDB with optimized pool
    await connect_to_mongo()
    
    # Optimize database with indexes
    try:
        result = await optimize_database()
        logger.info(f"Database optimization complete: {result}")
    except Exception as e:
        logger.warning(f"Database optimization warning: {e}")
    
    # Initialize Security Middleware (Audit Logger, Session Manager, File Encryption)
    try:
        from database import get_database
        db = get_database()
        security_components = init_security_middleware(app, db)
        logger.info(f"Security middleware initialized: {list(security_components.keys())}")
    except Exception as e:
        logger.warning(f"Security middleware init warning: {e}")
    
    start_scheduler()
    
    # Start Alert Scheduler for Template Performance Monitoring
    if ALERT_SCHEDULER_AVAILABLE:
        try:
            start_alert_scheduler()
            logger.info("Alert scheduler started for template performance monitoring")
        except Exception as e:
            logger.warning(f"Alert scheduler start warning: {e}")
    
    logger.info("AirYatra API started - Ready for 50K+ concurrent users!")

# Shutdown event
@app.on_event("shutdown")
async def shutdown_event():
    logger.info("Shutting down AirYatra API...")
    stop_scheduler()
    if ALERT_SCHEDULER_AVAILABLE:
        stop_alert_scheduler()
    await close_mongo_connection()
    logger.info("AirYatra API shut down successfully")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)