# 🃏 CAPS POKER — MASTER MEGA & G PROMPTS
### Version 1.0 | March 27, 2026
### Based on: Full Supabase audit, 26 tables, 8 RPCs, 211 bug reports analyzed

---

> **HOW TO USE:**
> - **MEGA PROMPT** = Complete system prompt for building/managing a full feature
> - **G PROMPT** = Focused generator that produces specific content/data
> - Copy-paste as-is into Claude. Replace `{{PLACEHOLDER}}` with real data.

---

## 📑 TABLE OF CONTENTS

1. [CHIP ECONOMY — Reward Loop Design](#1-chip-economy)
2. [BATTLE PASS — Season Progression System](#2-battle-pass)
3. [SIT & GO TOURNAMENTS — Multiplayer System](#3-sit-and-go)
4. [BUG FIX — React Hooks Crash Resolution](#4-bug-fix-hooks)
5. [DAILY REWARDS — Streak & Login System](#5-daily-rewards)
6. [SHARED HANDS — Social Replay System](#6-shared-hands)
7. [WHATSAPP INTEGRATION — Invite & Share Flow](#7-whatsapp-integration)
8. [ACHIEVEMENT SYSTEM — Player Progression](#8-achievements)

---

# 1. CHIP ECONOMY
## MEGA PROMPT — Poker Economy Architect

```
You are CAPS Poker's Economy Designer. Design the chip flow for a single-player poker game.

═══════════════════════════════════════════
DATABASE CONTEXT (Supabase gxrpunvhjcrzqnitbqah)
═══════════════════════════════════════════

chip_config (28 events):
EARN (22):
- GAMEPLAY: hand_won(25), hand_won_big(100), showdown_win(50), bluff_success(75), all_in_win(200), royal_flush(1000), straight_flush(500), four_of_kind(250), full_house(75)
- DAILY: daily_login(50), daily_mission(100), watch_ad(25)
- STREAK: streak_3(100), streak_7(250), streak_30(1000)
- TOURNAMENT: sit_n_go_win(500), sit_n_go_top3(200), tournament_win(2000)
- BONUS: first_game(500), level_up(100), battle_pass_tier(50), referral_joined(300)

SPEND (6):
- buy_table_theme(-500), buy_card_back(-300), buy_avatar(-200), buy_emotes(-150), rebuy_500(-100), tournament_entry(-250)

CURRENT STATS:
- 31 players on leaderboard
- 26,625 total chips, avg 859 per player
- Top player: 2,175 chips, 40 hands, 55% win rate
- 174 total hands played
- 0 purchases, 0 battle pass users
- 0 chip_transactions (economy RPCs not wired to frontend yet)

═══════════════════════════════════════════
TASK: Design the complete chip flow
═══════════════════════════════════════════

1. STARTING BALANCE: How many chips should new players get?
2. HAND REWARDS: Should every hand give chips, or only wins?
3. DIFFICULTY CURVE: How to make chip earning harder over time?
4. SINK BALANCE: What makes players WANT to spend?
5. REBUY MECHANICS: When players go broke, what happens?
6. AD INTEGRATION: watch_ad(25) — is this enough? How often?

LOCKED RULES:
- earn_chips(device_id, event_type) RPC is deployed
- spend_chips(device_id, event_type) RPC is deployed
- get_poker_shop(device_id) RPC shows shop with can_afford check
- Device-based auth (not user accounts) — device_id is the player key
- Starting chips: currently 500 (from user_profiles.chips default)
- Hebrew + English bilingual
- No real money gambling — chips are virtual only
```

---

# 2. BATTLE PASS
## MEGA PROMPT — Season Progression Designer

```
You are CAPS Poker's Battle Pass Designer.

═══════════════════════════════════════════
CURRENT STATE
═══════════════════════════════════════════

battle_pass_progress table:
- user_id, device_id, season (default 'season_1')
- current_xp (default 0), current_tier (default 0)
- is_premium (default false)
- claimed_free_tiers (jsonb []), claimed_premium_tiers (jsonb [])
- daily_missions (jsonb []), weekly_mission (jsonb null)
- 0 users have battle pass progress

═══════════════════════════════════════════
TASK: Design Season 1 Battle Pass
═══════════════════════════════════════════

Design:
1. 30 TIERS (free + premium track)
2. XP required per tier (scaling curve)
3. Rewards per tier (chips, themes, card backs, avatars, emotes)
4. 5 DAILY MISSIONS (rotating, give XP)
5. 1 WEEKLY MISSION (harder, more XP)
6. Premium benefits (2x XP, exclusive rewards)

FORMAT per tier:
{
  "tier": 1-30,
  "xp_required": cumulative XP to reach this tier,
  "free_reward": { "type": "chips|theme|card_back|avatar|emote|none", "value": "...", "chips": 0 },
  "premium_reward": { "type": "...", "value": "...", "chips": 0 }
}

FORMAT per daily mission:
{
  "mission_id": "play_5_hands",
  "description_en": "Play 5 hands",
  "description_he": "שחק 5 ידיים",
  "xp_reward": 50,
  "condition": { "type": "hands_played", "target": 5 }
}

LOCKED RULES:
- Season length: 30 days
- Free track has rewards every 3 tiers
- Premium track has rewards every tier
- Max daily XP from missions: 250
- Weekly mission: 500 XP
- Premium costs 500 chips (not real money)
- XP curve: Tier 1 = 100 XP, Tier 30 = 1000 XP (exponential)
```

---

# 3. SIT & GO TOURNAMENTS
## MEGA PROMPT — Tournament System Architect

```
You are CAPS Poker's Tournament Designer.

═══════════════════════════════════════════
DATABASE TABLES (empty, ready to populate)
═══════════════════════════════════════════

- sit_and_go_sessions: id, status, buy_in, max_players, current_players, prize_pool, started_at, ended_at
- sit_and_go_players: session_id, device_id, chips_start, chips_end, position, eliminated_at
- tournaments: id, name, type, buy_in, status, schedule, max_players

All tables are empty — 0 rows. This feature has never been used.

═══════════════════════════════════════════
TASK: Design the tournament system
═══════════════════════════════════════════

1. SIT & GO (3-6 players, single table, quick):
   - Buy-in tiers: 100, 250, 500 chips
   - Prize distribution: 1st=60%, 2nd=30%, 3rd=10%
   - Blind structure (escalating every 5 hands)
   - Bot fill (if not enough human players after 30 seconds)

2. SCHEDULED TOURNAMENTS (8-16 players, multi-table):
   - Daily freeroll at 20:00 IST (no buy-in, 500 chip prize)
   - Weekend tournament: 250 chip buy-in, 5000 chip prize
   - Special event tournaments (holidays, etc.)

3. MATCHMAKING:
   - How to match players by skill level?
   - What happens when a player disconnects?
   - How do bots play? (basic AI poker strategy)

OUTPUT: Complete SQL schema for tournament management + RPC functions for:
- create_sit_and_go(device_id, buy_in_tier)
- join_sit_and_go(device_id, session_id)
- start_sit_and_go(session_id)
- eliminate_player(session_id, device_id, position)
- end_sit_and_go(session_id)

LOCKED RULES:
- Device-based auth (no user accounts)
- Bot players fill empty seats
- Maximum wait time: 60 seconds (then fill with bots)
- Minimum 3 players to start
- Entry fee deducted via spend_chips() RPC
- Prize awarded via earn_chips() RPC
```

---

# 4. BUG FIX — REACT HOOKS CRASH
## MEGA PROMPT — Critical Bug Resolution

```
You are a senior React Native developer fixing a CRITICAL crash in CAPS Poker.

═══════════════════════════════════════════
THE BUG
═══════════════════════════════════════════

Error: "Rendered fewer hooks than expected. This may be caused by an accidental early return statement."

Stats from crash_reports:
- 12 out of 13 real crashes (92%) are this bug
- Trigger: "deal_pressed" action from Splash screen
- Last screen recorded: "Splash"
- Happens consistently on the Splash → Game transition
- Date range: March 23-25, 2026 (ongoing)

The 1 other crash: "TypeError: Cannot read properties of undefined (reading map)" on Game screen during "deal cards" action.

═══════════════════════════════════════════
ROOT CAUSE
═══════════════════════════════════════════

A React component in the deal/game flow has a CONDITIONAL RETURN before useState or useEffect hooks. React requires hooks to be called in the same order every render.

Example of the bug pattern:
```
// BAD — hooks after conditional return
function GameScreen({ gameData }) {
  if (!gameData) return <LoadingScreen />;  // ← EARLY RETURN
  
  const [cards, setCards] = useState([]);    // ← Hook not called when gameData is null
  useEffect(() => { ... }, []);              // ← This too
  
  return <GameView cards={cards} />;
}
```

Fix pattern:
```
// GOOD — hooks before conditional return
function GameScreen({ gameData }) {
  const [cards, setCards] = useState([]);    // ← Always called
  useEffect(() => { ... }, []);              // ← Always called
  
  if (!gameData) return <LoadingScreen />;   // ← AFTER hooks
  
  return <GameView cards={cards} />;
}
```

═══════════════════════════════════════════
TASK
═══════════════════════════════════════════

Given the codebase at royea-beep/caps-poker:
1. Identify ALL components in the deal/game flow
2. Find every conditional return that appears before hooks
3. Fix by moving hooks above conditional returns
4. Add null-safe guards: (data ?? []).map(...)
5. Add error boundary component to catch future React crashes gracefully

LOCKED RULES:
- Expo/React Native project
- Build version 1.9.4 (build 178)
- Device-based authentication (device_id, not user auth)
- Must not break existing game state
- Test on both old and new iPhone
```

---

# 5. DAILY REWARDS
## G PROMPT — Streak Reward Content

```
Generate a 30-day daily reward calendar for CAPS Poker.

CURRENT: daily_rewards table exists (0 rows). Fields: user_id, device_id, day_number, streak, claimed_at.

RULES:
- Day 1-7: Small rewards (25-50 chips)
- Day 8-14: Medium rewards (50-100 chips + XP)
- Day 15-21: Good rewards (100-200 chips + cosmetic items)
- Day 22-30: Great rewards (200-500 chips + rare items)
- Day 7, 14, 21, 30 are MILESTONE days with bonus rewards
- Missing a day resets streak to day 1
- Hebrew + English descriptions

FORMAT per day:
{
  "day": 1-30,
  "chips": integer,
  "xp": integer,
  "bonus_item": null | "card_back_sunset" | "emote_bluff_face" | etc.,
  "is_milestone": boolean,
  "description_en": "Day 1: Welcome chips!",
  "description_he": "יום 1: צ׳יפים ראשונים!"
}
```

---

# 6. SHARED HANDS
## G PROMPT — Remarkable Hand Detector

```
Design an algorithm to detect "remarkable hands" worth sharing in CAPS Poker.

CURRENT: shared_hands table has 20 entries.

A hand is remarkable if:
1. ROYAL FLUSH or STRAIGHT FLUSH (always share)
2. FOUR OF A KIND (always share)
3. POT > 500 chips (big pot drama)
4. ALL-IN + WIN (dramatic moment)
5. BLUFF SUCCESS on river (skill showcase)
6. COMEBACK (was losing 3:1 and won)
7. PERFECT READ (folded what would have lost)

For each remarkable hand, generate:
{
  "hand_id": "uuid",
  "remarkable_type": "royal_flush|big_pot|bluff|comeback|...",
  "headline_en": "Royal Flush! The rarest hand in poker!",
  "headline_he": "רויאל פלאש! היד הנדירה ביותר!",
  "share_text": "Pre-formatted WhatsApp/social share message",
  "rarity_score": 1-10 (10 = once in a lifetime)
}

OUTPUT: SQL function detect_remarkable_hand(hand_data JSONB) RETURNS JSON
```

---

# 7. WHATSAPP INTEGRATION
## MEGA PROMPT — Social Sharing Flow

```
Design CAPS Poker's WhatsApp integration system.

CONTEXT:
- whatsapp_sessions table: 70 sessions (active feature!)
- Israeli market — WhatsApp is the primary social platform
- Bug report requested: "Add WhatsApp share button for invite code"
- WINGMAN's ghost_wing_links have 57% conversion via WhatsApp

TASK: Design 5 WhatsApp share flows:

1. INVITE FRIEND: "Join me on CAPS! Use code {{code}} for 500 bonus chips"
2. SHARE HAND: Share a remarkable hand result with replay link
3. TOURNAMENT INVITE: "I'm in a Sit & Go! Join before it starts"
4. CHALLENGE FRIEND: "Beat my score this week!" with leaderboard position
5. CELEBRATE WIN: "Just hit a Royal Flush! 🃏" with screenshot

Each flow needs:
- Deep link URL structure
- WhatsApp message template (Hebrew + English)
- Backend tracking (click → install → first game funnel)
- Referral reward trigger (earn_chips on successful invite)

LOCKED RULES:
- Use WhatsApp's wa.me/ URL scheme
- Deep links: https://caps-poker.vercel.app/invite/{{token}}
- Track via share_links table (same as 9Soccer pattern)
- Must work on both iOS and Android
- Share token = 16 character hex
```

---

# 8. ACHIEVEMENT SYSTEM
## G PROMPT — Achievement Content Generator

```
Generate 30 achievements for CAPS Poker.

TABLE: achievements (0 rows). This feature is empty.

CATEGORIES:
1. HANDS (10 achievements): Based on hand types played
2. WINS (5): Based on winning streaks and totals
3. CHIPS (5): Based on chip milestones
4. SOCIAL (5): Based on sharing and inviting
5. MASTERY (5): Based on skill indicators

FORMAT per achievement:
{
  "key": "first_royal_flush",
  "name_en": "Royal Treatment",
  "name_he": "יחס מלכותי",
  "description_en": "Get your first Royal Flush",
  "description_he": "קבל רויאל פלאש ראשון",
  "category": "hands|wins|chips|social|mastery",
  "rarity": "common|uncommon|rare|epic|legendary",
  "icon": "emoji or icon name",
  "condition": { "type": "hand_type", "value": "royal_flush", "count": 1 },
  "chips_reward": 500,
  "xp_reward": 100
}

RARITY DISTRIBUTION:
- Common (10): Easy, most players get these in first session
- Uncommon (8): Takes 5-10 sessions
- Rare (6): Takes 20+ sessions or specific skill
- Epic (4): Takes 50+ sessions or rare events
- Legendary (2): Near impossible (e.g., 3 royal flushes ever)

LOCKED RULES:
- All bilingual (EN + HE)
- Achievements must be earnable in single-player mode
- Reward chips via earn_chips() RPC
- No duplicate conditions
- Progress trackable from leaderboard data
```
