# VAMOS CAPS — NATIVE-AND-HOME (2026-08-28)

Three defects from the first native evidence in 117 sprints, then ten home-screen concepts.

Branch `claude/vamos-caps-align-celebration-flppo0`. tsc clean · jest 2,654/2,654 · nothing shipped
into the app for the home screen — those are renders and Roye picks.

---

## 0. THE FINDING BEFORE THE FINDINGS

Four native screenshots produced three defects. 117 sprints of measurement, all of it web, produced
none of them — and **two of the three could not have been caught on web at any level of effort**,
because they are the two engines laying out the same code differently. That is the result. The web
sweeps are not lax; they are looking at a different renderer.

**Native could not be driven in this environment.** No simulator (Linux), no emulator, no device.
Everything below is either measured on web, established from git and the database, or explicitly
flagged as needing a person. What a person has to tap is listed in §2.4.

---

## 1. THE SCOREBOARD MUST ACCOUNT FOR EVERY BOARD

### 1.1 The form, and why

`playerWins` and `botWins` are both **outright-winner counts** (`app/results.tsx:137-138`), so a
tied board is in neither and a four-board hand rendered **`3 — 0`**. Three plus zero is three.

The numerals stay `3 — 0` — that is the win-loss headline players already read, and widening it to
`3 — 1 — 0` borrows a football notation whose middle term is ambiguous to anyone who has not read a
league table. The accounting is spelled out underneath instead, **labelled**, and only when there
is something to account for:

```
        2 — 1
  2 WON · 1 TIED · 1 LOST
```

Every number carries its own word, so nothing is inferred from position; the three add to the board
count on their face; and a hand with no tied board never renders it, so a returning player sees no
change. The repetition of the 2 and the 1 is deliberate — the reader confused by `3 — 0` is exactly
the reader who needs the complete sentence, not a fragment.

### 1.2 `tied` is a remainder, not a third filter

A third `filter(w === 'tie')` would be a third independent count, and three counts can disagree
with the total the way two did. `utils/boardTally.ts` derives it as `total - won - lost`, so

    won + tied + lost === total

is true **by construction** for any value `winner` ever takes. The brief's requirement is then a
property of the function rather than something to re-check. The explicit count is still taken and
compared in `__DEV__`: divergence means a board carries an unexpected `winner`, which is worth a
warning rather than silent absorption into the remainder.

### 1.3 Every surface

| surface | before | after |
|---|---|---|
| `app/results.tsx` scoreboard | `3 — 0` — **tie vanished** | numerals + tally line |
| `app/results.tsx` "Boards: 3/4" | true but silent on the 4th | `Boards: 3/4 (1 tied)` |
| `app/hand-history.tsx` list row | `3 - 0` — **tie vanished** | `3 - 0 =1` (row is too dense for the full line) |
| `app/replay.tsx` summary | `3 — 0` — **tie vanished** | numerals + tally line |
| `components/ShareCard.tsx` | `3/4 boards won` — never wrong, but silent | `3/4 boards won · 1 tied` |
| per-board rows (all four files) | already correct (`=` / `TIE` / `🤝`) | unchanged |

Four files had each written their own `filter('player')` / `filter('bot')` pair. Writing the fix
four times would have set up the fifth, so the tally lives in one module and the screens read it.
`app/replay.tsx` also had **four** filters producing two identical pairs (`rpPlayerWins`/`playerWins`);
that duplication is gone.

**The derivation was not touched.** `deriveHandOutcome()` is settled and measured against the
server seat by seat. This was a display gap.

### 1.4 Proven on a real hand, both engines

`tools/verify-tally.mjs` drives seed 4 (2 players, 4 boards, one tied) through the app's own
controls to `/results` and **reads the painted screen** — not the store, because a store that agrees
with itself is exactly the evidence that would not have caught this. It also cross-checks the
headline against the per-board rows.

```
engine chromium / webkit   seed 4
numerals    "2 — 1"
tally line  "2 WON · 1 TIED · 1 LOST"
per-board   ["✗","✓","✓","="]
won 2 + tied 1 + lost 1 = 4   board count 4      PASS (both engines)
```

Native: not verified — see §2.4.

---

## 2. THE TWO NATIVE-ONLY DEFECTS

### 2.1 `REMATCH` wrapping — established, with a number

`components/Button.tsx` rendered its title with no line control. When a **single word is wider than
its container**, the two engines diverge and diverge predictably:

- **CSS** (`overflow-wrap: normal`) lets the word **overflow** the box — so web shows it whole and
  nothing looks wrong.
- **iOS** falls back to breaking the word mid-character → `REMATC / H`.

Measured on `/results` at 320pt: **the label is 92.8px of text in an 89px box — over by 3.8px.**
`HOME` is 56px in 56px and fits exactly, which is why only one of the two ever broke.

Fixed in `Button`, not at the REMATCH call site, because every button in the app has the same
exposure.

**The first attempt at this shipped a web regression, and only looking caught it.** Applying
`numberOfLines={1}` on both platforms turned the label into **`REMAT…`** on web, because
`adjustsFontSizeToFit` is a no-op in react-native-web and `numberOfLines` alone just clips. Web
never had the defect, so the correct scope is native only: iOS gets shrink-to-fit with a 75% floor
(the 92.8px label reaches it at ~0.96), and web is left exactly as it was. Verified by screenshot
at 320pt: `REMATCH` renders whole again.

### 2.2 The missing multiplayer label — established, and it is not one site

The text is unconditional in the source and has been since the card existed, so "an old build" was
checked and does not explain it: `app/(tabs)/index.tsx` — the card **and** its label landed together
in `3084520` (2026-07-05), and the home screen at build 471's date (2026-04-27) had **zero**
`playOnline` references, i.e. no such card at all to photograph.

The mechanism is the same class as `REMATCH` — a layout rule the two engines implement differently:

```jsx
<Text>🎮</Text>
<View style={{ flex: 1 }}>   ← the label column
  <Text>Play Online</Text>
  <Text>Multiplayer lobby · …</Text>
</View>
<Text>›</Text>
```

`flex: 1` is `flexGrow:1, flexShrink:1, **flexBasis:0**` — "start from zero width and grow into
what is left". **CSS then rescues it anyway**, because a flex item defaults to `min-width: auto`
and refuses to shrink below its min-content width: on web the words always survive and the row
overflows instead. **Yoga has no such floor** — its flex items shrink to 0. So when the row is
over-constrained (a narrow device, or iOS Dynamic Type inflating the two glyphs, which web ignores
entirely), web keeps the label and native drops it, leaving **the icon and the chevron with nothing
between them.** Which is what was photographed.

The fix is `flexBasis: 'auto'`, which starts the column at its content width so growing is the only
thing left for it to do, plus `allowFontScaling={false}` on the two decorative glyphs so Dynamic
Type cannot squeeze the words. On web the rendering is unchanged in both the fitting and the
over-constrained case, so the visual baselines do not move.

**Anything else using that pattern? Yes — five more sites, and one of them is the other main path
into multiplayer:**

| file | row |
|---|---|
| `app/lobby/index.tsx:315` | **"Practice vs Bots"** — the lobby's own table row |
| `app/lobby/private.tsx:166` | create-a-private-table rows |
| `app/club/[code].tsx:198` | start-a-club-table rows |
| `app/rank.tsx:210` | tier rows |
| `app/(tabs)/friends.tsx:134` | club cards |

All six now read one definition, `constants/labelColumn.ts` → `LABEL_COLUMN`, so the seventh site
has something to reach for.

**Honest limit:** the mechanism is established from the layout rules and the source; it is **not**
confirmed against Roye's device, because native cannot be driven here. Two things would settle it
in one tap each — see §2.4.

### 2.3 Native sweep for the same class

The defect class has a signature that IS measurable on web: **a text node whose longest word is
wider than its box.** On web that overflows silently; on iOS it breaks mid-word.
`tools/native-text-sweep.mjs` measures every text element's longest word in its own computed font
against its own box, at 320pt where boxes are tightest, across 14 routes.

**Result: 0 at risk across 14 routes**, and the negative is load-bearing, so it is guarded twice:

- every route reports how much text it rendered (11–77 nodes), because **a blank page is "clean"
  for the worst possible reason**;
- a **canary** — a deliberately over-long word — is planted on each page and must be caught, or
  that page's "clean" is reported as `BLIND` and discarded. All 14 came back `PROVEN`.

The first run of this reported "0 at risk" across every route **because of a bug in the harness**
(a string passed to `page.evaluate` returns the function, not its result). That false negative is
why the canary exists.

Also swept: web-only CSS silently ignored by native. `cursor`, `userSelect`, `boxShadow`, `filter`
appear unguarded, but on RN 0.83 `boxShadow`, `filter` and `userSelect` are supported natively and
`cursor` has no text effect. **No text-loss defects from that class.**

`/results` is not reachable without a played hand, so `REMATCH` was measured separately (§2.1).
`/rank`, `/stats`, `/coaching`, `/shop` rendered only 11 text nodes each — enough for the canary to
prove the detector, but they are thin, likely data-gated by the route block, and a native pass
should not treat them as fully covered.

### 2.4 Native drivable: **NO** — plainly

No iOS simulator (Linux host), no Android emulator, no device. What a person has to tap:

1. **Settings → the build number.** It reads the installed binary via `expo-application` (added
   2026-08-08). If it shows a number, the build is newer than that date; if it shows `330` or
   nothing, the build is old and predates the multiplayer card entirely. **This alone decides
   whether §2.2 is a layout bug or a stale TestFlight.**
2. **Settings → iOS text size, set larger, then Home.** If the label disappears or returns as the
   size changes, Dynamic Type is the trigger and the `allowFontScaling={false}` half is the fix.
3. **Home → Play Online → check the lobby's "Practice vs Bots" row** for the same missing label —
   it is the same shape and the same fix.
4. **Finish a hand with a tied board → /results**, and confirm the numbers add up.

**Also worth knowing:** `build_history` says the live iOS build is **471, started 2026-04-27**, and
**builds 460–470 all failed**. Whatever the label turns out to be, the last successful iOS build on
record is four months old.

---

## 3. TEN HOME SCREEN CONCEPTS

**Renders only. Nothing is wired into the app.**

- `docs/home-concepts/COMPARISON-393.png` — the control and all ten side by side at 393pt, each
  with its measurements printed underneath.
- `docs/home-concepts/concepts-320.png` — the same ten at 320pt.
- `docs/home-concepts/measurements.json` — the raw numbers.

Built as real DOM with real buttons and real `aria-label`s, using the shipping palette from
`constants/paintThemes.ts` `classic`, so the same measurement pass audits the concepts and the
shipping screen and a concept cannot look better by being measured differently.

### 3.1 The control, measured

| | 393pt |
|---|---|
| exposed controls | **15** |
| text elements | 46 |
| contrast failures | **8** (excluding two false positives — see below) |
| controls under 44pt | **4** |
| unnamed controls | 0 |

Failures: the tagline **3.70:1**, the config line **3.70:1**, "Players" **3.77:1**, the four
inactive tab labels **3.17:1**, and — the one that matters — **"🤖 Practice vs Bots" at 2.28:1, the
largest button on the screen**, against a 3:1 bar for large text.

Under 44pt: the three player chips (41×28, 54×28, 41×28) and "Claim daily bonus" (263×**40**).

Two entries are **false positives and are excluded**: the 🎮 and 🐛 emoji report 1.06:1 because an
emoji renders in its own colours and its `color` property describes nothing.

**The inactive tab labels fail in the shipping app on every screen, not just home.** The concepts
were raised to `#8f979f` rather than inheriting `#5b6168` and calling it a baseline.

### 3.2 What each element earns

| element | verdict |
|---|---|
| chip balance | **keep** — the only number a returning player looks for |
| wordmark + suits + card fan + tagline | **cut to a line** — ~40% of the first screen before a single control |
| tagline "Place your cards. Own every board." | **cut** — 3.70:1, and it explains nothing a stranger can act on |
| green **Practice vs Bots** (largest button) | **demote** — it is the biggest promise on the screen for the mode that is not the product |
| "3 boards · 3 players · Low Blinds · 25/board" | **cut** — jargon, 3.70:1, and it configures before it explains |
| Players 2P/3P/4P selector | **cut from home** — a setting on the front door, and all three chips are 28pt tall |
| **Play Online** card | **promote to hero** — it is the product, and on native it has no label at all |
| Claim daily bonus | **keep, demote** — retention, but 40pt and it outranks multiplayer today |
| Invite Friends | **move to Friends tab** |
| **Report a bug** | **cut from home** — a large card on the front door, for a stranger's first three seconds |
| legal line | **keep** — required |
| 5-tab bar | **keep** — but note Home, a Play tab, a Practice button and a Play Online card are **four** paths to playing |

### 3.3 The ten, measured

Every concept: **0 contrast failures, 0 controls under 44pt, 0 unnamed controls**, at both 393 and
320. Against the control's 8 / 4 / 0.

| | concept | cuts | promotes | controls | text | min ratio | 3-second test |
|---|---|---|---|---|---|---|---|
| C1 | ONE DOOR | selector, config, bonus, invite, bug, tagline | a single decision | 8 | 11 | 6.69 | ✅ press PLAY. Does not say what the game is |
| C2 | MULTIPLAYER FIRST | practice's primacy, selector, config, invite, bug | the actual product | 9 | 12 | 6.69 | ✅ **strongest** — knows it is online, and that bots exist |
| C3 | TABLE IS THE HERO | wordmark, fan, tagline, config | what the game looks like | 9 | 9 | 6.69 | ✅ sees four boards before any words |
| C4 | TWO DOORS | everything above the fold but the choice | one either/or | 9 | 13 | 6.64 | ⚠️ clear, but two equal options is a decision, not an invitation |
| C5 | LIVE NOW | bonus, invite, bug, selector | proof the room is not empty | 9 | 12 | 6.69 | ✅ **only one that answers "is anyone here"** — needs a real count |
| C6 | SAY WHAT IT IS | config jargon, selector, tagline | comprehension | 8 | 13 | 6.69 | ✅ **only one that teaches the rule** before asking for a tap |
| C7 | YOUR RUN | selector, config, bug, invite | progression | 7 | 13 | 6.64 | ❌ means nothing to a stranger; strong for a returning player |
| C8 | MINIMAL | chips, avatar, everything | nothing — that is the argument | **6** | **8** | 6.69 | ⚠️ knows to press PLAY, learns nothing else |
| C9 | CARD HERO | config, selector, bug | graphics — cards you can read | 9 | 19 | 5.64 | ✅ reads as poker instantly; not as *this* poker |
| C10 | SEAT OPEN | wordmark, tagline, selector, config, bonus, invite, bug | urgency + multiplayer in one image | 8 | 13 | 6.69 | ✅ strong pull; **implies live players — must not be shown when none are** |

### 3.4 Panel

- **Game UX** — C2. The biggest button must be the thing you want pressed; today it is not. C6's
  sentence should be folded in as C2's subtitle.
- **Mobile F2P** — C5 or C10. Liveness and a taken seat are the two levers that move first-session
  conversion. Both are **honesty-gated**: a fake count or a fake seat is the fastest way to lose a
  new player, so neither ships without a real number behind it.
- **Visual design** — C3 or C9. The felt and the cards are the only assets that look like nothing
  else; the wordmark is generic and currently occupies the most space.
- **Accessibility** — any of them, and note what that means: **all ten measure clean where the
  shipping screen has 8 contrast failures and 4 undersized targets.** The failures are not caused
  by the layout, they are caused by dim greys on dark and 28pt chips — so most of this is
  recoverable without any redesign at all.
- **Simplicity advocate — the vote: C2, not C8.** C8 is the purest cut and it is the wrong one:
  it removes the chip balance, which is the one thing a returning player opens the app to see, and
  it still fails the three-second test on *what the game is*. Simplicity is not the fewest
  elements; it is the fewest **decisions**. C2 leaves exactly one obvious action and one fallback,
  and drops from 15 controls to 9.

**Verdict: C2 as the frame, C6's sentence as its subtitle, C5's live count above it once the number
is real.** C3's table art is the strongest single upgrade if only one thing changes.

### 3.5 Two things found by looking, not by measuring

Both would have passed every automated check:

- **Mojibake.** The first render showed every emoji as `ðŸ¤` — the page was served without
  `charset=utf-8`, so UTF-8 bytes were decoded as Latin-1. Exactly the class the release checklist
  names.
- **Two-thirds empty phones.** The first layouts clung to the top with the bottom two-thirds blank,
  which is not a fair render of a home screen. Fixed, plus C8's PLAY button had shrink-wrapped to
  its text width and C9's card fan was sitting on its CTA.

---

## 4. STATE

- **Production unchanged.** No `app_config` row touched today; last change 2026-08-22.
  `iap_enabled` false, `web_payments_enabled` false, `hand_rake_pct` 5. `chip_purchases` 0,
  `referral_redemptions` 0, missions completed 0.
- **Nothing shipped into the app for the home screen** — renders only.
- Untouched: the outcome derivation, the felt, the panels, the cues, the economy, every flag.
  `KILL_Board` not flipped.
- tsc clean · jest **2,654/2,654** · tally verified on chromium and webkit.
- No video file added to the repo.

### A claim from last sprint, now settled

Handoff 117 dropped "For four months" from the `dev-signin` video because the clone was shallow
(history began 2026-08-22) and nothing could date the bug. **The clone is now unshallowed** — 1,418
commits back to 2026-03-11 — and it dates precisely:

- `{!user ? ...}` gate introduced **2026-03-26** (`86de84e`, the commit that created `SideMenu.tsx`)
- fixed **2026-08-20** (`6bc58fe`)

That is **4 months 25 days — just under five.** "Four months" was an *understatement*, not an
overstatement. The video's current caption ("To everyone who had not signed in") is accurate and
needs no change, so nothing is re-cut and the published checksums stay valid. If Roye wants the
stronger line, "For almost five months" is now supported and it is a one-command re-cut to `v2`.
