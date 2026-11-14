"""Selection and output helpers shared by the two demo rules."""

from datetime import datetime, timezone
from math import isfinite


def timestamp(value):
    """Require the contract's canonical UTC, whole-second representation."""
    if not isinstance(value, str):
        raise ValueError("Timestamp must be a UTC ISO string")
    try:
        parsed = datetime.fromisoformat(value)
    except ValueError as exc:
        raise ValueError("Timestamp must be a UTC ISO string") from exc
    if parsed.tzinfo != timezone.utc or iso(parsed) != value:
        raise ValueError("Timestamp must use whole-second UTC with Z")
    return parsed


def iso(value):
    return value.isoformat(timespec="seconds").replace("+00:00", "Z")


def visible_observations(observations, as_of):
    rows = [row for row in observations if timestamp(row["observed_at"]) <= as_of]
    ids = [row["id"] for row in rows]
    if any(not isinstance(item, str) or not item for item in ids):
        raise ValueError("Observation IDs must be non-empty strings")
    if len(set(ids)) != len(ids):
        raise ValueError("Duplicate observation ID")
    return sorted(rows, key=lambda row: (row["observed_at"], row["id"]))


def numeric(row, unit, minimum=None, maximum=None):
    value = row.get("value")
    if type(value) not in (int, float) or row.get("unit") != unit:
        return False
    try:
        if not isfinite(value):
            return False
    except OverflowError:
        return False
    return (minimum is None or value >= minimum) and (maximum is None or value <= maximum)


def source_status(source_id, metric, state, reason, row, as_of):
    return {
        "source_id": source_id, "metric": metric, "state": state,
        "last_observation_id": row["id"] if row else None,
        "age_seconds": int((as_of - timestamp(row["observed_at"])).total_seconds()) if row else None,
        "reason_code": reason,
    }


def evidence(code, rows, detail, baseline_id=None):
    result = {"code": code, "observation_ids": [row["id"] for row in rows], "detail": detail}
    if baseline_id is not None:
        result["baseline_id"] = baseline_id
    return result


def action(identifier, label, resources=(), available=True, reason=None):
    return {
        "id": identifier, "label": label, "required_resource_ids": list(resources),
        "available": available, "unavailable_reason": reason,
    }


def assessment(config, state, title, supporting, missing, action_ids):
    return {
        "id": config["assessment_id"], "rule_id": config["rule_id"],
        "rule_version": config["rule_version"], "state": state, "title": title,
        "supporting_evidence": supporting, "conflicting_evidence": [],
        "missing_inputs": missing, "action_ids": action_ids,
    }
