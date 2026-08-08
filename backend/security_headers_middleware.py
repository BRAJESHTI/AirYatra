"""
AirYatra - Advanced Security Headers Middleware
HSTS, CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy
"""

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response, RedirectResponse
from typing import Callable
import os
import logging

logger = logging.getLogger(__name__)

# Environment
IS_PRODUCTION = os.environ.get("ENV", "development").lower() == "production"
ENFORCE_HTTPS = os.environ.get("ENFORCE_HTTPS", "true").lower() == "true"

# HSTS Configuration (1 year = 31536000 seconds)
HSTS_MAX_AGE = int(os.environ.get("HSTS_MAX_AGE", "31536000"))
HSTS_INCLUDE_SUBDOMAINS = os.environ.get("HSTS_INCLUDE_SUBDOMAINS", "true").lower() == "true"
HSTS_PRELOAD = os.environ.get("HSTS_PRELOAD", "true").lower() == "true"

# CSP Configuration
CSP_REPORT_URI = os.environ.get("CSP_REPORT_URI", "")

def build_hsts_header() -> str:
    """Build HSTS header value"""
    hsts = f"max-age={HSTS_MAX_AGE}"
    if HSTS_INCLUDE_SUBDOMAINS:
        hsts += "; includeSubDomains"
    if HSTS_PRELOAD:
        hsts += "; preload"
    return hsts

def build_csp_header() -> str:
    """
    Build Content-Security-Policy header
    Prevents XSS, clickjacking, and other code injection attacks
    """
    csp_directives = [
        # Default: only allow from same origin
        "default-src 'self'",
        
        # Scripts: self + inline (for React) + specific CDNs
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://checkout.razorpay.com https://www.google.com https://www.gstatic.com",
        
        # Styles: self + inline (for styled-components/emotion) + Google Fonts
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        
        # Images: self + data URIs + common image CDNs
        "img-src 'self' data: blob: https: http:",
        
        # Fonts: self + Google Fonts
        "font-src 'self' data: https://fonts.gstatic.com",
        
        # Connect: API calls + WebSocket + Payment gateways
        "connect-src 'self' https://api.stripe.com https://checkout.razorpay.com wss: https:",
        
        # Frames: Payment iframes (Stripe, Razorpay)
        "frame-src 'self' https://js.stripe.com https://checkout.razorpay.com https://api.razorpay.com https://www.google.com",
        
        # Object/embed: none (prevent Flash/plugins)
        "object-src 'none'",
        
        # Base URI: self only
        "base-uri 'self'",
        
        # Form actions: self only
        "form-action 'self' https://checkout.razorpay.com https://api.razorpay.com",
        
        # Frame ancestors: prevent clickjacking
        "frame-ancestors 'self'",
        
        # Block mixed content
        "block-all-mixed-content",
        
        # Upgrade insecure requests
        "upgrade-insecure-requests",
    ]
    
    # Add report URI if configured
    if CSP_REPORT_URI:
        csp_directives.append(f"report-uri {CSP_REPORT_URI}")
    
    return "; ".join(csp_directives)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """
    Comprehensive security headers middleware
    - HSTS (HTTP Strict Transport Security)
    - CSP (Content Security Policy)
    - X-Frame-Options
    - X-Content-Type-Options
    - X-XSS-Protection
    - Referrer-Policy
    - Permissions-Policy
    """
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # HTTPS Enforcement (redirect HTTP to HTTPS)
        # Check X-Forwarded-Proto to handle reverse proxy (Cloudflare/nginx)
        forwarded_proto = request.headers.get("x-forwarded-proto", request.url.scheme)
        is_https = forwarded_proto == "https" or request.url.scheme == "https"
        
        if ENFORCE_HTTPS and not is_https:
            # Skip for health checks and local development
            if request.url.path not in ["/health", "/api/health"] and request.url.hostname not in ["localhost", "127.0.0.1"]:
                https_url = request.url.replace(scheme="https")
                return RedirectResponse(url=str(https_url), status_code=301)
        
        # Process request
        response = await call_next(request)
        
        # Add security headers
        self._add_security_headers(response)
        
        return response
    
    def _add_security_headers(self, response: Response):
        """Add all security headers to response"""
        
        # HSTS - Force HTTPS for 1 year
        response.headers["Strict-Transport-Security"] = build_hsts_header()
        
        # CSP - Prevent XSS and code injection
        response.headers["Content-Security-Policy"] = build_csp_header()
        
        # X-Frame-Options - Prevent clickjacking (legacy, CSP frame-ancestors is preferred)
        response.headers["X-Frame-Options"] = "SAMEORIGIN"
        
        # X-Content-Type-Options - Prevent MIME type sniffing
        response.headers["X-Content-Type-Options"] = "nosniff"
        
        # X-XSS-Protection - Enable browser XSS filter (legacy but still useful)
        response.headers["X-XSS-Protection"] = "1; mode=block"
        
        # Referrer-Policy - Control referrer information
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        
        # Permissions-Policy (formerly Feature-Policy) - Disable unnecessary browser features
        response.headers["Permissions-Policy"] = (
            "accelerometer=(), "
            "ambient-light-sensor=(), "
            "autoplay=(), "
            "battery=(), "
            "camera=(), "
            "cross-origin-isolated=(), "
            "display-capture=(), "
            "document-domain=(), "
            "encrypted-media=(), "
            "execution-while-not-rendered=(), "
            "execution-while-out-of-viewport=(), "
            "fullscreen=(self), "
            "geolocation=(self), "
            "gyroscope=(), "
            "keyboard-map=(), "
            "magnetometer=(), "
            "microphone=(), "
            "midi=(), "
            "navigation-override=(), "
            "payment=(self), "
            "picture-in-picture=(), "
            "publickey-credentials-get=(), "
            "screen-wake-lock=(), "
            "sync-xhr=(), "
            "usb=(), "
            "web-share=(), "
            "xr-spatial-tracking=()"
        )
        
        # Cache-Control for sensitive pages
        if "/api/auth" in str(response.headers.get("location", "")):
            response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, private"
            response.headers["Pragma"] = "no-cache"
            response.headers["Expires"] = "0"
        
        # Remove server header (hide technology stack)
        if "server" in response.headers:
            del response.headers["server"]
        
        # Add custom server header
        response.headers["X-Powered-By"] = "AirYatra"


class HTTPSRedirectMiddleware(BaseHTTPMiddleware):
    """
    Dedicated HTTPS redirect middleware
    Redirects all HTTP requests to HTTPS
    """
    
    def __init__(self, app, exclude_paths: list = None):
        super().__init__(app)
        self.exclude_paths = exclude_paths or ["/health", "/api/health", "/.well-known"]
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Skip if already HTTPS or excluded path
        if request.url.scheme == "https":
            return await call_next(request)
        
        # Skip excluded paths
        for path in self.exclude_paths:
            if request.url.path.startswith(path):
                return await call_next(request)
        
        # Skip localhost
        if request.url.hostname in ["localhost", "127.0.0.1"]:
            return await call_next(request)
        
        # Check X-Forwarded-Proto header (for proxies/load balancers)
        forwarded_proto = request.headers.get("x-forwarded-proto", "")
        if forwarded_proto == "https":
            return await call_next(request)
        
        # Redirect to HTTPS
        https_url = request.url.replace(scheme="https")
        return RedirectResponse(url=str(https_url), status_code=301)


# Export for use in server.py
def get_security_config():
    """Get current security configuration"""
    return {
        "hsts": {
            "enabled": True,
            "max_age": HSTS_MAX_AGE,
            "include_subdomains": HSTS_INCLUDE_SUBDOMAINS,
            "preload": HSTS_PRELOAD
        },
        "csp": {
            "enabled": True,
            "report_uri": CSP_REPORT_URI or None
        },
        "https_enforcement": ENFORCE_HTTPS,
        "headers": [
            "Strict-Transport-Security",
            "Content-Security-Policy",
            "X-Frame-Options",
            "X-Content-Type-Options",
            "X-XSS-Protection",
            "Referrer-Policy",
            "Permissions-Policy"
        ]
    }
