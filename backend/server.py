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

# High-Performance Modules (50K+ users)
from ultra_performance_middleware import (
    FastCacheMiddleware,
    FastRateLimitMiddleware,
    FastHeadersMiddleware,
    KeepaliveMiddleware,
    get_performance_stats
)
from db_optimization import optimize_database

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
from routes import field_tracking_routes
from routes import support_routes
from routes import reviews_routes
from routes import weather_routes
from routes import invoice_routes
from routes import loyalty_routes
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

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
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
api_router.include_router(field_tracking_routes.router)
api_router.include_router(support_routes.router)
api_router.include_router(reviews_routes.router)
api_router.include_router(weather_routes.router)
api_router.include_router(invoice_routes.router)
api_router.include_router(loyalty_routes.router)
api_router.include_router(marketing_routes.router)
api_router.include_router(maintenance_routes.router)
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

# Include API router in main app
app.include_router(api_router)

# Create uploads directory for village documents
uploads_dir = Path("/app/uploads")
uploads_dir.mkdir(exist_ok=True)
village_docs_dir = uploads_dir / "village_documents"
village_docs_dir.mkdir(exist_ok=True)

# Mount static files for uploads
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
    
    start_scheduler()
    
    logger.info("AirYatra API started - Ready for 50K+ concurrent users!")

# Shutdown event
@app.on_event("shutdown")
async def shutdown_event():
    logger.info("Shutting down AirYatra API...")
    stop_scheduler()
    await close_mongo_connection()
    logger.info("AirYatra API shut down successfully")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)