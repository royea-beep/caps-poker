# GEMS — caps-poker

> CAPS poker iOS/Android (Expo + Supabase).
> Living document of non-obvious lessons, gotchas, and patterns specific to this project.
> Created 2026-05-25 by DEEP-DISC standardization sweep. Empty sections are placeholders — fill as you hit them.

## How to read this file
Each entry is a single insight you would tell a teammate in chat — short, concrete, and specific. The format is:

```
### Title (date)
**Symptom:** what you observed
**Root cause:** what was actually wrong
**Fix:** what worked
**Lesson:** the principle to remember
```

## Where existing project lore lives (refresh as the project evolves)
- README.md — high-level overview
- PROJECT-INFO.json — machine-readable metadata
- PROJECT-RULES.md — invariants and "don't do this" rules
- CURRENT-STATE.md — what's live, what's in flight
- CLAUDE.md — agent context (loaded by Claude Code at session start)
- Empire memory pointers:
  - C:/Users/royea/.claude/projects/C--Projects/memory/MEMORY.md (look for entries tagged `caps-poker`)
  - Empire `empire_dashboards` + `connections_index` + `project_index` tables (vjxqlqtlywovnbidovit)

## GEMs to date

> Add new entries below as they happen. The empire standard is: one GEM per non-obvious fix or pattern.
> Cross-link to other projects by linking their GEMs.md path.


## GEM — Headless Visual-QA Loop (self-verification, no phone)
**Proven:** 2026-06-15 (app-wide theme sweep, 7 waves SWEEP-1 → CLOSE).
**What:** The strategist verifies the bot's UI work by running Playwright + Chromium against the LIVE web app (caps.ftable.co.il) — no device, no user screenshots.
**Recipe:**
1. Deep-link `/game` lands straight in placement (bypasses home/tutorial).
2. Board count: set `localStorage` `caps-poker-storage` → `.state.config.numberOfPlayers` (2 → bc4 / 16-card hand, 3 → bc3 / 12, 4 → bc2 / 8), reload `/game`.
3. Other screens via direct routes: `/play /settings /shop /profile /friends /cups /leaderboard /tournament /sit-and-go /hand-history /achievements /gameover /orientation-pick /multiplayer-game /lobby/host /lobby/internet-host /lobby/internet-join`.
4. Measure resolved colors via `getComputedStyle` (walk up to nearest non-transparent bg); build PIL contact-sheet montages for at-a-glance audit.
**Why it matters:** verifies RENDERED output, not bot self-reports. Across the sweep it caught a long string of false "DONE" / "no change needed" / "already clean" claims (friends, lobby ×2, hand-history, achievements, StarterOfferModal). Pattern: grepping `COLORS.gold` is never sufficient — most holdout gold is inline hex literals (`#FFD700`, `#c9a84c`, `#e8c96a`) or shared styles (Button.tsx variantGold). The `#c9a84c` overload: chrome used the TOKEN `COLORS.gold`, the winner uses the inline LITERAL `'#c9a84c'` — swap the token, keep the literal.
**Caveat:** web is a faithful proxy for layout + color (color tokens are device-agnostic, so native matches); NOT native-pixel-perfect for Dimensions-dependent layout.
**Note:** `web-deploy.yml` triggers on `fix/**` ~4-5 min after push, so the live web reflects the current branch.
