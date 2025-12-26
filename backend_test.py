import requests
import sys
import json
from datetime import datetime, timedelta

class AirYatraAPITester:
    def __init__(self, base_url="https://payflow-hub-10.preview.emergentagent.com"):
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
            
        return self.run_test("Get Bookings", "GET", "/api/bookings/", 200)[0]

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

    def test_register_operator(self):
        """Test operator registration"""
        timestamp = datetime.now().strftime("%H%M%S")
        operator_data = {
            "email": f"operator_{timestamp}@airyatra.com",
            "password": "TestPass123!",
            "full_name": f"Operator {timestamp}",
            "phone": "+91 9876543210",
            "roles": ["operator"]
        }
        
        success, response = self.run_test(
            "Operator Registration",
            "POST",
            "/api/auth/register",
            200,
            data=operator_data
        )
        
        if success and 'access_token' in response:
            self.token = response['access_token']
            self.user_id = response['user']['id']
            return True
        return False

    def test_create_operator_profile(self):
        """Test creating operator profile"""
        if not self.token:
            self.log_test("Create Operator Profile", False, "No authentication token available")
            return False
            
        profile_data = {
            "company_name": "Test Aviation Services",
            "base_city": "Mumbai",
            "contact_person": "Test Operator",
            "contact_phone": "+91 9876543210",
            "contact_email": "test@testaviation.com",
            "gstin": "22AAAAA0000A1Z5"
        }
        
        return self.run_test(
            "Create Operator Profile",
            "POST",
            "/api/operator/profile",
            200,
            data=profile_data
        )[0]

    def test_get_operator_profile(self):
        """Test getting operator profile"""
        if not self.token:
            self.log_test("Get Operator Profile", False, "No authentication token available")
            return False
            
        return self.run_test("Get Operator Profile", "GET", "/api/operator/profile", 200)[0]

    def test_get_operator_dashboard(self):
        """Test getting operator dashboard"""
        if not self.token:
            self.log_test("Get Operator Dashboard", False, "No authentication token available")
            return False
            
        return self.run_test("Get Operator Dashboard", "GET", "/api/operator/dashboard", 200)[0]

    def test_create_aircraft(self):
        """Test adding aircraft to fleet with new manufacturer details"""
        if not self.token:
            self.log_test("Create Aircraft", False, "No authentication token available")
            return False, None
            
        aircraft_data = {
            "aircraft_type": "Bell 407GXi",
            "manufacturer": "Bell Helicopter",
            "model_name": "407GXi",
            "manufacture_year": 2020,
            "registration_number": "VT-TEST",
            "capacity": 6,
            "base_location": "Mumbai",
            "hourly_rate": 50000.0,
            "enrollment_odometer_km": 12500
        }
        
        success, response = self.run_test(
            "Create Aircraft with Manufacturer Details",
            "POST",
            "/api/fleet/",
            200,
            data=aircraft_data
        )
        
        aircraft_id = None
        if success and 'aircraft' in response:
            aircraft_id = response['aircraft']['id']
            # Verify manufacturer details are saved
            aircraft = response['aircraft']
            if (aircraft.get('manufacturer') == 'Bell Helicopter' and 
                aircraft.get('model_name') == '407GXi' and
                aircraft.get('manufacture_year') == 2020 and
                aircraft.get('enrollment_odometer_km') == 12500):
                self.log_test("Aircraft Manufacturer Details Verification", True, "All manufacturer details saved correctly")
            else:
                self.log_test("Aircraft Manufacturer Details Verification", False, "Manufacturer details not saved correctly")
            
        return success, aircraft_id

    def test_get_fleet(self):
        """Test getting operator fleet"""
        if not self.token:
            self.log_test("Get Fleet", False, "No authentication token available")
            return False
            
        return self.run_test("Get Fleet", "GET", "/api/fleet/", 200)[0]

    def test_create_pilot(self):
        """Test adding pilot"""
        if not self.token:
            self.log_test("Create Pilot", False, "No authentication token available")
            return False, None
            
        pilot_data = {
            "full_name": "Captain Test Pilot",
            "license_number": "CPL-12345",
            "phone": "+91 9876543210",
            "email": "pilot@test.com",
            "experience_years": 10
        }
        
        success, response = self.run_test(
            "Create Pilot",
            "POST",
            "/api/operator/pilots",
            200,
            data=pilot_data
        )
        
        pilot_id = None
        if success and 'pilot' in response:
            pilot_id = response['pilot']['id']
            
        return success, pilot_id

    def test_get_pilots(self):
        """Test getting operator pilots"""
        if not self.token:
            self.log_test("Get Pilots", False, "No authentication token available")
            return False
            
        return self.run_test("Get Pilots", "GET", "/api/operator/pilots", 200)[0]

    def test_get_inquiries(self):
        """Test getting operator inquiries"""
        if not self.token:
            self.log_test("Get Inquiries", False, "No authentication token available")
            return False
            
        return self.run_test("Get Inquiries", "GET", "/api/quotes/operator/inquiries", 200)[0]

    def test_delete_aircraft(self, aircraft_id):
        """Test deleting aircraft"""
        if not self.token:
            self.log_test("Delete Aircraft", False, "No authentication token available")
            return False
            
        if not aircraft_id:
            self.log_test("Delete Aircraft", False, "No aircraft ID provided")
            return False
            
        return self.run_test("Delete Aircraft", "DELETE", f"/api/fleet/{aircraft_id}", 200)[0]

    def test_create_flight_record(self, aircraft_id, pilot_id):
        """Test creating flight record with automatic KM update"""
        if not self.token:
            self.log_test("Create Flight Record", False, "No authentication token available")
            return False, None
            
        if not aircraft_id or not pilot_id:
            self.log_test("Create Flight Record", False, "Missing aircraft_id or pilot_id")
            return False, None
            
        flight_data = {
            "aircraft_id": aircraft_id,
            "pilot_id": pilot_id,
            "departure_location": "Mumbai",
            "arrival_location": "Pune",
            "departure_time": datetime.utcnow().isoformat(),
            "arrival_time": (datetime.utcnow() + timedelta(hours=1)).isoformat(),
            "distance_km": 150.5,
            "flight_duration_minutes": 60,
            "fuel_used_liters": 120.0,
            "average_speed_kmh": 150,
            "max_altitude_feet": 8000,
            "weather_conditions": "Clear",
            "remarks": "Test flight record"
        }
        
        success, response = self.run_test(
            "Create Flight Record",
            "POST",
            "/api/flight-records/",
            200,
            data=flight_data
        )
        
        record_id = None
        if success and 'record' in response:
            record_id = response['record']['id']
            
        return success, record_id

    def test_get_aircraft_flight_records(self, aircraft_id):
        """Test getting flight records for aircraft"""
        if not self.token:
            self.log_test("Get Aircraft Flight Records", False, "No authentication token available")
            return False
            
        if not aircraft_id:
            self.log_test("Get Aircraft Flight Records", False, "No aircraft ID provided")
            return False
            
        return self.run_test("Get Aircraft Flight Records", "GET", f"/api/flight-records/aircraft/{aircraft_id}", 200)[0]

    def test_create_fuel_record(self, aircraft_id):
        """Test creating fuel record"""
        if not self.token:
            self.log_test("Create Fuel Record", False, "No authentication token available")
            return False, None
            
        if not aircraft_id:
            self.log_test("Create Fuel Record", False, "No aircraft ID provided")
            return False, None
            
        fuel_data = {
            "aircraft_id": aircraft_id,
            "location": "Mumbai Airport",
            "fuel_amount_liters": 500.0,
            "fuel_type": "Jet-A1",
            "cost_per_liter": 85.50,
            "odometer_reading_km": 12650,
            "remarks": "Regular refueling"
        }
        
        success, response = self.run_test(
            "Create Fuel Record",
            "POST",
            "/api/fuel-records/",
            200,
            data=fuel_data
        )
        
        fuel_id = None
        if success and 'record' in response:
            fuel_id = response['record']['id']
            # Verify cost calculation
            record = response['record']
            expected_cost = 500.0 * 85.50
            if record.get('total_cost') == expected_cost:
                self.log_test("Fuel Cost Calculation", True, f"Cost calculated correctly: ₹{expected_cost}")
            else:
                self.log_test("Fuel Cost Calculation", False, f"Expected ₹{expected_cost}, got ₹{record.get('total_cost')}")
            
        return success, fuel_id

    def test_get_aircraft_fuel_records(self, aircraft_id):
        """Test getting fuel records for aircraft"""
        if not self.token:
            self.log_test("Get Aircraft Fuel Records", False, "No authentication token available")
            return False
            
        if not aircraft_id:
            self.log_test("Get Aircraft Fuel Records", False, "No aircraft ID provided")
            return False
            
        success, response = self.run_test("Get Aircraft Fuel Records", "GET", f"/api/fuel-records/aircraft/{aircraft_id}", 200)
        
        if success and 'summary' in response:
            summary = response['summary']
            self.log_test("Fuel Records Summary", True, f"Total refills: {summary.get('total_refills')}, Total fuel: {summary.get('total_fuel_liters')}L, Total cost: ₹{summary.get('total_cost')}")
        
        return success

    def test_update_live_location(self, aircraft_id):
        """Test updating aircraft live location"""
        if not self.token:
            self.log_test("Update Live Location", False, "No authentication token available")
            return False, None
            
        if not aircraft_id:
            self.log_test("Update Live Location", False, "No aircraft ID provided")
            return False, None
            
        tracking_data = {
            "aircraft_id": aircraft_id,
            "latitude": 19.0760,
            "longitude": 72.8777,
            "altitude_feet": 5000,
            "speed_kmh": 180,
            "heading_degrees": 90,
            "flight_status": "in_flight"
        }
        
        success, response = self.run_test(
            "Update Live Location",
            "POST",
            "/api/live-tracking/update-location",
            200,
            data=tracking_data
        )
        
        tracking_id = None
        if success and 'tracking_id' in response:
            tracking_id = response['tracking_id']
            
        return success, tracking_id

    def test_get_aircraft_live_location(self, aircraft_id):
        """Test getting aircraft live location"""
        if not self.token:
            self.log_test("Get Aircraft Live Location", False, "No authentication token available")
            return False
            
        if not aircraft_id:
            self.log_test("Get Aircraft Live Location", False, "No aircraft ID provided")
            return False
            
        success, response = self.run_test("Get Aircraft Live Location", "GET", f"/api/live-tracking/aircraft/{aircraft_id}", 200)
        
        if success and 'tracking' in response:
            tracking = response['tracking']
            if tracking:
                self.log_test("Live Location Data", True, f"Location: {tracking.get('latitude')}, {tracking.get('longitude')}")
            else:
                self.log_test("Live Location Data", True, "No active tracking data")
        
        return success

    def test_aircraft_statistics(self, aircraft_id):
        """Test getting aircraft statistics"""
        if not self.token:
            self.log_test("Get Aircraft Statistics", False, "No authentication token available")
            return False
            
        if not aircraft_id:
            self.log_test("Get Aircraft Statistics", False, "No aircraft ID provided")
            return False
            
        success, response = self.run_test("Get Aircraft Statistics", "GET", f"/api/fleet/{aircraft_id}/statistics", 200)
        
        if success and 'statistics' in response:
            stats = response['statistics']
            self.log_test("Aircraft Statistics Data", True, 
                         f"Total flights: {stats.get('total_flights')}, "
                         f"Current KM: {stats.get('current_total_km')}, "
                         f"KM since enrollment: {stats.get('km_since_enrollment')}")
        
        return success

    def test_pilot_document_upload_url(self, pilot_id):
        """Test generating pilot document upload URL"""
        if not self.token:
            self.log_test("Pilot Document Upload URL", False, "No authentication token available")
            return False
            
        if not pilot_id:
            self.log_test("Pilot Document Upload URL", False, "No pilot ID provided")
            return False
            
        doc_data = {
            "pilot_id": pilot_id,
            "document_type": "license_copy",
            "file_name": "pilot_license.pdf",
            "file_size": 1024000,
            "content_type": "application/pdf",
            "expiry_date": (datetime.utcnow() + timedelta(days=365)).isoformat()
        }
        
        success, response = self.run_test(
            "Generate Pilot Document Upload URL",
            "POST",
            "/api/pilot-documents/upload-url",
            200,
            data=doc_data
        )
        
        if success and 'upload_url' in response:
            self.log_test("Upload URL Generation", True, "S3 presigned URL generated successfully")
        
        return success

    def test_aircraft_document_upload_url(self, aircraft_id):
        """Test generating aircraft document upload URL"""
        if not self.token:
            self.log_test("Aircraft Document Upload URL", False, "No authentication token available")
            return False
            
        if not aircraft_id:
            self.log_test("Aircraft Document Upload URL", False, "No aircraft ID provided")
            return False
            
        doc_data = {
            "aircraft_id": aircraft_id,
            "document_type": "fitness_certificate",
            "file_name": "fitness_cert.pdf",
            "file_size": 2048000,
            "content_type": "application/pdf",
            "expiry_date": (datetime.utcnow() + timedelta(days=365)).isoformat()
        }
        
        success, response = self.run_test(
            "Generate Aircraft Document Upload URL",
            "POST",
            "/api/aircraft-documents/upload-url",
            200,
            data=doc_data
        )
        
        if success and 'upload_url' in response:
            self.log_test("Aircraft Upload URL Generation", True, "S3 presigned URL generated successfully")
        
        return success

    def run_operator_tests(self):
        """Run operator-specific tests"""
        print("🚁 Starting AirYatra Aviation Management Tests...")
        print(f"📍 Testing against: {self.base_url}")
        print("=" * 60)

        # Test 1: Health check
        self.test_health_check()

        # Test 2: Operator registration
        if not self.test_register_operator():
            print("❌ Operator registration failed. Stopping operator tests.")
            return self.generate_report()

        # Test 3: Create operator profile
        if not self.test_create_operator_profile():
            print("❌ Operator profile creation failed. Stopping operator tests.")
            return self.generate_report()

        # Test 4: Get operator profile
        self.test_get_operator_profile()

        # Test 5: Get operator dashboard
        self.test_get_operator_dashboard()

        # Test 6: Create aircraft with manufacturer details
        aircraft_success, aircraft_id = self.test_create_aircraft()

        # Test 7: Get fleet
        self.test_get_fleet()

        # Test 8: Create pilot
        pilot_success, pilot_id = self.test_create_pilot()

        # Test 9: Get pilots
        self.test_get_pilots()

        # Aviation Management Features Testing
        if aircraft_id and pilot_id:
            print("\n🛩️  Testing Aviation Management Features...")
            
            # Test 10: Create flight record with automatic KM update
            flight_success, flight_id = self.test_create_flight_record(aircraft_id, pilot_id)
            
            # Test 11: Get aircraft flight records
            self.test_get_aircraft_flight_records(aircraft_id)
            
            # Test 12: Create fuel record
            fuel_success, fuel_id = self.test_create_fuel_record(aircraft_id)
            
            # Test 13: Get aircraft fuel records with summary
            self.test_get_aircraft_fuel_records(aircraft_id)
            
            # Test 14: Update live location
            tracking_success, tracking_id = self.test_update_live_location(aircraft_id)
            
            # Test 15: Get aircraft live location
            self.test_get_aircraft_live_location(aircraft_id)
            
            # Test 16: Get aircraft statistics
            self.test_aircraft_statistics(aircraft_id)
            
            # Test 17: Pilot document upload URL generation
            self.test_pilot_document_upload_url(pilot_id)
            
            # Test 18: Aircraft document upload URL generation
            self.test_aircraft_document_upload_url(aircraft_id)

        # Test 19: Get inquiries
        self.test_get_inquiries()

        # Cleanup tests
        # Test 20: Delete aircraft (if created)
        if aircraft_id:
            self.test_delete_aircraft(aircraft_id)

        # Test 21: Delete pilot (if created)
        if pilot_id:
            self.test_delete_pilot(pilot_id)

        # Test 22: Unauthorized access
        self.test_unauthorized_access()

        return self.generate_report()

    def test_delete_pilot(self, pilot_id):
        """Test deleting pilot"""
        if not self.token:
            self.log_test("Delete Pilot", False, "No authentication token available")
            return False
            
        if not pilot_id:
            self.log_test("Delete Pilot", False, "No pilot ID provided")
            return False
            
        return self.run_test("Delete Pilot", "DELETE", f"/api/operator/pilots/{pilot_id}", 200)[0]

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
    import sys
    
    # Check if we should run operator tests
    run_operator = len(sys.argv) > 1 and sys.argv[1] == "operator"
    
    tester = AirYatraAPITester()
    
    if run_operator:
        report = tester.run_operator_tests()
    else:
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