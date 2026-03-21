"""
CAPS POKER — Auto Voice Pipeline
1. Downloads YouTube audio samples per player
2. Clones each voice via ElevenLabs Instant Voice Clone
3. Generates all 20 quote clips
Date: 2026-03-21
"""

import os
import sys
import time
import json
import subprocess
import tempfile
import requests
from pathlib import Path

# ─── CONFIG ───────────────────────────────────────────────

API_KEY = os.environ.get("ELEVENLABS_API_KEY", "")
if not API_KEY:
    env_path = Path(__file__).parent.parent / ".env"
    if env_path.exists():
        for line in env_path.read_text().splitlines():
            if line.startswith("ELEVENLABS_API_KEY="):
                API_KEY = line.split("=", 1)[1].strip().strip('"').strip("'")

if not API_KEY:
    print("ERROR: ELEVENLABS_API_KEY not found.")
    sys.exit(1)

OUTPUT_DIR = Path(__file__).parent.parent / "assets" / "sounds" / "pro-voices"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

TEMP_DIR = Path(tempfile.mkdtemp())
MODEL_ID = "eleven_multilingual_v2"

# ─── YOUTUBE SEARCH QUERIES ───────────────────────────────
# Best interview clips — clear voice, minimal background music

PLAYER_YOUTUBE_QUERIES = {
    "Negreanu":   "Daniel Negreanu poker interview 2023",
    "Hellmuth":   "Phil Hellmuth poker interview WSOP",
    "Ivey":       "Phil Ivey poker interview speaking",
    "Mizrachi":   "Michael Mizrachi poker interview",
    "Seidel":     "Erik Seidel poker interview",
    "Bonomo":     "Justin Bonomo poker interview",
    "Kenney":     "Bryn Kenney poker interview",
    "Imsirovic":  "Ali Imsirovic poker interview",
    "Kornuth":    "Chance Kornuth poker coaching interview",
    "Rampage":    "Rampage poker vlog talking",
}

# ─── ALL 20 QUOTES ────────────────────────────────────────

QUOTES = [
    {"id": "dn1", "player": "Negreanu",  "text": "The most original poker mechanic since PLO"},
    {"id": "dn2", "player": "Negreanu",  "text": "I forgot I was testing. I was just playing."},
    {"id": "dn3", "player": "Negreanu",  "text": "Stack one board or spread evenly? THAT is the question."},
    {"id": "ph1", "player": "Hellmuth",  "text": "I hate admitting it, but this is smart"},
    {"id": "ph2", "player": "Hellmuth",  "text": "When I got COMPLETE I felt like I won a bracelet"},
    {"id": "ph3", "player": "Hellmuth",  "text": "I got angry when I lost. THAT is a good sign."},
    {"id": "pi1", "player": "Ivey",      "text": "Ship it."},
    {"id": "pi2", "player": "Ivey",      "text": "You can read opponents through allocation patterns"},
    {"id": "mm1", "player": "Mizrachi",  "text": "Deal again. NOW."},
    {"id": "mm2", "player": "Mizrachi",  "text": "I want to play this for money. Right now."},
    {"id": "es1", "player": "Seidel",    "text": "First poker game in 10 years that surprised me"},
    {"id": "jb1", "player": "Bonomo",    "text": "GTO implications are massive"},
    {"id": "jb2", "player": "Bonomo",    "text": "Three strategies: stack one, spread even, read and counter"},
    {"id": "bk1", "player": "Kenney",    "text": "This is your Victory Royale moment"},
    {"id": "bk2", "player": "Kenney",    "text": "90 seconds. Perfect for quick games anywhere."},
    {"id": "ai1", "player": "Imsirovic", "text": "Played 10 hands, wanted 10 more"},
    {"id": "ck1", "player": "Kornuth",   "text": "COMPLETE mechanic equals pure product genius"},
    {"id": "ck2", "player": "Kornuth",   "text": "Build your ENTIRE strategy around chasing COMPLETE"},
    {"id": "ey1", "player": "Rampage",   "text": "COMPLETE equals clips. Clips equals views. Views equals downloads."},
    {"id": "ey2", "player": "Rampage",   "text": "Chess meets Omaha meets fantasy draft"},
]

# ─── STEP 1: Download audio samples ───────────────────────

def download_audio_sample(player: str, query: str) -> Path | None:
    out_path = TEMP_DIR / f"{player}.mp3"
    if out_path.exists():
        print(f"  ♻️  Already downloaded: {player}")
        return out_path

    print(f"  ⬇️  Downloading: {player} — \"{query}\"")
    try:
        result = subprocess.run([
            "yt-dlp",
            f"ytsearch1:{query}",
            "-x",
            "--audio-format", "mp3",
            "--audio-quality", "0",
            "--match-filter", "duration < 1800",
            "--postprocessor-args", "ffmpeg:-t 60",
            "-o", str(TEMP_DIR / f"{player}.%(ext)s"),
            "--quiet",
            "--no-warnings",
        ], capture_output=True, text=True, timeout=120)

        if out_path.exists():
            size_kb = out_path.stat().st_size / 1024
            print(f"  ✅ Downloaded {player}: {size_kb:.0f}KB")
            return out_path
        else:
            print(f"  ❌ Download failed for {player}: {result.stderr[:100]}")
            return None
    except Exception as e:
        print(f"  ❌ Download error for {player}: {e}")
        return None

# ─── STEP 2: Clone voice via ElevenLabs ───────────────────

def clone_voice(player: str, audio_path: Path) -> str | None:
    print(f"  🎙️  Cloning voice: {player}")
    url = "https://api.elevenlabs.io/v1/voices/add"
    headers = {"xi-api-key": API_KEY}
    data = {
        "name": f"CapsPoker-{player}",
        "description": f"CAPS Poker AI simulation parody — {player}",
    }
    try:
        with open(audio_path, "rb") as f:
            files = [("files", (f"{player}.mp3", f, "audio/mpeg"))]
            resp = requests.post(url, headers=headers, data=data, files=files, timeout=60)

        if resp.status_code == 200:
            voice_id = resp.json().get("voice_id")
            print(f"  ✅ Cloned {player}: {voice_id}")
            return voice_id
        else:
            print(f"  ❌ Clone failed for {player}: HTTP {resp.status_code} — {resp.text[:150]}")
            return None
    except Exception as e:
        print(f"  ❌ Clone error for {player}: {e}")
        return None

# ─── STEP 3: Generate clip ────────────────────────────────

def generate_clip(quote: dict, voice_id: str) -> bool:
    out_path = OUTPUT_DIR / f"{quote['id']}.mp3"
    if out_path.exists():
        print(f"  ♻️  Already exists: {quote['id']}.mp3")
        return True

    url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
    headers = {
        "xi-api-key": API_KEY,
        "Content-Type": "application/json",
    }
    payload = {
        "text": quote["text"],
        "model_id": MODEL_ID,
        "voice_settings": {
            "stability": 0.5,
            "similarity_boost": 0.75,
            "style": 0.4,
            "use_speaker_boost": True,
        },
    }
    try:
        resp = requests.post(url, json=payload, headers=headers, timeout=30)
        if resp.status_code == 200:
            out_path.write_bytes(resp.content)
            size_kb = len(resp.content) / 1024
            print(f"  ✅ {quote['id']}.mp3 ({size_kb:.0f}KB) — {quote['text'][:40]}")
            return True
        else:
            print(f"  ❌ {quote['id']} — HTTP {resp.status_code}: {resp.text[:100]}")
            return False
    except Exception as e:
        print(f"  ❌ {quote['id']} error: {e}")
        return False

# ─── MAIN ─────────────────────────────────────────────────

def main():
    print("═" * 60)
    print("CAPS POKER — Auto Voice Pipeline")
    print(f"Output: {OUTPUT_DIR}")
    print("═" * 60)

    voice_ids: dict[str, str] = {}
    voice_ids_path = TEMP_DIR.parent / "caps_voice_ids.json"

    # Load cached voice IDs if they exist
    if voice_ids_path.exists():
        voice_ids = json.loads(voice_ids_path.read_text())
        print(f"\n♻️  Loaded {len(voice_ids)} cached voice IDs")

    # STEP 1+2: Download + clone for players without voice IDs
    players_needing_clone = [p for p in PLAYER_YOUTUBE_QUERIES if p not in voice_ids]
    if players_needing_clone:
        print(f"\n── STEP 1+2: Download + Clone ({len(players_needing_clone)} players) ──")
        for player in players_needing_clone:
            query = PLAYER_YOUTUBE_QUERIES[player]
            print(f"\n[{player}]")
            audio = download_audio_sample(player, query)
            if audio:
                vid = clone_voice(player, audio)
                if vid:
                    voice_ids[player] = vid
                    voice_ids_path.write_text(json.dumps(voice_ids, indent=2))
            time.sleep(2)

    # Report voice IDs
    print(f"\n── Voice IDs ({len(voice_ids)}/{len(PLAYER_YOUTUBE_QUERIES)}) ──")
    for p, vid in voice_ids.items():
        print(f"  {p}: {vid}")
    missing_players = [p for p in PLAYER_YOUTUBE_QUERIES if p not in voice_ids]
    if missing_players:
        print(f"\n⚠️  Missing voice IDs: {', '.join(missing_players)}")

    # STEP 3: Generate clips
    print(f"\n── STEP 3: Generate {len(QUOTES)} Clips ──")
    success = failed = skipped = 0
    for i, quote in enumerate(QUOTES):
        print(f"\n[{i+1}/{len(QUOTES)}] {quote['id']}...")
        vid = voice_ids.get(quote["player"])
        if not vid:
            print(f"  ⚠️  SKIP — no voice ID for {quote['player']}")
            skipped += 1
            continue
        if generate_clip(quote, vid):
            success += 1
        else:
            failed += 1
        if i < len(QUOTES) - 1:
            time.sleep(1)

    # Summary
    print("\n" + "═" * 60)
    print(f"DONE: {success} ✅ | {failed} ❌ | {skipped} ⚠️ skipped")
    files = sorted(OUTPUT_DIR.glob("*.mp3"))
    print(f"Files in pro-voices/: {len(files)}/20")
    for f in files:
        print(f"  {f.name} ({f.stat().st_size / 1024:.0f}KB)")
    print("═" * 60)


if __name__ == "__main__":
    main()
