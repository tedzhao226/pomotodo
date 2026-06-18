# Sound credits

All timer sounds are built by `scripts/fetch_sounds.sh` (trimmed/faded with
ffmpeg). Theme: a soft airplane "cabin chime" — unobtrusive, physical and warm.

## start.wav, focus-end.wav, break-end.wav

Built from **"Airplane Chime Sound Effect"** — a soft two-tone cabin chime.

- `focus-end` / `break-end`: the descending chime ("done"); `start`: the same
  two tones reordered low→high ("go").
- Source: https://commons.wikimedia.org/wiki/File:Airplane_Chime_Sound_Effect.ogg
- License: Creative Commons CC0 1.0 (public domain, no attribution required)
- Author: Sharelk

## tick.wav

The per-second tick — a soft, warm low sine blip — is **synthesized** by
`scripts/fetch_sounds.sh` (ffmpeg `sine=180Hz`, fast decay). No external source;
public domain.
