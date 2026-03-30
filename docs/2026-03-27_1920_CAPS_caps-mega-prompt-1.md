# 🃏 CAPS - MEGA PROMPT
> Complete guide for CAPS Card Game development and maintenance
> Last Updated: March 27, 2026

---

## 📋 PROJECT INFO

| Field | Value |
|-------|-------|
| **App Store Name** | CAPS - Card game |
| **Apple ID** | 6760429619 |
| **Supabase ID** | gxrpunvhjcrzqnitbqah |
| **GitHub Repo** | royea-beep/caps-poker |
| **Current Build** | 266 |
| **Status** | ✅ 0 crashes, 0 bugs |

---

## 🏗️ TECH STACK

- **Framework:** React Native + Expo SDK 55
- **State:** Zustand
- **Animations:** Reanimated v3
- **Language:** TypeScript
- **Backend:** Supabase (PostgreSQL + Edge Functions)
- **Notifications:** ntfy + WhatsApp (VAMOS)

---

## 💰 ECONOMY SYSTEM

### chip_config (28 events)
```sql
SELECT event_type, chips, is_active FROM chip_config WHERE is_active;
```

### Core RPCs
- `earn_chips(p_user_id, p_event_type, p_reference_id)` - Award chips
- `spend_chips(p_user_id, p_event_type, p_reference_id)` - Deduct chips
- `claim_daily_reward(p_user_id)` - Daily bonus with streak
- `get_poker_shop()` - Shop items listing

### Daily Reward System
- Uses `daily_rewards` table with DATE column
- UNIQUE constraint on (user_id, reward_date)
- Prevents double-claim via timezone mismatch

---

## 🔧 EDGE FUNCTIONS

| Function | Version | Purpose |
|----------|---------|---------|
| `whatsapp-bot-handler` | v54 | VAMOS QA pipeline |
| `auto-fix-crashes` | v9 | Claude auto-fix (serves all projects) |
| `crash-analyzer` | v5 | Deep analysis + GitHub Actions |
| `analyze-bug-report` | v5 | AI bug triage |
| `sync-bugs-to-drive` | v12 | Google Drive backup |
| `log-error` | v10 | Error logging |

---

## 🐛 KNOWN CRASH PATTERNS

### Fixed Patterns (for reference)
1. **Hooks ordering violation** - Race condition with .map on undefined
   - Fix: Null guards in Board.tsx, PlayerHand.tsx
   - ErrorBoundary resetKey counter

2. **Reanimated worklet crash** - withTiming on unmounted component
   - Fix: cancelAnimation on cleanup

3. **useAnimatedStyle undefined** - borderColor: undefined crashes
   - Fix: Always provide fallback values

### app_config Flags
```sql
SELECT key, value FROM app_config WHERE key = 'hooks_crash_known';
-- Should be 'false' now that crash is fixed
```

---

## 🔄 PIPELINES

### VAMOS WhatsApp Pipeline
1. Tester sends bug via WhatsApp
2. `whatsapp-bot-handler` receives and parses
3. Creates `bug_reports` entry
4. Triggers `analyze-bug-report`
5. Sends ntfy notification
6. If crash: triggers `auto-fix-crashes`
7. Updates tester via WhatsApp

### Auto-Fix Pipeline
1. `auto-fix-crashes` runs (scheduled or triggered)
2. Fetches crash_reports with status='new'
3. Extracts file paths from stack trace
4. Fetches source files from GitHub
5. Calls Claude for fix
6. Commits fix to GitHub
7. Updates crash_reports status

---

## 📊 HEALTH CHECK

```sql
SELECT * FROM health_check();
```

Returns:
- `players`: leaderboard count, total chips, avg chips, total hands
- `economy`: config events, transactions
- `quality`: open bugs, real crashes, false crashes, debug sessions
- `alerts`: hooks_crash_active, zero_purchases

---

## 🎯 G-PROMPTs

### G-PROMPT: CAPS Health Audit
```
1. Run SELECT * FROM health_check();
2. Check crash_reports WHERE status = 'new'
3. Check bug_reports WHERE status = 'open'
4. Verify chip_config has 28 active events
5. Check leaderboard for anomalies
```

### G-PROMPT: Deploy CAPS Fix
```
1. Identify the bug/crash
2. Fetch relevant source files
3. Create fix with proper null guards
4. Test on all screen sizes
5. Commit to GitHub
6. Update crash_reports/bug_reports status
```

### G-PROMPT: Economy Audit
```
1. SELECT COUNT(*) FROM chip_config WHERE is_active;
2. SELECT SUM(total_chips) FROM leaderboard;
3. Check for negative balances
4. Review daily_rewards for double claims
5. Audit chip_transactions (7 days)
```

---

## 📁 KEY FILES

```
app/
├── index.tsx          # Splash screen
├── game.tsx           # Main game logic
├── results.tsx        # End game results
├── settings.tsx       # Settings
└── _layout.tsx        # Navigation

components/
├── Board.tsx          # Game board (null guards added)
├── Card.tsx           # Card component
├── PlayerHand.tsx     # Player cards (null guards added)
├── CompleteOverlay.tsx # Game complete overlay
└── ErrorBoundary.tsx  # Error handling (resetKey added)
```

---

## ⚠️ CRITICAL REMINDERS

1. **hideCornerLabels** - Cards should not show corner labels (readability fix)
2. **Button minHeight** - Bottom buttons need minHeight: 52
3. **WhatsApp share** - Green button "💬 שתף בווטסאפ"
4. **X button** - Always router.replace('/'), not router.back()
5. **ErrorBoundary** - Uses resetKey counter to force remount

---

*CAPS is the most advanced project with full VAMOS pipeline integration.*
