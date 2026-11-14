# Offline rehearsal and recording sheet

Owner: Fadoua; runtime Hamza; dashboard Amine; visual review Nassim; check-in Mohsine.
Current **X01: Blocked** on a frozen seeded candidate and verified archive.
The labels below were checked in main `9c4a29e` source. Confirm them on the
rendered release build with Amine, Mohsine and Nassim.
[Acceptance ledger](../acceptance/manual-checklist.md) ·
[Executed baseline evidence](../evidence/acceptance-baseline-2026-11-14.md).

## Prepare before disconnecting

Use Hamza's [runtime instructions](../backend/README.md). Install declared
dependencies and build beforehand; do not depend on a download during the demo.
From the repo root, the documented setup/build is:

```powershell
python -m venv .venv
.venv/Scripts/python -m pip install -r backend/requirements.txt
npm --prefix frontend ci
npm --prefix frontend run build
```

Run those steps before disconnecting. Confirm the full backend and frontend
checks and save the successful build output. Hamza supplies the frozen launch
recipe and confirms it serves the prepared assets. El Mahdi confirms the archive
hash and rehearsal scope. Nassim confirms the browser and viewport. The current
main probe was a TestClient run with no built frontend.

Record build SHA, local diff, fixture SHA-256, imported archive hash/counts,
dependency/build success, tester and date. Prepare a separate SQLite database
per rehearsal via `ASTRO_VITAL_DB`; Hamza's loader must seed fresh runs. Do not
modify a previous recording's database. Configure resources before launch.

On the rehearsal machine, disconnect Wi-Fi, Ethernet and any other external
network connection before starting the prepared server. Keep loopback enabled.
Capture Windows showing the disconnected external interfaces, or record the
platform equivalent and time. Verify the browser can reach the local server
after launch. Use the frozen candidate’s documented command. The baseline
runtime README uses this loopback invocation after assets are built:

```powershell
.venv/Scripts/python -m uvicorn backend.api.main:create_app --factory --host 127.0.0.1 --port 8000
```

Open `http://127.0.0.1:8000/`. Keep browser Network logging open with cache
disabled. Capture requests showing only loopback asset/API URLs and no CDN,
remote fonts, telemetry or external API dependency. Do not open evidence source
web links during the offline recording; use local evidence and policy files.

## Exact shot sequence and expected screens

Do the seeded crew sequence before any form submission in that run.

| Shot / acceptance | Click path | Expected screen / proof to capture | Current status |
| --- | --- | --- | --- |
| 1 / mode gate | Open loopback root | **Astro Vital**, data-mode badge, run ID and clock; confirm integrated header plus actual seeds. A preview badge limits the take to clearly labeled preview coverage | **Blocked** — loader/import pending |
| 2 / A03 | **Detector gap (RadLab)** → **23:20:00** → **Why?** | **Why? Evidence**, DosTel1 455 s vs DosTel2 0 s, both readings/timestamps, rule and one open incident. Keep **Historical NASA telemetry** visible | **Blocked** — archive |
| 3 / A04 | Close drawer → **23:30:00** → **Incident history** → **23:20:00** | Both current, resolved incident, then rewind to open with same ID. Gap cause remains unknown | **Blocked** — archive |
| 4 / B01 | **Sleep and vigilance** → **Fresh run** → **09:00** → **Why?** | **Vigilance data missing**, sleep evidence and missing reaction, **Synthetic crew scenario** | **Blocked** — loader |
| 5 / B02 | Close drawer → **09:01** → **Why?** | **Sleep and vigilance change**, watch; 310 vs 250 ms (+24.0%); 450-minute baseline and 380/370/420-minute nights; IDs, times, rule | **Blocked** — loader |
| 6 / history | Close drawer → **Source history** → **reaction_task** | Five baseline rows and sample at 09:01. Rewind to 09:00: five baseline reactions, sample absent | **Blocked** — loader |
| 7 / local sample input | **Fresh run** → **09:00** → **Crew check-in** → **Sleep duration (minutes)** = 420; optional scores blank → **Submit check-in** | **Check-in submitted. Edit a field to start a new check-in.**; one local synthetic entry. New **Fresh run** excludes that submission | **Not run** — separate run required; no browser rehearsal |
| 8 / live task, optional separate take | **Fresh run** → **09:00** → **Run reaction check** → **Start practice**; space only at prompt → **Start measured trials** | **Reaction check complete**, **Recorded on this device**, measured median and automatic submission. Browser profile is incomparable with seed; assessment remains insufficient, no promised 310 ms | **Not run** — do not interleave with seeded B02 |
| 9 / B04 | Relaunch with resource false → crew **Fresh run** → **09:00** → **Review available inputs** | **Reaction check unavailable** with reason; fallback evidence opens; pending state | **Blocked** — seeded engine path |
| 10 / X01 repeat | Stop server, keep network disconnected, relaunch same command; use fresh runs and repeat shots 2-5 and 7 | Both scenarios, drawers, submit and reset work after a fresh offline launch | **Blocked** — integrated prerequisites |

For keyboard and small-window review, record viewport and check focus visibility,
drawer close/focus return, readable evidence tables and no clipped primary actions.
Status **Not run**; Nassim/Amine verify on the rendered app.

## Preview fallback

When integrated gates are blocked, show the visible **Fixture preview** badge.
The root app's contract snapshots are RadLab at 23:20 and crew at 09:00, with replay
disabled. The `/?gallery` route is a static visual gallery; fake submission
callbacks cannot demonstrate persistence. Do not splice those screens into a
take labeled integrated.

Say: “These are fixed contract previews. The canonical synthetic crew fixture
passes engine checks at 09:00 and 09:01. The seeded API path and offline rehearsal
remain pending on this build.” Show the test output as **Engine validation**, not as an app run.
The media inventory below remains pending. If a seeded candidate is available
but the archive is blocked, get El Mahdi’s approval for the reduced script.
Record any crew-only disconnected result on its own row. Full X01 stays Blocked
while either required scenario is unavailable.

## Record actual outcomes

Copy this form per run and replace each status only after observing the result:

- Build SHA + diff / fixture hash:
- Tester / date UTC / OS / browser / viewport:
- Launch command / database path / resources:
- Disconnection evidence / Network log:
- Scenario / run ID / requested and displayed time / data mode:
- A01-A04, B01-B05, X01 status and observed result (one of Pass/Fail/Blocked/Not run each):
- Screenshot / recording filename and exact segment for each row:
- Deviations, owner, next action:

Export screenshots/recording locally with build, scenario and checkpoint in the
filename. Show provenance, clock and mode in frame. Mark the pitch's C02/C04/C10
claims usable only after archive/recovery/offline checks pass. Use the
[claim table](../evidence/demo-claims.md) for every spoken factual claim.

## Media inventory for the release packet

Use `demo/artifacts/<short-SHA>/` in a local capture folder or a separate
team-approved local media directory. Capture at a readable viewport with
mode, label, and replay time visible. Record actual local paths and SHA-256
after export. The filenames here are targets.

| Artifact | Target filename | Status |
| --- | --- | --- |
| Two-minute backup | `<sha>-astro-vital-backup.mp4` | Blocked pending frozen app rehearsal and release scope |
| Crew missing input | `<sha>-crew-0900-why.png` | Blocked pending seeded browser candidate |
| Crew seeded watch | `<sha>-crew-0901-why.png` | Blocked pending seeded browser candidate |
| Historical gap and recovery | `<sha>-radlab-232000-why.png`, `<sha>-radlab-233000-incidents.png` | Blocked pending verified archive and replay |
| Connection, fresh launches and browser network record | `<sha>-disconnected.png`, `<sha>-launch-log.txt`, `<sha>-loopback.har` | Blocked pending X01 |
| Portal-sized demo | `<sha>-submission-demo.mp4` or approved slide deck | Not run. Confirm the allowed format in the current Project tab |

After capture, play the full backup locally, verify captions, clock and
provenance at normal size, and save exact offsets with A/B IDs. Attach links
only to reviewed media. [Submission draft](submission-draft.md).
