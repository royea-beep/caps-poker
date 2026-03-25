# VAMOS CAPS SOUND-FIX
**Date:** 2026-03-21 08:20 IST
**Priority:** 🔴 P0 — No sound at all in the app

## ROLE
Senior audio/mobile engineer — find why ALL sounds are silent and fix it

## FIRST ACTIONS
```
Read C:\Projects\Caps\MEMORY.md
cat C:\Projects\Caps\utils\sounds.ts
ls C:\Projects\Caps\assets\sounds\ 2>/dev/null || ls C:\Projects\Caps\assets\*sound* 2>/dev/null || echo "No sound assets found"
ls C:\Projects\Caps\assets\ 2>/dev/null
find C:\Projects\Caps -name "*.mp3" -o -name "*.wav" -o -name "*.m4a" -o -name "*.ogg" 2>/dev/null
```

## CONTEXT
User reports: NO sound at all in the app. Not card place, not win, not lose, not COMPLETE. Total silence.
This is on a real iPhone via TestFlight.

## MISSION

═══════════════════════════════════════════════
AGENT 1 — DIAGNOSE
═══════════════════════════════════════════════

**A. Check sound files exist:**
```
find C:\Projects\Caps -type f \( -name "*.mp3" -o -name "*.wav" -o -name "*.m4a" -o -name "*.ogg" -o -name "*.caf" \)
```

**B. Check sounds.ts implementation:**
```
cat C:\Projects\Caps\utils\sounds.ts
```
Look for:
- How are sounds loaded? (expo-av? expo-audio? require()?)
- Is there a global mute/volume state?
- Are sounds loaded async? Could they fail silently?
- Is there a try/catch that swallows errors?
- Is there a settings toggle that defaults to OFF?

**C. Check where sounds are called:**
```
grep -rn "playSound\|sounds\.\|Sound\." C:\Projects\Caps\app\ C:\Projects\Caps\components\ --include="*.tsx" --include="*.ts"
```

**D. Check if sound files are bundled in the build:**
```
grep -rn "sound\|audio\|mp3\|wav" C:\Projects\Caps\app.json
grep -rn "sound\|audio" C:\Projects\Caps\metro.config.js 2>/dev/null
```

**E. Check settings store for mute:**
```
grep -rn "mute\|sound\|audio\|volume" C:\Projects\Caps\store\gameStore.ts
grep -rn "mute\|sound\|audio\|volume" C:\Projects\Caps\app\settings.tsx
```

**F. Report findings:**
```
═══════════════════════════════════════
SOUND DIAGNOSIS
═══════════════════════════════════════
Sound files found: [list or NONE]
Sound library used: [expo-av / expo-audio / other / NONE]
playSound() called from: [list files]
Mute setting: [exists? default value?]
Error handling: [swallows errors? logs them?]
Build bundling: [are sound assets included?]
ROOT CAUSE: [what's wrong]
═══════════════════════════════════════
```

═══════════════════════════════════════════════
AGENT 2 — FIX (based on diagnosis)
═══════════════════════════════════════════════

Common causes and fixes:

**If sound files don't exist:**
- Create or download appropriate free sound effects
- Card place: short tap/click sound
- Win: positive chime
- Lose: subtle low tone
- COMPLETE: triumphant fanfare (louder, special)
- Timer warning: subtle tick
- Place them in `assets/sounds/`

**If expo-av not installed:**
```
npx expo install expo-av
```

**If sounds fail silently:**
- Add console.warn on load failure
- Add fallback: if sound fails to load, skip gracefully

**If mute defaults to ON:**
- Change default to OFF (sounds enabled)

**If sounds load but don't play on iOS:**
- Check Audio.setAudioModeAsync configuration:
```typescript
await Audio.setAudioModeAsync({
  allowsRecordingIOS: false,
  playsInSilentModeIOS: true,  // CRITICAL — iPhone silent switch
  staysActiveInBackground: false,
  shouldDuckAndroid: true,
});
```
- `playsInSilentModeIOS: true` is the #1 missed setting on iOS

**If sounds are loaded with require() but path is wrong:**
- Fix paths to match actual file locations

═══════════════════════════════════════════════
AGENT 3 — Verify All Sound Points
═══════════════════════════════════════════════

Every one of these MUST play a sound:

| Event | Sound | File |
|-------|-------|------|
| Card placed on board | click/tap | place.mp3 |
| Card removed from board | softer click | remove.mp3 |
| Board won | positive chime | win.mp3 |
| Board lost | subtle low | lose.mp3 |
| COMPLETE (sweep all boards) | LOUD fanfare | complete.mp3 |
| Timer 10 sec warning | tick | tick.mp3 |
| Game start / deal | shuffle sound | deal.mp3 |
| Ready button pressed | confirm beep | ready.mp3 |

For each:
1. Verify sound file exists
2. Verify playSound() is called at the right moment
3. If missing — add the call

═══════════════════════════════════════════════
AGENT 4 — Test + Deploy
═══════════════════════════════════════════════

```
F1. npx tsc --noEmit — 0 errors
F2. npx jest --forceExit — 126+ pass
F3. npx expo export --platform web --output-dir web-dist
F4. node scripts/fix-web-html.js
F5. cd web-dist && vercel --prod --yes
F6. git add -A && git commit -m "fix: P0 sound system — diagnose + fix all game sounds"
F7. git push origin main
F8. Update MEMORY.md
```

## SUCCESS CRITERIA
- ✅ Sound files exist in assets/
- ✅ expo-av installed and configured
- ✅ playsInSilentModeIOS: true
- ✅ Card place, win, lose, COMPLETE, timer — all have sounds
- ✅ Sounds play on real iPhone (TestFlight)
- ✅ Settings toggle for sound ON/OFF (default ON)
- ✅ All tests pass, 0 TS errors

## DO NOT
- Do NOT add voice/speech audio of poker players
- Do NOT use copyrighted sounds — use free/royalty-free only
- Do NOT break existing functionality

VAMOS CAPS SOUND-FIX — END
