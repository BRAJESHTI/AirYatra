"""
AirYatra Email Tracking Service
Features: Open tracking (pixel), Click tracking (link wrapper), Analytics
"""

import os
import uuid
import hashlib
import base64
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, Optional, List
from urllib.parse import urlencode, quote
import re

# ==================== CONFIGURATION ====================

TRACKING_CONFIG = {
    "enabled": os.environ.get("EMAIL_TRACKING_ENABLED", "true").lower() == "true",
    "base_url": os.environ.get("EMAIL_TRACKING_BASE_URL", ""),  # Will use REACT_APP_BACKEND_URL
    "pixel_endpoint": "/api/email/track/open",
    "click_endpoint": "/api/email/track/click",
}

# 1x1 transparent GIF pixel (base64 encoded)
TRACKING_PIXEL_GIF = base64.b64decode(
    "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"
)


class EmailTrackingService:
    """Service for tracking email opens and clicks"""
    
    def __init__(self):
        self.enabled = TRACKING_CONFIG["enabled"]
    
    def generate_tracking_id(self, email_id: str = None) -> str:
        """Generate a unique tracking ID for an email"""
        if email_id:
            return f"ET-{email_id}-{uuid.uuid4().hex[:8].upper()}"
        return f"ET-{uuid.uuid4().hex[:12].upper()}"
    
    def get_tracking_pixel_url(self, tracking_id: str, base_url: str = None) -> str:
        """Generate URL for open tracking pixel"""
        if not base_url:
            base_url = TRACKING_CONFIG["base_url"] or "https://airyatra-corporate.preview.emergentagent.com"
        
        params = urlencode({"tid": tracking_id, "t": int(datetime.now(timezone.utc).timestamp())})
        return f"{base_url}{TRACKING_CONFIG['pixel_endpoint']}?{params}"
    
    def get_tracking_pixel_html(self, tracking_id: str, base_url: str = None) -> str:
        """Generate HTML for open tracking pixel"""
        pixel_url = self.get_tracking_pixel_url(tracking_id, base_url)
        return f'<img src="{pixel_url}" width="1" height="1" style="display:none;visibility:hidden;" alt="" />'
    
    def wrap_link_for_tracking(self, original_url: str, tracking_id: str, link_id: str = None, base_url: str = None) -> str:
        """Wrap a link for click tracking"""
        if not base_url:
            base_url = TRACKING_CONFIG["base_url"] or "https://airyatra-corporate.preview.emergentagent.com"
        
        if not link_id:
            link_id = hashlib.md5(original_url.encode()).hexdigest()[:8]
        
        params = urlencode({
            "tid": tracking_id,
            "lid": link_id,
            "url": original_url
        })
        return f"{base_url}{TRACKING_CONFIG['click_endpoint']}?{params}"
    
    def inject_tracking_into_html(self, html: str, tracking_id: str, base_url: str = None) -> str:
        """Inject tracking pixel and wrap all links in HTML email"""
        if not self.enabled:
            return html
        
        # 1. Inject tracking pixel before </body>
        pixel_html = self.get_tracking_pixel_html(tracking_id, base_url)
        if "</body>" in html:
            html = html.replace("</body>", f"{pixel_html}</body>")
        else:
            html += pixel_html
        
        # 2. Wrap all href links for click tracking
        def replace_link(match):
            original_url = match.group(1)
            # Skip mailto, tel, and anchor links
            if original_url.startswith(("mailto:", "tel:", "#", "javascript:")):
                return match.group(0)
            
            tracked_url = self.wrap_link_for_tracking(original_url, tracking_id, base_url=base_url)
            return f'href="{tracked_url}"'
        
        # Match href="..." patterns
        html = re.sub(r'href="([^"]+)"', replace_link, html)
        
        return html
    
    def get_pixel_response(self) -> bytes:
        """Get the tracking pixel image bytes"""
        return TRACKING_PIXEL_GIF


# Singleton instance
email_tracking_service = EmailTrackingService()


# ==================== DATABASE MODELS ====================

def create_email_tracking_record(
    tracking_id: str,
    email_type: str,
    recipient: str,
    subject: str,
    template_name: str = None,
    booking_id: str = None,
    user_id: str = None,
    metadata: Dict[str, Any] = None
) -> Dict[str, Any]:
    """Create a tracking record for database storage"""
    return {
        "tracking_id": tracking_id,
        "email_type": email_type,
        "template_name": template_name,
        "recipient": recipient,
        "subject": subject,
        "booking_id": booking_id,
        "user_id": user_id,
        "metadata": metadata or {},
        "status": "sent",
        "sent_at": datetime.now(timezone.utc),
        "opened": False,
        "opened_at": None,
        "open_count": 0,
        "clicked": False,
        "clicked_at": None,
        "click_count": 0,
        "clicked_links": [],
        "user_agent": None,
        "ip_address": None
    }


def create_click_record(
    tracking_id: str,
    link_id: str,
    original_url: str,
    user_agent: str = None,
    ip_address: str = None
) -> Dict[str, Any]:
    """Create a click tracking record"""
    return {
        "click_id": f"CLK-{uuid.uuid4().hex[:8].upper()}",
        "tracking_id": tracking_id,
        "link_id": link_id,
        "original_url": original_url,
        "clicked_at": datetime.now(timezone.utc),
        "user_agent": user_agent,
        "ip_address": ip_address
    }


# ==================== ANALYTICS FUNCTIONS ====================

async def get_email_analytics(db, days: int = 30, template_name: str = None) -> Dict[str, Any]:
    """Get email analytics for dashboard"""
    start_date = datetime.now(timezone.utc) - timedelta(days=days)
    
    query = {"sent_at": {"$gte": start_date}}
    if template_name:
        query["template_name"] = template_name
    
    # Get all tracked emails
    emails = await db.email_tracking.find(query).to_list(10000)
    
    total = len(emails)
    opened = sum(1 for e in emails if e.get("opened"))
    clicked = sum(1 for e in emails if e.get("clicked"))
    
    # Calculate rates
    open_rate = round((opened / total) * 100, 2) if total > 0 else 0
    click_rate = round((clicked / total) * 100, 2) if total > 0 else 0
    click_to_open_rate = round((clicked / opened) * 100, 2) if opened > 0 else 0
    
    # Group by template
    template_stats = {}
    for email in emails:
        tpl = email.get("template_name", "unknown")
        if tpl not in template_stats:
            template_stats[tpl] = {"sent": 0, "opened": 0, "clicked": 0}
        template_stats[tpl]["sent"] += 1
        if email.get("opened"):
            template_stats[tpl]["opened"] += 1
        if email.get("clicked"):
            template_stats[tpl]["clicked"] += 1
    
    # Daily breakdown
    daily_stats = {}
    for email in emails:
        date = email.get("sent_at").strftime("%Y-%m-%d") if email.get("sent_at") else "unknown"
        if date not in daily_stats:
            daily_stats[date] = {"sent": 0, "opened": 0, "clicked": 0}
        daily_stats[date]["sent"] += 1
        if email.get("opened"):
            daily_stats[date]["opened"] += 1
        if email.get("clicked"):
            daily_stats[date]["clicked"] += 1
    
    return {
        "period_days": days,
        "total_sent": total,
        "total_opened": opened,
        "total_clicked": clicked,
        "open_rate": open_rate,
        "click_rate": click_rate,
        "click_to_open_rate": click_to_open_rate,
        "template_breakdown": template_stats,
        "daily_breakdown": dict(sorted(daily_stats.items()))
    }
