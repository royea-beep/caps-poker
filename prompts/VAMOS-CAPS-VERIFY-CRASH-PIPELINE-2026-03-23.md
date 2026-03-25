# VAMOS CAPS VERIFY-CRASH-PIPELINE
**Date:** 2026-03-23 IST
**Priority:** 🔴🔴🔴 App crashed, WhatsApp alert NOT received. Check ENTIRE pipeline.

## WHAT HAPPENED
- User played CAPS, it crashed (COMPLETE screen)
- TestFlight got crash feedback
- WhatsApp: NOTHING received
- This means: dirty shutdown detector + crash alert = NOT WORKING

## CHECK EVERYTHING

```
cd C:\Projects\Caps
ANON_KEY=$(grep SUPABASE_ANON_KEY .env | cut -d= -f2)

echo "═══════════════════════════════════════"
echo "1. Is dirty shutdown detector in the code?"
echo "═══════════════════════════════════════"
grep -n "dirtyShutdown\|dirty_shutdown\|checkPreviousCrash\|CLEAN_EXIT\|DIRTY\|markGameActive\|markCleanExit" app/_layout.tsx | head -20
echo "---"
grep -n "dirtyShutdown\|dirty_shutdown\|checkPreviousCrash\|CLEAN_EXIT\|DIRTY\|markGameActive" utils/dirtyShutdown.ts utils/crashDetector.ts 2>/dev/null | head -20

echo ""
echo "═══════════════════════════════════════"
echo "2. Read the FULL dirty shutdown detector"
echo "═══════════════════════════════════════"
cat utils/dirtyShutdown.ts 2>/dev/null || echo "FILE NOT FOUND"
cat utils/crashDetector.ts

echo ""
echo "═══════════════════════════════════════"
echo "3. Is it imported and called in _layout.tsx?"
echo "═══════════════════════════════════════"
grep -n "import.*dirtyShutdown\|import.*crashDetector\|import.*checkPrevious\|import.*markGame" app/_layout.tsx | head -10
echo "---"
grep -A5 "checkPreviousCrash\|checkDirtyShutdown\|dirtyShutdown" app/_layout.tsx | head -20

echo ""
echo "═══════════════════════════════════════"
echo "4. Is markGameActive called before results screen?"
echo "═══════════════════════════════════════"
grep -n "markGameActive\|markActive\|setGameActive\|GAME_ACTIVE" app/game.tsx app/results.tsx 2>/dev/null | head -10

echo ""
echo "═══════════════════════════════════════"
echo "5. Is sendCrashAlert actually calling WhatsApp?"
echo "═══════════════════════════════════════"
cat utils/crashAlert.ts

echo ""
echo "═══════════════════════════════════════"
echo "6. Check AsyncStorage for dirty shutdown flag"
echo "═══════════════════════════════════════"
# Can't read AsyncStorage from CLI, but check if the code writes to it:
grep -n "AsyncStorage\|setItem\|getItem" utils/dirtyShutdown.ts utils/crashDetector.ts 2>/dev/null | head -10

echo ""
echo "═══════════════════════════════════════"
echo "7. Check Supabase for ANY data from today"
echo "═══════════════════════════════════════"
curl -s "https://gxrpunvhjcrzqnitbqah.supabase.co/rest/v1/bug_reports?created_at=gte.2026-03-23T00:00:00Z&order=created_at.desc&limit=30" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY" | python -m json.tool

echo ""
echo "═══════════════════════════════════════"
echo "8. Check crash-recordings storage"
echo "═══════════════════════════════════════"
curl -s "https://gxrpunvhjcrzqnitbqah.supabase.co/storage/v1/object/list/crash-recordings" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY" | python -m json.tool

echo ""
echo "═══════════════════════════════════════"
echo "9. Check app_config for auto_fix_mode"
echo "═══════════════════════════════════════"
curl -s "https://gxrpunvhjcrzqnitbqah.supabase.co/rest/v1/app_config?order=id.desc&limit=10" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY" | python -m json.tool

echo ""
echo "═══════════════════════════════════════"
echo "10. Test WhatsApp alert RIGHT NOW"
echo "═══════════════════════════════════════"
curl -s -X POST \
  "https://gxrpunvhjcrzqnitbqah.supabase.co/functions/v1/whatsapp-bot-handler" \
  -H "Content-Type: application/json" \
  -d '{"crash_notification": true, "message": "🔴 CRASH ALERT TEST\n\nBuild: 198\nStep: C5\nCause: CompleteOverlay\n\nReply:\n1 = Fix\n2 = Analyze\n5 = AUTO-FIX ON\n7 = Dashboard", "metadata": {"build": "198", "lastStep": "C5"}}'
echo ""

echo ""
echo "═══════════════════════════════════════"
echo "11. Verify Edge Function can send WhatsApp"
echo "═══════════════════════════════════════"
# Read the Edge Function to see how it sends WhatsApp:
cat supabase/functions/whatsapp-bot-handler/index.ts | grep -A 20 "crash_notification"

echo ""
echo "═══════════════════════════════════════"
echo "12. THE REAL QUESTION: Does the app even RUN crashDetector?"  
echo "═══════════════════════════════════════"
# Add a debugLog at the START of checkPreviousCrash:
grep -n "debugLog.*dirty\|debugLog.*previous\|debugLog.*crash.*detect\|debugLog.*shutdown" utils/dirtyShutdown.ts utils/crashDetector.ts app/_layout.tsx 2>/dev/null | head -10
```

## DIAGNOSIS TREE

```
App crashes (native Hermes kill)
  │
  ▼
JS can't run → ErrorBoundary/crashDetector can't fire
  │
  ▼
User reopens app
  │
  ├── Does _layout.tsx call checkPreviousCrash()? 
  │     YES → Does it read AsyncStorage dirty flag?
  │             YES → Was the flag set before crash?
  │                    YES → Does it upload to Supabase?
  │                           YES → Does it send WhatsApp?
  │                                  YES → ✅ should work
  │                                  NO → sendCrashAlert broken
  │                           NO → Supabase upload broken
  │                    NO → markGameActive not called before crash
  │             NO → AsyncStorage code broken
  │     NO → dirty shutdown not wired into _layout.tsx
  │
  └── MOST LIKELY: One of these steps is missing or broken
```

## FIX — Whatever is broken, fix it. Then add debugLog to EVERY step:

```typescript
// In _layout.tsx on mount:
debugLog('🔍 Checking previous crash...');

// In checkPreviousCrash:
debugLog('🔍 Reading dirty flag from AsyncStorage');
const wasDirty = await AsyncStorage.getItem('caps_game_active');
debugLog(`🔍 Dirty flag: ${wasDirty}`);

if (wasDirty === 'true') {
  debugLog('💀 DIRTY SHUTDOWN DETECTED — previous session crashed!');
  debugLog('💀 Reading saved debug logs...');
  const savedLogs = await AsyncStorage.getItem('caps_debug_logs');
  debugLog(`💀 Saved logs: ${savedLogs ? 'found' : 'empty'}`);
  
  debugLog('💀 Uploading crash report to Supabase...');
  // ... upload
  
  debugLog('💀 Sending WhatsApp alert...');
  // ... send WhatsApp
  
  debugLog('💀 Done — clearing dirty flag');
  await AsyncStorage.removeItem('caps_game_active');
}

// Before results screen (in doNavigate):
debugLog('🎮 Setting game active flag');
await AsyncStorage.setItem('caps_game_active', 'true');

// On results.tsx mount:
debugLog('🎮 Clearing game active flag');
await AsyncStorage.removeItem('caps_game_active');
```

## DEPLOY
```bash
npx tsc --noEmit
eas update --branch production --message "fix: dirty shutdown detector + debugLog every step"
git add -A && git commit -m "fix: dirty shutdown pipeline — debugLog every step + verify WhatsApp sends"
git push origin main
```

## REPORT
```
═══════════════════════════════════════
CRASH PIPELINE VERIFY — REPORT
═══════════════════════════════════════
dirtyShutdown.ts: [EXISTS / MISSING]
Called in _layout.tsx: [YES / NO]
markGameActive called before results: [YES / NO]
sendCrashAlert calls WhatsApp: [YES / NO]

AsyncStorage:
  Write dirty flag: [YES / NO]
  Read dirty flag on open: [YES / NO]
  
Supabase:
  Bug reports today: [N]
  Crash recordings: [N]
  
WhatsApp test alert: [sent / failed]
User received test: [WAITING]

Root cause of no alert: [exactly what was missing/broken]
Fix applied: [describe]
debugLog added: [N] points in crash pipeline

OTA: [ID]
═══════════════════════════════════════
```

VAMOS CAPS VERIFY-CRASH-PIPELINE — END
