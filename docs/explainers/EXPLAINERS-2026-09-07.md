# Per-screen explainers, re-cut against build 515

**Date** 2026-09-07 · **Rig** `tools/explainers.mjs` + `tools/explainer-cut.mjs` · **Out** `docs/explainers/`

---

## First, the correction the brief needs

The brief says these were "asked for long ago, never done". **They existed** — eight clips were
committed this morning in `1d60509`. What was genuinely open is whether they are still true, and
that question had a clean answer available: `git diff 1d60509 origin/main -- app/ components/
constants/ utils/ hooks/` is **empty**. Not one line of application code changed between the take
those clips came from and the tree that produced build 515.

So the clips were already of 515's code. That is not a reason to leave them alone — it is the
reason the verification below is worth anything. Everything has been **re-captured and re-cut
from a fresh take** anyway, because "the code did not change" is an argument and a new recording
is evidence.

## The eight clips

| File | Seconds | Screen | Frame |
| --- | --- | --- | --- |
| `01-home.mp4` | 7.00 | Home | 1080×1920 |
| `02-placement.mp4` | 11.00 | Placement | 1080×1920 |
| `03-reveal.mp4` | 7.52 | Reveal | 1080×1920 |
| `04-results.mp4` | 9.00 | Results | 1080×1920 |
| `05-hand-history.mp4` | 7.00 | Hand history | 1080×1920 |
| `06-profile.mp4` | 9.52 | Profile | 1080×1920 |
| `07-lobby.mp4` | 10.52 | Lobby | 1080×1920 |
| `08-shop.mp4` | 9.52 | Chip shop | 1080×1920 |

All eight under the 30-second limit, all with **zero audio streams** (asserted by `ffprobe`, not
assumed), all with the first caption at t=0.

## ⚠️ Three of the eight windows had to move, and this is why the rig re-derives them

The cut offsets belong to **one take**. A new recording drifts, so reusing the previous windows
puts the right caption over the wrong screen — a correct filename over wrong content, the exact
shape that cost this project the landing page. A filmstrip was pulled from the new raw take
(A every 3s, B every 2s) and **looked at**. Three windows would have been wrong:

| Clip | Old window | What it would have caught | New |
| --- | --- | --- | --- |
| `01-home` | 3.0 + 8.0 → 11.0 | ends one second before a **white navigation frame** at 12s | 3.0 + 7.0 |
| `03-reveal` | 29.5 + 8.0 | starts on the **"ALL CARDS PLACED / READY"** screen, not the reveal | 30.0 + 7.5 |
| `06-profile` | 68.0 + 9.5 → 77.5 | this take goes **black at ~78s** | 66.0 + 9.5 |

Evidence committed at `verification/raw-take-filmstrip.png`.

## Every caption, checked against what is on the screen in that window

**All 24 captions are true of build 515.** Each was compared against the text the running build
actually rendered (`explainers-report.json` → `facts`) and against the frames themselves.

| Clip | Caption | Verified against |
| --- | --- | --- |
| home | HOME — where every session starts | home is the launch route |
| home | Play Online, or practise against bots | both buttons on screen: "Play Online / Real players · instant bot tables" and "Practice vs bots" |
| home | A daily bonus tops up your chips | the pill **"🪙 Claim daily bonus · Day 1"** is on screen, and device `4e45-123f-54b4` auto-claimed 30 chips on 515 today |
| placement | PLACING — the decision that is the game | — |
| placement | Four cards per board. You choose where | header reads "PLACE 12 CARDS" over 3 boards; home's own line says "Four cards on every board" |
| placement | Auto-Place fills a board fast. Then READY | "⚡ Auto-Place" per board and "✓ READY" both on screen |
| reveal | REVEAL — the boards play out one at a time | "Board 1" then "Board 2" then "Board 3" headers |
| reveal | Live odds while cards are still to come | equity bars read "49% LEAD / 40% / 11%", later "85% LEAD", with "4 OUTS" and "Tap to reveal" |
| reveal | Each board is named and settled on its own | per-board FLUSH / STRAIGHT / THREE OF A KIND / ONE PAIR badges and a per-board "YOU LOSE" |
| results | RESULTS — boards decide the hand | — |
| results | The score is boards won, not chips | the hero is **0 — 3**; chips appear only as the small "This session: -75" |
| results | Hand details opens the breakdown | "Hand details ▾" control on screen |
| hand history | HAND HISTORY — your past hands | screen literally reads "Your past hands will show here" |
| hand history | Practice hands are not recorded | `app/results.tsx:436` saves only `if (!isPracticeGame)`, and the screen shows **All (0)** right after a practice hand was played |
| hand history | Play for chips and every hand lands here | same code path, inverted |
| profile | PROFILE — hands, win rate, streak and chips | screen reads "1 HANDS · 0% WIN RATE · 0 STREAK · 2,000 CHIPS" |
| profile | Achievements, hand history and detailed stats | all three rows on screen |
| profile | Cups and settings live here too | both rows on screen |
| lobby | LOBBY — tables against real people | header reads "REAL PLAYERS — TABLES FOR FRIENDS" |
| lobby | Heads-up, 3-player or 4-player | all three tier headers on screen |
| lobby | Fewer players, more boards: 2 play 4 | labels read "2 players · 4 boards", "3 players · 3 boards", "4 players · 2 boards" |
| shop | CHIP SHOP — reached from your chip count | `app/(tabs)/index.tsx:1331` "Chip balance — tap to shop" → `router.push('/shop')` |
| shop | Empty today. Nothing is for sale | screen reads "Shop is empty right now." |

⚠️ **The icon change and the tips toggle falsify nothing.** The app icon is not visible on any
in-app screen, and the "Show tips" toggle in Settings is not claimed or contradicted by any
caption. The restructured results screen is the one that mattered, and its two captions were
checked against the current layout: the boards-won hero and the "Hand details ▾" disclosure are
both there.

## English, verified twice — by DOM and by pixels

The rig's guard runs **before a single frame is recorded** and aborts the run on failure:

| Screen | Hebrew chars in EN | Latin chars in EN | Hebrew chars in HE |
| --- | --- | --- | --- |
| home | **0** | 278 | 222 |
| play | **0** | 239 | 205 |
| profile | **0** | 99 | 94 |
| shop | **0** | 36 | 0 |
| lobby | **0** | 248 | 0 |
| history | **0** | 70 | 17 |

Then the pixels: every frame of all eight finished clips was rendered into
`verification/watched-clips-1-4.png` and `verification/watched-clips-5-8.png` and **looked at**.
Zero Hebrew glyphs anywhere. `verification/every-clip-final-frame.png` shows the last frame of
each clip on the right screen with the right closing caption — no clip runs on into a splash or a
white frame, which is what went wrong in an earlier pass.

⚠️ The byte-size check alone would not have been enough and this run shows it again: lobby EN and
HE differ by 212 bytes and shop by 13, while **both render zero Hebrew in either language**. The
difference there is an animation, not a translation. Shop and lobby being untranslated is a
reported gap, not a failure — English never showing Hebrew is the rule, and it holds.

## Multiplayer is not filmed, and that is deliberate

No room has ever reached `playing` — measured again today, `game_rooms` with `status='playing'`
is **0**. There is nothing to film and staging one would be a claim the product cannot back. The
lobby clip shows the lobby as it is.

⚠️ **The lobby clip's weakness, stated rather than hidden:** the table rows read "Opening a
table…" because the capture runs with the network blocked, so it shows the lobby's *shape* — the
three tiers and their board counts — which is exactly what its captions claim and nothing more.

## One product inconsistency found while verifying, worth a look

Profile reports **1 HANDS** while Hand History reports **All (0)** — for the same practice hand,
in the same session, seconds apart. Both captions are individually true, so nothing here changes;
but a tester who opens both screens will see the app disagree with itself.

## git show

```bash
git show --stat HEAD
git show HEAD -- tools/explainer-cut.mjs
git show HEAD:docs/explainers/clips.json
git show HEAD:docs/explainers/explainers-report.json
```

The clips are binary; to look at them rather than at their diff:

```bash
git show HEAD:docs/explainers/01-home.mp4 > /tmp/01-home.mp4 && open /tmp/01-home.mp4
git show HEAD:docs/explainers/verification/watched-clips-1-4.png > /tmp/w14.png && open /tmp/w14.png
git show HEAD:docs/explainers/verification/watched-clips-5-8.png > /tmp/w58.png && open /tmp/w58.png
git show HEAD:docs/explainers/verification/every-clip-final-frame.png > /tmp/final.png && open /tmp/final.png
```
