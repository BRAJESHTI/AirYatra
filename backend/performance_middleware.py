"""
Performance Middleware for FastAPI
- Response Compression (Gzip)
- Rate Limiting
- Request Caching
- Performance Headers
"""

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.middleware.gzip import GZipMiddleware
import time
import hashlib
import json
from typing import Dict, Optional
from collections import defaultdict
from datetime import datetime, timedelta
import asyncio

# In-memory cache (for single instance, use Redis for multi-instance)
cache_store: Dict[str, dict] = {}
CACHE_TTL = 60  # seconds

# Rate limiting storage
rate_limit_store: Dict[str, list] = defaultdict(list)
RATE_LIMIT_REQUESTS = 100  # requests
RATE_LIMIT_WINDOW = 60  # seconds


class CacheMiddleware(BaseHTTPMiddleware):
    """Cache GET responses for improved performance"""
    
    CACHEABLE_PATHS = [
        "/api/landing/points",
        "/api/fleet/aircraft-types",
        "/api/settings/public",
        "/api/weather/current",
        "/api/knowledge/categories",
        "/api/knowledge/faqs",
        "/api/pricing/config",
        "/api/routes/locations",
    ]
    
    async def dispatch(self, request: Request, call_next):
        # Only cache GET requests
        if request.method != "GET":
            return await call_next(request)
        
        # Check if path is cacheable
        path = request.url.path
        if not any(path.startswith(cp) for cp in self.CACHEABLE_PATHS):
            return await call_next(request)
        
        # Generate cache key
        cache_key = self._generate_cache_key(request)
        
        # Check cache
        cached = cache_store.get(cache_key)
        if cached and cached["expires"] > datetime.now():
            return Response(
                content=cached["content"],
                media_type="application/json",
                headers={"X-Cache": "HIT", "X-Cache-TTL": str(CACHE_TTL)}
            )
        
        # Get fresh response
        response = await call_next(request)
        
        # Cache successful responses
        if response.status_code == 200:
            body = b""
            async for chunk in response.body_iterator:
                body += chunk
            
            cache_store[cache_key] = {
                "content": body,
                "expires": datetime.now() + timedelta(seconds=CACHE_TTL)
            }
            
            return Response(
                content=body,
                status_code=response.status_code,
                media_type=response.media_type,
                headers=dict(response.headers) | {"X-Cache": "MISS"}
            )
        
        return response
    
    def _generate_cache_key(self, request: Request) -> str:
        """Generate unique cache key from request (using SHA256 for security)"""
        key_parts = [request.method, request.url.path, str(sorted(request.query_params.items()))]
        key_string = "|".join(key_parts)
        return hashlib.sha256(key_string.encode()).hexdigest()[:32]


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Rate limiting to prevent abuse and ensure fair usage"""
    
    # Paths exempt from rate limiting
    EXEMPT_PATHS = ["/health", "/api/auth/login", "/api/auth/register"]
    
    async def dispatch(self, request: Request, call_next):
        # Skip rate limiting for exempt paths
        if request.url.path in self.EXEMPT_PATHS:
            return await call_next(request)
        
        # Get client identifier (IP or user ID)
        client_id = self._get_client_id(request)
        
        # Check rate limit
        now = datetime.now()
        window_start = now - timedelta(seconds=RATE_LIMIT_WINDOW)
        
        # Clean old requests
        rate_limit_store[client_id] = [
            req_time for req_time in rate_limit_store[client_id]
            if req_time > window_start
        ]
        
        # Check if limit exceeded
        if len(rate_limit_store[client_id]) >= RATE_LIMIT_REQUESTS:
            return Response(
                content=json.dumps({
                    "detail": "Rate limit exceeded. Please try again later.",
                    "retry_after": RATE_LIMIT_WINDOW
                }),
                status_code=429,
                media_type="application/json",
                headers={
                    "Retry-After": str(RATE_LIMIT_WINDOW),
                    "X-RateLimit-Limit": str(RATE_LIMIT_REQUESTS),
                    "X-RateLimit-Remaining": "0"
                }
            )
        
        # Record this request
        rate_limit_store[client_id].append(now)
        
        # Add rate limit headers to response
        response = await call_next(request)
        response.headers["X-RateLimit-Limit"] = str(RATE_LIMIT_REQUESTS)
        response.headers["X-RateLimit-Remaining"] = str(RATE_LIMIT_REQUESTS - len(rate_limit_store[client_id]))
        
        return response
    
    def _get_client_id(self, request: Request) -> str:
        """Get unique client identifier (using SHA256 for security)"""
        # Try to get user ID from auth header
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            return f"user:{hashlib.sha256(auth_header.encode()).hexdigest()[:16]}"
        
        # Fall back to IP address
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            return f"ip:{forwarded.split(',')[0].strip()}"
        
        return f"ip:{request.client.host if request.client else 'unknown'}"


class PerformanceHeadersMiddleware(BaseHTTPMiddleware):
    """Add performance and security headers"""
    
    async def dispatch(self, request: Request, call_next):
        start_time = time.time()
        
        response = await call_next(request)
        
        # Add timing header
        process_time = time.time() - start_time
        response.headers["X-Process-Time"] = f"{process_time:.4f}"
        
        # Security headers
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        
        # Cache control for API responses
        if request.url.path.startswith("/api/"):
            if request.method == "GET":
                response.headers["Cache-Control"] = "private, max-age=60"
            else:
                response.headers["Cache-Control"] = "no-store"
        
        return response


def clear_cache():
    """Clear all cached responses"""
    cache_store.clear()


def clear_rate_limits():
    """Clear all rate limit counters"""
    rate_limit_store.clear()


async def cleanup_expired_cache():
    """Periodically clean up expired cache entries"""
    while True:
        await asyncio.sleep(300)  # Run every 5 minutes
        now = datetime.now()
        expired_keys = [
            key for key, value in cache_store.items()
            if value["expires"] < now
        ]
        for key in expired_keys:
            del cache_store[key]
