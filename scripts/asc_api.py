import jwt
import time
import requests
import json
import sys
import os

# App Store Connect API credentials
KEY_ID = "WTWALQMG5N"
ISSUER_ID = os.environ.get("ASC_ISSUER_ID", "686f97b8-3f8a-40b7-a6cd-5293a3168439")
KEY_FILE = os.environ.get("ASC_KEY_FILE", os.path.join(os.path.dirname(__file__), '..', 'AuthKey_WTWALQMG5N.p8'))

def get_token():
    with open(KEY_FILE, 'r') as f:
        private_key = f.read()
    now = int(time.time())
    payload = {
        "iss": ISSUER_ID,
        "iat": now,
        "exp": now + 1200,
        "aud": "appstoreconnect-v1"
    }
    token = jwt.encode(payload, private_key, algorithm="ES256", headers={"kid": KEY_ID})
    return token

def api_get(path):
    token = get_token()
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    r = requests.get(f"https://api.appstoreconnect.apple.com/v1/{path}", headers=headers)
    return r.json()

def api_post(path, data):
    token = get_token()
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    r = requests.post(f"https://api.appstoreconnect.apple.com/v1/{path}", headers=headers, json=data)
    return r.status_code, r.json()

def api_patch(path, data):
    token = get_token()
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    r = requests.patch(f"https://api.appstoreconnect.apple.com/v1/{path}", headers=headers, json=data)
    return r.status_code, r.json()

if __name__ == "__main__":
    action = sys.argv[1] if len(sys.argv) > 1 else "info"

    if action == "info":
        apps = api_get("apps?filter[bundleId]=com.capspoker.app")
        print(json.dumps(apps, indent=2))

    elif action == "builds":
        apps = api_get("apps?filter[bundleId]=com.capspoker.app")
        app_id = apps["data"][0]["id"]
        builds = api_get(f"builds?filter[app]={app_id}&sort=-uploadedDate&limit=5")
        for b in builds["data"]:
            attrs = b["attributes"]
            print(f"Build {attrs.get('version','?')} ({attrs.get('processingState','?')}) — uploaded {attrs.get('uploadedDate','?')}")

    elif action == "testers":
        testers = api_get("betaTesters?limit=50")
        for t in testers["data"]:
            attrs = t["attributes"]
            print(f"{attrs.get('firstName','')} {attrs.get('lastName','')} — {attrs.get('email','')}")

    elif action == "groups":
        apps = api_get("apps?filter[bundleId]=com.capspoker.app")
        app_id = apps["data"][0]["id"]
        groups = api_get(f"apps/{app_id}/betaGroups")
        for g in groups["data"]:
            attrs = g["attributes"]
            print(f"Group: '{attrs.get('name','')}' — public: {attrs.get('publicLinkEnabled',False)} — link: {attrs.get('publicLink','none')}")

    elif action == "add-tester":
        email = sys.argv[2]
        first = sys.argv[3] if len(sys.argv) > 3 else "Tester"
        last = sys.argv[4] if len(sys.argv) > 4 else ""
        apps = api_get("apps?filter[bundleId]=com.capspoker.app")
        app_id = apps["data"][0]["id"]
        groups = api_get(f"apps/{app_id}/betaGroups")
        group_id = groups["data"][0]["id"]
        data = {
            "data": {
                "type": "betaTesters",
                "attributes": {"email": email, "firstName": first, "lastName": last},
                "relationships": {
                    "betaGroups": {"data": [{"type": "betaGroups", "id": group_id}]}
                }
            }
        }
        status, result = api_post("betaTesters", data)
        print(f"Status: {status}")
        print(json.dumps(result, indent=2))

    elif action == "public-link":
        apps = api_get("apps?filter[bundleId]=com.capspoker.app")
        app_id = apps["data"][0]["id"]
        groups = api_get(f"apps/{app_id}/betaGroups")
        for g in groups["data"]:
            attrs = g["attributes"]
            if attrs.get("publicLinkEnabled"):
                print(f"Public link already enabled: {attrs.get('publicLink')}")
            else:
                print(f"Group '{attrs.get('name','')}' — enabling public link...")
                patch_data = {
                    "data": {
                        "type": "betaGroups",
                        "id": g["id"],
                        "attributes": {
                            "publicLinkEnabled": True,
                            "publicLinkLimitEnabled": False
                        }
                    }
                }
                status, result = api_patch(f"betaGroups/{g['id']}", patch_data)
                new_link = result.get("data", {}).get("attributes", {}).get("publicLink", "")
                print(f"Status: {status} — Public link: {new_link}")
