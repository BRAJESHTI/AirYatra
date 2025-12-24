import asyncio
from datetime import datetime, timezone, timedelta
from typing import Dict, List
from uuid import uuid4

class SettlementAutomationService:
    """
    Automated settlement processing service
    यह service operators के settlements को automatically process करती है
    """
    
    def __init__(self):
        self.is_running = False
        self.last_run = None
        self.processing_interval_hours = 24  # Run daily
    
    async def calculate_operator_settlement(self, db, operator_id: str, period_start: str, period_end: str) -> Dict:
        """
        Calculate settlement amount for an operator
        
        Settlement = Total Bookings Amount - Platform Commission - GST
        """
        # Get platform commission settings
        settings = await db.platform_settings.find_one({"type": "commission"}, {"_id": 0})
        commission_rate = settings.get("commission_rate", 10) if settings else 10  # Default 10%
        
        # Get completed bookings for the period
        bookings = await db.bookings.find({
            "operator_id": operator_id,
            "status": "completed",
            "completed_at": {
                "$gte": period_start,
                "$lte": period_end
            }
        }, {"_id": 0}).to_list(1000)
        
        if not bookings:
            return {
                "operator_id": operator_id,
                "period_start": period_start,
                "period_end": period_end,
                "total_bookings": 0,
                "gross_amount": 0,
                "commission_amount": 0,
                "gst_amount": 0,
                "net_payable": 0,
                "booking_ids": []
            }
        
        # Calculate totals
        gross_amount = sum(b.get("total_amount", 0) or b.get("estimated_price", 0) for b in bookings)
        commission_amount = gross_amount * (commission_rate / 100)
        gst_on_commission = commission_amount * 0.18  # 18% GST on commission
        net_payable = gross_amount - commission_amount - gst_on_commission
        
        return {
            "operator_id": operator_id,
            "period_start": period_start,
            "period_end": period_end,
            "total_bookings": len(bookings),
            "gross_amount": round(gross_amount, 2),
            "commission_rate": commission_rate,
            "commission_amount": round(commission_amount, 2),
            "gst_on_commission": round(gst_on_commission, 2),
            "net_payable": round(net_payable, 2),
            "booking_ids": [b["id"] for b in bookings]
        }
    
    async def create_settlement_record(self, db, settlement_data: Dict) -> Dict:
        """Create a settlement record in database"""
        
        # Check if settlement already exists for this period
        existing = await db.settlements.find_one({
            "operator_id": settlement_data["operator_id"],
            "period_start": settlement_data["period_start"],
            "period_end": settlement_data["period_end"]
        }, {"_id": 0})
        
        if existing:
            return {"status": "exists", "settlement": existing}
        
        # Get operator details
        operator = await db.operators.find_one(
            {"id": settlement_data["operator_id"]},
            {"_id": 0, "company_name": 1, "bank_account": 1, "contact_email": 1}
        )
        
        settlement = {
            "id": str(uuid4()),
            "settlement_number": f"STL-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{uuid4().hex[:6].upper()}",
            **settlement_data,
            "operator_name": operator.get("company_name") if operator else "Unknown",
            "bank_details": operator.get("bank_account") if operator else None,
            "status": "pending",  # pending, processing, completed, failed
            "created_at": datetime.now(timezone.utc).isoformat(),
            "payment_reference": None,
            "paid_at": None,
            "notes": []
        }
        
        await db.settlements.insert_one(settlement)
        
        # Create notification for operator
        if operator:
            await db.in_app_notifications.insert_one({
                "id": str(uuid4()),
                "user_id": operator.get("user_id"),
                "type": "settlement_created",
                "title": "New Settlement Ready",
                "message": f"Settlement of ₹{settlement_data['net_payable']:,.2f} is ready for processing",
                "data": {"settlement_id": settlement["id"]},
                "read": False,
                "created_at": datetime.now(timezone.utc).isoformat()
            })
        
        return {"status": "created", "settlement": settlement}
    
    async def process_weekly_settlements(self, db) -> Dict:
        """
        Process weekly settlements for all operators
        Runs every Monday for the previous week
        """
        # Calculate period (last Monday to Sunday)
        today = datetime.now(timezone.utc)
        days_since_monday = today.weekday()
        period_end = (today - timedelta(days=days_since_monday)).replace(hour=0, minute=0, second=0, microsecond=0)
        period_start = period_end - timedelta(days=7)
        
        period_start_str = period_start.isoformat()
        period_end_str = period_end.isoformat()
        
        print(f"[Settlement] Processing settlements for period: {period_start_str} to {period_end_str}")
        
        # Get all active operators
        operators = await db.operators.find(
            {"status": "active"},
            {"_id": 0, "id": 1, "company_name": 1}
        ).to_list(1000)
        
        results = {
            "period_start": period_start_str,
            "period_end": period_end_str,
            "processed_count": 0,
            "skipped_count": 0,
            "total_amount": 0,
            "settlements": []
        }
        
        for operator in operators:
            try:
                # Calculate settlement
                settlement_data = await self.calculate_operator_settlement(
                    db,
                    operator["id"],
                    period_start_str,
                    period_end_str
                )
                
                # Skip if no bookings
                if settlement_data["total_bookings"] == 0:
                    results["skipped_count"] += 1
                    continue
                
                # Create settlement record
                result = await self.create_settlement_record(db, settlement_data)
                
                if result["status"] == "created":
                    results["processed_count"] += 1
                    results["total_amount"] += settlement_data["net_payable"]
                    results["settlements"].append({
                        "operator_name": operator.get("company_name"),
                        "amount": settlement_data["net_payable"],
                        "bookings": settlement_data["total_bookings"]
                    })
                else:
                    results["skipped_count"] += 1
                    
            except Exception as e:
                print(f"[Settlement] Error processing operator {operator['id']}: {e}")
                results["skipped_count"] += 1
        
        # Log the run
        await db.settlement_runs.insert_one({
            "id": str(uuid4()),
            "run_type": "weekly_auto",
            "period_start": period_start_str,
            "period_end": period_end_str,
            "results": results,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        
        print(f"[Settlement] Completed: {results['processed_count']} settlements created, ₹{results['total_amount']:,.2f} total")
        
        return results
    
    async def process_manual_settlement(self, db, operator_id: str, period_start: str, period_end: str) -> Dict:
        """Process a manual settlement for specific operator and period"""
        
        settlement_data = await self.calculate_operator_settlement(
            db, operator_id, period_start, period_end
        )
        
        if settlement_data["total_bookings"] == 0:
            return {
                "success": False,
                "message": "No completed bookings found for this period",
                "settlement_data": settlement_data
            }
        
        result = await self.create_settlement_record(db, settlement_data)
        
        return {
            "success": True,
            "message": f"Settlement created for ₹{settlement_data['net_payable']:,.2f}",
            "settlement": result.get("settlement")
        }
    
    async def mark_settlement_paid(self, db, settlement_id: str, payment_reference: str, paid_by: str) -> Dict:
        """Mark a settlement as paid"""
        
        settlement = await db.settlements.find_one({"id": settlement_id}, {"_id": 0})
        if not settlement:
            return {"success": False, "message": "Settlement not found"}
        
        if settlement.get("status") == "completed":
            return {"success": False, "message": "Settlement already marked as paid"}
        
        await db.settlements.update_one(
            {"id": settlement_id},
            {"$set": {
                "status": "completed",
                "payment_reference": payment_reference,
                "paid_at": datetime.now(timezone.utc).isoformat(),
                "paid_by": paid_by
            }}
        )
        
        # Notify operator
        operator = await db.operators.find_one({"id": settlement["operator_id"]}, {"_id": 0})
        if operator:
            await db.in_app_notifications.insert_one({
                "id": str(uuid4()),
                "user_id": operator.get("user_id"),
                "type": "settlement_paid",
                "title": "Settlement Paid! / भुगतान हो गया!",
                "message": f"Settlement of ₹{settlement['net_payable']:,.2f} has been credited. Ref: {payment_reference}",
                "data": {"settlement_id": settlement_id},
                "read": False,
                "created_at": datetime.now(timezone.utc).isoformat()
            })
        
        return {
            "success": True,
            "message": "Settlement marked as paid",
            "payment_reference": payment_reference
        }
    
    async def get_pending_settlements(self, db, limit: int = 50) -> List[Dict]:
        """Get all pending settlements"""
        settlements = await db.settlements.find(
            {"status": {"$in": ["pending", "processing"]}},
            {"_id": 0}
        ).sort("created_at", -1).limit(limit).to_list(limit)
        
        return settlements
    
    async def run_scheduler(self, db):
        """Background scheduler for automatic settlements"""
        self.is_running = True
        print("[Settlement Scheduler] Started")
        
        while self.is_running:
            try:
                now = datetime.now(timezone.utc)
                
                # Run on Mondays at 6 AM UTC
                if now.weekday() == 0 and now.hour == 6:
                    if self.last_run is None or (now - self.last_run).days >= 1:
                        print("[Settlement Scheduler] Running weekly settlement processing...")
                        await self.process_weekly_settlements(db)
                        self.last_run = now
                
                # Sleep for 1 hour
                await asyncio.sleep(3600)
                
            except Exception as e:
                print(f"[Settlement Scheduler] Error: {e}")
                await asyncio.sleep(60)  # Wait 1 minute on error
    
    def stop_scheduler(self):
        """Stop the background scheduler"""
        self.is_running = False
        print("[Settlement Scheduler] Stopped")

# Singleton instance
settlement_service = SettlementAutomationService()
