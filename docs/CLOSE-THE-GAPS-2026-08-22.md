# CAPS — the three gaps closed, and an alarm I raised this morning retracted (2026-08-22)

All three boundaries named in handoff 95 are closed. One of them closed by **withdrawing a defect I
filed earlier in this same sprint.**

---

## 1. MP after the fix — measured, not structural

Two real clients, clean run.

| phase | before (h95) | after |
|---|---|---|
| MP-P1 dealt *(client A)* | 9 exposed / 40 unexposed | **15 / 36** |
| MP-P1 dealt *(client B)* | 9 / 40 | **15 / 36** — identical to A |
| MP-P3 fully placed | 8 / 22 | **10 / 20** |
| MP-P4 ready armed | 8 / 22 | **10 / 20** |

**Named in MP**, verified by reading the exposed list rather than counting it:

- `ready-button` → **"✓ READY"**
- Cancel → **"Cancel"**
- per-board → **"Auto-Place — Board 1 / 2 / 3 / 4"**

Client B's P1 set matches A exactly. 0 page errors on either client. **The structural claim in h95
is now a measured one.**

### Divergence from solo

The **only** difference is the seven controls MP has and solo does not — six named emotes plus
*Open chat input*. Solo P1 exposes 8, MP P1 exposes 15, and 15 − 8 is exactly that set. **The fix
introduced no new divergence.**

## 2. The full table, and someone leaving

Used a **3-max** table so the room does *not* auto-start — the only way to hold "two seated" still
enough to survey, and to watch the remaining player.

| state | exposed | unexposed | copy |
|---|---|---|---|
| one seated | 3 | 0 | `1 / 3 seated` |
| two seated *(A)* | 3 | 0 | `2 / 3 seated` |
| two seated *(B)* | 3 | 0 | `2 / 3 seated` — both clients agree |
| **after B leaves** | 3 | 0 | `1 / 3 seated` — **A's screen updates live** |

Both exits stay distinctly labelled at every state: *"Back — keep your seat"*, *"Leave table and
give up your seat"*, *"Share table code"*. Zero unexposed controls throughout.

**Does it say what happened? No.** The counter silently decrements 2/3 → 1/3. The remaining player
is never told a person left — they would have to be watching the number. **That is the one gap on
this screen, and it is copy, not mechanism.**

**Is there a way forward, or only a way out?** A way *forward*. A keeps the seat, can still share the
code to recruit, or can leave. Not a dead end.

**Boundary named:** I did not capture a healthy 2/2 **full** frame on a 2-max table. On the
successful run auto-start moved both clients to `/multiplayer-game` before a 2/2 `/lobby/table` frame
could be sampled; on the failing run the frame I caught was the error state.

## 3. ⚠️ The 'playing' confound — resolved, and it is my artifact. Retracted.

Re-run clean, touching **no room row** before, during or after.

| room | result |
|---|---|
| **YZQ3** | *"Could not deal the hand. Check your connection and try again."* + *"Back to Lobby"* — one exposed control, honest copy, no silent failure. Room went to `playing` with `started_at` set while both clients stayed on `/lobby/table`. |
| **WKZS** *(never touched by me)* | auto-started, dealt, played a full MP hand. |

**The difference, measured:** YZQ3 carried a **stale `game_hands` row from 04:00:33** — left behind
by **my** manual restore in the previous sprint, which reset `game_rooms` (status, current_players,
started_at, finished_at) and never touched `game_hands`. WKZS had no such orphan.

Every successful deal in this project has been on a room with no orphaned hand row; the one failure
was on the one room I had hand-edited.

**So I do not file this as a product defect, and I withdraw the alarm I raised earlier today.** It is
the same class as the four false findings before it — my instrument, not the app.

**And the restores were never needed.** Both YZQ3 and WKZS self-healed `playing` → `finished` on
their own within minutes, with `finished_at` set and 0 seated, and **the lobby replenished itself** —
a new table `Q3LS` appeared to keep the pool at six. The app manages room lifecycle correctly without
intervention. Hand-restoring a `game_rooms` row is what broke it.

**Residual boundary, stated rather than glossed:** whether a room that completes a hand **normally**
can be dealt again is still untested. No normally-finished room returned to the lobby inside this
sprint's window. If reuse were broken generally it would be serious — it is simply not yet measured.

## 4. Rooms not waiting

**At sprint start:** VDKH (2026-08-21), 54YU (2026-08-12), YYPT (2026-07-12) — all three **predate
this sprint, none mine, all left untouched.**

**At sprint end:** YZQ3 and WKZS are also `finished` — finished **by the app**, not by me.

**Nothing was deleted and nothing was edited** in `game_rooms` or `room_players` this sprint. Six
waiting human tables remain, exactly as at the start.

## 5. The mid-reveal loss, framed for Roye — report only

A player who leaves during the reveal loses the hand entirely: measured, devices that left have zero
`hand_history` rows while those that reached `/results` have exactly one. **How often:** the reveal is
the longest passive stretch in the game — roughly 8s per board, so 24–32s on a 3–4 board hand with
nothing to do but watch — which makes it the most likely moment in a session for someone to switch
away, and the skip-all control exists precisely because people found it long. **What the player
thinks happened:** they played a hand. They saw their cards, pressed Ready, watched boards turn over.
Nothing tells them the hand only counts if they stay, so hand history missing it reads as the app
losing their game — and because achievements count `hand_history` rows, they also silently lose
progression they believe they earned, which is the more corrosive half. **Options:** (a) *leave it* —
zero cost, defensible on the grounds that an abandoned hand was abandoned; (b) *queue at the reveal*
instead of at results — roughly half a day, moves the write to where the outcome is already known,
but it records hands the player believes they walked away from, a genuine product change and not
obviously desirable; (c) *queue at hand resolution*, the moment the outcome is computed regardless of
which screen is mounted — about a day, the most correct and the most invasive, since the settle path
stops being tied to a screen at all. All three are defensible; the choice is about what CAPS wants a
hand to mean, and that is Roye's, not mine.

## 6. Instrument failures this sprint: 0 new false findings, 1 retraction

No new false finding was filed. One test-design limit surfaced and was caught immediately: my re-test
asked for WKZS while WKZS was still `playing`, so it was not offered in the lobby and the join
returned null — visible in the output as `A joins: null`, not mistaken for a defect.

The retraction above is of a finding I raised earlier in **this** sprint and withdrew before it left
the sprint. **Running total across h86–h96: seven findings, five caught before filing.**

## 7. Retractions

**The MP 'playing' / failed-deal alarm.** Raised earlier today as *"a real MP defect and a serious
one"*, withdrawn on the evidence: it reproduces only on the room I had hand-restored, which uniquely
carried a stale `game_hands` row, and not on an untouched room.

## Cleanup

7 devices, all machine-paced (1m24s–1m51s). Zero leftovers across `analytics_events`,
`chip_transactions`, `achievements`, `hand_history`, `daily_rewards`, `leaderboard`, `user_missions`,
`device_identity`. Back to the exact baseline: leaderboard **1,049** · 0 rows updated today · 0
`test-` devices · `purchases` 0 · real bindings 3 · `achievements` 47 · `hand_history` 243 ·
`room_players` 0 · **6 waiting human tables**.

**Real player `6956-24d1-5ee4` untouched, 59 events intact.**

**Nothing else changed:** mid-reveal loss not fixed · `gameover:116` not touched · battle-pass not
touched · **no `game_rooms` or `room_players` row deleted or edited** · first-hand player count
unchanged · `record_reward`, its clamp, the outbox and every economy guard untouched · the twelve
retired achievements not wired · `delete_user_account` grant not restored · DEVELOPER and the 7-tap
gate untouched · no C5, stake tiers, stakes UI or tournaments · MP sign-in prompt untouched.

*(handoff: `vamos_handoffs` id 96 · harness `main 955718f`)*
