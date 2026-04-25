import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { V9_SPEC_TRACE } from "./v9-spec-trace-map";

describe("V9 §31–32 non-goals and refinement guardrails", () => {
  it("keeps trace rows for §31 and §32 anchored to constraint tests", () => {
    expect(V9_SPEC_TRACE["31"]).toBeDefined();
    expect(V9_SPEC_TRACE["32"]).toBeDefined();
    const s31 = V9_SPEC_TRACE["31"] as string[];
    const s32 = V9_SPEC_TRACE["32"] as string[];
    expect(s31).toContain("src/lib/v9-global-constraints.v9.test.ts");
    expect(s32).toContain("src/lib/v9-spec-principles.v9.test.ts");
  });

  it("constraint + principles harness files remain on disk", () => {
    for (const rel of ["src/lib/v9-global-constraints.v9.test.ts", "src/lib/v9-spec-principles.v9.test.ts"]) {
      expect(existsSync(join(process.cwd(), rel)), rel).toBe(true);
    }
  });
});
