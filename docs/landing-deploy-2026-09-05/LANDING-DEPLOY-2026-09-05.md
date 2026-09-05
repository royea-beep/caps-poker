# VAMOS CAPS LANDING-DEPLOY — 2026-09-05

**It is live.** `https://caps.ftable.co.il/landing.html` now serves English screenshots on the
English page. Verified on the live URL, in a browser, by looking at the image.

---

## Merged and confirmed on the remote

| | |
|---|---|
| commit | `bc20c29` — *fix(landing): the two screenshots the live page serves are now ENGLISH* |
| confirmed by | `git ls-remote origin refs/heads/main` → `bc20c2995e30d513cc6f1539633836f77569f5e7` |
| previous main | `e3d7d5e` |
| files changed | exactly two: `public/shots/game-boards.webp`, `public/shots/game-reveal.webp` |

Nothing else went to production. Not the HTML, not one word of copy, not the app, not a flag, not
the economy, not a security fix.

**The scope was deliberate.** The deployed `landing.html` has no image swap — two plain `<img src>`
tags — so replacing what those two names point at fixes the defect without touching the wording
Roye said was right. Merging the whole branch would also have deployed 17 commits of app changes
and a rewritten page, which this brief explicitly rules out.

> ⚠️ **The first commit attempt silently did nothing.** `git commit` ran without a `git add` and
> reported "no changes added to commit", then `git push` said **"Everything up-to-date"** — a
> success line over an empty change. That is the exit-0-without-push shape, caught only because the
> remote ref was read afterwards. The remote ref is the evidence; the push output is not.

---

## The deploy landed, and I watched it land

GitHub Actions run **1622** (`web-deploy.yml`, triggered by push to main, runs `vercel --prod`).

The live asset was polled by **content**, not by filename or by the workflow's own status, every
25 seconds:

```
14:43:53  boards=12dd61bcf4ba  reveal=d4eee1293f63   english=no
14:44:19  boards=12dd61bcf4ba  reveal=d4eee1293f63   english=no
14:44:45  boards=12dd61bcf4ba  reveal=d4eee1293f63   english=no
14:45:12  boards=e13832ef3c3e  reveal=bf6ed3bd158d   english=YES   consecutive=1
14:46:08  boards=e13832ef3c3e  reveal=d41d8cd98f00   english=no    consecutive=0   ← mid-deploy
14:46:34  boards=e13832ef3c3e  reveal=bf6ed3bd158d   english=YES   consecutive=1
14:47:00  …                                          english=YES   consecutive=2
14:47:27  …                                          english=YES   consecutive=3
14:47:53  …                                          english=YES   consecutive=4  → STABLE
```

**The mid-deploy phantom is right there in the log.** At 14:46:08 the reveal image came back as
`d41d8cd98f00…` — the md5 of an *empty response*. A single check timed one minute earlier would
have reported the deploy broken; a check timed thirty seconds earlier would have reported it done
while it was not. Requiring **four consecutive samples** of the expected content is what made the
result trustworthy, and it is why "sample until stable" is in the brief.

Proved by content, not by name: both files kept their exact filenames across the deploy. Only the
bytes changed, from the Hebrew md5s to the English ones.

---

## Verified on the LIVE URL, in a browser

`tests/live-landing-verify.mjs`. Not localhost, not a local export, not the branch.

**WebKit loads `https://caps.ftable.co.il/landing.html` directly** — measured working from this
container. **Chromium cannot**: the agent proxy's relay closes its tunnel mid-exchange
(`ws_closed_mid_exchange` for `caps.ftable.co.il:443`) while curl and `fetch` to the same URL both
return 200. That is a container defect, not a site defect, and it is stated rather than papered
over: Chromium is served through a localhost pass-through that fetches from the live origin **at
request time**, and every response is md5'd against an independent direct fetch in the same run.
**16 byte-identity checks, 0 mismatches** — so what Chromium rendered is provably what production
served.

| target | English page | Hebrew page | blocking failures |
|---|---|---|---|
| **before** (live, this morning) | 28 Hebrew product words inside the images | same | **4** |
| **after** (live, now) | **0** | 0 | **0** |

Eight combinations per run: 2 engines × 2 languages × 320 and 393.

### Checked by eye at full size — because that is what catches this

The OCR is the gate; the eye is the proof. I fetched
`https://caps.ftable.co.il/shots/game-boards.webp` seconds after the deploy stabilised
(50,544 bytes, 660 × 1431, md5 `e13832ef…`), converted it, and **looked at it at full size**.
Every string in it is English: *Practice · no chips · ALL CARDS PLACED! · BOTS 2/2 · ✓ READY ·
BOARD 1 / BOARD 2 / BOARD 3 · YOUR HAND · All cards placed! · Cancel · ✓ READY*. Zero Hebrew
characters. Committed as `live-asset-after-game-boards-fullsize.png`.

The same for the second figure: *Leading 1-0 · 2 left · Board 2 · COMMUNITY · PLAYER 1 · 60% LEAD ·
7 OUTS · Tap to reveal*.

### The Hebrew page

Text fully Hebrew and right-to-left; screenshots now English. **Acceptable under the rule** — *"the
other way round is acceptable"* — and it is the honest consequence of a deployed HTML that has one
image per figure. The page that gives Hebrew its own screenshots back is on the branch and still
waiting for approval from pixels.

### Live screenshots committed

```
git show HEAD -- docs/landing-deploy-2026-09-05/
git show HEAD:docs/landing-deploy-2026-09-05/before-en-393-webkit.png            # live, before
git show HEAD:docs/landing-deploy-2026-09-05/after-en-393-webkit.png             # live, after
git show HEAD:docs/landing-deploy-2026-09-05/after-en-320-chromium.png           # live, after, 320
git show HEAD:docs/landing-deploy-2026-09-05/live-asset-after-game-boards-fullsize.png
git show HEAD:docs/landing-deploy-2026-09-05/live-verify-before.json
git show HEAD:docs/landing-deploy-2026-09-05/live-verify-after.json
git show bc20c29 --stat                                                          # what went to main
```

---

## The image blind spot — who else has it, and how a sweep catches it

A DOM text scan reads text **nodes**. A word baked into a PNG is not one. Measured: **125 of 160**
scripts in `tests/` scan DOM text, and none looked inside an image before this week.

Checks that share the weakness:

| where | what is pixels, not text |
|---|---|
| `tests/i18n-loop.mjs` | the 26-route Hebrew-in-English sweep — its 0-leak result covers rendered **text**, not screenshots or icons |
| `tests/landing-loop.mjs` | asserted the image `src`; a filename is a claim about content, not the content |
| `tests/tap-list-sweep.mjs` | DOM text for every tap-list item |
| `utils/__tests__/i18n-parity.test.ts` | compares the two key tables and renders nothing |
| `components/ShareCard.tsx` | "Community", "Your Hand", "Opponent", "Play CAPS Poker" are hard-coded English with no `t()`, rasterised by `captureRef` — a Hebrew player shares an English image. Acceptable direction, same mechanism |
| BackstopJS, 12 scenarios | pixel diffs catch a *change*, but a baseline captured in the wrong language locks it in. It does not cover `landing.html` at all |
| splash, app icon, App Store screenshots | wordmark and captions are pixels; no language test touches them |
| `docs/**` evidence screenshots | whatever language the rig was in — this is how a stale asset survives review |

**How a future sweep catches it — three layers, cheapest first.**

1. **Assert the language when the image is made.** `tests/landing-hero-shots.mjs` now refuses to
   write an `-en` asset if the screen it is photographing shows any Hebrew, and a `-he` asset if it
   shows none. The image *is* that DOM, so the DOM settles it with no recognition step. This is the
   cheapest and the strictest, and it should be copied to every rig that generates an asset.
2. **Read the pixels in CI.** `tests/landing-image-lang.mjs` and `tests/live-landing-verify.mjs`
   OCR every painted image and match against the product's own 452 Hebrew tokens, pulled from
   `utils/i18n.ts` at run time. A Unicode-range count does **not** work — a Hebrew-trained model
   transliterates Latin glyphs and reported 61 "Hebrew characters" in an entirely English
   screenshot — so the vocabulary check is the instrument, with a canary in both directions.
3. **A human looks at the image.** This is a legitimate answer and it is the one that actually
   found this defect: Roye opened the page and looked. The other two exist so that looking becomes
   a confirmation rather than the only line of defence. Every release that touches a shipped image
   should include one person opening the live URL at full size.

---

## Housekeeping

- Copy unchanged: not one word. The HTML on production is byte-for-byte what it was.
- Production otherwise unchanged: no app change, no economy change, no flag change, no security
  change. Two image files, nothing else.
- Nobody invited, nothing else published.
- Still on the branch and unshipped: the rewritten `landing.html` with per-language screenshots and
  the "How a hand works" block, and the `vercel.json` catch-all fix. Both await approval.
