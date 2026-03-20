# Hard-Won Findings & Lessons Learned
**From:** Caps Poker sessions | **Date:** 2026-03-20/21

---

## 🔴 Critical Lessons (Cost Us Hours)

### 1. Don't Assume the Obvious Cause
**Story:** Google OAuth returned 400. We spent an hour hunting for a missing redirect URI across 4 GCP projects. The URI was ALREADY configured. The real cause was the consent screen in Testing mode.
**Lesson:** When debugging, verify your assumption with a single curl/test BEFORE diving deep. The bot found it in 2 minutes with `curl -v -L`.

### 2. Hex Colors Lie
**Story:** #6B0F1A looks like "deep red" in a hex picker. On screen it looks PINK. We went through 5 rounds of color iteration.
**Lesson:** 
- Always go 2-3x darker than the picker suggests
- Use radial gradients for depth (not solid colors)
- Test on actual displays, not in IDE color previews
- The final palette: bg #1C0508 (near-black), boards #6B1520 (dark), borders #8B6914 (warm gold)

### 3. Pre-Calculation Timing Is a Trap
**Story:** Hand evaluator was "wrong" — showing High Card for Full House. The evaluator itself was perfect (test proved it). The bug: pre-calculation ran at setTimeout(0) during countdown, before the bot had placed cards. Empty array → default High Card.
**Lesson:** Any pre-computation that depends on async state must guard against stale data. Check that all required data is present before calculating.

### 4. Web ≠ Native (Even in React Native)
**Story:** Multiple bugs from web-specific behavior:
- `Alert.alert` uses `window.confirm` on web (doesn't render)
- CSS `pointer-events: none` has edge cases in some browsers
- `position: absolute` with `z-index: 0` paints above flow elements
- CSS properties (gradients, boxShadow) must be Platform-guarded
**Lesson:** Every change needs testing on BOTH platforms. Use `Platform.OS === 'web'` guards and `Platform.select()` for any visual property that differs.

### 5. Audit ALL Screens, Not Just the One You're Working On
**Story:** We did a "premium visual overhaul" on the game screen but completely missed the reveal and results screens. Roye caught it.
**Lesson:** Before any overhaul, list ALL screens in the app. Check each one. Use `find app/ -name "*.tsx"` and `find components/ -name "*.tsx"` to get the complete list.

---

## 🟡 Important Findings

### 6. Google Cloud Project Numbers in Client IDs
OAuth Client ID format: `{project_number}-{hash}.apps.googleusercontent.com`
The prefix IS the GCP project number. Use `grep -r` across all project .env files to find which project it belongs to.

### 7. Supabase Auth Config Field Names
The Management API uses `uri_allow_list` (not `additional_redirect_urls`). The dashboard shows "Redirect URLs" but the API field name is different. Always check the actual API response first.

### 8. Windows Credential Manager for CLI Tokens
Supabase CLI stores its access token in Windows Credential Manager as `Supabase CLI:supabase`. Can be extracted programmatically with P/Invoke (advapi32.dll CredRead). The token is stored as UTF-8 bytes.

### 9. EAS Build Numbers vs Code Build Numbers
- `extra.buildNumber` in app.json = our code build number (what we track)
- EAS auto-increments its own build number (counts failures too)
- TestFlight shows the EAS number
- ALWAYS reference BOTH: "b116 (EAS #118)"

### 10. Vercel SPA Routing
Static SPA on Vercel needs:
- `vercel.json` with rewrites: `[{ "source": "/(.*)", "destination": "/index.html" }]`
- `scripts/fix-web-html.js` patches the exported HTML
- Deploy from `dist/` directory

---

## 🟢 Efficiency Patterns Discovered

### 11. Screenshot + Console = Gold
Roye sends screenshots with DevTools console open. This gives:
- Visual state of the app
- JavaScript errors and warnings
- Network failures
- Useful debug logs
Always look at BOTH the visual and the console.

### 12. Bot Output as Context
When Roye pastes Claude Bot output, it contains:
- Every bash command and its result
- File reads and edits
- Git commits and push status
- Timer ("Worked for 5m 41s")
This is complete context for the next prompt.

### 13. The VAMOS Mega Prompt Structure Works
The structured format (ROLE → CONTEXT → MISSION → SUCCESS CRITERIA → ON COMPLETION) produces consistent, autonomous bot execution. Prompts with clear grep commands and expected outcomes work best.

### 14. Parallel Agents Produce Better Results
When the prompt says "5+ agents" or "Agent 1: Layout, Agent 2: Cards, Agent 3: Panels", the bot parallelizes investigation and makes better architectural decisions.

### 15. The Iteration Speed Pattern
Best results come from tight loops:
```
Change → Deploy → Screenshot → Feedback → Change → Deploy → ...
```
Each cycle is ~5 minutes. 12 cycles in a session = massive improvement.

---

## 🔵 Technical Gems

### 16. Conic-Gradient Timer (Web)
Depleting ring timer using CSS conic-gradient:
```typescript
const deg = Math.round((timeLeft / 60) * 360);
<View style={{ background: `conic-gradient(${color} ${deg}deg, rgba(40,40,40,0.85) ${deg}deg)` }} />
```
Inner dark circle creates the ring effect.

### 17. Inset Shadow for Felt Effect
```typescript
Platform.OS === 'web' && { boxShadow: 'inset 0 2px 12px rgba(0,0,0,0.5), 0 4px 20px rgba(0,0,0,0.6)' }
```
Gives boards a "sunken into table" feel.

### 18. Dynamic Phase Indicator
Instead of static "Arrange freely":
```typescript
cardsRemaining === 0 ? '✓ ALL PLACED' : `ARRANGE ${cardsRemaining} CARDS`
```
Gives player real-time feedback.

### 19. Conditional Button Styling
READY button changes from gold (disabled) to green (active) with glow:
```typescript
style={[styles.placeBtn, !allBoardsFull && styles.placeBtnDisabled, allBoardsFull && styles.placeBtnReady]}
```
The green glow uses platform-specific shadow.

### 20. Watermark as Felt Branding
Low-opacity red-tinted text embossed on felt background:
```typescript
color: 'rgba(255,120,120,0.10)'
```
Not white (too visible), not transparent (invisible). Red-tinted = looks like part of the felt.

---

## 📊 Session Metrics

| Metric | Value |
|--------|-------|
| Session duration | ~8 hours |
| Builds produced | 13 (b104→b117) |
| Tests | 115→116 |
| TypeScript errors | 0 throughout |
| VAMOS prompts written | 12 |
| Files modified | 15+ |
| Bugs found & fixed | 8 |
| Visual iterations | 5 (Five-O colors alone) |
| Screens overhauled | 4 (game, reveal, results, settings) |
| New features added | 10+ (timer ring, bot pills, badges, etc.) |
