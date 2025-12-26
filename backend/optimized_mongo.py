"""
MongoDB Connection Pool Optimization for 50K+ Users
- Optimized connection pooling
- Read preference optimization
- Query optimization helpers
"""

from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import ReadPreference
import os
import logging

logger = logging.getLogger(__name__)

# Optimized connection settings for high concurrency
MONGO_SETTINGS = {
    # Connection Pool
    "maxPoolSize": 200,           # Max connections in pool
    "minPoolSize": 20,            # Min connections kept ready
    "maxIdleTimeMS": 30000,       # Close idle connections after 30s
    
    # Timeouts
    "connectTimeoutMS": 5000,     # Connection timeout
    "serverSelectionTimeoutMS": 5000,
    "socketTimeoutMS": 30000,     # Socket operation timeout
    
    # Write Concern (balance speed vs durability)
    "w": 1,                       # Acknowledge from primary only
    "journal": False,             # Don't wait for journal (faster writes)
    
    # Read Preference
    "readPreference": "primaryPreferred",  # Read from primary, fallback to secondary
    
    # Compression
    "compressors": ["zstd", "snappy", "zlib"],
    
    # Retries
    "retryWrites": True,
    "retryReads": True,
}


class OptimizedMongoClient:
    """High-performance MongoDB client wrapper"""
    
    def __init__(self):
        self.client = None
        self.db = None
        self.connected = False
    
    async def connect(self, mongo_url: str = None, db_name: str = None):
        """Initialize optimized MongoDB connection"""
        url = mongo_url or os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
        name = db_name or os.environ.get('DB_NAME', 'airyatra')
        
        try:
            # Build connection string with optimized settings
            self.client = AsyncIOMotorClient(url, **MONGO_SETTINGS)
            self.db = self.client[name]
            
            # Verify connection
            await self.client.admin.command('ping')
            
            self.connected = True
            logger.info(f"MongoDB connected with pool size: {MONGO_SETTINGS['maxPoolSize']}")
            
            return self.db
            
        except Exception as e:
            logger.error(f"MongoDB connection failed: {e}")
            raise
    
    async def close(self):
        """Close MongoDB connection"""
        if self.client:
            self.client.close()
            self.connected = False
            logger.info("MongoDB connection closed")
    
    def get_stats(self) -> dict:
        """Get connection pool statistics"""
        if not self.client:
            return {"connected": False}
        
        # Get server info
        try:
            return {
                "connected": self.connected,
                "pool_size": MONGO_SETTINGS["maxPoolSize"],
                "min_pool": MONGO_SETTINGS["minPoolSize"],
            }
        except:
            return {"connected": self.connected}


# Global optimized client
mongo_client = OptimizedMongoClient()


# ==================== QUERY OPTIMIZATION HELPERS ====================

def projection_exclude_id(fields: list = None) -> dict:
    """Create projection that excludes _id"""
    proj = {"_id": 0}
    if fields:
        for f in fields:
            proj[f] = 1
    return proj


async def find_with_limit(collection, query: dict, limit: int = 100, 
                          sort: list = None, projection: dict = None):
    """Optimized find with automatic limits"""
    cursor = collection.find(query, projection or {"_id": 0})
    
    if sort:
        cursor = cursor.sort(sort)
    
    cursor = cursor.limit(limit)
    
    return await cursor.to_list(limit)


async def count_with_hint(collection, query: dict, hint: str = None) -> int:
    """Count documents with index hint for speed"""
    if hint:
        return await collection.count_documents(query, hint=hint)
    return await collection.count_documents(query)


async def aggregate_with_allowdisk(collection, pipeline: list):
    """Run aggregation allowing disk use for large datasets"""
    return await collection.aggregate(pipeline, allowDiskUse=True).to_list(None)


# ==================== BULK OPERATIONS ====================

async def bulk_insert(collection, documents: list, ordered: bool = False):
    """Optimized bulk insert"""
    if not documents:
        return {"inserted": 0}
    
    result = await collection.insert_many(documents, ordered=ordered)
    return {"inserted": len(result.inserted_ids)}


async def bulk_update(collection, operations: list):
    """Optimized bulk update"""
    if not operations:
        return {"modified": 0}
    
    from pymongo import UpdateOne
    bulk_ops = [
        UpdateOne(op["filter"], op["update"], upsert=op.get("upsert", False))
        for op in operations
    ]
    
    result = await collection.bulk_write(bulk_ops, ordered=False)
    return {
        "matched": result.matched_count,
        "modified": result.modified_count,
        "upserted": result.upserted_count
    }
