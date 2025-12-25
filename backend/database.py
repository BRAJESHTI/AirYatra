from motor.motor_asyncio import AsyncIOMotorClient
from config import settings
import logging

logger = logging.getLogger(__name__)

class Database:
    client: AsyncIOMotorClient = None
    
db = Database()

async def connect_to_mongo():
    """Connect to MongoDB"""
    logger.info("Connecting to MongoDB...")
    db.client = AsyncIOMotorClient(settings.mongo_url)
    logger.info("Connected to MongoDB!")

async def close_mongo_connection():
    """Close MongoDB connection"""
    logger.info("Closing MongoDB connection...")
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