# Screen visual audit — 2026-08-15

Roye's correction, and the reason this document exists:

> "אתה יכול לצלם מסך לעצמך ולנתח כל עמוד ועמוד בפרויקט — אני לא מבין למה כל פעם אתה מדלג על השלב הזה"

He is right. He found three defects by eye that automated sweeps missed entirely — the tooltip
covering six cards, the ✕ over the practice pill, and the Auto-Place pill with no home. Each time
the numbers said clean and the numbers were correct; they were answering a different question.

**Method, deliberately inverted from every prior sprint:** capture → **look** → measure only to
confirm something already seen. A geometry sweep cannot report a control sitting on a line, text
too small to read, cramped spacing, or content cut off (a clip is not an intersection — Rule 22).

## Scope and honesty about it

**32 routes exist**, not the ~53 estimated. Of those, 22 are player-reachable and were captured at
393×852, Chromium, fresh mounts. The remaining 10 are either dev-only (`debug`, `simulate`,
`spectate`, `heatmap`), parameterised deep links (`club/[code]`, `invite/[code]`, `lobby/table`,
`lobby/private`), or the two in-game routes already reviewed this session (`game`,
`multiplayer-game`).

**I visually reviewed 4 screens. The other 18 are captured and instrument-triaged but NOT looked
at.** That distinction is the whole point of this sprint and it is stated per row below rather
than blurred. Marking a screen "clean" because a probe returned no flags would be the exact
substitution this audit exists to stop.

---

## Screens I LOOKED at

### Home — onboarding overlay · **EMBARRASSING**

The first-run carousel renders in **gold**: a solid gold `Continue` button and a gold headline
"Place 4 cards on each board". Two weeks of work settled that **gold means won and nothing else** —
mint is the field, white/neutral is chrome — and the winner cue was rebuilt across four
implementations to honour it. The very first screen a new player sees spends gold on a
navigation button. Nothing is broken; it contradicts the rule everywhere else now obeys.

Also seen: the dim layer behind the card is heavy enough that the home screen is almost fully
black — legible as focus, but the wordmark, the streak chip and the referral code are all reduced
to near-invisible silhouettes. Worth a second opinion; it may be intentional.

*Measured after seeing it:* smallest rendered text anywhere on this screen is **8px**, the
smallest in the entire capture set.

### Game screen, 4 boards / 16 cards, 393 — **COSMETIC** (one item, recorded not fixed)

The four board headers and the hand header now read as one family — `BOARD N` … `⚡ Auto-Place`
above, `YOUR HAND (16)` … `⚡ Auto-Place ALL` below, all four chips right-aligned on the same
vertical line. The bare band under the hand panel is gone.

Remaining: **the tutorial tip sits across Board 4's header and cards.** Board 4 is labelled and
partially visible; the tip covers most of it. Filtered correctly by every sweep as "overlay-kind",
and visually wrong for a player whose fourth board is the one being obscured.

### Game screen, 1706×960 — **COSMETIC**

Same family resemblance holds at desktop. Board 4 is entirely below the fold; the tip sits on
Board 3. Board scrolling is accepted by Roye, so only the tip placement is a finding.

### Reveal — **CLEAN**

Winning community cards carry the gold 3px border against mint field frames and neutral hand
borders. Reads correctly; nothing cramped, nothing cut.

---

## Screens CAPTURED and instrument-triaged, but NOT visually reviewed

Flags below are from the probe, not from looking. **None of these is cleared.** `minFont` is the
smallest rendered text on the screen; `clip` counts elements cut off by an ancestor.

| screen | minFont | clip | probe flags | status |
|---|---|---|---|---|
| rank | **9px** | 7 | — | NOT REVIEWED |
| battle-pass | **9px** | 3 | — | NOT REVIEWED |
| leaderboard | 10px | **8** | — | NOT REVIEWED |
| achievements | 10px | **7** | — | NOT REVIEWED |
| lobby | 10px | 3 | — | NOT REVIEWED |
| settings | 10px | 2 | — | NOT REVIEWED |
| referral | 12px | 1 | — | NOT REVIEWED |
| play · friends · cups · profile | 10px | 0 | — | NOT REVIEWED |
| shop · chip-store · missions | 11–12px | 0 | — | NOT REVIEWED |
| theme-pick | 10px | 0 | — | NOT REVIEWED |
| stats | 14px | 0 | empty state | NOT REVIEWED |
| hand-history | 12px | 0 | empty state | NOT REVIEWED |
| coaching | 14px | 0 | empty state | NOT REVIEWED |
| gameover | 12px | 0 | — | NOT REVIEWED |
| results (no hand) | 15px | 0 | empty state | NOT REVIEWED |
| replay (no hand) | 13px | 0 | **renders 21 characters total** | NOT REVIEWED |

**Empty states that exist and render something sane by text:** `stats` ("No stats yet"),
`hand-history` ("No hands"), `coaching` ("No coaching yet"), `results` ("This hand is no longer
available"), `replay` ("Hand not found"). `replay` is the thinnest — 21 characters and a back
link — and is the most likely of the five to read as broken rather than empty. All five need
looking at, none has been.

**Debug or placeholder artifacts:** none detected by the probe (`lorem`/`TODO`/`undefined`/`NaN`/
`[object`) on any of the 22 routes. Not a substitute for looking.

**Text too small — candidates by measurement, pending the eye test:** home **8px**, rank **9px**,
battle-pass **9px**, then a large 10px band (play, friends, cups, profile, settings, leaderboard,
achievements, lobby, theme-pick, missions). The 8px and 9px cases are below anything defensible
at arm's length; the 10px band needs judgment, not arithmetic.

---

## Where this stopped

After 4 screens reviewed by eye out of 22 captured. Everything above the divider is a finding I
saw; everything below it is a queue with triage flags attached, and it is explicitly not cleared.
The next session should open the images in the order the flags suggest: rank, battle-pass,
leaderboard, achievements, then the five empty states.

**Nothing was fixed in this sprint**, per brief — including the gold onboarding button and the
tutorial tip over Board 4, both of which are recorded here for Roye to order.
