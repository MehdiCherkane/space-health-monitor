"""Public pure evaluation boundary; adapters own loading and persistence."""

from copy import deepcopy
import json

from .behavioral import evaluate_behavioral
from .freshness import evaluate_freshness
from .selection import timestamp, visible_observations


def evaluate(scenario_id, run_id, as_of, observations, resources, policy):
    """Return only the state and evidence visible at as_of, without mutating inputs.

    Inputs use contracts/v1.md's dictionaries/lists; adapters validate their structure.
    Invalid scenario/time/identity and nonfinite data raise ValueError. Missing
    measurements are ordinary insufficient_data results. No data is loaded here.
    """
    if scenario_id not in ("radlab_stale", "sleep_vigilance"):
        raise ValueError("Unknown scenario")
    if not isinstance(run_id, str) or not run_id:
        raise ValueError("run_id must be a non-empty string")
    if policy["schema_version"] != 1:
        raise ValueError("Unsupported policy schema version")
    config = policy["scenarios"][scenario_id]
    clock = timestamp(as_of)
    if not timestamp(config["range_start"]) <= clock <= timestamp(config["range_end"]):
        raise ValueError("as_of is outside the scenario range")
    rows = visible_observations(observations, clock)
    # Preserve the evidence exactly; reject non-JSON inputs instead of fabricating values.
    try:
        json.dumps(rows, allow_nan=False)
    except (TypeError, ValueError) as exc:
        raise ValueError("Visible observations must be finite JSON data") from exc
    if scenario_id == "radlab_stale":
        sources, assessments, actions, incidents = evaluate_freshness(rows, clock, config)
    else:
        sources, assessments, actions, incidents = evaluate_behavioral(rows, clock, resources, config)

    referenced = {source["last_observation_id"] for source in sources}
    referenced.update(incident["last_observation_id"] for incident in incidents)
    for item in assessments:
        for entry in item["supporting_evidence"] + item["conflicting_evidence"]:
            referenced.update(entry["observation_ids"])
    # Unreferenced baseline/history/self-report records remain in the caller's history.
    result = {
        "schema_version": 1, "run_id": run_id, "scenario_id": scenario_id, "as_of": as_of,
        "sources": sources, "observations": [row for row in rows if row["id"] in referenced],
        "assessments": assessments, "actions": actions, "incidents": incidents,
    }
    return deepcopy(result)
