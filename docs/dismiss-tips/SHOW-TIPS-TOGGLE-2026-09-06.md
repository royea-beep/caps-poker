# SHOW TIPS — THE TOGGLE — 2026-09-06

Roye asked for a button. Last sprint I found a real bug behind the complaint and then decided, on
his behalf and without asking, that the button was no longer needed. **That was not my call.** The
correct move was to report the bug and ask whether he still wanted the toggle. He does. It is here.

Branch `claude/vamos-caps-align-celebration-flppo0`. `tsc` clean. **2,753 / 2,753 tests.**
No Edge Function was deployed, so `verify_jwt` was not touched anywhere.

---

## 1 — THE TOGGLE

**One switch, "Show tips", in Settings → TOOLS**, directly above Report a bug —
`app/settings.tsx:318` (the component) and `app/settings.tsx:1221` (where it is mounted).

| | |
|---|---|
| Label | "Show tips" / "הצגת טיפים" |
| Sub-label | "The opening explanations at the start of a hand. Off hides all of them." |
| Default | **ON.** `caps_show_tips` is absent until someone deliberately moves it, and only an explicit `'false'` turns it off. A missing key, a corrupt key and a stray value all mean ON. |
| Role | `accessibilityRole="switch"` with `accessibilityState.checked`, so it is reachable by label |
| Storage | `caps_show_tips`, per device, beside the tip state built last sprint |
| Dimensions | none introduced — it reuses `styles.row`, `rowLabel`, `rowHint`, `toggleBtn`, which are already `rf`/`rs` based |

**Off suppresses all three explanations**, because "the opening explanations" means all of them and
a switch that silenced two of three would read as broken:

- the InteractiveTutorial overlay on Home,
- the six guided tooltips during a hand,
- the board hint.

The switch is enforced in **one place** — inside `isTipDismissed()` in `utils/tipsSeen.ts`, which
every in-game surface already consults. One line covers the tooltips and the hint, and no surface
can be missed. The Home overlay checks `areTipsEnabled()` directly, after the store hydrates so
the ON default can never flash the overlay at someone who turned it off.

**Turning it back ON restores them.** `setTipsEnabled(true)` also clears every dismissal and the
onboarding-seen flag. Without that the switch would work exactly once — off, then on, then
nothing, because everything is still marked seen — and a switch that only works in one direction
is not a switch.

**Only one control was added.** No per-tip preference, no second toggle, nothing else. Settings
went from 42 controls to 23 deliberately; this is control 24 and it has to earn its place alone.
The existing "📖 Show tutorial" replay is unchanged and is not part of this.

---

## 2 — THE BUG FIX STAYS

Both are needed and they answer different questions. The fix stops the tips **naturally** once
they have been read — the right default. The switch lets a player silence them **now**, without
reading six of them first.

Re-run after the toggle shipped, four hands opened and abandoned:

```
  hand 1: tips=true  boardHint=true  caps_games_played=null
  hand 2: tips=false boardHint=true  caps_games_played=null
  hand 3: tips=false boardHint=true  caps_games_played=null
  hand 4: tips=false boardHint=true  caps_games_played=null
  hand 6, after one hand where cards were placed and abandoned:
          tips=false boardHint=false
```

Unchanged. A seen tip does not return. **Nothing in `tipsSeen` was removed.**

**A new player with the switch ON is still taught.** The toggle changes nothing about the first
run: on a fresh device `caps_show_tips` is null, which is ON, and the overlay, the six tooltips
and the board hint all appear exactly as before.

---

## 3 — PROOF, DRIVEN

`tests/tips-toggle.mjs`. **Every control matched by its accessibility label, never by visible
text** — that is the trap that produced a false finding last sprint, when the probe matched the
exact string `SKIP` against a button reading `Skip ✕`, the click never landed, and the report said
the tutorial returned after every reload when it had never been dismissed.

All eight combinations — chromium and webkit, English and Hebrew, 320 and 393 — identical:

| Step | Result |
|---|---|
| 1 New device, switch untouched | tutorial **true**, tips **true**, hint **true**; `caps_show_tips` null |
| 2 Switch OFF (`true`→`false`) | game: tips **false**, hint **false**; home: tutorial **false** |
| 3 Switch back ON (`false`→`true`) | home: tutorial **true** again; game: tips **true**, hint **true** again |
| 4 OFF, then reload | tutorial **false** |
| &nbsp;&nbsp;&nbsp;then a new session | tutorial **false**, tips **false**, hint **false**; `caps_show_tips` `"false"` |

Step 3 is the one that matters: everything had already been seen and dismissed, and turning the
switch on brought all three back.

**Looked at, not just measured.** The switch renders as a labelled row with its explanation
underneath and an ON/OFF pill, correctly mirrored in Hebrew. With tips off, Home is clean — no
overlay over the CAPS wordmark and the two play buttons.
Screenshots: `switch-en-393-on.png`, `switch-en-393-off.png`, `switch-he-393-on.png`,
`switch-he-393-off.png`, `switch-en-320-on.png`, `switch-en-320-off.png`, `toggle-off-home.png`,
`toggle-on-again-home.png`.

---

## ONE ASSERTION I HAD TO CORRECT

`tipsSeen.test.ts` carried a line asserting that **no** tips control existed anywhere in Settings.
I wrote it last sprint to enforce the conclusion I should not have reached alone. It is replaced
by an "exactly ONE control" block, which enforces the rule that actually matters: the switch
exists once, is a real switch, is reachable by label, and no per-tip preference crept in beside it.

## WHAT WAS NOT TOUCHED

Winner cue, card sizes, the 83px arc, the tie-tally arithmetic, `KILL_Board`. No payment flag. No
Edge Function deployed. Economy, security and layout unchanged. `caps_games_played` still drives
reveal pacing exactly as before.
