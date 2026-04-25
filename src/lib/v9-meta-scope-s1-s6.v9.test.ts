import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseV9DocH2SectionIds } from "./v9-doc-headings";
import { V9_SPEC_TRACE } from "./v9-spec-trace-map";

describe("V9 §1–§6 meta scope (plan s1-s6)", () => {
  it("keeps doc section ids 1–6 wired in V9_SPEC_TRACE with on-disk artifacts", () => {
    const doc = readFileSync(join(process.cwd(), "docs", "v9.md"), "utf8");
    const ids = new Set(parseV9DocH2SectionIds(doc));
    for (const id of ["1", "2", "3", "4", "5", "6"] as const) {
      expect(ids.has(id), `docs/v9.md should include ## ${id}.`).toBe(true);
      const artifacts = V9_SPEC_TRACE[id];
      expect(artifacts, `V9_SPEC_TRACE["${id}"]`).toBeDefined();
      for (const rel of artifacts!) {
        expect(existsSync(join(process.cwd(), rel)), rel).toBe(true);
      }
    }
  });

  it("anchors §5 sub-clauses used by scope and security suites", () => {
    for (const id of ["5.1", "5.2", "5.3", "5.4"] as const) {
      const artifacts = V9_SPEC_TRACE[id];
      expect(artifacts?.length).toBeGreaterThan(0);
    }
  });
});
