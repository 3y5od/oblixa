import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("contracts bulk import telemetry (V9)", () => {
  it("emits import lifecycle milestones for file-based bulk import", () => {
    const raw = readFileSync(join(process.cwd(), "src/actions/contracts.ts"), "utf8");
    expect(raw).toContain("product.v9.import_started");
    expect(raw).toContain("product.v9.import_completed");
    expect(raw).toContain("product.v9.import_partially_completed");
    expect(raw).toContain("product.v9.import_failed");
    expect(raw).toContain('source: "files"');
  });

  it("keeps first-contract milestone parity with the single-contract path", () => {
    const raw = readFileSync(join(process.cwd(), "src/actions/contracts.ts"), "utf8");
    expect(raw).toContain("emitProductTelemetryIfFirstInOrganization");
    expect(raw).toContain('action: "product.v9.first_contract_created"');
    expect(raw).toContain('intake: "bulk_files"');
  });
});
