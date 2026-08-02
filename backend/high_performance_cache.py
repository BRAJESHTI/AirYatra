"""
High-Performance Caching System for 50K+ Concurrent Users
- Multi-layer caching (L1: Memory, L2: Redis)
- Connection pooling
- Async optimizations
"""

import asyncio
import hashlib
import json
import logging
import os
from datetime import datetime, timedelta
from typing import Any, Dict, Optional
from functools import wraps
import orjson  # Faster JSON serialization

logger = logging.getLogger(__name__)

# Try Redis, fallback to memory
try:
    import redis.asyncio as aioredis
    REDIS_AVAILABLE = True
except ImportError:
    REDIS_AVAILABLE = False

# ==================== L1 CACHE (In-Memory - Ultra Fast) ====================
class L1Cache:
    """Lightning-fast in-memory cache with LRU eviction"""
    
    def __init__(self, max_size: int = 10000):
        self.cache: Dict[str, dict] = {}
        self.max_size = max_size
        self.hits = 0
        self.misses = 0
        self.access_order = []
    
    def get(self, key: str) -> Optional[Any]:
        item = self.cache.get(key)
        if item and item["expires"] > datetime.now():
            self.hits += 1
            # Move to end (most recently used)
            if key in self.access_order:
                self.access_order.remove(key)
            self.access_order.append(key)
            return item["value"]
        self.misses += 1
        if key in self.cache:
            del self.cache[key]
        return None
    
    def set(self, key: str, value: Any, ttl: int = 60):
        # LRU eviction if at capacity
        while len(self.cache) >= self.max_size and self.access_order:
            oldest = self.access_order.pop(0)
            self.cache.pop(oldest, None)
        
        self.cache[key] = {
            "value": value,
            "expires": datetime.now() + timedelta(seconds=ttl)
        }
        self.access_order.append(key)
    
    def delete(self, key: str):
        self.cache.pop(key, None)
        if key in self.access_order:
            self.access_order.remove(key)
    
    def clear(self):
        self.cache.clear()
        self.access_order.clear()
    
    def stats(self) -> dict:
        total = self.hits + self.misses
        return {
            "size": len(self.cache),
            "max_size": self.max_size,
            "hits": self.hits,
            "misses": self.misses,
            "hit_rate": f"{(self.hits/total*100):.1f}%" if total > 0 else "0%"
        }


# ==================== L2 CACHE (Redis - Distributed) ====================
class L2Cache:
    """Redis-based distributed cache for horizontal scaling"""
    
    def __init__(self):
        self.redis = None
        self.connected = False
    
    async def connect(self):
        if not REDIS_AVAILABLE:
            logger.info("Redis not available, L2 cache disabled")
            return False
        
        try:
            redis_url = os.environ.get("REDIS_URL", "redis://localhost:6379")
            self.redis = await aioredis.from_url(
                redis_url,
                encoding="utf-8",
                decode_responses=True,
                max_connections=100
            )
            await self.redis.ping()
            self.connected = True
            logger.info("L2 Cache (Redis) connected")
            return True
        except Exception as e:
            logger.warning(f"Redis connection failed: {e}")
            self.connected = False
            return False
    
    async def get(self, key: str) -> Optional[Any]:
        if not self.connected:
            return None
        try:
            data = await self.redis.get(f"cache:{key}")
            if data:
                return orjson.loads(data)
            return None
        except Exception:
            return None
    
    async def set(self, key: str, value: Any, ttl: int = 300):
        if not self.connected:
            return
        try:
            await self.redis.setex(
                f"cache:{key}",
                ttl,
                orjson.dumps(value).decode()
            )
        except Exception:
            pass
    
    async def delete(self, key: str):
        if not self.connected:
            return
        try:
            await self.redis.delete(f"cache:{key}")
        except Exception:
            pass


# ==================== MULTI-LAYER CACHE ====================
class MultiLayerCache:
    """
    Two-tier caching system:
    - L1: In-memory (microseconds latency)
    - L2: Redis (milliseconds latency, distributed)
    """
    
    def __init__(self):
        self.l1 = L1Cache(max_size=10000)
        self.l2 = L2Cache()
    
    async def initialize(self):
        await self.l2.connect()
    
    async def get(self, key: str) -> Optional[Any]:
        # Try L1 first (fastest)
        value = self.l1.get(key)
        if value is not None:
            return value
        
        # Try L2 (Redis)
        value = await self.l2.get(key)
        if value is not None:
            # Populate L1 from L2
            self.l1.set(key, value, ttl=30)
            return value
        
        return None
    
    async def set(self, key: str, value: Any, l1_ttl: int = 30, l2_ttl: int = 300):
        # Set in both layers
        self.l1.set(key, value, ttl=l1_ttl)
        await self.l2.set(key, value, ttl=l2_ttl)
    
    async def delete(self, key: str):
        self.l1.delete(key)
        await self.l2.delete(key)
    
    def stats(self) -> dict:
        return {
            "l1": self.l1.stats(),
            "l2_connected": self.l2.connected
        }


# ==================== CACHE DECORATOR ====================
def cached(ttl: int = 60, key_prefix: str = ""):
    """Decorator for automatic caching of async functions"""
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Generate cache key (using SHA256 for security)
            key_parts = [key_prefix or func.__name__]
            key_parts.extend(str(arg) for arg in args[1:])  # Skip self
            key_parts.extend(f"{k}={v}" for k, v in sorted(kwargs.items()))
            cache_key = hashlib.sha256("|".join(key_parts).encode()).hexdigest()[:32]
            
            # Try cache
            cached_value = await cache.get(cache_key)
            if cached_value is not None:
                return cached_value
            
            # Execute function
            result = await func(*args, **kwargs)
            
            # Store in cache
            await cache.set(cache_key, result, l1_ttl=min(ttl, 60), l2_ttl=ttl)
            
            return result
        return wrapper
    return decorator


# ==================== RESPONSE CACHE FOR ENDPOINTS ====================
class ResponseCache:
    """Fast response caching with content-type awareness"""
    
    # Endpoints to cache with their TTLs
    CACHE_CONFIG = {
        "/api/landing/points": 300,          # 5 min - rarely changes
        "/api/fleet/aircraft-types": 600,    # 10 min - static data
        "/api/routes/locations": 600,        # 10 min - static data
        "/api/settings/public": 300,         # 5 min
        "/api/knowledge/categories": 300,    # 5 min
        "/api/knowledge/faqs": 300,          # 5 min
        "/api/pricing/config": 60,           # 1 min - may change
        "/api/weather": 60,                  # 1 min - weather updates
        "/api/admin/dashboard": 30,          # 30 sec - real-time ish
        "/api/crm/dashboard": 30,            # 30 sec
    }
    
    @classmethod
    def get_ttl(cls, path: str) -> int:
        """Get cache TTL for a path"""
        for cached_path, ttl in cls.CACHE_CONFIG.items():
            if path.startswith(cached_path):
                return ttl
        return 0  # Don't cache
    
    @classmethod
    def should_cache(cls, path: str, method: str) -> bool:
        """Check if request should be cached"""
        if method != "GET":
            return False
        return cls.get_ttl(path) > 0


# ==================== CONNECTION POOL STATS ====================
connection_stats = {
    "db_connections": 0,
    "cache_hits": 0,
    "cache_misses": 0,
    "requests_served": 0
}


# Global cache instance
cache = MultiLayerCache()


async def initialize_cache():
    """Initialize cache system on startup"""
    await cache.initialize()
    logger.info("Multi-layer cache system initialized")


def get_cache_stats() -> dict:
    """Get comprehensive cache statistics"""
    return {
        **cache.stats(),
        "connection_stats": connection_stats,
        "response_cache_config": ResponseCache.CACHE_CONFIG
    }
