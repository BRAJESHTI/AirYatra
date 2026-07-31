#!/usr/bin/env python3
"""
Specific tests for Aviation-Grade Pricing Engine as per review request
"""
import requests
import json
from datetime import datetime

class PricingEngineSpecificTester:
    def __init__(self, base_url="https://heli-notifications.preview.emergentagent.com"):
        self.base_url = base_url
        self.admin_token = None
        self.operator_token = None
        
    def login_admin(self):
        """Login as admin"""
        login_data = {
            "email": "admin@airyatra.com",
            "password": "Admin123!"
        }
        
        response = requests.post(f"{self.base_url}/api/auth/login", json=login_data)
        if response.status_code == 200:
            data = response.json()
            self.admin_token = data.get('access_token')
            print("✅ Admin login successful")
            return True
        else:
            print(f"❌ Admin login failed: {response.status_code}")
            return False
    
    def login_operator(self):
        """Login as operator"""
        login_data = {
            "email": "operator@airyatra.com",
            "password": "Operator@123456"
        }
        
        response = requests.post(f"{self.base_url}/api/auth/login", json=login_data)
        if response.status_code == 200:
            data = response.json()
            self.operator_token = data.get('access_token')
            print("✅ Operator login successful")
            return True
        else:
            print(f"❌ Operator login failed: {response.status_code}")
            return False
    
    def test_public_config(self):
        """Test 1.1: Get Public Config"""
        print("\n🔍 Test 1.1: Get Public Config")
        response = requests.get(f"{self.base_url}/api/pricing-engine/config/public")
        
        if response.status_code == 200:
            data = response.json()
            print("✅ Public config retrieved successfully")
            print(f"   GST Percent: {data.get('gst_percent')}%")
            print(f"   Purpose Options: {len(data.get('purpose_options', []))} options")
            print(f"   Pricing Types: {data.get('pricing_types')}")
            return True
        else:
            print(f"❌ Failed: {response.status_code}")
            return False
    
    def test_wedding_calculation(self):
        """Test 1.2: Calculate Price - Wedding (1.3x multiplier)"""
        print("\n🔍 Test 1.2: Wedding Price Calculation (1.3x multiplier)")
        
        calculation_data = {
            "pickup_city": "Mumbai, Maharashtra",
            "pickup_latitude": 19.076,
            "pickup_longitude": 72.877,
            "drop_city": "Pune, Maharashtra",
            "drop_latitude": 18.520,
            "drop_longitude": 73.856,
            "distance_km": 150,
            "departure_date": "2025-01-20",
            "departure_time": "10:00",
            "booking_purpose": "wedding",
            "passenger_count": 4,
            "waiting_time_minutes": 60,
            "night_halts": 1
        }
        
        response = requests.post(f"{self.base_url}/api/pricing-engine/calculate", json=calculation_data)
        
        if response.status_code == 200:
            data = response.json()
            breakdown = data.get('price_breakdown', {})
            
            print("✅ Wedding price calculation successful")
            print(f"   Purpose Multiplier: {breakdown.get('purpose_multiplier')}x")
            print(f"   Purpose Adjustment: ₹{breakdown.get('purpose_adjustment'):,}")
            print(f"   Waiting Charges: ₹{breakdown.get('waiting_charges'):,}")
            print(f"   Night Halt Cost: ₹{breakdown.get('night_halt_cost'):,}")
            print(f"   GST Type: {breakdown.get('gst_type')}")
            print(f"   Final Customer Price: ₹{breakdown.get('final_customer_price'):,}")
            
            # Verify expected values
            if breakdown.get('purpose_multiplier') == 1.3:
                print("✅ Correct wedding multiplier (1.3x)")
            else:
                print(f"❌ Wrong multiplier: {breakdown.get('purpose_multiplier')}")
                
            if breakdown.get('gst_type') == 'intra_state':
                print("✅ Correct GST type (intra_state)")
            else:
                print(f"❌ Wrong GST type: {breakdown.get('gst_type')}")
                
            return True
        else:
            print(f"❌ Failed: {response.status_code}")
            return False
    
    def test_medical_calculation(self):
        """Test 1.3: Calculate Price - Medical Emergency (0.9x multiplier)"""
        print("\n🔍 Test 1.3: Medical Emergency Price (0.9x discount)")
        
        calculation_data = {
            "pickup_city": "Delhi, Delhi",
            "pickup_latitude": 28.6139,
            "pickup_longitude": 77.2090,
            "drop_city": "Jaipur, Rajasthan",
            "drop_latitude": 26.9124,
            "drop_longitude": 75.7873,
            "distance_km": 280,
            "departure_date": "2025-01-20",
            "departure_time": "08:00",
            "booking_purpose": "medical",
            "passenger_count": 2
        }
        
        response = requests.post(f"{self.base_url}/api/pricing-engine/calculate", json=calculation_data)
        
        if response.status_code == 200:
            data = response.json()
            breakdown = data.get('price_breakdown', {})
            
            print("✅ Medical emergency price calculation successful")
            print(f"   Purpose Multiplier: {breakdown.get('purpose_multiplier')}x (10% discount)")
            print(f"   GST Type: {breakdown.get('gst_type')} (Delhi → Rajasthan)")
            print(f"   IGST: ₹{breakdown.get('igst'):,}")
            print(f"   Final Customer Price: ₹{breakdown.get('final_customer_price'):,}")
            
            # Verify expected values
            if breakdown.get('purpose_multiplier') == 0.9:
                print("✅ Correct medical discount (0.9x)")
            else:
                print(f"❌ Wrong multiplier: {breakdown.get('purpose_multiplier')}")
                
            if breakdown.get('gst_type') == 'inter_state':
                print("✅ Correct GST type (inter_state)")
            else:
                print(f"❌ Wrong GST type: {breakdown.get('gst_type')}")
                
            return True
        else:
            print(f"❌ Failed: {response.status_code}")
            return False
    
    def test_election_calculation(self):
        """Test 1.4: Calculate Price - Election (1.5x multiplier)"""
        print("\n🔍 Test 1.4: Election Campaign Price (1.5x multiplier)")
        
        calculation_data = {
            "pickup_city": "Lucknow, Uttar Pradesh",
            "pickup_latitude": 26.8467,
            "pickup_longitude": 80.9462,
            "drop_city": "Varanasi, Uttar Pradesh",
            "drop_latitude": 25.3176,
            "drop_longitude": 82.9739,
            "distance_km": 320,
            "departure_date": "2025-01-25",
            "departure_time": "09:00",
            "booking_purpose": "election",
            "passenger_count": 3
        }
        
        response = requests.post(f"{self.base_url}/api/pricing-engine/calculate", json=calculation_data)
        
        if response.status_code == 200:
            data = response.json()
            breakdown = data.get('price_breakdown', {})
            
            print("✅ Election campaign price calculation successful")
            print(f"   Purpose Multiplier: {breakdown.get('purpose_multiplier')}x")
            print(f"   GST Type: {breakdown.get('gst_type')} (same state)")
            print(f"   Final Customer Price: ₹{breakdown.get('final_customer_price'):,}")
            
            # Verify expected values
            if breakdown.get('purpose_multiplier') == 1.5:
                print("✅ Correct election multiplier (1.5x)")
            else:
                print(f"❌ Wrong multiplier: {breakdown.get('purpose_multiplier')}")
                
            if breakdown.get('gst_type') == 'intra_state':
                print("✅ Correct GST type (intra_state)")
            else:
                print(f"❌ Wrong GST type: {breakdown.get('gst_type')}")
                
            return True
        else:
            print(f"❌ Failed: {response.status_code}")
            return False
    
    def test_admin_controls(self):
        """Test 2.1 & 2.2: Admin Controls"""
        if not self.admin_token:
            print("❌ No admin token available")
            return False
            
        print("\n🔍 Test 2.1: Get Admin Controls")
        headers = {'Authorization': f'Bearer {self.admin_token}'}
        
        # Get current controls
        response = requests.get(f"{self.base_url}/api/pricing-engine/admin/controls", headers=headers)
        
        if response.status_code == 200:
            data = response.json()
            print("✅ Admin controls retrieved successfully")
            print(f"   Commission: {data.get('commission_value')}%")
            print(f"   Convenience Fee: {data.get('convenience_fee_percent')}%")
            print(f"   Insurance: {data.get('insurance_percent')}%")
            print(f"   GST: {data.get('gst_percent')}%")
        else:
            print(f"❌ Failed to get admin controls: {response.status_code}")
            return False
        
        print("\n🔍 Test 2.2: Update Commission")
        update_data = {
            "commission_type": "percentage",
            "commission_value": 12,
            "convenience_fee_percent": 5,
            "insurance_percent": 2,
            "gst_percent": 18
        }
        
        response = requests.post(f"{self.base_url}/api/pricing-engine/admin/controls", 
                               json=update_data, headers=headers)
        
        if response.status_code == 200:
            print("✅ Admin controls updated successfully")
            return True
        else:
            print(f"❌ Failed to update admin controls: {response.status_code}")
            return False
    
    def test_operator_pricing(self):
        """Test 3.1, 3.2, 3.3: Operator Pricing Configuration"""
        if not self.operator_token:
            print("❌ No operator token available")
            return False
            
        headers = {'Authorization': f'Bearer {self.operator_token}'}
        
        print("\n🔍 Test 3.1: Get Operator Pricing")
        response = requests.get(f"{self.base_url}/api/pricing-engine/operator/my-pricing", headers=headers)
        
        if response.status_code == 200:
            data = response.json()
            print("✅ Operator pricing retrieved successfully")
            print(f"   Operator ID: {data.get('operator_id')}")
            print(f"   Base Pricing Entries: {len(data.get('base_pricing', []))}")
            print(f"   Default Multipliers: {data.get('default_multipliers')}")
        else:
            print(f"❌ Failed to get operator pricing: {response.status_code}")
            return False
        
        print("\n🔍 Test 3.2: Set Base Pricing")
        base_pricing_data = {
            "price_per_hour": 185000,
            "min_billable_hours": 2,
            "pricing_type": "hourly",
            "half_day_price": 550000,
            "full_day_price": 950000,
            "purpose_multipliers": {
                "wedding": 1.35,
                "medical": 0.85,
                "election": 1.6
            }
        }
        
        response = requests.post(f"{self.base_url}/api/pricing-engine/operator/base-pricing", 
                               json=base_pricing_data, headers=headers)
        
        if response.status_code == 200:
            print("✅ Base pricing set successfully")
        else:
            print(f"❌ Failed to set base pricing: {response.status_code}")
            print(f"   Response: {response.text}")
        
        print("\n🔍 Test 3.3: Set Dead-Leg Config")
        dead_leg_data = {
            "enabled": True,
            "rate_type": "per_km",
            "rate_value": 550,
            "free_positioning_km": 20,
            "base_city": "Mumbai"
        }
        
        response = requests.post(f"{self.base_url}/api/pricing-engine/operator/dead-leg-config", 
                               json=dead_leg_data, headers=headers)
        
        if response.status_code == 200:
            print("✅ Dead-leg config set successfully")
            return True
        else:
            print(f"❌ Failed to set dead-leg config: {response.status_code}")
            print(f"   Response: {response.text}")
            return False
    
    def test_cancellation_charges(self):
        """Test 4.1: Cancellation Charges"""
        print("\n🔍 Test 4.1: Cancellation Charges (48 hours before)")
        
        response = requests.get(f"{self.base_url}/api/pricing-engine/cancellation-charges?booking_date=2025-01-22&booking_amount=500000")
        
        if response.status_code == 200:
            data = response.json()
            print("✅ Cancellation charges calculated successfully")
            print(f"   Applicable Slab: {data.get('applicable_slab')}")
            print(f"   Charge Percent: {data.get('charge_percent')}%")
            print(f"   Cancellation Charge: ₹{data.get('cancellation_charge'):,}")
            print(f"   Refund Amount: ₹{data.get('refund_amount'):,}")
            return True
        else:
            print(f"❌ Failed: {response.status_code}")
            return False
    
    def run_all_tests(self):
        """Run all specific tests from review request"""
        print("🚁 Aviation-Grade Pricing Engine - Specific Tests")
        print("=" * 60)
        
        results = []
        
        # Public API Tests
        print("\n📋 1. PUBLIC PRICING API TESTS")
        results.append(self.test_public_config())
        results.append(self.test_wedding_calculation())
        results.append(self.test_medical_calculation())
        results.append(self.test_election_calculation())
        
        # Admin Tests
        print("\n📋 2. ADMIN PRICING CONTROLS TEST")
        if self.login_admin():
            results.append(self.test_admin_controls())
        else:
            results.append(False)
        
        # Operator Tests
        print("\n📋 3. OPERATOR PRICING CONFIGURATION TEST")
        if self.login_operator():
            results.append(self.test_operator_pricing())
        else:
            results.append(False)
        
        # Cancellation Tests
        print("\n📋 4. CANCELLATION CHARGES TEST")
        results.append(self.test_cancellation_charges())
        
        # Summary
        passed = sum(results)
        total = len(results)
        
        print("\n" + "=" * 60)
        print("📊 SPECIFIC TEST SUMMARY")
        print("=" * 60)
        print(f"Total Tests: {total}")
        print(f"Passed: {passed}")
        print(f"Failed: {total - passed}")
        print(f"Success Rate: {(passed/total*100):.1f}%")
        
        return passed == total

if __name__ == "__main__":
    tester = PricingEngineSpecificTester()
    success = tester.run_all_tests()
    exit(0 if success else 1)