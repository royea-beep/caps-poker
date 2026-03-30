# G PROMPT: CAPS Poker React Hooks Crash Fix

## OBJECTIVE
Fix the React hooks ordering violation causing 92% of real crashes in CAPS Poker Build 266.

## CRASH SIGNATURE
```
Error: Rendered fewer hooks than expected. This may be caused by an accidental early return statement.
```

## EXACT REPRODUCTION PATH (6 steps)
```
1. App launched
2. → Splash screen
3. play_pressed (user taps Play)
4. → Game screen
5. deal_pressed (user taps Deal)
6. 💥 CRASH
```

## ROOT CAUSE ANALYSIS
The crash occurs because a React component has a **conditional early return BEFORE hook declarations**. This violates React's Rules of Hooks - hooks must be called in the same order on every render.

## WHAT CLAUDE CODE REPORTED AS MISSING
Previous auto-fix attempts failed with these explanations:
- "Source file is truncated - cannot see the complete component structure"
- "The source file app/index.tsx is incomplete (cuts off mid-function)"
- "cannot see all hook declarations and component structure needed to fix"

## FILES THAT MUST BE PROVIDED TO CLAUDE CODE
The pipeline MUST include these COMPLETE files (no truncation):

1. **Game screen component** - The main game component rendered after play_pressed
   - Likely: `app/game.tsx` or `components/Game.tsx` or `screens/GameScreen.tsx`
   
2. **Card dealing component** - Component that handles deal_pressed
   - Likely: `components/DealButton.tsx` or within Game component

3. **Any child components** rendered during the deal flow
   - Card components, hand evaluation, deck management

## THE BUG PATTERN TO FIND
Look for this anti-pattern:
```tsx
// ❌ WRONG - conditional return BEFORE hooks
function GameComponent() {
  const gameState = useGameStore();
  
  if (!gameState || !gameState.deck) {
    return <Loading />; // ← EARLY RETURN
  }
  
  const [cards, setCards] = useState([]); // ← HOOK AFTER RETURN = CRASH
  useEffect(() => { ... }, []);           // ← HOOK AFTER RETURN = CRASH
  
  return <GameUI />;
}
```

## THE FIX
```tsx
// ✅ CORRECT - ALL hooks BEFORE any conditional returns
function GameComponent() {
  const gameState = useGameStore();
  const [cards, setCards] = useState([]);  // ← HOOK FIRST
  useEffect(() => { ... }, []);             // ← HOOK FIRST
  
  if (!gameState || !gameState.deck) {
    return <Loading />; // ← Now safe to return
  }
  
  return <GameUI />;
}
```

## VALIDATION CRITERIA
After the fix:
1. App launches → Splash → Play → Game → Deal → NO CRASH
2. All existing functionality works
3. No new ESLint/TypeScript errors

## OUTPUT REQUIREMENTS

If you CAN fix the bug:
```json
{
  "status": "FIXED",
  "files_changed": [
    {
      "path": "path/to/file.tsx",
      "change": "Moved useState and useEffect hooks above the early return checking gameState"
    }
  ],
  "verification": "Run: Splash → Play → Game → Deal - should not crash"
}
```

If you CANNOT fix (missing info):
```json
{
  "status": "NEEDS_INFO",
  "missing_files": [
    "Need COMPLETE file: path/to/suspected/file.tsx",
    "Need to see: all components rendered during deal_pressed action"
  ],
  "analysis": "I found X indicating Y, but need Z to complete the fix"
}
```

## NEVER RETURN "NO CHANGES" WITHOUT EXPLANATION
If the crash pattern exists, either fix it or explain exactly what file/code is needed.

---

## ADDITIONAL CONTEXT

**Crash Statistics:**
- 12 out of 13 real crashes are this bug (92%)
- Device: iPhone 17 Pro Max, iOS 26.3.1
- Build: 266

**Previous Auto-Fix Attempts:** 3 attempts, all failed due to truncated source files

**Priority:** P0 - CRITICAL
