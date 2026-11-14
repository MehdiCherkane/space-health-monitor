"""Engine checks use contract examples and explicitly synthetic in-memory variants.

No historical CSV is bundled here. This is not verification of the NASA archive.
"""

from copy import deepcopy
import json
from pathlib import Path
import random
import unittest

from backend.engine import evaluate
from backend.engine.selection import timestamp, visible_observations


ROOT = Path(__file__).resolve().parents[2]


def load(relative):
    return json.loads((ROOT / relative).read_text(encoding="utf-8"))


def crew_fixture():
    """Test-only IDs; production IDs are fixed by contract D2 (`base-reaction-*`, `reaction-10`)."""
    rows = deepcopy(load("contracts/examples/sleep-vigilance-missing.json")["observations"])
    for row in rows:
        row["provenance"] = "SYNTHETIC"
    for index, value in enumerate([245, 250, 255, 248, 252], 1):
        rows.append(reaction_row(f"test-base-rt-{index}", f"2026-01-0{index}T09:00:00Z", value))
    rows.append(reaction_row("test-current-rt", "2026-01-10T09:01:00Z", 310))
    return rows


def reaction_row(identifier, time, value, profile="seeded-demo"):
    return {
        "id": identifier, "subject_id": "crew-demo-1", "metric": "reaction_time",
        "value": value, "unit": "ms", "observed_at": time,
        "source_id": "reaction_task", "provenance": "SYNTHETIC",
        "metadata": {"task_version": "demo-rt-v1", "input_profile": profile,
                     "trial_count": 5, "false_starts": 0, "completed": True},
    }


def detector(identifier, time, source="DosTel1", value=1.0):
    return {
        "id": identifier, "subject_id": None, "metric": "absorbed_dose_rate",
        "value": value, "unit": "µGy/h", "observed_at": "2022-04-01T" + time + "Z",
        "source_id": source, "provenance": "SYNTHETIC",
    }


class EngineCase(unittest.TestCase):
    def setUp(self):
        self.policy = load("rules/demo-v1.json")
        self.resources = deepcopy(self.policy["resources"])

    def evaluate(self, rows, time="2026-01-10T09:01:00Z", scenario="sleep_vigilance", run="test-run"):
        return evaluate(scenario, run, time, rows, self.resources, self.policy)

    def radlab(self, rows, time="23:20:00"):
        return self.evaluate(rows, "2022-04-01T" + time + "Z", "radlab_stale")

    def assert_references(self, state):
        rows = {row["id"]: row for row in state["observations"]}
        self.assertEqual(len(rows), len(state["observations"]))
        references = {source["last_observation_id"] for source in state["sources"]}
        references.update(item["last_observation_id"] for item in state["incidents"])
        for assessment in state["assessments"]:
            for evidence in assessment["supporting_evidence"] + assessment["conflicting_evidence"]:
                references.update(evidence["observation_ids"])
        references.discard(None)
        self.assertEqual(references, set(rows))
        self.assertTrue(all(timestamp(row["observed_at"]) <= timestamp(state["as_of"])
                            for row in rows.values()))
        json.dumps(state, allow_nan=False)


class FreshnessTests(EngineCase):
    def test_exact_example_a(self):
        example = load("contracts/examples/radlab-stale.json")
        actual = self.evaluate(example["observations"], example["as_of"], "radlab_stale", example["run_id"])
        self.assertEqual(actual, example)
        self.assert_references(actual)

    def test_a02_exact_300_301_boundary(self):
        rows = [detector("d1", "23:12:25"), detector("d2", "23:12:25", "DosTel2")]
        for time, state, count in [("23:12:25", "current", 0), ("23:17:25", "current", 0),
                                   ("23:17:26", "stale", 2)]:
            with self.subTest(time=time):
                result = self.radlab(rows, time)
                self.assertEqual([item["state"] for item in result["sources"]], [state, state])
                self.assertEqual(len(result["incidents"]), count)

    def test_fresh_reading_on_opening_second_prevents_incident(self):
        rows = [detector("before", "23:12:25"), detector("after", "23:17:26")]
        state = self.radlab(rows, "23:17:26")
        self.assertEqual(state["sources"][0]["state"], "current")
        self.assertEqual(state["sources"][0]["age_seconds"], 0)
        self.assertEqual(state["incidents"], [])

    def test_a03_a04_recovery_rewind_and_stable_identity(self):
        # Synthetic recovery at 23:29; the actual CSV's recovery second is unverified.
        rows = [detector("before", "23:12:25"), detector("after", "23:29:00"),
                detector("other", "23:20:00", "DosTel2"), detector("other-new", "23:30:00", "DosTel2")]
        early = self.radlab(rows)
        self.assertEqual(len(early["incidents"]), 1)
        self.assertEqual(early["incidents"][0]["state"], "open")
        self.assertIsNone(early["incidents"][0]["closed_at"])
        late = self.radlab(rows, "23:30:00")
        first = next(item for item in late["incidents"] if item["source_id"] == "DosTel1")
        self.assertEqual(first["id"], early["incidents"][0]["id"])
        self.assertEqual(first["closed_at"], "2022-04-01T23:29:00Z")
        self.assertEqual([item["state"] for item in late["sources"]], ["current", "current"])
        self.assertEqual(self.radlab(rows), early)
        self.assert_references(early)
        self.assert_references(late)

    def test_multiple_gaps_keep_preceding_readings(self):
        rows = [detector("a", "23:00:00"), detector("b", "23:10:00"), detector("c", "23:20:00")]
        state = self.radlab(rows, "23:30:00")
        self.assertEqual([item["state"] for item in state["incidents"]], ["resolved", "resolved", "open"])
        self.assertEqual([item["last_observation_id"] for item in state["incidents"]], ["a", "b", "c"])
        self.assert_references(state)

    def test_equal_time_tie_break_and_input_order(self):
        rows = [detector("z", "23:12:25"), detector("a", "23:12:25")]
        result = self.radlab(rows)
        self.assertEqual(result["sources"][0]["last_observation_id"], "z")
        self.assertEqual(result["incidents"][0]["id"], "stale-DosTel1-z")
        self.assertEqual(len(result["incidents"]), 1)
        self.assertEqual(result, self.radlab(list(reversed(rows))))

    def test_no_readings_mean_missing_without_fabricated_age(self):
        result = self.radlab([])
        self.assertEqual(result["assessments"][0]["state"], "insufficient_data")
        self.assertEqual(result["incidents"], [])
        for source in result["sources"]:
            self.assertEqual(source["state"], "missing")
            self.assertIsNone(source["last_observation_id"])
            self.assertIsNone(source["age_seconds"])

    def test_future_readings_do_not_affect_state(self):
        rows = [detector("past", "23:12:25")]
        self.assertEqual(self.radlab(rows), self.radlab(rows + [detector("future", "23:21:00")]))

    def test_invalid_latest_reading_is_not_reported_current(self):
        rows = [detector("good", "23:12:25"), detector("bad", "23:20:00", value=-1)]
        result = self.radlab(rows)
        self.assertEqual(result["sources"][0]["state"], "invalid")
        self.assertEqual(result["assessments"][0]["state"], "insufficient_data")
        self.assertEqual(result["incidents"][0]["state"], "open")
        self.assert_references(result)

    def test_wrong_unit_and_subject_are_not_usable_detector_data(self):
        wrong_unit = detector("wrong-unit", "23:20:00")
        wrong_unit["unit"] = "mSv"
        wrong_subject = detector("wrong-subject", "23:20:00", "DosTel2")
        wrong_subject["subject_id"] = "crew-demo-1"
        result = self.radlab([wrong_unit, wrong_subject])
        self.assertEqual([item["state"] for item in result["sources"]], ["invalid", "missing"])

    def test_policy_controls_freshness_and_incident_opening(self):
        self.policy["scenarios"]["radlab_stale"]["current_through_seconds"] = 600
        rows = [detector("a", "23:12:25")]
        self.assertEqual(self.radlab(rows)["sources"][0]["state"], "current")
        result = self.radlab(rows, "23:22:26")
        self.assertEqual(result["incidents"][0]["opened_at"], "2022-04-01T23:22:26Z")


class BehavioralTests(EngineCase):
    def test_exact_example_b_from_full_fixture(self):
        example = load("contracts/examples/sleep-vigilance-missing.json")
        state = self.evaluate(crew_fixture(), example["as_of"], run=example["run_id"])
        self.assertEqual(state, example)
        self.assert_references(state)

    def test_b02_seeded_watch_has_both_baseline_references(self):
        state = self.evaluate(crew_fixture())
        item = state["assessments"][0]
        self.assertEqual(item["state"], "watch")
        self.assertEqual(item["title"], "Sleep and vigilance change")
        self.assertEqual(item["missing_inputs"], [])
        self.assertEqual([row["baseline_id"] for row in item["supporting_evidence"]],
                         ["crew-demo-sleep-v1", "crew-demo-reaction-v1"])
        self.assertIn("+24.0%", item["supporting_evidence"][1]["detail"])
        self.assertEqual(len(state["observations"]), 14)
        self.assert_references(state)

    def test_b03_comparable_270_is_observed(self):
        rows = crew_fixture()
        rows[-1]["value"] = 270
        self.assertEqual(self.evaluate(rows)["assessments"][0]["state"], "observed")

    def test_sleep_boundary_60_vs_59_minutes(self):
        for value, expected in [(390, "watch"), (391, "observed")]:
            with self.subTest(value=value):
                rows = crew_fixture()
                for row in rows:
                    if row["id"] in ("sleep-08", "sleep-09"):
                        row["value"] = value
                self.assertEqual(self.evaluate(rows)["assessments"][0]["state"], expected)

    def test_reaction_boundary_20_vs_19_9_percent(self):
        for value, expected in [(300, "watch"), (299.75, "observed")]:
            with self.subTest(value=value):
                rows = crew_fixture()
                rows[-1]["value"] = value
                self.assertEqual(self.evaluate(rows)["assessments"][0]["state"], expected)

    def test_both_conditions_are_required(self):
        rows = crew_fixture()
        for row in rows:
            if row["id"] in ("sleep-08", "sleep-09", "sleep-10"):
                row["value"] = 450
        self.assertEqual(self.evaluate(rows)["assessments"][0]["state"], "observed")

    def test_missing_required_night_is_insufficient(self):
        rows = [row for row in crew_fixture() if row["id"] != "sleep-09"]
        state = self.evaluate(rows)
        self.assertEqual(state["assessments"][0]["state"], "insufficient_data")
        self.assertIn("sleep_duration", state["assessments"][0]["missing_inputs"])
        self.assert_references(state)

    def test_missing_each_baseline_stays_insufficient(self):
        for identifier, key in [("base-sleep-3", "sleep_baseline"), ("test-base-rt-2", "reaction_baseline")]:
            with self.subTest(identifier=identifier):
                state = self.evaluate([row for row in crew_fixture() if row["id"] != identifier])
                self.assertEqual(state["assessments"][0]["state"], "insufficient_data")
                self.assertIn(key, state["assessments"][0]["missing_inputs"])
                self.assert_references(state)

    def test_incomparable_result_is_retained_but_not_compared(self):
        for key, value in [("input_profile", "browser-keyboard"), ("task_version", "other-version")]:
            with self.subTest(key=key):
                rows = crew_fixture()
                rows[-1]["metadata"][key] = value
                rows[-1]["provenance"] = "LIVE_MEASURED"
                rows[-1]["metadata"]["captured_at"] = "2026-11-14T14:00:00Z"
                state = self.evaluate(rows)
                self.assertEqual(state["assessments"][0]["state"], "insufficient_data")
                self.assertEqual(state["sources"][1]["state"], "current")
                self.assertEqual(state["sources"][1]["reason_code"], "incomparable_reaction_result")
                current = next(row for row in state["observations"] if row["id"] == "test-current-rt")
                self.assertEqual(current, rows[-1])
                self.assert_references(state)

    def test_latest_incomparable_result_does_not_fall_back_to_old_sample(self):
        rows = crew_fixture()
        rows.append(reaction_row("new-live", "2026-01-10T09:02:00Z", 270, "browser-keyboard"))
        state = self.evaluate(rows, "2026-01-10T09:02:00Z")
        self.assertEqual(state["sources"][1]["last_observation_id"], "new-live")
        self.assertEqual(state["assessments"][0]["state"], "insufficient_data")

    def test_incomparable_baseline_is_missing(self):
        rows = crew_fixture()
        rows[8]["metadata"]["input_profile"] = "browser-keyboard"
        self.assertIn("reaction_baseline", self.evaluate(rows)["assessments"][0]["missing_inputs"])

    def test_b04_unavailable_resource_keeps_pending_and_fallback(self):
        for resources in [{}, {"local_reaction_task": False}]:
            with self.subTest(resources=resources):
                self.resources = resources
                state = self.evaluate(crew_fixture(), "2026-01-10T09:00:00Z")
                self.assertEqual(state["assessments"][0]["state"], "insufficient_data")
                self.assertEqual(state["assessments"][0]["missing_inputs"], ["reaction_time"])
                self.assertFalse(state["actions"][0]["available"])
                self.assertEqual(state["actions"][0]["unavailable_reason"], "Reaction check unavailable")
                self.assertEqual(state["actions"][1]["id"], "review_available_inputs")
                self.assertTrue(state["actions"][1]["available"])

    def test_resource_unavailable_does_not_erase_existing_evidence(self):
        self.resources = {"local_reaction_task": False}
        self.assertEqual(self.evaluate(crew_fixture())["assessments"][0]["state"], "watch")

    def test_interrupted_task_creates_no_current_result(self):
        rows = crew_fixture()
        rows[-1]["metadata"]["completed"] = False
        state = self.evaluate(rows)
        self.assertEqual(state["sources"][1]["state"], "missing")
        self.assertNotIn("test-current-rt", [row["id"] for row in state["observations"]])

    def test_invalid_completed_reaction_cannot_trigger_watch(self):
        for key, value in [("trial_count", 0), ("trial_count", True), ("false_starts", -1)]:
            with self.subTest(key=key, value=value):
                rows = crew_fixture()
                rows[-1]["metadata"][key] = value
                state = self.evaluate(rows)
                self.assertEqual(state["sources"][1]["state"], "invalid")
                self.assertEqual(state["assessments"][0]["state"], "insufficient_data")

    def test_zero_sleep_is_real_and_latest_valid_value_wins(self):
        rows = crew_fixture()
        latest = deepcopy(next(row for row in rows if row["id"] == "sleep-10"))
        latest.update(id="later-sleep", value=0, observed_at="2026-01-10T08:00:00Z")
        invalid = deepcopy(latest)
        invalid.update(id="invalid-sleep", value=1441, observed_at="2026-01-10T08:30:00Z")
        state = self.evaluate(rows + [latest, invalid])
        self.assertEqual(state["sources"][0]["last_observation_id"], "later-sleep")
        self.assertEqual(state["assessments"][0]["state"], "watch")

    def test_tie_break_current_reaction(self):
        rows = crew_fixture()
        other = deepcopy(rows[-1])
        other.update(id="z-current-rt", value=270)
        state = self.evaluate(rows + [other])
        self.assertEqual(state["sources"][1]["last_observation_id"], "z-current-rt")
        self.assertEqual(state["assessments"][0]["state"], "observed")

    def test_prior_session_result_is_not_current(self):
        rows = crew_fixture()
        rows[-1]["observed_at"] = "2026-01-10T08:59:59Z"
        state = self.evaluate(rows)
        self.assertIsNone(state["sources"][1]["last_observation_id"])
        self.assertEqual(state["assessments"][0]["state"], "insufficient_data")

    def test_session_end_is_inclusive(self):
        rows = crew_fixture()
        rows[-1]["observed_at"] = "2026-01-10T10:00:00Z"
        state = self.evaluate(rows, "2026-01-10T10:00:00Z")
        self.assertEqual(state["assessments"][0]["state"], "watch")

    def test_other_subject_and_optional_self_reports_cannot_change_assessment(self):
        rows = crew_fixture()
        original = self.evaluate(rows)
        foreign = deepcopy(rows[-1])
        foreign.update(id="foreign", subject_id="other-crew", value=1000)
        extras = [foreign]
        for metric in ("fatigue", "mood", "stress"):
            extras.append({"id": metric, "subject_id": "crew-demo-1", "metric": metric,
                           "value": 0, "unit": "score_0_10", "observed_at": "2026-01-10T09:01:00Z",
                           "source_id": "crew_self_report", "provenance": "SYNTHETIC"})
        self.assertEqual(original, self.evaluate(rows + extras))
        self.assertEqual(extras[-1]["value"], 0)

    def test_later_sleep_does_not_change_fixed_baseline(self):
        rows = crew_fixture()
        later = deepcopy(rows[0])
        later.update(id="extra-baseline", observed_at="2026-01-01T08:00:00Z", value=1000)
        self.assertEqual(self.evaluate(rows), self.evaluate(rows + [later]))

    def test_policy_parameters_change_behavior(self):
        config = self.policy["scenarios"]["sleep_vigilance"]
        config["reaction"]["slower_by_percent"] = 25
        self.assertEqual(self.evaluate(crew_fixture())["assessments"][0]["state"], "observed")
        config["reaction"]["slower_by_percent"] = 20
        config["sleep"]["short_by_minutes"] = 81
        self.assertEqual(self.evaluate(crew_fixture())["assessments"][0]["state"], "observed")

    def test_empty_observations_do_not_invent_baselines(self):
        result = self.evaluate([])
        self.assertEqual(result["assessments"][0]["state"], "insufficient_data")
        self.assertEqual(set(result["assessments"][0]["missing_inputs"]),
                         {"sleep_baseline", "sleep_duration", "reaction_baseline", "reaction_time"})
        self.assertEqual(result["observations"], [])
        self.assert_references(result)


class DeterminismAndBoundaryTests(EngineCase):
    def test_repetition_permutation_and_no_input_or_output_aliasing(self):
        rows = crew_fixture()
        before = deepcopy((rows, self.resources, self.policy))
        result = self.evaluate(rows)
        for seed in range(5):
            shuffled = deepcopy(rows)
            random.Random(seed).shuffle(shuffled)
            self.assertEqual(result, self.evaluate(shuffled))
        self.assertEqual(before, (rows, self.resources, self.policy))
        result["observations"][0]["value"] = 999
        self.assertEqual(before, (rows, self.resources, self.policy))

    def test_rewind_excludes_sample_and_new_capture(self):
        rows = crew_fixture()
        missing = self.evaluate(rows, "2026-01-10T09:00:00Z")
        self.assertEqual(self.evaluate(rows)["assessments"][0]["state"], "watch")
        rows.append(reaction_row("late", "2026-01-10T09:02:00Z", 275, "browser-keyboard"))
        self.assertEqual(missing, self.evaluate(rows, "2026-01-10T09:00:00Z"))

    def test_as_of_requires_canonical_utc_whole_seconds(self):
        for value in [None, "2026-01-10T09:00:00", "2026-01-10T10:00:00+01:00",
                      "2026-01-10T09:00:00.001Z", "not-a-time"]:
            with self.subTest(value=value), self.assertRaises(ValueError):
                self.evaluate([], value)

    def test_clock_range_and_unknown_scenario(self):
        for time in ["2026-01-10T08:59:59Z", "2026-01-10T10:00:01Z"]:
            with self.subTest(time=time), self.assertRaises(ValueError):
                self.evaluate([], time)
        with self.assertRaises(ValueError):
            self.evaluate([], scenario="other")

    def test_invalid_run_and_policy_version(self):
        with self.assertRaises(ValueError):
            self.evaluate([], run="")
        self.policy["schema_version"] = 2
        with self.assertRaises(ValueError):
            self.evaluate([])

    def test_duplicate_ids_are_rejected(self):
        rows = crew_fixture()
        with self.assertRaisesRegex(ValueError, "Duplicate observation ID"):
            self.evaluate(rows + [deepcopy(rows[0])])

    def test_nonfinite_visible_input_is_rejected_without_fabricating_value(self):
        for value in [float("nan"), float("inf"), float("-inf")]:
            with self.subTest(value=value), self.assertRaises(ValueError):
                rows = crew_fixture()
                rows[-1]["value"] = value
                self.evaluate(rows)

    def test_future_bad_value_does_not_affect_earlier_state(self):
        rows = crew_fixture()
        expected = self.evaluate(rows, "2026-01-10T09:00:00Z")
        rows[-1]["value"] = float("nan")
        self.assertEqual(expected, self.evaluate(rows, "2026-01-10T09:00:00Z"))

    def test_selection_orders_equal_times_by_id(self):
        rows = [detector("z", "23:00:00"), detector("a", "23:00:00"), detector("future", "23:01:00")]
        result = visible_observations(rows, timestamp("2022-04-01T23:00:00Z"))
        self.assertEqual([row["id"] for row in result], ["a", "z"])


if __name__ == "__main__":
    unittest.main()
