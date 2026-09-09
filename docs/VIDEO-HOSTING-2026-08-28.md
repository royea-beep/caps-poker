# VAMOS CAPS — VIDEO-HOSTING (2026-08-28)

Public hosting for the ten videos, and a re-watch of all ten after two shipped wrong.

Nothing here publishes. No account was created, no credential was read, nothing was posted to any
platform. The upload itself is a manual step for Roye, by design.

---

## 1. THE HOST: `ftable.co.il`, NOT `caps.ftable.co.il`

The game's own domain is the wrong host, and it is wrong in the exact way that has already fooled
this project twice.

`vercel.json` rewrites `/(.*)` to `/index.html`. So a missing or mistyped file does not 404 — it
returns the app:

| URL | status | content-type | bytes |
|---|---|---|---|
| `caps.ftable.co.il/does-not-exist.mp4` | **200** | text/html | **1902** |
| `ftable.co.il/does-not-exist.mp4` | 404 | text/html | — |

That 1,902-byte page is the same one that once read as "the fix is deployed". A published post
pointing at a wrong filename would silently hand a video ingester a web page.

Two further reasons: the Vercel deploy runs a fresh `expo export`, so only files **in the repo**
reach the deployment — and 26 MB of video must not enter the repo. And it would put video
bandwidth through the app's own project and cache.

The cPanel host at `ftable.co.il` (nginx/Engintron) was measured and satisfies every platform
requirement: real 404s, **0 redirects** on deep paths, correct `Content-Type` with `nosniff`, and
`Accept-Ranges: bytes` with a working 206.

**Path:** `public_html/caps-media/v1/` → `https://ftable.co.il/caps-media/v1/<id>.mp4`

**Stability.** A published post points at a URL forever. The files are not part of any build, so no
deploy can move or rename them; and the path carries a version segment, so a re-cut publishes to
`v2` and cannot overwrite what a live post points at.

## 2. VERIFICATION — five checks per file, never trusting a 200

`tools/verify-hosting.mjs`. Per file: status 200 **with 0 redirects** (TikTok's PULL_FROM_URL
forbids redirects) · `video/mp4` · byte-exact size **and sha256 of the downloaded bytes** · `ftyp`
magic at offset 4 · ffprobe on the downloaded bytes reporting h264 1080x1920, the right duration,
and **zero audio streams**.

- Self-test (real files served locally): **10/10**.
- Against `caps.ftable.co.il`: **0/10** — 200, 0 redirects, `text/html`, 1902 bytes, sha BAD,
  ftyp BAD, unplayable. The trap fires exactly as predicted, and the checker catches it.

Run after upload:

```
PUBLIC_BASE=https://ftable.co.il/caps-media/v1 node tools/verify-hosting.mjs
```

## 3. THE RE-WATCH — three captions failed, and they were rewritten

Two of ten shipped wrong last sprint and every automated check passed on both. So all ten were
opened: `tools/contact-sheet.mjs` samples the **midpoint of every caption cue** and prints the
words above the frame. The question is not "is it pretty" but **does the footage under this
sentence support the sentence.**

Three failed.

**`play-tie` — a caption over a frame saying the opposite word.** "Nobody wins" sat on a frame
reading a green tick and **YOU WIN** (Board 2, One Pair beats One Pair). The hand does tie, and the
video does end on TIE GAME 2—2, so every automated check and the outcome reader passed. But a
viewer sees the sentence contradicted by the app underneath it. This is the same class as the bug
that nearly shipped a "Nobody wins" over a win: a true aggregate laid over a frame that denies it.

Retimed against measured frames — the TIE GAME 2—2 screen is up from **t≈10.0s**, earlier than the
old cues assumed, so the honest arrangement fits:

| t | caption | frame it lands on |
|---|---|---|
| 0.0 | Four boards. Four results. | Board 1, pre-reveal |
| 3.2 | This one is yours | Board 2 — ✅ YOU WIN |
| 7.6 | This one is not | Board 4 — ❌ YOU LOSE |
| 10.6 | Two boards each. Nobody wins. | TIE GAME **2 — 2** |
| 14.0 | Play free in your browser | TIE GAME 2 — 2 |

"A tie is a real result, not an error" moved to the post caption, where it is commentary rather
than a burned claim over a frame.

**`dev-signin` — "For four months" had no source.** The only "four months" in `vamos_handoffs` is
h92, which is the **achievements** bug, not this one. The clone is shallow (history begins
2026-08-22) so git cannot date it either. Replaced with what h74 *does* establish — `SideMenu.tsx`
gated the auth row on `{!user ? ...}` while `useAuthUser()` returns the anonymous user, so it was
never shown to anyone anonymous: **"To everyone who had not signed in."**

**`dev-invite` — "3,140 codes" is three numbers, not one.** h107 says 3,140; h101 says 3,173;
`referral_links` today holds **1,960**. A count that unstable does not belong burned into a video.
The count is gone; everything verified stays:

- every code is 8 characters — live table `min(length)=max(length)=8`
- every screen accepted 6 — `maxLength={6}` on the field, plus a `length===6` guard (h101)
- `referral_redemptions` = **0**, still

The seven others were checked frame by frame and every caption is supported.

### Would not publish as-is

None, after the three rewrites. Two cosmetic notes, neither a truth problem:

- `dev-invite` at t≈5s sits on a screen cross-fade — two layouts ghosted over each other.
- `dev-signin` and `dev-wcag` end on the results celebration, which dims the screen behind the
  trophy. On `dev-wcag` this is accidentally apt ("The contrast test. On a faded screen." over a
  faded screen); on `dev-signin` "Fixed." lands on a dark frame.

## 4. UPSCALE SOFTNESS — a number, and a correction

The take is 486x864 (Playwright records CSS pixels at 1:1 and **ignores `deviceScaleFactor` for
video**; screenshots honour it) and is scaled 2.222x to 1080x1920.

**The first metric was wrong and is retracted.** Mean gradient magnitude reported **120% retained**
— the upscale supposedly sharper than its own source. That is a broken metric, not a surprise:
lanczos ringing overshoots every edge and H.264 blocks every flat area, and a gradient sum counts
both as detail.

What is measured now is **detail above the capture's Nyquist**: downsample by 2.222x and
re-upsample, which destroys nothing the upscale ever had, then take the RMS of the residual. Board
area only; the caption band is excluded because ffmpeg draws it at the full 1080 and is identical
in both.

```
native  (true 1080 raster)   6.4786
shipped (486 -> 1080)        2.9405
FINE DETAIL RETAINED: at most 45.4%   — the upscale loses AT LEAST 54.6%
```

An **upper bound**: ringing and blocking land in the shipped residual and inflate it.

The screenshot is the other half of the answer. `/tmp/sharpness/side-by-side.png` is a 1:1 crop of
the same boards, native above and shipped below. **The metric is harsh and the content is
forgiving** — flat felt and large flat card faces have little sub-pixel texture to lose, and at
phone viewing distance the difference is hard to see. Both facts are true; neither alone is honest.

**Alternatives, not built** (the brief said not to rebuild the rig):
1. Capture at 1080 CSS px — but the app's phone layout stops at width 500, so this pushes it into
   the tablet layout. Different app, not a sharper video.
2. Record via CDP screencast instead of Playwright video, which does honour device scale.
3. Screenshot sequence at scale 2.222 + assemble at 25fps — sharpest, and loses real animation
   timing.

## 5. TIKTOK DOMAIN VERIFICATION — prepared, not done

**Not attempted: it requires an account.**

Verifying `ftable.co.il` covers its subdomains and all paths, so it is done once. Two methods:

| method | what it needs | who does it |
|---|---|---|
| **DNS TXT** | a TXT record on `ftable.co.il` | DNS is at **spd.co.il** — a separate control panel, and propagation waits |
| **HTML file** | drop `tiktok<hash>.txt` at the domain root | **cPanel File Manager, same place the videos go — instant** |

**Recommendation: the file method.** The videos already require a cPanel upload, so it is the same
session and the same tool, with no third party and no propagation delay. The DNS route means a
second vendor and a wait.

Other posting requirements already established: `video.publish` scope, Direct Post; **unaudited
clients are restricted to private viewing** until app review; PULL_FROM_URL forbids redirects and
allows up to 1 hour to pull, so the URL must stay up throughout. Meta/Instagram needs a
professional account plus a Page, App Review, Page Publishing Authorization, and media on a
publicly accessible URL (100 posts/24h).

## 6. STATE

- Production **unchanged**. No `app_config` row has been touched since 2026-08-22:
  `iap_enabled` false, `web_payments_enabled` false, `hand_rake_pct` 5 (unchanged since 2026-07-11).
- `chip_purchases` **0** — the stale `test-receipt-001` row purged last sprint, nothing since.
- The rig contacted production **zero** times: it serves a local `expo export` and route-aborts
  `supabase.co` and `ftable.co.il`. It creates no devices to clean up.
- **No video file was added to the repo.** (`docs/Screenshots/` holds two unrelated `.mp4`s from
  2025-09 and 2026-03, both predating this work.) The 26 MB of output lives outside it.
- App untouched: no felt, panels, cues, economy or flags. `KILL_Board` not flipped.
