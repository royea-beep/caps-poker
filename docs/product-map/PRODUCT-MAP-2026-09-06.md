# CAPS POKER — THE PRODUCT MAP — 2026-09-06

The reference the explainers, the landing page and any studio material read from. Every number
below was read from production or from source on 2026-09-06, not recalled.

**The rule this document exists to enforce: a dormant feature is never described as live.** The
studio material went stale because a previous map showed built-but-dark features as shipped.

---

## THE NUMBERS THAT SET THE CONTEXT

| | |
|---|---|
| Devices that have ever appeared | 547 |
| Hands in `hand_history` | 97 |
| Multiplayer rooms ever created | 9 |
| Multiplayer rooms that ever reached `finished` | **0** |
| `mp_game_ended` events | 55 |
| Purchases, ever | **0** |
| Bug reports | 252 |
| Crash rows | 350 |
| Referral links minted | 2,043 |

Two of those decide how the rest of this document reads. **No multiplayer room has ever finished**,
and **nothing has ever been bought.**

---

## 1 — EVERY SCREEN

R = reachable by tapping · U = URL only, no UI path · G = flag-gated

### The three tabs

| Route | Purpose | What a player can do | Reached by | |
|---|---|---|---|---|
| `/` | Home | Start a practice hand, open Play Online, claim the daily bonus, open the side menu, file a bug | The app opens here | R |
| `/play` | Play hub | Choose a table type and enter the lobby | Tab bar | R |
| `/profile` | Profile | See name, chips, level, stats; edit the display name; reach settings | Tab bar | R |

### Reached from Home, the side menu, or another screen

| Route | Purpose | What a player can do | Reached by | |
|---|---|---|---|---|
| `/game` | The hand | Place 4 cards per board, Auto-Place, Confirm, Ready | Home practice button, Play, Play-again | R |
| `/results` | Hand result | See the per-board tally and net chips, play again, view the hand | End of a hand | R |
| `/lobby` | Table list | See open tables, join one, start a private table | Play tab | R |
| `/lobby/private` | Private table | Create or join by code | Lobby | R |
| `/lobby/table` | A seated table | Wait for players, leave | Lobby join | R |
| `/multiplayer-game` | A live MP hand | Same placement flow against humans | Lobby, when a table fills | R |
| `/hand-history` | Past hands | Browse hands played, open one | Profile, results | R |
| `/replay` | One hand replayed | Step through a stored hand | Hand history | R |
| `/settings` | Settings | 23 controls: language, cards, sound, vibration, **Show tips**, bug report, tutorial replay, account deletion | Profile | R |
| `/shop` | Chip shop | Look at chip packs | Home, side menu | R **G** |
| `/chip-store` | Chip packs | Same, alternate entry | Shop | R **G** |
| `/leaderboard` | Ladder | See ranked players | Home, profile | R |
| `/achievements` | Achievements | See what has been unlocked | Profile, side menu | R |
| `/stats` | Statistics | Aggregates over hands played | Profile | R |
| `/rank` | Rank detail | ELO and progress | Profile | R |
| `/referral` | Invite | Copy or type a referral code | Side menu | R |
| `/invite/[code]` | Accept an invite | Redeem a code | A shared link | R |
| `/coaching` | Post-hand coaching | Read an analysis of a played hand | Side menu | R |
| `/friends` | Friends | Add and see friends | Home, side menu — **not on the tab bar** | R |
| `/cups` | Cups | Tournament-style events | Home — **not on the tab bar** | R |
| `/battle-pass` | Battle pass | Reward track | Side menu | R **G** |
| `/club/[code]` | Company league | A private club table | A club link | R **G** |
| `/gameover` | Out of chips | Take the free refill | Zero chips | R |
| `/orientation-pick` | Layout choice | Pick a board arrangement | Game | R |
| `/theme-pick` | Visual theme | Classic or FIVE-O | Settings | R |
| `/spectate` | Watch a table | Observe a hand | Lobby | R |
| `/missions` | Daily missions | — | **No UI path** | **U** |
| `/heatmap` | Tap heatmap | Developer telemetry view | **No UI path** | **U** |
| `/simulate` | Simulation | Run hands headlessly | Settings, dev-unlocked | **U/G** |
| `/debug` | Debug | Internal state | Settings, dev-unlocked | **U/G** |

`friends` and `cups` are registered `href: null` in `app/(tabs)/_layout.tsx` — deliberately off the
tab bar since `eaf9201`, reached from Home and the side menu. That was a de-duplication, not a
regression; do not "restore" them.

---

## 2 — EVERY FEATURE, HONESTLY

### Working — a player can do this today

- **The hand.** 2P = 4 boards, 3P = 3, 4P = 2, four cards per board, one 52-card deck. Board count
  from `getBoardCount()`, never a literal.
- **Practice vs bots.** Zero real chips, no buy-in. The Home button says practice and is practice.
- **The economy.** A new device is granted 2,000 chips, ledgered. Daily bonus 150. Emergency refill
  200, once a day. Match cost enabled, pot per board 25.
- **Onboarding.** A 3-step overlay plus six in-hand tips and a board hint, each of which now stays
  dismissed per device once seen — and a **Show tips** switch in Settings, ON by default.
- **Hand history and replay.** 97 stored hands.
- **Bug reporting.** Tester form → `bug_reports` → AI triage → Telegram. A failed triage is now
  recorded as `triage_failed` rather than a silent empty success.
- **Leaderboard, achievements, stats, rank, coaching, referral, friends.**
- **Two languages.** English is the default and the primary language; Hebrew is an addition.
- **Two visual themes.** Classic green felt, FIVE-O navy.

### Dormant — built, present in the code, NOT available to a player

| Feature | State | Why |
|---|---|---|
| **Payments / IAP** | **OFF** | `app_config.iap_enabled = false`. **0 purchases, ever.** The shop renders; nothing can be bought. |
| **Battle pass** | **OFF** | `app_config.battle_pass_enabled = false`. Route exists, entry is in the side menu, content is dark. |
| **Missions** | **Dark** | `/missions` has no UI path at all. No `missions` table in production. |
| **`KILL_Board`** | **On, i.e. the board pulse is dead** | A kill switch that is deliberately engaged. Two paint values are calibrated against it. |
| **Multiplayer** | **Never completed a hand** | 9 rooms, **0 finished**, 0 ever reached `playing`. The lobby has never seated two strangers. 55 `mp_game_ended` events came from clients, not from a finished room. |
| **Solo ELO** | **No longer moves the ladder** | Deliberate since 2026-09-03. Only the `resolve-hand` service-role writer moves `elo`. Practice never did. |
| **Ad rewards, wallet sync** | OFF | `adRewardEnabled: false`, `walletSyncEnabled: false`. |
| **`github_issue_url`** | **Retired** | NULL in all 252 bug rows; nothing has ever written it. |

### Retired — removed, do not reinstate

- The five-tab bar (cut to three on `eaf9201`).
- The static Tutorial and the separate OnboardingOverlay (one onboarding remains).
- The sign-in nudge banner, the daily-reward popup, the streak popup, the Weekly Recap modal.
- Nineteen Settings controls (42 → 23), including reveal speed, starting chips, hand sort.

---

## 3 — THE FIVE FLOWS

```
FIRST SESSION
  open app ─► splash (green felt, gilded wordmark)
            ─► Home ─► onboarding overlay: 3 steps, Skip or Continue
            ─► practice hand ─► six guided tips, dismissed one by one, kept dismissed
            ─► reveal ─► results ─► Home
  grant: 2,000 chips, ledgered, on first appearance

A SOLO HAND  (practice — zero chips — or quick_poker — real chips)
  Home ─► /game ─► deal: 4 cards per board, N boards from getBoardCount(players)
       ─► place / Auto-Place ─► Confirm ─► READY
       ─► reveal, board by board ─► /results: per-board tally, net chips
       ─► hand_history row (client-written; moves NO ladder)
       ─► Play again ─► /game

A MULTIPLAYER HAND   ⚠️ NEVER OBSERVED END TO END
  Play ─► /lobby ─► join a table ─► /lobby/table ─► wait for players
       ─► /multiplayer-game ─► same placement flow
       ─► resolve-hand (service role) settles chips and moves ELO
       ─► /results
  REALITY: 9 rooms exist, 0 have ever reached `playing` or `finished`.
  Everything right of "wait for players" is untested against two real humans.

A PURCHASE   ⚠️ FLAG OFF — CANNOT COMPLETE
  Home / side menu ─► /shop ─► a chip pack ─► [iap_enabled = false] ─► STOP
  0 purchases have ever been made. The shop is a display surface today.

EARNING AND SPENDING CHIPS
  IN   first-appearance grant 2,000 · daily bonus 150 · emergency refill 200/day
       · referral redemption · hand winnings (zero-sum against bots)
  OUT  match cost per hand (pot per board 25 x boards)
  Every credit and debit writes chip_transactions. Ledger gap: 0.
  Purchases would be a fifth source; there have been none.
```

---

## 4 — CURRENT SCREENSHOTS

Committed under `docs/dismiss-tips/` and `docs/splash-proof/` from this build, plus the per-screen
explainer clips in `docs/explainers/`. Earlier screenshot sets predate 2026-09-03 and show an app
that no longer exists; they are not referenced here.
