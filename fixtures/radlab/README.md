# Pinned historical RadLab snapshot

File: `iss-radlab-dostel-2022-04-01.csv` (10,963 bytes).
SHA-256: `be73563615dbbd28b0b8548a0b9ba40c2059f3dc68ef8941203eb350dcc9e9fb`.

El Mahdi supplied the original downloaded artifact on November 14, 2026. Its bytes
match the checksum already recorded in the approved contract and team plan. The file
is copied unchanged; `.gitattributes` disables text conversion so CRLF is preserved
across checkouts. Do not re-save/reformat it with a spreadsheet or editor.

Source context: [NASA RadLab Data API](https://visualization.osdr.nasa.gov/radlab/gui/data-api/).
This download was recovered from the user-provided artifact; it was not re-exported
from the API during verification. NASA documents `instrument_id`, `timestamp`,
`absorbed_dose_rate`, `module` and `spacecraft`, the exact column names in this file.

The snapshot contains **180 readings: 84 DosTel1 and 96 DosTel2**. All 180 lie within
the inclusive replay window `2022-04-01T23:00:00Z`–`2022-04-02T01:04:59Z`; counts refer
to this snapshot/window, not to a whole day or the complete NASA archive. Original
timestamps have no offset; the approved demo convention interprets them as UTC.
Metadata is Columbus/ISS. Absorbed dose rate is µGy/h, with null astronaut subject.
These are detector readings; they do not establish individual crew exposure.

## Verified historical checkpoints

| UTC, Apr 1, 2022 | DosTel1 | DosTel2 | Incident |
|---|---|---|---|
| 23:12:25 | current, age 0 s | current, age 145 s | none |
| 23:17:25 | current, age 300 s | current, age 98 s | none |
| 23:17:26 | stale, age 301 s | current, age 99 s | DosTel1 opens |
| 23:20:00 | stale, age 455 s, value 1.65945 | current, age 0 s, value 2.211496 | one open |
| 23:30:00 | current, age 0 s, value 7.249702 | current, age 0 s | same incident resolved |

The first DosTel1 reading after 23:12:25 really occurs at 23:30:00 in this file.
Rewind to 23:20 returns the open incident without a future closure or reading.
The cause of the gap is unknown; the 300-second freshness window is a prototype setting.

## Verification

From the repository root using the project's Python environment:

```bash
python -m backend.replay.importer
python release/verify_historical.py --api --output /tmp/astro-vital-historical.json
python -m pytest tests/replay -q
```

The first command verifies exact checksum and counts. The second checks the real
engine checkpoints and, when Hamza's seeded API is installed, runs them through
fresh SQLite-backed API runs too. Exit 0 means the requested gates passed, 1 means
failed assertions, and 2 means a missing/unverified input or integration dependency.
This command never claims X01; offline browser rehearsal is a separate acceptance gate.

Low-level `parse_radlab_csv` performs parsing without authentication of the snapshot.
Runtime historical data must enter through `import_radlab_csv` or `load_radlab_archive`,
which validate the pinned checksum and counts against the same bytes they parse.
