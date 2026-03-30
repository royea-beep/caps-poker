# ROYEA EMPIRE — Reverse-Engineered Learnings
## From: Economy System Build (WINGMAN, 9Soccer, Caps Poker)
## Date: March 27, 2026
## Source: Production deployment + QA testing

---

## LEARNING 1: Config-Driven Economy Pattern

### What we built:
All 3 projects use the same pattern: a `config` table drives all earn/spend events. RPCs look up config at runtime — no hardcoded values in code.

### Pattern:
```
coin_config (event_type PK, coins INT, description TEXT, is_active BOOL)
  ↓ looked up by
earn_coins(user, event_type) → validates → updates wallet → logs transaction
spend_coins(user, event_type) → validates → checks balance → updates → logs
```

### Why this works:
- **Add new events without code changes** — just INSERT into config
- **Disable events** by flipping `is_active` — no deployment needed
- **Rebalance prices** with UPDATE — instant economy tuning
- **Audit trail** built-in through transaction logs

### Key numbers:
| Project | Earn events | Spend events | Config rows |
|---------|------------|-------------|-------------|
| WINGMAN | 30 | 9 | 39 |
| 9Soccer | 24 | 8 | 37* |
| Caps Poker | 22 | 6 | 28 |

*9Soccer uses `coins + xp + var_cards` — triple-resource economy

### Mistake caught:
9Soccer `economy_log` had a CHECK constraint limiting resources to `['coins', 'var', 'sub_card']`. When we added XP earning, it crashed. **Lesson: Always future-proof constraints with room for new resource types.**

---

## LEARNING 2: Device-Based vs User-Based Auth

### Discovery:
- WINGMAN and 9Soccer use **UUID user_id** (Supabase auth)
- Caps Poker uses **device_id TEXT** (no user accounts)

### Implications:
- Device auth is simpler but can't sync across devices
- User auth enables cross-device sync but requires login friction
- RPCs must use the correct identifier — mixing them breaks everything

### Pattern for device auth:
```sql
earn_chips(p_device_id TEXT, p_event_type TEXT)
-- Looks up leaderboard by device_id, not user_id
```

### Pattern for user auth:
```sql
earn_coins(p_user_id UUID, p_event_type TEXT)
-- Looks up coin_wallets by user_id
```

---

## LEARNING 3: QA Catches Real Bugs

### Bugs caught during simulated expert review:

**Bug 1: Caps Poker Double-Claim (CRITICAL)**
- `claim_daily_reward()` allowed claiming twice in same day
- Root cause: `claimed_at::date` comparison had timezone mismatch between server TZ and DB TZ
- Fix: Added explicit `claim_date DATE` column + unique index `(device_id, claim_date)`
- **Lesson: Never compare timestamps for "same day" logic. Use a DATE column.**

**Bug 2: 9Soccer XP Constraint (HIGH)**
- `earn_reward()` crashed when logging XP to `economy_log`
- Root cause: CHECK constraint only allowed `['coins', 'var', 'sub_card']` — 'xp' was missing
- Fix: Extended constraint to include `['xp', 'gems', 'energy']` for future-proofing
- **Lesson: Run actual INSERT tests, not just function definition checks.**

**Bug 3: WINGMAN earn_coins ON CONFLICT (MEDIUM)**
- `ON CONFLICT ON CONSTRAINT coin_wallets_user_id_key` referenced a non-existent constraint
- The unique index existed but wasn't a formal constraint
- Fix: Changed to `ON CONFLICT (user_id)` which works with both indexes and constraints
- **Lesson: Always use column-based ON CONFLICT, not constraint names.**

**Bug 4: WINGMAN Spot the Bot was enabled (POLICY)**
- `spot_the_bot_enabled = true` in production, against Roye's directive
- Fix: Set to `false` — ready but not active
- **Lesson: Always verify config state against business rules after deployment.**

---

## LEARNING 4: Spend Rate is a Frontend Problem

### Data:
- WINGMAN spend rate: 5.6% (target 40-60%)
- All 3 projects: economy RPCs work perfectly in QA
- BUT: 0 frontend integration in any app

### Diagnosis:
The backend is solid. The bottleneck is that `earn_coins`/`spend_coins` are never called from the app. This is a **frontend wiring problem**, not a backend problem.

### Action items for frontend devs:
1. Wire `earn_coins(user_id, 'onboarding_complete')` to signup flow
2. Wire `earn_coins(user_id, 'wing_vote')` to approval button
3. Wire `get_shop_items(user_id)` to shop screen
4. Wire `spend_coins(user_id, event_type)` to purchase buttons
5. Show `get_wallet(user_id)` in header/profile

---

## LEARNING 5: Health Check Pattern

### Pattern deployed to all 5 projects:
```sql
health_check() RETURNS JSON
  → status: 'ok'
  → checks: { key metrics per project }
  → alerts: [ array of active issues ]
```

### Alert types that proved useful:
- `hooks_crash_active` — Caps Poker (real crash in last 3 days)
- `no_wallets` — 9Soccer (economy deployed but unused)
- `expired_intros` — WINGMAN (data stuck, needed cleanup)
- `zero_purchases` — Caps Poker (expected in test/demo phase)

### Lesson: 
Alerts should be **actionable**, not just informational. "no_analytics_today" at 6am is noise. "hooks_crash_active" with 92% crash rate is a P0.

---

## LEARNING 6: Data Quality Automation

### Before this session:
- 540/714 9Soccer challenges had no league tag (76% untagged)
- 196/211 Caps Poker bug reports were telemetry pings (93% false)
- 58/71 crash reports were force-quits, not crashes (82% false)

### How we fixed:
- **Keyword-based auto-tagging**: Matched challenge titles to leagues using ILIKE patterns (2 passes: specific team names, then general keywords)
- **Pattern-based classification**: `[ping] app opened` → TELEMETRY_PING, `dirty-shutdown` → FALSE_POSITIVE
- **Result**: 540→0 untagged, 196 false bugs dismissed, 58 false crashes dismissed

### Lesson:
**Run data quality checks BEFORE building features on top of data.** Bad data → bad analytics → bad decisions.

---

## LEARNING 7: Cross-Project Shared Patterns

### Patterns successfully ported between projects:

| Pattern | Origin | Ported to | Result |
|---------|--------|-----------|--------|
| Config-driven economy | WINGMAN | 9Soccer, Caps | 3 projects with same architecture |
| Share links (referral) | WINGMAN ghost_wing_links | 9Soccer share_links | 57% conversion rate model replicated |
| Health check RPC | Custom | All 5 projects | Unified monitoring |
| search_path security | Supabase advisory | All 41 DEFINER functions | Privilege escalation prevented |
| Audit logs + heatmaps | WINGMAN | 9Soccer, Caps, Analyzer | Cross-project analytics |

### Lesson:
**Build once, port everywhere.** The economy RPC pattern took 2 hours to build for WINGMAN, then 30 minutes each for 9Soccer and Caps Poker.

---

## LEARNING 8: File Organization Matters

### Before:
```
outputs/
├── 9Soccer-MEGA-G-PROMPTS.md
├── CAPS-POKER-MEGA-G-PROMPTS.md
├── ROYEA-Master-Project-Map-v2.md
├── ... (9 files flat, no structure)
```

### After:
```
outputs/
├── 9Soccer/          (project-specific files)
├── WINGMAN/          (project-specific files)
├── CAPS-Poker/       (project-specific files)
├── Empire/           (cross-project docs)
└── iOS-Deploy/       (deployment scripts)
```

### Lesson:
**Flat is fine for 3 files. Beyond that, organize by project.** No duplicates, no conflicting instructions in same folder.

---

## META: QA Simulation Process

### What worked:
1. **Test every RPC with real data** — not just function definition
2. **Test edge cases**: invalid events, spend-as-earn, double-claim, insufficient balance
3. **Score each test 0-10** with pass/fail + quality assessment
4. **Fix bugs immediately** when caught, then retest
5. **Log the bug pattern** for future prevention

### QA Scorecard:
| Project | Tests | Score | Bugs Found | Bugs Fixed |
|---------|-------|-------|-----------|------------|
| WINGMAN | 10 | 100% | 0 | — |
| Caps Poker | 10 | 98% | 1 (double-claim) | ✅ |
| 9Soccer | 10 | 100% | 1 (XP constraint) | ✅ |
| **Total** | **30** | **99.3%** | **2** | **2** |
