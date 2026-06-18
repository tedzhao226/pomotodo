#!/usr/bin/env bash
# Build all timer sounds (frontend/sounds/*.wav) from free-license sources.
# Theme: a soft airplane "cabin chime" — unobtrusive, two-tone. See
# frontend/sounds/CREDITS.md for sources and licenses.
#
# Re-run after changing the trim/fade: ./scripts/fetch_sounds.sh
set -euo pipefail

CHIME_URL="https://upload.wikimedia.org/wikipedia/commons/c/ce/Airplane_Chime_Sound_Effect.ogg"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/frontend/sounds"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

curl -sL -A "pomotodo-sound-fetch/1.0 (free-license asset)" -o "$TMP/chime.ogg" "$CHIME_URL"

O=(-ac 1 -ar 44100 -sample_fmt s16)
mk() { ffmpeg -y -loglevel error "$@"; }

# The chime is two soft tones: high ~0.81–1.73s, low ~1.85–2.76s. Extract each,
# faded, then compose. high→low = "done" (end); low→high = "go" (start).
mk -ss 0.79 -t 0.95 -i "$TMP/chime.ogg" -af "afade=t=in:st=0:d=0.02,afade=t=out:st=0.8:d=0.14,volume=0.62" "${O[@]}" "$TMP/hi.wav"
mk -ss 1.83 -t 0.95 -i "$TMP/chime.ogg" -af "afade=t=in:st=0:d=0.02,afade=t=out:st=0.8:d=0.14,volume=0.62" "${O[@]}" "$TMP/lo.wav"

# start: low→high ascending two-tone.
mk -i "$TMP/lo.wav" -i "$TMP/hi.wav" -filter_complex "[0:a][1:a]concat=n=2:v=0:a=1,volume=1.0" "${O[@]}" "$OUT/start.wav"
# focus-end: full descending two-tone chime with a soft tail.
mk -ss 0.78 -t 2.0 -i "$TMP/chime.ogg" -af "afade=t=out:st=1.7:d=0.3,volume=0.62" "${O[@]}" "$OUT/focus-end.wav"
# break-end: a single soft bong (the low tone) — shorter, same chime.
cp "$TMP/lo.wav" "$OUT/break-end.wav"
# tick: a soft, warm low sine blip (synthesized) — the per-second cue.
mk -f lavfi -t 0.05 -i "sine=frequency=180" -af "afade=t=out:st=0.005:d=0.045:curve=exp,volume=0.3" "${O[@]}" "$OUT/tick.wav"

echo "wrote start.wav focus-end.wav break-end.wav tick.wav"
