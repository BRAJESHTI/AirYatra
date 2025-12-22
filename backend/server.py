from fastapi import FastAPI, APIRouter
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from pathlib import Path
import os
import logging
from database import connect_to_mongo, close_mongo_connection

# Import route modules
from routes import auth_routes, booking_routes, quote_routes, fleet_routes
from routes import document_routes, admin_routes, ai_routes, payment_routes, operator_routes

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

# Include API router in main app
app.include_router(api_router)

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
    logger.info("AirYatra API started successfully")

# Shutdown event
@app.on_event("shutdown")
async def shutdown_event():
    logger.info("Shutting down AirYatra API...")
    await close_mongo_connection()
    logger.info("AirYatra API shut down successfully")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)