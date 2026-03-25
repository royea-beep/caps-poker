# VAMOS CAPS TESTFLIGHT-AUTOFIX
**Date:** 2026-03-22 11:04 IST
**Priority:** 🔴 Fix TestFlight access on second phone — ZERO manual steps

## IRON RULE
NO MANUAL STEPS. NOT ONE. Find a CLI/API solution for EVERYTHING.
If one approach doesn't work — try another. Exhaust ALL options before reporting "manual needed".

## APPROACHES (try in order until one works)

═══════════════════════════════════════════════════════════
APPROACH 1 — Fastlane Pilot (uses App-Specific Password)
═══════════════════════════════════════════════════════════

Fastlane's `pilot` command manages TestFlight WITHOUT API keys.
It uses Apple ID + App-Specific Password (already in GitHub secrets).

### Install fastlane:
```
gem install fastlane 2>/dev/null || sudo gem install fastlane
# Or on Windows:
pip install --break-system-packages fastlane 2>/dev/null
# Or via npm:
npm install -g fastlane 2>/dev/null
```

If Ruby gem works:
```
cd C:\Projects\Caps

# Set credentials (App-Specific Password from GitHub secrets)
export FASTLANE_APPLE_APPLICATION_SPECIFIC_PASSWORD="$(gh secret list --repo royea-beep/caps-poker 2>/dev/null | grep -q APPLE_APP_SPECIFIC && echo 'exists')"

# Actually get the password from where it's stored:
# Check .env, eas secrets, or GitHub secrets
grep -i "apple.*specific\|app.*password" C:\Projects\Caps\.env 2>/dev/null
eas secret:list 2>&1
```

### Use pilot to manage TestFlight:
```bash
export FASTLANE_USER="royearguan@gmail.com"

# List current testers:
fastlane pilot list

# List groups:
fastlane pilot group

# Enable public link for the app:
# App ID: 6760429619
# Bundle ID: com.capspoker.app

# Add a tester by email:
fastlane pilot add "SECOND_PHONE_EMAIL" -g "External Testers"
```

═══════════════════════════════════════════════════════════
APPROACH 2 — EAS Submit with external testers config
═══════════════════════════════════════════════════════════

Check if EAS can manage beta groups:
```
eas --help 2>&1 | grep -i "test\|beta\|group"
eas submit --help 2>&1 | grep -i "test\|group\|external"
```

Check if eas.json can configure external testing:
```
cat C:\Projects\Caps\eas.json
```

Maybe add to submit profile:
```json
{
  "submit": {
    "production": {
      "ios": {
        "appleId": "royearguan@gmail.com",
        "ascAppId": "6760429619",
        "appleTeamId": "3K9KJNGL9U"
      }
    }
  }
}
```

═══════════════════════════════════════════════════════════
APPROACH 3 — Generate NEW ASC API Key via Fastlane
═══════════════════════════════════════════════════════════

If fastlane can create a new API key:
```
fastlane produce --help 2>&1 | grep -i "key\|api"
```

Or use `spaceship` (fastlane's Apple API library):
```ruby
# scripts/fix_testflight.rb
require 'spaceship'

Spaceship::ConnectAPI.login("royearguan@gmail.com")
app = Spaceship::ConnectAPI::App.find("com.capspoker.app")

# Get or create beta group
groups = app.get_beta_groups
external = groups.find { |g| g.name == "External Testers" }

if external.nil?
  external = Spaceship::ConnectAPI::BetaGroup.create(
    app_id: app.id,
    group_name: "External Testers",
    public_link_enabled: true
  )
end

# Enable public link
external.update(attributes: { publicLinkEnabled: true, publicLinkLimitEnabled: false })
puts "Public link: #{external.public_link}"

# Add tester
Spaceship::ConnectAPI::BetaInvitation.create(
  app_id: app.id,
  email: "SECOND_PHONE_EMAIL"
)
```

Run:
```
ruby scripts/fix_testflight.rb
```

═══════════════════════════════════════════════════════════
APPROACH 4 — Apple's `altool` / `iTMSTransporter` (legacy but works)
═══════════════════════════════════════════════════════════

If on macOS:
```
xcrun altool --list-providers -u "royearguan@gmail.com" -p "@env:APPLE_APP_SPECIFIC_PASSWORD"
```

Check TestFlight management:
```
xcrun altool --help 2>&1 | grep -i "test\|beta"
```

═══════════════════════════════════════════════════════════
APPROACH 5 — Create new ASC API key via Developer Portal API
═══════════════════════════════════════════════════════════

The Apple Developer Portal has its OWN API (separate from ASC API):
```python
# Try authenticating with Apple ID session (like fastlane's spaceship):
# This doesn't need API keys — uses Apple ID + App-Specific Password

import requests

session = requests.Session()
# Apple's auth endpoint:
# POST https://idmsa.apple.com/appleauth/auth/signin
# Then use the session to access developer portal

# Or use the itc-api-docs approach:
# https://developer.apple.com/documentation/appstoreconnectapi/creating_api_keys_for_app_store_connect_api
```

═══════════════════════════════════════════════════════════
APPROACH 6 — Simplest: invite via EAS + Expo dashboard API
═══════════════════════════════════════════════════════════

Check if Expo has TestFlight management:
```
eas channel:list 2>&1
eas update:list 2>&1
```

═══════════════════════════════════════════════════════════
WHAT TO REPORT
═══════════════════════════════════════════════════════════

Try EVERY approach above. For EACH:
```
Approach N: [WORKED / FAILED — reason]
```

If ANY approach produces a public TestFlight link:
```
PUBLIC LINK: https://testflight.apple.com/join/XXXXXX
```

If a tester was added:
```
TESTER ADDED: email@example.com
```

Also investigate: WHY did the ASC API keys get revoked?
```
# Check Apple Developer Portal for key status:
# Is there a way to check via CLI?
fastlane spaceship 2>&1 | head -20
```

## ALSO FIX — Prevent future key problems
Whatever solution works → make it PERMANENT:
- If fastlane works → add it to CI pipeline
- If new API key created → store in EAS secrets + GitHub secrets
- If public link enabled → save URL in MEMORY.md
- Create a script that can always be rerun: `scripts/manage_testflight.sh`

## REPORT
```
═══════════════════════════════════════
TESTFLIGHT AUTOFIX — REPORT
═══════════════════════════════════════
Approach 1 (fastlane pilot): [WORKED/FAILED — reason]
Approach 2 (eas submit config): [WORKED/FAILED — reason]
Approach 3 (fastlane spaceship): [WORKED/FAILED — reason]
Approach 4 (altool): [WORKED/FAILED — reason]
Approach 5 (developer portal API): [WORKED/FAILED — reason]
Approach 6 (expo): [WORKED/FAILED — reason]

RESULT:
  Public link: [URL / not created]
  Second phone tester added: [YES email / NO]
  New API key created: [YES — key ID / NO]
  
Permanent solution installed: [YES — describe / NO]
Scripts saved: [list files]
═══════════════════════════════════════
```

## DO NOT
- Do NOT tell user to do anything manually
- Do NOT give up after one approach fails — try ALL 6
- Do NOT change game code
- Do NOT trigger a new build

VAMOS CAPS TESTFLIGHT-AUTOFIX — END
