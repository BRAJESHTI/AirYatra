"""
Database Optimization - MongoDB Indexes
Performance indexes for high-traffic scenarios
"""

import asyncio
import logging
from motor.motor_asyncio import AsyncIOMotorClient
import os

logger = logging.getLogger(__name__)

# Index definitions for all collections
INDEXES = {
    "users": [
        {"keys": [("email", 1)], "unique": True, "name": "email_unique"},
        {"keys": [("roles", 1)], "name": "roles_idx"},
        {"keys": [("is_active", 1)], "name": "active_idx"},
        {"keys": [("created_at", -1)], "name": "created_at_idx"},
    ],
    "bookings": [
        {"keys": [("booking_number", 1)], "unique": True, "name": "booking_number_unique",
         "partialFilterExpression": {"booking_number": {"$type": "string"}}},
        {"keys": [("customer_id", 1)], "name": "customer_idx"},
        {"keys": [("operator_id", 1)], "name": "operator_idx"},
        {"keys": [("status", 1)], "name": "status_idx"},
        {"keys": [("travel_date", 1)], "name": "travel_date_idx"},
        {"keys": [("created_at", -1)], "name": "created_at_idx"},
        {"keys": [("status", 1), ("created_at", -1)], "name": "status_created_compound"},
    ],
    "inquiries": [
        {"keys": [("inquiry_number", 1)], "unique": True, "name": "inquiry_number_unique",
         "partialFilterExpression": {"inquiry_number": {"$type": "string"}}},
        {"keys": [("customer_id", 1)], "name": "customer_idx"},
        {"keys": [("status", 1)], "name": "status_idx"},
        {"keys": [("created_at", -1)], "name": "created_at_idx"},
        {"keys": [("status", 1), ("created_at", -1)], "name": "status_created_compound"},
    ],
    "quotes": [
        {"keys": [("inquiry_id", 1)], "name": "inquiry_idx"},
        {"keys": [("operator_id", 1)], "name": "operator_idx"},
        {"keys": [("status", 1)], "name": "status_idx"},
        {"keys": [("created_at", -1)], "name": "created_at_idx"},
    ],
    "operators": [
        {"keys": [("user_id", 1)], "unique": True, "name": "user_id_unique"},
        {"keys": [("status", 1)], "name": "status_idx"},
        {"keys": [("base_city", 1)], "name": "base_city_idx"},
        {"keys": [("rating", -1)], "name": "rating_idx"},
    ],
    "notifications": [
        {"keys": [("user_id", 1)], "name": "user_idx"},
        {"keys": [("is_read", 1)], "name": "read_idx"},
        {"keys": [("created_at", -1)], "name": "created_at_idx"},
        {"keys": [("user_id", 1), ("is_read", 1), ("created_at", -1)], "name": "user_unread_compound"},
    ],
    "crm_leads": [
        {"keys": [("status", 1)], "name": "status_idx"},
        {"keys": [("source", 1)], "name": "source_idx"},
        {"keys": [("assigned_to", 1)], "name": "assigned_idx"},
        {"keys": [("created_at", -1)], "name": "created_at_idx"},
        {"keys": [("priority", 1), ("created_at", -1)], "name": "priority_created_compound"},
    ],
    "call_logs": [
        {"keys": [("call_sid", 1)], "unique": True, "name": "call_sid_unique",
         "partialFilterExpression": {"call_sid": {"$type": "string"}}},
        {"keys": [("customer_id", 1)], "name": "customer_idx"},
        {"keys": [("created_at", -1)], "name": "created_at_idx"},
    ],
    "support_tickets": [
        {"keys": [("ticket_number", 1)], "unique": True, "name": "ticket_number_unique",
         "partialFilterExpression": {"ticket_number": {"$type": "string"}}},
        {"keys": [("customer_id", 1)], "name": "customer_idx"},
        {"keys": [("status", 1)], "name": "status_idx"},
        {"keys": [("priority", 1)], "name": "priority_idx"},
        {"keys": [("assigned_to", 1)], "name": "assigned_idx"},
        {"keys": [("created_at", -1)], "name": "created_at_idx"},
    ],
    "audit_logs": [
        {"keys": [("user_id", 1)], "name": "user_idx"},
        {"keys": [("action", 1)], "name": "action_idx"},
        {"keys": [("created_at", -1)], "name": "created_at_idx"},
    ],
    "sessions": [
        {"keys": [("user_id", 1)], "name": "user_idx"},
        {"keys": [("expires_at", 1)], "expireAfterSeconds": 0, "name": "ttl_idx"},
    ],
    "landing_points": [
        {"keys": [("city", 1)], "name": "city_idx"},
        {"keys": [("state", 1)], "name": "state_idx"},
        {"keys": [("is_active", 1)], "name": "active_idx"},
        {"keys": [("location", "2dsphere")], "name": "geo_idx"},
    ],
    "fleet": [
        {"keys": [("operator_id", 1)], "name": "operator_idx"},
        {"keys": [("aircraft_type", 1)], "name": "type_idx"},
        {"keys": [("is_available", 1)], "name": "available_idx"},
    ],
    "payments": [
        {"keys": [("booking_id", 1)], "name": "booking_idx"},
        {"keys": [("status", 1)], "name": "status_idx"},
        {"keys": [("created_at", -1)], "name": "created_at_idx"},
    ],
}


async def create_indexes(db):
    """Create all indexes for optimal performance"""
    created_count = 0
    
    for collection_name, indexes in INDEXES.items():
        collection = db[collection_name]
        
        for index_def in indexes:
            try:
                keys = index_def["keys"]
                options = {k: v for k, v in index_def.items() if k != "keys"}
                
                await collection.create_index(keys, **options)
                created_count += 1
                logger.info(f"Created index {index_def.get('name', 'unnamed')} on {collection_name}")
            except Exception as e:
                msg = str(e)
                if "already exists" in msg or "IndexOptionsConflict" in msg or "IndexKeySpecsConflict" in msg:
                    logger.debug(f"Index exists for {collection_name}: {msg}")
                else:
                    logger.warning(f"Index creation failed on {collection_name}: {msg}")
    
    return created_count


async def optimize_database():
    """Run all database optimizations"""
    mongo_url = os.environ['MONGO_URL']
    db_name = os.environ['DB_NAME']
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    logger.info("Starting database optimization...")
    
    # Create indexes
    index_count = await create_indexes(db)
    logger.info(f"Index optimization complete. Processed {index_count} indexes.")
    
    # Compact collections (optional, can be run periodically)
    # This helps reclaim space and improve performance
    
    return {"indexes_processed": index_count}


# Run optimization on startup
if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(optimize_database())
