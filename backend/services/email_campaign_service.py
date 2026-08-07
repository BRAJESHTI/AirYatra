"""
AirYatra Email Campaign Service
Features: Scheduled Campaigns, A/B Testing, Unsubscribe Management
"""

import uuid
import hashlib
import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, Optional, List

logger = logging.getLogger(__name__)

# ==================== UNSUBSCRIBE SERVICE ====================

class EmailPreferenceService:
    """Manages email preferences and unsubscribe functionality"""
    
    PREFERENCE_TYPES = {
        "marketing": "Marketing & Promotions",
        "booking_updates": "Booking Updates",
        "flight_reminders": "Flight Reminders",
        "newsletters": "Newsletters & Tips",
        "all": "All Emails"
    }
    
    def generate_unsubscribe_token(self, email: str) -> str:
        """Generate a unique unsubscribe token for an email"""
        data = f"{email}:{uuid.uuid4().hex}"
        return hashlib.sha256(data.encode()).hexdigest()[:32]
    
    def get_unsubscribe_url(self, token: str, base_url: str = None) -> str:
        """Generate unsubscribe URL"""
        if not base_url:
            base_url = "https://aviation-erp-2.preview.emergentagent.com"
        return f"{base_url}/unsubscribe/{token}"
    
    def get_unsubscribe_html(self, token: str, base_url: str = None) -> str:
        """Generate unsubscribe link HTML for email footer"""
        url = self.get_unsubscribe_url(token, base_url)
        return f'''
        <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #334155;">
            <p style="color: #64748b; font-size: 12px;">
                Don't want to receive these emails? 
                <a href="{url}" style="color: #f97316; text-decoration: underline;">Unsubscribe</a> | 
                <a href="{url}?manage=true" style="color: #f97316; text-decoration: underline;">Manage Preferences</a>
            </p>
        </div>
        '''


def create_email_preference_record(
    email: str,
    token: str,
    preferences: Dict[str, bool] = None
) -> Dict[str, Any]:
    """Create email preference record for database"""
    default_prefs = {
        "marketing": True,
        "booking_updates": True,
        "flight_reminders": True,
        "newsletters": True
    }
    return {
        "email": email,
        "token": token,
        "preferences": preferences or default_prefs,
        "unsubscribed_all": False,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }


# ==================== CAMPAIGN SERVICE ====================

class EmailCampaignService:
    """Manages scheduled email campaigns"""
    
    CAMPAIGN_STATUS = {
        "draft": "Draft",
        "scheduled": "Scheduled",
        "sending": "Sending",
        "completed": "Completed",
        "cancelled": "Cancelled",
        "failed": "Failed"
    }
    
    AUDIENCE_TYPES = {
        "all_customers": "All Customers",
        "active_customers": "Active Customers (booked in 90 days)",
        "inactive_customers": "Inactive Customers (no booking in 90 days)",
        "vip_customers": "VIP/Loyalty Members",
        "custom_list": "Custom Email List"
    }


def create_campaign_record(
    name: str,
    template_name: str,
    subject: str,
    audience_type: str,
    scheduled_at: datetime,
    created_by: str,
    custom_emails: List[str] = None,
    ab_testing: Dict = None
) -> Dict[str, Any]:
    """Create campaign record for database"""
    campaign_id = f"CMP-{uuid.uuid4().hex[:8].upper()}"
    return {
        "campaign_id": campaign_id,
        "name": name,
        "template_name": template_name,
        "subject": subject,
        "audience_type": audience_type,
        "custom_emails": custom_emails or [],
        "scheduled_at": scheduled_at,
        "status": "draft",
        "ab_testing": ab_testing,  # {"enabled": bool, "variant_b_subject": str, "split_ratio": 50}
        "stats": {
            "total_recipients": 0,
            "sent": 0,
            "opened": 0,
            "clicked": 0,
            "unsubscribed": 0,
            "failed": 0
        },
        "variant_stats": {
            "a": {"sent": 0, "opened": 0, "clicked": 0},
            "b": {"sent": 0, "opened": 0, "clicked": 0}
        } if ab_testing and ab_testing.get("enabled") else None,
        "winner_variant": None,
        "created_by": created_by,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
        "sent_at": None,
        "completed_at": None
    }


# ==================== A/B TESTING SERVICE ====================

class ABTestingService:
    """Manages A/B testing for email campaigns"""
    
    def split_audience(self, emails: List[str], split_ratio: int = 50) -> Dict[str, List[str]]:
        """Split audience into A and B groups"""
        import random
        shuffled = emails.copy()
        random.shuffle(shuffled)
        
        split_point = int(len(shuffled) * split_ratio / 100)
        return {
            "variant_a": shuffled[:split_point],
            "variant_b": shuffled[split_point:]
        }
    
    def calculate_winner(self, variant_stats: Dict, metric: str = "open_rate") -> Optional[str]:
        """Calculate winning variant based on metric"""
        if not variant_stats:
            return None
        
        a_stats = variant_stats.get("a", {})
        b_stats = variant_stats.get("b", {})
        
        a_sent = a_stats.get("sent", 0)
        b_sent = b_stats.get("sent", 0)
        
        if a_sent == 0 or b_sent == 0:
            return None
        
        if metric == "open_rate":
            a_rate = (a_stats.get("opened", 0) / a_sent) * 100
            b_rate = (b_stats.get("opened", 0) / b_sent) * 100
        elif metric == "click_rate":
            a_rate = (a_stats.get("clicked", 0) / a_sent) * 100
            b_rate = (b_stats.get("clicked", 0) / b_sent) * 100
        else:
            return None
        
        # Need at least 5% difference to declare winner
        if abs(a_rate - b_rate) < 5:
            return "tie"
        
        return "a" if a_rate > b_rate else "b"


# ==================== ANALYTICS HELPERS ====================

async def get_campaign_analytics(db, campaign_id: str) -> Dict[str, Any]:
    """Get detailed analytics for a campaign"""
    campaign = await db.email_campaigns.find_one({"campaign_id": campaign_id}, {"_id": 0})
    if not campaign:
        return None
    
    # Get tracking data for this campaign
    tracking_data = await db.email_tracking.find(
        {"metadata.campaign_id": campaign_id}
    ).to_list(10000)
    
    # Calculate hourly opens/clicks
    hourly_data = {}
    for record in tracking_data:
        if record.get("opened_at"):
            hour = record["opened_at"].strftime("%Y-%m-%d %H:00")
            if hour not in hourly_data:
                hourly_data[hour] = {"opens": 0, "clicks": 0}
            hourly_data[hour]["opens"] += 1
        if record.get("clicked_at"):
            hour = record["clicked_at"].strftime("%Y-%m-%d %H:00")
            if hour not in hourly_data:
                hourly_data[hour] = {"opens": 0, "clicks": 0}
            hourly_data[hour]["clicks"] += 1
    
    return {
        "campaign": campaign,
        "hourly_engagement": [
            {"hour": k, **v} for k, v in sorted(hourly_data.items())
        ]
    }


async def get_daily_email_trends(db, days: int = 30) -> List[Dict]:
    """Get daily email send/open/click trends"""
    start_date = datetime.now(timezone.utc) - timedelta(days=days)
    
    pipeline = [
        {"$match": {"sent_at": {"$gte": start_date}}},
        {"$group": {
            "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$sent_at"}},
            "sent": {"$sum": 1},
            "opened": {"$sum": {"$cond": ["$opened", 1, 0]}},
            "clicked": {"$sum": {"$cond": ["$clicked", 1, 0]}}
        }},
        {"$sort": {"_id": 1}}
    ]
    
    results = await db.email_tracking.aggregate(pipeline).to_list(100)
    
    return [
        {
            "date": r["_id"],
            "sent": r["sent"],
            "opened": r["opened"],
            "clicked": r["clicked"],
            "open_rate": round((r["opened"] / r["sent"]) * 100, 1) if r["sent"] > 0 else 0,
            "click_rate": round((r["clicked"] / r["sent"]) * 100, 1) if r["sent"] > 0 else 0
        }
        for r in results
    ]


async def get_template_performance(db, days: int = 30) -> List[Dict]:
    """Get performance metrics per template"""
    start_date = datetime.now(timezone.utc) - timedelta(days=days)
    
    pipeline = [
        {"$match": {"sent_at": {"$gte": start_date}}},
        {"$group": {
            "_id": "$template_name",
            "sent": {"$sum": 1},
            "opened": {"$sum": {"$cond": ["$opened", 1, 0]}},
            "clicked": {"$sum": {"$cond": ["$clicked", 1, 0]}}
        }},
        {"$sort": {"sent": -1}}
    ]
    
    results = await db.email_tracking.aggregate(pipeline).to_list(20)
    
    return [
        {
            "template": r["_id"] or "unknown",
            "sent": r["sent"],
            "opened": r["opened"],
            "clicked": r["clicked"],
            "open_rate": round((r["opened"] / r["sent"]) * 100, 1) if r["sent"] > 0 else 0,
            "click_rate": round((r["clicked"] / r["sent"]) * 100, 1) if r["sent"] > 0 else 0
        }
        for r in results
    ]


# Singleton instances
email_preference_service = EmailPreferenceService()
email_campaign_service = EmailCampaignService()
ab_testing_service = ABTestingService()
