from fastapi import FastAPI, APIRouter
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from pathlib import Path
import os
import logging
from database import connect_to_mongo, close_mongo_connection
from scheduler import start_scheduler, stop_scheduler

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
        "version": "1.0.0"
    }

# Startup event
@app.on_event("startup")
async def startup_event():
    logger.info("Starting AirYatra API...")
    await connect_to_mongo()
    start_scheduler()
    logger.info("AirYatra API started successfully with background scheduler")

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