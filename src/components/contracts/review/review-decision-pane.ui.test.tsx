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
    renderWithProviders(
      <ReviewDecisionPane
        activeField={activeField}
        fieldQueue={[]}
        actions={<button type="button">Confirm</button>}
      />
    );

    expect(screen.getByText("Where this is used")).toBeTruthy();
    expect(screen.getByText("Sets the date used for renewal reminders, renewal lists, and reports.")).toBeTruthy();
    expect(screen.getByText("Source value")).toBeTruthy();
    expect(screen.getByText("AI suggestion")).toBeTruthy();
    expect(screen.getByText(/model confidence/i)).toBeTruthy();
  });
});
