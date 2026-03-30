# CAPS - Card Game — BIBLE AUDIT
## Every feature scored. Every gap identified. Nothing ships half-done.
## March 28, 2026 | Build 266 | Commit 2b4183e + 05e907b + e4a58c1

---

# SECTION 1: FEATURE INVENTORY

Every feature that exists in the code/config/database, scored 1-10 on execution quality.

## CORE GAMEPLAY

| # | Feature | Config/Code | Backend | Frontend | Score | Status |
|---|---------|-------------|---------|----------|-------|--------|
| 1 | **Texas Hold'em engine** | Core game loop | ✅ Working | ✅ Working | 9/10 | SOLID — 179 hands played, no crashes |
| 2 | **Card dealing & animation** | Built-in | — | ✅ Working | 8/10 | Smooth, Hermes-safe animations |
| 3 | **Board reveal (flop/turn/river)** | Built-in | — | ✅ Working | 8/10 | Sequential reveal works |
| 4 | **Hand evaluation** | Built-in | — | ✅ Working | 9/10 | Correct hand rankings |
| 5 | **Card display** | `card_display` config | ✅ Config deployed | ✅ Wired (e4a58c1) | 7/10 | Corner labels hidden, sizing formula applied. NEEDS visual verification on all devices |
| 6 | **Auto-continue** | `auto_continue_seconds: 8` | ✅ Config | ✅ Shipped (2b4183e) | 8/10 | Gold countdown bar, tap to cancel, skips in multiplayer |
| 7 | **Win celebration** | `show_confetti_on_win: true` | ✅ Config | ✅ Shipped (2b4183e) | 7/10 | Dark overlay + chip count + 8 dots burst. NEEDS testing on small screens |
| 8 | **Pro voices** | `pro_voices_enabled: true` | — | ✅ Enabled | ?/10 | **NOT VERIFIED** — do voices actually play? Need audio test |

## ECONOMY

| # | Feature | Config/Code | Backend | Frontend | Score | Status |
|---|---------|-------------|---------|----------|-------|--------|
| 9 | **Chip wallet** | leaderboard table | ✅ 31 players | ✅ Header pill (05e907b) | 7/10 | Gold pill shows balance. NEEDS visual check — does it fit on small screens? |
| 10 | **Earn chips (30 events)** | chip_config | ✅ RPCs | ✅ Wired (e4a58c1) | 6/10 | hand_won/share/streak wired. But: only 5 transactions total. Are all trigger points actually firing? |
| 11 | **Shop (6 items)** | chip_config spend events | ✅ RPCs | ✅ Shop screen (e4a58c1) | 5/10 | Screen exists but: NO navigation to it from home. How does user find the shop? |
| 12 | **Daily reward** | daily_rewards table | ✅ claim_daily_reward RPC | ✅ Popup (05e907b) | 6/10 | Spring-animated modal. Only 1 claim ever. NEEDS: visual check, streak display |
| 13 | **Streak bonus** | `streak_bonus_enabled: true` | ✅ 7/14/30 day events | ❓ Unknown | 4/10 | Backend events exist (streak_3/7/14/30) but is streak tracked client-side? |
| 14 | **Starting chips** | `starting_chips: 500` | ✅ Config | ❓ Unknown | ?/10 | New players get 500 chips. Verified in DB but is it shown on first launch? |
| 15 | **Ad rewards** | `max_daily_ad_rewards: 5` | ❓ No ad SDK | ❌ Not wired | 2/10 | Config exists but NO ad integration. Dead feature. **DECISION: Remove or implement?** |

## SOCIAL

| # | Feature | Config/Code | Backend | Frontend | Score | Status |
|---|---------|-------------|---------|----------|-------|--------|
| 16 | **WhatsApp share** | `whatsapp_share_enabled: true` | ✅ shared_hands (25) | ✅ Fixed (UX fix commit) | 7/10 | Green button with Hebrew text. 25 shares created. Works. |
| 17 | **Leaderboard** | leaderboard table | ✅ get_leaderboard RPC | ❓ Screen exists? | 5/10 | RPC works, 31 players ranked. But: is there a leaderboard SCREEN? Is it in navigation? |
| 18 | **Invite friend** | invite_friend economy event | ✅ +100 chips event | ❓ Unknown | 3/10 | Backend event exists. But: is there an invite flow in the UI? How does a user invite? |
| 19 | **Referral** | referral_joined event | ✅ +300 chips | ❌ No tracking | 2/10 | Reward exists but NO referral tracking system. Dead feature. **DECISION: Build or remove?** |

## GAME MODES

| # | Feature | Config/Code | Backend | Frontend | Score | Status |
|---|---------|-------------|---------|----------|-------|--------|
| 20 | **Standard Texas Hold'em** | Core | ✅ | ✅ | 9/10 | The main game. Working. |
| 21 | **Sit & Go** | `sit_n_go_enabled: false` | ✅ Tables exist (0 rows) | ✅ Button grayed (05e907b) | 1/10 | Tables created, config off, button says "Coming Soon". **DECISION: Timeline or remove from UI?** |
| 22 | **Battle Pass** | `battle_pass_enabled: false` | ✅ Table exists (0 rows) | ✅ Button grayed (05e907b) | 1/10 | Same — table, config, dead UI. **DECISION: Timeline or remove?** |
| 23 | **Tournaments** | tournaments table | ✅ Table (0 rows) | ❌ No UI | 1/10 | Table exists, 0 data, no economy event, no UI. **DECISION: Future or remove?** |
| 24 | **Bluff detection** | bluff_success economy event | ✅ +75 chips | ❓ Unknown | ?/10 | Event exists. Does the game actually detect bluffs? |

## MONITORING & QA

| # | Feature | Config/Code | Backend | Frontend | Score | Status |
|---|---------|-------------|---------|----------|-------|--------|
| 25 | **Health check** | health_check() RPC | ✅ Working | — | 9/10 | Returns full status. Tested. |
| 26 | **Dashboard** | get_caps_dashboard() RPC | ✅ Working | — | 8/10 | Returns players, economy, quality metrics. |
| 27 | **Crash reporting** | crash_reports table | ✅ 74 reports (all dismissed) | ✅ Auto-reports | 8/10 | Working. All 74 were false positives (dirty-shutdown). |
| 28 | **Bug reporting** | bug_reports table | ✅ 224 reports | ✅ Bug reporter in-app | 7/10 | Working. 212 dismissed (telemetry), 12 resolved. |
| 29 | **WhatsApp QA pipeline** | whatsapp_sessions | ✅ 80 sessions | ✅ VAMOS bot | 7/10 | Voice + screenshot → Claude analysis → auto-fix attempt. |
| 30 | **Debug sessions** | debug_sessions | ✅ 560 sessions | ✅ Auto-collects | 7/10 | Breadcrumbs, step logs, screen tracking. |
| 31 | **Heatmap** | heatmap_events | ✅ Table (0 rows!) | ❌ Not collecting | 1/10 | Table deployed but client NEVER sends events. **DEAD.** |
| 32 | **Play of the Day** | get_play_of_the_day() RPC | ✅ Working | ❌ No UI | 2/10 | RPC deployed this session. No frontend display yet. |

## INFRASTRUCTURE

| # | Feature | Config/Code | Backend | Frontend | Score | Status |
|---|---------|-------------|---------|----------|-------|--------|
| 33 | **RLS** | All tables | ✅ 100% enabled | — | 10/10 | Every table has RLS. |
| 34 | **Negative balance guard** | CHECK constraint | ✅ Added this session | — | 10/10 | `total_chips >= 0` enforced at DB level. |
| 35 | **Auto-fix pipeline** | Edge Function v9 | ✅ Deployed | — | 6/10 | Returned "no changes" on 4 bugs (design decisions, not code). Needs improvement. |
| 36 | **Push tokens** | push_tokens table | ✅ Table (0 rows!) | ❌ Not collecting | 1/10 | Table exists, NO tokens collected. Push notifications impossible. **DEAD.** |

---

# SECTION 2: SCREEN MAP — What the user actually sees

```
SPLASH → HOME → GAME (deal) → BOARD (flop/turn/river) → RESULTS → HOME
   ↓         ↓                                              ↓
   ↓      SETTINGS                                    SHARE (WhatsApp)
   ↓         ↓
   ↓      LEADERBOARD (?)
   ↓         ↓
   ↓      SHOP (new, e4a58c1) — but how to navigate there?
   ↓
DAILY REWARD POPUP (new, 05e907b)
CHIP BALANCE HEADER (new, 05e907b)
```

### Screen-by-Screen Checklist (needs visual verification)

| Screen | Exists | Tested on Device | Responsive | Not Overloaded | Score |
|--------|--------|-----------------|------------|----------------|-------|
| Splash | ✅ | ❓ | ❓ | ✅ (minimal) | ?/10 |
| Home | ✅ | ❓ | ❓ | ❓ NEW stuff added | ?/10 |
| Game | ✅ | ✅ Build 266 | ❓ Small screens? | ✅ | 7/10 |
| Results | ✅ | ❓ | ❓ | ❓ Auto-continue + confetti added | ?/10 |
| Settings | ❓ | ❓ | ❓ | ❓ | ?/10 |
| Shop | ✅ NEW | ❌ Never tested | ❌ Unknown | ❓ | ?/10 |
| Leaderboard | ❓ | ❓ | ❓ | ❓ | ?/10 |
| Daily Popup | ✅ NEW | ❌ Never tested | ❌ Unknown | ❓ | ?/10 |

**⚠️ 4 NEW screens/components were shipped by Claude Code but NEVER visually verified on a real device.** This violates QA Iron Law rule #2.

---

# SECTION 3: DEAD FEATURES (exist but don't work)

| Feature | What Exists | What's Missing | Recommendation |
|---------|-------------|---------------|----------------|
| **Sit & Go** | Table, config, grayed button | Game logic, matchmaking, UI | REMOVE button until ready — "Coming Soon" on a grayed button is confusing for new users |
| **Battle Pass** | Table, config, grayed button | Seasons, tiers, rewards, progress UI | REMOVE button — brand new users don't need to see disabled features |
| **Tournaments** | Table (0 rows) | Everything — no UI, no logic, no economy | REMOVE table or keep for future. No UI trace. |
| **Ad rewards** | Config (max 5/day) | Ad SDK, reward flow, UI | REMOVE config — creates false expectations |
| **Heatmap** | Table (0 rows) | Client-side event sending | Either wire the client to send events, or remove the table |
| **Push notifications** | Table (0 rows) | Token collection, notification sending | Critical missing piece — users can't be reminded to play |
| **Referral tracking** | Economy event (300 chips) | Invite link generation, tracking, attribution | Either build the flow or remove the event |

**Count: 7 dead features out of 36 total = 19% dead weight.**

---

# SECTION 4: OVERLOAD RISK

New users currently see on the HOME screen:
1. ~~Chip balance header (NEW)~~ 
2. ~~Daily reward popup (NEW)~~
3. ~~Sit & Go button (grayed, "Coming Soon")~~
4. ~~Battle Pass button (grayed, "Coming Soon")~~
5. Play button
6. Settings?
7. Leaderboard?

**Risk:** A brand new user opens the app for the first time and sees: a popup asking to claim a reward (they don't understand yet), a gold chip counter (they don't know what chips are for), and 2 grayed-out "Coming Soon" buttons. This is overwhelming.

**Recommendation:** For a new user's FIRST session:
- Show ONLY the Play button. Let them play one hand.
- After first hand: introduce chips ("You won 25 chips! 🎉")
- After 3rd hand: show daily reward
- After 5th hand: show leaderboard
- Never show "Coming Soon" features — remove or hide until ready

---

# SECTION 5: DECISIONS NEEDED (Roye)

| # | Decision | Options | Impact |
|---|----------|---------|--------|
| D1 | Sit & Go | A) Remove from UI B) Build it C) Keep grayed | Removing cleans up home screen |
| D2 | Battle Pass | A) Remove from UI B) Build it C) Keep grayed | Same — cleaner home |
| D3 | Tournaments | A) Delete table B) Keep for future C) Build MVP | No visible impact currently |
| D4 | Ad rewards | A) Remove config B) Integrate AdMob C) Keep for later | No visible impact |
| D5 | Push notifications | A) Build token collection B) Skip for now | Critical for engagement |
| D6 | Referral system | A) Build invite flow B) Remove event C) Keep for later | Marketing tool |
| D7 | Heatmap collection | A) Wire client events B) Remove table C) Keep empty | Analytics data |
| D8 | New user flow | A) Gradual exposure (my recommendation) B) Show everything | UX quality |
| D9 | Pro voices | A) Verify they work B) Remove feature C) Keep as-is | Unknown current state |
| D10 | Play of the Day | A) Build home card B) Remove RPC C) Keep for later | Engagement feature |

---

# SECTION 6: WHAT'S ACTUALLY GREAT (9-10/10)

1. **Game engine** (9/10) — 179 hands, 0 crashes, correct evaluations
2. **RLS security** (10/10) — 100% coverage
3. **Crash pipeline** (8/10) — 74 reports auto-classified, 0 real crashes
4. **Economy backend** (8/10) — 36 events, RPCs tested, CHECK constraints
5. **Health monitoring** (9/10) — health_check + dashboard RPCs
6. **WhatsApp QA** (7/10) — Voice reports, auto-analysis, 80 sessions processed
7. **Card sizing** (8/10) — Config-driven, responsive formula, tester feedback addressed

---

# SECTION 7: PRIORITY ACTION PLAN

## P0 — Before ANY new build ships
- [ ] **Visual verify ALL screens** on iPhone 17 Pro Max (Build 266 + new commits)
- [ ] **Visual verify** on a SMALL device (iPhone SE or similar)
- [ ] **Remove Sit & Go + Battle Pass buttons** from home (or get Roye's OK to keep)
- [ ] **Test daily reward popup** — does it appear? Is it dismissible? Does it fit?
- [ ] **Test shop screen** — can you navigate to it? Does the grid look right?
- [ ] **Test chip balance header** — does it overflow on long numbers?
- [ ] **Test win celebration** — does it overlap anything? Is it too much?

## P1 — Next development cycle
- [ ] Build new user gradual exposure flow
- [ ] Wire push token collection
- [ ] Verify pro voices actually play
- [ ] Wire heatmap event collection
- [ ] Decide on Play of the Day UI

## P2 — Future
- [ ] Sit & Go game mode
- [ ] Battle Pass seasons
- [ ] Tournament system
- [ ] Referral tracking
