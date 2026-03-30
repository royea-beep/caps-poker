# G-PROMPT: CAPS — Version Badge + Bug Reporter Audit
## For Claude Code agent in C:\Projects\caps-poker
## AFTER EXECUTION: Move this file to C:\Projects\caps-poker\docs\prompts\2026-03-28_0700_CAPS_Version-Badge-BugReporter-Audit.md

---

## TASK 1: Show Version + Build Number on Home Screen

During test phase, testers MUST see which version they're running. Add a small version badge to the HOME screen (app/index.tsx or equivalent).

**What to show:**
```
v1.9.4 (267)
```
Format: `v{version} ({build})`

**Where:** Bottom-right or bottom-center of the home screen. Small, non-intrusive, but always visible.

**How:**
- Read from `app_config` keys `current_version` and `next_build_number` on mount
- OR read from `app.json` / `Constants.expoConfig` if available locally
- Fallback: hardcode current values `v1.9.4 (267)` if config fetch fails
- Style: font-size 10px, color gray/muted (`opacity: 0.5`), no background
- Must NOT overlap with any button or interactive element
- Must be visible in BOTH portrait and landscape

**Example component:**
```tsx
<Text style={{ 
  position: 'absolute', 
  bottom: 8, 
  right: 12, 
  fontSize: 10, 
  color: 'rgba(255,255,255,0.35)' 
}}>
  v{version} ({build})
</Text>
```

---

## TASK 2: Audit Bug Reporter on ALL Screens

The bug reporter (shake-to-report or floating button) MUST be available on every single screen in the app. Right now it might be missing from some screens.

**Step 1: Find the bug reporter component.** Search for:
- `BugReporter`, `BugReport`, `ShakeDetector`, `bug-report`, `reportBug`
- Any floating button or shake listener that triggers bug submission
- The component that captures screenshots and sends to Supabase

**Step 2: List ALL screens/routes in the app.** Search for:
- All files in `app/` directory (Expo Router file-based routing)
- All screen components in `screens/` if it exists
- Map every navigable screen: splash, home/index, game, results, settings, shop, sit-n-go lobby, sit-n-go waiting, sit-n-go game, leaderboard

**Step 3: For each screen, check if the bug reporter is accessible:**
- Is the component rendered or is a global provider wrapping everything?
- If it's a global provider in `_layout.tsx` — verify it wraps ALL routes
- If it's per-screen — identify which screens are MISSING it

**Step 4: Fix any gaps:**
- If bug reporter is a provider → ensure it's in the ROOT `_layout.tsx` wrapping everything
- If per-screen → add it to every screen that's missing it
- The bug reporter should be available via SHAKE gesture on all screens
- Optionally: small floating "🐛" button in bottom-left (only during test phase, controlled by a flag)

**Step 5: Report findings in this format:**
```
SCREENS WITH BUG REPORTER:
✅ Home (index.tsx)
✅ Game (game.tsx)
...

SCREENS MISSING BUG REPORTER:
❌ Shop (shop.tsx) — FIXED: added BugReporter wrapper
❌ Sit & Go Lobby — FIXED: added to layout
...
```

---

## VERIFICATION:
1. `npx tsc --noEmit` — TypeScript clean
2. `npm test` — all tests pass
3. Home screen shows version badge (e.g., `v1.9.4 (267)`)
4. Bug reporter accessible from EVERY screen (via shake or floating button)
5. Version badge does NOT overlap any buttons
6. Version badge visible in both portrait and landscape
