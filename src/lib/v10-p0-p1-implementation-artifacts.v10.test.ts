import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { V10_IMPLEMENTATION_REQUIREMENTS } from "./v10-implementation-checklist";

describe("V10 P0/P1 implementation checklist artifacts", () => {
  it("keeps every P0 and P1 requirement wired to on-disk artifacts", () => {
    const root = process.cwd();
    for (const requirement of V10_IMPLEMENTATION_REQUIREMENTS) {
      if (requirement.priority !== "P0" && requirement.priority !== "P1") continue;
      for (const artifact of requirement.artifacts) {
        expect(existsSync(join(root, artifact)), `${requirement.id}:${artifact}`).toBe(true);
      }
    }
  });
});
