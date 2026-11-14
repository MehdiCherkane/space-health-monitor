# El Mahdi archive/importer delivery

Base: merged main `9c4a29ecbba0a77564b2d6c792de8d96c5d91ae6`.
Branch: `finish/archive-release`. Date: November 14, 2026.

## Delivered

- Original supplied CSV bundled byte-for-byte; SHA-256 matches the approved contract.
- Verified 180 real readings: 84 DosTel1 and 96 DosTel2, null astronaut subjects,
  original timestamps, source metadata and absorbed dose rate units retained.
- Strict importer uses documented column names, preserves zero values and rejects
  missing/duplicate columns, incomplete rows, unknown detectors, invalid/nonfinite/
  negative values, impossible timestamps and unsupported fractional/offset timestamps.
- Hashing and parsing share one byte snapshot; no path-replacement gap between them.
- `release/verify_historical.py` supplies explicit historical engine/API gates, structured
  JSON evidence and nonzero exit for failed or Blocked requested checks.
- Real data verifies the 300/301-second cutoff, 455/0-second ages, one incident, recovery
  at 23:30:00, rewind without future data, repeated-read stability and API read-only DB (logical contents, including committed SQLite WAL transactions).

See `fixtures/radlab/README.md` for provenance, exact hash, counts and checkpoints.
`release/historical-verification.json` contains executed source/incident evidence.

## Executed verification

| Scope | Command | Result |
|---|---|---|
| Current main + this delivery | `python -m pytest tests -q` | Pass: 131 tests, 45 subtests; 1 skipped (seeded API not merged) |
| Frontend locked setup | `npm --prefix frontend ci --offline --ignore-scripts` | Pass after populating missing locked npm tarballs; lockfile/manifests unchanged |
| Frontend | `npm --prefix frontend test` | Pass: 33 Vitest + 41 Node tests |
| Production frontend | `npm --prefix frontend run build` | Pass: TypeScript and Vite |
| Isolated current main + PR11 d99c549 + delivery | `python release/verify_historical.py --api` | Pass: A01–A04 real engine + API, no checksum mocks |
| Same isolated integration candidate | `python -m pytest tests/replay tests/engine tests/fixtures tests/api/test_seeded_crew.py -q` | Pass: 104 tests, 45 subtests |
| Full isolated integration candidate, built frontend | `python -m pytest tests -q --tb=short` | Fail: 20 tests; 121 tests and 45 subtests Pass. Existing tests expect empty runs, now both archives auto-seed |
| Production browser on isolated integrated candidate | Local Playwright + installed headless Chromium; `/tmp/astro-release-browser-smoke.cjs` | Pass: A02–A04 controls/Why/recovery/rewind, B01/B02 screens/Why, Fresh run, no uncaught page errors, loopback requests |
| Offline browser X01 | Actual disconnected browser rehearsal | Not run; no final release approval |

The combined-candidate results do not mean PR11 is merged or fully green. The real
historical path is now proven; Hamza's complete runtime/test-isolation fix is pending.
The Playwright connector lacked its Chrome executable; a local Playwright installation
with an existing headless Chromium completed the production browser smoke instead.
`release/browser-smoke.json` records its scope and results. Screenshots and the executed
script were saved outside the repository under
`/home/elmahdi/agent-handoffs/astro-vital-verification/`. External network was not disabled,
so this does not promote X01 to Pass or replace Nassim/Fadoua's final rehearsal.

## Hamza integration notes

1. Archive acquisition is solved. Update from merged archive delivery and remove the
   stale “CSV missing” blocker. Use the bundled bytes; do not re-export/reformat them.
2. This delivery adds `backend/replay/importer.py`, also added in PR11. Resolve that
   add/add overlap by retaining this stricter importer. Its existing public function
   names/constants are retained for PR11's unchanged exports. Keep your `loader.py`
   and `__init__.py` changes in your owned paths.
3. `tests/replay/test_archive_validation.py` adds importer checks without replacing
   PR11's loader-schema tests in `tests/replay/test_importer.py`.
4. Retain this `tests/replay/test_radlab_run.py` version: real historical gates now run
   without monkeypatching checksum verification. Synthetic assertion mechanics remain
   explicitly labeled and test the gate's ability to detect an incorrect state.
5. Both crew and RadLab auto-seeding affect old preview/empty-run tests. Explicitly
   supply absent paths for tests intended to be unseeded, including direct create_app
   calls. Do not disable production seeds or weaken persistence/validation assertions.
6. Run `python release/verify_historical.py --api --output /tmp/astro-historical.json`.
   Keep the gate separate from X01; it does not disable network or drive a browser.
7. Fix previously reported launcher/loader/E2E issues and update your PR description
   with the actual green combined result before requesting acceptance.

Other agents can use the archive checkpoint table for expected UI output. Fadoua
updates historical acceptance/claim status only after observing the final merged app;
Nassim supplies browser evidence; Mohsine/Amine finish their owned verification.

Final submission-build approval remains pending a green integrated candidate, the
feature fixes and a real offline walkthrough/backup recording on that candidate.
