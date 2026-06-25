/** @vitest-environment jsdom */
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "@/test-utils/render-with-providers";
import type { FieldReviewActiveField } from "@/lib/field-review/model";
import { ReviewDecisionPane } from "./review-decision-pane";

const activeField: FieldReviewActiveField = {
  id: "field-1",
  fieldName: "renewal_date",
  fieldLabel: "Renewal date",
  suggestedValue: "2026-08-18",
  sourceSnippet: "renews on August 18, 2026",
  confidence: 0.91,
  confidenceLabel: "91%",
  source: "ai",
  currentApprovedValue: null,
  approvedConflict: false,
  importantLabel: "Renewal date",
  impactCopy: "Sets the date used for renewal reminders, renewal lists, and reports.",
  needsCitation: false,
  sourceQuality: "located",
};

describe("ReviewDecisionPane", () => {
  it("explains what a suggested detail affects", () => {
    renderWithProviders(<ReviewDecisionPane activeField={activeField} fieldQueue={[]} />);

    expect(screen.getByText("Where this confirmed detail is used")).toBeTruthy();
    expect(screen.getByText("Sets the date used for renewal reminders, renewal lists, and reports.")).toBeTruthy();
    // Extraction metadata is shown as one quiet line, framed (Model score, "Not a
    // trust signal") so it never reads as a trust verdict (AI boundary).
    expect(screen.getByText(/Source value/)).toBeTruthy();
    expect(screen.getByText(/Model score/)).toBeTruthy();
    // "not a trust signal" appears both as the visible caption and the sr-only
    // tooltip, so assert at least one match rather than a unique one.
    expect(screen.getAllByText(/not a trust signal/i).length).toBeGreaterThan(0);
    // The suggested value is explicitly untrusted until confirmed.
    expect(screen.getByText("Suggested detail, not confirmed")).toBeTruthy();
  });
});
