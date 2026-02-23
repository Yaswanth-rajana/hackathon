import requests
import sys
import json

BASE_URL = "http://localhost:8000/api/auth"

def run_tests():
    print("1. Testing Dealer Login...")
    try:
        login_resp = requests.post(f"{BASE_URL}/dealer-login", json={"mobile": "9876543210", "password": "password"})
        if login_resp.status_code == 200:
            token_data = login_resp.json()
            print("✅ Login Success")
            print(f"   Token: {token_data['access_token'][:20]}...")
            print(f"   Role: {token_data['role']}")
            access_token = token_data['access_token']
        else:
            print(f"❌ Login Failed: {login_resp.status_code} {login_resp.text}")
            sys.exit(1)
            
        print("\n2. Testing /me Endpoint...")
        headers = {"Authorization": f"Bearer {access_token}"}
        me_resp = requests.get(f"{BASE_URL}/me", headers=headers)
        if me_resp.status_code == 200:
            print(f"✅ /me Success: {me_resp.json()['name']}")
        else:
            print(f"❌ /me Failed: {me_resp.status_code} {me_resp.text}")

        print("\n3. Testing Role Rejection (Admin Route)...")
        # Assuming we eventually create this, or test against the one I added in auth_router
        admin_resp = requests.get(f"{BASE_URL}/admin-only", headers=headers)
        if admin_resp.status_code == 403:
            print("✅ Role Rejection Success (Got 403 Forbidden)")
        else:
            print(f"❌ Role Rejection Failed: Got {admin_resp.status_code}")
            
    except Exception as e:
        print(f"❌ Connection Failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    run_tests()
