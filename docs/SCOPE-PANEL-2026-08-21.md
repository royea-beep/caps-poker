# CAPS — scope panel before testers (2026-08-21)

**Report only. Nothing built, nothing deleted.** The harness can now complete a hand, so this is the
first time the first session has been *walked* rather than inspected.

---

## First-session walkthrough — what a stranger experiences

Fresh device, no seeding. **webkit/430 and chromium/393 — identical, zero page errors.**

1. **First open** — a modal tutorial card over a dimmed home: *"Place 4 cards on each board"*, dot 1
   of 3, a gold **Continue**, and **SKIP ✕**. The home screen is visible but dimmed behind it.
2. **The first action is twelve cards.** Tapping Play deals a 3-player practice hand: **"PLACE 12
   CARDS"**, BOTS 2/2, three boards. A stranger's first act in this game is placing twelve cards.
3. **Place → Ready → reveal all work.** Auto-Place ALL fills, Ready arms, the reveal runs.
4. **Results is dense** — 34 lines: *YOU LOSE · Practice vs bot — XP only, no chips · This session:
   +0 · 1 — 2 · +75 XP · Game: 50 | Boards: +25 · Tier 1 · 75/100 XP · Total XP: 75 · Best hand:
   Full House on Board 1 · Boards: 1/3 · Net: XP only.* Buttons: **Share Hand · REMATCH · HOME**.
   There is no "Play again" — the word is REMATCH.
5. **Returning home shows the tutorial again, from slide 1.** The step-1 and step-6 screenshots are
   identical. A stranger who just played a full hand is re-taught how to play.

### The finding I did not expect — the first screen is not operable by assistive tech

Probed the DOM directly: **`SKIP ✕` and `Continue` are `div < div[tabindex=0]`** with no
`role="button"` and no `aria-label`. They are **not** among the 7 elements the page exposes as
buttons. Meanwhile **all seven home buttons stay exposed behind the modal** — Play, Open menu, Open
chip shop, Copy referral code… so there is **no focus trap and no `aria-hidden`** on the background.

My own automation demonstrated the consequence: it could not see Continue or SKIP, tabbed past them,
and activated **Play through the overlay**. A screen-reader user meets the same thing — a tutorial
they cannot operate, over an app they can. `/theme-pick` has the same defect (0 exposed buttons).

## Inventory — what is *reachable*, which is what CUT depends on

**Reachable:** 5 tabs (home · play · friends · cups · profile) · side menu (lobby · battle-pass ·
stats · hand-history · coaching · **spectate** · settings · sign-in) · shop, chip-store, referral,
achievements, missions, leaderboard from home · the game → results → gameover chain.

**Not reachable by tapping:** `/debug`, `/heatmap`, `/club/[code]`, `/orientation-pick`.
`/simulate` **redirects to home**, so it is not a surface at all.

| route | live render | works? | understandable unaided? |
|---|---|---|---|
| `/spectate` | 4 lines, *"⚠️ No room code provided"*, **zero buttons** | no | no — dead end |
| `/debug` | 35 lines of AUTO-DEBUG output, **zero buttons** | n/a | no |
| `/gameover` | *"Not enough chips to continue"* above *"FINAL BALANCE 2,530"* | contradicts itself | no |
| `/rank` | "Amateur · ELO 1000", 36 lines | yes | filed EMBARRASSING |
| `/replay` | *"No hand selected"* + **Go to hand history** | yes | **yes — see correction** |
| `/heatmap` `/coaching` `/hand-history` | clean empty states + "Play Now" | yes | yes |
| `/battle-pass` `/achievements` `/leaderboard` `/missions` `/referral` | 23–146 lines, all render | yes | mostly |
| `/theme-pick` | 15 lines, **zero exposed buttons** | visually yes | not by AT |

## Two corrections to the existing audit — both verdicts are stale

1. **`/replay` is no longer EMBARRASSING.** The audit (2026-08-15) called it *"a black screen, no
   header, floating gold Back — reads as a crash page"*. It now renders a proper empty state with a
   **Go to hand history** button. Fixed by `94966a1` *"make the empty state look intentional, not
   broken"*. The backlog entry should be closed.
2. **`/gameover` contradicts itself, and the cause is one line.**
   [gameover.tsx:116](app/gameover.tsx:116) renders *"Not enough chips to continue"*
   **unconditionally**, so the screen says you are broke directly above *"FINAL BALANCE 2,530"*.
   Same class as the `rank` contradiction already filed, and not previously recorded.

## CUT

1. **`/spectate`** — reachable in **one tap** from the side menu and it is a dead end: four lines, an
   error triangle, and no working control at all. **What breaks if removed:** nothing — delete the
   one `MenuItem` at [SideMenu.tsx:150](components/SideMenu.tsx:150); the route can stay on disk.
2. **`/debug`** — an AUTO-DEBUG dump with no back button. Not linked, so lower risk, but it should
   not answer on a public build.
3. **The tutorial re-show after a completed hand** — not a screen to delete, a condition to fix. It
   is the single most likely thing to make a tester think the app is broken.

**Nothing else.** I am *not* recommending deleting features that work but are empty (heatmap,
coaching, hand-history): they have honest empty states with a CTA, and they answer "is there depth
here" — which is a question worth having answered.

## KEEP — load-bearing, do not touch

The practice hand (place → ready → reveal → results): it works end to end on both engines and it **is
the product** · the shop and its four cosmetic families (5 of 5 proven) · the economy guards (8
functions, binding, throttle) · the reveal and its winner cue · the empty-state pattern `stats`
established and heatmap/coaching/hand-history follow.

## UPGRADE — costed honestly

| # | what | cost |
|---|---|---|
| **A** | Make the first-run overlay operable — `role="button"` + labels on Continue/SKIP, `aria-hidden` the background, trap focus | **~2 hours** |
| **B** | Stop re-showing the tutorial after a completed hand | **~1–2 hours** — the risk is that "seen" is only written on SKIP/complete and Play bypasses both |
| **C** | `gameover.tsx:116` — make the subtitle conditional on the balance | **~15 min** |
| D | Results density — 34 lines competing. Not broken, just loud | ~half a day, and it is judgement |
| E | `rank` contradiction (already filed) | ~1 hour |

**A + B + C — the three that change what a tester believes about the app — total well under a day.**

## ADD — the default position first

> **Add nothing.** The round exists to find out what the current thing is worth. Every addition is
> untested surface and one more thing that can break the week they arrive. And Roye's own diagnosis —
> *"5 appearance selectors = 1,080 combinations = why there is no wow"* — says the problem is too
> many options, not too few.

Three candidates, judged **only** by what the round learns better:

1. **Nothing.** *Ranked first, and I mean it.* A+B+C are **fixes, not additions**, and they improve
   every answer the round produces by removing noise from the first thirty seconds.
2. **A first hand that is not 12 cards.** Not a feature — a default. Opening a stranger on 2 players
   (4 cards per board, one board fewer to parse) would tell us whether the drop-off at the first hand
   is the **rules** or the **volume**. Today we cannot separate those. **Cost ~1 hour** (a config
   default). **Risk:** it changes the thing being tested, so it must be decided *before* the round.
3. **An end-of-hand "what just happened" line** — one sentence naming why you lost that board.
   **Cost 1–2 days. Risk:** real — new surface on the busiest screen. It would answer *"do they
   understand the game"* directly instead of by inference. **I would not ship it before this round;**
   it is the strongest candidate for the round after.

**Ranking: 1 (nothing) > 2 (first-hand size, only if decided now) > 3 (after the round).**

## Reused vs newly assessed

**Reused:** the 22-route table, instrument triage and 8 reviewed verdicts from
`docs/SCREEN-VISUAL-AUDIT.md`; the 9 open items from `docs/PRE-TESTER-BACKLOG.md`.
**New this sprint:** the reachability map (the audit never asked what a tester can reach), the live
first-session walk on both engines, the first-run accessibility probe, the live render of 15 routes,
and the two stale-verdict corrections.

**Cleanup:** 10 chip_transactions, 5 leaderboard rows, 2 hand_history, 13 rate counters, 5 streaks,
5 daily_rewards, 91 analytics_events — by the same auditable rule as last sprint. `purchases` 0, 0
test devices, the 2 real bindings untouched. Throwaway probes deleted;
[tests/first-session-walk.mjs](tests/first-session-walk.mjs) kept — this walk should be repeatable.

*(handoff: `vamos_handoffs` id 87)*
