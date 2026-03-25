# VAMOS CAPS CAPS-S56-FULL-AUDIT
**Date:** 2026-03-24 IST
**Sprint:** CAPS-S56 — Full Audit + OTA Verification + Simulation

---

## BEFORE AUDIT

```bash
cd C:\Projects\Caps
git log --oneline -5
npx tsc --noEmit 2>&1 | tail -3
npx jest --forceExit 2>&1 | tail -5
eas build:list --platform ios --limit 1 --json 2>/dev/null | python -m json.tool | grep -E "buildNumber|channel|runtimeVersion"
eas update:list --branch production --limit 3
```

---

## TASK A — OTA DELIVERY VERIFICATION

### A1. Confirm OTA 019d20b0 is valid (not empty bundle):
```bash
# Check the update bundle size — empty = broken
eas update:list --branch production --limit 1 --json 2>/dev/null | python -m json.tool | grep -E "id|message|runtimeVersion|createdAt"

# Confirm NODE_OPTIONS fix is in place for future deploys:
grep -n "NODE_OPTIONS\|max-old-space" package.json scripts/ Makefile 2>/dev/null | head -10
grep -n "NODE_OPTIONS\|max-old-space" .env 2>/dev/null | head -5
```

### A2. Confirm OTA check logic in _layout.tsx:
```bash
grep -n "checkForUpdate\|fetchUpdate\|reloadAsync\|setInterval\|30000" app/_layout.tsx | head -20
```

### A3. Confirm OTA debug row in Settings:
```bash
grep -n "channel\|runtimeVersion\|isEmbeddedLaunch\|Embedded" app/settings.tsx | head -10
```

---

## TASK B — FEATURE AUDIT (read every file, report what's IN the code)

### B1. Card flip (S49):
```bash
grep -n "faceDown\|flipProgress\|rotateY" components/Card.tsx | head -10
grep -n "faceDown\|commFaceDown\|botFaceDown\|playerFaceDown\|flipTimers" app/game.tsx | head -20
```
Report: flip infrastructure EXISTS / MISSING, wired in SafeRevealOverlay YES/NO

### B2. Visual restore (S50):
```bash
grep -n "screenOpacity\|boardTranslates\|winBadgeAnim\|chipsFlashAnim\|dealPulseLoop" app/results.tsx app/summary.tsx 2>/dev/null | head -20
grep -n "SAFE_MODE\|SafeCompleteOverlay\|particle\|Particle" components/CompleteOverlay.tsx | head -20
grep -n "withRepeat(-1)" --include="*.tsx" --include="*.ts" -r . | grep -v node_modules | grep -v ".git"
```
Report: each animation EXISTS/MISSING, SAFE_MODE removed YES/NO, withRepeat(-1) count

### B3. BoardReveal (S53):
```bash
wc -l components/BoardReveal.tsx
grep -n "BOT\|COMMUNITY\|YOUR CARDS\|onAdvance\|handleSkip\|progress" components/BoardReveal.tsx | head -30
grep -n "BoardReveal\|revealBoardIndex\|gamePhase" app/game.tsx | head -20
```
Report: exists YES/NO, layout order BOT→COMMUNITY→YOUR CARDS YES/NO, wired in game.tsx YES/NO

### B4. Hand hint (S53):
```bash
grep -n "getHandHint\|handHint\|HandHint" components/Board.tsx utils/handHint.ts 2>/dev/null | head -10
```
Report: handHint.ts exists YES/NO, wired in Board.tsx YES/NO, player-only YES/NO

### B5. Bot cards hidden (S54):
```bash
grep -n "faceDown.*isArrangement\|isArrangement.*faceDown\|botCards.*faceDown" components/Board.tsx | head -10
```
Report: bot cards faceDown during arrangement YES/NO

### B6. Duplicate card guard (S54):
```bash
grep -n "duplicate\|unique\|Set\|re-deal\|re_deal" utils/deck.ts utils/gameLogic.ts 2>/dev/null | head -20
```
Report: guard EXISTS in deck.ts YES/NO

### B7. Tap-to-skip (S52):
```bash
grep -n "handleSkip\|tap.*skip\|TAP FOR\|TAP TO" app/game.tsx components/BoardReveal.tsx 2>/dev/null | head -10
```
Report: EXISTS YES/NO

### B8. Strong hand haptic (S52):
```bash
grep -n "NotificationFeedbackType\|Strong\|Straight\|rank.*4\|haptic.*hand" app/game.tsx components/BoardReveal.tsx 2>/dev/null | head -10
```
Report: EXISTS YES/NO

### B9. Board subtitle on home (S52):
```bash
grep -n "boards.*players\|players.*boards\|getBoardCount\|boardCount" app/index.tsx | head -10
```
Report: EXISTS YES/NO

### B10. Safety checks:
```bash
echo "=== withRepeat(-1) ==="
grep -rn "withRepeat(-1)" --include="*.tsx" --include="*.ts" . | grep -v node_modules | grep -v ".git" | grep -v "comment\|//"

echo "=== ConfettiCannon ==="
grep -rn "ConfettiCannon" --include="*.tsx" --include="*.ts" . | grep -v node_modules | grep -v ".git"

echo "=== Reanimated in results ==="
grep -n "reanimated\|useSharedValue\|useAnimatedStyle" app/results.tsx app/summary.tsx 2>/dev/null
```

---

## TASK C — AUTOMATED GAME SIMULATION

### C1. Run full stress test:
```bash
NODE_OPTIONS='--max-old-space-size=8192' npx jest --forceExit --verbose 2>&1 | tail -20
```

### C2. Run 1000-hand simulation:
```bash
NODE_OPTIONS='--max-old-space-size=8192' npx ts-node -e "
const { runSimulation } = require('./utils/simulate');
const r = runSimulation({ players: 2, hands: 1000 });
console.log('Win rate:', r.winRate);
console.log('COMPLETE events:', r.completeCount);
console.log('Errors:', r.errors);
console.log('Duplicate cards found:', r.duplicates ?? 0);
" 2>&1 | tail -10
```
If ts-node fails — use jest simulate test.

### C3. Run 3-player and 4-player simulation:
```bash
NODE_OPTIONS='--max-old-space-size=8192' npx jest utils/__tests__/simulate.test.ts --verbose 2>&1 | tail -15
```

---

## TASK D — POKER PRO PANEL (post-fix review)

Simulate these pros playing the CURRENT fixed version (OTA 019d20b0):

**Phil Ivey** — Does the reveal create real suspense now?
**Daniel Negreanu** — Does it feel like poker?
**Rampage Poker** — Is there a viral clip moment?
**A first-time user** — Can they understand the game without help?

Each gives:
1. Rating 1-10
2. One thing that's now GREAT
3. One thing still broken or missing

---

## TASK E — IF ANY FEATURE IS MISSING FROM B1-B9

Re-apply it. Minimum change. Then redeploy:
```bash
NODE_OPTIONS='--max-old-space-size=8192' eas update --branch production --message "fix(S56): re-apply missing features found in audit"
git add -A && git commit -m "fix(S56): audit fixes — [list what was re-applied]"
git push origin main
git log --oneline -3
```

If everything is confirmed in code — skip deploy, report "NO CHANGES NEEDED".

---

## AFTER AUDIT

```
═══════════════════════════════════════
CAPS-S56 — FULL AUDIT REPORT
═══════════════════════════════════════

OTA DELIVERY:
  Latest OTA on production: [hash]
  runtimeVersion match (binary vs OTA): [YES/NO]
  NODE_OPTIONS fix permanent: [YES/NO — where is it defined?]
  Force check (30s interval): [YES/NO — line in _layout.tsx]
  OTA debug in Settings: [YES/NO]

FEATURE STATUS:
  S49 Card flip (SafeRevealOverlay): [EXISTS/MISSING]
  S50 Results animations: [EXISTS/MISSING]
  S50 CompleteOverlay particles (15): [N particles / MISSING]
  S50 SAFE_MODE removed: [YES/NO]
  S53 BoardReveal component: [N lines / MISSING]
  S53 BoardReveal layout (BOT→COM→YOURS): [CORRECT/WRONG]
  S53 BoardReveal wired in game.tsx: [YES/NO]
  S53 Hand hint in Board.tsx: [YES/NO]
  S54 Bot cards faceDown: [YES/NO]
  S54 Duplicate card guard: [YES/NO]
  S52 Tap-to-skip: [YES/NO]
  S52 Strong hand haptic: [YES/NO]
  S52 Board subtitle: [YES/NO]

SAFETY:
  withRepeat(-1) in code: [N — must be 0]
  ConfettiCannon: [N — must be 0]
  Reanimated in results.tsx: [N — must be 0]

SIMULATION:
  1000 hands: win rate [%], COMPLETE [%], errors [N], duplicates [N]
  3-player: [pass/fail]
  4-player: [pass/fail]

POKER PRO PANEL:
  Ivey: [rating] — great: [X] — broken: [X]
  Negreanu: [rating] — great: [X] — broken: [X]
  Rampage: [rating] — great: [X] — broken: [X]
  First-timer: [rating] — great: [X] — broken: [X]

CHANGES MADE: [list / NO CHANGES NEEDED]
NEW OTA: [hash / NOT DEPLOYED]

TS errors: 0
Tests: [N]/[N]
Build: [from eas build:list]
═══════════════════════════════════════
```

---

## DO NOT
- Do NOT skip any section
- Do NOT report DONE without reading the actual file
- Do NOT deploy without NODE_OPTIONS='--max-old-space-size=8192'
- Do NOT add withRepeat(-1) or ConfettiCannon
- Do NOT add Reanimated to results.tsx

Yes, allow all edits in components/ during this session.

VAMOS CAPS CAPS-S56-FULL-AUDIT — END
