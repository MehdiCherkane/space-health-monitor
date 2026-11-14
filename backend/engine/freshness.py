"""Per-detector freshness and incident history at an explicit replay time."""

from datetime import timedelta

from .selection import action, assessment, evidence, iso, numeric, source_status, timestamp


def evaluate_freshness(rows, as_of, config):
    sources, supporting, incidents, missing = [], [], [], []
    window = config["current_through_seconds"]
    for source_id in config["sources"]:
        stream = [row for row in rows if row["source_id"] == source_id
                  and row["metric"] == config["metric"] and row["subject_id"] is None]
        valid = [row for row in stream if numeric(row, config["unit"], minimum=0)]
        last = stream[-1] if stream else None
        if last is None:
            state, reason = "missing", "no_eligible_observation"
            missing.append(source_id)
        elif not numeric(last, config["unit"], minimum=0):
            state, reason = "invalid", "invalid_observation"
            missing.append(source_id)
            supporting.append(evidence("invalid_observation", [last],
                                       f"{source_id} has an unusable reading."))
        else:
            age = int((as_of - timestamp(last["observed_at"])).total_seconds())
            state = "current" if age <= window else "stale"
            reason = "within_demo_window" if state == "current" else "older_than_demo_window"
            if state == "stale":
                minutes, seconds = divmod(age, 60)
                detail = f"{source_id} last reported {minutes} min {seconds} s ago."
                code = "source_age_exceeds_window"
            else:
                detail = (f"{source_id} reported at the current replay time." if age == 0
                          else f"{source_id} last reported {age} s ago.")
                code = "other_source_current"
            supporting.append(evidence(code, [last], detail))
        sources.append(source_status(source_id, config["metric"], state, reason, last, as_of))

        # Collapse simultaneous valid readings using the deterministic ID tie-break.
        by_time = {row["observed_at"]: row for row in valid}
        history = list(by_time.values())
        for index, previous in enumerate(history):
            opened = timestamp(previous["observed_at"]) + timedelta(seconds=window + 1)
            following = history[index + 1] if index + 1 < len(history) else None
            closed = timestamp(following["observed_at"]) if following else None
            if opened > as_of or (closed is not None and closed <= opened):
                continue
            incidents.append({
                "id": f"stale-{source_id}-{previous['id']}", "source_id": source_id,
                "state": "resolved" if closed else "open", "opened_at": iso(opened),
                "closed_at": iso(closed) if closed else None,
                "last_observation_id": previous["id"],
            })

    state = "insufficient_data" if missing else (
        "watch" if any(source["state"] == "stale" for source in sources) else "observed")
    title = " · ".join(f"{source['source_id']} {source['state']}" for source in sources)
    result = assessment(config, state, title, supporting, missing, ["view_source_history"])
    incidents.sort(key=lambda item: (item["opened_at"], item["id"]))
    return sources, [result], [action("view_source_history", "Review source history")], incidents
