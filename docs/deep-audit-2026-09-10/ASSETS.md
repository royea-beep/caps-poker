# Assets — measured by sha256, 2026-09-10 (repo `ef55640`)

`sha256sum` on every file under `assets/`, `public/`, `3D-Renders/`, plus every video, font and cover in the repo. Pairs are called identical only when the hashes match.

## Shipped app assets (`assets/`, 21 files)

| file | bytes | sha256 (16) | consumed by |
|---|---|---|---|
| icon.png | 410,061 | e053fb9f6371f566 | app.json `icon`, expo-notifications icon; Facebook profile picture (live) |
| adaptive-icon.png | 410,061 | e053fb9f6371f566 | **identical to icon.png**; not referenced by app.json (android adaptiveIcon uses the three android-icon-* files) |
| android-icon-background.png | 69,733 | 4855735ca6130441 | app.json android.adaptiveIcon |
| android-icon-foreground.png | 24,496 | 77de703f3a77b50f | app.json android.adaptiveIcon |
| android-icon-monochrome.png | 19,924 | a5faa2aaf389437e | app.json android.adaptiveIcon |
| favicon.png | 4,197 | f58de81327c81ade | app.json web.favicon |
| splash.png | 976,739 | e45cd425138d3cde | app.json splash.image (native only; web export has 0 splash references) |
| splash-icon.png | 976,739 | e45cd425138d3cde | **identical to splash.png**; not referenced |
| sounds/ambient.mp3 | 720,604 | e48a8713e1041d24 | utils/sounds.ts ambient loop |
| sounds/boardWin.wav | 44,178 | 3c395893a27a6618 | `playSound('boardWin')` — BoardReveal.tsx:552, results.tsx:363 |
| sounds/boardLose.wav | 44,178 | **3c395893a27a6618** | `playSound('boardLose')` — BoardReveal.tsx:555. **Byte-identical to boardWin.wav** |
| sounds/revealStart.wav | 44,178 | **3c395893a27a6618** | `playSound('revealStart')` — BoardReveal.tsx:425, results.tsx:393. **Byte-identical to boardWin.wav** |
| sounds/buzzer.wav | 44,178 | d626ba08f0d5565f | same byte size as the three above, different content |
| sounds/cardFlip.wav | 8,864 | f072eef49649d1a1 | |
| sounds/cardPlace.wav | 10,628 | 456eb88c1edab61b | |
| sounds/cardSelect.wav | 5,336 | 0adc1c2e4e0ce9a2 | |
| sounds/chipsWin.wav | 35,322 | ccd84a679d204a2b | |
| sounds/complete.wav | 72,806 | 084a7f9ef119587e | |
| sounds/lose.wav | 27,386 | 07cb8b2125dff5d6 | |
| sounds/timerLow.wav | 7,100 | 5949dbccbf858016 | |
| sounds/README.txt | 487 | cd1e1f29d49760b1 | lists four `.mp3` names; the directory holds 13 `.wav` + 1 `.mp3` — stale |

Three `SoundName`s declared in `utils/sounds.ts` — `turnReveal`, `riverReveal`, `boardTransition` — have no file at all and resolve to `null` (silently skipped).

## Web (`public/`, 8 files)

| file | bytes | sha256 (16) | note |
|---|---|---|---|
| landing.html | 32,816 | ea6740a001aab871 | served live (200, 32,816 B, explainer embed with pinned sha) |
| shots/explainer-poster.webp | 10,060 | 6b09d4234d01d692 | video poster |
| shots/game-boards.webp | 50,544 | 083e851ddbdb0721 | **identical to game-boards-en.webp** |
| shots/game-boards-en.webp | 50,544 | 083e851ddbdb0721 | |
| shots/game-boards-he.webp | 46,806 | e3699e4a842d04e9 | |
| shots/game-reveal.webp | 40,930 | ac39147867dde2ad | **identical to game-reveal-en.webp** |
| shots/game-reveal-en.webp | 40,930 | ac39147867dde2ad | |
| shots/game-reveal-he.webp | 33,496 | edd7d48ab5b1a9da | |

## Covers — which one is live, by content

| file | pixels | bytes | sha256 (16) | status |
|---|---|---|---|---|
| docs/cover-art-2026-09-09/facebook-cover-851x315.png | 851×315 | 16,768 | af361d77b0555ed7 | **LIVE on the Facebook Page** — one spade left, one heart right, URL line (identified by content in `docs/social/FACEBOOK-PAGE-RUNBOOK.md` §2; not re-verified from here, no browser path to Facebook) |
| docs/cover-art-2026-09-09/facebook-cover-with-avatar-overlay.png | 851×315 | 19,608 | 7ef510e121ef4937 | preview only, never upload |
| docs/cover-art-2026-09-09/facebook-cover-phone-size-390w.png | 390×144 | 9,362 | bb042b9678a0d052 | preview only |
| docs/cover-art-2026-09-09/vertical-cover-1080x1920.png | 1080×1920 | 50,638 | cfefc615b06b6b3e | IG/TikTok, unused |
| docs/social/caps-cover-facebook-1640x664.png | 1640×664 | 317,637 | e5072314b87e93b1 | earlier candidate, NOT live (four suits in a row, no URL) |
| docs/f-icon/social/OPTIONAL-cover-facebook-1640x664.png | 1640×664 | 320,428 | 927e03fca6aea518 | **same name shape and size as the docs/social file, different bytes** — a look-alike pair that is not a pair |
| docs/social/caps-cover-wide-1920x1080.png | 1920×1080 | 573,880 | 4552555a550c4b36 | unused |
| docs/f-icon/social/OPTIONAL-cover-wide-1920x1080.png | 1920×1080 | 579,709 | 39562dfe0383e74d | look-alike of the above, different bytes |

## Other

- Fonts: one, `tools/icon/fonts/PlayfairDisplay.ttf` (icon generator only). The app uses system fonts.
- Videos: 10 mp4 in `docs/` (8 per-screen explainer clips in `docs/explainers/`, 2 old screen recordings). **No `caps-explainer-FINAL.mp4` is vendored**; the shipped one is on Supabase Storage `bly-review/caps/`, sha256 `fb456341…`, 5,358,156 bytes, pinned in `public/landing.html`.
- SVG: 0. Images under `docs/`: 861 (screenshots, store shots, icon history).
- 3D-Renders/: 15 card-protector concept PNGs from 2026-03-25, unreferenced by code.
