# Offline demo acceptance

Base reviewed: `60898075b5508a9d9e5b46da15e1637aefa67ee2`, plus Fadoua's uncommitted
fixture work, November 14, 2026. [Engine validation and blockers](../evidence/crew-fixture-validation.md).
The statuses here refer to the **integrated application**. Engine B01-B04 results
are recorded separately and do not promote a browser row to Pass.

Before a run, record build SHA and uncommitted diff, tester, UTC time, OS/browser,
launch command, data mode, run IDs, fixture checksum, and evidence filenames.
Each row must have exactly **Pass**, **Fail**, **Blocked** or **Not run**, plus an
observed result or blocker. A screenshot of static material is not a runtime pass.

| ID / owners | Exact path and UTC checkpoint | Expected result | Current status / evidence |
| --- | --- | --- | --- |
| A01 / Hamza, Fadoua | Hash `fixtures/radlab/iss-radlab-dostel-2022-04-01.csv` with `Get-FileHash -Algorithm SHA256`; run Hamza's importer over Apr 1 23:00:00 through Apr 2 01:04:59, 2022 | Expected hash below; 84 DosTel1 + 96 DosTel2 rows; null subject; original timestamps retained | **Blocked** — pinned CSV/importer absent; backend README reports a different hash prefix, not remeasured here |
| A02 / El Mahdi, Hamza | **Detector gap (RadLab)** → **23:12:25** → **23:17:25** → **23:17:26** | Both current first; DosTel1 current at 300 s, stale at 301 s; one new DosTel1 incident | **Blocked** — historical import missing |
| A03 / El Mahdi, Amine, Hamza, Nassim | **Detector gap (RadLab)** → **23:20:00** → **Why?**; inspect **Incident history** | DosTel1 stale 455 s, DosTel2 current 0 s; readings 1.65945 and 2.211496 µGy/h at 23:12:25 and 23:20:00; one open incident. Repeat state request inside gap: same incident ID | **Blocked** — Example A is available only as a fixed preview |
| A04 / Hamza, El Mahdi, Amine, Nassim | Close drawer → **23:30:00** → **Incident history** → **23:20:00** | Both current at 23:30, one resolved DosTel1 incident; rewind restores open state without future reading/closure | **Blocked** — historical import missing; synthetic engine recovery test does not verify archive timing |
| B01 / El Mahdi, Mohsine, Amine, Hamza | **Sleep and vigilance** → **Fresh run** → **09:00** → **Why?** | **Vigilance data missing**, badge **insufficient data**; 380/370/420 min against 450 min; missing reaction; no `reaction-10`. Optional self-reports may be blank | **Blocked** — fresh API run has zero stored seeds; engine fixture comparison passes |
| B02 / El Mahdi, Fadoua, Hamza | Fresh seeded crew run, no submissions → **09:01** → **Why?** | **Synthetic crew scenario**, **Sleep and vigilance change**, `watch`; 310 ms versus 250 ms (+24.0%); deficits 70/80/30 min; rule `SLEEP_VIGILANCE@1`, both baselines and referenced IDs/timestamps | **Blocked** — live API probe requests 09:01 but receives preview at 09:00; canonical fixture engine check passes |
| B03 / El Mahdi, Fadoua, Mohsine | Load each isolated test variant through Hamza's future harness, then **Sleep and vigilance** → **09:01** → **Why?** | Comparable 270 ms: `observed`, **Demo pattern not observed**, +8.0%; remove sleep-09: `insufficient_data`, missing sleep; changed reaction profile: source current, comparison insufficient | **Blocked** — no variant-loader path exists. [Executable variant checks](../tests/fixtures/test_crew_fixture.py) pass at engine level |
| B04 / El Mahdi, Mohsine, Amine, Hamza | Launch with `ASTRO_VITAL_RESOURCES='{"local_reaction_task": false}'` → fresh crew run → **09:00** → **Review available inputs** | **Reaction check unavailable** plus reason; fallback opens **Why? Evidence**; assessment pending. Existing complete 09:01 sample still supports watch | **Blocked** — requires seeded engine state; fixed preview is not a resource-override verification |
| B05 / El Mahdi, Hamza, Mohsine | Separate crew run at **09:00**; submit identical check-in twice by API with original submission ID/time/body; retry changed body; **Fresh run** | First 201, retry 200 with same IDs, changed retry 409; one batch in original history; new run has only canonical seeds and new run ID | **Blocked** — seed isolation not implemented; full API pytest suite not run here (pytest absent) |
| X01 / Hamza, Amine, Fadoua, Nassim | Use [offline recording procedure](../demo/recording-checklist.md); disable Wi-Fi before launch; repeat A03-A04/B01-B02, sample submit/reset; stop/relaunch and repeat | Locally bundled assets/data; evidence, inputs and reset work twice; browser requests only loopback; observed screenshots and recording from this build | **Blocked** — seed loader and historical import pending; no offline browser run performed |

Expected A01 SHA-256:
`be73563615dbbd28b0b8548a0b9ba40c2059f3dc68ef8941203eb350dcc9e9fb`.
RadLab checkpoints are April 1, 2022; crew checkpoints January 10, 2026; all UTC.

For B05, use `POST /api/v1/runs/{run_id}/observations` and
`GET /api/v1/runs/{run_id}/observations?as_of=2026-01-10T09:00:00Z`.
Valid example body:
`{"submission_id":"acceptance-b05-1","observed_at":"2026-01-10T09:00:00Z","entries":[{"source_id":"crew_sleep_log","metric":"sleep_duration","value":420,"unit":"min"}]}`.
Use only in a separate test run. At 09:00, seeded history should have 13 rows
(eight sleep and five baseline reactions), even though the state envelope references
only eight. At 09:01, seeded history has 14. Check history before/after retries.

**Mode gate:** New empty runs currently say **Fixture preview**, retain the example's
clock and disable replay buttons. Do not relabel those screens **Integrated run**.
After HZ-11, verify `X-Data-Mode: integrated`, requested/returned clock equality and
canonical values/history; the header alone can also occur for an unseeded run after
one submission. `/?gallery` is a visual preview with fake callbacks.

**Label review:** paths above are sourced from `frontend/src/dashboard/Dashboard.tsx`,
`frontend/src/shell/replay.ts`, `frontend/src/ui/format.ts` and the check-in README
at the reviewed SHA. Rendered confirmation is **Not run**. Preserve **Historical NASA
telemetry**, **Synthetic crew scenario**, **Recorded on this device**, **Why? Evidence**,
**Supporting evidence**, **Conflicting evidence**, **Missing inputs**, **Source history**.
Say “detector readings,” “gap cause unknown,” and “prototype settings.”
