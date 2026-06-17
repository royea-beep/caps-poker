# CAPS Poker — Custom Game Skill
## Architecture
- React Native + Expo + Capacitor
- Supabase backend (gxrpunvhjcrzqnitbqah)
- 48 tables, 88 RPCs, 10 crons
- Hebrew RTL, 44px touch targets

## Card Display Bible (IMMUTABLE)
- Centered rank + suit ONLY — no corner badges
- hole_card_width_ratio: 0.22
- board_card_width_ratio: 0.15
- main_rank_size_ratio: 0.35
- Dynamic sizing: boardColW = floor(screenW/2) - 26
- maxCw = floor((boardColW - 31) / 5)
- mobileWebCardH = min(60, round(maxCw / 0.72))
- min card width: 26px (375px screen)
- max card width: capped for iPad (overflow: hidden on board)

## Screen Map
- / (home/lobby)
- /game (main poker game — MOST CRITICAL)
- /achievements (30 achievements)
- /missions (20 daily missions)
- /sit-and-go-lobby (tournament)
- /referral
- /heatmap
- /play-of-day
- /profile
- /settings

## Known GEMs (Hard-Won Lessons)
1. ZERO Reanimated withRepeat(-1) loops — crashes iOS on background
2. Splash failsafe: 5s timeout to SplashScreen.hide()
3. Theme safety: always use ?. on theme objects (HOME_THEMES[id] can be undefined on web)
4. deal_pressed: isDealingRef debounce prevents double-tap crash
5. AbortController + 8s timeout on all Supabase fetches at launch
6. crash_reports table: tracks dirty-shutdown events
7. EBADF on CI: use .cjs scripts, never import .ts directly

## Rules
- Hebrew-first, English fallback
- 44px minimum touch targets
- flex layout everywhere (no absolute positioning on cards)
- percentage sizing (ratio × containerWidth), never hardcoded px
- flexShrink: 0 on all card components
- overflow: hidden on all card containers
- Font min: rank >= 14px, suit >= 10px
