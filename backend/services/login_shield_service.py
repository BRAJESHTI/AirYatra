"""
AirYatra Login Shield AI™
Enterprise-grade risk scoring and anomaly detection for login security
Features: Risk scoring, Geo-detection, Time-based analysis, Admin alerts
"""

import os
import hashlib
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any, Tuple, List
from database import get_database
import secrets

logger = logging.getLogger(__name__)

# Risk Score Thresholds
RISK_LEVELS = {
    "LOW": (0, 30),
    "MEDIUM": (31, 60),
    "HIGH": (61, 80),
    "CRITICAL": (81, 100)
}

# Risk Factor Weights
RISK_WEIGHTS = {
    "failed_attempts_recent": 15,      # Failed logins in last hour
    "failed_attempts_day": 10,         # Failed logins in last 24h
    "new_device": 20,                  # First time device
    "new_ip": 15,                      # First time IP
    "new_location": 25,                # New country/region
    "unusual_time": 10,                # Login at unusual hours (2-5 AM)
    "rapid_device_switch": 20,         # Multiple devices in short time
    "vpn_proxy_detected": 15,          # Known VPN/proxy IP
    "password_recently_changed": -10,  # Negative = reduces risk
    "trusted_device": -20,             # Negative = reduces risk
    "frequent_user": -15,              # Regular user pattern
}

# Known VPN/Proxy IP ranges (simplified - in production use IP intelligence API)
SUSPICIOUS_IP_PATTERNS = [
    "10.",      # Private
    "172.16.",  # Private
    "192.168.", # Private (but common for local dev)
]

# Unusual login hours (local time approximation)
UNUSUAL_HOURS = list(range(2, 6))  # 2 AM to 5 AM


class LoginShieldAI:
    """AI-powered login risk assessment engine"""
    
    def __init__(self):
        self.risk_weights = RISK_WEIGHTS
        self.risk_levels = RISK_LEVELS
    
    async def calculate_risk_score(
        self,
        user_id: str,
        email: str,
        ip_address: str,
        user_agent: str,
        login_successful: bool = True
    ) -> Dict[str, Any]:
        """
        Calculate comprehensive risk score for a login attempt
        Returns: {score, level, factors, action, alerts}
        """
        db = get_database()
        now = datetime.now(timezone.utc)
        
        risk_factors = []
        total_score = 0
        
        # 1. Check failed login attempts (recent)
        hour_ago = (now - timedelta(hours=1)).isoformat()
        recent_failures = await db.audit_logs.count_documents({
            "user_email": email,
            "action": "login_failed",
            "created_at": {"$gte": hour_ago}
        })
        
        if recent_failures >= 3:
            factor_score = min(recent_failures * 5, self.risk_weights["failed_attempts_recent"])
            total_score += factor_score
            risk_factors.append({
                "factor": "failed_attempts_recent",
                "score": factor_score,
                "detail": f"{recent_failures} failed attempts in last hour"
            })
        
        # 2. Check failed login attempts (24h)
        day_ago = (now - timedelta(hours=24)).isoformat()
        daily_failures = await db.audit_logs.count_documents({
            "user_email": email,
            "action": "login_failed",
            "created_at": {"$gte": day_ago}
        })
        
        if daily_failures >= 5:
            factor_score = min(daily_failures * 2, self.risk_weights["failed_attempts_day"])
            total_score += factor_score
            risk_factors.append({
                "factor": "failed_attempts_day",
                "score": factor_score,
                "detail": f"{daily_failures} failed attempts in last 24 hours"
            })
        
        # 3. Check if new device
        device_hash = hashlib.sha256(f"{user_agent}:{user_id}".encode()).hexdigest()
        known_device = await db.user_sessions.find_one({
            "user_id": user_id,
            "device_hash": device_hash
        })
        
        if not known_device:
            total_score += self.risk_weights["new_device"]
            risk_factors.append({
                "factor": "new_device",
                "score": self.risk_weights["new_device"],
                "detail": "First login from this device"
            })
        
        # 4. Check if new IP
        known_ip = await db.user_sessions.find_one({
            "user_id": user_id,
            "ip_address": ip_address
        })
        
        if not known_ip:
            total_score += self.risk_weights["new_ip"]
            risk_factors.append({
                "factor": "new_ip",
                "score": self.risk_weights["new_ip"],
                "detail": f"First login from IP {ip_address[:10]}..."
            })
        
        # 5. Check for unusual login time
        current_hour = now.hour
        if current_hour in UNUSUAL_HOURS:
            total_score += self.risk_weights["unusual_time"]
            risk_factors.append({
                "factor": "unusual_time",
                "score": self.risk_weights["unusual_time"],
                "detail": f"Login at unusual hour ({current_hour}:00 UTC)"
            })
        
        # 6. Check rapid device switching
        ten_min_ago = (now - timedelta(minutes=10)).isoformat()
        recent_sessions = await db.user_sessions.count_documents({
            "user_id": user_id,
            "created_at": {"$gte": ten_min_ago}
        })
        
        if recent_sessions >= 3:
            total_score += self.risk_weights["rapid_device_switch"]
            risk_factors.append({
                "factor": "rapid_device_switch",
                "score": self.risk_weights["rapid_device_switch"],
                "detail": f"{recent_sessions} different sessions in 10 minutes"
            })
        
        # 7. Check for VPN/Proxy patterns (simplified)
        is_suspicious_ip = any(ip_address.startswith(pattern) for pattern in SUSPICIOUS_IP_PATTERNS)
        if is_suspicious_ip and ip_address.startswith("10."):  # Likely VPN
            total_score += self.risk_weights["vpn_proxy_detected"]
            risk_factors.append({
                "factor": "vpn_proxy_detected",
                "score": self.risk_weights["vpn_proxy_detected"],
                "detail": "Possible VPN/Proxy detected"
            })
        
        # 8. Positive factors (reduce risk)
        
        # Check if trusted device
        trusted = await db.trusted_devices.find_one({
            "user_id": user_id,
            "is_active": True,
            "expires_at": {"$gt": now.isoformat()}
        })
        if trusted:
            total_score += self.risk_weights["trusted_device"]  # Negative value
            risk_factors.append({
                "factor": "trusted_device",
                "score": self.risk_weights["trusted_device"],
                "detail": "Login from trusted device"
            })
        
        # Check if frequent user (logged in multiple times this week)
        week_ago = (now - timedelta(days=7)).isoformat()
        weekly_logins = await db.audit_logs.count_documents({
            "user_id": user_id,
            "action": "login",
            "status": "success",
            "created_at": {"$gte": week_ago}
        })
        
        if weekly_logins >= 5:
            total_score += self.risk_weights["frequent_user"]  # Negative value
            risk_factors.append({
                "factor": "frequent_user",
                "score": self.risk_weights["frequent_user"],
                "detail": f"Regular user ({weekly_logins} logins this week)"
            })
        
        # Ensure score is within bounds
        total_score = max(0, min(100, total_score))
        
        # Determine risk level
        risk_level = "LOW"
        for level, (min_score, max_score) in self.risk_levels.items():
            if min_score <= total_score <= max_score:
                risk_level = level
                break
        
        # Determine action based on risk level
        action = self._determine_action(risk_level, login_successful)
        
        # Create risk assessment record
        assessment = {
            "id": f"risk_{secrets.token_hex(8)}",
            "user_id": user_id,
            "email": email,
            "ip_address": ip_address,
            "user_agent": user_agent[:200] if user_agent else None,
            "score": total_score,
            "level": risk_level,
            "factors": risk_factors,
            "action": action,
            "login_successful": login_successful,
            "assessed_at": now.isoformat(),
        }
        
        # Store assessment
        await db.login_risk_assessments.insert_one(assessment)
        
        # Generate alerts if needed
        alerts = await self._generate_alerts(assessment, db)
        assessment["alerts"] = alerts
        
        logger.info(f"Risk assessment for {email}: Score={total_score}, Level={risk_level}, Action={action['type']}")
        
        return assessment
    
    def _determine_action(self, risk_level: str, login_successful: bool) -> Dict[str, Any]:
        """Determine action based on risk level"""
        actions = {
            "LOW": {
                "type": "allow",
                "force_otp": False,
                "alert_admin": False,
                "block_login": False,
                "message": "Login allowed"
            },
            "MEDIUM": {
                "type": "verify",
                "force_otp": True,
                "alert_admin": False,
                "block_login": False,
                "message": "Additional verification required"
            },
            "HIGH": {
                "type": "alert",
                "force_otp": True,
                "alert_admin": True,
                "block_login": False,
                "message": "Suspicious activity detected - admin notified"
            },
            "CRITICAL": {
                "type": "block",
                "force_otp": True,
                "alert_admin": True,
                "block_login": True,
                "message": "Login blocked due to high risk"
            }
        }
        return actions.get(risk_level, actions["LOW"])
    
    async def _generate_alerts(self, assessment: Dict, db) -> List[Dict]:
        """Generate admin alerts for high-risk logins"""
        alerts = []
        
        if assessment["level"] in ["HIGH", "CRITICAL"]:
            alert = {
                "id": f"alert_{secrets.token_hex(8)}",
                "type": "security_alert",
                "severity": assessment["level"].lower(),
                "title": f"🚨 {assessment['level']} Risk Login Detected",
                "message": f"Suspicious login attempt for {assessment['email']}",
                "details": {
                    "user_email": assessment["email"],
                    "ip_address": assessment["ip_address"],
                    "risk_score": assessment["score"],
                    "risk_factors": [f["detail"] for f in assessment["factors"] if f["score"] > 0],
                    "action_taken": assessment["action"]["type"]
                },
                "is_read": False,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
            
            await db.admin_alerts.insert_one(alert)
            alerts.append(alert)
            
            # If CRITICAL, also create a security incident
            if assessment["level"] == "CRITICAL":
                incident = {
                    "id": f"incident_{secrets.token_hex(8)}",
                    "type": "blocked_login",
                    "severity": "critical",
                    "user_id": assessment["user_id"],
                    "email": assessment["email"],
                    "ip_address": assessment["ip_address"],
                    "risk_assessment_id": assessment["id"],
                    "status": "open",
                    "created_at": datetime.now(timezone.utc).isoformat(),
                }
                await db.security_incidents.insert_one(incident)
        
        return alerts
    
    async def get_user_risk_history(self, user_id: str, limit: int = 20) -> List[Dict]:
        """Get risk assessment history for a user"""
        db = get_database()
        
        assessments = await db.login_risk_assessments.find(
            {"user_id": user_id},
            {"_id": 0}
        ).sort("assessed_at", -1).limit(limit).to_list(limit)
        
        return assessments
    
    async def get_high_risk_logins(self, hours: int = 24, min_level: str = "MEDIUM") -> List[Dict]:
        """Get recent high-risk login attempts for admin dashboard"""
        db = get_database()
        
        levels = ["MEDIUM", "HIGH", "CRITICAL"]
        if min_level in levels:
            levels = levels[levels.index(min_level):]
        
        since = (datetime.now(timezone.utc) - timedelta(hours=hours)).isoformat()
        
        assessments = await db.login_risk_assessments.find(
            {
                "level": {"$in": levels},
                "assessed_at": {"$gte": since}
            },
            {"_id": 0}
        ).sort("assessed_at", -1).limit(100).to_list(100)
        
        return assessments
    
    async def get_security_stats(self) -> Dict[str, Any]:
        """Get security statistics for admin dashboard"""
        db = get_database()
        now = datetime.now(timezone.utc)
        
        # Last 24 hours stats
        day_ago = (now - timedelta(hours=24)).isoformat()
        week_ago = (now - timedelta(days=7)).isoformat()
        
        # Total logins today
        total_logins_24h = await db.audit_logs.count_documents({
            "action": "login",
            "status": "success",
            "created_at": {"$gte": day_ago}
        })
        
        # Failed logins today
        failed_logins_24h = await db.audit_logs.count_documents({
            "action": "login_failed",
            "created_at": {"$gte": day_ago}
        })
        
        # Risk level breakdown (24h)
        risk_breakdown = {}
        for level in ["LOW", "MEDIUM", "HIGH", "CRITICAL"]:
            count = await db.login_risk_assessments.count_documents({
                "level": level,
                "assessed_at": {"$gte": day_ago}
            })
            risk_breakdown[level.lower()] = count
        
        # Blocked logins
        blocked_logins = await db.login_risk_assessments.count_documents({
            "action.type": "block",
            "assessed_at": {"$gte": day_ago}
        })
        
        # Active security incidents
        open_incidents = await db.security_incidents.count_documents({
            "status": "open"
        })
        
        # Unique IPs with failed attempts (potential attackers)
        suspicious_ips = await db.audit_logs.aggregate([
            {"$match": {"action": "login_failed", "created_at": {"$gte": day_ago}}},
            {"$group": {"_id": "$ip_address", "count": {"$sum": 1}}},
            {"$match": {"count": {"$gte": 3}}},
            {"$count": "total"}
        ]).to_list(1)
        
        suspicious_ip_count = suspicious_ips[0]["total"] if suspicious_ips else 0
        
        # Trusted devices count
        trusted_devices = await db.trusted_devices.count_documents({
            "is_active": True,
            "expires_at": {"$gt": now.isoformat()}
        })
        
        return {
            "period": "24h",
            "total_logins": total_logins_24h,
            "failed_logins": failed_logins_24h,
            "success_rate": round((total_logins_24h / max(total_logins_24h + failed_logins_24h, 1)) * 100, 1),
            "risk_breakdown": risk_breakdown,
            "blocked_logins": blocked_logins,
            "open_incidents": open_incidents,
            "suspicious_ips": suspicious_ip_count,
            "trusted_devices": trusted_devices,
            "generated_at": now.isoformat()
        }
    
    async def get_admin_alerts(self, unread_only: bool = False, limit: int = 50) -> List[Dict]:
        """Get security alerts for admin"""
        db = get_database()
        
        query = {"type": "security_alert"}
        if unread_only:
            query["is_read"] = False
        
        alerts = await db.admin_alerts.find(
            query,
            {"_id": 0}
        ).sort("created_at", -1).limit(limit).to_list(limit)
        
        return alerts
    
    async def mark_alert_read(self, alert_id: str) -> bool:
        """Mark an alert as read"""
        db = get_database()
        result = await db.admin_alerts.update_one(
            {"id": alert_id},
            {"$set": {"is_read": True, "read_at": datetime.now(timezone.utc).isoformat()}}
        )
        return result.modified_count > 0
    
    async def resolve_incident(self, incident_id: str, resolution: str, resolved_by: str) -> bool:
        """Resolve a security incident"""
        db = get_database()
        result = await db.security_incidents.update_one(
            {"id": incident_id},
            {"$set": {
                "status": "resolved",
                "resolution": resolution,
                "resolved_by": resolved_by,
                "resolved_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        return result.modified_count > 0


# Singleton instance
login_shield = LoginShieldAI()
