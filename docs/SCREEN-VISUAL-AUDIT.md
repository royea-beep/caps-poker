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

**I visually reviewed 8 screens. The other 14 are captured and instrument-triaged but NOT looked
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

### Replay, no hand — **EMBARRASSING**

A fully black screen with "Hand not found" in grey and a gold `← BACK` button floating in the
middle. No header, no branding, no explanation of what happened or what to do next. It does not
read as an empty state; it reads as a crash page. A tester who taps a stale replay link will
screenshot this and ask whether the app broke. It is also the thinnest screen in the app — 21
characters total.

### Play — **COSMETIC**, plus one content bug worth checking

Well composed and clearly the strongest screen reviewed so far: five mode cards, generous
spacing, each with an icon and a one-line explanation. Two things.

**Five cards, five different border colours** — gold, mint, blue, green, pink — assigned with no
visible system. Immediately after a week spent establishing that gold means won, mint means the
field and white means neutral, this screen uses colour decoratively. The gold border on "Single
Player" is the same gold as the winner cue.

~~**"Single Player · Practice vs bots · 3 boards"** hardcodes a board count.~~ **WITHDRAWN
2026-08-15 — I was wrong.** `app/(tabs)/play.tsx:52` reads
`Practice vs bots · {getBoardCount(config.numberOfPlayers)} boards`. It is derived, exactly as
the rule requires. It rendered "3 boards" because the persisted config was 3 players when I
captured it. The flag came from reading a screenshot and inferring the code behind it, which is
the same mistake in the opposite direction from the one this audit exists to correct — looking is
how you find a defect, not how you confirm one. Checked in code, retracted.

The gold on that card is real and separate: `borderColor: '#F5B546'` hardcoded at
`app/(tabs)/play.tsx:48`.

Also: roughly the bottom third of the screen is empty. Top-weighted rather than balanced.

### Stats, empty — **CLEAN**, and it is the reference

Header with `‹ Back` and title, a chart icon in a soft circle, "No stats yet", a plain
explanation ("Play a few hands and your stats appear here"), two skeleton placeholder cards
showing the shape of what will arrive, and a mint **Play Now** button. Designed, calm, and it
tells a day-one player what to do next.

**This is the finding, not the screen.** The pattern exists and is good. `replay` renders a black
screen with no header, no icon, no guidance and a floating gold Back button. The gap between
these two empty states in the same app is what a tester will notice, and it means fixing `replay`
is a matter of applying an existing pattern rather than designing one.

### Rank — **EMBARRASSING** (content, not layout)

Structurally sound: tier medallion, ELO, progress bar to the next tier, a placement-games card,
a 0/0/0% stat row, and a tier ladder. Two problems, both in what it *says*.

**"Rank #738 of 754"** is shown to a player with zero games. Day one, the first number the app
gives you about yourself is that you are 738th of 754. That is a discouraging first impression
and it is on a screen a tester will open early.

**The screen contradicts itself.** It says "Complete 10 more games to set your official rank!"
and "0/10 games", while simultaneously asserting a rank (#738), a tier (Amateur) and a
**CURRENT** badge on that tier. Either the rank is provisional or it is not; the screen claims
both.

Minor: `ELO: 1000` is gold — a stat, not a win (see the sweep). The tier ladder is cut at the
bottom, but it scrolls, so that is the clip count behaving correctly.

## Gold-as-chrome sweep — all 22 routes

Swept for the settled gold (`#c9a84c` and its siblings `#FFD24A`, `#F5B546`, `#FFD700`) used as
background, border or text. **The violations are controls and headlines; the legitimate uses are
currency and brand.** This is one fix, not eighteen.

**Gold used as chrome — the list:**

| screen | element | role |
|---|---|---|
| home | `Continue` button, 307×46 | **solid gold background** on a navigation control |
| home | carousel active dot, 22×8 | solid gold background |
| home | onboarding card border, 353×249 | border |
| home | avatar ring 64×64, `SIGN OUT` text | tint + border, text |
| play | "Single Player" card border, 353×77 | **border on a control** |
| theme-pick | `SELECT` button, 93×33 | **solid gold background** on a control |
| gameover | `MAIN MENU`, 115×21 | **text on a control** |
| replay | `← BACK`, 92×44 | **tint background + border on a control** |
| rank | "🎯 Placement Games" heading | headline text |

**Legitimate under the settled map, not to be changed:**
currency — leaderboard's ten chip amounts, home's "💰 2,530 chips", gameover's balance (MEMORY
records medals and currency as semantic gold); brand — the `CAPS POKER` wordmark on home and
theme-pick; theme identity — the CLASSIC card on settings and theme-pick, where gold *is* that
theme's accent.

Routes with no gold at all: friends, cups, profile, achievements, shop, chip-store, missions,
stats, hand-history, results, lobby, battle-pass, referral, coaching.

## The 10px band — NINE fixes, not one, and that is the finding

The gold sweep was worth doing because gold was **one settled map applied inconsistently**, so
correcting it is one decision. I expected the small-text band to be the same shape. It is not.

`fontSize: rf(10)` and `rf(9)` are declared **independently in at least fifteen files** — 30+
separate declarations, each inside that screen's own local `StyleSheet`. There is no shared type
token, no `caption`/`label`/`micro` scale, nothing to change in one place:

`(tabs)/cups.tsx:71` · `(tabs)/profile.tsx:63` · `(tabs)/index.tsx:2283, 2376, 2393, 2435, 2478` ·
`leaderboard.tsx:323, 338, 352` · `battle-pass.tsx:477, 522, 571, 649` · `coaching.tsx:60, 96,
106, 112` · `hand-history.tsx:440, 499, 504` · `chip-store.tsx:375` · `club/[code].tsx:232, 243,
260` · `game.tsx:1487, 1612` · `AvatarPicker.tsx:138` · `AchievementToast.tsx:78` ·
`heatmap.tsx:409` (`rf(8)`)

**So raising the floor is not a one-line change; it is a decision about whether this app should
have a type scale at all.** Right now every screen re-declares its own sizes, which is why the
band exists and why it will drift again after any one-off fix. That is the real item, and it is
architectural rather than cosmetic. Recorded, not fixed, and explicitly not ordered.

## Screens CAPTURED and instrument-triaged, but NOT visually reviewed

Flags below are from the probe, not from looking. **None of these is cleared.** `minFont` is the
smallest rendered text on the screen; `clip` counts elements cut off by an ancestor.

| screen | minFont | clip | probe flags | status |
|---|---|---|---|---|
| ~~rank~~ | — | — | — | **REVIEWED — EMBARRASSING** |
| battle-pass | **9px** | 3 | — | NOT REVIEWED |
| leaderboard | 10px | **8** | — | NOT REVIEWED |
| achievements | 10px | **7** | — | NOT REVIEWED |
| lobby | 10px | 3 | — | NOT REVIEWED |
| settings | 10px | 2 | — | NOT REVIEWED |
| referral | 12px | 1 | — | NOT REVIEWED |
| friends · cups · profile | 10px | 0 | — | NOT REVIEWED |
| shop · chip-store · missions | 11–12px | 0 | — | NOT REVIEWED |
| theme-pick | 10px | 0 | — | NOT REVIEWED |
| ~~stats~~ | — | — | — | **REVIEWED — CLEAN, the reference empty state** |
| hand-history | 12px | 0 | empty state | NOT REVIEWED |
| coaching | 14px | 0 | empty state | NOT REVIEWED |
| gameover | 12px | 0 | — | NOT REVIEWED |
| results (no hand) | 15px | 0 | empty state | NOT REVIEWED |
| ~~replay~~ | — | — | — | **REVIEWED — see above, EMBARRASSING** |

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

## Summary — all 22 routes

| screen | class | one line |
|---|---|---|
| home (onboarding) | **EMBARRASSING** | first-run carousel spends gold on a `Continue` button; heavy dim hides the screen behind |
| game 393, 4 boards | COSMETIC | reads as one family now; tutorial tip covers Board 4 |
| game 1706 | COSMETIC | same; tip covers Board 3, Board 4 below the fold (accepted) |
| reveal | **CLEAN** | gold winner border against mint field, neutral hand — reads correctly |
| replay (empty) | **EMBARRASSING** | black screen, no header, floating gold Back — reads as a crash page |
| play | COSMETIC | strongest screen; five border colours with no system; bottom third empty |
| stats (empty) | **CLEAN** | the reference empty state — icon, headline, explanation, skeletons, mint CTA |
| rank | **EMBARRASSING** | "#738 of 754" to a player with 0 games, and the screen contradicts its own "no official rank yet" |
| battle-pass | *not reviewed* | 9px text, 3 clipped elements |
| leaderboard | *not reviewed* | 8 clipped elements |
| achievements | *not reviewed* | 7 clipped elements |
| lobby | *not reviewed* | 3 clipped |
| settings | *not reviewed* | 2 clipped |
| referral | *not reviewed* | 1 clipped |
| friends · cups · profile | *not reviewed* | 10px band |
| shop · chip-store · missions | *not reviewed* | — |
| theme-pick | *not reviewed* | gold `SELECT` button |
| hand-history (empty) | *not reviewed* | compare against `stats` |
| coaching (empty) | *not reviewed* | compare against `stats` |
| results (empty) | *not reviewed* | compare against `stats` |
| gameover | *not reviewed* | gold `MAIN MENU` control |

**BLOCKER: none found in the 8 reviewed.** Nothing yet gates the tester round on visual grounds.
That is a statement about 8 screens, not 22.

## Why this is going slowly, plainly

The constraint is **working context per session, not effort**. Each screenshot costs a large,
fixed share of the window to actually look at, so the honest rate is **2–4 screens per session**,
and no amount of urgency changes it. The last three sprints did 4, 2 and 2 — that is the real
throughput, and at it the remaining 14 need roughly four more sessions.

Two ways to go faster, both trade-offs worth naming rather than absorbing silently:
- **Crop before looking.** Most findings so far were in the top third or a single control. Capturing
  and reviewing regions rather than full 393×852 pages would roughly double the rate at the cost
  of missing whole-screen composition problems — which is where `play`'s empty bottom third and
  home's heavy dim came from.
- **Accept the audit spans sessions** and keep the not-cleared list honest, which is what it does
  now.

I am not choosing between these; it is Roye's call whether coverage or composition matters more.

## Where this stopped

After 8 screens reviewed by eye out of 22 captured. Everything above the divider is a finding I
saw; everything below it is a queue with triage flags attached, and it is explicitly not cleared.
The next session should open the images in the order the flags suggest: rank, battle-pass,
leaderboard, achievements, then the five empty states.

**Nothing was fixed in this sprint**, per brief — including the gold onboarding button and the
tutorial tip over Board 4, both of which are recorded here for Roye to order.
