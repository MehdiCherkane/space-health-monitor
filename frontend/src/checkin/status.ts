/** Shared submit-request status used by the check-in form and the reaction result panel. */
export type RequestStatus =
  | { kind: "idle" }
  | { kind: "pending" }
  | { kind: "success" }
  | { kind: "error"; message: string };
