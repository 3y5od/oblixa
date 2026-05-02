import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { V10_ACCEPTANCE_GATES } from "./v10-release-contract";
import { V10_SPEC_TRACE } from "./v10-spec-trace-map";

describe("V10 §6 acceptance gates ↔ spec trace", () => {
  it("maps each V10_ACCEPTANCE_GATES entry to docs §6.n and V10_SPEC_TRACE", () => {
    expect(V10_ACCEPTANCE_GATES).toHaveLength(16);
    for (let i = 0; i < V10_ACCEPTANCE_GATES.length; i += 1) {
      const section = `6.${i + 1}`;
      expect(V10_SPEC_TRACE[section as keyof typeof V10_SPEC_TRACE]?.length, section).toBeGreaterThan(0);
    }
  });
});

describe("check:v10-promotable (all release stages)", () => {
  it("reports zero blockers for beta, GA, and complete", () => {
    for (const stage of ["beta", "GA", "complete"] as const) {
      const r = spawnSync("node", ["scripts/check-v10-promotable.mjs", "--stage", stage], {
        cwd: process.cwd(),
        encoding: "utf8",
      });
      expect(r.status, stage).toBe(0);
      const payload = JSON.parse(r.stdout);
      expect(payload.ok, stage).toBe(true);
      expect(payload.blockerCount, stage).toBe(0);
    }
  });
});
