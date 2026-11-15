# Mission observatory

The root app is the integrated replay. `/?gallery` remains a labeled fixture preview. The dashboard consumes shell-owned state; no backend calculations or confidence model were added.

## Visual system

The palette is the cool blue-glass system defined in `../ui/tokens.css`:

- Deep space canvas `#040813` → `#0A1226`, with an original animated galaxy behind the UI.
- Light reading surfaces `#F3F6FD` at ~92% opacity, ink `#0E1A33`, secondary `#4A5878`.
- Filled actions and selected tabs use `#2F6FE0` with white text; `#4F8BFF` is the accent for links and chart lines on dark; `#6BA1FF` is the link/outline hover; focus is 2px `#9DBEFF`.
- Green `#2FBF8F` is used only for current/ok status. Amber `#F2B44E` is caution/watch; missing and insufficient data use neutral slate-blue `#8FA3C7` rather than alarm colours.
- Provenance: Synthetic violet `#A58BFF`, Historical NASA cyan `#5BC8E8`, device blue `#244C9A`.
- Dark framing panels use translucent navy glass with a 1px `rgba(130,170,255,.25)` border and backdrop blur; a soft dark scrim sits behind the dense reading surfaces.

## Galaxy

The supplied `galaxy-background-final.html` canvas and animation script are integrated as `galaxy.ts` with only the requested changes:

- Full-screen fixed `<canvas id="galaxy">` at `z-index: -1`; the dark base colour is on `<html>` only and `<body>` stays transparent.
- A `paused` flag in the frame loop freezes spinning and twinkling while keeping the last frame drawn. The header motion button, document visibility, reduced-motion preference and an active reaction task all pause it.
- Device-pixel ratio capped at 1.5; the star budget drops to 12,000 on screens under 900px or low-core/low-memory devices.
- No runtime fetch: the canvas builds its own sprites and geometry locally.

## Hero and scenes

- The crew scene is an original inline SVG hologram figure (no raster asset): layered contour, muscle and joint lines, head/eye vigilance focus and three leader lines landing on the anatomy. Male/Female and Front/Back are presentation-only controls; they never change data.
- The cabin scene is an original SVG cross-section with two labeled detector nodes. Current nodes glow and pulse gently; stale/amber and invalid treatments use the same semantic tokens. Labels sit clear of the hull lines.
- Safety disclaimers are visible info notes, not tiny grey text.

## Evidence and data presentation

- Compact readings show dose rates to two decimals with the full six-decimal returned value in the native tooltip; compact sleep/reaction readings stay exact.
- `Reading age: 0 s (just now)` replaces the ambiguous “Reading details — 0 s”. The 420 min reading and 7,200 s age are different fields and are now labelled as such.
- RadLab adds a display-only detector cross-check with the percentage difference and an in-agreement indicator inside a ±10% display band. This is presentation, not a backend or safety rule.
- Source history is a real-history line plus soft area fill, visible points, units and ticks, a shaded returned-baseline range where evidence provides one, hover/focus tooltips, and a proper centered single-point state. Raw tables remain available with singular/plural row counts.

## Header and replay

- Brand mark: animated heart-planets SVG served at 40px as an `<img>`. **The supplied `heart-planets-logo.svg` was not present in the workspace**, so `frontend/public/art/heart-planets-logo.svg` is an original stand-in with the same name and animation intent; replace that file with the supplied asset when available.
- “Replay prototype / Integrated run” is one segmented mode control.
- Playback is shell-owned: play/pause, 1×/2×/4× speed and a scrubber tied to the replay clock. Playback pauses for a measurement task, and a new run/scenario never inherits it.

## Verification

- Frontend: **96 Vitest tests (9 files) + 41 Node tests passed**; production build passed (`tsc --noEmit` + Vite).
- Backend unchanged; engine tests are unaffected.
- Browser verification at 1440, 1024, 800, 790 and 390: no horizontal overflow; 3/2/1 columns; fixed banner height; both scenarios; galaxy animation and pause; playback; reduced motion; keyboard focus; chart tooltip; gallery preview; no page/console errors or external requests.

## Run and verify

From the repository root with dependencies installed:

```sh
npm --prefix frontend ci
npm --prefix frontend test
npm --prefix frontend run build
python -m pytest tests -q
python tests/e2e/test_e2e.py
python run.py --check-archive
python run.py --no-build --port 8767
```

Use a fresh `ASTRO_VITAL_DB` path when rehearsing. The build is necessary after frontend changes; `--no-build` serves existing output.

A human keyboard spot-check of the reaction task and the network-disabled X01 rehearsal remain pending. The automated browser uses Playwright/CDP keyboard events, not a physical keypress.
