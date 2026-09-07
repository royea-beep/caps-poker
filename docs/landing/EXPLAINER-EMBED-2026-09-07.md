# The explainer is on the landing page — and the 404 rule was fixed in the wrong file

**Date** 2026-09-07 · `public/landing.html` · every number below was measured today.

---

## §1 · The video

### Where it sits

`public/landing.html`, in a `<figure class="film">` between the one-line mechanic and the fold's
call to action:

```
langbar → masthead → promise → mechanic → multiplayer hook → ▶ THE FILM → how a hand works
        → screenshot → PLAY NOW → reassure → second screenshot → FAQ → legal
```

Measured in the browser rather than argued from the source: the figure's top is at **518px** and
the call to action's top is at **1975px** on a 320px English page, so `filmBeforeCta` is true in
all eight render combinations.

### Not vendored, and pinned so a swap is noticeable

The mp4 is served from Supabase Storage. Nothing binary beyond a 10KB poster entered the repo.

| | |
|---|---|
| URL | `https://vjxqlqtlywovnbidovit.supabase.co/storage/v1/object/public/bly-review/caps/caps-explainer-FINAL.mp4` |
| sha256 | `fb456341645d554b50b48dfaff9eea446c5d628fbe835239e11f63e9382b9ecd` |
| bytes | **5,358,156** |
| streams | h264 1080×1920 · aac · **29.64s** |

Both the hash and the byte count are in a comment beside the embed, with the command that checks
them. ⚠️ **Three different files have worn this filename.** A name is a claim about content, not
the content; the comment is what lets the next person notice a swap instead of shipping somebody
else's video.

### Muted, click-to-play, never autoplay

`controls muted playsinline preload="metadata"`, and no `autoplay`. Nothing moves and nothing
sounds until a finger asks, and only the file's headers are fetched on page load. Asserted, not
assumed: `paused` is true and `autoplay` is absent in all eight combinations.

### The poster, and why it is the end card

One still from that exact file at 28.6s — its end card — as a 10KB WebP at
`public/shots/explainer-poster.webp`.

⚠️ **A gameplay frame was the obvious choice, was built first, and was rejected after looking at
it.** Two reasons, both measured:

1. **Chromium paints its control bar over the bottom of the poster.** Every gameplay frame in this
   clip carries its burnt-in caption in exactly that band, so the poster shipped a half-covered
   sentence. The end card's bottom 12% is empty felt — brightest pixel **54 of 255** — so the bar
   covers nothing.
2. **Every placement frame carries the demo balance 499,900.** The richest real player in the
   database holds **3,250**, and a new device gets 2,000. A poster must not promise a number the
   product cannot pay. (The reveal frames carry no chip counter; they lost on reason 1 alone.)

The page already carries two gameplay screenshots below the fold. The poster did not need to be a
third.

### Both languages, and the specificity trap on the way

The video is English and stays English — that is the correct state, CAPS is English-first. Only
the chrome around it translates:

| | English | Hebrew |
|---|---|---|
| heading | Watch a hand | ככה נראית יד |
| caption | Thirty seconds: the cards go down, then every board reveals at once. | שלושים שניות: מניחים את הקלפים, ואז כל הבורדים מתגלים בבת אחת. |
| hint | *(none — an English reader does not need telling)* | הסרטון באנגלית. |

⚠️ **The hint nearly shipped Hebrew onto the English page.** It needs `display:block` to sit on its
own line, and `.film .hint{display:block}` beats the generic `[data-l]{display:none}` on
specificity — so it would have painted in both languages. That is the same trap the `.shot` images
hit and recorded in this file. Both halves are restated at `.film` level, exactly as `.shot img`
does.

### Proven by rendering, not by reading

`tests/film-verify.mjs` asserts and exits non-zero. Chromium and WebKit × English and Hebrew ×
320px and 393px = **8 combinations, 0 failures**:

| Asserted | Result |
|---|---|
| `<video>` present in `.film` | 8/8 |
| `controls` set · `muted` true · `autoplay` absent · still `paused` | 8/8 |
| `preload="metadata"` | 8/8 |
| poster request | **HTTP 200**, 8/8 |
| film above the call to action | 8/8 |
| Hebrew inside the film section on the **English** page | **0**, 8/8 |
| Hebrew present in the film section on the Hebrew page | 8/8 |

WebKit also decoded the remote source: `videoWidth 1080 · videoHeight 1920 · duration 29.64`. So
the hosted URL is reachable and is the file whose hash is pinned.

⚠️ **One honest boundary.** Chromium reported the duration on the first run and not on the second;
the remote fetch through this container's proxy is intermittent. The poster, the attributes and
the layout are asserted in both engines; the *decode* of the remote source is proven in WebKit.

---

## §2 · The catch-all 404 — it does not hold, and it never did

The brief asked me to confirm the extension-path fix still holds. **It does not.** Measured on the
live site before touching anything:

| Request | Response |
|---|---|
| `/definitely-missing-abc123.html` | **200** · 1,902 bytes of the app's HTML |
| `/nope.png` | **200** · 1,902 bytes |
| `/nope.mp4` | **200** · 1,902 bytes |
| `/shots/game-boards-en.webp` (real file) | 200 · 50,544 bytes · `image/webp` |

### Why

On 2026-09-03 the dotted-path exclusion went into the **root** `vercel.json`. The deploy step runs
`npx vercel --prod` **from `dist/`**, and `scripts/fix-web-html.js` writes `dist/vercel.json` —
which still carried `{ source: "/(.*)", destination: "/index.html" }`.

⚠️ **The generator's own comment has said so since 2026-08-15:** *"this is the vercel.json that
ACTUALLY ships: the CI deploy runs `vercel --prod` from dist/, so the root vercel.json is never
read in prod."* The fix landed in the other file anyway, and `tests/vercel-rewrites.test.ts` pinned
the config that is not served. Four days open, on the exact rule whose stated purpose is to stop an
absent file reading as "deployed".

### Fixed where it ships, and guarded so it cannot drift again

The exclusion now lives in `scripts/fix-web-html.js`, character-identical to the root one, with the
two missing `.html` rewrites carried over. `tests/vercel-rewrites.test.ts` now reads the
**generator's source** and fails if the two configs disagree.

⚠️ **The guard was proven to fire**, not assumed to: reverting the generator turns both new tests
red and restoring it turns them green.

```
✕ the vercel.json that SHIPS excludes dotted paths too
✕ the shipped catch-all keeps every SPA route and drops every dotted path
```

`.png` and `.mp4` were added to the missing-path list, because those are the two extensions the
brief names and the two the list did not cover.

---

## §3 · Live

Merged `claude/vamos-caps-align-celebration-flppo0` into `main` as **044cca7** (merge commit;
the sprint's own commit is **314dcf4**). `git ls-remote origin main` reads back
`044cca7b34beaf9daabf11d8c3900553bf2b7243`. Web Deploy run **1631** built and shipped it.

### The 404 rule, now that the right file ships

| Request | Before the merge | After |
|---|---|---|
| `/definitely-missing-abc123.html` | 200 · 1,902B app HTML | **404** · 79B `text/plain` |
| `/nope.png` | 200 · 1,902B | **404** · 79B |
| `/nope.mp4` | 200 · 1,902B | **404** · 79B |
| `/landing.htm` (one letter off) | 200 · 1,902B | **404** · 79B |
| `/landing.html` | 200 | **200** · 32,816B |
| `/shots/explainer-poster.webp` | **200 · 1,902B of app HTML** | **200** · 10,060B `image/webp` |
| `/battle-pass` · `/lobby/table` · `/profile` · `/` | 200 | **200** — SPA routes unaffected |

⚠️ Note the poster row. Before the merge the *poster's own path* came back as the app's HTML.

### Verified by content, not by filename and not by the bundle's hash

The live bytes were fetched and compared against the repo:

| File | live md5 | repo md5 | |
|---|---|---|---|
| `landing.html` | `f50681ac…83dcc` | `f50681ac…83dcc` | identical |
| `shots/explainer-poster.webp` | `779252e0…94446` | `779252e0…94446` | identical |

Then the poster served by the CDN was **decoded and compared per pixel** with a frame freshly cut
from the video, which is a content check rather than a filename check. It separates cleanly:

| The live poster, against | Mean absolute RGB difference |
|---|---|
| the video at 0.2s | 48.148 |
| the video at 13.2s | 48.233 |
| the video at 20.0s | 49.978 |
| **the video at 28.6s** | **1.135** ← the frame it claims to be (the rest is WebP compression) |
| the other live screenshot on the page | 48.632 |

And the video the live page points at was fetched from the URL the live HTML declares:

```
HTTP 200  bytes=5358156  type=video/mp4
fb456341645d554b50b48dfaff9eea446c5d628fbe835239e11f63e9382b9ecd
```

which is the sha256 pinned in the live page's own comment — checked by reading it back out of the
served bytes, not out of the working tree.

### Rendered, in a real browser, and looked at

⚠️ **How "live in a real browser" is done here, stated rather than glossed.** This container's
browser cannot open `caps.ftable.co.il` — the agent proxy resets the tunnel — while curl to the
same URL returns 200. So the live bytes are fetched, their md5 printed against the repo's, and
**those exact bytes** are rendered. The `<video src>` is left pointing at the real Supabase URL, so
the browser reaches out to the same origin a visitor's would.

| Asserted on the LIVE bytes | Chromium + WebKit × EN/HE × 320/393 |
|---|---|
| `<video>` present, `controls`, `muted`, no `autoplay`, still `paused` | **8/8** |
| `preload="metadata"` | 8/8 |
| poster request | **HTTP 200** 8/8 |
| video box | 260 × 462 in all eight |
| film above the call to action | 8/8 (film at 501–581px, CTA at 1946–1997px) |
| Hebrew in the film section on the **English** page | **0** |
| remote source decoded | WebKit: **29.64s**, 8/8 of its four |

**Looked at, not just measured:** `docs/landing/live-2026-09-07/FILM-SECTION-LIVE.png` (six crops)
and `FULL-PAGE-LIVE.png` (four full pages). The end card fills the frame, the control bar sits over
empty felt, the mute icon shows crossed-out, and the Hebrew hint appears only in Hebrew.

⚠️ **One artifact in the full-page captures, checked rather than excused.** Three of the four
full-page shots show the two gameplay screenshots as empty bordered boxes. That is
`loading="lazy"` plus a full-page screenshot, not a broken page: scrolling the same live bytes and
re-reading the DOM returns `complete: true` and `naturalWidth 660 × naturalHeight 1431` for both
images in both languages. Pre-existing behaviour, unrelated to this change.

### Boundary

Chromium reported the video's duration on one local run and not on others; the remote fetch through
this container's proxy is intermittent. The poster, the attributes and the layout are asserted in
both engines; the **decode of the remote source is proven in WebKit**, four runs out of four.

---

## Suite

**2,819 tests, 51 suites, all green.** `tsc --noEmit` clean.

## Where the screenshots are

```bash
git show origin/main:docs/landing/live-2026-09-07/FILM-SECTION-LIVE.png > /tmp/film.png && open /tmp/film.png
git show origin/main:docs/landing/live-2026-09-07/FULL-PAGE-LIVE.png   > /tmp/full.png && open /tmp/full.png
git show origin/main:docs/landing/live-2026-09-07/live-en-320-chromium.png > /tmp/en320.png && open /tmp/en320.png
git show origin/main:docs/landing/live-2026-09-07/live-he-320-chromium.png > /tmp/he320.png && open /tmp/he320.png
git show origin/main:docs/landing/live-2026-09-07/live-en-393-chromium.png > /tmp/en393.png && open /tmp/en393.png
git show origin/main:docs/landing/live-2026-09-07/live-he-393-chromium.png > /tmp/he393.png && open /tmp/he393.png
git show origin/main:public/shots/explainer-poster.webp > /tmp/poster.webp && open /tmp/poster.webp
git show origin/main:public/landing.html | sed -n '/THE EXPLAINER ═/,/<\/figure>/p'
git show --stat 314dcf4
```

And the two checks anyone can re-run:

```bash
node tests/film-verify.mjs                                   # working tree, 8 combinations
node tests/live-landing-snapshot.mjs && ROOT=/tmp/live-snapshot TAG=live node tests/film-verify.mjs
npx jest tests/vercel-rewrites.test.ts
curl -s -o /dev/null -w '%{http_code}\n' https://caps.ftable.co.il/nope.mp4     # expect 404
curl -sL https://vjxqlqtlywovnbidovit.supabase.co/storage/v1/object/public/bly-review/caps/caps-explainer-FINAL.mp4 | sha256sum
```

## What was NOT done

- **Production was not otherwise touched.** No flag, no Edge Function, no `game_rooms` or
  `room_players` row, no economy value, no TestFlight action. The only production change is the web
  deploy this brief asked for.
- **The public TestFlight link stays disabled** and **515 was not submitted for Beta App Review.**
- **The video was not re-encoded**, and the demo balance 499,900 inside it was not changed — it is
  the studio's file and it is flagged, not edited.
- **BackstopJS baselines were not regenerated.** The landing page is not in the Backstop scenario
  set, and that check is non-blocking; regenerating baselines for an unrelated surface is how an
  unrelated regression gets absorbed silently.
