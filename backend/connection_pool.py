"""
Connection Pool Manager for High Throughput
- Singleton database connection
- Optimized for async operations
- Automatic reconnection
"""

import asyncio
import logging
from motor.motor_asyncio import AsyncIOMotorClient
from contextlib import asynccontextmanager
import os

logger = logging.getLogger(__name__)

class ConnectionPool:
    """Singleton connection pool manager"""
    
    _instance = None
    _client = None
    _db = None
    _connected = False
    _lock = asyncio.Lock()
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    @classmethod
    async def get_database(cls):
        """Get database connection (creates if needed)"""
        if cls._db is not None and cls._connected:
            return cls._db
        
        async with cls._lock:
            if cls._db is not None and cls._connected:
                return cls._db
            
            mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
            db_name = os.environ.get('DB_NAME', 'airyatra')
            
            cls._client = AsyncIOMotorClient(
                mongo_url,
                maxPoolSize=200,
                minPoolSize=10,
                maxIdleTimeMS=30000,
                connectTimeoutMS=5000,
                serverSelectionTimeoutMS=5000,
                socketTimeoutMS=30000,
                retryWrites=True,
                retryReads=True,
                w=1,
                journal=False,
            )
            
            cls._db = cls._client[db_name]
            cls._connected = True
            
            # Verify connection
            await cls._client.admin.command('ping')
            logger.info(f"Connection pool established: maxPoolSize=200")
            
            return cls._db
    
    @classmethod
    async def close(cls):
        """Close all connections"""
        if cls._client:
            cls._client.close()
            cls._connected = False
            cls._db = None
            logger.info("Connection pool closed")


# Convenience function
async def get_db():
    """Get database instance"""
    return await ConnectionPool.get_database()


# For backward compatibility
pool = ConnectionPool()
