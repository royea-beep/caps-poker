"""
CAPS POKER — Pro Voices Generator
Generates 20 AI voice clips using ElevenLabs API
Date: 2026-03-21

Usage:
  1. Set ELEVENLABS_API_KEY in .env or environment
  2. Fill in VOICE_IDS with cloned voice IDs from ElevenLabs
  3. Run: python generate_voices.py
"""

import os
import sys
import time
import requests
from pathlib import Path

# ─── CONFIG ───────────────────────────────────────────────

API_KEY = os.environ.get("ELEVENLABS_API_KEY", "")
if not API_KEY:
    # Try reading from .env
    env_path = Path(__file__).parent / ".env"
    if env_path.exists():
        for line in env_path.read_text().splitlines():
            if line.startswith("ELEVENLABS_API_KEY="):
                API_KEY = line.split("=", 1)[1].strip().strip('"').strip("'")

if not API_KEY:
    print("ERROR: ELEVENLABS_API_KEY not found. Set it in .env or environment.")
    sys.exit(1)

OUTPUT_DIR = Path(__file__).parent / "assets" / "sounds" / "pro-voices"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# Model: use multilingual v2 for best quality
MODEL_ID = "eleven_multilingual_v2"

# ─── VOICE IDS — FILL THESE IN AFTER CLONING ─────────────

VOICE_IDS = {
    "Negreanu": "PASTE_VOICE_ID_HERE",
    "Hellmuth": "PASTE_VOICE_ID_HERE",
    "Ivey": "PASTE_VOICE_ID_HERE",
    "Mizrachi": "PASTE_VOICE_ID_HERE",
    "Seidel": "PASTE_VOICE_ID_HERE",
    "Bonomo": "PASTE_VOICE_ID_HERE",
    "Kenney": "PASTE_VOICE_ID_HERE",
    "Imsirovic": "PASTE_VOICE_ID_HERE",
    "Kornuth": "PASTE_VOICE_ID_HERE",
    "Rampage": "PASTE_VOICE_ID_HERE",
}

# ─── ALL 20 QUOTES ────────────────────────────────────────

QUOTES = [
    # Daniel Negreanu
    {"id": "dn1", "player": "Negreanu", "text": "The most original poker mechanic since PLO"},
    {"id": "dn2", "player": "Negreanu", "text": "I forgot I was testing. I was just playing."},
    {"id": "dn3", "player": "Negreanu", "text": "Stack one board or spread evenly? THAT is the question."},

    # Phil Hellmuth
    {"id": "ph1", "player": "Hellmuth", "text": "I hate admitting it, but this is smart"},
    {"id": "ph2", "player": "Hellmuth", "text": "When I got COMPLETE I felt like I won a bracelet"},
    {"id": "ph3", "player": "Hellmuth", "text": "I got angry when I lost. THAT is a good sign."},

    # Phil Ivey
    {"id": "pi1", "player": "Ivey", "text": "Ship it."},
    {"id": "pi2", "player": "Ivey", "text": "You can read opponents through allocation patterns"},

    # Michael Mizrachi
    {"id": "mm1", "player": "Mizrachi", "text": "Deal again. NOW."},
    {"id": "mm2", "player": "Mizrachi", "text": "I want to play this for money. Right now."},

    # Erik Seidel
    {"id": "es1", "player": "Seidel", "text": "First poker game in 10 years that surprised me"},

    # Justin Bonomo
    {"id": "jb1", "player": "Bonomo", "text": "GTO implications are massive"},
    {"id": "jb2", "player": "Bonomo", "text": "Three strategies: stack one, spread even, read and counter"},

    # Bryn Kenney
    {"id": "bk1", "player": "Kenney", "text": "This is your Victory Royale moment"},
    {"id": "bk2", "player": "Kenney", "text": "90 seconds. Perfect for quick games anywhere."},

    # Ali Imsirovic
    {"id": "ai1", "player": "Imsirovic", "text": "Played 10 hands, wanted 10 more"},

    # Chance Kornuth
    {"id": "ck1", "player": "Kornuth", "text": "COMPLETE mechanic equals pure product genius"},
    {"id": "ck2", "player": "Kornuth", "text": "Build your ENTIRE strategy around chasing COMPLETE"},

    # Rampage (Ethan Yau)
    {"id": "ey1", "player": "Rampage", "text": "COMPLETE equals clips. Clips equals views. Views equals downloads."},
    {"id": "ey2", "player": "Rampage", "text": "Chess meets Omaha meets fantasy draft"},
]

# ─── GENERATE ─────────────────────────────────────────────

def generate_voice(quote: dict) -> bool:
    """Generate a single voice clip via ElevenLabs TTS API."""
    voice_id = VOICE_IDS.get(quote["player"])
    if not voice_id or voice_id == "PASTE_VOICE_ID_HERE":
        print(f"  ⚠️  SKIP {quote['id']} — no voice ID for {quote['player']}")
        return False

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
            out_path = OUTPUT_DIR / f"{quote['id']}.mp3"
            out_path.write_bytes(resp.content)
            size_kb = len(resp.content) / 1024
            print(f"  ✅ {quote['id']}.mp3 ({size_kb:.0f}KB) — {quote['player']}: \"{quote['text'][:40]}...\"")
            return True
        else:
            print(f"  ❌ {quote['id']} — HTTP {resp.status_code}: {resp.text[:100]}")
            return False

    except Exception as e:
        print(f"  ❌ {quote['id']} — Error: {e}")
        return False


def main():
    print("═" * 60)
    print("CAPS POKER — Pro Voices Generator")
    print(f"Output: {OUTPUT_DIR}")
    print(f"Quotes: {len(QUOTES)}")
    print(f"Players: {len(VOICE_IDS)}")
    print("═" * 60)

    # Check for missing voice IDs
    missing = [p for p, vid in VOICE_IDS.items() if vid == "PASTE_VOICE_ID_HERE"]
    if missing:
        print(f"\n⚠️  Missing voice IDs for: {', '.join(missing)}")
        print("   Fill in VOICE_IDS in this script first.")
        print("   Will skip quotes for players without voice IDs.\n")

    success = 0
    failed = 0
    skipped = 0

    for i, quote in enumerate(QUOTES):
        print(f"\n[{i+1}/{len(QUOTES)}] Generating {quote['id']}...")

        if VOICE_IDS.get(quote["player"]) == "PASTE_VOICE_ID_HERE":
            skipped += 1
            print(f"  ⚠️  SKIP — no voice ID for {quote['player']}")
            continue

        if generate_voice(quote):
            success += 1
        else:
            failed += 1

        # Rate limit: wait 1 second between requests
        if i < len(QUOTES) - 1:
            time.sleep(1)

    print("\n" + "═" * 60)
    print(f"DONE: {success} ✅ | {failed} ❌ | {skipped} ⚠️ skipped")
    print(f"Files in: {OUTPUT_DIR}")
    print("═" * 60)

    # List generated files
    files = sorted(OUTPUT_DIR.glob("*.mp3"))
    if files:
        print(f"\nGenerated files ({len(files)}):")
        for f in files:
            print(f"  {f.name} ({f.stat().st_size / 1024:.0f}KB)")


if __name__ == "__main__":
    main()
