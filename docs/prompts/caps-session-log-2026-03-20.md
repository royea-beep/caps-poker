# CAPS POKER — Session Log 2026-03-20/21
**Duration:** ~8 hours | **Builds:** b106→b117 (13 builds) | **Tests:** 115→116

---

## Timeline

| IL Time | Build | Action | Result |
|---------|-------|--------|--------|
| 18:00 | b106 | Session start — read handoff | Loaded full project state |
| 18:30 | b106 | Google OAuth investigation | Found client in 9Soccer-Mascots GCP project |
| 19:00 | b106 | OAuth redirect URI hunt | URI was already there — wrong lead |
| 19:15 | b106 | OAuth 400 root cause | Consent screen in Testing mode |
| 19:30 | b106 | Published consent screen | OAuth flow reaches Google login ✅ |
| 19:45 | b106 | Supabase Site URL fix | localhost:3000 → caps.ftable.co.il via Management API |
| 20:30 | b107 | Five-O theme round 1 | Colors too bright/pinkish on screen |
| 21:00 | b108 | Five-O theme round 2 | Darker but brownish/purple |
| 21:30 | b109 | Five-O theme round 3 + CORS | Better contrast + sync-bugs-to-drive deployed |
| 22:00 | b110 | Five-O Sprint A | Radial gradient, inset shadow, card polish, watermark |
| 22:15 | b111 | Premium visual overhaul | Web portrait, timer ring, bot pills, AUTO glow, badges |
| 22:45 | b112 | Button QA + fixes | Board label bug, READY green, phase indicator dynamic |
| 23:00 | b113 | X button zIndex fix | topBar/floatingActions zIndex:10 |
| 23:40 | b114 | Reveal + results overhaul | Centered layout, /api/learn suppressed, theme-aware |
| 00:30 | b115 | Poker table layout | Bot above, player below community cards |
| 01:00 | b116 | Hand evaluator + X button | Stale pre-calc fix + web direct navigate |
| 03:30 | b117 | Release build | Cross-platform audit, TestFlight deploy triggered |

---

## Key Decisions Made

1. **Five-O colors:** Hex colors that look good in a picker look PINK on screen. Need to go MUCH darker than expected. Final: background #1C0508, boardBg #6B1520, boardBorder #8B6914.

2. **Web layout:** Always portrait on web, regardless of screen width. `isLandscape = ... && Platform.OS !== 'web'`.

3. **Reveal layout:** Poker table metaphor — bot across (top), community middle, player near (bottom).

4. **Pre-calculation timing:** Don't pre-calculate results before bots finish placing cards. Guard with `allBotCards.every(bc => bc.length >= CARDS_PER_BOARD)`.

5. **Alert.alert on web:** Doesn't work reliably (uses window.confirm). Skip on web, navigate directly.

6. **zIndex stacking:** Web overlays (watermark, FriendsBg) need lower zIndex than interactive elements. All interactive layers: zIndex 10. Overlays: zIndex 1.

---

## Bugs Found & Fixed

| Bug | Root Cause | Fix | Build |
|-----|-----------|-----|-------|
| Google OAuth 400 | Consent screen in Testing mode | Published to Production | b106 |
| OAuth redirects to localhost | Supabase site_url was localhost:3000 | Changed via Management API | b106 |
| CORS error on web | sync-bugs-to-drive function missing | Created Edge Function with CORS headers | b109 |
| Board label invisible | Gold text on gold pill background | Use backgroundColor, not color | b112 |
| X button not working | Watermark overlay blocking clicks | zIndex hierarchy fix | b113 |
| /api/learn 405 | Endpoint doesn't exist on SPA | Suppressed in learning.ts | b114 |
| Hand shows "High Card" for Full House | Pre-calc runs before bot places cards | Guard pre-calc with bot card check | b116 |
| X button STILL not working | Alert.alert uses window.confirm on web | Skip Alert on web, navigate directly | b116 |

---

## Files Modified (key changes)

| File | Changes |
|------|---------|
| constants/visualThemes.ts | Five-O colors iterated 5 times |
| app/game.tsx | Layout, timer, bot section, panels, watermark, zIndex, pre-calc fix, X button |
| components/Board.tsx | Border, radius, shadow, labels, AUTO button, empty slots, full badge |
| components/Card.tsx | Rank size, shadow depth, gradient face, 4-color clubs |
| components/PlayerHand.tsx | Theme-aware, count badge |
| components/RevealSequence.tsx | Centered layout, bot above/player below |
| app/results.tsx | Theme-aware, bot above/player below |
| components/VersionBadge.tsx | Lowered opacity to 22% |
| utils/learning.ts | Suppressed /api/learn calls |
| supabase/functions/sync-bugs-to-drive/index.ts | Created with CORS headers |

---

## Commits (git log)

| Hash | Message |
|------|---------|
| 407bf52 | docs: OAuth investigation — client found in 9Soccer GCP project |
| 9c40e40 | docs: OAuth 400 root cause — consent screen Testing mode |
| b1dc888 | fix: Supabase Site URL → caps.ftable.co.il |
| cdbcdd2 | feat: Five-O theme visual overhaul — Match Five-O casino style [b107] |
| 2f9aa60 | fix: Five-O theme darker — casino atmosphere [b108] |
| b25ad4a | fix: Five-O theme round 3 — contrast + CORS [b109] |
| 47cccce | feat: Five-O Sprint A — contrast, panels, cards, watermark [b110] |
| 8c27f3a | feat: premium visual overhaul — all screens, all platforms [b111] |
| 710e54f | fix: button QA + visual fixes [b112] |
| 66782c7 | fix: X close button not working on web [b113] |
| 9a858a2 | feat: reveal + results screens overhaul [b114] |
| 2f83a15 | feat: reveal layout — bot above, player below community [b115] |
| 436159d | fix: hand evaluator stale pre-calc + X button web [b116] |
| 669a0a5 | release: v1.9.4-b117 — cross-platform sync + TestFlight deploy |
