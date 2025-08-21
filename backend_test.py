import requests
import sys
import json
from datetime import datetime
from typing import Dict, Any, Optional

class TowFleetAPITester:
    def __init__(self, base_url="https://reboquefacil.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.tokens = {}  # Store tokens for different users
        self.users = {}   # Store user data
        self.test_requests = {}  # Store created tow requests
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []

    def log_test(self, name: str, success: bool, details: str = ""):
        """Log test results"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name} - PASSED {details}")
        else:
            self.failed_tests.append(f"{name}: {details}")
            print(f"❌ {name} - FAILED {details}")

    def make_request(self, method: str, endpoint: str, data: Optional[Dict] = None, 
                    token: Optional[str] = None, expected_status: int = 200) -> tuple[bool, Dict]:
        """Make HTTP request and return success status and response data"""
        url = f"{self.base_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        if token:
            headers['Authorization'] = f'Bearer {token}'

        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=10)
            else:
                return False, {"error": f"Unsupported method: {method}"}

            success = response.status_code == expected_status
            try:
                response_data = response.json()
            except:
                response_data = {"status_code": response.status_code, "text": response.text}

            return success, response_data

        except requests.exceptions.RequestException as e:
            return False, {"error": str(e)}

    def test_user_registration(self):
        """Test user registration for different roles"""
        print("\n🔍 Testing User Registration...")
        
        # Use timestamp to ensure unique emails
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        test_users = [
            {"email": f"client_{timestamp}@test.com", "password": "TestPass123!", "full_name": "Test Client", "role": "client", "phone": "1234567890"},
            {"email": f"driver_{timestamp}@test.com", "password": "TestPass123!", "full_name": "Test Driver", "role": "driver", "phone": "1234567891"},
            {"email": f"dealer_{timestamp}@test.com", "password": "TestPass123!", "full_name": "Test Dealer", "role": "dealer", "phone": "1234567892"},
            {"email": f"admin_{timestamp}@test.com", "password": "TestPass123!", "full_name": "Test Admin", "role": "admin", "phone": "1234567893"},
        ]

        for user_data in test_users:
            success, response = self.make_request('POST', 'auth/register', user_data, expected_status=200)
            if success:
                self.users[user_data['role']] = {**user_data, 'id': response.get('id')}
                self.log_test(f"Register {user_data['role']}", True, f"ID: {response.get('id')}")
            else:
                self.log_test(f"Register {user_data['role']}", False, f"Error: {response}")

    def test_user_login(self):
        """Test user login for all registered users"""
        print("\n🔍 Testing User Login...")
        
        for role, user_data in self.users.items():
            login_data = {"email": user_data['email'], "password": user_data['password']}
            success, response = self.make_request('POST', 'auth/login', login_data, expected_status=200)
            
            if success and 'access_token' in response:
                self.tokens[role] = response['access_token']
                self.log_test(f"Login {role}", True, f"Token received")
            else:
                self.log_test(f"Login {role}", False, f"Error: {response}")

    def test_auth_me_endpoint(self):
        """Test /auth/me endpoint with valid tokens"""
        print("\n🔍 Testing Auth Me Endpoint...")
        
        for role, token in self.tokens.items():
            success, response = self.make_request('GET', 'auth/me', token=token, expected_status=200)
            
            if success and response.get('email') == self.users[role]['email']:
                self.log_test(f"Auth Me {role}", True, f"User data retrieved")
            else:
                self.log_test(f"Auth Me {role}", False, f"Error: {response}")

    def test_create_tow_request(self):
        """Test tow request creation by client and dealer"""
        print("\n🔍 Testing Tow Request Creation...")
        
        request_data = {
            "pickup_address": "123 Main St, Test City",
            "pickup_lat": 40.7128,
            "pickup_lng": -74.0060,
            "dropoff_address": "456 Oak Ave, Test City",
            "dropoff_lat": 40.7589,
            "dropoff_lng": -73.9851,
            "vehicle_info": "2020 Honda Civic",
            "proposed_price": 150.0,
            "notes": "Car won't start"
        }

        # Test client creating request
        if 'client' in self.tokens:
            success, response = self.make_request('POST', 'tow-requests', request_data, 
                                                token=self.tokens['client'], expected_status=200)
            if success and 'id' in response:
                self.test_requests['client_request'] = response['id']
                self.log_test("Create Tow Request (Client)", True, f"Request ID: {response['id']}")
            else:
                self.log_test("Create Tow Request (Client)", False, f"Error: {response}")

        # Test dealer creating request
        if 'dealer' in self.tokens:
            success, response = self.make_request('POST', 'tow-requests', request_data, 
                                                token=self.tokens['dealer'], expected_status=200)
            if success and 'id' in response:
                self.test_requests['dealer_request'] = response['id']
                self.log_test("Create Tow Request (Dealer)", True, f"Request ID: {response['id']}")
            else:
                self.log_test("Create Tow Request (Dealer)", False, f"Error: {response}")

        # Test driver trying to create request (should fail)
        if 'driver' in self.tokens:
            success, response = self.make_request('POST', 'tow-requests', request_data, 
                                                token=self.tokens['driver'], expected_status=403)
            if success:
                self.log_test("Create Tow Request (Driver - Should Fail)", True, "Correctly rejected")
            else:
                self.log_test("Create Tow Request (Driver - Should Fail)", False, f"Unexpected: {response}")

    def test_get_tow_requests(self):
        """Test getting tow requests for different user roles"""
        print("\n🔍 Testing Get Tow Requests...")
        
        for role, token in self.tokens.items():
            success, response = self.make_request('GET', 'tow-requests', token=token, expected_status=200)
            
            if success and isinstance(response, list):
                self.log_test(f"Get Tow Requests ({role})", True, f"Retrieved {len(response)} requests")
            else:
                self.log_test(f"Get Tow Requests ({role})", False, f"Error: {response}")

    def test_get_single_tow_request(self):
        """Test getting a single tow request by ID"""
        print("\n🔍 Testing Get Single Tow Request...")
        
        if 'client_request' in self.test_requests and 'client' in self.tokens:
            request_id = self.test_requests['client_request']
            success, response = self.make_request('GET', f'tow-requests/{request_id}', 
                                                token=self.tokens['client'], expected_status=200)
            
            if success and response.get('id') == request_id:
                self.log_test("Get Single Tow Request", True, f"Request details retrieved")
            else:
                self.log_test("Get Single Tow Request", False, f"Error: {response}")

    def test_accept_tow_request(self):
        """Test driver accepting a tow request"""
        print("\n🔍 Testing Accept Tow Request...")
        
        if 'client_request' in self.test_requests and 'driver' in self.tokens:
            request_id = self.test_requests['client_request']
            success, response = self.make_request('POST', f'tow-requests/{request_id}/accept', 
                                                token=self.tokens['driver'], expected_status=200)
            
            if success and response.get('status') == 'accepted':
                self.log_test("Accept Tow Request (Driver)", True, "Request accepted successfully")
            else:
                self.log_test("Accept Tow Request (Driver)", False, f"Error: {response}")

    def test_update_tow_request_status(self):
        """Test updating tow request status"""
        print("\n🔍 Testing Update Tow Request Status...")
        
        if 'client_request' in self.test_requests and 'driver' in self.tokens:
            request_id = self.test_requests['client_request']
            update_data = {"status": "on_mission"}
            
            success, response = self.make_request('PUT', f'tow-requests/{request_id}', update_data,
                                                token=self.tokens['driver'], expected_status=200)
            
            if success and response.get('status') == 'on_mission':
                self.log_test("Update Request Status", True, "Status updated to on_mission")
            else:
                self.log_test("Update Request Status", False, f"Error: {response}")

    def test_driver_profile_endpoints(self):
        """Test driver profile related endpoints"""
        print("\n🔍 Testing Driver Profile Endpoints...")
        
        if 'driver' in self.tokens:
            # Get driver profile
            success, response = self.make_request('GET', 'drivers/profile', 
                                                token=self.tokens['driver'], expected_status=200)
            
            if success and 'user_id' in response:
                self.log_test("Get Driver Profile", True, "Profile retrieved")
            else:
                self.log_test("Get Driver Profile", False, f"Error: {response}")

            # Update driver location
            success, response = self.make_request('PUT', 'drivers/location?lat=40.7128&lng=-74.0060', 
                                                token=self.tokens['driver'], expected_status=200)
            
            if success:
                self.log_test("Update Driver Location", True, "Location updated")
            else:
                self.log_test("Update Driver Location", False, f"Error: {response}")

            # Update driver status
            status_data = {"status": "available"}
            success, response = self.make_request('PUT', 'drivers/status', status_data,
                                                token=self.tokens['driver'], expected_status=200)
            
            if success:
                self.log_test("Update Driver Status", True, "Status updated")
            else:
                self.log_test("Update Driver Status", False, f"Error: {response}")

    def test_admin_endpoints(self):
        """Test admin-specific endpoints"""
        print("\n🔍 Testing Admin Endpoints...")
        
        if 'admin' in self.tokens:
            # Get pending approvals
            success, response = self.make_request('GET', 'admin/pending-approvals', 
                                                token=self.tokens['admin'], expected_status=200)
            
            if success and isinstance(response, list):
                self.log_test("Get Pending Approvals", True, f"Found {len(response)} pending approvals")
                
                # If there are pending users, approve one
                if response and 'driver' in self.users:
                    user_id = self.users['driver']['id']
                    success, approve_response = self.make_request('POST', f'admin/approve-user/{user_id}', 
                                                                token=self.tokens['admin'], expected_status=200)
                    
                    if success:
                        self.log_test("Approve User", True, "User approved successfully")
                    else:
                        self.log_test("Approve User", False, f"Error: {approve_response}")
            else:
                self.log_test("Get Pending Approvals", False, f"Error: {response}")

    def test_unauthorized_access(self):
        """Test unauthorized access scenarios"""
        print("\n🔍 Testing Unauthorized Access...")
        
        # Test accessing protected endpoint without token
        success, response = self.make_request('GET', 'auth/me', expected_status=401)
        if not success:  # We expect this to fail
            self.log_test("Unauthorized Access (No Token)", True, "Correctly rejected")
        else:
            self.log_test("Unauthorized Access (No Token)", False, "Should have been rejected")

        # Test with invalid token
        success, response = self.make_request('GET', 'auth/me', token="invalid_token", expected_status=401)
        if not success:  # We expect this to fail
            self.log_test("Unauthorized Access (Invalid Token)", True, "Correctly rejected")
        else:
            self.log_test("Unauthorized Access (Invalid Token)", False, "Should have been rejected")

    def run_all_tests(self):
        """Run all test suites"""
        print("🚀 Starting TowFleets API Testing...")
        print(f"Testing against: {self.base_url}")
        
        try:
            self.test_user_registration()
            self.test_user_login()
            self.test_auth_me_endpoint()
            self.test_create_tow_request()
            self.test_get_tow_requests()
            self.test_get_single_tow_request()
            self.test_accept_tow_request()
            self.test_update_tow_request_status()
            self.test_driver_profile_endpoints()
            self.test_admin_endpoints()
            self.test_unauthorized_access()
            
        except Exception as e:
            print(f"❌ Critical error during testing: {str(e)}")
            return 1

        # Print final results
        print(f"\n📊 Test Results:")
        print(f"Tests Run: {self.tests_run}")
        print(f"Tests Passed: {self.tests_passed}")
        print(f"Tests Failed: {self.tests_run - self.tests_passed}")
        print(f"Success Rate: {(self.tests_passed/self.tests_run)*100:.1f}%")
        
        if self.failed_tests:
            print(f"\n❌ Failed Tests:")
            for failed_test in self.failed_tests:
                print(f"  - {failed_test}")
        
        return 0 if self.tests_passed == self.tests_run else 1

def main():
    tester = TowFleetAPITester()
    return tester.run_all_tests()

if __name__ == "__main__":
    sys.exit(main())