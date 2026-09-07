# VAMOS CAPS LANDING-AND-AUTOSWEEP — 2026-09-05

Branch `claude/vamos-caps-align-celebration-flppo0`. Not merged, not bumped, nothing published,
nobody invited. Full suite green: **2,706 / 2,706**, `tsc` clean.

---

## MAP — carried forward

The Isracard letter is sent; the payment path waits on their approval, not on us. When it lands the
PayPlus wiring is built, the flag flip is last, and `verify_jwt` comes off at that moment — after
which the signature is the only gate. S1 is closed and read back live. Measurement: 31 event types
including `app_opened`, `rage_tap`, `stuck_dwell`, `screen_abandon`; day-2 return is derivable.
Tester plan: coordinated window, 4–6 people, browser first, three questions — trickle arrivals
would mean everyone plays bots and the retention engine is never exercised.

Re-measured today: **0 devices with a ledger gap**, across every row in `leaderboard`.

---

## §1 · THE LANDING PAGE

**Where it lives:** `public/landing.html`, served at `https://caps.ftable.co.il/landing.html`
(a real static file, so Vercel serves it before rewrites are consulted).

### ⚠️ THE LIVE PAGE IS NOT THIS PAGE

`origin/main` is `e3d7d5e`; this branch is **15 commits ahead**. The live `/landing.html` is main's
20,791-byte version, and it has a defect this branch already fixed: it references
`shots/game-boards.webp` / `game-reveal.webp` — a **single** pair, which are the **Hebrew**
screenshots taken on 2026-09-02. **The live English landing page is showing Hebrew screenshots
right now.** Nothing on this branch reaches a visitor until it is deployed.

### Assets — all four re-shot from THIS build, and two of them were wrong

Rig: `tests/landing-hero-shots.mjs`, against a fresh `expo export` of this branch.

| asset | why it was re-shot |
|---|---|
| `game-boards-he.webp` | predated FULL-I18N (+159 keys) — it showed an app that no longer exists, and it showed the RTL header collision fixed below |
| `game-reveal-en.webp` | **was byte-identical in content to the boards shot.** The page captioned a PLACING screen "live win odds and outs". It is now the actual reveal: 83% / 17% / 0%, "4 OUTS", "Leading 1-0 · 2 left" |
| `game-reveal-he.webp` | same duplicate, same fix |
| `game-boards-en.webp` | re-shot for provenance; reproduces the shipped image, which is how the rig was validated |

Cause of the duplicate: a text locator for `/READY/` matches the **✓ READY status pill** at the top
of the game screen before it matches the button at the bottom, and `.first()` took the pill, which
does nothing. The rig now uses `[data-testid="ready-button"]` and asserts the phase changed.

Geometry is read back, not assumed: all four are **660 × 1431**, byte-for-byte the dimensions each
`<img width/height>` declares, verified with `ffprobe` (Iron Rule #3).

Post-2026-09-03 only: **confirmed** — every asset on the page was created 2026-09-05.
The BAILEY video rig lives on Roye's machine and is not reachable from this container, so no video
was used; the page uses stills only, as it did before.

### Copy

- **One line a stranger understands:** *More than one way to win — every hand.*
- **Free:** *Free · in your browser · no sign-up* on the CTA, and the FAQ now says what is true
  **today** rather than what is planned: *"There is nothing to buy — CAPS takes no payments today,
  so there is no upgrade, no paywall and nothing to skip past."* It previously said "with optional
  in-app purchases", which a visitor cannot do: payments are flagged off and purchases are 0.
- **Play now in the browser:** one CTA, root-relative `href="/"`, no sign-up before it.
- **The differentiator:** *Multi-board poker: four cards on every board, all played at once. Win
  the most boards, win the hand.*

### The format is in WORDS, not the hero — confirmed

New `HOW A HAND WORKS` block, placed **before** the first screenshot:

1. You get four cards on **every** board — not four cards in total.
2. You choose which cards go where. That decision is the game.
3. Every board is played at once. Win the most boards and you win the hand.

Plus a note that the number of boards changes with the table size. **No board count is stated
anywhere on the page** — it is dynamic (2P=4, 3P=3, 4P=2), so "every board" is true at every size
and "three boards" would not be. The screenshots are evidence the thing exists, not the
explanation of it. `tests/landing-loop.mjs` asserts `formatInText=true` on all 16 combinations.

### No numbers, no ratings, no store date — confirmed

The loop asserts `storeDate=false` and `numbers=false` at every width, in both engines, in both
languages. 25 devices have ever played a hand and the page claims nothing about that.

### caps.ftable.co.il unbroken — proven

Every SPA route returns 200 on the live site: `/`, `/game`, `/results`, `/settings`, `/lobby`,
`/profile`, `/play`, `/shop`, `/leaderboard`, plus `/landing.html`, `/privacy.html`, `/terms.html`
and both existing `shots/*.webp`. Two of those returned `000` on the first attempt and 200 on
retry — the container's agent proxy, not the site.

### ⚠️ A missing path does NOT 404 on the live site — FAIL, and it is a deploy gap, not a code gap

```
/nope.js                   200   text/html   (returns the app's index.html)
/missing.webp              200
/shots/does-not-exist.webp 200
/bogus.html                200
```

`origin/main`'s `vercel.json` still ends with `{ "source": "/(.*)" }`. The fix — `/((?!.*\.).*)`,
which excludes any path containing a dot — is on this branch and is pinned by
`tests/vercel-rewrites.test.ts`, but **the web deploy comes from main, so it has never shipped.**
This is the same trap the record already names: a stale or absent file reads as "deployed".

### Rendered + committed

16 renders, `docs/landing-2026-09-05/`: 4 widths (320 / 375 / 393 / 430) × 2 engines
(chromium / webkit) × 2 languages. The loop's canary passed in both engines before any real number
was reported: a planted 3000px element was caught, a planted low-contrast label was flagged, and a
good label passed. **Failures: 0.** Exactly one CTA per page, no horizontal overflow at any width,
and each language's screenshots swapped correctly with the page's own toggle.

```
git show 49e2246:public/landing.html            # the version before this sprint
git show HEAD:public/landing.html               # the version to approve
git show HEAD -- docs/landing-2026-09-05/       # the 16 renders + the loop's JSON
git show HEAD -- public/shots/                  # the four re-shot heroes
```

---

## §2 · THE TAP LIST — what a browser can prove

One rig, one export, read out of the painted DOM: `tests/tap-list-sweep.mjs`. Artefacts in
`docs/tap-sweep-2026-09-05/`.

| # | item | verdict |
|---|---|---|
| 1a | Three tabs — Home / Play / Profile | **PASS** — `role="tablist"` holds exactly 3 tabs, those three |
| 1b | Cups inside Profile, Friends in the menu | **PASS** — both are routes, neither is on the tab bar |
| 1c | No duplicate destinations | **PASS** — no destination appears twice on Home |
| 1d | Every destination reachable | **PASS** — 28 routes typed as URLs, all paint, **0 page errors** |
| 1e | No dead route a typed URL can hit | **PASS** — `/missions` and `/heatmap` are deliberate `<Redirect href="/">` (retired, URL kept); `/simulate` and `/debug` redirect Home outside `__DEV__`. Nothing renders blank |
| 2a | Hero outcome | **PASS** — `result-headline` is the first thing on the screen, at y 16 |
| 2b | "Hand details" collapsed | **PASS** — toggle present, gated content absent. The large per-board reveal above it is always-visible by design; only the redundant compact list is behind the toggle |
| 2c | One mint CTA | **PASS** — one `results-play-again` ChipButton, "DEAL ME IN" |
| 2d | No shop prompt in the post-hand flow | **PASS** — 0 matches for Buy / Get chips / Store / Shop / חנות / קנה |
| 2e | Tie tally sums to the board count | **PASS**, all three table sizes: 2P **2+2=4**, 3P **1+2=3**, 4P **1+1=2** |
| 3 | Referral, proven by TYPING | **PASS** — see below |
| 4a | Lobby practice row | **INCONCLUSIVE HERE** — the rows are DB-sourced and this rig is offline. Proven present in production data: `list_public_tables()` returns 9 tables, **3 `bot_practice`** (2P/3P/4P) + 6 `human`, exactly what the lobby code expects. Rendering them needs a live-network browser, which this container does not have. ⚠️ My first read of that RPC reported `table_kind` NULL and "the server migration has not landed" — that was my probe counting the returned JSON **array** as a single row. The probe was wrong, not the function |
| 4b | REMATCH | **DEVICE / TWO-CLIENT** — `mp-rematch` is gated on `isMultiplayer`; reaching it needs a real multiplayer hand over realtime, which this container cannot open |
| 5 | Gilded shop / lobby / profile at 320-430, both engines | **PASS** — 40 combinations (5 screens × 4 widths × 2 engines), **0 with horizontal overflow**, 0 blank |
| 6a | Zero gold on any CTA | **PASS** — the winner cue `#FFD700` appears on **0** controls across all 40 combinations and on the first-run Home |
| 6b | Winner cue separates in greyscale | **PASS** — `components/Card.tsx` is untouched this sprint and the cue is a WIDTH ladder: 3px won / 2px community / 1px neutral. A width is colour-independent, so it survives greyscale by construction |
| 6c | No new overlap | **PASS** — and one RTL collision **found and fixed**, see below |

### Referral, proven by TYPING — both halves

**(a) What the UI sends.** `tests/referral-typed-payload.mjs` types `A3F2B1C7` one character at a
time into the real input and intercepts the outgoing RPC. The field kept all 8 characters and the
request body carried `p_code: "A3F2B1C7"` — exact match. The old `.slice(0, 6)` is gone.

**(b) What the server does.** Against production, with real anonymous sessions:

```
create_referral_link(A)          -> 13976D92          (8 characters, as the DB issues them)
redeem_referral(B, "13976D")     -> {"success": false, "error": "Invalid or expired code"}
redeem_referral(B, "13976D92")   -> {"success": true, "referrer_rewarded": true, "referrer_earned": 300}
```

The truncated form is the exact string the old bug sent, and it is rejected. The full typed code
succeeds and **the referrer was credited 300**, with a `referral_joined` ledger row.

### ⚠️ One economy finding, reported not fixed

The referrer ended with a **ledger gap of −300**: two ledger rows (600) against a 300 balance.
Cause, read from the database rather than inferred: `record_reward` INSERTs the `leaderboard` row
when none exists, and `trg_ledger_starting_grant` fires AFTER INSERT and writes a `starting_grant`
row for that same amount — then `record_reward` writes its own row. Two rows, one credit.

**Reachability:** only when a device's FIRST `leaderboard` row is created by a reward. In the real
flow the referrer has opened the app, taken the 2,000 grant and already has a row, so
`record_reward` takes the `ON CONFLICT DO UPDATE` path and no gap opens. My probe device had a
referral code but had never played. **Latent, not active** — the economy is out of scope this
sprint, so it is named, not touched.

All test rows were deleted. Verified after cleanup: 0 `leaderboard`, 0 `chip_transactions`,
0 `referral_links`, 0 `referral_redemptions` rows for the probe devices, and
**0 devices with a ledger gap** across the whole table.

### ⚠️ One RTL collision, found rendering and fixed

The practice pill on the game screen was anchored with a hard `left: rs(64)`, chosen to clear the
✕ button. In RTL the ✕ moves to the other edge, so the pill stopped clearing it and sat on the
status pill instead. Measured at 440 CSS px in Hebrew:

| | practice pill | status pill | horizontal overlap |
|---|---|---|---|
| English | x 82–207 | x 245–422 | **0** |
| Hebrew, before | x 82–199 | x 18–163 | **81px** |
| Hebrew, after | x 241–358 | x 18–163 | **0** |

Two fixes were tried first and **both failed silently**, which is why the number is measured rather
than asserted: `start: rs(64)` compiled, exported, and did not move the pill (RN-Web did not map it
to `insetInlineStart` in this build); overriding with `{ left: undefined, right: rs(64) }` produced
`left:64px` **and** `right:64px` and stretched the pill to 302px — worse than the bug. The anchor is
now supplied at the call site from `isRTL()`, one edge at a time. The 64px is unchanged.

### An observation, not a defect — the one shape where the screen says two things

On a 3-player hand the headline read **TIE GAME** over the scoreboard **1 — 2**. Both are working
as documented: `deriveHandOutcome` compares against the best **single** opponent, which is the
server's rule (three players each taking one board is a genuine three-way tie), while the numerals
print the **collapsed** opponents-combined figure the scoreboards have always shown.
`utils/boardTally.ts` names this split explicitly and calls changing it "a rules question, not a
display gap". It is the only reachable shape where a player is told two different things. Settled,
not re-raised — recorded so the next reader does not re-derive it as a bug.

---

## §3 · WHAT ONLY A DEVICE CAN ANSWER — exactly five, in order

Flagged since build 509. These are not untested; they are **untestable without hardware**.

1. **The masthead in the fallback serif.** Playfair Display is not in the binary, so iOS renders
   the fallback. Look at the CAPS wordmark on the splash and on Home: are the letterforms still
   the same weight and width relationship, or does the fallback make it look thin and generic?
2. **Solid gold instead of the gradient.** `background-clip:text` has no React Native equivalent,
   so the gilded wordmark is a flat fill on device. Look at whether the flat gold still reads as
   metal against the felt, or as a plain yellow.
3. **The icon at 60px on a real home screen.** Add it to the home screen and look at it beside the
   other apps: is the mark still legible at that size, and does it hold its own next to them?
4. **The felt gradient, the beam and the backdrop on iOS.** The web renders these in sRGB; the
   device renders wide-gamut on an OLED. Look for banding in the vignette, and whether the beam
   reads as a light source or as a grey smear.
5. **The multiplayer label at the largest Dynamic Type.** The web ignores Dynamic Type entirely.
   Set text to the largest accessibility size and open the lobby: does the multiplayer label wrap,
   truncate, or push its row out of shape?

---

## The deploy question — it needs one, and here is exactly what

The landing page work **cannot reach anyone without a deploy**, and the deploy is not landing-only:
the web build comes from `main`, and `main` is 15 commits behind. Deploying fixes two live defects
at once — the English page showing Hebrew screenshots, and the catch-all returning 200 for missing
files. **Not merged and not bumped here**, per the brief: Roye approves from pixels first.

---

## Housekeeping

- Production unchanged: no flag, no economy change, no security change, no cue, no card size, no
  83px arc, no tie-tally arithmetic, no `KILL_Board`. `components/Card.tsx` untouched.
- One product change this sprint: the RTL anchor in `app/game.tsx`. `tsc` clean, 2,706 tests green.
- Nothing published, nobody invited, no baselines regenerated.
