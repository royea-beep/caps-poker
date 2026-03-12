"""
Generate minimal WAV sound effects for Caps Poker.
Uses numpy + wave stdlib — no external audio libraries needed.
"""
import numpy as np
import wave
import struct
import os

ASSETS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "assets", "sounds")
SAMPLE_RATE = 44100


def save_wav(filename, samples):
    """Save float samples [-1, 1] as 16-bit WAV."""
    path = os.path.join(ASSETS_DIR, filename)
    samples = np.clip(samples, -1.0, 1.0)
    int_samples = (samples * 32767).astype(np.int16)
    with wave.open(path, 'w') as f:
        f.setnchannels(1)
        f.setsampwidth(2)
        f.setframerate(SAMPLE_RATE)
        f.writeframes(int_samples.tobytes())
    size = os.path.getsize(path)
    print(f"  {filename}: {len(samples)/SAMPLE_RATE:.2f}s, {size} bytes")


def fade_out(samples, fade_len=None):
    """Apply exponential fade-out."""
    if fade_len is None:
        fade_len = len(samples)
    start = len(samples) - fade_len
    for i in range(fade_len):
        t = i / fade_len
        samples[start + i] *= (1 - t) ** 2
    return samples


def fade_in(samples, fade_len):
    """Apply linear fade-in."""
    for i in range(min(fade_len, len(samples))):
        samples[i] *= i / fade_len
    return samples


def tone(freq, duration, volume=0.5):
    """Generate a sine tone."""
    t = np.linspace(0, duration, int(SAMPLE_RATE * duration), endpoint=False)
    return np.sin(2 * np.pi * freq * t) * volume


def noise(duration, volume=0.1):
    """Generate white noise."""
    n = int(SAMPLE_RATE * duration)
    return np.random.uniform(-volume, volume, n)


def gen_card_place():
    """Soft thud: low freq + noise burst, fast decay."""
    dur = 0.12
    s = tone(180, dur, 0.4) + tone(90, dur, 0.3) + noise(dur, 0.15)
    s = fade_out(s)
    s = fade_in(s, int(SAMPLE_RATE * 0.005))
    save_wav("cardPlace.wav", s)


def gen_card_select():
    """Light tick: high freq, very short."""
    dur = 0.06
    s = tone(800, dur, 0.3) + tone(1200, dur, 0.15)
    s = fade_out(s)
    s = fade_in(s, int(SAMPLE_RATE * 0.002))
    save_wav("cardSelect.wav", s)


def gen_card_flip():
    """Quick swoosh: noise with freq sweep."""
    dur = 0.1
    t = np.linspace(0, dur, int(SAMPLE_RATE * dur), endpoint=False)
    sweep = np.sin(2 * np.pi * (400 + 800 * t / dur) * t) * 0.25
    s = sweep + noise(dur, 0.1)
    s = fade_out(s)
    s = fade_in(s, int(SAMPLE_RATE * 0.005))
    save_wav("cardFlip.wav", s)


def gen_win():
    """Ascending 3-note arpeggio: C5→E5→G5."""
    note_dur = 0.13
    gap = int(SAMPLE_RATE * 0.005)
    notes = [523.25, 659.25, 783.99]  # C5, E5, G5
    parts = []
    for i, freq in enumerate(notes):
        s = tone(freq, note_dur, 0.35)
        # Add harmonic
        s += tone(freq * 2, note_dur, 0.1)
        s = fade_out(s, int(SAMPLE_RATE * 0.06))
        s = fade_in(s, int(SAMPLE_RATE * 0.003))
        parts.append(s)
        if i < len(notes) - 1:
            parts.append(np.zeros(gap))
    save_wav("chipsWin.wav", np.concatenate(parts))


def gen_lose():
    """Descending 2-note: G4→Eb4 (minor feel)."""
    note_dur = 0.15
    gap = int(SAMPLE_RATE * 0.01)
    notes = [392.00, 311.13]  # G4, Eb4
    parts = []
    for i, freq in enumerate(notes):
        s = tone(freq, note_dur, 0.3)
        s = fade_out(s, int(SAMPLE_RATE * 0.08))
        s = fade_in(s, int(SAMPLE_RATE * 0.003))
        parts.append(s)
        if i < len(notes) - 1:
            parts.append(np.zeros(gap))
    save_wav("lose.wav", np.concatenate(parts))


def gen_complete():
    """Fanfare: C5→E5→G5→C6, fuller sound."""
    note_dur = 0.14
    gap = int(SAMPLE_RATE * 0.005)
    notes = [523.25, 659.25, 783.99, 1046.50]  # C5, E5, G5, C6
    parts = []
    for i, freq in enumerate(notes):
        vol = 0.3 + 0.05 * i  # crescendo
        s = tone(freq, note_dur, vol)
        s += tone(freq * 2, note_dur, vol * 0.3)  # harmonic
        s += tone(freq * 0.5, note_dur, vol * 0.15)  # sub
        s = fade_out(s, int(SAMPLE_RATE * 0.06))
        s = fade_in(s, int(SAMPLE_RATE * 0.003))
        parts.append(s)
        if i < len(notes) - 1:
            parts.append(np.zeros(gap))
    # Hold final note longer
    final = tone(1046.50, 0.25, 0.35)
    final += tone(523.25, 0.25, 0.15)
    final = fade_out(final)
    parts.append(final)
    save_wav("complete.wav", np.concatenate(parts))


def gen_timer_low():
    """Warning beep: short 440Hz pip."""
    dur = 0.08
    s = tone(440, dur, 0.3)
    s += tone(880, dur, 0.1)
    s = fade_out(s, int(SAMPLE_RATE * 0.03))
    s = fade_in(s, int(SAMPLE_RATE * 0.003))
    save_wav("timerLow.wav", s)


if __name__ == "__main__":
    os.makedirs(ASSETS_DIR, exist_ok=True)
    print("Generating Caps Poker sound effects...")
    gen_card_place()
    gen_card_select()
    gen_card_flip()
    gen_win()
    gen_lose()
    gen_complete()
    gen_timer_low()
    print("\nDone! All sounds generated.")
