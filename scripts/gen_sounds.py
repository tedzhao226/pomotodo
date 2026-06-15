"""Generate the timer alert sounds (committed as frontend/sounds/*.wav).

Self-synthesized bell tones — license-clean, no external assets.
Re-run after tweaking to regenerate: `python3 scripts/gen_sounds.py`.
"""

import math
import struct
import wave
from pathlib import Path

SAMPLE_RATE = 44100
OUT_DIR = Path(__file__).resolve().parent.parent / "frontend" / "sounds"

# Inharmonic partials + amplitudes give a soft bell/marimba timbre.
PARTIALS = [(1.0, 1.0), (2.0, 0.5), (2.41, 0.28), (3.0, 0.18), (4.5, 0.1)]


def bell(freq: float, dur: float, decay: float) -> list[float]:
    n = int(SAMPLE_RATE * dur)
    out = []
    for i in range(n):
        t = i / SAMPLE_RATE
        env = math.exp(-t / decay)
        s = sum(amp * math.sin(2 * math.pi * freq * ratio * t) for ratio, amp in PARTIALS)
        out.append(env * s)
    return out


def write_wav(name: str, samples: list[float], gain: float = 0.6) -> None:
    peak = max((abs(s) for s in samples), default=1.0) or 1.0
    scale = gain / peak
    frames = b"".join(
        struct.pack("<h", int(max(-1.0, min(1.0, s * scale)) * 32767)) for s in samples
    )
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    with wave.open(str(OUT_DIR / name), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SAMPLE_RATE)
        w.writeframes(frames)


def sequence(notes: list[tuple[float, float, float]], gap: float = 0.0) -> list[float]:
    out: list[float] = []
    for freq, dur, decay in notes:
        out.extend(bell(freq, dur, decay))
        out.extend([0.0] * int(SAMPLE_RATE * gap))
    return out


def main() -> None:
    # Start: one bright, short, friendly tap.
    write_wav("start.wav", bell(880.0, 0.28, 0.12), gain=0.45)
    # Focus end: rising two-note "done!" chime.
    write_wav("focus-end.wav", sequence([(659.25, 0.45, 0.3), (987.77, 0.7, 0.4)]))
    # Break end: gentle descending two-note "back to it" chime.
    write_wav("break-end.wav", sequence([(659.25, 0.45, 0.3), (440.0, 0.7, 0.4)]))
    print("wrote", *(p.name for p in sorted(OUT_DIR.glob("*.wav"))))


if __name__ == "__main__":
    main()
