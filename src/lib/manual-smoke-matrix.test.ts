import { describe, expect, it } from "vitest";
import { V9_MANUAL_SMOKE_PRIMARY_SECTION } from "./manual-smoke-doc-anchors";
import { V9_MANUAL_SMOKE_PATHS } from "./manual-smoke-matrix";
import { V9_SPEC_TRACE } from "./compatibility-spec-trace-map";

describe("V9 manual smoke matrix", () => {
  it("lists high-risk flows for human signoff", () => {
    expect(V9_MANUAL_SMOKE_PATHS.length).toBeGreaterThanOrEqual(8);
    expect(V9_MANUAL_SMOKE_PATHS.join(" ")).toMatch(/export|review|tab/i);
  });

  it("crosswalks every smoke path to a primary docs § id and a trace row", () => {
    expect(Object.keys(V9_MANUAL_SMOKE_PRIMARY_SECTION)).toHaveLength(V9_MANUAL_SMOKE_PATHS.length);
    for (const p of V9_MANUAL_SMOKE_PATHS) {
      const section = V9_MANUAL_SMOKE_PRIMARY_SECTION[p];
      expect(section, p).toBeDefined();
      const trace = V9_SPEC_TRACE[section];
      expect(trace, `${p} → §${section}`).toBeDefined();
      expect(trace!.length).toBeGreaterThan(0);
    }
  });
});
