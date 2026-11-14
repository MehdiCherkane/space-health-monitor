"""Scheduled sleep/vigilance comparison against fixed synthetic baselines."""

from decimal import Decimal
from statistics import median

from .selection import action, assessment, evidence, numeric, source_status


def _sleep_valid(row, config):
    return numeric(row, config["unit"], config["minimum"], config["maximum"])


def _reaction_valid(row, config):
    metadata = row.get("metadata") or {}
    return (numeric(row, config["unit"]) and row["value"] > 0
            and metadata.get("completed") is True
            and type(metadata.get("trial_count")) is int and metadata["trial_count"] > 0
            and type(metadata.get("false_starts")) is int and metadata["false_starts"] >= 0
            and isinstance(metadata.get("task_version"), str)
            and isinstance(metadata.get("input_profile"), str))


def _comparable(row, config):
    metadata = row.get("metadata") or {}
    return (metadata.get("task_version") == config["task_version"]
            and metadata.get("input_profile") == config["input_profile"])


def _baseline(rows, config, valid):
    # Exact configured seed timestamps keep later daily submissions out of the baseline.
    result = []
    for slot in config["baseline_slots"]:
        candidates = [row for row in rows if row["observed_at"] == slot
                      and row["provenance"] == "SYNTHETIC" and valid(row)]
        if candidates:
            result.append(candidates[-1])
    return result


def evaluate_behavioral(rows, as_of, resources, config):
    sleep, reaction = config["sleep"], config["reaction"]
    crew = [row for row in rows if row["subject_id"] == config["subject_id"]]
    sleeps = [row for row in crew if row["source_id"] == sleep["source_id"]
              and row["metric"] == sleep["metric"]]
    reactions = [row for row in crew if row["source_id"] == reaction["source_id"]
                 and row["metric"] == reaction["metric"]]
    sleep_base = _baseline(sleeps, sleep, lambda row: _sleep_valid(row, sleep))
    reaction_base = _baseline(reactions, reaction,
                              lambda row: _reaction_valid(row, reaction) and _comparable(row, reaction))
    sleep_base_complete = len(sleep_base) == len(sleep["baseline_slots"])
    reaction_base_complete = len(reaction_base) == len(reaction["baseline_slots"])

    recent, invalid_days = [], []
    for day in sleep["recent_days"]:
        candidates = [row for row in sleeps if row["observed_at"][:10] == day]
        valid = [row for row in candidates if _sleep_valid(row, sleep)]
        if valid:
            recent.append(valid[-1])
        elif candidates:
            invalid_days.append(candidates[-1])
    slots_complete = len(recent) == len(sleep["recent_days"])
    session = [row for row in reactions
               if reaction["session_start"] <= row["observed_at"] <= reaction["session_end"]
               and (row.get("metadata") or {}).get("completed") is True]
    current = session[-1] if session else None
    current_valid = current is not None and _reaction_valid(current, reaction)
    current_comparable = current_valid and _comparable(current, reaction)

    missing = []
    if not sleep_base_complete:
        missing.append("sleep_baseline")
    if not slots_complete:
        missing.append("sleep_duration")
    if not reaction_base_complete:
        missing.append("reaction_baseline")
    if not current_comparable:
        missing.append("reaction_time")

    supporting = []
    short_sleep = False
    if sleep_base_complete and slots_complete:
        baseline = median(row["value"] for row in sleep_base)
        count = sum(Decimal(str(baseline)) - Decimal(str(row["value"]))
                    >= Decimal(str(sleep["short_by_minutes"])) for row in recent)
        short_sleep = count >= sleep["required_short_nights"]
        # Preserve Example B's exact prose for the canonical values; other counts vary.
        count_text = {0: "Zero", 1: "One", 2: "Two", 3: "Three"}.get(count, str(count))
        slot_text = {3: "three"}.get(len(recent), str(len(recent)))
        detail = (f"{count_text} of the last {slot_text} logged nights were at least "
                  f"{sleep['short_by_minutes']:g} minutes below the {baseline:g}-minute demo baseline.")
        supporting.append(evidence("repeated_short_sleep" if short_sleep else "sleep_comparison",
                                   recent + sleep_base, detail, sleep["baseline_id"]))
    elif recent or sleep_base or invalid_days:
        supporting.append(evidence("sleep_inputs_incomplete", recent + invalid_days + sleep_base,
                                   "Required sleep slots or baseline inputs are missing or invalid.",
                                   sleep["baseline_id"]))

    slower = False
    if current_comparable and reaction_base_complete:
        baseline = median(row["value"] for row in reaction_base)
        change = (Decimal(str(current["value"])) - Decimal(str(baseline))) * 100
        slower = change >= Decimal(str(baseline)) * Decimal(str(reaction["slower_by_percent"]))
        percent = change / Decimal(str(baseline))
        detail = (f"Current reaction time is {current['value']:g} ms against the "
                  f"{baseline:g} ms demo baseline ({percent:+.1f}%).")
        supporting.append(evidence("slower_reaction" if slower else "reaction_comparison",
                                   [current] + reaction_base, detail, reaction["baseline_id"]))
    elif current is not None:
        code = ("invalid_observation" if not current_valid else
                "reaction_comparability_unknown" if not current_comparable else
                "reaction_baseline_incomplete")
        detail = {
            "invalid_observation": "The completed reaction result is unusable for comparison.",
            "reaction_comparability_unknown": "Task version or input profile differs from the demo baseline; comparability is unknown.",
            "reaction_baseline_incomplete": "The current reaction result is present but its comparable baseline is incomplete.",
        }[code]
        supporting.append(evidence(code, [current] + reaction_base, detail, reaction["baseline_id"]))
    elif not reaction_base_complete and reaction_base:
        supporting.append(evidence("reaction_baseline_incomplete", reaction_base,
                                   "The comparable reaction baseline is incomplete.", reaction["baseline_id"]))

    if slots_complete:
        sleep_state, sleep_reason = "current", "scheduled_input_received"
        sleep_last = recent[-1]
    elif invalid_days:
        sleep_state, sleep_reason = "invalid", "invalid_observation"
        sleep_last = invalid_days[-1]
    else:
        sleep_state, sleep_reason = "missing", "scheduled_input_missing"
        sleep_last = recent[-1] if recent else None
    if current is None:
        reaction_state, reaction_reason = "missing", "current_session_missing"
    elif not current_valid:
        reaction_state, reaction_reason = "invalid", "invalid_observation"
    elif not current_comparable:
        reaction_state, reaction_reason = "current", "incomparable_reaction_result"
    else:
        reaction_state, reaction_reason = "current", "scheduled_input_received"
    sources = [
        source_status(sleep["source_id"], sleep["metric"], sleep_state, sleep_reason, sleep_last, as_of),
        source_status(reaction["source_id"], reaction["metric"], reaction_state, reaction_reason, current, as_of),
    ]

    state = "insufficient_data" if missing else "watch" if short_sleep and slower else "observed"
    title = ("Vigilance data missing" if missing == ["reaction_time"] and current is None else
             "Comparison incomplete" if missing else
             "Sleep and vigilance change" if state == "watch" else "Demo pattern not observed")
    if "reaction_time" in missing:
        resource = reaction["resource_id"]
        available = resources.get(resource) is True
        actions = [action("start_reaction_check", "Run reaction check", [resource], available,
                          None if available else "Reaction check unavailable")]
        if not available:
            actions.append(action("review_available_inputs", "Review available inputs"))
    else:
        actions = [action("review_available_inputs", "Review available inputs")]
    result = assessment(config, state, title, supporting, missing, [item["id"] for item in actions])
    return sources, [result], actions, []
