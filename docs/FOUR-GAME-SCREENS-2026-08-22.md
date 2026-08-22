# CAPS — the four game screens, control by control, during a live hand (2026-08-22)

The last unmeasured surfaces are measured. **The control that advances the hand was exposed to
assistive tech as nothing** — in solo and in multiplayer, in every phase.

---

## `game` (solo) — every control, every phase

Walked a live hand at 430/393/320, 3 boards and 4 boards, both engines.

| control | phase(s) | does | works | understandable | belongs |
|---|---|---|---|---|---|
| Leave game | **all six** | exits to home | yes | yes | yes — but see *mid-hand* |
| Auto-Place — Board N | while that board is empty | fills that board | yes | yes | yes |
| Auto-place all boards | until all full | fills every board | yes | yes | yes |
| Cancel (undo) | arranging | undoes placement | yes | yes | yes |
| Confirm / ✓ READY | arranging | **advances the hand** | yes | yes | yes |
| Dismiss tip | transient | closes the tooltip | yes | yes | yes |
| View hand history *(link)* | results | → `/hand-history` | yes | yes | yes |
| Share Hand · REMATCH · HOME · DEAL ME IN | results | — | yes | yes | yes |

### Exposed-control count per phase — before → after this sprint's fix (webkit/430/3p)

| phase | exposed | unexposed |
|---|---|---|
| P1 dealt / empty | 3 → **8** | 30 → 27 |
| P2 partly placed | 2 → **7** | 30 → 23 |
| P3 fully placed | 2 → **4** | 17 → 15 |
| P4 ready armed | 2 → **4** | 17 → 15 |
| P5 during reveal | 3 → 3 | 40 (unchanged — the arrangement UI is gone by then, correctly) |
| P6 results | 4 → **5** | 1 → **0** |

chromium/393 is identical except P3/P4 read 3 not 4 — the difference is the transient *Dismiss tip*,
**not** a control gap, verified by reading the list: `["Leave game","Cancel","✓ READY"]`.

**Reveal navigable: YES** on every run — but only *Leave game* and *Dismiss tip*. Nothing about the
reveal itself is reachable.

## `multiplayer-game` — measured separately, nothing assumed to transfer

Two real clients, one heads-up table, auto-started.

| phase | exposed | unexposed |
|---|---|---|
| waiting, 1 of 2 seated | 3 | **0** |
| MP-P1 dealt *(client A)* | 9 | 40 |
| MP-P1 dealt *(client B)* | 9 | 40 — **identical to A**, both perspectives agree |
| MP-P3 fully placed | 8 | 22 |
| MP-P4 ready armed | 8 | 22 — **ready not exposed here either** |
| MP-P5 during reveal | 8 | 21 |
| MP-P6 results | 3 | **0** |

The MP-P4 finding was reached **independently in MP**, not inferred from solo.

### Where MP diverges from solo — why measuring twice was right

1. MP adds **7 controls solo has no equivalent for** (six named emotes + *Open chat input*), all
   correctly labelled.
2. **MP results had zero unexposed controls while solo results had one** — `DEAL ME IN`. The gap was
   **solo-only**. Fixing from the MP reading alone would have missed it entirely.
3. MP shows a live opponent balance and a real chip movement (2,530 → 2,505, the buy-in); solo
   practice shows neither.

No horizontal overflow, 0 page errors on either client.

## `lobby/table`

| surface | exposed | unexposed |
|---|---|---|
| lobby list | **10** | **0** — *"Join table YZQ3"* ×6 plus three practice rows |
| table, one player | **3** | **0** |

The three: *"Back — keep your seat"*, *"Share table code"*, *"Leave table and give up your seat"*.
Shows `1 / 2 seated` and the code. **The two exits are correctly and distinctly labelled**, which is
the entire risk on this screen.

- **Share table code** — operated: works, no dialog.
- **Leave table and give up your seat** — operated: returns to `/lobby` **and the seat is genuinely
  freed**, verified in the DB rather than on screen (room back to `waiting`, `current_players` 0,
  0 seated).

The lobby list is the **best-labelled screen measured in this project**.

**Not covered:** a *full* table, and someone-leaves. Both need a second client held across states —
named as a boundary rather than implied.

## `gameover`

**2 exposed / 0 unexposed** — PLAY AGAIN, MAIN MENU. Fully accessible.

> ### ⚠️ The `:116` contradiction — RETRACTED
>
> I carried this forward in handoffs 87 and 93 and **it is wrong**. `/gameover` is routed to from
> exactly one place — [results.tsx:827](app/results.tsx:827) — and only when
> `!canAffordMatch(chips, matchCost)`. In the real flow the player genuinely cannot afford the next
> match, so *"Not enough chips to continue"* is **true**.
>
> The filed observation — that sentence above *"FINAL BALANCE 2,530"* — reproduces **only** by typing
> `/gameover` into the URL bar, which is what the scope-panel probe did. I reproduced it exactly that
> way on both engines to confirm the mechanism.
>
> **Not fixed, deliberately:** it is correct in every reachable state, and shipping changes to
> correct code is how the backlog accumulated twenty stale entries. Close it as an artifact.

## Controls that change meaning mid-hand

**One: "Leave game".** Exposed in all six phases, and its consequence is not constant. During
placement it abandons a hand that has not happened. During the **reveal** it abandons a hand that
**has been played**, and the result is discarded.

## Anything that can strand a player mid-hand

**No strand** — leaving during the reveal lands on HOME on both engines. No dead end, no dialog.

**But the hand is lost**, measured rather than inferred:

| behaviour | hand_history rows |
|---|---|
| left during the reveal (2 devices) | **0 — they do not appear at all** |
| reached `/results` (3 devices) | exactly **1 each** |

The outbox does not cover this **by construction**: `results.tsx` is what queues the hand, so a
player who leaves before `/results` mounts never queued anything. Handoff 94 said the outbox protects
the record but not the player — this is the precise shape of that gap.

**Not fixed:** queueing from the reveal instead of from results would record hands players believe
they abandoned. That is a product decision, not a one-liner.

## 320px and 4 boards — a clean negative

Both have hidden real defects before. **This time neither did.** 320px × 4 boards (`PLACE 16 CARDS`)
gave identical exposed counts to 430, **no horizontal overflow at any phase**, 0 page errors. The
16-card hand is the tightest case in the app and it holds.

## One-liners fixed — role and name only, zero layout consequence

1. **`ready-button`** ([BoardArrangement.tsx](components/BoardArrangement.tsx)) — had a `testID` and
   no role or name. *The* control that advances the hand. Now role + name + disabled state.
2. **Its Cancel sibling** — same shape, same fix.
3. **Per-board Auto-Place chip** ([Board.tsx](components/Board.tsx)) — the name **carries the board
   number** (*"Auto-Place — Board 2"*), because 2–4 of them are otherwise indistinguishable from each
   other and from *"Auto-place all boards"* — the exact confusion that cost three sprints in the
   harness.
4. **`DealMeInButton`** — the primary CTA on solo results.

**Why safe:** every one adds `accessibilityRole` / `accessibilityLabel` / `accessibilityState` only.
No style, no layout, no logic. Verified by re-measuring every phase after deploy.

**MP-after not measured.** `GameView` renders the *same* `BoardArrangement` — "literally the same
component", per its own header — so the ready fix reaches MP **structurally**. I could not re-drive
two clients into a hand to prove it, so it is stated as structural, not measured.

## Instrument failures this sprint: 1, caught before filing

My lobby selector matched `/players|join|table/` loosely and hit the *"Practice game versus a bot"*
row, landing in `/game` while the script printed a "lobby/table" heading. Caught on the first read —
the route in the header did not match the label. Re-anchored on the declared label `^"Join table "`.

**Running total across h86–h95: six findings, four caught before filing.**

**Also named, not filed:** on two later attempts the room reached `playing` with both seats filled
while both clients stayed on `/lobby/table`. That *looks* like a real MP defect — but **I had manually
restored that room row between runs**, so I cannot separate a product bug from my own edit. Reported
as unresolved with the confound named. Do not treat it as a finding.

## Retractions

1. **`gameover.tsx:116`** — see above. My own carried-forward finding, wrong, closed as an artifact.
2. **The "1,051 devices" baseline** I have quoted included **two of my own devices** that earlier
   sprints failed to clean (first seen 00:14 and 00:29 today). The true figure is **1,049**. My
   cleanup, not the app.

## Phases covered vs not

**Covered:** `game` P1–P6 on webkit/430 and chromium/393, plus 320px, plus 4-board — before **and**
after the fix. MP waiting + P1 (both clients) + P3 + P4 + P5 + P6, before the fix. Lobby list,
`lobby/table` single-player, both exits. `gameover`.

**Not covered, named:** MP re-measured after the fix · a full lobby table and someone-leaving · and
every control **operated** at every phase from a fresh load. That last is a deliberate boundary —
reaching a mid-hand phase costs a full hand, so operating N controls × 6 phases from fresh loads is a
different budget. Everything above is **enumerated** at every phase; controls marked *operated* are
the ones actually driven.

## Cleanup

26 devices, all machine-paced (0.4s–1m40s). Zero leftovers across `analytics_events`,
`chip_transactions`, `achievements`, `hand_history`, `daily_rewards`, `leaderboard`, `user_missions`,
`device_identity`, `room_players`. `purchases` 0 · 0 `test-` devices · `achievements` 47 ·
`hand_history` 243 · real bindings 3 · leaderboard **1,049**.

Room YZQ3 was left `playing` twice by my own runs and **restored both times** — all six lobby tables
verified back to `waiting`/0/0. The one remaining non-waiting room predates this sprint.

**Real player `6956-24d1-5ee4` untouched, 59 events intact.**

**Nothing else changed:** battle-pass not hidden or touched · tester round not raised · first-hand
player count unchanged · `record_reward`, its clamp, the outbox and every economy guard untouched ·
the twelve retired achievements not wired and no dead table revived · `delete_user_account` grant not
restored · DEVELOPER and the 7-tap gate untouched · no C5, stake tiers, stakes UI or tournaments ·
MP sign-in prompt untouched.

*(handoff: `vamos_handoffs` id 95 · shipped `main 9ed9734`)*
