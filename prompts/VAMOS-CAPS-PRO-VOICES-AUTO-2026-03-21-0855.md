# VAMOS CAPS PRO-VOICES-AUTO
**Date:** 2026-03-21 08:55 IST
**Priority:** Generate 20 AI voice clips automatically

## ROLE
DevOps + audio engineer — find credentials and generate voice clips

## FIRST ACTIONS
```
Read C:\Projects\Caps\MEMORY.md
```

## MISSION STEP 1 — Find ElevenLabs or Voice API Credentials

Search ALL projects for existing API keys:
```
grep -ri "ELEVENLABS\|ELEVEN_LABS\|elevenlabs" C:\Projects\**\.env 2>/dev/null
grep -ri "ELEVENLABS\|ELEVEN_LABS" C:\Projects\**\*.env* 2>/dev/null
grep -ri "voice\|tts\|text.to.speech\|elevenlabs" C:\Projects\*.env 2>/dev/null
find C:\Projects -name ".env" -exec grep -li "ELEVENLABS\|VOICE\|TTS\|OPENAI" {} \;
find C:\Projects -name ".env*" -exec grep -li "elevenlabs\|voice" {} \;
```

Also check for ZPROJECTMANAGER:
```
find C:\Projects -iname "*ZPROJECTMANAGER*" -o -iname "*projectmanager*" -o -iname "*project_manager*" 2>/dev/null
find C:\Projects -iname "*ZPROJECT*" 2>/dev/null
ls C:\Projects\ZPROJECTMANAGER\ 2>/dev/null
ls C:\Projects\zprojectmanager\ 2>/dev/null
cat C:\Projects\ZPROJECTMANAGER\*.md 2>/dev/null
cat C:\Projects\ZPROJECTMANAGER\.env 2>/dev/null
```

Also check for any voice/audio generation tools:
```
grep -ri "ELEVENLABS\|PARROT\|VOICE_API\|TTS_API\|MURF\|UBERDUCK\|FAKEYOU\|RESEMBLE\|PLAY_HT" C:\Projects\**\.env 2>/dev/null
```

Also check OPENAI key (can use OpenAI TTS as fallback):
```
grep -ri "OPENAI_API_KEY" C:\Projects\Caps\.env C:\Projects\wingman\.env C:\Projects\wingman\apps\api\.env 2>/dev/null
```

Also check Supabase secrets (might have keys stored there):
```
cd C:\Projects\Caps && npx supabase secrets list 2>/dev/null
```

## Report findings:
```
═══════════════════════════════════════
VOICE API CREDENTIAL SEARCH
═══════════════════════════════════════
ZPROJECTMANAGER found: [YES path / NO]
ElevenLabs API key: [FOUND value / NOT FOUND]
OpenAI API key: [FOUND location / NOT FOUND]
Other voice APIs: [list any found]
═══════════════════════════════════════
```

## MISSION STEP 2 — Generate Voice Clips

### IF ElevenLabs key found:

A1. Install: `pip install elevenlabs requests --break-system-packages`

A2. Copy generate_voices.py to C:\Projects\Caps\:
```
cp C:\Users\royea\Downloads\generate_voices.py C:\Projects\Caps\generate_voices.py
```
(Or it might already be there from earlier download)

A3. For voice cloning — search YouTube for audio samples:
Use yt-dlp to download 1-minute audio clips:
```
pip install yt-dlp --break-system-packages
```

For each player, find a YouTube video and extract audio:
```
yt-dlp -x --audio-format mp3 --audio-quality 0 -o "temp_%(title)s.%(ext)s" "YOUTUBE_URL" --postprocessor-args "-t 60"
```

Then clone each voice via ElevenLabs API:
```python
import requests

def clone_voice(name: str, audio_path: str, api_key: str) -> str:
    """Clone a voice and return the voice_id"""
    url = "https://api.elevenlabs.io/v1/voices/add"
    headers = {"xi-api-key": api_key}
    data = {"name": name, "description": f"CAPS Poker AI simulation - {name}"}
    files = [("files", (f"{name}.mp3", open(audio_path, "rb"), "audio/mpeg"))]
    resp = requests.post(url, headers=headers, data=data, files=files)
    return resp.json().get("voice_id")
```

A4. After cloning all 10 voices → run generate_voices.py with the real voice IDs
A5. Output: 20 mp3 files in `assets/sounds/pro-voices/`

### IF ElevenLabs NOT found BUT OpenAI key found:

Use OpenAI TTS as fallback (different voices per player, not clones):
```python
from openai import OpenAI

client = OpenAI()

VOICE_MAP = {
    "Negreanu": "onyx",      # deep, warm
    "Hellmuth": "fable",     # dramatic
    "Ivey": "echo",          # calm, cool
    "Mizrachi": "onyx",      # intense
    "Seidel": "alloy",       # measured
    "Bonomo": "echo",        # analytical
    "Kenney": "fable",       # confident
    "Imsirovic": "alloy",    # young
    "Kornuth": "onyx",       # authoritative
    "Rampage": "fable",      # energetic
}

for quote in QUOTES:
    response = client.audio.speech.create(
        model="tts-1-hd",
        voice=VOICE_MAP[quote["player"]],
        input=quote["text"],
    )
    response.stream_to_file(f"assets/sounds/pro-voices/{quote['id']}.mp3")
```

### IF NO voice API key found at all:

Report exactly what's needed:
```
═══════════════════════════════════════
NO VOICE API KEY FOUND
Need one of:
1. ElevenLabs: https://elevenlabs.io → API key → set as ELEVENLABS_API_KEY in .env
2. OpenAI: already have OPENAI_API_KEY? → can use TTS endpoint
═══════════════════════════════════════
```

## MISSION STEP 3 — After clips are generated

```
ls -la C:\Projects\Caps\assets\sounds\pro-voices\
```

Count files, report sizes, confirm all 20 exist.

## FINISH
```
git add assets/sounds/pro-voices/ generate_voices.py
git commit -m "feat: 20 AI pro voice clips generated"
git push origin main
Update MEMORY.md
```

## DO NOT
- Do NOT change game code in this sprint (that's the next VAMOS)
- Do NOT deploy to web or build iOS yet
- Do NOT delete any existing sound files

VAMOS CAPS PRO-VOICES-AUTO — END
