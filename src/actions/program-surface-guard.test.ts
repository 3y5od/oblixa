import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const V4_ACTIONS = join(process.cwd(), "src/actions/policy-operations.ts");

describe("v4 program actions surface guard tripwire", () => {
  it("ties auth + org membership to source (§13.3 smoke)", () => {
    const raw = readFileSync(V4_ACTIONS, "utf8");
    expect(raw).toContain("getUser(");
    expect(raw).toContain("organization_id");
  });

  it("routes all program mutations through ensureProgramsSurfaceAccess", () => {
    const raw = readFileSync(V4_ACTIONS, "utf8");
    const guardedFns = [
      "createProgramAction",
      "publishProgramAction",
      "applyProgramAction",
      "saveProgramVersionDefinitionAction",
      "updateProgramRoutingAction",
      "updateProgramAssignmentOverrideAction",
    ];
    for (const fn of guardedFns) {
      const fnIdx = raw.indexOf(`export async function ${fn}`);
      expect(fnIdx, `${fn} not found`).toBeGreaterThan(-1);
      const window = raw.slice(fnIdx, fnIdx + 1400);
      expect(
        window.includes("const surfaceGate = await ensureProgramsSurfaceAccess(ctx);"),
        `${fn} must gate by workspace product surface`
      ).toBe(true);
    }
  });
});
