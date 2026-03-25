# VAMOS CAPS TESTFLIGHT-PUBLIC-LINK
**Date:** 2026-03-22 11:10 IST
**Priority:** 🔴 Enable public TestFlight link — ZERO manual steps

## KEY INSIGHT
The App-Specific Password EXISTS in GitHub Secrets (builds 169-171 submitted successfully).
We can't read it locally — but we CAN use it inside GitHub Actions.
So: create a GitHub Actions workflow that runs fastlane/spaceship to enable the public link.

## APPROACH — GitHub Actions workflow that manages TestFlight

### Step 1 — Create the workflow
Create `.github/workflows/testflight-manage.yml`:

```yaml
name: Manage TestFlight

on:
  workflow_dispatch:
    inputs:
      action:
        description: 'Action to perform'
        required: true
        type: choice
        options:
          - enable-public-link
          - add-tester
          - list-testers
          - list-builds
      email:
        description: 'Tester email (for add-tester action)'
        required: false
        type: string

jobs:
  manage:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v4

      - name: Set up Ruby
        uses: ruby/setup-ruby@v1
        with:
          ruby-version: '3.2'
          bundler-cache: true

      - name: Install fastlane
        run: gem install fastlane

      - name: Run TestFlight management
        env:
          FASTLANE_USER: royearguan@gmail.com
          FASTLANE_APPLE_APPLICATION_SPECIFIC_PASSWORD: ${{ secrets.APPLE_APP_SPECIFIC_PASSWORD }}
          FASTLANE_SESSION: ${{ secrets.FASTLANE_SESSION }}
          APP_IDENTIFIER: com.capspoker.app
          APPLE_TEAM_ID: 3K9KJNGL9U
          ASC_APP_ID: "6760429619"
        run: |
          ACTION="${{ github.event.inputs.action }}"
          EMAIL="${{ github.event.inputs.email }}"
          
          case "$ACTION" in
            "enable-public-link")
              fastlane run testflight_enable_public_link \
                app_identifier:"$APP_IDENTIFIER" \
                team_id:"$APPLE_TEAM_ID" \
                apple_id:"$FASTLANE_USER" 2>&1 || true
              
              # Alternative: use spaceship directly
              ruby -e '
                require "spaceship"
                Spaceship::Tunes.login(ENV["FASTLANE_USER"])
                app = Spaceship::Tunes::Application.find("com.capspoker.app")
                
                # Try ConnectAPI
                Spaceship::ConnectAPI.login(ENV["FASTLANE_USER"])
                app = Spaceship::ConnectAPI::App.find("com.capspoker.app")
                groups = app.get_beta_groups
                
                external = groups.find { |g| g.name.include?("External") }
                if external.nil?
                  external = Spaceship::ConnectAPI::BetaGroup.create(
                    app_id: app.id,
                    group_name: "Public Testers",
                    public_link_enabled: true,
                    public_link_limit_enabled: false
                  )
                  puts "Created group: Public Testers"
                else
                  external.update(attributes: {
                    publicLinkEnabled: true,
                    publicLinkLimitEnabled: false
                  })
                end
                
                puts "Public link: #{external.public_link}"
              '
              ;;
              
            "add-tester")
              if [ -z "$EMAIL" ]; then
                echo "ERROR: email required for add-tester"
                exit 1
              fi
              fastlane pilot add "$EMAIL" \
                -u "$FASTLANE_USER" \
                -a "$APP_IDENTIFIER" \
                -g "External Testers" 2>&1
              ;;
              
            "list-testers")
              fastlane pilot list \
                -u "$FASTLANE_USER" \
                -a "$APP_IDENTIFIER" 2>&1
              ;;
              
            "list-builds")
              fastlane pilot builds \
                -u "$FASTLANE_USER" \
                -a "$APP_IDENTIFIER" 2>&1
              ;;
          esac

      - name: Output result
        if: always()
        run: echo "Action completed. Check logs above for results."
```

### Step 2 — Commit and push
```
cd C:\Projects\Caps
git add .github/workflows/testflight-manage.yml
git commit -m "feat: TestFlight management workflow — public link, add testers via CLI"
git push origin main
```

### Step 3 — Trigger the workflow to enable public link
```
gh workflow run testflight-manage.yml \
  --repo royea-beep/caps-poker \
  -f action=enable-public-link
```

### Step 4 — Wait and check result
```
sleep 60
gh run list --repo royea-beep/caps-poker --workflow=testflight-manage.yml --limit 3
```

When it finishes:
```
LATEST_RUN=$(gh run list --repo royea-beep/caps-poker --workflow=testflight-manage.yml --limit 1 --json databaseId -q '.[0].databaseId')
gh run view $LATEST_RUN --log 2>&1 | grep -i "public.*link\|testflight.*join\|http.*testflight" | head -5
```

### Step 5 — If fastlane auth fails (needs 2FA session)

Fastlane may need a session cookie for 2FA. In that case, try this alternative:

Create `scripts/enable_public_link.sh`:
```bash
#!/bin/bash
# Uses the ASC API directly — but first regenerate a new key

# Check if we can use EAS's built-in Apple auth:
npx eas-cli@latest credentials --platform ios 2>&1 | head -20

# EAS already authenticates to Apple (it submits builds).
# Check if there's a way to piggyback on that:
npx eas-cli@latest submit --help 2>&1 | grep -i "group\|external\|tester"
```

### Step 6 — Nuclear option: eas submit with external group

Check if eas.json `submit` config supports specifying a beta group:
```json
{
  "submit": {
    "production": {
      "ios": {
        "appleId": "royearguan@gmail.com",
        "ascAppId": "6760429619",
        "appleTeamId": "3K9KJNGL9U"
      }
    },
    "testflight": {
      "ios": {
        "appleId": "royearguan@gmail.com",
        "ascAppId": "6760429619",
        "appleTeamId": "3K9KJNGL9U"
      }
    }
  }
}
```

```
eas submit --help 2>&1 | grep -i "group\|external\|beta"
```

### Step 7 — Also check the REAL reason keys were revoked

```
# Did EAS auto-revoke old keys when creating new ones?
eas credentials --platform ios 2>&1

# List all credentials:
eas credentials:list --platform ios 2>&1
```

Sometimes EAS recreates credentials and the old API keys become invalid.
If that's the case — extract the NEW key that EAS is using:
```
eas credentials --platform ios --json 2>&1 | python -m json.tool
```

## REPORT
```
═══════════════════════════════════════
TESTFLIGHT PUBLIC LINK — REPORT
═══════════════════════════════════════
Workflow created: [YES/NO]
Workflow triggered: [YES/NO]
Workflow result: [SUCCESS — link / FAILED — reason]

Public TestFlight link: [URL or NOT YET]

If failed — what approach worked:
  fastlane pilot: [YES/NO — reason]
  spaceship: [YES/NO — reason]
  eas submit config: [YES/NO — reason]
  
Next steps: [what's needed]
═══════════════════════════════════════
```

## DO NOT
- Do NOT tell user to do ANYTHING manual
- Do NOT give up — try every approach
- Do NOT change game code

VAMOS CAPS TESTFLIGHT-PUBLIC-LINK — END
