import { useRef, useState } from "react";
import { FIXTURE_PREVIEW_BADGE } from "../constants.ts";
import { CrewCheckIn } from "../CrewCheckIn.tsx";
import type { ObservationSubmission } from "../types.ts";
import {
  PREVIEW_AS_OF,
  PREVIEW_RUN_ID,
  PREVIEW_SCENARIO_ID,
  previewActions,
} from "./fixtures.ts";

type SubmitBehaviour = "resolve" | "reject" | "slow";

const BEHAVIOUR_LABEL: Record<SubmitBehaviour, string> = {
  resolve: "Resolve the fake submit callback",
  reject: "Reject the fake submit callback",
  slow: "Resolve after 1.5 seconds",
};

/**
 * Dev-only fixture preview. Mounts the real crew check-in with a fake submit callback and
 * a visible preview badge. Never part of the integrated app.
 */
export function FixturePreview() {
  const [behaviour, setBehaviour] = useState<SubmitBehaviour>("resolve");
  const [reactionAvailable, setReactionAvailable] = useState(true);
  const [submissions, setSubmissions] = useState<ObservationSubmission[]>([]);
  const [lastAction, setLastAction] = useState<string | null>(null);
  const [resetCount, setResetCount] = useState(0);
  const behaviourRef = useRef(behaviour);
  behaviourRef.current = behaviour;

  const fakeSubmit = async (payload: ObservationSubmission): Promise<void> => {
    setSubmissions((previous) => [...previous, payload]);
    const mode = behaviourRef.current;
    if (mode === "slow") {
      await new Promise((resolve) => window.setTimeout(resolve, 1500));
    }
    if (mode === "reject") {
      throw new Error("Fixture preview: the fake submit callback rejected this batch.");
    }
  };

  return (
    <main style={{ fontFamily: "system-ui, sans-serif", margin: "2rem auto", maxWidth: "52rem" }}>
      <p
        style={{
          display: "inline-block",
          padding: "0.25rem 0.6rem",
          border: "2px solid #8a5a00",
          borderRadius: "999px",
          background: "#fff4d6",
          color: "#603d00",
          fontWeight: 700,
        }}
      >
        {FIXTURE_PREVIEW_BADGE} — fake callback, synthetic sample entries, not an integrated run
      </p>
      <h1>Crew check-in fixture preview</h1>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem", margin: "1rem 0" }}>
        <label>
          Submit callback:{" "}
          <select
            value={behaviour}
            onChange={(event) => setBehaviour(event.target.value as SubmitBehaviour)}
          >
            {(Object.keys(BEHAVIOUR_LABEL) as SubmitBehaviour[]).map((mode) => (
              <option key={mode} value={mode}>
                {BEHAVIOUR_LABEL[mode]}
              </option>
            ))}
          </select>
        </label>
        <label>
          <input
            type="checkbox"
            checked={reactionAvailable}
            onChange={(event) => {
              setReactionAvailable(event.target.checked);
              setResetCount((count) => count + 1);
            }}
          />{" "}
          reaction resource available
        </label>
        <button type="button" onClick={() => setResetCount((count) => count + 1)}>
          Reset preview
        </button>
      </div>

      <CrewCheckIn
        key={`${behaviour}-${reactionAvailable}-${resetCount}`}
        runId={PREVIEW_RUN_ID}
        scenarioId={PREVIEW_SCENARIO_ID}
        asOf={PREVIEW_AS_OF}
        actions={previewActions(reactionAvailable)}
        onSubmit={fakeSubmit}
        onAction={(actionId) => setLastAction(actionId)}
      />

      <section aria-labelledby="preview-log" style={{ marginTop: "2rem" }}>
        <h2 id="preview-log">Preview callback log</h2>
        <p>Routed action: {lastAction ?? "(none yet)"}</p>
        <p>Fake submissions received: {submissions.length}</p>
        <pre style={{ overflow: "auto", background: "#10202b", color: "#e6f0f5", padding: "1rem" }}>
          {JSON.stringify(submissions, null, 2)}
        </pre>
      </section>
    </main>
  );
}
