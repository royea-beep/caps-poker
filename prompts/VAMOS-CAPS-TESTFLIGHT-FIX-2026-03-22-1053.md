# VAMOS CAPS TESTFLIGHT-FIX
**Date:** 2026-03-22 10:53 IST
**Priority:** 🔴 TestFlight build shows on one phone but not the other

## ROLE
iOS DevOps — investigate and fix TestFlight distribution, use CLI/API wherever possible

## FIRST ACTIONS
```
Read C:\Projects\Caps\MEMORY.md
cd C:\Projects\Caps
```

## STEP 1 — Check current TestFlight configuration
```
# List registered devices
eas device:list

# Check build distribution
eas build:list --platform ios --limit 5

# Check the build profile
cat eas.json | python -m json.tool
```

## STEP 2 — Check App Store Connect via API

The ASC API Key should be at: `C:\Projects\wingman\keys\`
```
ls C:\Projects\wingman\keys\Auth*
ls C:\Projects\config\*apple* 2>/dev/null
```

### Set up App Store Connect API access:
```bash
# Find the API key file
ASC_KEY_ID="WTWALQMG5N"
ASC_ISSUER_ID=$(cat C:\Projects\wingman\keys\apple_api_issuer_id.txt 2>/dev/null || echo "UNKNOWN")
ASC_KEY_FILE=$(ls C:\Projects\wingman\keys\AuthKey_*.p8 2>/dev/null | head -1)

echo "Key ID: $ASC_KEY_ID"
echo "Issuer ID: $ASC_ISSUER_ID"  
echo "Key file: $ASC_KEY_FILE"
```

### Generate JWT for ASC API:
```python
# Create a script: scripts/asc_api.py
import jwt
import time
import requests
import json
import sys
import os

# App Store Connect API credentials
KEY_ID = "WTWALQMG5N"
ISSUER_ID = os.environ.get("ASC_ISSUER_ID", "")
KEY_FILE = os.environ.get("ASC_KEY_FILE", "")

def get_token():
    with open(KEY_FILE, 'r') as f:
        private_key = f.read()
    
    now = int(time.time())
    payload = {
        "iss": ISSUER_ID,
        "iat": now,
        "exp": now + 1200,  # 20 min
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

if __name__ == "__main__":
    action = sys.argv[1] if len(sys.argv) > 1 else "info"
    
    if action == "info":
        # Get app info
        apps = api_get("apps?filter[bundleId]=com.capspoker.app")
        print(json.dumps(apps, indent=2))
    
    elif action == "builds":
        # List TestFlight builds
        apps = api_get("apps?filter[bundleId]=com.capspoker.app")
        app_id = apps["data"][0]["id"]
        builds = api_get(f"builds?filter[app]={app_id}&sort=-uploadedDate&limit=5")
        for b in builds["data"]:
            attrs = b["attributes"]
            print(f"Build {attrs.get('version','?')} ({attrs.get('processingState','?')}) — uploaded {attrs.get('uploadedDate','?')}")
    
    elif action == "testers":
        # List beta testers
        testers = api_get("betaTesters?limit=50")
        for t in testers["data"]:
            attrs = t["attributes"]
            print(f"{attrs.get('firstName','')} {attrs.get('lastName','')} — {attrs.get('email','')}")
    
    elif action == "groups":
        # List beta groups
        apps = api_get("apps?filter[bundleId]=com.capspoker.app")
        app_id = apps["data"][0]["id"]
        groups = api_get(f"apps/{app_id}/betaGroups")
        for g in groups["data"]:
            attrs = g["attributes"]
            print(f"Group: {attrs.get('name','')} — public: {attrs.get('publicLinkEnabled',False)} — link: {attrs.get('publicLink','none')}")
    
    elif action == "add-tester":
        # Add a tester by email
        email = sys.argv[2]
        first = sys.argv[3] if len(sys.argv) > 3 else "Tester"
        last = sys.argv[4] if len(sys.argv) > 4 else ""
        
        # First get the app and beta group
        apps = api_get("apps?filter[bundleId]=com.capspoker.app")
        app_id = apps["data"][0]["id"]
        groups = api_get(f"apps/{app_id}/betaGroups")
        group_id = groups["data"][0]["id"]  # first group
        
        # Create tester
        data = {
            "data": {
                "type": "betaTesters",
                "attributes": {
                    "email": email,
                    "firstName": first,
                    "lastName": last
                },
                "relationships": {
                    "betaGroups": {
                        "data": [{"type": "betaGroups", "id": group_id}]
                    }
                }
            }
        }
        status, result = api_post("betaTesters", data)
        print(f"Status: {status}")
        print(json.dumps(result, indent=2))
    
    elif action == "public-link":
        # Enable public TestFlight link (anyone with link can join)
        apps = api_get("apps?filter[bundleId]=com.capspoker.app")
        app_id = apps["data"][0]["id"]
        groups = api_get(f"apps/{app_id}/betaGroups")
        
        for g in groups["data"]:
            attrs = g["attributes"]
            if attrs.get("publicLinkEnabled"):
                print(f"Public link already enabled: {attrs.get('publicLink')}")
            else:
                print(f"Group '{attrs.get('name','')}' — public link NOT enabled")
                print("Enabling...")
                # PATCH to enable
                token = get_token()
                headers = {
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json"
                }
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
                r = requests.patch(
                    f"https://api.appstoreconnect.apple.com/v1/betaGroups/{g['id']}",
                    headers=headers,
                    json=patch_data
                )
                result = r.json()
                new_link = result.get("data", {}).get("attributes", {}).get("publicLink", "")
                print(f"Status: {r.status_code}")
                print(f"Public link: {new_link}")
```

### Install dependencies for the script:
```
pip install PyJWT requests cryptography --break-system-packages
```

### Run diagnostics:
```bash
export ASC_ISSUER_ID="$(cat C:\Projects\wingman\keys\apple_api_issuer_id.txt)"
export ASC_KEY_FILE="$(ls C:\Projects\wingman\keys\AuthKey_*.p8 | head -1)"

# 1. Check app exists
python scripts/asc_api.py info

# 2. List TestFlight builds
python scripts/asc_api.py builds

# 3. List current testers
python scripts/asc_api.py testers

# 4. List beta groups
python scripts/asc_api.py groups
```

## STEP 3 — Diagnose why second phone doesn't see the build

Possible causes:
1. **Second phone has different Apple ID** → that email not in testers list
2. **Second phone not in beta group** → add it
3. **Internal testing vs External testing** → internal = only App Store Connect users
4. **Build not approved for external testing** → needs to be submitted to external group

### Check and fix:
```bash
# If second phone's Apple ID email is NOT in the testers list:
# Add it (replace with actual email):
python scripts/asc_api.py add-tester SECOND_PHONE_EMAIL@example.com Roye Arguan
```

### OR — Create a public TestFlight link (BEST solution — anyone with the link can join):
```bash
python scripts/asc_api.py public-link
```

This gives you a URL like: `https://testflight.apple.com/join/XXXXXX`
**Anyone** with this link can install the beta. No manual tester management needed.
Send this link to both phones, to friends, to testers — they just tap and install.

## STEP 4 — Register second device for Ad Hoc builds (if using internal distribution)
```
# Register a device by UDID:
eas device:create

# Or list current devices:
eas device:list
```

## STEP 5 — Verify

After fixing:
1. Open TestFlight on the second phone
2. Pull to refresh
3. CAPS Poker should appear
4. Install and test

## REPORT
```
═══════════════════════════════════════
TESTFLIGHT FIX — REPORT
═══════════════════════════════════════
ASC API working: [YES/NO]
App found: [YES — app ID / NO]

Current testers: [list emails]
Beta groups: [list groups + public link status]

Root cause: [missing tester / wrong group / internal only / other]
Fix applied: [added tester / enabled public link / both]

Public TestFlight link: [URL or NOT ENABLED]
Second phone access: [VERIFIED / PENDING USER TEST]

scripts/asc_api.py saved: [YES/NO]
═══════════════════════════════════════
```

## DO NOT
- Do NOT change any game code
- Do NOT trigger a new build
- Do NOT revoke any existing certificates
- If ASC API key is not found — report exactly what's missing

VAMOS CAPS TESTFLIGHT-FIX — END
