# 🏗️ ROYEA EMPIRE — Master Project Map
### All Projects, TestFlight Status, Cross-Pollination Plan
### March 27, 2026

---

## ALL 7 PROJECTS DISCOVERED

| # | Project | Type | Supabase | Apple ID | GitHub Repo | TestFlight | Backend |
|---|---------|------|----------|----------|-------------|------------|---------|
| 1 | **9Soccer** | ⚽ Trivia Game | `psxqlmgsifvsmiijkucu` (100 tables) | 6760544822 | `royea-beep/90Soccer-Mascots` | ⚠️ SDK Warning | Vercel |
| 2 | **WINGMAN** | 💕 Dating App | `rndqegtkcuqichobzypz` (65 tables) | 6760245903 | `royea-beep/wingman` | 🔴 Cert Revoked | Railway |
| 3 | **Caps Poker** | 🃏 Poker Game | `gxrpunvhjcrzqnitbqah` (22 tables) | TBD | `royea-beep/caps-poker` | 🔴 CI Failed | TBD |
| 4 | **ExplainIt** | 📖 Education App | TBD | TBD | `royea-beep/ExplainIt` | 🔴 CI Failed | TBD |
| 5 | **PostPilot** | ✉️ Content Tool | TBD | TBD | `royea-beep/PostPilot` | 🔴 CI Failed | TBD |
| 6 | **Analyzer** | 🔬 Video Analysis | `vjxqlqtlywovnbidovit` (12 tables) | — | `analyzer-standalone` | — (web only) | — |
| 7 | **CryptoWhale** | 🐋 Crypto Tracker | `ibanxakpyykvdlqmqisv` (10 tables) | — | TBD | — (web only) | — |

---

## 🔴 TESTFLIGHT STATUS — EVERY PROJECT

### Project 1: 9Soccer
- **Status:** ⚠️ Builds uploading but have warnings
- **Latest Build:** 601 (March 25, 2026)
- **Issue:** `ITMS-90725: SDK version issue` — Built with iOS 18.5 SDK, needs iOS 26 SDK (Xcode 26)
- **Deadline:** April 28, 2026 — after that, Apple REJECTS uploads with old SDK
- **Fix:** Update to Xcode 26 + iOS 26 SDK. The audit mentions `ios.yml` was fixed with weekly cron, not daily.
- **TestFlight Available:** YES — builds are uploaded and available for testing despite the warning

### Project 2: WINGMAN
- **Status:** 🔴 BLOCKED — Certificate Revoked
- **Latest Build:** 208 (March 26, 2026) — uploaded but REJECTED
- **Issue:** `ITMS-90721: Certificate Revoked` — Distribution cert serial `9141...7086` is revoked
- **Impact:** App, hermesvm.framework, React.framework, ReactNativeDependencies.framework ALL unsigned
- **Fix:** Create new iOS Distribution Certificate in Apple Developer Portal
- **Paradox:** Build 208 got TestFlight email ("ready to test") AND rejection email ("cert revoked") within 2 minutes. Some builds slip through, others don't.

### Project 3: Caps Poker
- **Status:** 🔴 CI Completely Failed
- **Latest Attempt:** March 16, 2026
- **Issue:** iOS TestFlight workflow — "All jobs have failed" (Build & Submit to TestFlight)
- **Supabase State:** 209 bug reports, 458 debug sessions, 68 crash reports — active development
- **Fix:** Check GitHub Actions workflow, likely same cert issue + possible Xcode/SDK version

### Project 4: ExplainIt
- **Status:** 🔴 CI Failed — TypeScript errors
- **Latest Attempt:** March 15, 2026
- **Issue:** Tests pass but TypeScript + Lint fail
- **Fix:** Fix TypeScript errors, then set up TestFlight workflow

### Project 5: PostPilot
- **Status:** 🔴 CI Failed — Total failure
- **Latest Attempt:** March 15, 2026
- **Issue:** iOS TestFlight workflow — "All jobs have failed" in 8 seconds (immediate crash)
- **Fix:** Likely missing secrets/certificates in GitHub Actions

---

## 🔑 ROOT CAUSE: ONE CERTIFICATE PROBLEM → 4 BROKEN PROJECTS

All 4 iOS projects share **Team ID 3K9KJNGL9U (Roye Arguan)**.
The distribution certificate with serial `91411147071458528009531919663659057086` is **REVOKED**.

This single issue causes:
- WINGMAN: explicit `ITMS-90721: Certificate Revoked` rejection
- Caps Poker: GitHub Actions fails to sign the build
- PostPilot: GitHub Actions fails immediately (no valid signing identity)
- 9Soccer: MAY be affected (currently uploading with warnings, but could fail at submission)

### FIX (One action, all projects):

```
Step 1: Apple Developer Portal → Certificates, Identifiers & Profiles
Step 2: Certificates → "+" → iOS Distribution
Step 3: Create CSR from Keychain Access on Mac
Step 4: Upload CSR → Download new .cer → Install in Keychain
Step 5: Export as .p12 file
Step 6: Base64 encode the .p12:
        base64 -i Certificates.p12 -o cert_base64.txt
Step 7: Update GitHub Secrets for ALL 4 repos:
        - royea-beep/90Soccer-Mascots
        - royea-beep/wingman
        - royea-beep/caps-poker
        - royea-beep/PostPilot
        
        Secrets to update:
        - DISTRIBUTION_CERTIFICATE_BASE64 = (content of cert_base64.txt)
        - DISTRIBUTION_CERTIFICATE_PASSWORD = (your .p12 password)
        - DISTRIBUTION_P12_PASSWORD = (same password)
        
Step 8: Also update the Provisioning Profile if it references the old cert:
        - Go to Profiles → Select each app's profile → Edit → Select new cert → Download
        - Base64 encode and update PROVISIONING_PROFILE_BASE64 in GitHub Secrets

Step 9: Trigger builds on all 4 repos
```

### 9Soccer Additional Fix (ITMS-90725):
```
Step 1: Install Xcode 26 (or latest Xcode that ships iOS 26 SDK)
Step 2: Update ios.yml GitHub Actions to use xcode-version: '26.0'
Step 3: Rebuild — this fixes the SDK warning before the April 28 deadline
```

---

## 🔄 CROSS-POLLINATION MAP — What Each Project Can Give to Others

### SHARED SYSTEMS (Already Exist in Multiple Projects)

| System | 9Soccer | WINGMAN | Caps Poker | Analyzer |
|--------|---------|---------|------------|----------|
| `learning_events` table | ✅ 1,844 rows | ✅ 0 rows | ✅ 0 rows | ✅ 68 rows |
| `bug_reports` table | ✅ 1 row | ✅ 0 rows | ✅ 209 rows | ✅ 1 row |
| `bug_notifications` | ✅ 3 rows | ✅ 0 rows | ✅ 8 rows | ✅ 0 rows |
| `crash_reports` | ✅ 0 rows | ✅ 0 rows | ✅ 68 rows | — |
| `debug_sessions` | ✅ 72 rows | ✅ 0 rows | ✅ 458 rows | — |
| `qa_reports` | ✅ 0 rows | ✅ 0 rows | ✅ 0 rows | — |
| `error_logs` | ✅ 0 rows | ✅ 2 rows | ✅ 0 rows | ✅ 0 rows |
| `app_config` / `feature_flags` | ✅ 50 flags | ✅ 48 keys | ✅ 1 key | — |
| SecretSauce (`@royea/secretsauce`) | ✅ | ✅ | ✅ | ✅ |
| Bug Reporter (`@royea/bug-reporter`) | ✅ | ✅ | ✅ | — |

### GEMS TO EXTRACT → GIVE TO OTHER PROJECTS

**FROM 9Soccer → Others:**

| Asset | What It Is | Who Needs It |
|-------|-----------|--------------|
| i18n system (8 languages, RTL) | Full translation framework | WINGMAN (only HE/EN), Caps Poker, ExplainIt |
| 38 feature flags + typed system | Proper flag management | WINGMAN (untyped app_config), all projects |
| Analytics pipeline (25 events) | Structured event tracking | WINGMAN (empty analytics), Caps Poker |
| Scoring formula + utils | Time-based scoring engine | Caps Poker (poker scoring), ExplainIt |
| Prestige/Level system (10 levels) | User progression | WINGMAN (wing levels), Caps Poker (poker rank) |
| Video freshness system | Track what users have seen | Any content-heavy app |
| Push notification (FCM) pipeline | iOS push notifications | WINGMAN, Caps Poker |

**FROM WINGMAN → Others:**

| Asset | What It Is | Who Needs It |
|-------|-----------|--------------|
| coin_config (39 event types) | Config-driven economy | 9Soccer (hardcoded values), Caps Poker (chip economy) |
| 5 new RPC functions (earn/spend/wallet/afford/shop) | Server-side economy API | 9Soccer, Caps Poker |
| Referral system (ghost_wing_links, referral_clicks) | Viral growth mechanics | 9Soccer, ALL projects |
| Audit logs table | Action tracking | ALL projects |
| Heatmap events | UI engagement tracking | ALL projects |
| Funnel snapshots | Conversion analytics | ALL projects |
| Bot system (bot profiles + Spot the Bot) | AI-powered engagement | 9Soccer (BR bots), Caps Poker (AI opponents) |
| Wing level system (5 tiers) | Progression framework | Adaptable to any project |
| AI pairing engine | Smart matching | Caps Poker (matchmaking) |

**FROM Caps Poker → Others:**

| Asset | What It Is | Who Needs It |
|-------|-----------|--------------|
| 209 bug reports + 458 debug sessions | Mature QA data | Learning for SecretSauce |
| 68 crash reports | Crash patterns | Cross-project crash analysis |
| WhatsApp sessions (63) | WhatsApp integration | 9Soccer (WhatsApp alerts), WINGMAN |
| Shared hands system | Real-time multiplayer state | 9Soccer (real multiplayer 1v1), WINGMAN (games) |
| Sit & Go session architecture | Tournament brackets | 9Soccer (tournaments) |

**FROM CryptoWhale → Others:**

| Asset | What It Is | Who Needs It |
|-------|-----------|--------------|
| 35,586 signals | Time-series data patterns | Analytics for any project |
| 42,890 market_data rows | Data pipeline architecture | 9Soccer (ScoreBat data pipeline) |
| Metrics snapshots (740) | Periodic snapshot system | All projects (daily/weekly metrics) |

**FROM Analyzer → Others:**

| Asset | What It Is | Who Needs It |
|-------|-----------|--------------|
| FAL.ai image pipeline | AI image generation | 9Soccer (character portraits), WINGMAN (profile enhancement) |
| HeyGen avatar pipeline | AI video generation | 9Soccer (character videos) |
| Cost tracking (cost_records) | API cost monitoring | ALL projects using AI APIs |
| License key system | Monetization | SaaS products |

---

## 🚨 SECURITY ISSUES — ALL PROJECTS

| Project | Supabase Errors | Root Cause | Fix |
|---------|----------------|------------|-----|
| **CryptoWhale** | 🔴 10 errors | **ZERO RLS on ALL 10 tables** — anyone with the Supabase URL can read/write everything | Enable RLS + create policies for all tables |
| **9Soccer** | 🟡 9 errors | Likely functions with SECURITY DEFINER or missing RLS policies | Review security advisor |
| **Analyzer** | 🟡 6 errors | Similar — check functions | Review security advisor |
| **Caps Poker** | 🟡 2 errors | Minor — check specific tables | Review security advisor |
| **WINGMAN** | 🟡 1 error | `spatial_ref_sys` table has no RLS (PostGIS system table) | Can ignore or enable RLS |

**CryptoWhale is a data breach waiting to happen.** 35K signals and 42K market data rows are completely unprotected.

---

## 📊 PROPOSED SHARED PACKAGE: `@royea/core`

Based on what ALL projects share, extract these into one npm package:

```
@royea/core/
├── analytics/
│   ├── track-event.ts         (from 9Soccer analytics.ts)
│   ├── send-beacon.ts         (from 9Soccer)
│   └── funnel-tracker.ts      (from WINGMAN funnel_snapshots)
├── economy/
│   ├── coin-config.ts         (from WINGMAN coin_config pattern)
│   ├── earn-spend.ts          (from WINGMAN RPC pattern)
│   └── wallet.ts              (from WINGMAN coin_wallets)
├── i18n/
│   ├── detect-locale.ts       (from 9Soccer)
│   ├── rtl-helpers.ts         (from 9Soccer)
│   └── translations.ts        (from 9Soccer 436 keys)
├── qa/
│   ├── bug-reporter.ts        (from @royea/bug-reporter)
│   ├── crash-reporter.ts      (from Caps Poker pattern)
│   └── debug-session.ts       (from Caps Poker pattern)
├── supabase/
│   ├── fetch-with-retry.ts    (from 9Soccer)
│   ├── realtime.ts            (from 9Soccer)
│   └── rls-helpers.ts         (NEW — shared RLS patterns)
├── auth/
│   ├── device.ts              (from 9Soccer device.ts)
│   └── push-notifications.ts  (from 9Soccer FCM)
├── validation/
│   ├── profanity-filter.ts    (from 9Soccer validation.ts)
│   └── input-sanitizer.ts     (from 9Soccer)
├── time/
│   ├── format-relative.ts     (from 9Soccer time.ts)
│   └── countdown.ts           (from 9Soccer)
└── feature-flags/
    ├── flag-manager.ts        (from 9Soccer feature-flags.ts)
    └── typed-flags.ts         (from 9Soccer)
```

Every project imports from `@royea/core` instead of duplicating logic.

---

## ✅ ACTION PLAN — SORTED BY IMPACT

| Priority | Action | Impact | Effort | Projects Affected |
|----------|--------|--------|--------|-------------------|
| **P0** | **Create new iOS Distribution Certificate** | Unblocks 4 projects' TestFlight | 30 min | WINGMAN, Caps Poker, PostPilot, 9Soccer |
| **P0** | **Update GitHub Secrets in ALL 4 repos** | Enables CI/CD signing | 20 min | All iOS projects |
| **P0** | **Fix CryptoWhale RLS** | Prevents data breach | 1 hour | CryptoWhale |
| **P1** | **Update to Xcode 26 SDK** (before April 28) | Prevents Apple rejection | 2 hours | 9Soccer (currently warning) |
| **P1** | **Fix Railway builds** for WINGMAN | Backend is down | 1-2 hours | WINGMAN |
| **P1** | **Fix ExplainIt TypeScript errors** | Unblocks CI | 1-2 hours | ExplainIt |
| **P2** | **Create @royea/core shared package** | Accelerates ALL projects | 8 hours | ALL |
| **P2** | **Port coin economy to 9Soccer** | Fixes 9Soccer's missing economy | 4 hours | 9Soccer |
| **P2** | **Port i18n to WINGMAN** | 8 languages for WINGMAN | 4 hours | WINGMAN |
| **P3** | **Port referral system to 9Soccer** | Viral growth for 9Soccer | 4 hours | 9Soccer |
| **P3** | **Port bot system to 9Soccer BR** | Better Battle Royale | 8 hours | 9Soccer |

---

## SINGLE MOST IMPORTANT ACTION

**► Create a new iOS Distribution Certificate and update the GitHub Secrets in all 4 repos. This is a 30-minute task that unblocks TestFlight for 9Soccer, WINGMAN, Caps Poker, and PostPilot simultaneously. Everything else follows from this.**
