# Astro Vital — Crew Health Monitor

A self-service health monitoring app for astronauts on long-duration space missions, built for the **2026 NASA Space Apps Challenge** (Human Exploration · Software · Space Exploration).

Long missions expose crews to radiation, isolation, altered gravity and a closed environment — with immune changes, bone loss, cardiovascular events and behavioral health risks. Crew members carry much of the responsibility for spotting those changes in themselves. Astro Vital turns a short daily check-in into a clear status and a concrete next action.

## Why it matters

- **Early signal, not diagnosis.** Trends in heart rate, blood oxygen, blood pressure, temperature, sleep, exercise and stress surface before a crew member notices a problem.
- **Crew autonomy.** The app works offline, stores data on the device, and gives guidance without waiting for a ground link.
- **Actionable output.** Every out-of-range indicator comes with next steps: re-measure, hydrate, rest, or contact the flight surgeon.

## Features

- Daily check-in across vital signs and daily countermeasures.
- Three-level assessment per indicator: **nominal**, **watch**, **alert**.
- Overall mission-readiness status with prioritized guidance.
- Check-in history (last 30 entries) kept locally in `localStorage`.
- No build step, no dependencies, no network calls — open `index.html` and it runs.
- Automated checks for the assessment rules.

## Run it

```bash
git clone https://github.com/MehdiCherkane/space-health-monitor.git
cd space-health-monitor
```

Open `index.html` in a browser, or serve the folder:

```bash
python -m http.server 8000
# then visit http://localhost:8000
```

## Tests

The assessment logic is dependency-free and runs in Node:

```bash
node test.js
```

## How the assessment works

Each indicator is compared to a nominal range and a wider watch range. Inside nominal → **nominal**; inside watch only → **watch**; outside watch → **alert**. The overall status is the worst individual status.

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

Ranges live in `METRICS` in [`script.js`](script.js) and are the single source of truth for both the UI and the tests.

## Limitations

- Ranges are general adult reference values, not a medical device or a diagnosis.
- Data is stored per browser profile; there is no sync or ground-station upload.
- No wearable or EVA-suit integration yet.

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
