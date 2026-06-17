# VAMOS CAPS CAPS-FIX-CRASHES
**Date:** 2026-04-23 IST

---

## FIX 5 crashes from today's test session

### CRASH REPORTS (from Telegram):
- #188, #190, #191: `Cannot read property 'toLocaleString' of undefined` (Splash)
- #189, #192: `Invalid hook call` (Home)

### ROOT CAUSE CHAIN:
1. `earn_chips` RPC expected UUID — app sends device_id TEXT → RPC fails
2. Chips value becomes undefined in state
3. `chips.toLocaleString()` crashes on undefined (line 1341 of index.tsx)
4. React state corrupts → "Invalid hook call" cascade

### WHAT'S ALREADY FIXED (DB — done now):
- `earn_chips(text, text, integer)` device_id overload created
- `spend_chips(text, text, integer)` device_id overload created
- `on_app_open(text)` device_id overload created

### WHAT NEEDS CODE FIXES:

---

## FIX 1 — Null guard on ALL toLocaleString calls

Search for every `.toLocaleString()` in the app:

```bash
cd C:\Projects\Caps
grep -rn "\.toLocaleString()" app/ components/ --include="*.tsx" | grep -v node_modules
```

For EVERY instance, add null guard:

```typescript
// BEFORE (crashes on undefined):
{chips.toLocaleString()}

// AFTER (safe):
{(chips ?? 0).toLocaleString()}
```

Known locations in `app/index.tsx`:
- Line 467: `{reward.toLocaleString()}` → `{(reward ?? 0).toLocaleString()}`
- Line 1341: `{chips.toLocaleString()}` → `{(chips ?? 0).toLocaleString()}`

Apply same pattern everywhere. Search ALL .tsx files.

---

## FIX 2 — Default chips value in gameStore

In `store/gameStore.ts`, make sure chips always has a default:

```bash
grep -n "chips" store/gameStore.ts | head -20
```

Ensure the initial state has: `chips: 1000` (not undefined, not null).

Also: wherever `addChips` or `setChips` is called, guard:
```typescript
addChips: (amount) => set((s) => ({ chips: (s.chips ?? 1000) + (amount ?? 0) })),
```

---

## FIX 3 — earnChips function error handling

Find the `earnChips` function (probably in utils/economy.ts or imported elsewhere):

```bash
grep -rn "earnChips\|export.*earnChips\|function earnChips" utils/ app/ --include="*.ts" --include="*.tsx" | head -10
```

Make sure it handles RPC failure gracefully:
```typescript
export async function earnChips(deviceId: string, eventType: string, amount: number = 50): Promise<{ chips_earned: number } | null> {
  try {
    const sb = getSupabase();
    if (!sb) return null;
    const { data, error } = await sb.rpc('earn_chips', {
      p_device_id: deviceId,
      p_event_type: eventType,
      p_amount: amount,
    });
    if (error) {
      console.warn('[Economy] earn_chips failed:', error.message);
      return null;
    }
    return data;
  } catch (e) {
    console.warn('[Economy] earnChips error:', e);
    return null;
  }
}
```

---

## FIX 4 — "Invalid hook call" prevention

In `app/index.tsx` line 911:
```typescript
const store = useGameStore.getState();  // This is OK — getState() is not a hook
```

But if ANY `useXxx()` hook is called inside the async IIFE on lines 906-916, that's the hook error. Check:

```bash
grep -n "use[A-Z]" app/index.tsx | head -30
```

Make sure NO hooks are called inside `void (async () => { ... })()` blocks. Only `getState()` is safe inside async.

---

## FIX 5 — get_home_screen_v3 may also fail with device_id

Check if the app calls `get_home_screen_v3` with device_id:

```bash
grep -n "get_home_screen_v3\|home_screen_v3" app/index.tsx | head -5
```

If it passes device_id (text) to a uuid parameter — same crash pattern. Fix: create device_id overload in Supabase (I'll do that now if needed).

---

## FIX 6 — Mark crash reports as fixing

After fixes deployed:
```bash
# Nothing to do — crashes will stop automatically after OTA
```

---

## DEPLOY
```bash
npx tsc --noEmit 2>&1 | tail -5
npx jest --forceExit 2>&1 | tail -5
npm run ota -- --message "fix: Crash fixes — toLocaleString guards, earnChips error handling"
git add -A && git commit -m "fix: Null guards on toLocaleString, earnChips graceful failure"
git push origin main
```

---

## AFTER AUDIT
```
All toLocaleString calls have ?? guard:      YES/NO
chips default value in gameStore:            YES/NO
earnChips returns null on failure:           YES/NO
No hooks inside async IIFE blocks:           YES/NO
get_home_screen_v3 called correctly:         YES/NO
earn_chips RPC works with device_id:         YES/NO (DB already fixed)
Tests passing:                               [N]/[N]
OTA deployed:                                [hash]
```

Yes, allow all edits.
VAMOS CAPS CAPS-FIX-CRASHES — END
