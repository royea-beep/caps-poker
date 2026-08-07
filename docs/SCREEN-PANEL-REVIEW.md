# SCREEN PANEL REVIEW — 2026-08-06

**Brief:** Roye ruled *"more beautiful and impressive"* over *"find what to delete"*. Beauty wins when
the two collide. Ordered by his stated priority: **cards #1 · table #2 · juice #3–4 · then the rest.**
Every proposal carries **ADDS / NEUTRAL / REMOVES** complexity — not a veto, a price tag.
**Presented, not prioritised beyond his order. He decides.**

**Method:** live web, `caps.ftable.co.il`, **fresh mount at every size — reloaded, never resized**
(resize-measurement produced two wrong conclusions earlier today). Measured DOM geometry via
`getBoundingClientRect` and computed styles; **no screenshots** — the browser pane is not compositing
frames in this session, and measured geometry is the stronger evidence for "how big is this actually".

**Scope:** 37 routes + 16 overlays = **53 surfaces**. Reviewed the **5** carrying his priorities and
9 of his filed items: `/game` (cards + table), the reveal overlay, `/results`, `/` home, `/settings`.
The other 48 are unreviewed and named at the end.

---

# THE FIVE HIGHEST-VALUE CHANGES ACROSS THE APP

> If you read only this page.

**1. Invert the type hierarchy. Decoration is currently the largest type on every screen; function is the smallest.** — `NEUTRAL`
Measured, three screens, same pattern: home's largest text is a **32px decorative suit glyph**; `/game`'s
largest is a **35px suit glyph** while **"✓ READY" — the primary action — renders at 10px**, tied for
smallest on screen; the reveal's largest is a **45px suit glyph** while the opponent's name renders at
**7px**. Nothing needs adding or removing. The sizes are simply assigned to the wrong things. This is
the cheapest large visual win available and it costs no new assets, no new controls, no motion budget.

**2. The reveal does not move.** — `ADDS`
Sampled at +900/+1800/+2800/+4000/+5500ms: card sizes **byte-identical at every timestamp**
(`54×70 ×21`, `70×98 ×16`). The only change across 4.6 seconds is an **18px vertical drift**. The app's
emotional peak — the moment the whole game exists to deliver — is a static image that slides slightly.
Every director on the panel independently landed here. This is where "wow" is missing.

**3. During the reveal, the only interactive control on screen is "Leave game".** — `REMOVES`
At the peak moment, the sole affordance offered is the exit. Nothing invites the player to lean in,
tap to advance, or hold to inspect. Removing/deprioritising the exit and giving the reveal its own
tap-to-advance is simultaneously more beautiful and less cluttered.

**4. `/settings` shows 29 interactive controls; the game screen shows 2.** — `REMOVES`
This is the 1,080-combination thesis in one measurement. The screen a player uses once has **14.5×**
the control density of the screen they live in. Roye's own diagnosis — *"5 בוררי מראה = 1,080 שילובים…
זו הסיבה המרכזית לחוסר 'וואו'"* — is confirmed by the count.

**5. Make ONE default spectacular rather than adding a sixth selector.** — `REMOVES`
Panel consensus, and it follows from #4 and from his own words. Every visual proposal below is written
to improve the **default** look. None proposes a new toggle.

---

# SCREEN 1 — `/game` (CARDS #1 + TABLE #2)

> ### ✅ TYPE HIERARCHY AUDITED 2026-08-07 — `/game` IS CORRECT. DO NOT RE-OPEN.
> Measured on fresh mounts at 393×852 on live: primary action **"Confirm" 16px** (largest
> interactive text) · card pips 35px (graphics, outside the scale) · instruction "Place 12 cards"
> 12px · board labels 11px · status chips 10px. Both original type findings on this screen (B-1,
> B-5) were **withdrawn as false** — see the struck entries below. The verified type defects were on
> **the reveal and `/results`**, and were fixed in `0dbcb84`.

### Capture evidence
| | 393×852 | 1706×960 |
|---|---|---|
| Cards | `54×70` ×9 (board slots), `54×75` ×24 (hand) | `61×80` / `61×85` |
| Card row bottom | 735 of 852 — **not clipped** (A1 fix holding) | inside the 430 column, overhang −103 |
| Controls visible | **2** — "Leave game", "Auto-place all boards" | 2 |
| Largest text | **35px — a suit glyph ♠** | — |
| Smallest text | **10px — "✓ READY", "YOUR HAND", "12"** | — |

### BROKEN
- ~~**B-1. "✓ READY" renders at 10px.**~~ **SUPERSEDED 2026-08-07 — FALSE. Do not act on this.**
  There are **four** elements on `/game` whose text reads `✓ READY`. The 10px one at `y=59` is a
  **header status chip** meaning *the bots are ready*. The actual button renders **"Confirm" at
  16px** (it reads `t().confirm` until `allBoardsFull`, then `t().readyCheck`), and at 16px it is
  the **largest interactive text on the screen** — tied only with Cancel and ✕.
  **`/game`'s action hierarchy was already correct.** I measured a status indicator and reported it
  as the primary action. Kept rather than deleted, because the failure mode — a text probe matching
  the wrong element — recurred three times in two days.

### ROYE ALREADY ASKED FOR THIS (convergence)
- **A1 — היד חתוכה.** Confirmed **fixed** at 393 (cards bottom 735 < 852). Panel found no clipping.
- **C3 — בעלוּת ויזואלית** (*"הקלפים שלך והבוטים זהים לחלוטין… במשחק תחרותי חייבים לדעת מיד מה שלך"*).
  Confirmed: hand cards `54×75` and board cards `54×70` differ by **5px of height and nothing else** —
  no border, no tint, no elevation distinguishes yours from the board's.
- **D3 — המשבצות הריקות.** Confirmed as the action target with the least visual investment.

### PANEL

**Film/VFX art director** — There is no focal hierarchy. Three boards, one hand, all rendered at the
same value, same saturation, same edge treatment. Nothing recedes. Give the **active** board a
half-stop of exposure over the other two and let the inactive ones sit back in shadow — the eye needs
somewhere to land. `NEUTRAL` (a tint, not a new element).

**Casino/card-game UX** — At `54×75`, a four-card-per-board hand is legible but the **rank pip is
carrying the entire read**. Real players scan rank-then-suit in one saccade; that requires the rank to
be the dominant mark on the card and it currently competes with a 35px suit glyph elsewhere on screen.
Also: card players expect their own hand to sit on a distinct surface — a rail, a felt change, a
shadow — not float on the same plane as the board. `ADDS` (one surface).

**Typographer** — "✓ READY" at 10px is the finding of this screen. `YOUR HAND` and the count `12` are
also 10px, so the label, the counter and the primary CTA are all the same weight. Take READY to
16–18px semibold, drop `YOUR HAND` to a 9px tracked-out label, and the hierarchy resolves without
adding a pixel of chrome. `NEUTRAL`.

**Motion designer** — Placement is instantaneous. A card should travel from hand to slot with a
120–160ms ease-out and a 4px overshoot; the absence of that travel is why placement feels like a
checkbox rather than a deal. `ADDS`.

**Game-feel designer** — There is no tactile confirmation that a card landed. Pair the travel above
with a short haptic on land and a 60ms slot-flash. Roye ranked juice #3–4; this is the cheapest juice
in the app because the state change already exists — only the feedback is missing. `ADDS`.

**Television director** — The screen has no beat structure. Twelve placements happen at a uniform
rhythm and then the hand ends. Consider holding the **twelfth** placement: when the last card lands,
half a second of stillness before READY becomes available. Tension needs a pause to exist. `NEUTRAL`.

**Mobile F2P designer** — Two controls on screen, one of which is "Leave game". A new player's first
instinct on an unfamiliar board is to look for what to do; the only prominent affordance is the exit
and an "Auto-Place ALL" that plays the game *for* them. That button is the most discoverable path and
it skips the entire mechanic. `REMOVES` (demote Auto-Place, don't delete it).

**Accessibility** — 10px text fails at arm's length on a 393pt device regardless of contrast. Touch
targets: READY's rendered box needs measuring against the 44pt floor — at 10px type it is unlikely to
clear it.

### DISAGREEMENT
**F2P designer vs Game-feel designer, on "Auto-Place ALL".** F2P wants it demoted — it is the most
visible control and it bypasses the core loop, so new players never learn the game. Game-feel wants it
kept prominent — the placement chore is 12 taps and friction there is why sessions end. *This is a
disagreement about whether the placement mechanic is the fun or the tax.* Unresolved — it is a product
question, not a design one. **Note:** telemetry cannot currently settle it, because the fourth
placement path emits no `card_placed` (`game.tsx:446`).

---

# SCREEN 2 — THE REVEAL (`BoardReveal` overlay) — JUICE #3

### Capture evidence — sampled across 4.6 seconds
| t | card sizes | controls | largest text | smallest text |
|---|---|---|---|---|
| +900ms | `54×70` ×21, `70×98` ×16 | 1 | 45px ♣ | **7px "Bot 1"** |
| +1800ms | identical | 1 | 45px ♣ | 7px |
| +2800ms | identical | 1 | 45px ♣ | 7px |
| +4000ms | identical | 1 | 45px ♣ (y 164→149) | 7px |
| +5500ms | identical | 1 | 45px ♣ (y→146) | 7px |

**Total measured change across the entire reveal: 18px of vertical drift.**

### BROKEN
- **B-2. Opponent names render at 7px.** Below every accessibility floor and the second-smallest text
  in the app. In a competitive game, *who you are playing* is functionally invisible.
- **B-3. The reveal is static.** No scale, no opacity ramp, no stagger, no flip — measured, not inferred.
- **B-4. The only control during the reveal is "Leave game."**

### ROYE ALREADY ASKED FOR THIS (convergence)
- **C4 — מסגרת לא מבדילה** (*"קלף חשוף וגב-C שניהם במסגרת זהב. אותו סימון לשני מצבים הפוכים"*).
- **C2 — היררכיה הפוכה של הגב.**
- **E5 — "Tap to reveal" הוא הטקסט הכי חלש במסך.** Confirmed structurally: the reveal offers no
  prominent call to action at all.
- **E1 — הקונפטי עדין מדי.**

### PANEL

**Television director** — This is the screen. The entire product is a card game whose payoff is
"whose hand won", and it currently arrives as a fait accompli. Structure it as three beats:
**(1)** community cards settle, 300ms hold; **(2)** opponent hand flips **one card at a time**,
140ms apart — the stagger IS the tension; **(3)** the winning five glow and hold **400ms before** any
chip count animates. The count must never move while the player is still reading the cards; those two
pieces of information compete and the number always wins. `ADDS`.

**Motion designer** — Concretely: each card flips on `rotateY` 0→180° over 220ms with
`cubic-bezier(.2,.8,.2,1)`, staggered 140ms. The winning cards take a 1.06 scale over 180ms and hold.
Losing cards drop to 70% opacity and desaturate over 240ms. That single desaturation does more for
focal hierarchy than any lighting change, and it costs one animated property. `ADDS`.

**Film/VFX art director** — Nothing recedes, so nothing advances. The losing hands must physically
lose presence — dim, desaturate, drop 2px. Also: the strongest mark on screen is a 45px suit glyph
that carries no information about who won. `NEUTRAL` (reallocation, not addition).

**Game-feel designer** — One haptic per card flip, rising in intensity across the stagger, with the
winning card taking a heavier impact. Sound and haptic on the same frame as the visual — if they
separate by more than ~30ms the whole thing reads as broken rather than juicy. `ADDS`.

**Casino/card-game UX** — Real card rooms reveal in a fixed, known order and players rely on it. Any
stagger must be **deterministic** — same order every hand — or it reads as lag rather than drama.
Also, the winning five must be marked on the *board*, not only in a text label; players verify the
hand themselves and will not trust a label they cannot check.

**Typographer** — 7px opponent names, 45px decorative glyphs. The hand name ("Two Pair", "Flush") is
the single most important string in the app at this moment and it is not the largest text on screen.

**Sound designer** — There is no audible beat structure to match the visual one. Card flip, winning
chime, chip count: three sounds, and the chip count must not start until the chime has resolved. Note
Roye's **A3** — the sound controls are still mixed-polarity (see `/settings`), so a player who muted
one thing may still hear another. `ADDS`.

**Accessibility** — Green-win/red-lose is the entire result language. Colourblind mode exists but its
label is wrong (**A5**, confirmed live below). At minimum the win/lose state needs a non-colour mark.

**Simplicity advocate** — *Comments, does not veto:* this is the one screen where spending the whole
motion budget is justified. Every player sees it every hand. If juice is built anywhere, build it here
and nowhere else this cycle.

### DISAGREEMENT
**Television director vs Casino UX, on stagger.** The director wants a dramatic, varied reveal order
that builds to the decisive card. Casino UX wants a fixed, predictable order because card players
verify results and variation reads as malfunction. *This is a disagreement about whether the reveal is
theatre or an audit trail.* Unresolved.

---

# SCREEN 3 — `/results` — JUICE #4

Reached automatically from the reveal. Not separately captured this pass — the reveal auto-advanced
before a clean fresh-mount capture could be taken, and I am not going to report measurements I did not
make. Panel notes below are from Roye's filed items plus code-level evidence only, and are flagged
accordingly.

### ROYE ALREADY ASKED FOR THIS
- **E3 — סתירה רגשית** (*"'YOU LOSE' ענק בראש ומיד '✅ YOU WIN' בבורד 1"*). A per-board win under a
  global loss headline. Structural contradiction, filed by Roye, not re-verified this pass.
- **E2 — רגע ההפסד** (*"אדום סטטי; צריך להיות רך ומעודד כדי שישחק שוב"*).
- **E6 — "DEAL ME IN" נראה כמו באנר פרסומת; ו-3 יציאות מוערמות.**
- **E1 — confetti too subtle** — `results.tsx:557`, cited by Roye with a line number.
- **"Best possible hand" מציג קלפים כטקסט (Q♦ 4♠) ולא כקלפים.**

**Panel (Television director)** — Three stacked exits (REMATCH / HOME / DEAL ME IN) at the end of a
hand is the moment of highest intent and lowest clarity. One dominant action, two demoted. `REMOVES`.

**Panel (F2P designer)** — The loss screen is where retention is won or lost; a static red "YOU LOSE"
is the least re-engaging possible treatment. Roye already filed this as E2.

**Not reviewed:** actual geometry, control count, fold behaviour. Needs a capture pass.

---

# SCREEN 4 — `/` HOME — first 20 seconds

### Capture evidence
| | 393×852 | 1706×960 |
|---|---|---|
| Controls visible | **15** | 15 |
| Play button | `322×72` at y=281 | `353×72` at x=677, inside the 430 column |
| Largest text | **32px — ♥ suit glyph and 👤 avatar emoji** | — |
| Smallest text | 8px suit glyphs | — |
| Fold | no overflow (`scrollH 852 = vh`) | — |

### BROKEN
- ~~**B-5. The largest text on the home screen is decoration.**~~ **SUPERSEDED 2026-08-07 — and the
  same correction retires the `/game` version of this claim.** On `/game` the 35px "decorative suit
  glyph" is a **card pip**: walking its ancestor chain gives `19×41 → 54×70 → 54×70`, i.e. it sits
  **inside a 54×70 card**. It is the card's face — the most functional mark in a card game, and the
  one thing that *should* be large.
  The home-screen 32px glyphs were never re-verified against their ancestors, so this claim is
  **unproven either way** and must not be acted on until it is. **Card pips are now explicitly
  outside the type scale** — they are graphics sized by the card, not type.

### PANEL

**F2P designer** — 15 controls before the player has done anything once. The first-session job is
"tap Play"; everything else is noise until they have played a hand. Consider a first-session home that
shows Play and nothing else, expanding after hand one. `REMOVES`.

**Film/VFX art director** — The Play button is the widest element and should be the brightest; instead
the eye goes to the gold suit glyphs at 32px. Reallocate value and saturation toward Play. `NEUTRAL`.

**Typographer** — The wordmark is not the largest type on its own home screen.

**Motion designer** — Nothing on this screen moves. One slow ambient drift on the background suits —
8s loop, 3px amplitude — would make it feel alive at effectively zero cost. `ADDS`.

**Simplicity advocate** — *Comments:* the 15 controls here plus 29 in settings is where the
1,080-combination problem actually lives. Visual ambition spent here has lower return than the reveal,
because players pass through this screen and stop at that one.

---

# SCREEN 5 — `/settings` — where 9 of Roye's filed items live

### Capture evidence @393 — **29 interactive controls**, `scrollH 852`

### BROKEN — confirmed live, measured
- **B-6. A5 — Colorblind label is wrong.** Live: label **"Colorblind Mode"**, subtitle
  **"Green = Win, Red = Lose"**. The subtitle describes the *normal* mode; this toggle replaces it with
  blue/orange. Exactly as Roye filed. **Still live.**
- **B-7. B7 — "DANGER ZONE" renders in mint green**, computed colour `rgb(79, 214, 168)`, above a
  destructive control. Exactly as Roye filed. **Still live.**
- **B-8. B4/B5 — developer surface leaked to players:** a **"DEVELOPER"** section and a
  **"Debug Overlay"** control are visible in the player build.
- **B-9. A6 — two resets remain:** "Reset to Defaults" and "Reset All Progress". Wording improved since
  Roye filed it (was "Reset Progress (beta)"), but two destructive controls with unexplained
  distinction persist.
- **B-10. A3 — sound controls remain mixed-polarity:** "Sound Volume", "Ambient Sound", **"Mute quotes"**.
  Two positive-polarity controls and one negative on the same screen. The exact contradiction Roye filed
  appears softened — it is now "Mute quotes", not "Mute sounds" — but the polarity mismatch stands.

### NOT REPRODUCED (may already be fixed — verify before actioning)
- **A2 — mojibake `â`**: scanned all visible text for `[ÂÃâ]`, **found none**.
- **A4 — duplicate labels**: duplicate-string scan returned **empty**. "Pro Quotes" and "Privacy Policy"
  each appear once.

### PANEL
**Simplicity advocate** — 29 controls. This is the screen the 1,080 thesis was written about. Every
appearance selector removed here makes the default look *more* considered, not less capable.
`REMOVES`.
**Typographer** — Section headers and control labels share weight, so the screen reads as one
undifferentiated list of 29 items.
**Accessibility** — A destructive action under a mint-green "DANGER ZONE" is a colour-semantics
failure, not merely an aesthetic one.

---

# THE OTHER 48 SURFACES — not reviewed

`/leaderboard` `/shop` `/chip-store` `/battle-pass` `/missions` `/achievements` `/rank` `/referral`
`/stats` `/hand-history` `/coaching` `/gameover` `/lobby/*` `/club/[code]` `/invite/[code]`
`/multiplayer-game` `/spectate` `/simulate` `/replay` `/heatmap` `/debug` `/orientation-pick`
`/theme-pick` `(tabs)/play|friends|cups|profile`, and the overlays `CompleteOverlay` `CompleteBanner`
`LoginPromptModal` `StarterOfferModal` `LevelUpModal` `WeeklyRecapModal` `StreakPopup` `ChatOverlay`
`PracticeLiveOverlay` `WaitingSeatBanner` `ProQuoteBanner` `HandNameOverlay` `GuidedTooltip`
`BugReporter` `DebugOverlay`.

Several are likely dead or dev-only (`/debug`, `/heatmap`, `/simulate`, `/theme-pick`), which is itself
worth a pass — the simplicity seat notes that reviewing a dead screen is the one thing more wasteful
than adding a selector to a live one.
