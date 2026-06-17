#!/usr/bin/env bash
# Fetch and build all timer sounds (frontend/sounds/*.wav) from free-license
# recordings. See frontend/sounds/CREDITS.md for sources and licenses.
#
# Re-run after changing the trim/fade: ./scripts/fetch_sounds.sh
set -euo pipefail

BELL_URL="https://upload.wikimedia.org/wikipedia/commons/4/42/Gong_or_bell_vibrant_%28short%29.ogg"
CLOCK_URL="https://upload.wikimedia.org/wikipedia/commons/5/56/Clock_ticking.ogg"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/frontend/sounds"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

curl -sL -A "pomotodo-sound-fetch/1.0 (free-license asset)" -o "$TMP/bell.ogg" "$BELL_URL"
curl -sL -A "pomotodo-sound-fetch/1.0 (free-license asset)" -o "$TMP/clock.ogg" "$CLOCK_URL"

# start: one mechanical clock tick — the kitchen-timer "wind" cue.
ffmpeg -y -loglevel error -ss 1.071 -t 0.17 -i "$TMP/clock.ogg" -ac 1 -ar 44100 \
  -af "afade=t=out:st=0.12:d=0.05,loudnorm=I=-18:TP=-2,volume=1.0" -sample_fmt s16 "$OUT/start.wav"
# focus-end: full ring with a gentle fade tail.
ffmpeg -y -loglevel error -i "$TMP/bell.ogg" -t 3.2 -ac 1 -ar 44100 \
  -af "afade=t=out:st=2.6:d=0.6,volume=0.9" -sample_fmt s16 "$OUT/focus-end.wav"
# break-end: shorter single ding.
ffmpeg -y -loglevel error -i "$TMP/bell.ogg" -t 1.4 -ac 1 -ar 44100 \
  -af "afade=t=out:st=0.9:d=0.5,volume=0.9" -sample_fmt s16 "$OUT/break-end.wav"

echo "wrote start.wav focus-end.wav break-end.wav"
