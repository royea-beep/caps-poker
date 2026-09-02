# VAMOS CAPS LANDING-SCREENSHOTS — 2026-09-02

The page explained the game but never showed it. Now it shows two real screens of the current app —
the three boards and the live-odds reveal — plus the legal footer the app already carries. Branch
`claude/vamos-caps-align-celebration-flppo0`. **Not merged, no bump.** Only `public/landing.html`,
`public/shots/`, `docs/splash-landing/` (app untouched).

## MAP (carried forward)
h154 made the page bilingual. Roye caught that it showed no game at all — a wasted first impression
when the game screen finally looks good. Stills, not a video (a still paints instantly, works muted,
needs no tap, and the visitor just came from a TikTok — a second video is repetition), and the whole
strategy rests on the page staying instant.

## Screenshots: which screens, rendered from the current build — proven how
Two, strongest first:
1. **The three boards** (`public/shots/game-boards.webp`) — the multi-board place screen. The one
   image that explains the product without a sentence: three boards, four cards on each, one hand.
2. **The reveal** (`public/shots/game-reveal.webp`) — a live board with win-probability bars (Bot 1
   71% · YOU 20% · Bot 2 9%), "5 OUTS", community + player hands. Real poker depth.
The **home** screen was omitted — it shows a brand, not a game, and the page already *is* that
masthead; omitting it also keeps the weight down.

**Proven fresh from the current build:** a clean `expo export -p web --clear` of this branch
(`da13928`) was served locally and walked (home → practice → place → reveal) with Playwright; the
frames are those captures, downsized to 660px-wide WebP. Not the old previews, not a mockup — the
current app. (Walk + capture: `tests`-style scratch scripts; the exports and raw PNGs are build
artifacts, not committed — the committed WebP and the in-context page renders are the record.)

## Placement: where, relative to the CTA
The three-board hero sits **after the headline/mechanic and before the CTA** — a visitor sees the game
before they decide. The reveal sits **below the CTA**, before the FAQ.

## Page weight before → after | load behaviour: still instant, proven
Same-origin transfer (HTML + images; the Google font is cross-origin and unchanged):
- **Before:** ~17 KB (HTML only).
- **After:** ~112 KB — HTML ~20 KB + two WebP (hero **52 KB**, reveal **39 KB**).
- **First meaningful paint:** HTML + the **eager** hero (`fetchpriority="high"`) ≈ **~72 KB**; the
  reveal is **`loading="lazy"`** (below the fold), so it never gates first paint. ~72 KB is ~0.05 s on
  4G / ~0.4 s on slow 3G — the page stays instant. (Measured `shots-proof.json`: on the local test's
  fast connection Chromium's lazy threshold pulls both, but on a real/slow connection the lazy reveal
  defers; either way first paint is HTML + hero.) The jump is 95 KB of image for the entire product
  story — kept, because 112 KB total is still an instant page; had it jumped materially past that a
  screenshot would have been cut.

## Lazy-loading / compression: what I did
- WebP, quality 82, resized to 660px wide (sized for phone display, ~224px CSS width). Hero 52 KB,
  reveal 39 KB (down from ~570 KB / ~187 KB raw PNG).
- Hero: `fetchpriority="high"`, `decoding="async"`, explicit `width`/`height` (no layout shift).
- Reveal: `loading="lazy"`, `decoding="async"`, explicit dimensions.
- Assets live in `public/shots/` and are referenced **relatively** (`shots/…`), so they ship in the
  export and survive a domain move like the rest of the page.

## Language-matched screens: Hebrew page shows Hebrew — the honest answer
**The app renders the game/results chrome in English regardless of locale** (proven: the walk ran in
both `en-US` and `he-IL` and produced identical English UI — "PLACE 12 CARDS", "BOARD 1/2/3",
"Auto-Place", "Confirm"; only the dealt cards differed). `caps_language` isn't applied to these
screens yet (flagged in h153/h154). So a "Hebrew screenshot" cannot be produced without fabricating
one — which would break the truth rule this whole sprint enforces. The honest, coherent resolution:
- The screen images are **language-neutral where it matters** — cards on felt across three boards; and
- each screenshot carries a **translated caption** and sits inside fully-translated page copy, so the
  Hebrew visitor reads Hebrew around a real game image (hero caption HE: "יד אחת, שמשוחקת על כל
  הבורדים בבת אחת"; reveal HE: "סיכויים ואאוטים בזמן אמת, כשכל בורד מתגלה").
**Recommendation (app, out of scope here):** apply `caps_language` to the game/results screens; then
re-shoot the Hebrew screens for the Hebrew page. Until then, real-English-with-Hebrew-caption is the
truthful choice.

## Footer links: where each points | contact address
A quiet footer under the legal block: **Privacy Policy → `/privacy.html`**, **Terms of Use →
`/terms.html`**, **Contact → `mailto:caps@ftable.co.il`**. Root-relative to match exactly what the app
opens from Settings (`app/settings.tsx:1396/1403` → `caps.ftable.co.il/privacy.html` / `terms.html`,
both live `200`) and to survive a domain move. **No new policy text written** — links to what exists.
Contact is **caps@ftable.co.il**, confirmed. Both languages (מדיניות פרטיות · תנאי שימוש · צור קשר).

## Still one CTA | footer does not compete
Measured: **exactly one `.cta`** (the mint "Play now") and **3 footer `<a>`** which are small (12px),
dim (`--ink-dim`), underlined, at the very bottom — styled as utility links, not buttons, so they read
as legal/contact, never as a second action. No signup wall, no email capture, no second CTA.

## Both languages rendered 320/393/430 | git show
`docs/splash-landing/landing-{en,he}-{320,393,430}.png` (re-rendered with the screenshots in place) +
`shots-proof.json`. Assets: `public/shots/game-boards.webp`, `public/shots/game-reveal.webp`.
```
git show HEAD:public/landing.html | grep -n "shots/game-boards\|shots/game-reveal\|class=\"footer\"\|caps@ftable"
git show --stat HEAD
```

## Contrast / 44pt / overflow | canary first
Canary first: CTA fill **mint `rgb(79,214,168)`**, not gold, both languages. CTA 84px; footer links a
comfortable ≥36px tap. No overflow at 320/393/430 in either language. Contrast (unchanged tokens):
promise 14.5 · gold 7.25 · caption/body 6.5 · CTA label on mint 10.4 · legal/footer 6.5–6.9 — AA/AAA.

## Screenshots show only what is true today
Both frames are the real current build: a genuine 3-player practice hand (three boards, real cards),
and the real live-odds/outs reveal the app computes. "Practice · no chips" is the true mode label.
Nothing fabricated, no invented number, no unshipped feature; captions are count-neutral (no "four
boards"). Same truth rule as the copy.

## Not merged, no bump
Branch only; 2.7.0 / build 513 untouched; app/economy/flags untouched. Only `public/landing.html` +
`public/shots/`.
