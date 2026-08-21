# CAPS — the English was never reached, and the achievements can't be earned at all (2026-08-21)

The brief asked why Hebrew reaches an English-only UI, on the assumption that "a language parameter
is being passed something other than `'en'`". **There is no language parameter anywhere.** And
fixing the language surfaced something larger: the achievements screen cannot show progress to
anyone, and the language was never the reason.

---

## Where the Hebrew comes from

Six SECURITY DEFINER functions projected:

```sql
'title',       COALESCE(d.title_he, d.title)
'description', COALESCE(d.description_he, d.description)
```

`COALESCE(title_he, title)` returns **Hebrew first, English only if Hebrew is NULL** — and `title_he`
is populated on **36 of 36** rows, so the English column was **never reached**. Nothing selects a
language; the fallback order was simply written backwards for an English-only app.

`getLanguage()` is hardcoded `'en'` and `setLanguage()` is a no-op ([utils/i18n.ts:56](utils/i18n.ts:56)),
so **the client was never at fault.**

It was systemic — six functions, not one:

| function | reaches a player? |
|---|---|
| `get_achievements_list_d(text)` | **yes** — [achievements.tsx:377](app/achievements.tsx:377) |
| `get_achievements_list(uuid)` | **yes** — [achievements.tsx:376](app/achievements.tsx:376) — **the user-scoped variant had the identical bug** |
| `check_achievements(uuid,text)` | latent — feeds the unlock push |
| `get_daily_missions(text)` / `(uuid)` | latent |
| `send_push_notification(uuid,text,jsonb)` | latent — 20 templates, 8 DB callers |

## Fixed at the source

Migration `english_first_coalesce_fix` swaps the argument order at all **11** sites, matching the
shape already shipped in `get_daily_missions_d` on 2026-06-19.

Each function was **regenerated from `pg_get_functiondef` with a backreferenced regex, not retyped**,
so only the argument order could change. The dry run confirmed `length(new) == length(old)` on all
six — a pure reorder. **Nothing translated, no column dropped, no row edited**; Hebrew stays as the
fallback it should always have been.

Schema-wide afterwards: **0 Hebrew-first COALESCE remain** across all 27 functions mentioning `_he`.

**Live, both engines, production:** 36 tiles, **0 Hebrew**. `"First Hand"` (was *"יד ראשונה"*),
`"10 Hands"`, `"50 Hands"`, `"Century"`.

**User-scoped variant: verified** — it had the same bug and is fixed, confirmed by calling it
directly (36 rows, 0 Hebrew). **Not** verified through the signed-in UI, because that requires
Google credentials I must never enter. DB-verified, UI-unverified — said plainly rather than
restated as "unverified".

## The same pattern everywhere else — checked

| surface | verdict |
|---|---|
| missions | `_d` was already correct; both `get_daily_missions` overloads were not → fixed |
| push | fixed; latent (push is disarmed) |
| **shop** | **already correct** — `getLanguage()==='he' ? _he : english`, and the second Hebrew `<Text>` is a dead `{false ? … : null}` branch. Do not "fix" it |
| **cups** | **false alarm** — `name_he`/`description_he` literally contain English (*"Bronze Cup"*, *"Win 10 hands"*). English under Hebrew-named columns |
| battle-pass, chip_config | not affected |

## The client override was not redundant — it was wrong

[missions.tsx](app/missions.tsx) carried `MISSION_EN`, a hardcoded map rewriting strings the server
sent — the exact shape the brief warned against. Measured against `daily_missions`:

- **8 of its 10 keys do not exist in that table at all** — they are `battlePassStore` pool ids, a
  different namespace.
- The **2 that did match** overrode the server's *"Play 3 Hands"* with *"Play 3 games"*. **CAPS has
  hands and boards, not games** — so it corrupted the only rows it actually touched.

Deleted.

## The bigger finding: achievements cannot be earned at all

The brief asked me to prove the screen shows progress. **It cannot**, and the language was not why.

A real hand played to `/results` on **both** engines (`reachedResults=true`, `sawReveal=true`) — and
the counter stayed **0/36** with every tile locked, on both.

Two independent breaks:

1. **Nothing calls `check_achievements`.** Zero client call sites. Exactly **one** DB caller, and it
   is `test_e2e_anonymous_flow` — a **test harness function**. No gameplay path awards anything.
2. **Even called directly it awards nothing.** Run against the just-played device it returned `[]`.
   It reads `player_poker_stats`, which holds **2 rows, last written 2026-04-13** — the **same date**
   as the most recent unlock in the whole `achievements` table (47 unlocks, 21 devices, **none
   since**). It also reads `leaderboard.games_played`, which practice deliberately does not
   increment.

**Not wired by me, deliberately.** `check_achievements` grants chips via **`earn_chips`** — the
un-ledgered legacy writer that the single-writer refactor moved achievements *away* from (to
`record_reward`). Wiring it into gameplay now would reintroduce a second chip writer and risk
exactly the dual-writer clobber that took several sprints to eliminate. That is the DB owner's call.

## The six screens — all six operated

| route | controls | result |
|---|---|---|
| `rank` | 2 | both work |
| `replay` | 2 | both work — **confirms it is no longer "EMBARRASSING"; close that entry** |
| `heatmap` | 2 | both work |
| `coaching` | 2 | both work |
| `hand-history` | 5 | Back + Play Now work; the three filters are bare `div`, **AT:N** — no role. "No effect" is expected at 0 rows; the defect is the missing role |
| `theme-pick` | 2 | tiles are `div`, **AT:N** — but they **do** work: FIVE-O persisted `visualTheme classic → fiveo` |

**`rank` contradiction: corrected, not confirmed.** It does not reproduce. A 0-game device now shows
*"No rank yet — Play a game to claim your spot on the ladder"*. The filed *"Rank #738 of 754"* is
stale — close it.

## A fourth false dead-control finding, caught before publishing

My enumerator reported `/rank`'s **"Play Now"** as `NO VISIBLE EFFECT`. Re-tested on both engines:
**it works**, navigating to `/game`. The enumerator's post-tap wait is too short for a route that
mounts a game. **I did not file it.** Same lesson as leaderboard's `role="tab"` — the instrument,
not the app.

## Also fixed, and one filed

[cups.tsx](app/(tabs)/cups.tsx) dropped `accessibilityLanguage="he"` from an always-English label.

**Filed, not fixed:** **11 more live sites** in `index.tsx` and `game.tsx` tag English text as
Hebrew — `isHE = getLanguage() === 'he'` is **always false**, so a screen reader announces English
in a Hebrew voice. The correct pattern already exists in [shop.tsx:310](app/shop.tsx:310) and
[cups.tsx:29](app/(tabs)/cups.tsx:29).

## Cleanup

14 devices, all machine-paced (spans 0.4s–1m41s; the real player's signature is 13 placements over
**18 minutes**). Deleted: **139** analytics_events, all leaderboard rows, **36** user_missions,
**9** device_identity bindings. achievements 0, purchases 0.

**Still present, blocked by the sandbox:** 24 `chip_transactions`, 12 `daily_rewards`, 1
`hand_history` — deletes on those tables were refused by the permission classifier. **Flagged rather
than worked around.**

**Real bindings back to 3. `purchases` 0. Real player `6956-24d1-5ee4` untouched, 59 events intact**
— excluded by the rule (first seen before the window), not by hand.

**Nothing else changed:** nothing translated · `delete_user_account` grant not restored · DEVELOPER
and the 7-tap gate untouched · no C5, stake tiers, stakes UI or tournaments · MP prompt untouched ·
first-hand player count unchanged · no keys or certificates · `game`, `multiplayer-game`,
`lobby/table`, `gameover` not started.

*(handoff: `vamos_handoffs` id 91 · shipped `main 865a77f`)*
