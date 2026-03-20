VAMOS CAPS OAUTH-VERIFY v1.9.3-b106 2026-03-20-1630

## ROLE
You are a Senior Auth Engineer specializing in OAuth 2.0, Google Sign-In, and Supabase authentication. Your goal: verify Google OAuth is fully working and generate a direct test link that Roye can click to confirm Google Sign-In works end-to-end.

## Current state: v1.9.3 | Code: b106 | EAS: #117
Read C:/Users/royea/.claude/projects/C--Projects-Caps/memory/MEMORY.md
Standing Orders: Execute autonomously. Never give user commands unless truly impossible.

## FIRST ACTION
```bash
cp "C:/Users/royea/Downloads/vamos-caps-oauth-verify-v1.9.3-b106-2026-03-20-1630.md" \
   "/c/Projects/Caps/docs/prompts/vamos-caps-oauth-verify-v1.9.3-b106-2026-03-20-1630.md"
```

---

## TASK A — Check current OAuth status (agent: oauth-agent)

A1. Read utils/auth.ts in full — find the Google OAuth config
A2. Read app.json — find scheme, bundleIdentifier
A3. Get Supabase project config:
    curl -s "https://gxrpunvhjcrzqnitbqah.supabase.co/auth/v1/settings" \
      -H "apikey: $(grep supabaseAnonKey /c/Projects/Caps/app.json | head -1 | grep -oP '(?<=: \").*(?=\")')" \
      2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(json.dumps({k:v for k,v in d.items() if 'google' in str(k).lower() or 'google' in str(v).lower()}, indent=2))" 2>/dev/null

A4. Get the Google Client ID from Supabase:
    cat /c/Projects/Caps/.env 2>/dev/null | grep -i "google\|oauth\|client"
    grep -r "google\|oauth\|client_id" /c/Projects/Caps/app.json 2>/dev/null

A5. Get the Supabase callback URL for Google:
    The callback URL for Supabase Google OAuth is:
    https://gxrpunvhjcrzqnitbqah.supabase.co/auth/v1/callback

---

## TASK B — Generate direct OAuth test URL (agent: url-builder)

B1. Read utils/auth.ts — find how signInWithGoogle constructs the URL

B2. Build the direct Google OAuth URL that Roye can click:
    The URL format is:
    ```
    https://gxrpunvhjcrzqnitbqah.supabase.co/auth/v1/authorize?
      provider=google&
      redirect_to=https://caps.ftable.co.il
    ```

    Generate this URL and print it clearly.

B3. Also generate the native deep link version:
    ```
    https://gxrpunvhjcrzqnitbqah.supabase.co/auth/v1/authorize?
      provider=google&
      redirect_to=caps-poker://auth/callback
    ```

B4. Test if the URL is reachable:
    curl -s -o /dev/null -w "%{http_code} %{redirect_url}" \
      "https://gxrpunvhjcrzqnitbqah.supabase.co/auth/v1/authorize?provider=google&redirect_to=https://caps.ftable.co.il" \
      2>/dev/null

---

## TASK C — Check Google Cloud Console config (agent: gcloud-agent)

C1. Read utils/auth.ts — find the Google Client ID
C2. Verify what redirect URIs are needed:
    For Supabase Google OAuth, the required URIs in Google Cloud Console are:
    - https://gxrpunvhjcrzqnitbqah.supabase.co/auth/v1/callback
    
    For native iOS deep link:
    - caps-poker://auth/callback (added as URI scheme in Google console)

C3. Check if there's a google-services.json or GoogleService-Info.plist:
    find /c/Projects/Caps -name "GoogleService-Info.plist" -o -name "google-services.json" 2>/dev/null

C4. Report exact status:
    - What redirect URIs are currently configured (from auth.ts code)
    - What still needs to be added in Google Cloud Console
    - Direct link to Google Cloud Console credentials page:
      https://console.cloud.google.com/apis/credentials

---

## TASK D — Create test page on web (agent: web-agent)

D1. Create a simple test page at the web app:
    Add to app/(tabs)/test-oauth.tsx or create a simple HTML page

    Actually — simpler: generate a direct clickable URL that goes to Google login
    and redirects back to caps.ftable.co.il after success.

D2. Print the final clickable URL clearly:
    "CLICK THIS TO TEST GOOGLE SIGN-IN:"
    https://gxrpunvhjcrzqnitbqah.supabase.co/auth/v1/authorize?provider=google&redirect_to=https://caps.ftable.co.il

---

## TASK E — Update scores if OAuth confirmed working (agent: db-agent)

E1. After URL is verified reachable (curl returns 302 redirect to Google):
    Update ZPM DB:
    - stage_live_optimization: 13 → 15 (if Twilio also done)
    - Or: stage_launch_prep: 16 → 18 (Google OAuth fully functional)

E2. Use sql.js pattern from previous sessions

---

## FINAL STEPS
1. Print the direct OAuth test URL clearly
2. Print what still needs to be done in Google Cloud Console (if anything)
3. git add -A && git commit -m "docs: OAuth verify + direct test URL [v1.9.3-b106]"
4. git push origin main
5. Report: OAuth status, test URL, what's confirmed working

VAMOS CAPS OAUTH-VERIFY — END
