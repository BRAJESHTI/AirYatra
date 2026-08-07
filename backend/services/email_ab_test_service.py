"""
AirYatra Email A/B Testing Service
Compare subject lines and content to optimize email engagement
"""

import uuid
import random
import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional

logger = logging.getLogger(__name__)


class EmailABTestService:
    """Service for A/B testing email campaigns"""
    
    def __init__(self):
        pass
    
    async def create_ab_test(
        self,
        db,
        test_name: str,
        email_type: str,
        variant_a: Dict[str, Any],
        variant_b: Dict[str, Any],
        split_ratio: int = 50,  # Percentage for variant A (0-100)
        auto_winner: bool = True,
        auto_winner_metric: str = "open_rate",  # open_rate, click_rate
        auto_winner_threshold: int = 100,  # Min recipients before declaring winner
        created_by: str = None
    ) -> Dict[str, Any]:
        """
        Create a new A/B test for email campaigns
        
        Args:
            test_name: Name of the test
            email_type: Type of email (booking_confirmation, promo, etc.)
            variant_a: {subject: str, preview_text: str, template_override: dict}
            variant_b: {subject: str, preview_text: str, template_override: dict}
            split_ratio: Percentage of recipients to receive variant A
            auto_winner: Automatically select winner after threshold
            auto_winner_metric: Metric to determine winner
            auto_winner_threshold: Minimum recipients before auto-selecting
        """
        test_id = str(uuid.uuid4())
        
        test_record = {
            "id": test_id,
            "test_name": test_name,
            "email_type": email_type,
            "status": "active",  # active, paused, completed, winner_selected
            "variant_a": {
                "id": "A",
                "subject": variant_a.get("subject", ""),
                "preview_text": variant_a.get("preview_text", ""),
                "template_override": variant_a.get("template_override", {}),
                "sent_count": 0,
                "open_count": 0,
                "click_count": 0,
                "open_rate": 0.0,
                "click_rate": 0.0
            },
            "variant_b": {
                "id": "B",
                "subject": variant_b.get("subject", ""),
                "preview_text": variant_b.get("preview_text", ""),
                "template_override": variant_b.get("template_override", {}),
                "sent_count": 0,
                "open_count": 0,
                "click_count": 0,
                "open_rate": 0.0,
                "click_rate": 0.0
            },
            "split_ratio": split_ratio,
            "auto_winner": auto_winner,
            "auto_winner_metric": auto_winner_metric,
            "auto_winner_threshold": auto_winner_threshold,
            "winner": None,
            "winner_selected_at": None,
            "created_by": created_by,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        }
        
        await db.email_ab_tests.insert_one(test_record)
        
        logger.info(f"[A/B Test] Created test '{test_name}' (ID: {test_id})")
        
        return {
            "success": True,
            "test_id": test_id,
            "test_name": test_name,
            "status": "active"
        }
    
    async def get_variant_for_recipient(
        self,
        db,
        test_id: str,
        recipient_email: str
    ) -> Dict[str, Any]:
        """
        Get which variant to send to a recipient.
        Uses consistent hashing so same recipient always gets same variant.
        """
        test = await db.email_ab_tests.find_one({"id": test_id}, {"_id": 0})
        
        if not test or test.get("status") != "active":
            return {"success": False, "error": "Test not found or not active"}
        
        # If winner already selected, return winner variant
        if test.get("winner"):
            winner_variant = test.get(f"variant_{test['winner'].lower()}")
            return {
                "success": True,
                "variant": test["winner"],
                "subject": winner_variant.get("subject"),
                "preview_text": winner_variant.get("preview_text"),
                "template_override": winner_variant.get("template_override", {}),
                "is_winner": True
            }
        
        # Consistent assignment based on email hash
        email_hash = hash(recipient_email + test_id)
        percentage = abs(email_hash) % 100
        
        if percentage < test.get("split_ratio", 50):
            variant = "A"
            variant_data = test["variant_a"]
        else:
            variant = "B"
            variant_data = test["variant_b"]
        
        return {
            "success": True,
            "variant": variant,
            "subject": variant_data.get("subject"),
            "preview_text": variant_data.get("preview_text"),
            "template_override": variant_data.get("template_override", {}),
            "is_winner": False
        }
    
    async def record_send(
        self,
        db,
        test_id: str,
        variant: str,
        recipient_email: str,
        tracking_id: str
    ) -> Dict[str, Any]:
        """Record that an email was sent for this test"""
        
        variant_key = f"variant_{variant.lower()}"
        
        # Update sent count
        await db.email_ab_tests.update_one(
            {"id": test_id},
            {
                "$inc": {f"{variant_key}.sent_count": 1},
                "$set": {"updated_at": datetime.now(timezone.utc)}
            }
        )
        
        # Store send record for tracking
        send_record = {
            "id": str(uuid.uuid4()),
            "test_id": test_id,
            "variant": variant,
            "recipient_email": recipient_email,
            "tracking_id": tracking_id,
            "sent_at": datetime.now(timezone.utc),
            "opened": False,
            "clicked": False
        }
        
        await db.email_ab_test_sends.insert_one(send_record)
        
        return {"success": True}
    
    async def record_open(
        self,
        db,
        test_id: str,
        tracking_id: str
    ) -> Dict[str, Any]:
        """Record an email open for A/B test"""
        
        # Find the send record
        send = await db.email_ab_test_sends.find_one({"tracking_id": tracking_id})
        
        if not send:
            return {"success": False, "error": "Send record not found"}
        
        if send.get("opened"):
            return {"success": True, "already_recorded": True}
        
        variant = send.get("variant", "A")
        variant_key = f"variant_{variant.lower()}"
        
        # Update open count
        await db.email_ab_tests.update_one(
            {"id": test_id},
            {
                "$inc": {f"{variant_key}.open_count": 1},
                "$set": {"updated_at": datetime.now(timezone.utc)}
            }
        )
        
        # Mark as opened
        await db.email_ab_test_sends.update_one(
            {"tracking_id": tracking_id},
            {"$set": {"opened": True, "opened_at": datetime.now(timezone.utc)}}
        )
        
        # Recalculate rates and check for auto-winner
        await self._update_rates_and_check_winner(db, test_id)
        
        return {"success": True}
    
    async def record_click(
        self,
        db,
        test_id: str,
        tracking_id: str
    ) -> Dict[str, Any]:
        """Record an email click for A/B test"""
        
        send = await db.email_ab_test_sends.find_one({"tracking_id": tracking_id})
        
        if not send:
            return {"success": False, "error": "Send record not found"}
        
        variant = send.get("variant", "A")
        variant_key = f"variant_{variant.lower()}"
        
        # Update click count (allow multiple clicks)
        await db.email_ab_tests.update_one(
            {"id": test_id},
            {
                "$inc": {f"{variant_key}.click_count": 1},
                "$set": {"updated_at": datetime.now(timezone.utc)}
            }
        )
        
        # Mark as clicked
        await db.email_ab_test_sends.update_one(
            {"tracking_id": tracking_id},
            {"$set": {"clicked": True, "clicked_at": datetime.now(timezone.utc)}}
        )
        
        # Recalculate rates
        await self._update_rates_and_check_winner(db, test_id)
        
        return {"success": True}
    
    async def _update_rates_and_check_winner(self, db, test_id: str):
        """Update open/click rates and check for auto-winner"""
        
        test = await db.email_ab_tests.find_one({"id": test_id}, {"_id": 0})
        
        if not test or test.get("winner"):
            return
        
        variant_a = test["variant_a"]
        variant_b = test["variant_b"]
        
        # Calculate rates
        a_open_rate = (variant_a["open_count"] / variant_a["sent_count"] * 100) if variant_a["sent_count"] > 0 else 0
        a_click_rate = (variant_a["click_count"] / variant_a["sent_count"] * 100) if variant_a["sent_count"] > 0 else 0
        
        b_open_rate = (variant_b["open_count"] / variant_b["sent_count"] * 100) if variant_b["sent_count"] > 0 else 0
        b_click_rate = (variant_b["click_count"] / variant_b["sent_count"] * 100) if variant_b["sent_count"] > 0 else 0
        
        # Update rates
        await db.email_ab_tests.update_one(
            {"id": test_id},
            {
                "$set": {
                    "variant_a.open_rate": round(a_open_rate, 2),
                    "variant_a.click_rate": round(a_click_rate, 2),
                    "variant_b.open_rate": round(b_open_rate, 2),
                    "variant_b.click_rate": round(b_click_rate, 2)
                }
            }
        )
        
        # Check for auto-winner
        if test.get("auto_winner"):
            total_sent = variant_a["sent_count"] + variant_b["sent_count"]
            threshold = test.get("auto_winner_threshold", 100)
            
            if total_sent >= threshold:
                metric = test.get("auto_winner_metric", "open_rate")
                
                if metric == "open_rate":
                    winner = "A" if a_open_rate > b_open_rate else "B"
                    winning_rate = max(a_open_rate, b_open_rate)
                else:  # click_rate
                    winner = "A" if a_click_rate > b_click_rate else "B"
                    winning_rate = max(a_click_rate, b_click_rate)
                
                # Only declare winner if there's meaningful difference (>5%)
                rate_diff = abs(a_open_rate - b_open_rate) if metric == "open_rate" else abs(a_click_rate - b_click_rate)
                
                if rate_diff >= 5:
                    await db.email_ab_tests.update_one(
                        {"id": test_id},
                        {
                            "$set": {
                                "winner": winner,
                                "winner_selected_at": datetime.now(timezone.utc),
                                "status": "winner_selected",
                                "winner_reason": f"Auto-selected based on {metric}: {winning_rate:.1f}%"
                            }
                        }
                    )
                    logger.info(f"[A/B Test] Auto-winner selected for {test_id}: Variant {winner}")
    
    async def select_winner(
        self,
        db,
        test_id: str,
        winner: str,
        reason: str = "Manual selection"
    ) -> Dict[str, Any]:
        """Manually select a winner for the A/B test"""
        
        if winner.upper() not in ["A", "B"]:
            return {"success": False, "error": "Winner must be 'A' or 'B'"}
        
        result = await db.email_ab_tests.update_one(
            {"id": test_id},
            {
                "$set": {
                    "winner": winner.upper(),
                    "winner_selected_at": datetime.now(timezone.utc),
                    "status": "winner_selected",
                    "winner_reason": reason
                }
            }
        )
        
        if result.modified_count == 0:
            return {"success": False, "error": "Test not found"}
        
        return {"success": True, "winner": winner.upper()}
    
    async def get_test_results(
        self,
        db,
        test_id: str
    ) -> Dict[str, Any]:
        """Get detailed results for an A/B test"""
        
        test = await db.email_ab_tests.find_one({"id": test_id}, {"_id": 0})
        
        if not test:
            return {"success": False, "error": "Test not found"}
        
        # Calculate statistical significance (simplified)
        variant_a = test["variant_a"]
        variant_b = test["variant_b"]
        
        total_sent = variant_a["sent_count"] + variant_b["sent_count"]
        
        # Determine leader
        metric = test.get("auto_winner_metric", "open_rate")
        
        if metric == "open_rate":
            leader = "A" if variant_a["open_rate"] > variant_b["open_rate"] else "B"
            lead_margin = abs(variant_a["open_rate"] - variant_b["open_rate"])
        else:
            leader = "A" if variant_a["click_rate"] > variant_b["click_rate"] else "B"
            lead_margin = abs(variant_a["click_rate"] - variant_b["click_rate"])
        
        return {
            "success": True,
            "test_id": test_id,
            "test_name": test.get("test_name"),
            "status": test.get("status"),
            "email_type": test.get("email_type"),
            "variant_a": {
                "subject": variant_a.get("subject"),
                "sent": variant_a["sent_count"],
                "opens": variant_a["open_count"],
                "clicks": variant_a["click_count"],
                "open_rate": variant_a["open_rate"],
                "click_rate": variant_a["click_rate"]
            },
            "variant_b": {
                "subject": variant_b.get("subject"),
                "sent": variant_b["sent_count"],
                "opens": variant_b["open_count"],
                "clicks": variant_b["click_count"],
                "open_rate": variant_b["open_rate"],
                "click_rate": variant_b["click_rate"]
            },
            "total_sent": total_sent,
            "current_leader": leader,
            "lead_margin": round(lead_margin, 2),
            "winner": test.get("winner"),
            "winner_reason": test.get("winner_reason"),
            "winner_selected_at": test.get("winner_selected_at"),
            "split_ratio": test.get("split_ratio"),
            "auto_winner_threshold": test.get("auto_winner_threshold"),
            "created_at": test.get("created_at")
        }
    
    async def list_tests(
        self,
        db,
        status: Optional[str] = None,
        limit: int = 20
    ) -> List[Dict[str, Any]]:
        """List all A/B tests"""
        
        query = {}
        if status:
            query["status"] = status
        
        tests = await db.email_ab_tests.find(
            query,
            {"_id": 0}
        ).sort("created_at", -1).limit(limit).to_list(limit)
        
        return tests
    
    async def pause_test(self, db, test_id: str) -> Dict[str, Any]:
        """Pause an active A/B test"""
        result = await db.email_ab_tests.update_one(
            {"id": test_id, "status": "active"},
            {"$set": {"status": "paused", "updated_at": datetime.now(timezone.utc)}}
        )
        
        if result.modified_count == 0:
            return {"success": False, "error": "Test not found or not active"}
        
        return {"success": True}
    
    async def resume_test(self, db, test_id: str) -> Dict[str, Any]:
        """Resume a paused A/B test"""
        result = await db.email_ab_tests.update_one(
            {"id": test_id, "status": "paused"},
            {"$set": {"status": "active", "updated_at": datetime.now(timezone.utc)}}
        )
        
        if result.modified_count == 0:
            return {"success": False, "error": "Test not found or not paused"}
        
        return {"success": True}
    
    async def delete_test(self, db, test_id: str) -> Dict[str, Any]:
        """Delete an A/B test and its send records"""
        
        await db.email_ab_test_sends.delete_many({"test_id": test_id})
        result = await db.email_ab_tests.delete_one({"id": test_id})
        
        if result.deleted_count == 0:
            return {"success": False, "error": "Test not found"}
        
        return {"success": True}


# Singleton instance
email_ab_test_service = EmailABTestService()
