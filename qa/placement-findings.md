# CAPS Placement-Matrix Auto-QA Findings (numeric)

Generated: 2026-06-15T12:23:04.600Z
Base URL: https://caps.ftable.co.il/game

## Hand row — CARD extents vs viewport (VAMOS-HAND-CLIP-2)

The hand-row container has `overflow:hidden`, so its rect always "fits" by definition. Real clip is whether any **card** extent breaks the viewport. **cardClip = (cardLeftOverflow > 0 OR cardRightOverflow > 0).**

| bc | width | VW | card span | card L margin | card R margin | cardClip | L overflow | R overflow | cards | W avg |
|---|---|---|---|---|---|---|---|---|---|---|
| 4 | 440 | 440 | 366 | 37 | 37 | false | 0 | 0 | 16 | 44 |
| 4 | 390 | 390 | 326 | 32 | 32 | false | 0 | 0 | 16 | 39 |
| 4 | 320 | 320 | 254 | 33 | 33 | false | 0 | 0 | 16 | 30 |
| 3 | 440 | 440 | 315 | 63 | 62 | false | 0 | 0 | 12 | 50 |
| 3 | 390 | 390 | 315 | 38 | 37 | false | 0 | 0 | 12 | 50 |
| 3 | 320 | 320 | 255 | 33 | 32 | false | 0 | 0 | 12 | 40 |
| 2 | 440 | 440 | 209 | 116 | 115 | false | 0 | 0 | 8 | 50 |
| 2 | 390 | 390 | 209 | 91 | 90 | false | 0 | 0 | 8 | 50 |
| 2 | 320 | 320 | 209 | 56 | 55 | false | 0 | 0 | 8 | 50 |

## Board 0 — community row centering inside board

Δ = L − R. **Δ near 0 ⇒ centered.** Positive = pushed right; negative = pushed left.

| bc | width | board W | comm L | comm R | Δ | comm W | board H |
|---|---|---|---|---|---|---|---|
| 4 | 440 | 418 | 105 | 104 | 1 | 209 | 124 |
| 4 | 390 | 378 | 85 | 84 | 1 | 209 | 124 |
| 4 | 320 | 308 | 50 | 49 | 1 | 209 | 124 |
| 3 | 440 | 418 | 77 | 77 | 0 | 264 | 157 |
| 3 | 390 | 378 | 57 | 57 | 0 | 264 | 157 |
| 3 | 320 | 308 | 22 | 22 | 0 | 264 | 157 |
| 2 | 440 | 418 | 60 | 59 | 1 | 299 | 162 |
| 2 | 390 | 378 | 40 | 39 | 1 | 299 | 162 |
| 2 | 320 | 308 | 5 | 4 | 1 | 299 | 162 |

## Board 0 — slot row centering inside board

| bc | width | board W | slot L | slot R | Δ |
|---|---|---|---|---|---|
| 4 | 440 | 418 | 127 | 126 | 1 |
| 4 | 390 | 378 | 107 | 106 | 1 |
| 4 | 320 | 308 | 72 | 71 | 1 |
| 3 | 440 | 418 | 105 | 104 | 1 |
| 3 | 390 | 378 | 85 | 84 | 1 |
| 3 | 320 | 308 | 50 | 49 | 1 |
| 2 | 440 | 418 | 91 | 90 | 1 |
| 2 | 390 | 378 | 71 | 70 | 1 |
| 2 | 320 | 308 | 36 | 35 | 1 |

## VAMOS-HAND-DIAG — hand sizing internals (data-* attrs on hand-row)

| bc | width | SCREEN_W | Dimensions.w | rowW | gridOuter | maxCardW | cardW pre | cardW final | cardsPerRow | gap | cardW src | final src |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 4 | 440 | 430 | 440 | 398 | 0 | 32 | 32 | 32 | 8 | 2 | min38 | cardW |
| 4 | 390 | 390 | 390 | 358 | 0 | 27 | 27 | 27 | 8 | 2 | min38 | cardW |
| 4 | 320 | 320 | 320 | 288 | 0 | 18 | 18 | 18 | 8 | 2 | min38 | cardW |
| 3 | 440 | 430 | 440 | 398 | 0 | 47 | 38 | 38 | 6 | 3 | min38 | cardW |
| 3 | 390 | 390 | 390 | 358 | 0 | 40 | 38 | 38 | 6 | 3 | min38 | cardW |
| 3 | 320 | 320 | 320 | 288 | 0 | 28 | 28 | 28 | 6 | 3 | min38 | cardW |
| 2 | 440 | 430 | 440 | 398 | 0 | 78 | 38 | 38 | 4 | 3 | min38 | cardW |
| 2 | 390 | 390 | 390 | 358 | 0 | 68 | 38 | 38 | 4 | 3 | min38 | cardW |
| 2 | 320 | 320 | 320 | 288 | 0 | 50 | 38 | 38 | 4 | 3 | min38 | cardW |

## Money pill resolved color

| bc | width | amount color | pill bg | pill border |
|---|---|---|---|---|
| 4 | 440 | rgb(79, 214, 168) | rgba(79, 214, 168, 0.12) | rgba(79, 214, 168, 0.25) |
| 4 | 390 | rgb(79, 214, 168) | rgba(79, 214, 168, 0.12) | rgba(79, 214, 168, 0.25) |
| 4 | 320 | rgb(79, 214, 168) | rgba(79, 214, 168, 0.12) | rgba(79, 214, 168, 0.25) |
| 3 | 440 | rgb(79, 214, 168) | rgba(79, 214, 168, 0.12) | rgba(79, 214, 168, 0.25) |
| 3 | 390 | rgb(79, 214, 168) | rgba(79, 214, 168, 0.12) | rgba(79, 214, 168, 0.25) |
| 3 | 320 | rgb(79, 214, 168) | rgba(79, 214, 168, 0.12) | rgba(79, 214, 168, 0.25) |
| 2 | 440 | rgb(79, 214, 168) | rgba(79, 214, 168, 0.12) | rgba(79, 214, 168, 0.25) |
| 2 | 390 | rgb(79, 214, 168) | rgba(79, 214, 168, 0.12) | rgba(79, 214, 168, 0.25) |
| 2 | 320 | rgb(79, 214, 168) | rgba(79, 214, 168, 0.12) | rgba(79, 214, 168, 0.25) |