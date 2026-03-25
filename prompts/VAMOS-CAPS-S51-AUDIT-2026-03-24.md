# VAMOS CAPS CAPS-S51-AUDIT
**Date:** 2026-03-24 IST
**Sprint:** CAPS-S51 — Full Visual Audit + Poker Pro Simulation

---

## BEFORE AUDIT (read-only — do NOT change anything yet)

```bash
cd C:\Projects\Caps
git log --oneline -5
npx tsc --noEmit 2>&1 | tail -3
npx jest --forceExit 2>&1 | tail -5
eas build:list --platform ios --limit 3
cat app.json | grep -E "version|buildNumber"
```

---

## TASK A — OTA STATUS

```bash
# What OTA is actually live on the branch?
eas update:list --branch production --limit 5
```

Report: which OTA hash is the latest on branch production. Is it 94bb4338 (S50)?

---

## TASK B — VISUAL AUDIT (read every file, report honestly)

Read each file and report line-by-line what actually exists in the code — not what was supposed to be there.

### B1 — results.tsx (or summary.tsx — whichever handles the post-hand screen)
Report:
- Does it import from 'react-native-reanimated'? YES/NO + line number if yes
- Does it use Animated from 'react-native'? YES/NO
- entrance fade animation: EXISTS / MISSING
- win badge pulse: EXISTS / MISSING
- net chips flash: EXISTS / MISSING
- DEAL ME IN pulse loop: EXISTS / MISSING — if exists, what iteration count?
- Overall: static or animated?

### B2 — components/CompleteOverlay.tsx
Report:
- SAFE_MODE flag: EXISTS / REMOVED
- SafeCompleteOverlay: EXISTS / REMOVED
- Particle count: exact number
- Particles use RN Animated or Reanimated?
- Gold pulse ring: EXISTS / MISSING
- cleanup on unmount: YES / NO

### B3 — components/Card.tsx
Report:
- flipProgress shared value: EXISTS
- useEffect([faceDown]) trigger: EXISTS
- faceDown prop wired correctly: YES/NO

### B4 — game.tsx SafeRevealOverlay
Report:
- Cards start faceDown=true on mount: YES/NO
- stagger setTimeout sequence exists: YES/NO
- setTimeout cleanup in useEffect: YES/NO

### B5 — app/_layout.tsx
Report:
- game screen animation option: what value?
- results screen animation option: what value?

### B6 — Safety check
```bash
grep -rn "withRepeat(-1)" --include="*.tsx" --include="*.ts" .
grep -rn "ConfettiCannon" --include="*.tsx" --include="*.ts" .
grep -rn "import.*reanimated" app/results.tsx app/summary.tsx 2>/dev/null
```
Report exact output of each grep.

---

## TASK C — FULL POKER PRO SIMULATION

Play 200 hands automatically using the existing simulate utility. Run with 2 players, 4 boards.

```bash
npx ts-node -e "
const { runSimulation } = require('./utils/simulate');
const results = runSimulation({ players: 2, hands: 200 });
console.log(JSON.stringify(results, null, 2));
" 2>&1 | tail -40
```

If ts-node doesn't work:
```bash
npx jest utils/__tests__/simulate.test.ts --verbose 2>&1 | tail -30
```

Then simulate each poker pro's reaction to the current visual state:

**Phil Hellmuth** (ego, drama, perfectionism):
- Rate the current visual polish 1-10
- What would make him rage-quit?

**Daniel Negreanu** (reads, positivity, feel of the game):
- Does the reveal feel like real poker suspense?
- What's missing from the "feel"?

**Doyle Brunson** (old school, simplicity):
- Is the game clear to understand?
- What's confusing?

**Vanessa Selbst** (analytical, UX):
- List the top 3 friction points in the current flow

Each pro gives ONE specific fix recommendation.

---

## TASK D — HONEST DELTA REPORT

Compare what was promised in S49 + S50 vs what actually exists in the code right now.

For each item:
- PROMISED: [what the sprint said it would do]
- ACTUAL: [what's in the code]
- STATUS: DONE / PARTIAL / MISSING

---

## TASK E — FIX ANYTHING MISSING FROM S49 + S50

If the audit reveals that S49 or S50 changes are not actually in the code (missing, partial, or reverted):

E1. Re-apply any missing changes from S49 (SafeRevealOverlay faceDown stagger)
E2. Re-apply any missing changes from S50 (results animations, CompleteOverlay particles)
E3. After re-applying: run tsc + jest
E4. Deploy OTA:
```bash
eas update --branch production --message "fix(S51): re-apply S49+S50 visual changes that were missing from code"
```
E5. Git commit:
```bash
git add -A && git commit -m "fix(S51): audit + re-apply S49 card flip + S50 visual restore"
git push origin main
```

If everything is already in the code and correct — report that explicitly and skip E1-E5.

---

## AFTER AUDIT — Report exactly:

```
═══════════════════════════════════════
CAPS-S51 — FULL AUDIT REPORT
═══════════════════════════════════════

OTA on production branch: [hash] — matches S50? [YES/NO]

VISUAL STATE:
  results.tsx:
    - Reanimated imports: [N]
    - Entrance animation: [EXISTS/MISSING]
    - Win badge pulse: [EXISTS/MISSING]
    - Chips flash: [EXISTS/MISSING]
    - DEAL ME IN loop (iteration count): [N or MISSING]
  CompleteOverlay:
    - SAFE_MODE removed: [YES/NO]
    - Particle count: [N]
    - Particle engine: [RN Animated / Reanimated / MISSING]
    - Pulse ring: [EXISTS/MISSING]
  Card flip (SafeRevealOverlay):
    - faceDown=true on mount: [YES/NO]
    - stagger sequence: [EXISTS/MISSING]
  Screen transitions:
    - game→results: [animation value]
    - results→home: [animation value]

SAFETY:
  withRepeat(-1): [N occurrences]
  ConfettiCannon: [N occurrences]
  Reanimated in results.tsx: [N]

SIMULATION (200 hands):
  Win rate player 1: [%]
  COMPLETE events: [N]
  Errors: [N]

POKER PROS:
  Hellmuth: [rating/1-10 + rage-quit trigger]
  Negreanu: [feel rating + what's missing]
  Brunson: [clear? + what's confusing]
  Selbst: [top 3 friction points]
  Each pro's fix: [one line each]

DELTA S49+S50:
  [table of PROMISED vs ACTUAL vs STATUS]

ACTIONS TAKEN:
  [what was re-applied, if anything]

TS errors: [0]
Tests: [N]/[N]
OTA: [hash if new one deployed]
Git: [commit]
Build: [from eas build:list]
═══════════════════════════════════════
```

---

## DO NOT
- Do NOT add Reanimated to results.tsx
- Do NOT use withRepeat(-1)
- Do NOT add ConfettiCannon
- Do NOT add more than 15 particles to CompleteOverlay
- Do NOT skip the grep safety checks
- Do NOT mark something DONE if it's not in the code

Yes, allow all edits in components/ during this session.

VAMOS CAPS CAPS-S51-AUDIT — END
