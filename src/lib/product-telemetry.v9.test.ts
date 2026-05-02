import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { PRODUCT_TELEMETRY_ACTIONS } from "./product-telemetry";

describe("product telemetry (v9 §28)", () => {
  it("keeps exactly 43 allowlisted literals with stable naming", () => {
    const v9Actions = PRODUCT_TELEMETRY_ACTIONS.filter((action) => action.startsWith("product.v9."));

    expect(v9Actions).toHaveLength(43);
    for (const action of v9Actions) {
      expect(action, action).toMatch(/^product\.v9\.[a-z0-9_]+$/);
    }
  });

  it("keeps allowlisted action keys stable", () => {
    expect(PRODUCT_TELEMETRY_ACTIONS).toContain("product.v9.first_contract_created");
    expect(PRODUCT_TELEMETRY_ACTIONS).toContain("product.v9.bulk_owner_assigned");
    expect(PRODUCT_TELEMETRY_ACTIONS).toContain("product.v9.cmdk_palette_opened");
    expect(PRODUCT_TELEMETRY_ACTIONS).toContain("product.v9.import_started");
    expect(PRODUCT_TELEMETRY_ACTIONS).toContain("product.v9.export_completed");
    expect(PRODUCT_TELEMETRY_ACTIONS).toContain("product.v9.export_partially_completed");
    expect(PRODUCT_TELEMETRY_ACTIONS).toContain("product.v9.export_failed");
    expect(PRODUCT_TELEMETRY_ACTIONS).toContain("product.v9.extraction_failed");
    expect(PRODUCT_TELEMETRY_ACTIONS).toContain("product.v9.reminder_failed");
    expect(PRODUCT_TELEMETRY_ACTIONS).toContain("product.v9.evidence_review_decision_recorded");
  });

  it("wires emit helper only for allowlisted keys", () => {
    const src = readFileSync(resolve(__dirname, "product-telemetry.ts"), "utf8");
    expect(src).toContain("isAllowlistedAction");
    expect(src).toContain("audit_events");
  });
});
