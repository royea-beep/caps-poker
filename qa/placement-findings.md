# CAPS Placement-Matrix Auto-QA Findings (numeric)

Generated: 2026-06-15T11:41:55.711Z
Base URL: https://caps.ftable.co.il/game

## Hand row — CARD extents vs viewport (VAMOS-HAND-CLIP-2)

The hand-row container has `overflow:hidden`, so its rect always "fits" by definition. Real clip is whether any **card** extent breaks the viewport. **cardClip = (cardLeftOverflow > 0 OR cardRightOverflow > 0).**

| bc | width | VW | card span | card L margin | card R margin | cardClip | L overflow | R overflow | cards | W avg |
|---|---|---|---|---|---|---|---|---|---|---|
| 4 | 440 | 440 | 462 | -11 | -11 | true | 11 | 11 | 16 | 56 |
| 4 | 390 | 390 | 462 | -36 | -36 | true | 36 | 36 | 16 | 56 |
| 4 | 320 | 320 | 462 | -71 | -71 | true | 71 | 71 | 16 | 56 |
| 3 | 440 | 440 | 351 | 45 | 44 | false | 0 | 0 | 12 | 56 |
| 3 | 390 | 390 | 351 | 20 | 19 | false | 0 | 0 | 12 | 56 |
| 3 | 320 | 320 | 351 | -15 | -16 | true | 15 | 16 | 12 | 56 |
| 2 | 440 | 440 | 233 | 104 | 103 | false | 0 | 0 | 8 | 56 |
| 2 | 390 | 390 | 233 | 79 | 78 | false | 0 | 0 | 8 | 56 |
| 2 | 320 | 320 | 233 | 44 | 43 | false | 0 | 0 | 8 | 56 |

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