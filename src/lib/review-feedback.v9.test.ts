import { describe, expect, it } from "vitest";
import {
  buildFieldReviewStatusMessage,
  getCriticalFieldReviewSummary,
  sortFieldsForReview,
} from "./review-feedback";

describe("buildFieldReviewStatusMessage (v9)", () => {
  // v23 aesthetic pass: the trailing technobabble ("reminder or work
  // state will refresh from the latest approved values" / "before
  // reminders or downstream work should rely on this contract") was
  // dropped per §10.7 + §10.14 — after a field action the user wants
  // the verb + remaining count, not a system explanation. Field label
  // is now capitalized at sentence-start for proper grammar.
  it("reports the remaining backlog count after a generic save", () => {
    expect(buildFieldReviewStatusMessage({ pendingCount: 2 })).toBe(
      "Saved. 2 fields remaining."
    );
  });

  it("uses verb + remaining count after approval and capitalizes the field prefix", () => {
    expect(
      buildFieldReviewStatusMessage({
        pendingCount: 1,
        action: "approved",
        fieldLabel: "renewal date",
      })
    ).toBe("Renewal date approved. 1 field remaining.");
  });

  it("switches to a clear-ready message once review is complete", () => {
    expect(buildFieldReviewStatusMessage({ pendingCount: 0 })).toBe(
      "Saved. Review complete."
    );
  });
});

describe("review critical field helpers (v9)", () => {
  it("surfaces pending and missing critical date coverage clearly", () => {
    expect(
      getCriticalFieldReviewSummary([
        {
          field_name: "renewal_date",
          status: "pending",
          field_value: "2026-05-01",
        },
        {
          field_name: "end_date",
          status: "approved",
          field_value: "2026-12-31",
        },
      ] as never)
    ).toEqual({
      pendingLabels: ["Renewal date"],
      missingLabels: ["Renewal date", "Notice window"],
    });
  });

  it("prioritizes pending critical fields ahead of general cleanup", () => {
    const ordered = sortFieldsForReview([
      { id: "3", field_name: "governing_law", status: "pending" },
      { id: "1", field_name: "renewal_date", status: "pending" },
      { id: "2", field_name: "end_date", status: "approved" },
    ] as never);

    expect(ordered.map((field) => field.id)).toEqual(["1", "3", "2"]);
  });
});
