# VAMOS CAPS GET-CRASH-REPORT
**Date:** 2026-03-22 IST
**SITUATION:** App crashes EVEN with reveal completely removed. Ready → show boards → crash.
**There is a CRASH REPORT in TestFlight.** We need it.

## STEP 1 — Check Supabase for any logged errors
```
cd C:\Projects\Caps
ANON_KEY=$(grep SUPABASE_ANON_KEY .env | cut -d= -f2)

echo "=== ALL bug reports (last 20) ==="
curl -s "https://gxrpunvhjcrzqnitbqah.supabase.co/rest/v1/bug_reports?order=created_at.desc&limit=20" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY" 2>/dev/null | python -m json.tool

echo ""
echo "=== CRITICAL reports ==="
curl -s "https://gxrpunvhjcrzqnitbqah.supabase.co/rest/v1/bug_reports?severity=eq.CRITICAL&order=created_at.desc&limit=10" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY" 2>/dev/null | python -m json.tool

echo ""
echo "=== CRASH-DEBUG logs ==="
curl -s "https://gxrpunvhjcrzqnitbqah.supabase.co/rest/v1/bug_reports?order=created_at.desc&limit=30&description=ilike.*crash*" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY" 2>/dev/null | python -m json.tool
```

## STEP 2 — Read EXACTLY what handleReady does now
```
cat app/game.tsx
```

Find handleReady and print EVERY LINE from Ready press to router.replace.
Is there ANYTHING besides calculate → store → navigate?

## STEP 3 — The crash happens with ZERO reveal. So what's left?

The ONLY code running after Ready:
1. evaluateAllBoards() — calculation
2. gameStore.setResults() — store update  
3. router.replace('/results') — navigation

ONE of these 3 is crashing. Find which one:

```typescript
// Add try-catch around each individual step:
async function handleReady() {
  console.log('[READY] step 1: evaluate');
  try {
    const results = evaluateAllBoards(boards);
    console.log('[READY] step 1 done:', results?.length);
  } catch (e) {
    console.error('[READY] CRASH at evaluate:', e);
    // LOG TO SUPABASE:
    await logCrashToSupabase('evaluate', e);
    return;
  }

  console.log('[READY] step 2: store');
  try {
    gameStore.setResults(results);
    console.log('[READY] step 2 done');
  } catch (e) {
    console.error('[READY] CRASH at store:', e);
    await logCrashToSupabase('store', e);
    return;
  }

  console.log('[READY] step 3: navigate');
  try {
    router.replace('/results');
    console.log('[READY] step 3 done');
  } catch (e) {
    console.error('[READY] CRASH at navigate:', e);
    await logCrashToSupabase('navigate', e);
  }
}

async function logCrashToSupabase(step: string, error: any) {
  try {
    const supabase = getSupabase();
    await supabase?.from('bug_reports').insert({
      description: `[CRASH] step=${step} error=${String(error)} stack=${error?.stack?.slice(0, 500)}`,
      severity: 'CRITICAL',
      status: 'open',
    });
  } catch {}
}
```

## STEP 4 — Also check: does results.tsx crash on MOUNT?

Maybe the navigation succeeds but results.tsx crashes when it tries to render.

```bash
cat app/results.tsx | head -100

# What runs on mount?
grep -n "useEffect\|useMemo\|useState.*initial" app/results.tsx | head -20

# Any unguarded access?
grep -n "\.map(\|\.length\|\[0\]\|\.winner\|\.hand" app/results.tsx | grep -v "?\\.\|??\| ?:" | head -20
```

## STEP 5 — Check if Zustand persist is the issue

```bash
cat store/gameStore.ts

# Does persist write to AsyncStorage on setResults?
grep -n "persist\|AsyncStorage\|storage\|setResults" store/gameStore.ts | head -20
```

If setResults triggers a Zustand persist → that writes to AsyncStorage → 
if the data is too large or has circular references → CRASH.

## STEP 6 — Deploy with individual step logging

```bash
npx tsc --noEmit
npx jest --forceExit 2>&1 | tail -5

eas update --branch production --message "debug: individual step logging — find which step crashes"
git add -A && git commit -m "debug: step-by-step crash logging in handleReady"
git push origin main
```

## REPORT — MUST INCLUDE
```
═══════════════════════════════════════
CRASH REPORT ANALYSIS
═══════════════════════════════════════
Supabase crash logs: [found / empty]
  If found: [exact error message]

handleReady code path: [list every line]
  Step 1 evaluate: [what it does]
  Step 2 store: [what it does]
  Step 3 navigate: [what it does]
  Anything else between steps: [YES what / NO]

results.tsx mount: [safe / has unguarded access at line X]
Zustand persist: [YES could block / NO]

Logging added: [YES — to Supabase per step]
OTA: [ID]
Build: [triggered]
═══════════════════════════════════════
```

VAMOS CAPS GET-CRASH-REPORT — END
