# Contributing to Astro Vital

Thanks for helping the crew. The runtime is a React + TypeScript (Vite) front end in
`frontend/` and a FastAPI + SQLite backend in `backend/`, served together from one
loopback process. Keep changes small and keep the demo reproducible offline.

## Stack and layout

| Path | What lives there |
|---|---|
| `frontend/` | React shell, dashboard, check-in, shared UI kit, Vite build |
| `backend/api/` | HTTP routes, request validation, run lifecycle |
| `backend/storage/` | SQLite persistence (runs, observations, submissions) |
| `backend/replay/` | Crew fixture loader, RadLab archive importer |
| `backend/engine/`, `rules/` | Deterministic evaluator and versioned policy |
| `fixtures/crew/` | Canonical synthetic crew fixture (contract D2) |
| `contracts/`, `tests/` | Interface contract and the automated checks |

## Getting started

```bash
git clone https://github.com/MehdiCherkane/space-health-monitor.git
cd space-health-monitor

# Python runtime
python -m venv .venv
.venv/Scripts/python -m pip install -r backend/requirements.txt   # Windows
.venv/bin/python -m pip install -r backend/requirements.txt       # macOS / Linux

# Front end: install and build while the network is available
npm --prefix frontend ci
npm --prefix frontend run build

# Serve the API and the built shell on loopback
python run.py --no-build      # http://127.0.0.1:8000
```

For UI work, `npm --prefix frontend run dev` runs Vite with its `/api` proxy pointing at
the backend, so run `python run.py --no-build` (or the API alone) in a second terminal.

## Checks before a pull request

```bash
python -m pytest tests -q
npm --prefix frontend test
npm --prefix frontend run build
python tests/e2e/test_e2e.py
python run.py --check-archive
```

The E2E harness reports the RadLab archive gate as `Blocked` when the pinned CSV is not
present and X01 (`Not run`) as a separate browser rehearsal. Do not turn a build, an API
assertion or a static asset scan into an offline-browser pass; those are different claims.

## Ways to contribute

- **Bug reports** — open an issue with steps to reproduce, expected vs. actual behavior, and your browser.
- **Feature ideas** — open an issue describing the crew problem first, then the proposed change.
- **Health ranges** — these are the product's core logic. Cite a source (NASA HRP, WHO, or clinical guidance) in the PR and update the policy in `rules/demo-v1.json`.
- **UI and accessibility** — keyboard navigation, screen-reader output, contrast and small-screen layouts are always welcome.

## Workflow

1. Fork the repo, or create a branch if you have write access.
2. Branch from `main` using `type/short-description`, e.g. `feat/sleep-trends`, `fix/spo2-boundary`, `docs/readme-setup`.
3. Make one focused change. Keep unrelated refactors out of the same PR.
4. Open a pull request describing **what changed, why, and how you tested it**.

## Commit messages

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add sleep trend sparkline
fix: treat SpO2 of 90 as watch, not nominal
docs: clarify local server setup
test: cover high-side temperature advice
```

## Code guidelines

- No new dependencies without a discussion in an issue.
- Keep thresholds and rule versions in `rules/demo-v1.json`; the contract in `contracts/v1.md` is the interface source of truth.
- Never mix provenance: `REAL_HISTORICAL`, `SYNTHETIC` and `LIVE_MEASURED` stay distinguishable in every response.
- Keep check-in data on-device; do not add network calls that would send health data off the client.
- Update `README.md` when behavior, setup, or the rule set changes.
- All UI must remain usable with a keyboard and announced correctly by screen readers.

## Review and ownership

`@MehdiCherkane` is the code owner for all files (see [`.github/CODEOWNERS`](.github/CODEOWNERS)) and reviews every change.

## Code of conduct

Be respectful, assume good intent, and keep feedback about the code. Harassment and personal attacks are not tolerated.

## Medical disclaimer

This software is a challenge prototype, not a medical device. Contributions must not imply clinical certification or replace the flight surgeon's judgment.
