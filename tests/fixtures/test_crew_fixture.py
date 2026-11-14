"""Canonical disk fixture against contract values and the real evaluator.

Variants are isolated copies; no runtime, database, or network dependencies.
"""

from copy import deepcopy
import json
from pathlib import Path
from statistics import median
import unittest

from backend.engine import evaluate


ROOT = Path(__file__).resolve().parents[2]


def load(path):
    return json.loads((ROOT / path).read_text(encoding="utf-8"))


class CrewFixtureTests(unittest.TestCase):
    def setUp(self):
        self.fixture = load("fixtures/crew/sleep-vigilance.json")
        self.rows = self.fixture["observations"]
        self.by_id = {row["id"]: row for row in self.rows}
        self.policy = load("rules/demo-v1.json")

    def state(self, rows=None, time="2026-01-10T09:01:00Z", resources=None):
        result = evaluate("sleep_vigilance", "example-crew", time,
                          self.rows if rows is None else rows,
                          self.policy["resources"] if resources is None else resources,
                          self.policy)
        # All returned references resolve exactly once, and none leaks future data.
        visible = {row["id"]: row for row in result["observations"]}
        self.assertEqual(len(visible), len(result["observations"]))
        refs = {source["last_observation_id"] for source in result["sources"]}
        for assessment in result["assessments"]:
            for evidence in assessment["supporting_evidence"] + assessment["conflicting_evidence"]:
                refs.update(evidence["observation_ids"])
        refs.update(item["last_observation_id"] for item in result["incidents"])
        refs.discard(None)
        self.assertEqual(refs, set(visible))
        self.assertTrue(all(row["observed_at"] <= time for row in visible.values()))
        json.dumps(result, allow_nan=False)
        return result

    def test_d2_envelope_and_exact_fourteen_rows(self):
        self.assertEqual(set(self.fixture),
                         {"schema_version", "fixture_id", "scenario_id", "subject_id", "observations"})
        self.assertIs(type(self.fixture["schema_version"]), int)
        self.assertEqual(self.fixture["schema_version"], 1)
        self.assertEqual(self.fixture["fixture_id"], "crew-demo-sleep-vigilance-v1")
        self.assertEqual(self.fixture["scenario_id"], "sleep_vigilance")
        self.assertEqual(self.fixture["subject_id"], "crew-demo-1")
        expected = {f"base-sleep-{i}" for i in range(1, 6)}
        expected.update(f"base-reaction-{i}" for i in range(1, 6))
        expected.update(["sleep-08", "sleep-09", "sleep-10", "reaction-10"])
        self.assertEqual(len(self.rows), 14)
        self.assertEqual(set(self.by_id), expected)
        self.assertEqual(len({(r["source_id"], r["metric"], r["observed_at"])
                              for r in self.rows}), 14)
        for row in self.rows:
            self.assertEqual(row["subject_id"], "crew-demo-1")
            self.assertEqual(row["provenance"], "SYNTHETIC")

    def test_sleep_rows_match_example_b_verbatim(self):
        expected = load("contracts/examples/sleep-vigilance-missing.json")["observations"]
        actual = [row for row in self.rows if row["metric"] == "sleep_duration"]
        self.assertEqual({r["id"]: r for r in actual}, {r["id"]: r for r in expected})
        self.assertEqual([self.by_id[f"base-sleep-{i}"]["value"] for i in range(1, 6)],
                         [450, 440, 450, 460, 445])
        for day, value in [(8, 380), (9, 370), (10, 420)]:
            row = self.by_id[f"sleep-{day:02d}"]
            self.assertEqual(row["value"], value)
            self.assertEqual(row["observed_at"], f"2026-01-{day:02d}T07:00:00Z")

    def test_reaction_rows_match_d2_d3_exactly(self):
        for index, value in enumerate([245, 250, 255, 248, 252, 310], 1):
            identifier = f"base-reaction-{index}" if index < 6 else "reaction-10"
            time = f"2026-01-0{index}T09:00:00Z" if index < 6 else "2026-01-10T09:01:00Z"
            self.assertEqual(self.by_id[identifier], {
                "id": identifier, "subject_id": "crew-demo-1", "metric": "reaction_time",
                "value": value, "unit": "ms", "observed_at": time,
                "source_id": "reaction_task", "provenance": "SYNTHETIC",
                "metadata": {"task_version": "demo-rt-v1", "input_profile": "seeded-demo",
                             "trial_count": 5, "false_starts": 0, "completed": True},
            })

    def test_b01_0900_exact_contract_response_and_no_future_sample(self):
        expected = load("contracts/examples/sleep-vigilance-missing.json")
        self.assertEqual(self.state(time=expected["as_of"]), expected)

    def test_b02_0901_watch_math_and_traceable_evidence(self):
        sleep_base = median(self.by_id[f"base-sleep-{i}"]["value"] for i in range(1, 6))
        reaction_base = median(self.by_id[f"base-reaction-{i}"]["value"] for i in range(1, 6))
        self.assertEqual((sleep_base, reaction_base), (450, 250))
        self.assertEqual([sleep_base - self.by_id[i]["value"]
                          for i in ["sleep-08", "sleep-09", "sleep-10"]], [70, 80, 30])
        self.assertEqual((self.by_id["reaction-10"]["value"] - reaction_base) * 100 / reaction_base, 24)
        state = self.state()
        assessment = state["assessments"][0]
        self.assertEqual((assessment["rule_id"], assessment["rule_version"]), ("SLEEP_VIGILANCE", 1))
        self.assertEqual((assessment["state"], assessment["title"]), ("watch", "Sleep and vigilance change"))
        self.assertEqual(assessment["missing_inputs"], [])
        self.assertEqual(assessment["conflicting_evidence"], [])
        evidence = {item["code"]: item for item in assessment["supporting_evidence"]}
        self.assertEqual(set(evidence), {"repeated_short_sleep", "slower_reaction"})
        self.assertEqual(evidence["slower_reaction"]["baseline_id"], "crew-demo-reaction-v1")
        self.assertEqual(set(evidence["slower_reaction"]["observation_ids"]),
                         {"reaction-10"} | {f"base-reaction-{i}" for i in range(1, 6)})
        self.assertEqual(evidence["repeated_short_sleep"]["baseline_id"], "crew-demo-sleep-v1")
        self.assertEqual(evidence["slower_reaction"]["detail"],
                         "Current reaction time is 310 ms against the 250 ms demo baseline (+24.0%).")
        self.assertEqual(len(state["observations"]), 14)

    def test_b03_comparable_270_is_observed_not_missing(self):
        self.by_id["reaction-10"]["value"] = 270
        assessment = self.state()["assessments"][0]
        self.assertEqual((assessment["state"], assessment["title"]), ("observed", "Demo pattern not observed"))
        self.assertEqual(assessment["missing_inputs"], [])
        evidence = next(e for e in assessment["supporting_evidence"] if e["code"] == "reaction_comparison")
        self.assertEqual(evidence["detail"],
                         "Current reaction time is 270 ms against the 250 ms demo baseline (+8.0%).")

    def test_b03_each_required_sleep_night_missing_is_insufficient(self):
        for identifier in ["sleep-08", "sleep-09", "sleep-10"]:
            with self.subTest(missing=identifier):
                assessment = self.state([r for r in self.rows if r["id"] != identifier])["assessments"][0]
                self.assertEqual(assessment["state"], "insufficient_data")
                self.assertEqual(assessment["missing_inputs"], ["sleep_duration"])

    def test_missing_each_baseline_row_is_insufficient(self):
        for prefix, missing in [("base-sleep", "sleep_baseline"), ("base-reaction", "reaction_baseline")]:
            for index in range(1, 6):
                identifier = f"{prefix}-{index}"
                with self.subTest(missing=identifier):
                    assessment = self.state([r for r in self.rows if r["id"] != identifier])["assessments"][0]
                    self.assertEqual(assessment["state"], "insufficient_data")
                    self.assertEqual(assessment["missing_inputs"], [missing])

    def test_b03_incomparable_result_remains_current_but_insufficient(self):
        for key, value in [("input_profile", "browser-keyboard"), ("task_version", "different-version")]:
            with self.subTest(field=key):
                rows = deepcopy(self.rows)
                current = next(r for r in rows if r["id"] == "reaction-10")
                current["metadata"][key] = value
                state = self.state(rows)
                self.assertEqual(state["assessments"][0]["state"], "insufficient_data")
                self.assertEqual(state["assessments"][0]["missing_inputs"], ["reaction_time"])
                source = next(s for s in state["sources"] if s["source_id"] == "reaction_task")
                self.assertEqual((source["state"], source["reason_code"]),
                                 ("current", "incomparable_reaction_result"))
                self.assertIn(current, state["observations"])

    def test_exact_reaction_cutoff(self):
        for value, expected in [(300, "watch"), (299.75, "observed")]:
            with self.subTest(value=value):
                self.by_id["reaction-10"]["value"] = value
                self.assertEqual(self.state()["assessments"][0]["state"], expected)

    def test_exact_sleep_cutoff(self):
        for value, expected in [(390, "watch"), (391, "observed")]:
            with self.subTest(value=value):
                self.by_id["sleep-08"]["value"] = value
                self.by_id["sleep-09"]["value"] = value
                self.assertEqual(self.state()["assessments"][0]["state"], expected)

    def test_b04_resource_off_keeps_missing_pending_and_complete_watch(self):
        resources = {"local_reaction_task": False}
        state = self.state(time="2026-01-10T09:00:00Z", resources=resources)
        self.assertEqual(state["assessments"][0]["state"], "insufficient_data")
        actions = {a["id"]: a for a in state["actions"]}
        self.assertFalse(actions["start_reaction_check"]["available"])
        self.assertEqual(actions["start_reaction_check"]["unavailable_reason"], "Reaction check unavailable")
        self.assertTrue(actions["review_available_inputs"]["available"])
        self.assertEqual(self.state(resources=resources)["assessments"][0]["state"], "watch")

    def test_order_repeat_and_rewind_do_not_mutate_fixture(self):
        before = deepcopy(self.fixture)
        early = self.state(time="2026-01-10T09:00:00Z")
        late = self.state()
        self.assertEqual(self.state(list(reversed(self.rows))), late)
        self.assertEqual(self.state(), late)
        self.assertEqual(self.state(time="2026-01-10T09:00:00Z"), early)
        self.assertEqual(self.fixture, before)


if __name__ == "__main__":
    unittest.main()
