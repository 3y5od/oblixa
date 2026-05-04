import { describe, expect, it } from "vitest";

import { V10_MUTATION_OUTCOMES } from "./v10-release-contract";
import {
  buildV10MutationResponse,
  classifyV10MutationResponse,
  getV10MutationHttpStatus,
  validateV10ApiResponseSchema,
} from "./v10-mutation-envelope";

function buildResponseForOutcome(outcome: (typeof V10_MUTATION_OUTCOMES)[number]) {
  const base = { outcome, message: `${outcome} response.`, diagnosticId: `diag_${outcome}` } as const;
  if (outcome === "success") {
    return buildV10MutationResponse({ ...base, changedObjectType: "work_item", changedObjectId: "work_1", auditEventId: "audit_1" });
  }
  if (outcome === "validation_failed") {
    return buildV10MutationResponse({
      ...base,
      validationFailures: [{ field: "name", code: "required", user_visible_message: "Name is required.", self_fixable: true }],
    });
  }
  if (outcome === "stale_version") {
    return buildV10MutationResponse({ ...base, changedObjectType: "work_item", changedObjectId: "work_1", nextDestinationHref: "/work" });
  }
  if (["conflict", "rate_limited", "job_not_retryable"].includes(outcome)) {
    return buildV10MutationResponse({ ...base, changedObjectType: "work_item", changedObjectId: "work_1", nextDestinationHref: "/work" });
  }
  if (outcome === "no_action") {
    return buildV10MutationResponse({ outcome, message: "No action was needed because the record is already up to date." });
  }
  return buildV10MutationResponse(base);
}

describe("V10 mutation envelope", () => {
  it("builds schema-valid responses for every declared mutation outcome", () => {
    for (const outcome of V10_MUTATION_OUTCOMES) {
      const response = buildResponseForOutcome(outcome);
      expect(getV10MutationHttpStatus(response), outcome).toBeGreaterThanOrEqual(200);
      expect(classifyV10MutationResponse(response), outcome).toMatch(/^(success|denial|validation|partial|retryable|terminal|stale|no_action)$/);
      expect(validateV10ApiResponseSchema(response), outcome).toEqual([]);
    }
  });

  it("sanitizes unsafe mutation destinations while preserving safe internal hrefs", () => {
    expect(
      buildV10MutationResponse({ outcome: "conflict", message: "Retry on the original surface.", diagnosticId: "diag_conflict", nextDestinationHref: "/api/import/contracts/job_1?token=secret" })
        .next_destination_href
    ).toBe("/work");
    expect(
      buildV10MutationResponse({ outcome: "conflict", message: "Retry on the original surface.", diagnosticId: "diag_conflict", nextDestinationHref: "https://evil.example/contracts/1" })
        .next_destination_href
    ).toBe("/work");
    expect(
      buildV10MutationResponse({ outcome: "conflict", message: "Retry on the original surface.", diagnosticId: "diag_conflict", nextDestinationHref: "/contracts/contract_1?tab=overview" })
        .next_destination_href
    ).toBe("/contracts/contract_1?tab=overview");
  });
});