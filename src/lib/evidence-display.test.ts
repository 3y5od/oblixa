import { describe, expect, it } from "vitest";
import {
  getEvidenceRequirementStatusLabel,
  getEvidenceRequirementTypeLabel,
} from "./evidence-display";

describe("evidence display labels (V9)", () => {
  it("maps queue and contract evidence enums to readable labels", () => {
    expect(getEvidenceRequirementStatusLabel("required")).toBe("Requested evidence");
    expect(getEvidenceRequirementStatusLabel("submitted")).toBe("Submitted for review");
    expect(getEvidenceRequirementStatusLabel("rejected")).toBe("Needs correction");
    expect(getEvidenceRequirementTypeLabel("legal_pack")).toBe("Legal Pack");
    expect(getEvidenceRequirementTypeLabel("external_reference")).toBe("External reference");
  });
});
