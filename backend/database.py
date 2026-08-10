from motor.motor_asyncio import AsyncIOMotorClient
from config import settings
import logging

logger = logging.getLogger(__name__)

class Database:
    client: AsyncIOMotorClient = None
    
db = Database()

# Optimized connection settings for 50K+ users
MONGO_OPTIONS = {
    "maxPoolSize": 200,           # Max connections
    "minPoolSize": 20,            # Keep 20 ready
    "maxIdleTimeMS": 30000,       # Close idle after 30s
    "connectTimeoutMS": 5000,
    "serverSelectionTimeoutMS": 5000,
    "socketTimeoutMS": 30000,
    "retryWrites": True,
    "retryReads": True,
    "w": 1,                       # Fast writes
    "journal": True,              # Wait for journal commit (production data safety)
}

async def connect_to_mongo():
    """Connect to MongoDB with optimized pool"""
    logger.info("Connecting to MongoDB with optimized pool...")
    db.client = AsyncIOMotorClient(settings.mongo_url, **MONGO_OPTIONS)
    
    # Verify connection
    await db.client.admin.command('ping')
    logger.info(f"Connected to MongoDB! Pool: {MONGO_OPTIONS['maxPoolSize']} connections")

async def close_mongo_connection():
    """Close MongoDB connection"""
    logger.info("Closing MongoDB connection...")
    if db.client:
        db.client.close()
    logger.info("MongoDB connection closed!")

def get_database():
    """Get database instance"""
    return db.client[settings.db_name]

def get_database_sync():
    """Get database instance for sync/scheduler contexts"""
    if db.client is None:
        return None
    return db.client[settings.db_name]