/**
 * V9 §9.5 / §10 — contracts lifecycle mutations: org scope, write gates, status graph, telemetry hooks.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("contracts lifecycle actions (V9 bundle)", () => {
  it("keeps transition validation, membership checks, and first-org telemetry on lifecycle paths", () => {
    const src = readFileSync(join(process.cwd(), "src/actions/contracts-lifecycle.ts"), "utf8");
    expect(src).toContain("VALID_TRANSITIONS");
    expect(src).toContain("verifyOrgMembership");
    expect(src).toContain("requireWriteAccess");
    expect(src).toContain("emitProductTelemetryIfFirstInOrganization");
    expect(src).toContain("recomputeContractSignals");
  });
});
