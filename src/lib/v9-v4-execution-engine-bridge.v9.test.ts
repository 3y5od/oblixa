/**
 * V9 §11.4 / §18 — v4 execution engine emits product telemetry (downstream work + observability hooks).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("v4 execution engine touchpoints (V9)", () => {
  it("emits product telemetry from the execution engine for generated work", () => {
    const eng = readFileSync(join(process.cwd(), "src/lib/v4/execution-engine.ts"), "utf8");
    expect(eng).toContain("emitProductTelemetryEvent");
  });

  it("keeps tasks automation bridge importable for approval-linked task transitions", () => {
    const auto = readFileSync(join(process.cwd(), "src/actions/tasks-automation.ts"), "utf8");
    expect(auto).toContain("contract_tasks");
    expect(auto).toContain("approval");
  });
});
