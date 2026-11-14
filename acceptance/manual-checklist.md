# Astro Vital acceptance ledger

Reviewed main `9c4a29ecbba0a77564b2d6c792de8d96c5d91ae6` on November 14, 2026.
PR #10 is merged. PR #11 candidate confirmation is pending. This is the
working ledger for candidate and release checks.
[Baseline test runs and blockers](../evidence/acceptance-baseline-2026-11-14.md).

## Expected checks and current status

Record a separate result for each layer. **Pass** requires an executed check
with evidence. **Fail** means the tested requirement was missed. **Blocked**
means a dependency prevents the check. **Not run** means it has not been performed.
Historical fixture previews, seeded synthetic data, real detector archives,
and local device captures have different provenance. `X-Data-Mode: integrated`
must be checked alongside observed data, IDs and returned time.

| ID / owners | Command or browser path | UTC replay time | Required scope and expected result |
| --- | --- | --- | --- |
| A01 / El Mahdi | Run `Get-FileHash -Algorithm SHA256 fixtures/radlab/iss-radlab-dostel-2022-04-01.csv` and the candidate verifier. PR #11 proposes `python run.py --check-archive`; confirm that option on the candidate SHA. | `2022-04-01T23:00:00Z` through `2022-04-02T01:04:59Z` | Real source bytes match the pinned hash below. Imported counts are 84 DosTel1 and 96 DosTel2 with stable source/time IDs, null subject and preserved original timestamps. Archive verification has no run ID or API data mode. |
| A02 / El Mahdi, Hamza, Amine | Create RadLab run. GET state at each clock. Browser **Detector gap (RadLab)** → **23:12:25** → **23:17:25** → **23:17:26**. | Apr 1, 2022 at the three displayed times | Verified archive, integrated. Both current initially. DosTel1 current at 300 s and stale at 301 s, with a single open DosTel1 incident. |
| A03 / El Mahdi, Hamza, Amine, Nassim | **23:20:00** → **Why?** → close → **Incident history** and **Source history**. Re-request the same state. | `2022-04-01T23:20:00Z` | Verified archive, integrated. DosTel1 455 s and 1.65945 µGy/h at 23:12:25, DosTel2 0 s and 2.211496 µGy/h at 23:20:00. One stable open incident, source IDs and timestamps visible. Gap cause unknown. |
| A04 / El Mahdi, Hamza, Amine, Nassim | **23:30:00** → **Incident history** → **23:20:00**. GET both states with the same run ID. | `2022-04-01T23:30:00Z`, then `23:20:00Z` | Verified archive, integrated. Both current at 23:30, one resolved incident with archive-derived closure time. Rewind shows that same incident open and no future observations or closure. |
| B01 / Fadoua, Hamza, Amine | **Sleep and vigilance** → **Fresh run** → **09:00** → **Why?**. Use the state and history calls below. | `2026-01-10T09:00:00Z` | Seeded synthetic integrated. **Vigilance data missing**, `insufficient_data`, missing `reaction_time`. 380/370/420 min compared with 450 min. History has 13 rows including five baseline reactions. Only eight sleep rows referenced in state. No `reaction-10`. |
| B02 / Fadoua, El Mahdi, Hamza, Amine | Same untouched run → close → **09:01** → **Why?** → **Source history** → **reaction_task**. GET state/history at 09:01 and again at 09:00. | `2026-01-10T09:01:00Z`, then `09:00:00Z` | Seeded synthetic integrated. **Sleep and vigilance change**, `watch`, 310 vs 250 ms (+24.0%). History contains exactly 14 seed rows. Every Why evidence ID resolves once to a visible observation. Rewind excludes the sample. |
| B03 / Fadoua, El Mahdi, Hamza | Engine command `python -m unittest discover -s tests/fixtures -v`. For runtime, execute Hamza’s agreed explicit test seam once per input variant in isolated db/runs. Record the concrete command when handed over. | `2026-01-10T09:01:00Z` | Test-only synthetic: comparable 270 ms yields `observed` (+8%), missing sleep-09 yields `insufficient_data` and `sleep_duration`, changed reaction profile yields `insufficient_data` and `reaction_time`, with the current incomparable reading retained. Use in-memory/test copies; preserve canonical bytes. |
| B04 / Fadoua, Hamza, Mohsine, Amine | Set `ASTRO_VITAL_RESOURCES='{"local_reaction_task": false}'` in launch environment, verify candidate configuration, start fresh crew run → **09:00** → **Review available inputs**. | `2026-01-10T09:00:00Z` | Seeded synthetic with resource disabled. State remains pending, **Reaction check unavailable** appears with reason, fallback opens **Why? Evidence**. Verify unavailable task cannot launch or restart. |
| B05 / Fadoua, Hamza, Mohsine | Use POST and history sequence below on a disposable run. Browser on another fresh run **Crew check-in** → **Sleep duration (minutes)** = 420 → **Submit check-in** → **Fresh run**. | `2026-01-10T09:00:00Z` | Seeded synthetic integrated. 201 then 200 with identical IDs, then 409 for changed same-ID payload. History 13→14→14→14, one submitted batch. Fresh run has new ID and 13 seeds, without prior submit ID. |
| X01 / El Mahdi, Fadoua, Hamza, Amine, Mohsine, Nassim | Follow the [recording sheet](../demo/recording-checklist.md). Disconnect before launch, exercise both scenarios and reset, stop server and repeat on fresh launch. | A02–A04 and B01–B02 clocks above | Prepared release build, browser, actual disconnected launch. Capture interface, repeatable transitions, local submit/reset and loopback-only requests. |

Pinned A01 SHA-256 `be73563615dbbd28b0b8548a0b9ba40c2059f3dc68ef8941203eb350dcc9e9fb`.
Archive ownership and verification sit with El Mahdi. The pilot run and recording
use an isolated database and the same candidate SHA. Treat source-code labels in
this ledger as provisional until Amine, Mohsine and Nassim confirm rendered labels.

## Observed status by layer

`—` means no evidence or run ID exists for that scope. The times for each row
are in the matching check above. The candidate records below supersede no
historical evidence.

| Check / layer | Status | Reviewed SHA | Observed run ID | Observed data mode | Evidence or blocker |
| --- | --- | --- | --- | --- | --- |
| A01 archive | Blocked | `9c4a29e` | — | — | Pinned archive absent in reviewed main. Await El Mahdi’s hash, counts and import output. |
| A02 real replay | Blocked | `9c4a29e` | — | — | A01 and real 300/301 s replay needed. |
| A03 real replay | Blocked | `9c4a29e` | — | — | A01 and real 23:20 state needed. Example A is engine/preview evidence. |
| A04 real replay | Blocked | `9c4a29e` | — | — | A01 and real closure/rewind needed. Synthetic recovery tests cover the engine. |
| A02–A04 browser | Blocked | `9c4a29e` | — | — | Requires real replay and a built browser candidate. |
| B01–B04 engine | Pass | `9c4a29e` | Test cases | Direct synthetic inputs | 13 fixture and 43 engine checks passed. [Baseline](../evidence/acceptance-baseline-2026-11-14.md) · [Engine checkpoints](../evidence/main-9c4a29e-engine-checkpoints.json). |
| B01 seeded API | Blocked | `9c4a29e` | `2447b0a14a3f41619cb192c4e0edd562` | `fixture-preview` | 09:00 requested and returned, zero stored rows. [Probe](../evidence/main-9c4a29e-preview-probe.json). |
| B02 seeded API | Blocked | `9c4a29e` | `2447b0a14a3f41619cb192c4e0edd562` | `fixture-preview` | 09:01 requested, 09:00 returned, zero stored rows. [Probe](../evidence/main-9c4a29e-preview-probe.json). |
| B03 runtime test seam | Blocked | `9c4a29e` | — | — | Await agreed seeding override from Hamza. |
| B04 seeded API | Blocked | `9c4a29e` | — | — | Await candidate and resource-disabled launch recipe. |
| B05 seeded API | Blocked | `9c4a29e` | — | — | Fresh seeded history/isolation requires candidate. |
| B01/B02/B04/B05 browser | Not run | `9c4a29e` | — | — | Await prepared build and independent browser walkthrough. |
| X01 disconnected browser | Blocked | `9c4a29e` | — | — | Await frozen SHA, prepared seeded build and archive verification. |

Keep the [original PR #10 preview probe](../evidence/crew-api-preview-probe.json)
with its [reviewed baseline](../evidence/crew-fixture-validation.md). Add new
observations below or in a linked run log. Preserve the original raw evidence.

## API commands for release rehearsal

Run after candidate launch. Use `$scenario = 'radlab_stale'` and the A clocks
for the detector checks. Replace the clocks array with `'2022-04-01T23:12:25Z', '2022-04-01T23:17:25Z', '2022-04-01T23:17:26Z', '2022-04-01T23:20:00Z', '2022-04-01T23:30:00Z', '2022-04-01T23:20:00Z'`. Use a fresh run for each independent test or variant.

```powershell
$api = 'http://127.0.0.1:8000/api/v1'
$scenario = 'sleep_vigilance'
$clocks = @('2026-01-10T09:00:00Z', '2026-01-10T09:01:00Z', '2026-01-10T09:00:00Z')
$created = Invoke-WebRequest "$api/runs" -Method Post -ContentType 'application/json' -Body (@{scenario_id=$scenario} | ConvertTo-Json -Compress)
$run = ($created.Content | ConvertFrom-Json).run_id
foreach ($clock in $clocks) {
    $state = Invoke-WebRequest "$api/runs/$run/state?as_of=$clock"
    $history = Invoke-WebRequest "$api/runs/$run/observations?as_of=$clock"
    $mode = $state.Headers['X-Data-Mode']
    "run=$run requested=$clock mode=$mode state=$($state.StatusCode) history=$($history.StatusCode)"
    $state.Content
    $history.Content
}
```

For B05 use a new run and `$clock = '2026-01-10T09:00:00Z'`. Start with
history, then POST each body below in order to
`$api/runs/$run/observations`. GET history after each POST. On Windows
PowerShell, inspect `$_.Exception.Response.StatusCode` if the 409 throws.

```powershell
$body = '{"submission_id":"acceptance-b05-1","observed_at":"2026-01-10T09:00:00Z","entries":[{"source_id":"crew_sleep_log","metric":"sleep_duration","value":420,"unit":"min"}]}'
foreach ($attempt in @($body, $body, $body.Replace('"value":420','"value":421'))) {
    try {
        $response = Invoke-WebRequest "$api/runs/$run/observations" -Method Post -ContentType 'application/json' -Body $attempt
        "POST $($response.StatusCode)"
        $response.Content
    } catch {
        if (-not $_.Exception.Response) { throw }
        "POST $([int]$_.Exception.Response.StatusCode)"
    }
    (Invoke-WebRequest "$api/runs/$run/observations?as_of=$clock").Content
}
```

Create another run with the same scenario. Re-read its history and the original
run’s history, retaining both run IDs. Keep original response bodies and headers
in the artifact log. Capture actual browser submit/reset in a separate run.

## Add a run record

```text
Check ID / layer / Pass, Fail, Blocked or Not run:
Exact build SHA / clean tree or recorded diff / fixture and archive hashes:
Tester / wall time UTC / OS / browser / viewport:
Launch command / database (isolated) / resource configuration:
Run ID / scenario / requested UTC clock / returned UTC clock:
Mode header / visible badge / input provenance:
Exact command or click path / observed output or blocking dependency:
Evidence filename or link / recording timestamp:
Owner / next verifiable check:
```
