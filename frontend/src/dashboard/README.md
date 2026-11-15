# Mission observatory

The root app is the integrated replay. `/?gallery` remains a labeled fixture preview. The dashboard consumes shell-owned state; no new backend calculations or confidence model were added.

- **Crew:** original illustrative anatomy with male/female and front/back presentation controls. These do not change the subject, run, observations, or assessment. Callouts navigate to history, check-in, or evidence.
- **Cabin:** geometric schematic with two instrument selectors and the engine's source states. It describes freshness, not radiation danger or personal exposure.
- **Evidence:** the merged EvidenceStatusPanel has an optional compact presentation; its input detail and limits remain in a disclosure. Assessment actions and Why remain prominent.
- **History:** individual, unsmoothed, time-positioned observations with raw table access. Zero is a reading. Empty history stays empty. Different units are not combined. Device points have a separate copper treatment and exact provenance remains in the table.
- **Motion:** the galaxy rotates once per 120 seconds using one CSS transform. Explicit pause, document visibility and reduced motion take precedence. CrewCheckIn reports task activity, including cancellation, withdrawal and unmount, so decorative motion rests throughout measurement. There are no per-frame React updates.
- **Check-in:** optional synthetic fields are inside a disclosure. Reaction instructions, timing, retry payloads, resource gating and retained completed results preserve the existing lifecycle.

## Assets and provenance

`frontend/public/art/anatomy-study.webp` is an original AI-generated educational mannequin sheet created for this project using the built-in image-generation tool on 2026-11-15. It was encoded from its native-alpha PNG into WebP without compositing or removing a background. The exact generation prompt is embedded in asset metadata. Four SVG viewports select the four figures. This is illustrative art, not validated diagnostic or anatomical ground truth. The user-supplied watermarked and low-resolution reference sheets are not bundled.

`galaxy.svg` is original procedural artwork: deterministic seed 27, 4,700 star points distributed around three spiral arms, a warm core and soft arm light. It is generated once and bundled; the runtime only transforms an image. `mark.svg` and the cabin schematic are original vector geometry.

Fira Sans regular and medium are locally bundled, unmodified font files under the SIL Open Font License. The license is included at `frontend/public/fonts/OFL.txt`. Nothing requests fonts, textures, models or scripts from an external origin at runtime.

## Verification at this branch

- Frontend: **91 Vitest tests (9 files) + 41 Node tests passed**; production build
  (`tsc --noEmit` + Vite) passed.
- Backend: **187 Python tests + 45 subtests passed**; the combined runtime gate
  (`tests/e2e/test_e2e.py`) passed with **X01 still Not run**; `run.py --check-archive` passed.
- Browser: 17 checks passed against the built app and an isolated database, including replay
  boundaries and rewind, all four anatomy views, Why drawer focus/Escape, galaxy rotation and
  pause, reduced motion, no overflow at 1440/1366/1024/390/320, mid-task cancellation,
  a 3-practice + 12-trial keyboard result with identical-payload retry, retained result,
  Fresh run, failed seek/retry, gallery preview and zero external requests.

A human keyboard spot-check and the network-disabled X01 rehearsal remain pending. Final
screenshot paths, tested SHA and remaining checks are recorded in the handoff.

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

Review crew 09:00 → 09:01 → rewind and RadLab 23:17:25 → 23:17:26 → 23:20 → 23:30 → rewind. Test the four anatomy views, Why drawer focus/Escape, source selection, raw table, pause/reduced motion, a full keyboard reaction, retry, and Fresh run. A browser-driven keyboard check is automated evidence; do a human keyboard spot-check before presenting. X01 requires a separate actual network-disabled launch/relaunch rehearsal and remains Not run until recorded.
