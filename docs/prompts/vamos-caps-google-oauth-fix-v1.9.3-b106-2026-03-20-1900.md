# VAMOS MEGA PROMPT — Google OAuth Redirect URI Fix
**Version:** v1.9.3 | **Build:** b106 | **Date:** 2026-03-20 19:00 IL (UTC+2)

---

## ROLE
You are a **Senior DevOps & Auth Engineer** specializing in Google Cloud, Supabase Auth, and OAuth 2.0 flows.

## FIRST ACTIONS
```
Read C:/Users/royea/.claude/projects/C--Projects-Caps/memory/MEMORY.md
Iron Rules confirmed.
cp this file to docs/prompts/
```

---

## CONTEXT — WHAT HAPPENED

Caps Poker uses **Supabase Auth with Google OAuth** for user login. The Google login flow is broken:

1. When hitting `https://gxrpunvhjcrzqnitbqah.supabase.co/auth/v1/authorize?provider=google&redirect_to=https://caps.ftable.co.il` → we get **Error 400 from Google: `redirect_uri_mismatch`**

2. This means the Supabase callback URL `https://gxrpunvhjcrzqnitbqah.supabase.co/auth/v1/callback` is **NOT listed** in the Google Cloud OAuth client's Authorized Redirect URIs.

3. The **Supabase Dashboard** (Authentication → Providers → Google) shows a Google OAuth Client ID starting with `133353581092-dgg78u8gu56p3af89nquorkuofoaigaq`.

4. We searched **ALL 4 Google Cloud projects** in the owner's account and **could NOT find this Client ID anywhere**:

| Project | ID | Client IDs found |
|---------|-----|-----------------|
| projects-debug | projects-debug-490306 | No OAuth configured at all |
| 9Soccer-Mascots | soccer-mascots | Not checked yet |
| API Project | api-project-212559520596 | 4 clients, all start with `212559520596-...` |
| Chicle | chicle-727f1 | 1 client, starts with `819178867487-...` |

**None of them contain a client starting with `133353581092`.**

---

## YOUR MISSION

Find where the OAuth Client ID `133353581092-dgg78u8gu56p3af89nquorkuofoaigaq` lives and add the redirect URI. Investigate ALL possibilities:

### Investigation Plan (run in parallel):

**Agent 1 — Supabase Side:**
- Open Supabase Dashboard → Authentication → Providers → Google
- Confirm the exact Client ID and Client Secret configured
- Check if there's a mismatch or if Supabase is using a different provider config
- Check Supabase project settings for any linked Google Cloud project

**Agent 2 — Google Cloud Deep Search:**
- The project number `133353581092` corresponds to a Google Cloud project. Find it:
  - Go to `https://console.cloud.google.com/welcome?project=133353581092` or search by project number
  - It might be in a DIFFERENT Google account entirely
  - Check: `https://console.cloud.google.com/apis/credentials?project=133353581092`
  - The project picker shows "No organization" — could there be projects in an organization?
- Check the **9Soccer-Mascots** project (not checked yet) — go to Credentials page
- Look for deleted/archived projects that might contain this client

**Agent 3 — Alternative Solutions (if client not found):**
- **Option A:** Create a NEW OAuth Client ID in one of the existing projects (e.g., API Project):
  1. Go to APIs & Services → Credentials → Create Credentials → OAuth Client ID
  2. Type: Web application
  3. Name: "Caps Poker Supabase Auth"
  4. Authorized redirect URIs: `https://gxrpunvhjcrzqnitbqah.supabase.co/auth/v1/callback`
  5. Copy the new Client ID + Secret
  6. Update Supabase Dashboard → Authentication → Providers → Google with new credentials
- **Option B:** Check if the `133353581092` project belongs to a different Google account (maybe a personal vs. workspace account)
- **Option C:** Check if Supabase auto-created this via their Google Cloud integration

---

## KEY INFO

- **Supabase project:** `gxrpunvhjcrzqnitbqah.supabase.co`
- **Required redirect URI:** `https://gxrpunvhjcrzqnitbqah.supabase.co/auth/v1/callback`
- **OAuth Client ID in Supabase:** `133353581092-dgg78u8gu56p3af89nquorkuofoaigaq`
- **Google Cloud Console:** `https://console.cloud.google.com/apis/credentials`
- **Project owner Google account:** Check which account is logged in (top-right avatar)

---

## DECISION TREE

```
Can you find project 133353581092 in Google Cloud?
├── YES → Add redirect URI → Done
├── NO, it's in another Google account → Tell user which account to switch to
└── NO, can't find it anywhere
    → Create NEW OAuth client in "API Project"
    → Update Supabase with new Client ID + Secret
    → Test the auth flow
    → Done
```

---

## SUCCESS CRITERIA

- [ ] Google OAuth login flow works end-to-end
- [ ] Hitting the authorize URL redirects to Google login (no 400 error)
- [ ] After Google login, user is redirected back to `caps.ftable.co.il`
- [ ] Supabase shows the authenticated user
- [ ] Document the fix in MEMORY.md

---

## MANUAL_TASKS (if bot can't do it)
- If the OAuth client is in a different Google account → tell user exactly which account and what to do
- If creating new credentials requires consent screen setup → provide step-by-step
- Google Cloud Console actions require browser access — provide exact URLs and steps

---

## ON COMPLETION
```bash
# Update MEMORY.md with:
# - Which Google Cloud project contains the OAuth client
# - The redirect URI that was added
# - Current auth flow status

# Test the flow:
# https://gxrpunvhjcrzqnitbqah.supabase.co/auth/v1/authorize?provider=google&redirect_to=https://caps.ftable.co.il
```

---

## CONFLICTS LIST
(add here if any fix conflicts with working systems)

---

*Fix autonomously. Never give user commands unless truly impossible. Auto-approve sub-decisions.*
