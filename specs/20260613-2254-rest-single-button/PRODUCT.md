# Rest Single-Button & Select Color — Product Spec

Links: none provided.

## Summary

The rest timer reuses the single timer button (pause/resume; long-press or Escape skips the rest to
zero), work and rest are visually distinct (tomato vs green), auto-start-rest and sound are
configurable, and the dropdown highlight uses a calm green instead of the harsh red.

## Problem

Rest has a divergent control — its own "Skip rest" button — and looks identical to a work block, so
the phase is unclear.
The native `<select>` highlights the chosen option in a jarring saturated red.

## Goals

- One consistent timer control across work and rest.
- An obvious work/rest visual cue.
- Configurable auto-start-rest and sound.
- A pleasant select highlight color.

## Non-goals

- Changing how completed blocks count (a work long-press still discards, never counts).
- Multiple selectable chime sounds (only on/off).
- Changing the short/long rest cadence.

## User Experience

### Work phase
The button is **▶ Start → ⏸ Pause → ▶ Resume**.
Holding it (~550ms) or pressing **Escape** discards the block (incomplete, does not count).
Tomato accent; hint reads "Hold to stop".

### Rest phase
The same button pauses/resumes the rest.
Holding it or pressing **Escape** skips the rest to zero → Ready.
Green accent; the mode shows "Short/Long rest — N min"; hint reads "Hold to skip".
The separate "Skip rest" button is gone.

### Phase cue
The timer panel switches accent between **tomato (work)** and **green (rest)**: the big countdown is
tinted and a small **Work/Rest** pill shows the current phase.

### After a work block
If **Auto-start rest** is on, rest begins automatically.
If off, the existing "Continue (skip rest) / Take a rest" prompt is shown.

### Settings
Add **Auto-start rest** (toggle) and **Sound** (toggle); both persist in the browser.

### Select color
The dropdown option highlight is muted green, not red.
