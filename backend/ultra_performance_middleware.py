"""
Ultra-High Performance Middleware for 50K+ Concurrent Users
- Optimized for throughput
- Minimal memory footprint
- Async-first design
"""

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
import time
import hashlib
import orjson
from typing import Dict
from collections import defaultdict
from datetime import datetime, timedelta
import asyncio

from high_performance_cache import cache, ResponseCache, connection_stats


# ==================== OPTIMIZED RATE LIMITER ====================
class HighPerformanceRateLimiter:
    """
    Token bucket rate limiter for 50K+ users
    - O(1) operations
    - Minimal memory per user
    - Auto-cleanup of inactive users
    """
    
    def __init__(self, 
                 requests_per_second: int = 50,
                 burst_size: int = 100,
                 cleanup_interval: int = 300):
        self.rps = requests_per_second
        self.burst = burst_size
        self.buckets: Dict[str, dict] = {}
        self.cleanup_interval = cleanup_interval
        self.last_cleanup = datetime.now()
    
    def is_allowed(self, client_id: str) -> tuple[bool, dict]:
        """Check if request is allowed, return (allowed, headers)"""
        now = datetime.now()
        
        # Periodic cleanup (every 5 min)
        if (now - self.last_cleanup).seconds > self.cleanup_interval:
            self._cleanup()
            self.last_cleanup = now
        
        # Get or create bucket
        bucket = self.buckets.get(client_id)
        if not bucket:
            bucket = {
                "tokens": self.burst,
                "last_update": now
            }
            self.buckets[client_id] = bucket
        
        # Refill tokens based on time passed
        elapsed = (now - bucket["last_update"]).total_seconds()
        bucket["tokens"] = min(
            self.burst,
            bucket["tokens"] + (elapsed * self.rps)
        )
        bucket["last_update"] = now
        
        # Check if allowed
        if bucket["tokens"] >= 1:
            bucket["tokens"] -= 1
            return True, {
                "X-RateLimit-Limit": str(self.burst),
                "X-RateLimit-Remaining": str(int(bucket["tokens"])),
                "X-RateLimit-Reset": str(int(time.time()) + 1)
            }
        
        return False, {
            "X-RateLimit-Limit": str(self.burst),
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": str(int(time.time()) + 1),
            "Retry-After": "1"
        }
    
    def _cleanup(self):
        """Remove inactive buckets to free memory"""
        cutoff = datetime.now() - timedelta(minutes=10)
        self.buckets = {
            k: v for k, v in self.buckets.items()
            if v["last_update"] > cutoff
        }


# Global rate limiter
rate_limiter = HighPerformanceRateLimiter(
    requests_per_second=50,  # 50 req/sec per user = 3000/min
    burst_size=100           # Allow burst of 100
)


# ==================== FAST RESPONSE CACHE MIDDLEWARE ====================
class FastCacheMiddleware(BaseHTTPMiddleware):
    """
    Ultra-fast response caching middleware
    - Uses multi-layer cache (L1 + L2)
    - orjson for fast serialization
    - Minimal overhead
    """
    
    async def dispatch(self, request: Request, call_next):
        # Only cache GET requests
        if request.method != "GET":
            return await call_next(request)
        
        path = request.url.path
        ttl = ResponseCache.get_ttl(path)
        
        if ttl == 0:
            return await call_next(request)
        
        # Generate cache key
        cache_key = self._make_key(request)
        
        # Try cache (L1 then L2)
        cached = await cache.get(cache_key)
        if cached:
            connection_stats["cache_hits"] += 1
            return Response(
                content=cached["body"],
                status_code=cached["status"],
                media_type="application/json",
                headers={"X-Cache": "HIT", "X-Cache-TTL": str(ttl)}
            )
        
        # Get fresh response
        connection_stats["cache_misses"] += 1
        response = await call_next(request)
        
        # Cache successful responses
        if response.status_code == 200:
            body = b""
            async for chunk in response.body_iterator:
                body += chunk
            
            # Store in cache
            await cache.set(
                cache_key,
                {"body": body.decode(), "status": 200},
                l1_ttl=min(ttl, 60),
                l2_ttl=ttl
            )
            
            return Response(
                content=body,
                status_code=200,
                media_type="application/json",
                headers={"X-Cache": "MISS"}
            )
        
        return response
    
    def _make_key(self, request: Request) -> str:
        """Generate cache key from request"""
        parts = [request.method, request.url.path]
        if request.query_params:
            parts.append(str(sorted(request.query_params.items())))
        return hashlib.md5("|".join(parts).encode()).hexdigest()


# ==================== FAST RATE LIMIT MIDDLEWARE ====================
class FastRateLimitMiddleware(BaseHTTPMiddleware):
    """High-performance rate limiting"""
    
    EXEMPT_PATHS = {"/health", "/api/auth/login", "/api/auth/register"}
    
    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        
        # Skip exempt paths
        if path in self.EXEMPT_PATHS:
            return await call_next(request)
        
        # Get client ID
        client_id = self._get_client_id(request)
        
        # Check rate limit
        allowed, headers = rate_limiter.is_allowed(client_id)
        
        if not allowed:
            return Response(
                content=orjson.dumps({
                    "detail": "Rate limit exceeded",
                    "retry_after": 1
                }),
                status_code=429,
                media_type="application/json",
                headers=headers
            )
        
        response = await call_next(request)
        
        # Add rate limit headers
        for key, value in headers.items():
            response.headers[key] = value
        
        return response
    
    def _get_client_id(self, request: Request) -> str:
        """Get unique client identifier"""
        # Prefer user token hash
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            return f"u:{hashlib.md5(auth.encode()).hexdigest()[:12]}"
        
        # Fall back to IP
        forwarded = request.headers.get("X-Forwarded-For", "")
        if forwarded:
            return f"ip:{forwarded.split(',')[0].strip()}"
        
        client = request.client
        return f"ip:{client.host if client else 'unknown'}"


# ==================== PERFORMANCE HEADERS MIDDLEWARE ====================
class FastHeadersMiddleware(BaseHTTPMiddleware):
    """Add performance and security headers with minimal overhead"""
    
    SECURITY_HEADERS = {
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
        "X-XSS-Protection": "1; mode=block",
        "Referrer-Policy": "strict-origin-when-cross-origin"
    }
    
    async def dispatch(self, request: Request, call_next):
        start = time.perf_counter()
        
        response = await call_next(request)
        
        # Timing header
        process_time = time.perf_counter() - start
        response.headers["X-Process-Time"] = f"{process_time:.4f}"
        
        # Security headers
        for key, value in self.SECURITY_HEADERS.items():
            response.headers[key] = value
        
        # Cache control
        if request.url.path.startswith("/api/"):
            if request.method == "GET":
                response.headers["Cache-Control"] = "private, max-age=30"
            else:
                response.headers["Cache-Control"] = "no-store"
        
        # Track requests
        connection_stats["requests_served"] += 1
        
        return response


# ==================== CONNECTION KEEPALIVE ====================
class KeepaliveMiddleware(BaseHTTPMiddleware):
    """Optimize connection handling"""
    
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        
        # Enable keepalive for persistent connections
        response.headers["Connection"] = "keep-alive"
        response.headers["Keep-Alive"] = "timeout=30, max=1000"
        
        return response


def get_performance_stats() -> dict:
    """Get comprehensive performance statistics"""
    return {
        "requests_served": connection_stats["requests_served"],
        "cache_hits": connection_stats["cache_hits"],
        "cache_misses": connection_stats["cache_misses"],
        "cache_hit_rate": f"{connection_stats['cache_hits']/(connection_stats['cache_hits']+connection_stats['cache_misses']+1)*100:.1f}%",
        "active_rate_limit_buckets": len(rate_limiter.buckets),
        "rate_limit_config": {
            "requests_per_second": rate_limiter.rps,
            "burst_size": rate_limiter.burst
        }
    }
