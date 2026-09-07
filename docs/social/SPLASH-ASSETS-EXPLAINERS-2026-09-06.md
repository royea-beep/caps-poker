# SPLASH · SOCIAL IMAGES · EXPLAINERS — 2026-09-06

Four things asked for and not closed. Two of them turned out to be already done, which is worth
saying plainly rather than re-doing them and claiming credit.

Branch `claude/vamos-caps-align-celebration-flppo0`. No Edge Function deployed, so `verify_jwt` is
untouched. Nothing published; no account opened.

---

## §1 — THE SPLASH

### It was already the current identity. Measured, not assumed.

The brief's premise — "declared background maroon, the image green with a sans-serif yellow
wordmark" — is a **stale measurement**. It was true before `19b3b18` (2026-09-02). Read today:

| | |
|---|---|
| `assets/splash.png` | 1284×2778, deep-green felt vignette, **gilded serif** CAPS wordmark, gold letterspaced POKER, four suit pips |
| `app.json` splash background | `#071C12` — inside that green, not maroon |

Same wordmark, same felt, same gold as the home screen. Nothing to repaint.

### What was actually still wrong, and is now fixed

**The image and the declared background did not move together at the edges.** With
`resizeMode: contain` the bars are painted in `backgroundColor`, and the art's own edges did not
match it:

| Edge | before | after |
|---|---|---|
| top row | 19 channels off `#071C12` | **0** |
| bottom row | 18 off | **0** |
| left / right | 1 off | **0** |

The art is untouched in the middle; only the outer 71px (5.5% of the short side) is feathered to
exactly the declared colour, with a smoothstep so there is no band where it meets the vignette.
Looked at: on the 375×667 shape the 33pt side bars were faintly visible before and now read as one
continuous field.

**And a genuinely stale colour: `expo-notifications` declared `#1C0508` — the maroon identity.**
Now `#071C12`, the same value the splash declares.

### Sizes and shapes

`ios.supportsTablet` is **false**, so iPad shapes are out of scope and are not claimed. Composited
exactly as iOS will, at every supported iPhone shape — 375×667, 414×736, 375×812, 393×852,
430×932. Bars are ≤1pt on the modern shapes and 33–37pt on the short ones, and at every one the
bar and the art edge are now the same colour. Renders in `docs/splash-proof/`.

**⚠️ NATIVE-ONLY. A browser cannot verify this.** The splash is an iOS launch image; the web build
has none. It belongs on Roye's tap list: install the build, watch the first second, confirm the
icon → splash → home reads as one identity.

**One thing left, and it is Roye's call, not mine.** The app **icon** is still on the FIVE-O black
ground (`#0A0A0A` with `#1A1A2E`), while the splash and home are green felt. That is the only
remaining step in the first second. I have not changed it — the icon was deliberately designed in
its own sprint and repainting it is a brand decision. Say the word and it moves.

---

## §2 — THE SOCIAL IMAGES

Built from the same values as the shipped icon, so the mark on Facebook is the mark on the home
screen rather than a lookalike. All post-2026-09-03; nothing earlier was reused.

| File | Size | For |
|---|---|---|
| `caps-profile-1024.png` | 1024×1024 | master square |
| `caps-profile-facebook-360.png` | 360×360 | Facebook page profile |
| `caps-profile-instagram-320.png` | 320×320 | Instagram profile |
| `caps-profile-tiktok-200.png` | 200×200 | TikTok profile |
| `caps-cover-facebook-1640x664.png` | 1640×664 | Facebook page cover |
| `caps-cover-wide-1920x1080.png` | 1920×1080 | general landscape hero |

**The C1 mark survives a circular crop — proven, not assumed.** Every profile size was masked to
the inscribed circle and every mark pixel counted:

| Size | mark pixels outside the circle | closest approach to the rim |
|---|---|---|
| 1024 | **0** | 122.9px — 24.0% of the radius |
| 360 | **0** | 42.4px — 23.6% |
| 320 | **0** | 38.2px — 23.9% |
| 200 | **0** | 23.7px — 23.7% |

A quarter of the radius of clearance at every size. Every platform serves profiles as circles.

### Getting them to Downloads

A path on this machine does not exist on Roye's, so these are the commands that do:

```bash
cd C:\Projects\POKER\Caps
git checkout claude/vamos-caps-align-celebration-flppo0

git show HEAD:docs/social/caps-profile-1024.png            > %USERPROFILE%\Downloads\caps-profile-1024.png
git show HEAD:docs/social/caps-profile-facebook-360.png    > %USERPROFILE%\Downloads\caps-profile-facebook-360.png
git show HEAD:docs/social/caps-profile-instagram-320.png   > %USERPROFILE%\Downloads\caps-profile-instagram-320.png
git show HEAD:docs/social/caps-profile-tiktok-200.png      > %USERPROFILE%\Downloads\caps-profile-tiktok-200.png
git show HEAD:docs/social/caps-cover-facebook-1640x664.png > %USERPROFILE%\Downloads\caps-cover-facebook.png
git show HEAD:docs/social/caps-cover-wide-1920x1080.png    > %USERPROFILE%\Downloads\caps-cover-wide.png
```

---

## §3 — THE EXPLAINERS

**These existed already**, from 2026-09-05. They were **re-captured against today's build** so they
show the app as it is now, not as it was before the tips fix, the toggle and the splash change.

| Clip | Length | Captions |
|---|---|---|
| `01-home` | 8.0s | HOME — where every session starts · Play Online, or practise against bots · A daily bonus tops up your chips |
| `02-placement` | 11.0s | PLACING — the decision that is the game · Four cards per board. You choose where · Auto-Place fills a board fast. Then READY |
| `03-reveal` | 8.0s | REVEAL — the boards play out one at a time · Live odds while cards are still to come · Each board is named and settled on its own |
| `04-results` | 9.0s | RESULTS — boards decide the hand · The score is boards won, not chips · Hand details opens the breakdown |
| `05-hand-history` | 7.0s | HAND HISTORY — your past hands · Practice hands are not recorded · Play for chips and every hand lands here |
| `06-profile` | 9.5s | PROFILE — hands, win rate, streak and chips · Achievements, hand history and detailed stats · Cups and settings live here too |
| `07-lobby` | 10.5s | LOBBY — tables against real people · Heads-up, 3-player or 4-player · Fewer players, more boards: 2 play 4 |
| `08-shop` | 9.5s | CHIP SHOP — reached from your chip count · Empty today. Nothing is for sale |

All eight under 30 seconds. No audio stream. English.

### Captures verified English — by content, not by filename

The landing bug was a correct filename over wrong content. Two guards run **before any frame is
recorded**: the EN and HE stills of the same screen must differ in bytes, and the EN still's DOM
must contain **zero** Hebrew characters. Result: **PASS on all six screens.** Two screens (shop,
lobby) render no Hebrew at all — reported as a gap, not treated as a failure, because
English-shows-Hebrew is the zero-tolerance direction and not the reverse.

### Every caption checked against the running build

Each claim was matched to text visible on screen in its own window:

- "Four cards per board" — the header reads **PLACE 12 CARDS** over 3 boards. ✓
- "Live odds while cards are still to come" — the equity bar reads **53% / 40% / 7%** with outs. ✓
- "The score is boards won, not chips" — results shows **2 — 1**. ✓
- "Practice hands are not recorded" — after a practice hand, history reads **"No hands yet"**. ✓
  Confirmed in code: `if (!isPracticeGame) saveHandToHistory(...)`.
- "Fewer players, more boards: 2 play 4" — the lobby lists **HEADS-UP 2 players · 4 boards**,
  **3-PLAYER 3 · 3**, **4-PLAYER 4 · 2**. ✓
- "Empty today. Nothing is for sale" — the shop reads **"Shop is empty right now."**, and
  `app_config.iap_enabled = false` with **0 purchases ever**. ✓
- "Cups and settings live here too" — both rows visible on the profile. ✓

### ⚠️ I WATCHED THEM, AND FOUR WERE WRONG

The cut windows are offsets into **one** take. Re-running the rig produced a new take with
different timings, and reusing the old windows put the right captions over the wrong frames:

| Clip | What the first frame actually showed | Fixed by |
|---|---|---|
| `01-home` | the CAPS loading splash | start 1.0 → 3.0 |
| `05-hand-history` | the CAPS loading splash | start 51.5 → 53.5 |
| `06-profile` | **HAND HISTORY**, under a PROFILE caption | start 63.0 → 68.0 |
| `07-lobby` | the CAPS loading splash | start 0.5 → 2.5 |

**Every automated check passed on all four.** Length, caption width, audio-stream count, resolution
— all green while one clip named the wrong screen. Re-cut and re-watched frame by frame: all eight
now open on the screen their caption names and stay on it.

### Multiplayer was not filmed

**0 of 9 rooms have ever reached `playing`, let alone `finished`.** There is nothing to capture and
staging one would be a claim the product cannot back. The lobby clip shows the lobby as it is — a
list of table types with nobody in them, the rows reading "Opening a table…".

---

## §4 — THE PRODUCT MAP

`docs/product-map/PRODUCT-MAP-2026-09-06.md`. Every screen with route, purpose, actions and how it
is reached, including the two URL-only routes and the flag-gated ones; every feature marked
working, dormant or retired against production; the five flows diagrammed; and the numbers that set
the context, read from the database today.
