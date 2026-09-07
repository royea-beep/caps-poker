# Icon history

Every icon CAPS has ever pointed `app.json`'s `icon` at, oldest first. This archive exists because
the project overwrites art in place: `assets/icon.png` alone has held **seven** different pictures,
and the C icon was lost for five months because walking filenames finds commits while telling you
nothing about what was in them. Recovered in Sept 2026 by walking 12,531 git objects through
`git cat-file` and looking at every distinct blob.

| file | commit | date | icon for | what it depicts |
|---|---|---|---|---|
| `00-expo-placeholder-…` | `91f0f6a` | 2026-03-11 | hours | Expo template chevron on pale blue |
| `01-flat-green-…` | `20c853d` | 2026-03-11 | hours | flat dark green, no mark — a declared placeholder |
| `02-CP-…` | `adee655` | 2026-03-11 | 1 day | gold "CP" on dark green, spade lower-right |
| `03-C-GREEN-…` | `582e93c` | 2026-03-12 | 6 days | ivory C, gold double ring, corner suits |
| `04-C-BLACK-…` | `64cef22` | 2026-03-18 | **165 days** | gold C on near-black, four suit pips |
| `05-C1-CARD-…` | `fe1b60c` | 2026-08-30 | 8 days | cream playing card, gold border, navy spade |
| `06-F-FULL-…` | this branch | 2026-09-07 | **live** | ♠♥♦♣ / CAPS / POKER, gilded on felt — 144px and above |
| `07-F-COMPACT-…` | this branch | 2026-09-07 | **live** | ♠♥♦♣ / CAPS, gilded on felt — below 144px |

**F ships as a responsive pair, not one image.** The boundary is 128px, measured by
`docs/f-icon/threshold.mjs`, and `plugins/withResponsiveIcons.js` writes the right variant into each
native icon slot at prebuild. `06-` and `07-` are the two 1024 masters; every shipped size is derived
from them in `docs/f-icon/built/`.

`ICON-COMPARISON.png` and `FIRST-SECOND.png` are the sheets Roye chose from.

**Do not overwrite an icon in place.** Add the next one as `08-`.
