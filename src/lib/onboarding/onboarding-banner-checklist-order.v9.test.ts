import { describe, expect, it } from "vitest";
import { checklistRowOrderFromSetupChecklist } from "./onboarding-banner-checklist-order";

describe("onboarding banner checklist order (V9 §7.3)", () => {
  it("returns three distinct row keys with no duplicates for representative calibration hints", () => {
    const cases: (string[] | undefined)[] = [
      undefined,
      [],
      ["upload_contract", "review_fields"],
      ["compliance_alignment"],
      ["review_fields", "upload_contract"],
      ["bulk_import"],
      ["organize_work"],
    ];
    for (const checklist of cases) {
      const order = checklistRowOrderFromSetupChecklist(checklist);
      expect(order).toHaveLength(3);
      expect(new Set(order).size).toBe(3);
    }
  });
});
