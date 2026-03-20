# VAMOS MEGA PROMPT — Google OAuth 400 Deep Diagnosis
**Version:** v1.9.3 | **Build:** b106 | **Date:** 2026-03-20 19:15 IL (UTC+2)

---

## ROLE
You are a **Senior Auth & OAuth 2.0 Debugging Engineer**. You do NOT guess — you investigate, test, and fix.

## FIRST ACTIONS
```
Read C:/Users/royea/.claude/projects/C--Projects-Caps/memory/MEMORY.md
Iron Rules confirmed.
cp this file to docs/prompts/
```

---

## SITUATION — READ CAREFULLY

We wasted an hour chasing a wrong lead. Here's what actually happened:

1. Google OAuth login for Caps Poker returns **Error 400** when hitting:
   ```
   https://gxrpunvhjcrzqnitbqah.supabase.co/auth/v1/authorize?provider=google&redirect_to=https://caps.ftable.co.il
   ```

2. We assumed the redirect URI `https://gxrpunvhjcrzqnitbqah.supabase.co/auth/v1/callback` was missing from Google Cloud Console.

3. **IT WAS ALREADY THERE.** The URI was already configured in the 9Soccer-Mascots GCP project (project number `133353581092`), client ID `133353581092-dgg78u8gu56p3af89nquorkuofoaigaq`.

4. So the 400 error is caused by **something else entirely**. We need to find the REAL cause.

---

## KNOWN FACTS

- **Supabase project:** `gxrpunvhjcrzqnitbqah.supabase.co`
- **OAuth Client ID:** `133353581092-dgg78u8gu56p3af89nquorkuofoaigaq`
- **OAuth Client Secret:** `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`
- **GCP Project:** 9Soccer-Mascots (project number `133353581092`)
- **Redirect URI in GCP:** `https://gxrpunvhjcrzqnitbqah.supabase.co/auth/v1/callback` — ALREADY CONFIGURED
- **Error:** 400 from Google (not from Supabase)

---

## YOUR MISSION — FIND THE REAL CAUSE

Run these investigations **in parallel**:

### Agent 1 — Reproduce & Capture Exact Error
```bash
# Hit the authorize URL and capture the FULL redirect chain + error details
curl -v -L "https://gxrpunvhjcrzqnitbqah.supabase.co/auth/v1/authorize?provider=google&redirect_to=https://caps.ftable.co.il" 2>&1 | head -100

# Look specifically for:
# - The exact Google URL it redirects to
# - The exact redirect_uri parameter Google receives
# - The exact error message (redirect_uri_mismatch? invalid_client? access_denied? something else?)
```

### Agent 2 — Check ALL Possible 400 Causes
A Google OAuth 400 can be caused by:

1. **OAuth consent screen in "Testing" mode** — only whitelisted test users can authenticate
   - Check: GCP Console → 9Soccer-Mascots → OAuth consent screen / Audience
   - Fix: Either add user's email as test user OR publish to production

2. **Client ID disabled or suspended** — check if the client has a warning icon
   - Check: GCP Console → Credentials → look for ⚠️ on the client

3. **Exact URI mismatch** — even a trailing slash difference causes failure
   - Capture the exact `redirect_uri` param Google receives from the curl above
   - Compare character-by-character with what's configured in GCP

4. **Wrong client type** — must be "Web application", not "Desktop" or "Android"
   - Check: GCP Console → click the client → verify Type = Web application

5. **Client secret mismatch** — Supabase has a different secret than GCP
   - Check: Supabase Dashboard → Auth → Providers → Google → compare client secret

6. **Google API not enabled** — Google Identity / People API might not be enabled
   - Check: GCP Console → Enabled APIs → look for "Google Identity Toolkit API" or "People API"

7. **Multiple redirect URIs conflict** — sometimes Google gets confused
   - Check: what other redirect URIs are listed on this client? (e.g., `http://localhost:3000/callback` from 9Soccer)

8. **Authorized JavaScript origins missing** — some flows require this too
   - Check: does the client have `https://gxrpunvhjcrzqnitbqah.supabase.co` in Authorized JavaScript origins?

### Agent 3 — Supabase Side Verification
```bash
# Check what Supabase is actually sending to Google
# The /authorize endpoint should redirect to Google with specific params
curl -s -o /dev/null -w "%{redirect_url}" "https://gxrpunvhjcrzqnitbqah.supabase.co/auth/v1/authorize?provider=google&redirect_to=https://caps.ftable.co.il"

# This will show the exact Google URL — check every parameter:
# - client_id (must match)
# - redirect_uri (must match EXACTLY what's in GCP)
# - scope (must be valid)
# - response_type (should be "code")
```

### Agent 4 — Quick Fix Attempts (if consent screen is the issue)
If the issue is OAuth consent screen in Testing mode:
- The fastest fix: add the user's Google email as a test user
- OR: publish the app (if it doesn't require verification for basic scopes like email/profile)

---

## DECISION TREE

```
What does the curl -v show?
├── redirect_uri_mismatch
│   ├── URI has trailing slash difference → fix in GCP
│   ├── URI uses http vs https → fix in GCP
│   └── URI is totally different → fix Supabase provider config
├── access_denied / consent_required
│   └── OAuth consent screen in Testing → publish or add test user
├── invalid_client
│   └── Client ID or secret mismatch → fix in Supabase provider config
├── unauthorized_client
│   └── Client type wrong → recreate as Web application
└── Other error
    └── Capture full error, investigate, fix
```

---

## SUCCESS CRITERIA

- [ ] `curl` to the authorize URL returns a 302 to `accounts.google.com` (not a 400)
- [ ] Opening the URL in browser shows Google login page
- [ ] After login, user is redirected to `caps.ftable.co.il` with auth token
- [ ] Root cause documented in MEMORY.md
- [ ] Fix committed and pushed

---

## ON COMPLETION
```bash
# Test the full flow
curl -v "https://gxrpunvhjcrzqnitbqah.supabase.co/auth/v1/authorize?provider=google&redirect_to=https://caps.ftable.co.il" 2>&1 | grep -E "Location:|HTTP/"

# Update MEMORY.md with root cause and fix
# git add -A && git commit -m "fix: Google OAuth 400 — [root cause here] [v1.9.3-b106]" && git push
```

---

## MANUAL_TASKS
- If the fix requires Google Cloud Console browser actions (e.g., publishing consent screen) → provide EXACT steps with URLs
- If Supabase Dashboard changes needed → provide exact navigation path

## CONFLICTS LIST
(add here if anything conflicts with working systems)

---

*Fix autonomously. Never give user commands unless truly impossible. The last prompt wasted an hour — don't repeat that mistake. Find the REAL cause.*
