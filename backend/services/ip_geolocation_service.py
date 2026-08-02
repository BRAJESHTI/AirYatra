"""
AirYatra IP Geolocation Service
Location-based risk scoring using IP geolocation
Uses free ip-api.com API (no key required, 45 requests/min limit)
"""

import logging
import httpx
from typing import Optional, Dict, Any
from datetime import datetime, timezone, timedelta
from database import get_database

logger = logging.getLogger(__name__)

# Cache duration for IP lookups (reduce API calls)
CACHE_DURATION_HOURS = 24

# High-risk countries (customize based on business needs)
HIGH_RISK_COUNTRIES = [
    "RU",  # Russia
    "CN",  # China
    "KP",  # North Korea
    "IR",  # Iran
    "NG",  # Nigeria (high fraud)
    "PK",  # Pakistan
    "BD",  # Bangladesh
]

# Countries where AirYatra operates (lower risk)
TRUSTED_COUNTRIES = [
    "IN",  # India (home country)
    "AE",  # UAE
    "SG",  # Singapore
    "US",  # USA
    "GB",  # UK
    "CA",  # Canada
    "AU",  # Australia
]

# VPN/Proxy/Datacenter indicators
DATACENTER_KEYWORDS = [
    "amazon", "aws", "google", "microsoft", "azure", "digitalocean",
    "linode", "vultr", "ovh", "hetzner", "cloudflare", "hostinger"
]


class IPGeolocationService:
    """IP Geolocation and risk assessment service"""
    
    def __init__(self):
        self.api_url = "http://ip-api.com/json/{ip}?fields=status,message,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as,proxy,hosting,query"
        self.cache = {}  # In-memory cache (consider Redis for production)
    
    async def get_location(self, ip_address: str) -> Dict[str, Any]:
        """
        Get geolocation data for an IP address
        Returns cached data if available and fresh
        """
        # Skip for local/private IPs
        if self._is_private_ip(ip_address):
            return {
                "ip": ip_address,
                "is_private": True,
                "country": "Local",
                "country_code": "LO",
                "city": "Local Network",
                "isp": "Private Network",
                "risk_factors": [],
                "location_risk_score": 0
            }
        
        # Check cache first
        cached = await self._get_cached(ip_address)
        if cached:
            return cached
        
        # Fetch from API
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(self.api_url.format(ip=ip_address))
                
                if response.status_code == 200:
                    data = response.json()
                    
                    if data.get("status") == "success":
                        location_data = self._process_location_data(ip_address, data)
                        
                        # Cache the result
                        await self._cache_result(ip_address, location_data)
                        
                        return location_data
                    else:
                        logger.warning(f"IP lookup failed for {ip_address}: {data.get('message')}")
                        return self._get_fallback_data(ip_address)
                else:
                    logger.warning(f"IP API returned status {response.status_code}")
                    return self._get_fallback_data(ip_address)
                    
        except Exception as e:
            logger.error(f"IP geolocation error for {ip_address}: {str(e)}")
            return self._get_fallback_data(ip_address)
    
    def _process_location_data(self, ip_address: str, api_data: Dict) -> Dict[str, Any]:
        """Process API response and calculate location-based risk"""
        risk_factors = []
        risk_score = 0
        
        country_code = api_data.get("countryCode", "")
        isp = api_data.get("isp", "").lower()
        org = api_data.get("org", "").lower()
        is_proxy = api_data.get("proxy", False)
        is_hosting = api_data.get("hosting", False)
        
        # Check for high-risk country
        if country_code in HIGH_RISK_COUNTRIES:
            risk_score += 25
            risk_factors.append({
                "factor": "high_risk_country",
                "score": 25,
                "detail": f"Login from high-risk country: {api_data.get('country', country_code)}"
            })
        
        # Check if outside trusted countries
        if country_code and country_code not in TRUSTED_COUNTRIES:
            risk_score += 10
            risk_factors.append({
                "factor": "foreign_country",
                "score": 10,
                "detail": f"Login from outside trusted regions: {api_data.get('country', country_code)}"
            })
        
        # Check for proxy/VPN
        if is_proxy:
            risk_score += 20
            risk_factors.append({
                "factor": "proxy_detected",
                "score": 20,
                "detail": "Proxy/VPN detected by IP analysis"
            })
        
        # Check for hosting/datacenter
        if is_hosting:
            risk_score += 15
            risk_factors.append({
                "factor": "datacenter_ip",
                "score": 15,
                "detail": "IP belongs to hosting/datacenter (possible bot)"
            })
        
        # Check ISP/Org for datacenter keywords
        for keyword in DATACENTER_KEYWORDS:
            if keyword in isp or keyword in org:
                if not is_hosting:  # Avoid double counting
                    risk_score += 10
                    risk_factors.append({
                        "factor": "datacenter_isp",
                        "score": 10,
                        "detail": f"ISP/Org indicates datacenter: {api_data.get('isp', '')}"
                    })
                break
        
        return {
            "ip": ip_address,
            "is_private": False,
            "country": api_data.get("country", "Unknown"),
            "country_code": country_code,
            "region": api_data.get("regionName", ""),
            "city": api_data.get("city", "Unknown"),
            "zip": api_data.get("zip", ""),
            "lat": api_data.get("lat"),
            "lon": api_data.get("lon"),
            "timezone": api_data.get("timezone", ""),
            "isp": api_data.get("isp", "Unknown"),
            "org": api_data.get("org", ""),
            "is_proxy": is_proxy,
            "is_hosting": is_hosting,
            "risk_factors": risk_factors,
            "location_risk_score": min(risk_score, 50),  # Cap at 50
            "fetched_at": datetime.now(timezone.utc).isoformat()
        }
    
    def _get_fallback_data(self, ip_address: str) -> Dict[str, Any]:
        """Return fallback data when API fails"""
        return {
            "ip": ip_address,
            "is_private": False,
            "country": "Unknown",
            "country_code": "",
            "city": "Unknown",
            "isp": "Unknown",
            "risk_factors": [{
                "factor": "location_unknown",
                "score": 5,
                "detail": "Could not determine IP location"
            }],
            "location_risk_score": 5
        }
    
    def _is_private_ip(self, ip: str) -> bool:
        """Check if IP is private/local"""
        private_prefixes = [
            "10.", "172.16.", "172.17.", "172.18.", "172.19.",
            "172.20.", "172.21.", "172.22.", "172.23.", "172.24.",
            "172.25.", "172.26.", "172.27.", "172.28.", "172.29.",
            "172.30.", "172.31.", "192.168.", "127.", "localhost"
        ]
        return any(ip.startswith(prefix) for prefix in private_prefixes)
    
    async def _get_cached(self, ip_address: str) -> Optional[Dict]:
        """Get cached IP data if fresh"""
        db = get_database()
        
        cache_cutoff = (datetime.now(timezone.utc) - timedelta(hours=CACHE_DURATION_HOURS)).isoformat()
        
        cached = await db.ip_geolocation_cache.find_one({
            "ip": ip_address,
            "fetched_at": {"$gte": cache_cutoff}
        }, {"_id": 0})
        
        return cached
    
    async def _cache_result(self, ip_address: str, data: Dict):
        """Cache IP lookup result"""
        db = get_database()
        
        await db.ip_geolocation_cache.update_one(
            {"ip": ip_address},
            {"$set": data},
            upsert=True
        )
    
    async def get_user_login_locations(self, user_id: str, limit: int = 10) -> list:
        """Get recent login locations for a user"""
        db = get_database()
        
        # Get unique IPs from recent login attempts
        logins = await db.login_risk_assessments.find(
            {"user_id": user_id},
            {"ip_address": 1, "assessed_at": 1, "_id": 0}
        ).sort("assessed_at", -1).limit(50).to_list(50)
        
        # Get unique IPs
        seen_ips = set()
        unique_logins = []
        for login in logins:
            ip = login.get("ip_address")
            if ip and ip not in seen_ips:
                seen_ips.add(ip)
                location = await self.get_location(ip)
                unique_logins.append({
                    "ip": ip,
                    "location": f"{location.get('city', 'Unknown')}, {location.get('country', 'Unknown')}",
                    "country_code": location.get("country_code", ""),
                    "last_login": login.get("assessed_at"),
                    "is_risky": location.get("location_risk_score", 0) > 20
                })
                if len(unique_logins) >= limit:
                    break
        
        return unique_logins
    
    async def is_new_location(self, user_id: str, ip_address: str) -> tuple:
        """
        Check if this is a new login location for the user
        Returns: (is_new, location_info)
        """
        db = get_database()
        
        # Get current location
        current_location = await self.get_location(ip_address)
        current_country = current_location.get("country_code", "")
        current_city = current_location.get("city", "")
        
        # Check if user has logged in from this country/city before
        previous_login = await db.login_risk_assessments.find_one({
            "user_id": user_id,
            "login_successful": True,
            "location.country_code": current_country,
            "location.city": current_city
        })
        
        is_new = previous_login is None
        
        return is_new, current_location


# Singleton instance
ip_geolocation = IPGeolocationService()
