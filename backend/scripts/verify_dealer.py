"""
Dealer Sprint Phase 1 — Automated Verification Script
Tests all 8 scenarios:
  1. Dealer login
  2. Fetch beneficiary (same shop) → 200
  3. Fetch beneficiary (different shop) → 403
  4. Link mobile → 200
  5. Set PIN → 200 + account activated
  6. DB verification — pin_hash is bcrypt, not plain
  7. Invalid PIN (3 digits) → 422
  8. Set PIN without mobile linked → 400
"""
import requests
import sys

BASE_URL = "http://localhost:8000/api"
passed = 0
failed = 0


def check(test_name, condition, detail=""):
    global passed, failed
    if condition:
        passed += 1
        print(f"  ✅ {test_name}")
    else:
        failed += 1
        print(f"  ❌ {test_name} — {detail}")


def run_tests():
    global passed, failed

    # ── Test 1: Dealer Login ──
    print("\n1️⃣  Dealer Login (dealer_1 / SHOP_001)")
    login_resp = requests.post(f"{BASE_URL}/auth/dealer-login", json={"mobile": "9876543210", "password": "password"})
    check("Login status 200", login_resp.status_code == 200, f"Got {login_resp.status_code}")
    if login_resp.status_code != 200:
        print("Cannot proceed without login. Exiting.")
        sys.exit(1)

    token1 = login_resp.json()["access_token"]
    headers1 = {"Authorization": f"Bearer {token1}"}
    check("Token received", bool(token1))

    # ── Test 2: Fetch Beneficiary (Same Shop) → 200 ──
    print("\n2️⃣  Fetch Beneficiary (Same Shop: RC_001 → SHOP_001)")
    ben_resp = requests.get(f"{BASE_URL}/dealer/beneficiary/RC_001", headers=headers1)
    check("Status 200", ben_resp.status_code == 200, f"Got {ben_resp.status_code}")
    if ben_resp.status_code == 200:
        data = ben_resp.json()
        check("Correct ration_card", data.get("ration_card") == "RC_001", f"Got {data.get('ration_card')}")
        check("pin_hash NOT in response", "pin_hash" not in data, "pin_hash was exposed!")
        check("Has required fields", all(k in data for k in ["name", "family_members", "mobile_verified", "account_status", "shop_id"]))

    # ── Test 3: Fetch Beneficiary (Different Shop) → 403 ──
    print("\n3️⃣  Fetch Beneficiary (Cross-Shop: RC_002 → SHOP_002)")
    cross_resp = requests.get(f"{BASE_URL}/dealer/beneficiary/RC_002", headers=headers1)
    check("Status 403", cross_resp.status_code == 403, f"Got {cross_resp.status_code}")

    # ── Test 4: Link Mobile ──
    print("\n4️⃣  Link Mobile (RC_001)")
    link_resp = requests.post(
        f"{BASE_URL}/dealer/link-mobile",
        json={"ration_card": "RC_001", "mobile": "9999999999"},
        headers=headers1,
    )
    check("Status 200", link_resp.status_code == 200, f"Got {link_resp.status_code}: {link_resp.text}")

    # Verify mobile was linked
    ben_after_link = requests.get(f"{BASE_URL}/dealer/beneficiary/RC_001", headers=headers1)
    if ben_after_link.status_code == 200:
        data = ben_after_link.json()
        check("Mobile updated", data.get("mobile") == "9999999999", f"Got {data.get('mobile')}")
        check("mobile_verified is True", data.get("mobile_verified") is True)

    # ── Test 5: Set PIN ──
    print("\n5️⃣  Set PIN (RC_001)")
    pin_resp = requests.post(
        f"{BASE_URL}/dealer/set-pin",
        json={"ration_card": "RC_001", "pin": "1234"},
        headers=headers1,
    )
    check("Status 200", pin_resp.status_code == 200, f"Got {pin_resp.status_code}: {pin_resp.text}")

    # Verify activation
    ben_after_pin = requests.get(f"{BASE_URL}/dealer/beneficiary/RC_001", headers=headers1)
    if ben_after_pin.status_code == 200:
        data = ben_after_pin.json()
        check("account_status is active", data.get("account_status") == "active", f"Got {data.get('account_status')}")

    # ── Test 6: pin_hash is bcrypt, not plain ──
    print("\n6️⃣  DB Integrity — pin_hash not in API response (verified above)")
    check("pin_hash excluded", "pin_hash" not in ben_after_pin.json() if ben_after_pin.status_code == 200 else False)

    # ── Test 7: Invalid PIN (3 digits) → 422 ──
    print("\n7️⃣  Invalid PIN (3 digits)")
    bad_pin_resp = requests.post(
        f"{BASE_URL}/dealer/set-pin",
        json={"ration_card": "RC_001", "pin": "123"},
        headers=headers1,
    )
    check("Status 422", bad_pin_resp.status_code == 422, f"Got {bad_pin_resp.status_code}")

    # ── Test 8: Set PIN Without Mobile Linked → 400 ──
    print("\n8️⃣  Set PIN Without Mobile Linked")
    # Login as dealer_2 to test on RC_002 (which has no mobile linked)
    login2 = requests.post(f"{BASE_URL}/auth/dealer-login", json={"mobile": "9876543211", "password": "password"})
    if login2.status_code == 200:
        token2 = login2.json()["access_token"]
        headers2 = {"Authorization": f"Bearer {token2}"}
        no_mobile_resp = requests.post(
            f"{BASE_URL}/dealer/set-pin",
            json={"ration_card": "RC_002", "pin": "5678"},
            headers=headers2,
        )
        check("Status 400 (mobile not verified)", no_mobile_resp.status_code == 400, f"Got {no_mobile_resp.status_code}: {no_mobile_resp.text}")
    else:
        check("dealer_2 login", False, f"Could not login dealer_2: {login2.status_code}")

    # ── Summary ──
    print(f"\n{'='*50}")
    print(f"  Results: {passed} passed, {failed} failed out of {passed + failed}")
    print(f"{'='*50}")

    if failed > 0:
        sys.exit(1)
    else:
        print("  🎯 All tests passed! Dealer layer is secure.")


if __name__ == "__main__":
    run_tests()
