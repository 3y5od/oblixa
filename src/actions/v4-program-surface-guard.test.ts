import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const V4_ACTIONS = join(process.cwd(), "src/actions/v4.ts");

describe("v4 program actions surface guard tripwire", () => {
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
