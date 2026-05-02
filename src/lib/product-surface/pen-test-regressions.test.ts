import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("pen-test finding regression harness (Phase 34)", () => {
  it("parses findings and requires open items to declare a regression glob", () => {
    const raw = JSON.parse(
      readFileSync(join(process.cwd(), "artifacts", "pen-test-findings.json"), "utf8")
    ) as {
      findings: Array<{ id: string; status: string; regressionTestGlob?: string }>;
    };
    expect(Array.isArray(raw.findings)).toBe(true);
    for (const f of raw.findings || []) {
      if (f.status === "closed") continue;
      expect(f.regressionTestGlob, f.id).toBeTruthy();
    }
  });
});
