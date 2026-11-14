# Astro Vital — Crew Health Monitor

A self-service health monitoring project for astronauts on long-duration space missions, built for the **2026 NASA Space Apps Challenge** (Human Exploration · Software · Space Exploration).

Long missions expose crews to radiation, isolation, altered gravity and a closed environment — with immune changes, bone loss, cardiovascular events and behavioral health risks. Crew members carry much of the responsibility for spotting those changes in themselves. Astro Vital turns a short daily check-in into a clear status and a concrete next action.

## Why it matters

- **Early signal, not diagnosis.** Trends in heart rate, blood oxygen, blood pressure, temperature, sleep, exercise and stress surface before a crew member notices a problem.
- **Crew autonomy.** The tool is designed to work offline and keep health data on the device, without waiting for a ground link.
- **Actionable output.** Every out-of-range indicator should come with a next step: re-measure, hydrate, rest, or contact the flight surgeon.

## What is in this repository

The working prototype is a React + TypeScript (Vite) front end served by a FastAPI
backend with SQLite persistence. Both demo scenarios replay through a deterministic
engine (`backend/engine/`, `rules/demo-v1.json`): a real RadLab detector replay when the
pinned archive is present, and a synthetic crew sleep/vigilance scenario whose canonical
input is `fixtures/crew/sleep-vigilance.json`.

- Daily check-in, optional fatigue/mood/stress self-reports and a local reaction-time task.
- Two replay scenarios with an explicit clock, source freshness and incident recovery.
- Provenance stays visible: `REAL_HISTORICAL`, `SYNTHETIC` and `LIVE_MEASURED` are never mixed.
- Everything runs from locally bundled assets on loopback; no health data leaves the machine.

## Run the demo (loopback only)

Prerequisites: Python 3.11+ and Node.js 20+. On Windows use `npm.cmd` if `npm` is not on PATH.

```bash
# 1. Install the runtime (network available)
python -m venv .venv
.venv/Scripts/python -m pip install -r backend/requirements.txt   # Windows
.venv/bin/python -m pip install -r backend/requirements.txt       # macOS / Linux
npm --prefix frontend ci

# 2. Build the front end once, while the network is available
npm --prefix frontend run build

# 3. Launch the API *and* the built shell from one loopback process
python run.py --no-build
#    -> http://127.0.0.1:8000
```

`python run.py` builds automatically only when `frontend/dist/index.html` is missing. A
failed or unproductive build stops with a nonzero exit and never serves a stale bundle;
`--no-build` with missing assets prints the exact preparation command instead.

Useful flags:

| Command | Result |
|---|---|
| `python run.py --no-build` | Serve the prepared bundle (use this for the offline rehearsal) |
| `python run.py --build` | Force a rebuild before serving |
| `python run.py --check-archive` | Report RadLab archive status (A01); exit `0` only when verified, `2` when Blocked |
| `python run.py --host 127.0.0.1 --port 8000` | Explicit loopback address (non-loopback hosts are refused) |

Disable the reaction task (B04) for any launch:

```bash
# Windows PowerShell
$env:ASTRO_VITAL_RESOURCES='{"local_reaction_task": false}'; python run.py --no-build
# macOS / Linux
ASTRO_VITAL_RESOURCES='{"local_reaction_task": false}' python run.py --no-build
```

### Offline rehearsal (X01)

X01 is a **browser** check, not a build or API check: disable Wi-Fi/Ethernet after step 2,
launch with `--no-build`, open `http://127.0.0.1:8000`, and follow
[acceptance/manual-checklist.md](acceptance/manual-checklist.md). Nothing in this
repository marks X01 as passed until a person records that run.

## Checks

```bash
python -m pytest tests -q          # backend, API, persistence, loader, launcher, E2E gate
npm --prefix frontend test         # Vitest + node --test
npm --prefix frontend run build    # tsc --noEmit && vite build
python tests/e2e/test_e2e.py       # combined runtime gate; A01/A02-A04 Blocked without the archive
python run.py --check-archive      # A01 only
```

`tests/e2e/test_e2e.py` separates the RadLab archive gate (A01/A02-A04, Blocked until the
pinned CSV is supplied), the crew checkpoints (B01/B02/B04/B05), a static asset preflight
(AF01) and the offline browser rehearsal (X01: always `Not run` here). A required-check
failure exits nonzero; a blocked archive is reported separately.

## Planned scope (original concept)

These product ideas remain on the roadmap and are not part of the implemented demo rules;
the rules that actually run are versioned in `rules/demo-v1.json` and described in
[contracts/v1.md](contracts/v1.md).

### Original assessment concept

Each indicator was compared to a nominal range and a wider watch range. Inside nominal →
**nominal**; inside watch only → **watch**; outside watch → **alert**. None of these
vital-sign ranges are implemented in the demo engine; they are listed here as concept.

| Indicator | Nominal | Watch | Alert |
| --- | --- | --- | --- |
| Heart rate (bpm) | 50–100 | 40–110 | < 40 or > 110 |
| Blood oxygen SpO₂ (%) | 95–100 | 90–95 | < 90 |
| Systolic pressure (mmHg) | 90–120 | 80–140 | < 80 or > 140 |
| Diastolic pressure (mmHg) | 60–80 | 50–90 | < 50 or > 90 |
| Body temperature (°C) | 36.0–37.5 | 35.5–38.0 | < 35.5 or > 38.0 |
| Sleep (hours) | 7–9 | 6–10 | < 6 or > 10 |
| Exercise (minutes/day) | ≥ 30 | 15–29 | < 15 |
| Stress (1–10) | 1–4 | 5–6 | ≥ 7 |



## Limitations

- Ranges are general adult reference values, not a medical device or a diagnosis.
- Data is stored per browser profile; there is no sync or ground-station upload.
- No wearable or EVA-suit integration planned for the challenge window.

On a real mission, always defer to the flight surgeon.

## Roadmap

- Import from wearables and suit telemetry.
- Trend charts and personal baselines per crew member.
- Crew-level dashboard for the flight surgeon.
- Localized, low-bandwidth UI for delayed-communication phases.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Code owner: [@MehdiCherkane](https://github.com/MehdiCherkane).

## Acknowledgments

Challenge brief and imagery: NASA Space Apps Challenge 2026. Built by the Astro Vital team.
