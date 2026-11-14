"""Regenerate states.json for the static gallery.

Run from the repository root:  python frontend/src/gallery/generate_states.py

Engine states come from backend.engine.evaluate with the same explicitly synthetic
inputs the engine tests use (tests/engine/test_engine.py). Detector rows here are
SYNTHETIC test rows, not NASA archive data. The two contract examples are copied
verbatim. "Hand-edited" states exercise UI edge cases the engine does not emit
(conflicting source, missing evidence reference, long text) and say so in their label.
"""

from copy import deepcopy
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT))

from backend.engine import evaluate  # noqa: E402

POLICY = json.loads((ROOT / "rules/demo-v1.json").read_text(encoding="utf-8"))
EXAMPLE_A = json.loads((ROOT / "contracts/examples/radlab-stale.json").read_text(encoding="utf-8"))
EXAMPLE_B = json.loads(
    (ROOT / "contracts/examples/sleep-vigilance-missing.json").read_text(encoding="utf-8")
)


def detector(identifier, time, source="DosTel1", value=1.0, unit="µGy/h"):
    return {
        "id": identifier, "subject_id": None, "metric": "absorbed_dose_rate",
        "value": value, "unit": unit, "observed_at": "2022-04-01T" + time + "Z",
        "source_id": source, "provenance": "SYNTHETIC",
    }


def reaction(identifier, time, value, profile="seeded-demo", provenance="SYNTHETIC"):
    return {
        "id": identifier, "subject_id": "crew-demo-1", "metric": "reaction_time",
        "value": value, "unit": "ms", "observed_at": time,
        "source_id": "reaction_task", "provenance": provenance,
        "metadata": {"task_version": "demo-rt-v1", "input_profile": profile,
                     "trial_count": 5, "false_starts": 0, "completed": True},
    }


def crew(current=None):
    rows = deepcopy(EXAMPLE_B["observations"])
    for index, value in enumerate([245, 250, 255, 248, 252], 1):
        rows.append(reaction(f"base-reaction-{index}", f"2026-01-0{index}T09:00:00Z", value))
    if current is not None:
        rows.append(current)
    return rows


def radlab(rows, time):
    return evaluate("radlab_stale", "gallery", "2022-04-01T" + time + "Z", rows,
                    POLICY["resources"], POLICY)


def behavioral(rows, time="2026-01-10T09:01:00Z", resources=None):
    return evaluate("sleep_vigilance", "gallery", time, rows,
                    resources or POLICY["resources"], POLICY)


recovery = [detector("before", "23:12:25"), detector("after", "23:29:00"),
            detector("other", "23:20:00", "DosTel2"), detector("other-new", "23:30:00", "DosTel2")]

edge = deepcopy(EXAMPLE_A)
edge["sources"][1]["state"] = "conflicting"
edge["sources"][1]["reason_code"] = "conflicting_observations"
edge["sources"][0]["last_observation_id"] = "d1-not-returned"
edge["assessments"][0]["supporting_evidence"][0]["observation_ids"] = ["d1-not-returned"]
edge["assessments"][0]["supporting_evidence"][1]["detail"] = (
    "DosTel2 reported at the current replay time. " * 6
).strip()
edge["assessments"][0]["conflicting_evidence"] = [{
    "code": "conflicting_observations",
    "observation_ids": ["d2-232000"],
    "detail": "Placeholder conflicting entry. The contract reserves this state but defines no conflict rule.",
}]

STATES = [
    ("radlab", "Example A · DosTel1 stale 455 s, DosTel2 current 0 s, open incident",
     "contract example", EXAMPLE_A),
    ("radlab", "23:12:25 · both current, age 0 s", "engine, synthetic rows",
     radlab([detector("d1", "23:12:25"), detector("d2", "23:12:25", "DosTel2")], "23:12:25")),
    ("radlab", "23:17:26 · both stale at 301 s, incidents open", "engine, synthetic rows",
     radlab([detector("d1", "23:12:25"), detector("d2", "23:12:25", "DosTel2")], "23:17:26")),
    ("radlab", "23:30:00 · recovered, one resolved incident", "engine, synthetic rows",
     radlab(recovery, "23:30:00")),
    ("radlab", "Missing reading · DosTel1 has no reading", "engine, synthetic rows",
     radlab([detector("d2", "23:20:00", "DosTel2")], "23:20:00")),
    ("radlab", "Invalid reading · wrong unit on DosTel1", "engine, synthetic rows",
     radlab([detector("bad", "23:19:00", unit="mGy/h"), detector("d2", "23:20:00", "DosTel2")],
            "23:20:00")),
    ("radlab", "Edge cases · conflicting source, missing evidence reference, long text",
     "hand-edited test props", edge),
    ("sleep_vigilance", "Example B · Vigilance data missing at 09:00", "contract example", EXAMPLE_B),
    ("sleep_vigilance", "09:01 · Sleep and vigilance change (watch)", "engine, synthetic fixture rows",
     behavioral(crew(reaction("reaction-10", "2026-01-10T09:01:00Z", 310)))),
    ("sleep_vigilance", "09:01 · Demo pattern not observed (270 ms)", "engine, synthetic fixture rows",
     behavioral(crew(reaction("reaction-10", "2026-01-10T09:01:00Z", 270)))),
    ("sleep_vigilance", "09:01 · Current but incomparable browser result", "engine, synthetic + device rows",
     behavioral(crew(reaction("browser-1", "2026-01-10T09:01:00Z", 320,
                              profile="browser-keyboard", provenance="LIVE_MEASURED")))),
    ("sleep_vigilance", "09:00 · Reaction check unavailable, review fallback", "engine, resource disabled",
     behavioral(crew(), "2026-01-10T09:00:00Z", {"local_reaction_task": False})),
]

out = [
    {"id": f"state-{index}", "scenario_id": scenario, "label": label, "origin": origin, "state": state}
    for index, (scenario, label, origin, state) in enumerate(STATES, 1)
]
Path(__file__).with_name("states.json").write_text(
    json.dumps(out, ensure_ascii=False, indent=1) + "\n", encoding="utf-8"
)
print(f"wrote {len(out)} states")
