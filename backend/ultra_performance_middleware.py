"""
Ultra-High Performance Middleware for 50K+ Concurrent Users
- Optimized for throughput
- Minimal memory footprint
- Async-first design
- Memory leak prevention
"""

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
import time
import hashlib
from typing import Dict
from datetime import datetime, timedelta
import gc

# ==================== SIMPLE IN-MEMORY CACHE ====================
# LRU Cache with TTL and auto-cleanup
response_cache: Dict[str, dict] = {}
MAX_CACHE_SIZE = 5000
LAST_CLEANUP = time.time()
CLEANUP_INTERVAL = 300  # 5 minutes

def cleanup_cache():
    """Remove expired entries"""
    global LAST_CLEANUP
    now = time.time()
    
    if now - LAST_CLEANUP < CLEANUP_INTERVAL:
        return
    
    LAST_CLEANUP = now
    expired = [k for k, v in response_cache.items() if v["exp"] < now]
    for k in expired:
        del response_cache[k]
    
    # Force garbage collection if cache was large
    if len(expired) > 100:
        gc.collect()

def get_cached(key: str):
    """Get from cache if valid"""
    cleanup_cache()  # Periodic cleanup
    item = response_cache.get(key)
    if item and item["exp"] > time.time():
        return item["data"]
    return None

def set_cached(key: str, data: bytes, ttl: int = 60):
    """Set cache with TTL"""
    # Simple LRU: remove oldest if full
    if len(response_cache) >= MAX_CACHE_SIZE:
        oldest = min(response_cache.keys(), key=lambda k: response_cache[k]["exp"])
        del response_cache[oldest]
    
    response_cache[key] = {"data": data, "exp": time.time() + ttl}


# ==================== TOKEN BUCKET RATE LIMITER ====================
rate_buckets: Dict[str, dict] = {}
RATE_LIMIT_RPS = 50
RATE_LIMIT_BURST = 100
RATE_BUCKET_CLEANUP = time.time()

def cleanup_rate_buckets():
    """Remove old rate limit entries"""
    global RATE_BUCKET_CLEANUP
    now = time.time()
    
    if now - RATE_BUCKET_CLEANUP < 600:  # Every 10 min
        return
    
    RATE_BUCKET_CLEANUP = now
    cutoff = now - 600  # Remove entries older than 10 min
    old_keys = [k for k, v in rate_buckets.items() if v["last"] < cutoff]
    for k in old_keys:
        del rate_buckets[k]

def check_rate_limit(client_id: str) -> tuple:
    """Check rate limit using token bucket"""
    cleanup_rate_buckets()
    now = time.time()
    
    bucket = rate_buckets.get(client_id)
    if not bucket:
        bucket = {"tokens": RATE_LIMIT_BURST, "last": now}
        rate_buckets[client_id] = bucket
    
    # Refill tokens
    elapsed = now - bucket["last"]
    bucket["tokens"] = min(RATE_LIMIT_BURST, bucket["tokens"] + elapsed * RATE_LIMIT_RPS)
    bucket["last"] = now
    
    if bucket["tokens"] >= 1:
        bucket["tokens"] -= 1
        return True, int(bucket["tokens"])
    return False, 0


# ==================== CACHEABLE PATHS ====================
CACHE_PATHS = {
    "/api/landing/points": 300,
    "/api/fleet/aircraft-types": 600,
    "/api/routes/locations": 600,
    "/api/settings/public": 300,
    "/api/knowledge/categories": 300,
    "/api/knowledge/faqs": 300,
    "/api/pricing/config": 60,
}


# ==================== FAST CACHE MIDDLEWARE ====================
class FastCacheMiddleware(BaseHTTPMiddleware):
    """Ultra-fast response caching"""
    
    async def dispatch(self, request: Request, call_next):
        if request.method != "GET":
            return await call_next(request)
        
        path = request.url.path
        ttl = next((t for p, t in CACHE_PATHS.items() if path.startswith(p)), 0)
        
        if ttl == 0:
            return await call_next(request)
        
        # Cache key (SHA256 for security - MD5 is deprecated)
        key = hashlib.sha256(f"{path}:{request.query_params}".encode()).hexdigest()[:32]
        
        # Check cache
        cached = get_cached(key)
        if cached:
            return Response(
                content=cached,
                media_type="application/json",
                headers={"X-Cache": "HIT"}
            )
        
        # Get response
        response = await call_next(request)
        
        if response.status_code == 200:
            body = b""
            async for chunk in response.body_iterator:
                body += chunk
            set_cached(key, body, ttl)
            return Response(content=body, media_type="application/json", headers={"X-Cache": "MISS"})
        
        return response


# ==================== FAST RATE LIMIT MIDDLEWARE ====================
class FastRateLimitMiddleware(BaseHTTPMiddleware):
    """High-performance rate limiting"""
    
    async def dispatch(self, request: Request, call_next):
        # Skip health checks
        if request.url.path in {"/health", "/api/auth/login"}:
            return await call_next(request)
        
        # Get client ID (SHA256 for security)
        auth = request.headers.get("Authorization", "")
        if auth:
            client_id = hashlib.sha256(auth.encode()).hexdigest()[:12]
        else:
            client_id = request.client.host if request.client else "unknown"
        
        allowed, remaining = check_rate_limit(client_id)
        
        if not allowed:
            return Response(
                content='{"detail":"Rate limit exceeded"}',
                status_code=429,
                media_type="application/json",
                headers={"Retry-After": "1"}
            )
        
        response = await call_next(request)
        response.headers["X-RateLimit-Remaining"] = str(remaining)
        return response


# ==================== FAST HEADERS MIDDLEWARE ====================
class FastHeadersMiddleware(BaseHTTPMiddleware):
    """Add headers with minimal overhead"""
    
    async def dispatch(self, request: Request, call_next):
        start = time.perf_counter()
        response = await call_next(request)
        
        response.headers["X-Process-Time"] = f"{time.perf_counter() - start:.4f}"
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        
        return response


# ==================== KEEPALIVE MIDDLEWARE ====================
class KeepaliveMiddleware(BaseHTTPMiddleware):
    """Connection keepalive"""
    
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["Connection"] = "keep-alive"
        response.headers["Keep-Alive"] = "timeout=30, max=1000"
        return response


# ==================== STATS ====================
def get_performance_stats():
    return {
        "cache_entries": len(response_cache),
        "rate_limit_buckets": len(rate_buckets),
        "rate_limit_config": {"rps": RATE_LIMIT_RPS, "burst": RATE_LIMIT_BURST}
    }
