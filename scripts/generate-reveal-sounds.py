"""
Generate the three BOARD REVEAL sounds: boardWin, boardLose, revealStart.

WHY THIS FILE EXISTS, AND WHY IT IS SEPARATE FROM scripts/generate-sounds.py
---------------------------------------------------------------------------
`scripts/generate-sounds.py` produces SEVEN sounds (cardPlace, cardSelect, cardFlip,
chipsWin, lose, complete, timerLow) and has never had a generator for these three.
They were dropped in by hand on 2026-03-25 (commit d996c9d) and were, measured
2026-09-10, **0.5 seconds of digital silence** — 22,050 frames, every sample exactly
0, all three byte-identical (sha256 3c395893…, 44,178 B), written by ffmpeg's null
source (`ISFT: Lavf62.3.100` in the file header).

So for five and a half months a won board, a lost board and the start of the reveal
all played NOTHING, while `utils/sounds.ts` carried a volume for each and
`components/BoardReveal.tsx` called playSound() for each. Sound is on by default.
It was never caught because the web QA rigs run muted and native has never been
verified on a device.

⚠️ AND THE LESSON THAT IS BIGGER THAN THE BUG: sha256 equality proved the three files
were THE SAME. It did not prove WHAT they were. A uniqueness check alone would have
passed happily on three DIFFERENT silent files. `tests/sound-assets.test.ts` therefore
asserts BOTH: every sound file is unique by hash AND carries real signal.

This script is stdlib-only (no numpy) on purpose, so it runs in any environment —
including the audit container where numpy is absent. It is deterministic: no random,
same bytes every run.

    python3 scripts/generate-reveal-sounds.py           # write the three files
    python3 scripts/generate-reveal-sounds.py --verify  # measure what is on disk

DESIGN — chosen against the MEASURED palette, not by ear (see --verify output):
    existing  lose        390 -> 310 Hz stepped, 0.310s, peak RMS 0.214
    existing  chipsWin    520 -> 660 -> 780 Hz,  0.400s, peak RMS 0.259
    existing  complete    660 -> 780 -> 1050 Hz, 0.825s, peak RMS 0.336
    existing  cardFlip    510 -> 1670 Hz sweep,  0.100s, peak RMS 0.134

    new  boardWin     587 -> 880 Hz  rising fifth, two notes, 0.34s  (lighter than
                      chipsWin: a board can be won 4x in one hand, chipsWin fires once)
    new  boardLose    415 -> 277 Hz  smooth downward GLIDE, 0.40s   (a glide, not two
                      steps, so it cannot be confused with `lose`; soft attack so it
                      deflates rather than hits; quieter than the win because a player
                      hears it many times and it must not become punishing)
    new  revealStart  220 -> 440 Hz  rising glide with a swell, 0.30s (low and smooth =
                      anticipation, not victory; an octave below cardFlip's sweep)

⚠️ NOBODY HAS HEARD THESE. They are verified by waveform and hash only — duration,
contour direction, dominant frequency per quarter, peak amplitude, no clipping, no
click at either edge, and distinctness from every other file. Listening is Roye's
device tap.
"""
import wave
import math
import array
import os
import sys
import hashlib

ASSETS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "assets", "sounds")
SR = 44100


# ── synthesis helpers (stdlib only) ────────────────────────────────────────────

def glide(f0, f1, dur, harmonic=0.0, curve="log"):
    """Phase-continuous tone gliding f0 -> f1. Phase is the integral of frequency,
    so there is no discontinuity (a per-sample sin(2*pi*f(t)*t) would click)."""
    n = int(SR * dur)
    out = [0.0] * n
    phase = 0.0
    for i in range(n):
        t = i / (n - 1) if n > 1 else 0.0
        if curve == "log":
            f = f0 * (f1 / f0) ** t          # constant musical interval per unit time
        else:
            f = f0 + (f1 - f0) * t
        phase += 2 * math.pi * f / SR
        s = math.sin(phase)
        if harmonic:
            s += harmonic * math.sin(2 * phase)
        out[i] = s
    return out


def note(freq, dur, harmonic=0.0):
    return glide(freq, freq, dur, harmonic=harmonic)


def envelope(buf, attack, release, shape=2.0):
    """Attack (linear) and exponential release, both in seconds."""
    n = len(buf)
    a = max(1, int(SR * attack))
    r = max(1, int(SR * release))
    for i in range(n):
        g = 1.0
        if i < a:
            g *= i / a
        if i > n - r:
            g *= ((n - i) / r) ** shape
        buf[i] *= g
    return buf


def swell(buf, peak_at=0.6):
    """Rise to a peak partway through, then fall — an anticipation shape."""
    n = len(buf)
    p = max(1, int(n * peak_at))
    for i in range(n):
        g = (i / p) if i < p else ((n - i) / (n - p)) ** 1.6
        buf[i] *= g
    return buf


def mix(a, b):
    n = max(len(a), len(b))
    out = [0.0] * n
    for i in range(len(a)):
        out[i] += a[i]
    for i in range(len(b)):
        out[i] += b[i]
    return out


def join(*parts):
    out = []
    for p in parts:
        out.extend(p)
    return out


def normalise(buf, peak):
    """Scale so the largest absolute sample is exactly `peak`, then force both edges
    to zero so no player can produce a click on start or loop."""
    m = max(abs(x) for x in buf) or 1.0
    g = peak / m
    buf = [x * g for x in buf]
    edge = max(1, int(SR * 0.005))            # 5 ms
    for i in range(edge):
        buf[i] *= i / edge
        buf[-1 - i] *= i / edge
    buf[0] = 0.0
    buf[-1] = 0.0
    return buf


def save(filename, buf):
    path = os.path.join(ASSETS_DIR, filename)
    a = array.array("h", (int(max(-1.0, min(1.0, x)) * 32767) for x in buf))
    with wave.open(path, "w") as f:
        f.setnchannels(1)
        f.setsampwidth(2)
        f.setframerate(SR)
        f.writeframes(a.tobytes())
    print(f"  wrote {filename}: {len(buf)/SR:.3f}s, {os.path.getsize(path)} bytes")


# ── the three sounds ───────────────────────────────────────────────────────────

def gen_board_win():
    """Rising perfect fifth, D5 -> A5. Two clean notes, slightly overlapping.
    Deliberately lighter than chipsWin: up to four boards are won in one hand."""
    a = envelope(note(587.33, 0.16, harmonic=0.18), attack=0.006, release=0.10)
    b = envelope(note(880.00, 0.22, harmonic=0.14), attack=0.006, release=0.16)
    return normalise(join(a, b), 0.22)


def gen_board_lose():
    """Soft downward glide, G#4 -> C#4 (a falling fifth). A GLIDE, not two steps,
    so it is a different gesture from `lose`. Slow attack: it deflates, it does not
    hit. Quietest of the three — the player hears this one the most."""
    buf = glide(415.30, 277.18, 0.40, harmonic=0.10)
    buf = envelope(buf, attack=0.025, release=0.26, shape=2.4)
    return normalise(buf, 0.16)


def gen_reveal_start():
    """Rising glide A3 -> A4 with a swell. Low and smooth = 'here it comes',
    not 'you won'. An octave below cardFlip's sweep so the two never blur."""
    buf = glide(220.0, 440.0, 0.30, harmonic=0.08)
    buf = swell(buf, peak_at=0.62)
    buf = envelope(buf, attack=0.02, release=0.09)
    return normalise(buf, 0.14)


# ── verification (the same measurement used on the old files) ──────────────────

def _goertzel(seg, f):
    n = len(seg)
    k = int(0.5 + n * f / SR)
    w = 2 * math.pi * k / n
    c = 2 * math.cos(w)
    s1 = s2 = 0.0
    for x in seg:
        s0 = x + c * s1 - s2
        s2, s1 = s1, s0
    return math.sqrt(abs(s1 * s1 + s2 * s2 - c * s1 * s2)) / n


def _dominant(seg, lo=80, hi=2600, step=10):
    best = (0, 0.0)
    for f in range(lo, hi, step):
        m = _goertzel(seg, f)
        if m > best[1]:
            best = (f, m)
    return best[0]


def verify():
    print("\nMEASURED FROM THE FILES ON DISK (not from the code above):\n")
    seen = {}
    rows = []
    for fn in sorted(os.listdir(ASSETS_DIR)):
        if not fn.endswith(".wav"):
            continue
        path = os.path.join(ASSETS_DIR, fn)
        raw = open(path, "rb").read()
        h = hashlib.sha256(raw).hexdigest()
        w = wave.open(path)
        n = w.getnframes()
        a = array.array("h")
        a.frombytes(w.readframes(n))
        mx = max(abs(x) for x in a) if len(a) else 0
        rms = math.sqrt(sum(x * x for x in a) / len(a)) / 32768 if len(a) else 0.0
        q = len(a) // 4
        contour = []
        for i in range(4):
            seg = a[i * q:(i + 1) * q]
            contour.append(str(_dominant(seg)) if seg and max(abs(x) for x in seg) > 200 else "--")
        rows.append((fn, n / w.getframerate(), mx, rms, " -> ".join(contour), h[:16]))
        seen.setdefault(h, []).append(fn)
    print(f"  {'file':18} {'dur':>6}  {'peak':>6} {'rms':>6}  {'contour (Hz per quarter)':38} sha256")
    for fn, dur, mx, rms, contour, h in rows:
        flag = "  ⚠️ SILENT" if mx == 0 else ""
        print(f"  {fn:18} {dur:6.3f} {mx:6d} {rms:6.3f}  {contour:38} {h}{flag}")
    dupes = {h: f for h, f in seen.items() if len(f) > 1}
    print()
    if dupes:
        for h, f in dupes.items():
            print(f"  ⚠️ IDENTICAL BYTES: {', '.join(f)}  ({h[:16]})")
    else:
        print(f"  ✓ all {len(rows)} .wav files are distinct by sha256")
    silent = [r[0] for r in rows if r[2] == 0]
    print(f"  {'⚠️ SILENT FILES: ' + ', '.join(silent) if silent else '✓ every .wav carries signal (peak > 0)'}")
    return 1 if (dupes or silent) else 0


if __name__ == "__main__":
    if "--verify" in sys.argv:
        sys.exit(verify())
    print(f"Generating reveal sounds into {ASSETS_DIR}")
    save("boardWin.wav", gen_board_win())
    save("boardLose.wav", gen_board_lose())
    save("revealStart.wav", gen_reveal_start())
    sys.exit(verify())
