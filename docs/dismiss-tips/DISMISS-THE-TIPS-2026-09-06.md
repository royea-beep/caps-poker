# DISMISS THE TIPS — 2026-09-06

The request was a button to turn the opening explanations off. The answer is that no button was
needed. They were coming back when they should not have been, and that is a bug.

Branch `claude/vamos-caps-align-celebration-flppo0`. `tsc` clean. **2,742 / 2,742 tests.**
No Edge Function was deployed, so `verify_jwt` was not touched anywhere.

---

## §1 — WHAT IS ACTUALLY HAPPENING

### Every explanation the app shows

| # | Explanation | Trigger | Dismissed by | State stored in |
|---|---|---|---|---|
| T | **InteractiveTutorial** — 3-step full-screen overlay on Home | key absent on Home mount | Skip, or Continue past the last step | `has_seen_interactive_tutorial` |
| G | **Guided tooltips** — six, in sequence, during the first hand | `caps_games_played === 0` (or a one-shot `guidedModeForced`) | tapping each, or a 5–6s auto-dismiss | *nothing — see below* |
| H | **Board hint** — "Tap a card from your hand, then tap a board" | `gamesPlayed < 1`, whole arranging phase | nothing — it just sits there | *nothing — see below* |

Those are all of them. `utils/coachingEngine.ts` is post-hand analysis on `/coaching`, not an
opening explanation; the second and third strings in `hintTexts` have been unreachable since the
gate was tightened from `< 3` to `< 1`.

**G and H are gated on the same counter, and that counter has exactly ONE writer in the entire
codebase**: `app/game.tsx`, inside the reveal-done handler. It counts hands that reached the
reveal.

### Do they stay dismissed? Driven, not read.

`tests/tips-persistence.mjs` walks a returning player through a new device, a Skip, a reload, a
finished hand, a second hand, a new session and a cleared cache — in **both engines, both
languages, at 320 and 393**. All eight combinations agreed:

| Step | Result |
|---|---|
| New device, Home | tutorial shows, storage empty |
| Skip | writes `has_seen_interactive_tutorial`, overlay closes |
| **Reload** | tutorial does **not** return |
| Hand 1 | tips and board hint show; counter → `1` |
| Hand 2 | tips and board hint **gone**; counter → `2` |
| New session, same storage | nothing returns |
| Cleared cache | tutorial returns — correct, that is a stranger |

**On the happy path everything already behaved.** Finish one hand and the explanations stop for
good, across reloads and sessions.

### ⚠️ A CORRECTION I OWE, BECAUSE THE FIRST RUN SAID THE OPPOSITE

The first run of that probe reported the tutorial returning after every reload, in every
combination. That was **my probe, not the app**: it matched the Skip control on the exact text
`SKIP`, and the button reads `Skip ✕`. The click never landed, so the tutorial was never dismissed
and of course came back. Matching the accessibility label instead fixed it. A failed click looks
exactly like a failed feature, and I nearly filed one as the other.

### THE REAL DEFECT: the counter measures the wrong thing

The gate asks *"how many hands have you finished?"* The tips are asking *"have you been shown
this?"* A player who opens a hand, reads all six tips and leaves has been shown them. The counter
has not moved.

`tests/tips-abandon.mjs` — four hands opened and abandoned in a row, after dismissing the tutorial:

```
  hand 1: tips=true  boardHint=true  caps_games_played=null
  hand 2: tips=true  boardHint=true  caps_games_played=null
  hand 3: tips=true  boardHint=true  caps_games_played=null
  hand 4: tips=true  boardHint=true  caps_games_played=null
```

That repeats for ever, until a hand reaches the reveal. It is exactly what "sometimes it's really
annoying" feels like, and it is worst for whoever opens the app most and finishes least — which
is Roye, testing it.

**State lost on:** nothing, on the happy path — a reload, a new session and a relaunch all keep
it, and only a genuinely cleared cache resets, which is correct. The loss is not storage. It is
that **a dismissal was never written down at all** for G and H.

### VERDICT: BUG — they re-show. Not by design, and not a case for a setting.

---

## §2 — THE FIX

`utils/tipsSeen.ts` — a per-device set of dismissed tip ids in AsyncStorage, hydrated once into
memory so it can be read synchronously during render. **The flag moves to the event that actually
matters: the tip being seen and dismissed.**

- Each of the six tooltips records its own dismissal as it is dismissed. Abandon after tip 2 and
  the next hand starts at tip 3 — no repetition, and nothing skipped that you had not read.
- A suppressed tip does not stall the sequence: every hand-off is driven either by a game event
  or by the tooltip becoming invisible, which a suppressed tip satisfies at once. A returning
  player walks the whole chain silently.
- The board hint retires the moment the player does the thing it describes — places their first
  card. It taught its lesson.
- `tooltipStep <= 6` became `tooltipStep <= TIPS.length`. The count lives in the data.

**NO SETTING WAS ADDED, and none is warranted.** The annoyance now disappears for every player
rather than for the ones who go looking for a toggle. Settings went from 42 controls to 23
deliberately; this would have been control 24 — and a *second* one in the same family, because
"📖 Show tutorial" already exists in both Settings and the side menu. Those two replays now clear
the tips as well, so a replay replays all of it instead of returning the overlay and silently
keeping the six tips retired.

A first-time player still gets everything. Nothing is dismissed until they dismiss it, and
"off" is not a default anywhere.

---

## §3 — PROOF

**A brand-new device sees them; a returning device does not.** Table above, all eight combinations.
Not off by default: on a fresh context the tutorial, the six tips and the board hint all appear.

**Dismissal survives a reload, a new session and a relaunch** — and now survives abandonment:

```
  hand 1: tips=true  boardHint=true    <- taught
  hand 2: tips=false boardHint=true
  hand 3: tips=false boardHint=true
  hand 4: tips=false boardHint=true    <- never finished a hand; tips gone anyway
  hand 6, after one hand where cards were placed and abandoned:
          tips=false boardHint=false   <- the hint retires on the action it teaches
```

The board hint persisting through hands 2–4 is correct: that probe never placed a card, so the
player had not yet done the thing the hint describes.

**Both languages, both engines, 320 and 393:** identical results in all eight, before and after
the fix. No regression on the path that already worked.

**The first session still teaches a stranger — read as a person, not scanned.** On a new device
the overlay shows four real cards above the line *"Place 4 cards on each board"*, a Continue
button, three progress dots and a Skip. In the first hand the arrow points at the hand and the
tip reads *"Tap a card then a slot — or tap Auto-Place to fill a board fast."* over three visible
boards, twelve cards and a *"PLACE 12 CARDS"* header. Someone who has never seen the game learns
the rule, the gesture and the shortcut in that order, without reading a manual.
Screenshots: `A-new-device-home.png`, `abandon-hand-1.png`, `abandon-hand-4.png`,
`abandon-after-placing.png`.

---

## WHAT WAS NOT TOUCHED

Winner cue, card sizes, the 83px arc, the tie-tally arithmetic, `KILL_Board`. No payment flag. No
Edge Function deployed, so `verify_jwt` is unchanged on all of them. `isFirstGame` still drives
reveal pacing exactly as before — only the tooltips' visibility moved onto the new gate.

## ONE THING LEFT OPEN

`caps_games_played` still counts only hands that reach the reveal, and multiplayer never
increments it at all. Nothing depends on it now except reveal pacing, but it is a counter whose
name promises more than it delivers — worth a look before any number is quoted from it.
