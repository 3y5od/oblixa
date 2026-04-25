import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseV9DocH2SectionIds, parseV9DocH3SectionIds } from "./v9-doc-headings";
import { V9_SPEC_TRACE } from "./v9-spec-trace-map";

describe("v9 spec trace matrix (docs/v9.md headings)", () => {
  it("maps every ## section id to existing artifacts", () => {
    const docPath = join(process.cwd(), "docs", "v9.md");
    const doc = readFileSync(docPath, "utf8");
    const ids = parseV9DocH2SectionIds(doc);
    expect(ids.length).toBeGreaterThan(100);

    for (const id of ids) {
      const artifacts = V9_SPEC_TRACE[id as keyof typeof V9_SPEC_TRACE];
      expect(artifacts, `missing trace for §${id}`).toBeDefined();
      expect(artifacts!.length).toBeGreaterThan(0);
      for (const rel of artifacts!) {
        const abs = join(process.cwd(), rel);
        expect(existsSync(abs), rel).toBe(true);
      }
    }
  });

  it("maps every ### sub-heading id when present (same trace table as ##)", () => {
    const docPath = join(process.cwd(), "docs", "v9.md");
    const doc = readFileSync(docPath, "utf8");
    const h3 = parseV9DocH3SectionIds(doc);
    for (const id of h3) {
      const artifacts = V9_SPEC_TRACE[id as keyof typeof V9_SPEC_TRACE];
      expect(artifacts, `missing trace for §${id} (### heading)`).toBeDefined();
      expect(artifacts!.length).toBeGreaterThan(0);
    }
  });
});
