import requests
import sys
import json
from datetime import datetime, timedelta

class AirYatraAPITester:
    def __init__(self, base_url="https://heli-booking-1.preview.emergentagent.com"):
        self.base_url = base_url
        self.token = None
        self.user_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

    def log_test(self, name, success, details=""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
        
        result = {
            "test_name": name,
            "success": success,
            "details": details,
            "timestamp": datetime.utcnow().isoformat()
        }
        self.test_results.append(result)
        
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} - {name}: {details}")

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.base_url}{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        
        if self.token:
            test_headers['Authorization'] = f'Bearer {self.token}'
        
        if headers:
            test_headers.update(headers)

        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=test_headers, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=test_headers, timeout=10)

            success = response.status_code == expected_status
            
            if success:
                try:
                    response_data = response.json()
                    details = f"Status: {response.status_code}"
                except:
                    response_data = {}
                    details = f"Status: {response.status_code} (No JSON response)"
            else:
                try:
                    error_data = response.json()
                    details = f"Expected {expected_status}, got {response.status_code}. Error: {error_data.get('detail', 'Unknown error')}"
                except:
                    details = f"Expected {expected_status}, got {response.status_code}. Response: {response.text[:200]}"
                response_data = {}

            self.log_test(name, success, details)
            return success, response_data

        except requests.exceptions.RequestException as e:
            self.log_test(name, False, f"Request failed: {str(e)}")
            return False, {}

    def test_health_check(self):
        """Test health check endpoint"""
        return self.run_test("Health Check", "GET", "/health", 200)

    def test_register_user(self):
        """Test user registration"""
        timestamp = datetime.now().strftime("%H%M%S")
        user_data = {
            "email": f"test_user_{timestamp}@airyatra.com",
            "password": "TestPass123!",
            "full_name": f"Test User {timestamp}",
            "phone": "+91 9876543210",
            "roles": ["customer"]
        }
        
        success, response = self.run_test(
            "User Registration",
            "POST",
            "/api/auth/register",
            200,
            data=user_data
        )
        
        if success and 'access_token' in response:
            self.token = response['access_token']
            self.user_id = response['user']['id']
            return True
        return False

    def test_login_user(self):
        """Test user login with existing credentials"""
        login_data = {
            "email": "test@airyatra.com",
            "password": "password123"
        }
        
        success, response = self.run_test(
            "User Login",
            "POST",
            "/api/auth/login",
            200,
            data=login_data
        )
        
        if success and 'access_token' in response:
            self.token = response['access_token']
            self.user_id = response['user']['id']
            return True
        return False

    def test_get_user_profile(self):
        """Test getting current user profile"""
        if not self.token:
            self.log_test("Get User Profile", False, "No authentication token available")
            return False
            
        return self.run_test("Get User Profile", "GET", "/api/auth/me", 200)[0]

    def test_create_booking(self):
        """Test creating a booking request"""
        if not self.token:
            self.log_test("Create Booking", False, "No authentication token available")
            return False, None
        
        print(f"🔍 Using token for booking: {self.token[:50]}...")
            
        booking_data = {
            "from_location": "Mumbai",
            "to_location": "Pune", 
            "departure_date": (datetime.utcnow() + timedelta(days=7)).isoformat(),
            "passengers": 2,
            "trip_type": "one_way",
            "special_requirements": "Test booking from automated test"
        }
        
        success, response = self.run_test(
            "Create Booking",
            "POST",
            "/api/bookings/",
            200,
            data=booking_data
        )
        
        booking_id = None
        if success and 'booking' in response:
            booking_id = response['booking']['id']
            
        return success, booking_id

    def test_get_bookings(self):
        """Test getting user bookings"""
        if not self.token:
            self.log_test("Get Bookings", False, "No authentication token available")
            return False
            
        return self.run_test("Get Bookings", "GET", "/api/bookings", 200)[0]

    def test_get_booking_by_id(self, booking_id):
        """Test getting specific booking by ID"""
        if not self.token:
            self.log_test("Get Booking by ID", False, "No authentication token available")
            return False
            
        if not booking_id:
            self.log_test("Get Booking by ID", False, "No booking ID provided")
            return False
            
        return self.run_test("Get Booking by ID", "GET", f"/api/bookings/{booking_id}", 200)[0]

    def test_unauthorized_access(self):
        """Test accessing protected endpoints without token"""
        # Temporarily remove token
        original_token = self.token
        self.token = None
        
        success, _ = self.run_test("Unauthorized Access Test", "GET", "/api/auth/me", 401)
        
        # Restore token
        self.token = original_token
        return success

    def run_all_tests(self):
        """Run all API tests"""
        print("🚀 Starting AirYatra API Tests...")
        print(f"📍 Testing against: {self.base_url}")
        print("=" * 60)

        # Test 1: Health check
        self.test_health_check()

        # Test 2: User registration (creates new user and gets token)
        if not self.test_register_user():
            # If registration fails, try login with existing user
            print("⚠️  Registration failed, trying login with existing user...")
            if not self.test_login_user():
                print("❌ Both registration and login failed. Stopping tests.")
                return self.generate_report()

        # Test 3: Get user profile
        self.test_get_user_profile()

        # Test 4: Create booking
        booking_success, booking_id = self.test_create_booking()

        # Test 5: Get bookings
        self.test_get_bookings()

        # Test 6: Get specific booking (if we created one)
        if booking_id:
            self.test_get_booking_by_id(booking_id)

        # Test 7: Unauthorized access
        self.test_unauthorized_access()

        return self.generate_report()

    def generate_report(self):
        """Generate test report"""
        print("\n" + "=" * 60)
        print("📊 TEST SUMMARY")
        print("=" * 60)
        print(f"Total Tests: {self.tests_run}")
        print(f"Passed: {self.tests_passed}")
        print(f"Failed: {self.tests_run - self.tests_passed}")
        print(f"Success Rate: {(self.tests_passed/self.tests_run*100):.1f}%" if self.tests_run > 0 else "0%")
        
        # Show failed tests
        failed_tests = [test for test in self.test_results if not test['success']]
        if failed_tests:
            print("\n❌ FAILED TESTS:")
            for test in failed_tests:
                print(f"  - {test['test_name']}: {test['details']}")
        
        return {
            "total_tests": self.tests_run,
            "passed_tests": self.tests_passed,
            "failed_tests": self.tests_run - self.tests_passed,
            "success_rate": (self.tests_passed/self.tests_run*100) if self.tests_run > 0 else 0,
            "test_results": self.test_results,
            "has_critical_failures": self.tests_passed < (self.tests_run * 0.5)  # More than 50% failed
        }

def main():
    tester = AirYatraAPITester()
    report = tester.run_all_tests()
    
    # Return appropriate exit code
    if report["has_critical_failures"]:
        print("\n🚨 CRITICAL: More than 50% of tests failed!")
        return 1
    elif report["failed_tests"] > 0:
        print(f"\n⚠️  {report['failed_tests']} test(s) failed but system is mostly functional")
        return 0
    else:
        print("\n🎉 All tests passed!")
        return 0

if __name__ == "__main__":
    sys.exit(main())