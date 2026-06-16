import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const CONTRACT_DETAIL = join(process.cwd(), "src/app/(dashboard)/contracts/[id]/page.tsx");
const CONTRACT_DETAIL_MODEL = join(
  process.cwd(),
  "src/app/(dashboard)/contracts/[id]/contract-detail-page-model.ts"
);

describe("contract detail product-surface gating", () => {
  it("keeps program overrides and collaboration gated on eligibility", () => {
    const raw = `${readFileSync(CONTRACT_DETAIL, "utf8")}\n${readFileSync(CONTRACT_DETAIL_MODEL, "utf8")}`;
    expect(raw.includes("showProgramsSurface")).toBe(true);
    expect(raw.includes("showCollaborationSurface")).toBe(true);
    expect(raw.includes("evaluateFeatureEligibility(productSurface, \"programs\")")).toBe(true);
    expect(raw.includes("evaluateFeatureEligibility(productSurface, \"collaboration\")")).toBe(true);
  });
});
