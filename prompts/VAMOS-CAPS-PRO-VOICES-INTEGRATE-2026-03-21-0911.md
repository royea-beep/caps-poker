# VAMOS CAPS PRO-VOICES-INTEGRATE
**Date:** 2026-03-21 09:11 IST
**Priority:** Integrate 20 voice clips into the app with full safety layers

## ROLE
Senior mobile engineer + product safety engineer

## FIRST ACTIONS
```
Read C:\Projects\Caps\MEMORY.md
Read C:\Projects\Caps\constants\proQuotes.ts
Read C:\Projects\Caps\components\ProQuoteBanner.tsx
ls C:\Projects\Caps\assets\sounds\pro-voices\
```

## CONTEXT
20 AI-generated voice clips exist in `assets/sounds/pro-voices/`.
Each clip matches a quote in `constants/proQuotes.ts` by ID (dn1, ph1, pi1, etc).
These are ElevenLabs voice clones — NOT the real players.
We need 5 safety layers before shipping.

## MISSION

═══════════════════════════════════════════════
AGENT 1 — Audio Mapping in proQuotes.ts
═══════════════════════════════════════════════

Update `constants/proQuotes.ts`:

**A. Add audioFile field to ProQuote interface:**
```typescript
export interface ProQuote {
  id: string;
  player: string;
  emoji: string;
  quote: string;
  context: 'home' | 'loading' | 'complete' | 'summary' | 'waiting' | 'tutorial';
  audioFile?: any;  // require() asset
}
```

**B. Add require() for each audio file:**
```typescript
// Audio assets — AI-generated voices (NOT real players)
const VOICE_CLIPS: Record<string, any> = {
  dn1: require('../assets/sounds/pro-voices/dn1.mp3'),
  dn2: require('../assets/sounds/pro-voices/dn2.mp3'),
  dn3: require('../assets/sounds/pro-voices/dn3.mp3'),
  ph1: require('../assets/sounds/pro-voices/ph1.mp3'),
  ph2: require('../assets/sounds/pro-voices/ph2.mp3'),
  ph3: require('../assets/sounds/pro-voices/ph3.mp3'),
  pi1: require('../assets/sounds/pro-voices/pi1.mp3'),
  pi2: require('../assets/sounds/pro-voices/pi2.mp3'),
  mm1: require('../assets/sounds/pro-voices/mm1.mp3'),
  mm2: require('../assets/sounds/pro-voices/mm2.mp3'),
  es1: require('../assets/sounds/pro-voices/es1.mp3'),
  jb1: require('../assets/sounds/pro-voices/jb1.mp3'),
  jb2: require('../assets/sounds/pro-voices/jb2.mp3'),
  bk1: require('../assets/sounds/pro-voices/bk1.mp3'),
  bk2: require('../assets/sounds/pro-voices/bk2.mp3'),
  ai1: require('../assets/sounds/pro-voices/ai1.mp3'),
  ck1: require('../assets/sounds/pro-voices/ck1.mp3'),
  ck2: require('../assets/sounds/pro-voices/ck2.mp3'),
  ey1: require('../assets/sounds/pro-voices/ey1.mp3'),
  ey2: require('../assets/sounds/pro-voices/ey2.mp3'),
};
```

**C. Add audioFile to each quote in PRO_QUOTES array:**
```typescript
{
  id: 'dn1',
  player: 'Daniel Negreanu',
  emoji: '🇨🇦',
  quote: 'The most original poker mechanic since PLO',
  context: 'home',
  audioFile: VOICE_CLIPS.dn1,
},
// ... same for all 20
```

═══════════════════════════════════════════════
AGENT 2 — ProQuoteBanner: Play Voice Clip
═══════════════════════════════════════════════

Update `components/ProQuoteBanner.tsx`:

**A. Add audio playback:**
```typescript
import { Audio } from 'expo-av';

let currentSound: Audio.Sound | null = null;

async function playVoiceClip(audioFile: any): Promise<void> {
  try {
    // Stop any currently playing clip
    if (currentSound) {
      await currentSound.stopAsync();
      await currentSound.unloadAsync();
      currentSound = null;
    }
    
    const { sound } = await Audio.Sound.createAsync(audioFile, {
      shouldPlay: true,
      volume: 0.8,
    });
    currentSound = sound;
    
    // Auto-cleanup when done
    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.isLoaded && status.didJustFinish) {
        sound.unloadAsync();
        currentSound = null;
      }
    });
  } catch (e) {
    console.warn('Pro voice playback failed:', e);
  }
}
```

**B. When a quote appears (on mount or on rotation):**
- Check if `proVoicesEnabled` is true (from AsyncStorage AND Supabase kill switch)
- If yes → play the audioFile
- Add a small 🔊 icon next to the quote text to indicate audio is playing
- While audio plays, the icon pulses subtly

**C. Add stop on unmount:**
```typescript
useEffect(() => {
  return () => {
    if (currentSound) {
      currentSound.stopAsync().catch(() => {});
      currentSound.unloadAsync().catch(() => {});
    }
  };
}, []);
```

═══════════════════════════════════════════════
AGENT 3 — Disclaimer Overlay
═══════════════════════════════════════════════

Every time a voice clip plays, show VISIBLE disclaimer.

**A. The existing text disclaimer stays:**
`🤖 AI Digital Simulation — Not real quotes`

**B. Add audio disclaimer text when voice is playing:**
Below the existing disclaimer, show:
`🔊 AI-Generated Voice — Not the real person`
- fontSize: 8
- opacity: 0.5
- Only visible while audio is playing

**C. First-time notice:**
The FIRST time a voice clip plays (AsyncStorage: `caps_voice_disclaimer_seen`):
- Show a brief toast/overlay for 3 seconds:
  "🤖 Voice clips are AI-generated parody. Not real player voices."
  "These are for entertainment only."
- After 3 seconds → dismiss automatically
- Set AsyncStorage flag so it only shows once

═══════════════════════════════════════════════
AGENT 4 — Supabase Remote Kill Switch
═══════════════════════════════════════════════

**A. Create Supabase migration:**
```
cd C:\Projects\Caps
npx supabase migration new pro_voices_config
```

SQL:
```sql
CREATE TABLE IF NOT EXISTS app_config (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz DEFAULT now()
);

INSERT INTO app_config (key, value) VALUES
  ('pro_voices_enabled', 'true'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- RLS: anyone can read, only service_role can write
ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_read" ON app_config FOR SELECT USING (true);
CREATE POLICY "service_write" ON app_config FOR ALL USING (auth.role() = 'service_role');
```

Apply:
```
npx supabase db push
```

**B. In ProQuoteBanner.tsx — check kill switch on mount:**
```typescript
async function checkKillSwitch(): Promise<boolean> {
  try {
    const { data } = await supabase
      .from('app_config')
      .select('value')
      .eq('key', 'pro_voices_enabled')
      .single();
    return data?.value === true;
  } catch {
    return false; // If can't reach server → voices OFF (safe default)
  }
}
```

**C. Cache the result for 5 minutes (don't call Supabase on every rotation).**

**D. Kill switch logic:**
- If kill switch = false → text quotes still show, but NO audio plays
- If kill switch = true AND local setting ON → audio plays
- Both must be true for audio

═══════════════════════════════════════════════
AGENT 5 — Settings Toggle
═══════════════════════════════════════════════

In `app/settings.tsx`:

**A. Find the existing ProQuotesToggle and update it:**

Split into two toggles:
```
🎭 Pro Quotes (AI Simulation)          [ON/OFF]
  Show fictional poker pro reactions

🔊 Pro Voice Clips (AI-Generated)      [ON/OFF]
  Play AI voice clips with quotes
  ⚠️ These are AI-generated, not real player voices
```

- Text quotes toggle: `PRO_QUOTES_ENABLED_KEY` (existing)
- Voice clips toggle: `PRO_VOICES_ENABLED_KEY` (new — `caps_pro_voices_enabled`)
- Voice default: **ON**
- If text quotes are OFF → voices automatically OFF too (can't have voices without text)

═══════════════════════════════════════════════
AGENT 6 — Credits Screen
═══════════════════════════════════════════════

Add to Settings, at the bottom — a "Credits" section:

```
CREDITS
─────────────
🤖 Pro Quotes: AI digital simulation — fictional quotes
🔊 Voice Clips: AI-generated voices via ElevenLabs
⚠️ Not affiliated with any poker player mentioned
Voices are parody/entertainment only
```

Style: small text, opacity 0.5, fontSize 10

═══════════════════════════════════════════════
AGENT 7 — Tests + Deploy
═══════════════════════════════════════════════

```
T1. Test: proQuotes.ts — every quote has audioFile defined
T2. Test: kill switch returns false → no audio plays
T3. Test: local toggle OFF → no audio plays
T4. Test: disclaimer text is present

F1. npx tsc --noEmit — 0 errors
F2. npx jest --forceExit — 126+ pass
F3. npx expo export --platform web --output-dir web-dist
F4. node scripts/fix-web-html.js
F5. cd web-dist && vercel --prod --yes
F6. git add -A && git commit -m "feat: pro voice clips — ElevenLabs clones + disclaimer + kill switch + settings"
F7. git push origin main
F8. Update MEMORY.md
```

## SUCCESS CRITERIA
- ✅ 20 voice clips play when quotes appear
- ✅ Text disclaimer visible on every quote
- ✅ Audio disclaimer visible while voice plays
- ✅ First-time notice shows once
- ✅ Supabase kill switch — false = silence all voices instantly
- ✅ Settings: separate toggles for text quotes and voice clips
- ✅ Credits section in settings
- ✅ Safe default: if can't reach Supabase → voices OFF
- ✅ All tests pass, 0 TS errors
- ✅ Web deployed, git pushed

## DO NOT
- Do NOT claim these are real player voices anywhere
- Do NOT remove existing text-only ProQuoteBanner functionality
- Do NOT remove the `🤖 AI Digital Simulation` disclaimer
- Do NOT auto-play voices when sound setting is OFF in game settings

VAMOS CAPS PRO-VOICES-INTEGRATE — END
