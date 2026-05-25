import { describe, expect, it } from "vitest";
import {
  V10_SHARED_ACTION_VOCABULARY,
  adaptLegacyStatusToV10JobStatus,
  dedupeAndOrderV10StateEvents,
  getAllowedV10NextStates,
  getV10SharedActionAuditVerb,
  validateV10StateTransition,
  type V10LegacyStatus,
} from "./status-action-vocabulary";

describe("V10 legacy status adapters and shared action vocabulary", () => {
  it("normalizes legacy job statuses into V10 job states", () => {
    expect(adaptLegacyStatusToV10JobStatus("pending")).toBe("queued");
    expect(adaptLegacyStatusToV10JobStatus("queued")).toBe("queued");
    expect(adaptLegacyStatusToV10JobStatus("processing")).toBe("running");
    expect(adaptLegacyStatusToV10JobStatus("completed")).toBe("succeeded");
    expect(adaptLegacyStatusToV10JobStatus("succeeded")).toBe("succeeded");
    expect(adaptLegacyStatusToV10JobStatus("partial")).toBe("partial");
    expect(adaptLegacyStatusToV10JobStatus("failed")).toBe("failed_retryable");
    expect(adaptLegacyStatusToV10JobStatus("failed", false)).toBe("failed_terminal");
    expect(adaptLegacyStatusToV10JobStatus("cancelled")).toBe("canceled");
    expect(adaptLegacyStatusToV10JobStatus("canceled")).toBe("canceled");
    const legacyStatuses: readonly V10LegacyStatus[] = [
      "pending",
      "queued",
      "processing",
      "completed",
      "succeeded",
      "failed",
      "partial",
      "cancelled",
      "canceled",
    ];
    expect(legacyStatuses.map((status) => adaptLegacyStatusToV10JobStatus(status))).toEqual([
      "queued",
      "queued",
      "running",
      "succeeded",
      "succeeded",
      "failed_retryable",
      "partial",
      "canceled",
      "canceled",
    ]);
  });

  it("keeps shared actions labelable and auditable", () => {
    expect(Object.keys(V10_SHARED_ACTION_VOCABULARY)).toEqual(
      expect.arrayContaining(["assign_owner", "retry_job", "run_report", "create_export", "open_source_record"])
    );
    expect(getV10SharedActionAuditVerb("retry_job")).toBe("job.retried");
    for (const [action, vocabulary] of Object.entries(V10_SHARED_ACTION_VOCABULARY)) {
      expect(vocabulary.label.length, action).toBeGreaterThan(3);
      expect(vocabulary.auditVerb, action).toMatch(/^[a-z_]+\.[a-z_]+$/);
    }
    const auditVerbs = Object.values(V10_SHARED_ACTION_VOCABULARY).map((vocabulary) => vocabulary.auditVerb);
    expect(new Set(auditVerbs).size).toBe(auditVerbs.length);
  });

  it("enforces deterministic V10 state transitions across runtime workflows", () => {
    expect(getAllowedV10NextStates("job", "failed_retryable")).toEqual(["retrying", "failed_terminal"]);
    expect(validateV10StateTransition({ machine: "job", from: "queued", to: "running" })).toEqual([]);
    expect(validateV10StateTransition({ machine: "job", from: "succeeded", to: "running" })).toEqual(["transition_not_allowed"]);
    expect(validateV10StateTransition({ machine: "work_item", from: "done", to: "open" })).toEqual(["transition_not_allowed"]);
    expect(validateV10StateTransition({ machine: "activation", from: "extraction_failed", to: "extraction_queued" })).toEqual([]);
    expect(validateV10StateTransition({ machine: "field_review", from: "approved", to: "rejected" })).toEqual([
      "transition_not_allowed",
    ]);
    expect(validateV10StateTransition({ machine: "renewal", from: "notice_overdue", to: "completed" })).toEqual([]);
  });

  it("rejects duplicate, stale, unknown, and duplicate-idempotency transitions", () => {
    const failures = validateV10StateTransition({
      machine: "work_item",
      from: "open",
      to: "open",
      previousOccurredAt: "2026-04-26T12:00:00.000Z",
      occurredAt: "2026-04-26T11:59:59.000Z",
      idempotencyKey: "idem_12345678",
      seenIdempotencyKeys: new Set(["idem_12345678"]),
    });

    expect(failures).toEqual(
      expect.arrayContaining(["duplicate_transition", "transition_not_allowed", "transition_out_of_order", "duplicate_idempotency_key"])
    );
    expect(validateV10StateTransition({ machine: "job", from: "not_a_state", to: "running" })).toEqual(
      expect.arrayContaining(["unknown_from_state"])
    );
  });

  it("deduplicates and orders state events by time then sequence", () => {
    expect(
      dedupeAndOrderV10StateEvents([
        { id: "b", state: "running", occurredAt: "2026-04-26T12:00:01.000Z", sequence: 1, idempotencyKey: "run" },
        { id: "a", state: "queued", occurredAt: "2026-04-26T12:00:00.000Z", sequence: 2, idempotencyKey: "queue" },
        { id: "a", state: "queued", occurredAt: "2026-04-26T12:00:00.000Z", sequence: 1, idempotencyKey: "queue" },
        { id: "c", state: "succeeded", occurredAt: "2026-04-26T12:00:01.000Z", sequence: 0, idempotencyKey: "done" },
      ])
    ).toEqual([
      { id: "a", state: "queued", occurredAt: "2026-04-26T12:00:00.000Z", sequence: 1, idempotencyKey: "queue" },
      { id: "c", state: "succeeded", occurredAt: "2026-04-26T12:00:01.000Z", sequence: 0, idempotencyKey: "done" },
      { id: "b", state: "running", occurredAt: "2026-04-26T12:00:01.000Z", sequence: 1, idempotencyKey: "run" },
    ]);
  });
});
