# VAMOS MEGA PROMPT — Fix Supabase OAuth Redirect (Site URL)
**Version:** v1.9.3 | **Build:** b106 | **Date:** 2026-03-20 19:45 IL (UTC+2)

---

## ROLE
You are a **Senior Auth Engineer**. Execute fast.

## FIRST ACTIONS
```
Read C:/Users/royea/.claude/projects/C--Projects-Caps/memory/MEMORY.md
Iron Rules confirmed.
cp this file to docs/prompts/
```

---

## CONTEXT

Google OAuth consent screen is now published ✅ — no more 400 error.

NEW PROBLEM: After successful Google login, Supabase redirects the user to `localhost:3000` instead of `https://caps.ftable.co.il`. The browser shows:
```
localhost:3000/?error=invalid_request&error_code=bad_oauth_state&error_description=OAuth...
```

Root cause: Supabase **Site URL** is set to `http://localhost:3000`. This is the default fallback redirect after OAuth.

---

## MISSION

### Step 1 — Fix Supabase Site URL (bot can do via API or dashboard)
Check and update the Supabase project settings:

```bash
# Check current site URL via Supabase Management API
curl -s "https://api.supabase.com/v1/projects/gxrpunvhjcrzqnitbqah/config/auth" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" | grep -i "site_url\|redirect"
```

If bot has dashboard/API access, update:
- **Site URL:** `https://caps.ftable.co.il`
- **Redirect URLs** (whitelist): add `https://caps.ftable.co.il` and `https://caps.ftable.co.il/**`

If bot cannot access Supabase API:

### MANUAL_TASKS — Give these to the user:
1. Open: https://supabase.com/dashboard/project/gxrpunvhjcrzqnitbqah/auth/url-configuration
2. **Site URL** → change from `http://localhost:3000` to `https://caps.ftable.co.il`
3. **Redirect URLs** → make sure these are listed:
   - `https://caps.ftable.co.il`
   - `https://caps.ftable.co.il/**`
   - `http://localhost:3000/**` (keep for dev)
   - `caps-poker://` (keep for iOS deep link)
4. Click **Save**

### Step 2 — Test
Open: https://gxrpunvhjcrzqnitbqah.supabase.co/auth/v1/authorize?provider=google&redirect_to=https://caps.ftable.co.il

Expected: Google login → redirect to `https://caps.ftable.co.il` with session token in URL hash.

### Step 3 — Verify programmatically
```bash
# After login, the URL should look like:
# https://caps.ftable.co.il/#access_token=...&refresh_token=...&token_type=bearer
```

---

## ON COMPLETION
```bash
# Update MEMORY.md:
# - Google OAuth: FULLY WORKING
# - Site URL: https://caps.ftable.co.il
# - Stage 6 (LiveOpt) score bump if applicable
# git add -A && git commit -m "fix: Supabase Site URL → caps.ftable.co.il, OAuth flow complete [v1.9.3-b106]" && git push
```

---

*Fix autonomously. If Supabase API access available, do it directly. Otherwise provide exact manual steps.*
