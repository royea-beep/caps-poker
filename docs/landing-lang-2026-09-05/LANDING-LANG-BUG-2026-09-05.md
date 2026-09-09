# VAMOS CAPS LANDING-LANG-BUG — 2026-09-05

Branch `claude/vamos-caps-align-celebration-flppo0`. Nothing published, nobody invited, no app
change, no economy change, no flag change. Copy unchanged.

---

## MAP — carried forward

Landing page live, 200, and the copy is right: *"More than one way to win — every hand."*, the
format explained in words, *"Free · in your browser · no sign-up"*, no invented numbers, no store
date. That part is good and was not touched. The web-provable tap-list items were swept; five
device-only taps remain and are genuinely untestable without hardware.

Roye's rule, verbatim: *"It cannot be that someone picks English and one thing shows in Hebrew.
The other way round is acceptable."* English → Hebrew is zero-tolerance. Hebrew → English is fine.

---

## ROOT CAUSE — established from the deployed bytes, and it is none of the three candidates

I fetched `https://caps.ftable.co.il/landing.html` with `curl` (20,791 bytes) and parsed it.

**The deployed page has no image-swap mechanism at all.** It contains exactly two `<img>` tags,
each with a single unconditional `src`:

```html
<img src="shots/game-boards.webp"  width="660" height="1431" fetchpriority="high" …>
<img src="shots/game-reveal.webp"  width="660" height="1431" loading="lazy" …>
```

- `img data-l` appears **0** times.
- The `.shot img[data-l]` CSS rule appears **0** times.

So it is **not** a CSS specificity fight — there is no rule to lose. It is **not** a missing or
mis-named English asset — the page never asks for one. The English screenshot is not referenced
because **the deployed HTML predates the language-swap feature entirely.** The toggle swaps the
*text* because the text spans do carry `data-l`; the images do not.

And the two files it does load are the Hebrew screenshots. Both fetched from the CDN and confirmed
**byte-identical** (md5) to `origin/main`'s committed `public/shots/game-boards.webp` and
`game-reveal.webp`. I converted and looked at the hero: "כל הקלפים הונחו!", "בוטים 2/2", "✓ מוכן",
"בורד 1 / 2 / 3", "היד שלך", "ביטול", plus a Hebrew coaching tooltip. Exactly what Roye saw.

> The previous sprint's claim — "both languages now shot from the current build and swapped by the
> page's own toggle" — was true **of the branch** and false of the live site, and the report said
> so. It did not connect that to the sentence a reader takes away. That is the correction.

---

## FIXED

**1. The asset layer, which is what actually reaches the live page.**
`public/shots/game-boards.webp` and `public/shots/game-reveal.webp` — the two names the deployed
HTML asks for — now hold the **English** images, byte-identical to the `-en` pair. They are
deliberately not referenced by this branch's `landing.html`; they exist so the deployed HTML
serves English the moment the assets ship, whether or not the HTML ships with them. A comment in
`landing.html` says so, because an unreferenced file is exactly the kind of thing a later sweep
deletes as dead.

Under Roye's rule this is a strict improvement, not a trade: English showing Hebrew is
zero-tolerance; Hebrew showing English is acceptable.

**2. A guard at the moment of capture.** `tests/landing-hero-shots.mjs` now refuses to write an
`-en` asset if the page it is photographing has any Hebrew character on screen, and refuses to
write a `-he` asset if it has none. The image *is* that DOM, so the DOM's script settles the
image's script — no OCR, no recognition error, and the wrong asset can never reach disk.

**3. A gate that reads the pixels.** New `tests/landing-image-lang.mjs` — below.

Not changed: the copy, the CTA, the wording, the FAQ, the legal line, the layout.

---

## PROVED THE WAY ROYE FOUND IT — rendered, both languages, 320 and 393, both engines

`tests/landing-image-lang.mjs` loads the page in a browser, finds every **painted** `<img>`, and
reads the **pixels** of each. Three targets, 8 combinations each (2 engines × 2 languages ×
2 widths).

| target | English page | Hebrew page | blocking failures |
|---|---|---|---|
| **the live bytes, as deployed** | `game-boards.webp` + `game-reveal.webp`, **28 Hebrew words** | same two files | **4** |
| deployed HTML + the corrected assets | same two files, **0 Hebrew words** | English shots (acceptable) | **0** |
| **this branch's page** | `-en` pair, **0 Hebrew words** | `-he` pair, 14 Hebrew words | **0** |

The words the detector pulled out of the live English page are the ones Roye listed by eye:
היד · שלך · מוכן · הקלפים · הונחו · בוט · בורד · ביטול · בוטים.

### How I checked inside the images — and the first detector was wrong

OCR, with `tesseract.js` and the Hebrew model. **The obvious detector does not work.** Counting
characters in the Hebrew Unicode block reported **61 Hebrew characters in a screenshot that is
entirely English**: a Hebrew-trained model transliterates Latin glyphs into Hebrew-looking ones —
"ALL CARDS PLACED" came back as `ופפסאום 5םאאס`. A range count is noise.

The detector therefore matches **the product's own Hebrew words**: every Hebrew token of three or
more characters in the `he` table of `utils/i18n.ts` — **452 tokens**, extracted at run time, so
the vocabulary cannot drift away from what the screens actually say. A hit means the image
contains a word CAPS really renders.

**Canary first, both directions, before any number about the page is reported:**

| canary | expected | got |
|---|---|---|
| the image the live page was serving | flagged | **16 product words** (היד, שלך, מוכן, הקלפים, הונחו, בורד, ביטול, בוטים, …) |
| `public/shots/game-boards-en.webp` | clean | **0 words**, despite the OCR emitting Hebrew-looking noise |

The run aborts and reports nothing if either canary misbehaves.

Two details worth keeping: the probe reads each **file** rather than the rendered `<img>`, because
the second figure is `loading="lazy"` and a full-page screenshot can catch it unpainted — reading
the file is both cheaper and stricter. And each distinct file is OCR'd once and cached, since an
image's content does not change with viewport or engine.

### Every image, not just the hero

The probe enumerates all painted `<img>` elements and also counts CSS `background-image` uses.
On this branch's page: **2 images, 0 CSS background images** — the captions, the FAQ and the legal
block are text, so they follow the toggle. There is no `og:image`, so nothing is baked for social
either.

### Before / after

```
git show HEAD -- docs/landing-lang-2026-09-05/                    # all 24 renders + the three JSON reports
git show HEAD:docs/landing-lang-2026-09-05/livesnapshot-en-393-chromium.png      # BEFORE: English page, Hebrew screenshot
git show HEAD:docs/landing-lang-2026-09-05/local-en-393-chromium.png             # AFTER:  English page, English screenshot
git show HEAD:docs/landing-lang-2026-09-05/livesnapshotfixed-en-393-chromium.png # the deployed HTML with the corrected assets
git show HEAD -- public/shots/                                    # the un-suffixed pair, now English
git show HEAD -- tests/landing-image-lang.mjs                     # the gate
```

---

## WHY THE SWEEP MISSED IT — the blind spot, named

**A DOM text scan reads text *nodes*. A word baked into a PNG is not a text node.** Every
language check in this project reads the rendered DOM, so all of them are structurally blind to
any text that has become pixels. The landing loop went one step further and checked the image
`src` — but a filename is a *claim* about content, not the content, and on the deployed page the
filename was honest while the file was not.

**This is the same shape as "a truncated string has excellent contrast."** The instrument measures
a real property, reports it accurately, and the property is not the one that matters. Contrast was
measured on a string that was already wrong; language was measured on the half of the page that
was already right. Both pass loudly. Call it **measuring the wrong layer**: the check and the
defect live on different layers, so a green result carries no information about the defect.

Measured: **125 of 160** scripts in `tests/` scan DOM text. **Zero of them looked inside an image
before this sprint.**

### Other checks sharing the blind spot

| where | what is baked into pixels | severity |
|---|---|---|
| `tests/i18n-loop.mjs` | the 26-route Hebrew-in-English sweep reads text nodes only. Its 0-leak result covers **rendered text, not screenshots or icons** | the headline i18n guarantee is narrower than it sounds |
| `tests/landing-loop.mjs` | asserted the image `src`, never the image | this defect, exactly |
| `tests/tap-list-sweep.mjs` | DOM text for every tap-list item | same class |
| `utils/__tests__/i18n-parity.test.ts` | compares the two key tables; renders nothing | cannot see any image |
| `components/ShareCard.tsx` | **"Community", "Your Hand", "Opponent", "Play CAPS Poker" are hard-coded English with no `t()`**, and `captureRef` rasterises the card. A Hebrew player shares an English image | **acceptable** under the rule (Hebrew → English), but it is the same mechanism and would be a defect if the polarity ever flipped |
| BackstopJS (12 scenarios) | pixel diffs — it would catch a *change*, but a baseline captured in the wrong language locks the wrong language in. It does not cover `landing.html` at all | latent |
| the splash, the app icon, the App Store screenshots | wordmark and captions are pixels | unchecked by any language test |
| `docs/**` screenshot sets used as evidence | whatever language the rig was in | this is how a stale asset survives review |

The general rule to carry: **wherever a check reads text and the product ships that text as an
image, the check proves nothing about the image.** Either read the pixels, or assert the language
at the moment the image is made. This sprint added both for the landing page.

---

## Housekeeping

- The live page still serves the old bytes; nothing was deployed. Reaching the live site needs the
  deploy already flagged in handoff 168 — main is behind, and the same deploy also fixes the
  catch-all that returns 200 for a missing file.
- `tesseract.js` is installed with `npm i --no-save` and is **not** in `package.json` — that file
  is outside this sprint's edit scope, and the probe is not part of the jest suite. The command is
  in the probe's header.
- Production unchanged: no app change, no economy change, no security change, no flag change.
