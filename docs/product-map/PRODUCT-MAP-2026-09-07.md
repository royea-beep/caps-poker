# CAPS POKER — THE PRODUCT MAP — 2026-09-07 (build 515)

The reference the explainers, the landing page and any studio material read from. Every number was
read from production or from source today, not recalled. Supersedes `PRODUCT-MAP-2026-09-06.md`.

**The rule this document exists to enforce: a dormant feature is never described as live.**

⚠️ **And it caught the previous version of itself.** Three claims in yesterday's map about the
battle pass were wrong, in the direction the rule forbids. They are corrected in §2 and the
evidence is quoted.

---

## THE NUMBERS THAT SET THE CONTEXT

| | Was (2026-09-06) | **Now** |
|---|---|---|
| Devices with a leaderboard row | 547 | **393** |
| Devices that have ever played | — | **25** |
| Hands in `hand_history` | 97 | **78** |
| Device bindings | — | **7** |
| Chip float | — | **789,530** |
| Ledger gap | 0 | **0** |
| Rooms that ever reached `playing` | 0 | **0** |
| Purchases, ever | 0 | **0** |
| Harness devices remaining | 57 | **0** |
| Simulator devices remaining | 113 | **0** |
| TestFlight public link | on, serving expired builds | **disabled** |

The device and hand counts fell because 58 harness devices and 112 simulators were purged on
2026-09-07. **The 25 who have played did not move**, because no purged device had ever played.

Two facts still decide how the rest of this reads. **No multiplayer room has ever reached
`playing`**, and **nothing has ever been bought.**

Backend: **73 tables · 198 functions · 12 views · 14 Edge Functions.**

---

## 1 — EVERY SCREEN

**33 routes, derived from `app/` by `tools/product-map-shots.mjs`, not typed into this document.**
A hand-written route list is how a map goes stale; this one regenerates.

R = reachable by tapping · U = URL only · **→** = the URL redirects somewhere else

### The three tabs

| Route | Purpose | What a player can do | Reached by | |
|---|---|---|---|---|
| `/` | Home | Practice hand, Play Online, claim the daily bonus, side menu, bug report | The app opens here | R |
| `/play` | Play hub | Choose Single Player or a multiplayer table type | Tab bar | R |
| `/profile` | Profile | Hands, win rate, streak, chips; reach achievements, history, stats, cups, settings | Tab bar | R |

### Off the tab bar, reachable

| Route | Purpose | What a player can do | Reached by | |
|---|---|---|---|---|
| `/game` | The hand | Place 4 cards per board, Auto-Place, Confirm, Ready | Home, Play, Play-again | R |
| `/results` | Hand result | Per-board tally, net chips, play again, hand details | End of a hand | R |
| `/lobby` | Table list | Heads-up / 3-player / 4-player tables | Play tab | R |
| `/lobby/private` | Private table | Create or join by code | Lobby | R |
| `/lobby/table` | A seated table | Wait for players, leave | Lobby join | R |
| `/multiplayer-game` | A live MP hand | Same placement flow against humans | Lobby, when a table fills | R |
| `/hand-history` | Past hands | Browse and open a hand | Profile, results | R |
| `/replay` | One hand replayed | Step through a stored hand | Hand history | R |
| `/settings` | Settings | Visual style, language, sound, **Show tips**, bug report, tutorial replay, account deletion | Profile | R |
| `/shop` | Chip shop | Look. Nothing is buyable | Chip count, side menu | R |
| `/leaderboard` | Ladder | Ranked players by chips and win rate | Home, profile | R |
| `/achievements` | Achievements | See what is unlocked | Profile, side menu | R |
| `/stats` | Statistics | Aggregates, after 5 hands | Profile | R |
| `/rank` | Rank detail | ELO and progress | Profile | R |
| `/referral` | Invite | Copy a code. 300 chips to you, 100 to them | Side menu | R |
| `/invite/[code]` | Accept an invite | Redeem a code | A shared link | R |
| `/coaching` | Coaching | Read tips from played hands | Side menu | R |
| `/friends` | **Clubs** | Create a club or join one by code | Home, side menu — **not on the tab bar** | R |
| `/cups` | Cups | Cup events | Home — **not on the tab bar** | R |
| `/club/[code]` | A club | Club code, share, club tables | A club link | R |
| `/gameover` | Out of chips | Take the free refill | Zero chips | R |
| `/orientation-pick` | Layout choice | Portrait or landscape | Game | R |
| `/theme-pick` | Visual theme | Classic or FIVE-O | Settings | R |
| `/spectate` | Watch a table | Observe, with a room code | Lobby | R |

⚠️ **`/friends` is a CLUBS screen, not a friends list.** It reads "CLUBS · Your circle · play only
your friends" and offers Create a club / Join a club. The previous map called it "Add and see
friends", which is not what a player finds there.

`friends` and `cups` are registered `href: null` in `app/(tabs)/_layout.tsx` — deliberately off the
tab bar since `eaf9201`, reached from Home and the side menu. A de-duplication, not a regression.

### URL-only, and what actually happens if you type them

| Route | What the URL really does | |
|---|---|---|
| `/missions` | **Redirects to Home.** `<Redirect href="/">` | **→** |
| `/heatmap` | **Redirects to Home.** `<Redirect href="/">` | **→** |
| `/chip-store` | **Redirects to `/shop`.** | **→** |
| `/simulate` | **Redirects to Home, always** — `router.replace('/')` at line 33 | **→** |
| `/debug` | **Redirects to Home unless dev-unlocked** — `if (!allowed) router.replace('/')` | **→ U** |
| `/battle-pass` | **Redirects to Home** as of 2026-09-07. It used to render in full. See §2 | **→** |

⚠️ **"No UI path" was the wrong description and it mattered.** These are not dead routes a typed
URL falls through; four of them are deliberate **redirects**, so a tester who types the URL always
lands somewhere real. The source says so: *"Retired the /missions way — a Redirect, not a delete —
so a tester who types the URL lands on Home."*

### What a cold visit shows, recorded rather than hidden

Several screens need state a cold visit does not have. Captured as they actually appear:

| Route | Cold-visit state |
|---|---|
| `/results` | "This hand is no longer available." |
| `/replay` | "No hand selected — open a hand from your history" |
| `/lobby/table` | "Online multiplayer is unavailable right now." |
| `/spectate` | "⚠️ No room code provided" |
| `/invite/DEMO` | "This invite link does not contain a valid code." |
| `/game` | Defaults to 2 players: **"PLACE 16 CARDS"** — 4 boards × 4 cards |

---

## 2 — EVERY FEATURE, HONESTLY

### Working — a player can do this today

- **The hand.** 2P = 4 boards, 3P = 3, 4P = 2. Four cards per board, one 52-card deck. Board count
  from `getBoardCount()`, never a literal. The cold `/game` capture confirms it: 2 players, 16 cards.
- **Practice vs bots.** Zero real chips. The Home button says practice and is practice.
- **The economy.** 2,000-chip grant on first appearance, ledgered. Daily bonus 150. Emergency
  refill 200, once a day. Pot per board 25. Gap 0 across all 393 rows.
- **Onboarding.** A 3-step overlay, six in-hand tips that stay dismissed, and a **Show tips**
  switch in Settings.
- **Hand history and replay.** 78 stored hands. Practice hands are not written to the local store.
- **Bug reporting.** Form → `bug_reports` → AI triage → Telegram, with a loud failure path.
- **Leaderboard, achievements, stats, rank, coaching, referral, clubs, cups.**
- **Two languages.** English default and primary; Hebrew an addition.
- **Two visual themes.** Classic green felt, FIVE-O navy.

### ⚠️ Dormant — and the battle pass entry is a correction

| Feature | State | Evidence |
|---|---|---|
| **Payments / IAP** | **OFF** | `iap_enabled = false`, `web_payments_enabled = false`. **0 purchases, ever.** The shop renders "Shop is empty right now." |
| **Battle pass** | ⚠️ **CLOSED 2026-09-07 — the route redirects to Home** | See below |
| **Missions** | **Retired to a redirect** | `/missions` redirects to Home. Its content survives only as the "Daily Missions" block inside the battle-pass screen, which is now also behind a redirect. ⚠️ That block is a separate local pool from the retired `daily_missions` table — do not conflate them. |
| **`KILL_Board`** | **Engaged — the board pulse is dead** | A kill switch deliberately on. |
| **Multiplayer** | **Never reached `playing`** | 0 rooms, ever. The lobby has never seated two strangers. |
| **Solo ELO** | **No longer moves the ladder** | Since 2026-09-03 only the `resolve-hand` service-role writer moves `elo`. |
| **TestFlight public link** | **DISABLED 2026-09-07** | Apple read-back: `publicLinkEnabled false`. Every build behind it had expired. |
| **Ad rewards, wallet sync** | OFF | Client flags off. |

⚠️ **THE BATTLE PASS — YESTERDAY'S MAP WAS WRONG THREE WAYS.** It said: *"OFF.
`app_config.battle_pass_enabled = false`. Route exists, entry is in the side menu, content is
dark."* Checked today against source and a live capture:

1. **The flag gates nothing.** `battle_pass_enabled = false` has stood since 2026-03-27, and **no
   client code reads it.** `components/SideMenu.tsx:174` already says so in a comment.
2. **There is no side-menu entry.** The menu item is **commented out** at `SideMenu.tsx:188`.
   Nothing in the app links to `/battle-pass`.
3. **The content is not dark.** Typing the URL renders a complete screen: *"Season 1 — First Deal
   · 55d 23h remaining"*, a tier track, *"★ UNLOCK PREMIUM — 5,000 chips"*, locked upcoming
   rewards, and Daily Missions with XP values.

So the honest description was **unreachable but fully rendered, and gated by nothing** — a
countdown that had been running for months behind a door with no handle. That is the exact shape
this map exists to catch, and the previous version of this map is where it was hiding.
Screenshot of what it looked like: `screens-515/battle-pass.png`.

### ✅ CLOSED 2026-09-07 — redirect, not delete

`app/battle-pass.tsx` is now `<Redirect href="/" />`. Proven by visiting the URL in a rebuilt
bundle: it lands on `/` and no countdown, tier track or premium button renders.

**Two more numbers decided it, both measured today:**

| | |
|---|---|
| The premium button asks | **5,000 chips** |
| The richest balance in the entire database | **3,250 chips** |
| Devices that could pay it | **0 of 393** |
| Battle-pass events ever recorded | **0** |

The offer was unacceptable as well as unbacked, and the countdown got worse on its own — left
alone, the first tester to type the URL would have met an expired season.

**Everything is kept.** The screen moved to `components/BattlePassScreen.tsx` intact; the store,
the config and the utils are untouched. ⚠️ **Reopening is one line** — return `<BattlePassScreen />`
instead of the redirect. The route file carries the reopen note: real players, a calibrated
economy, rewards that resolve, and a season that rolls over. `tests/battle-pass-closed.test.ts`
pins all of it, including that nothing outside the closed screen reads the season clock.

**XP was deliberately not touched.** It accrues after every hand (`results.tsx` calls `addXP`),
tiers advance, and the XP bar on the results screen shows it. Only the rewards were hollow.

### Retired — do not reinstate

- The five-tab bar (cut to three at `eaf9201`).
- The static Tutorial and the separate OnboardingOverlay.
- The sign-in nudge banner, daily-reward popup, streak popup, Weekly Recap modal.
- Nineteen Settings controls (42 → 23).
- `/missions` and `/heatmap` as screens — kept only as redirects.

---

## 3 — THE FIVE FLOWS

```
FIRST SESSION
  open ─► splash (green felt, gilded wordmark)
       ─► Home ─► onboarding: 3 steps, Skip or Continue
       ─► practice hand ─► six guided tips, each dismissed for good
       ─► reveal ─► results ─► Home
  grant: 2,000 chips, ledgered, on first appearance

A SOLO HAND   (practice = no chips · quick_poker = real chips)
  Home ─► /game ─► deal: 4 cards per board, N = getBoardCount(players)
       ─► place / Auto-Place ─► Confirm ─► READY
       ─► reveal, board by board, live odds and per-board result
       ─► /results: boards-won hero, net chips, Hand details
       ─► hand_history row · MOVES NO LADDER
       ─► Play again

A MULTIPLAYER HAND     ⚠️ NEVER OBSERVED END TO END
  Play ─► /lobby ─► join ─► /lobby/table ─► wait for players
       ─► /multiplayer-game ─► same placement flow
       ─► resolve-hand (service role) settles chips and moves ELO
       ─► /results
  REALITY: 0 rooms have ever reached `playing`. A cold visit to /lobby/table reads
  "Online multiplayer is unavailable right now." Everything right of "wait for
  players" is untested against two real humans.

A PURCHASE     ⚠️ FLAG OFF — CANNOT COMPLETE
  Home / chip count ─► /shop ─► "Shop is empty right now." ─► STOP
  iap_enabled = false, web_payments_enabled = false. 0 purchases, ever.

EARNING AND SPENDING CHIPS
  IN   first-appearance grant 2,000 · daily bonus 150 · emergency refill 200/day
       · referral 300 to inviter / 100 to invitee · hand winnings (zero-sum vs bots)
  OUT  match cost per hand (pot per board 25 × boards)
  Every credit and debit writes chip_transactions. Gap: 0 rows, 0 chips.
  Purchases would be a fifth source; there have been none.
```

---

## 4 — SCREENSHOTS, FROM THE BUILD-515 CODE

**33 stills, one per route, in `screens-515/`,** captured today from the same tree that produced
build 515, at 393×852 and 2× density. **Zero Hebrew characters in any English capture** — checked
on every one, not sampled. `screens-515/routes-report.json` records each route's first 160
characters of rendered text, its Hebrew-character count and any page error.

```bash
git show --stat HEAD -- docs/product-map/screens-515
git show HEAD:docs/product-map/screens-515/routes-report.json
git show HEAD:docs/product-map/screens-515/battle-pass.png > /tmp/bp.png && open /tmp/bp.png
git show HEAD:docs/product-map/screens-515/home.png > /tmp/home.png && open /tmp/home.png
git show HEAD:docs/product-map/screens-515/friends.png > /tmp/clubs.png && open /tmp/clubs.png
```

Per-screen explainer clips live in `docs/explainers/`, verified by `tools/explainer-verify.mjs`.
