# Fix the four — the URL that spent chips, two screens that pretended, two shots that sold emptiness

**Date** 2026-09-08 · every number below was measured, before and after.

---

## §1 · The URL that spent chips

### Where it charged, and where it charges now

| | |
|---|---|
| **Was** | `app/game.tsx`, inside the deal effect that runs **on mount** |
| **Now** | `app/game.tsx:320` `chargeBuyInOnce()`, called from `confirmPlacement()` at `app/game.tsx:337`, which both commit paths call — READY at `app/game.tsx:1243` and the arrangement clock expiring at `app/game.tsx:543` |
| **Backstop** | `app/game.tsx:719`, at the top of `doNavigate()` — the one funnel every completed hand passes through |

⚠️ **The buy-in was not removed. Only the moment moved.** Same `getMatchCost(potPerBoard,
boardCount)`, same practice exemption, same `matchCostEnabled` gate on the spend tracker, same
**dynamic** board count. A played hand costs exactly what it cost yesterday.

**Why the commit point and not the deal:** pressing READY is the point of no return — after it the
boards resolve and winnings are paid. Two routes reach it, and the second is the one that has bitten
this file before: letting the clock run out resolves a hand **without ever calling `handleReady`**,
which is how `cards_placed` under-fired for months. Folding the tracking and the charge into one
function is what stops a future edit fixing one path and forgetting the other.

### Proven by measurement, not by reading the diff

`tests/buyin-on-commit.mjs`, run against a fresh web export.

| | Before | After | |
|---|---|---|---|
| **A** typed `/game`, abandoned | 2,000 | **2,000** | costs nothing |
| **A2** spend recorded for that abandoned URL | — | **0** | nothing recorded either |
| **B1** balance while placing, before READY | 2,000 | **2,000** | not charged yet |
| **B2** spend recorded before READY | — | **0** | |
| **B3** spend recorded **at READY** | 0 | **75** | exactly the derived buy-in |
| **C** practice hand played | 2,000 | **2,000** | still free |
| **C2** spend recorded by practice | — | **0** | |
| **D** `/gameover` holding 2,000 | — | **lands on `/`** | no false message |
| **E** `/multiplayer-game`, no room | — | honest message, **no READY button** | |
| **F** `/gameover` holding 10 | — | **renders**, "Not enough chips to continue", FINAL BALANCE 10 | the real path still works |

The expected buy-in is **derived, never typed**: 3-player table × 3 boards × 25 per board = **75**.

⚠️ **TWO HARNESS BUGS OF MY OWN, BOTH CAUGHT BEFORE THEY BECAME CLAIMS.**

1. The first version expected `+75` for a charge whose delta is `-75`, and reported a correct run
   as a failure. A harness bug dressed as a product bug is exactly what gets a real fix reverted.
2. Fixing the sign made it **vacuous**: I wrote the expectation as `-(before - after)`, which
   matches whatever happened. And the balance cannot answer this question anyway — a hand
   *resolves*, so winnings land on the buy-in inside one tick. Two runs of identical code gave
   **1,925** and **2,262**; polling every 50 ms never caught the value in between.

   The instrument is now `totalChipsSpent`, which is incremented **only** at the charge site
   (`game.tsx` has exactly one call), is monotonic and is persisted. It says what was charged
   regardless of what was won.

### ⚠️ The probe was proven to fire

Putting the defect back — the charge on mount, the `/gameover` guard removed — and rebuilding:

```
FAIL  A   typed /game, abandoned          2000 -> 1925  delta -75  (expected 0)
FAIL  A2  a spend was recorded for an abandoned URL
FAIL  B1  balance unchanged before READY  2000 -> 1925
FAIL  B2  nothing recorded as spent before READY   totalChipsSpent 75
FAIL  D   /gameover holding 2000 chips -> landed /gameover
3/6 passed
```

Restoring the fix returns **6/6**.

---

## §2 · The two screens that pretended

### `/gameover`

`app/gameover.tsx` rendered "GAME OVER" and "Not enough chips to continue" **unconditionally**,
then printed the real balance underneath. Typed by someone holding 2,000 chips it stated they had
run out, above the number 2,000.

The fix is one conditional, and the threshold is **derived, never typed**:

```
const nextHandCost = getMatchCost(config.potPerBoard, getBoardCount(config.numberOfPlayers));
if (chips >= nextHandCost) return <Redirect href="/" />;
```

"Not enough" now means something measured: the balance cannot cover the next hand at the table size
this device plays. Anyone who can afford a hand is not in a game over, so they go Home — the same
Redirect pattern `/missions`, `/heatmap` and `/battle-pass` use.

⚠️ The return sits **after** the hooks. An early return above them changes hook order between
renders and React throws; the effect and the animated style stay where they are for that reason.

**The real path is intact:** case F above renders the screen, with its real message, at 10 chips.

### `/multiplayer-game`

It drew a seat, the player's balance, the placement instruction and a green **✓ READY** button for a
room that does not exist.

⚠️ **The wording is not new, deliberately.** `app/lobby/table.tsx:111-113` already handles the
identical case — same condition, same sentence, same way out. Inventing a third phrasing for one
fact is how a product ends up saying two things about one situation. The guard sits on the **outer**
component, so the inner screen never mounts: no timers, no channels, no seat heartbeats for a table
that is not there.

Measured after: the route renders **58 characters** — "Online multiplayer is unavailable right now.
Back to Lobby" — where it used to render 166 characters of a playable-looking table.

### Reported, not fixed — Roye's call

- **`/lobby`** promises "Public tables · auto-start when full" and "A real person joins here" while
  **0 rooms have ever reached `playing`**, and its own seated table says multiplayer is
  unavailable. The claim becomes true the moment players arrive, which is why it is left alone.
  If the tester round ends with the lobby still empty, this is the next honest-copy decision.
- **`/club/DEMO`** renders a complete club — code, share button, three table types, a MINI-LEAGUE
  panel — for any string typed after `/club/`. That may well be intentional: a club is created by
  its code, so an unknown code arguably *is* a new empty club. Untouched.

---

## §3 · The store screenshots

**New set: `docs/product-map/store-515/` — 7 screens × 2 sizes = 14 files.**

| | 6.9″ | 6.7″ |
|---|---|---|
| Pixels | **1320×2868** | **1290×2796** |
| Viewport × scale | 440×956 @3 | 430×932 @3 |

⚠️ **Every emitted PNG is re-opened and its real pixel size asserted** — 14/14 exact. A file named
`1320x2868` that is not 1320×2868 is the filename-is-not-evidence trap, and this set is the last
place to repeat it.

### What is real, and what is staged — said plainly

| Shot | Content | Staged? |
|---|---|---|
| `01-home` | 2,350 chips, a 4-win-streak badge, the daily bonus | **No.** Earned by playing. |
| `02-play` | the five modes | **No.** |
| `03-hand-history` | six real hands, Wins (4) / Losses (0), FULL HOUSE, Straight, +50/+200 | **No.** The rig played them through the app's own controls. |
| `04-achievements` | **8/19 unlocked**, real progress | **Partly.** The screen is served the product's **own 24 active definitions**, read from `achievement_definitions`, with a plausible earned subset. The rig supplies the player's progress, not the feature. |
| `05-game-placement` | four boards, PLACE 16 CARDS | **No.** |
| `06-game-reveal` | Board 1, live equity | **No.** |
| `07-results` | "You won 50 chips! 🎉", 4 WIN STREAK, board breakdown | **No.** Real hands; the rig kept playing until one was a win. |

### ⚠️ The shop shot is gone, and not replaced by a fake one

Payments are **off**. A stocked shop is a state **no player can reach today**, so photographing one
would be this sprint's own defect in a nicer costume. **Hand history takes its slot** — a real
feature, with real content, that a store visitor can believe.

The line held throughout: **stage a state a real player reaches; never stage a capability the
product does not have.**

### Two layout findings the shots exposed, both pre-existing

- ⚠️ At **440pt** (6.9″) the achievements **category filter row clips "Collection"** at the right
  edge. At 430pt it fits. Not fixed — outside this sprint's four.
- ⚠️ At **440pt** the reveal's **DANGER pill overflows the left edge** and reads "ANGER". Visible in
  the 2026-09-03 set too, so it predates this work; at 430pt it renders "4 DANGER" correctly.

### The old set is kept and labelled

`docs/product-map/store/SUPERSEDED.md` says why it must not be uploaded. It is **kept, not
deleted** — deleting the old file under a shared name is exactly how a stale asset returns under a
new one.

---

## §4 · The store listing — untouched

**Nothing was written to App Store Connect.** No PATCH, no POST, no submission. `store_listing.rb`
is GET-only and was not even run this sprint.

**Still blocking submission**, unchanged from yesterday's read:

1. **Description** — null
2. **Support URL** — null
3. **Privacy policy URL** — null
4. **Category** — both primary and secondary null
5. **Age rating** — the questionnaire has never been answered (`gamblingSimulated` null, override NONE)
6. **At least one screenshot** — zero uploaded

Drafted copy for 1 through 4 is in `docs/last-gaps/THE-LAST-GAPS-2026-09-08.md`. For 5 the
recommendation stands: answer simulated gambling as **Frequent/Intense** and accept 17+/18+. For 6
the assets now exist at both sizes in `docs/product-map/store-515/`.

---

## Production unchanged

| | |
|---|---|
| App Store Connect | **nothing written.** No metadata, no rating, no submission. |
| TestFlight public link | **still disabled.** 515 not submitted for Beta App Review. |
| Economy **values** | untouched — `potPerBoard`, `getMatchCost`, the practice exemption and every flag are identical. Only *when* the existing charge fires moved. |
| Database | **no write of any kind.** The rigs run with the backend aborted; no device was created, no chip moved, no room row touched. |
| Flags · winner cue · card sizes · the 83px arc | untouched. |
| `/lobby`, `/club/DEMO` | untouched, reported only. |
| Edge Functions | none deployed (`verify_jwt` untouched). |

## Suite

**2,824 / 2,824 across 52 suites.** `tsc --noEmit` clean.

## Where to look

```bash
git show HEAD:docs/product-map/store-515/manifest.json
git show HEAD:docs/product-map/store-515/07-results-1320x2868.png > /tmp/r.png && open /tmp/r.png
git show HEAD:docs/product-map/store-515/03-hand-history-1320x2868.png > /tmp/h.png && open /tmp/h.png
git show HEAD:docs/product-map/store-515/04-achievements-1320x2868.png > /tmp/a.png && open /tmp/a.png
node tests/buyin-on-commit.mjs      # the six measurements, on a fresh export
node tools/store-shots.mjs          # re-shoot both sizes
node tools/hollow-sweep.mjs         # /gameover -> / and /multiplayer-game -> the honest message
```
