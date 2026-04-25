import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * §12.3 — request-evidence from work rows: not present on Core work inline surface (explicit trace exempt).
 */
describe("V9 work row request-evidence", () => {
  it("work inline actions omit evidence-request CTA (defer to contract/evidence flows)", () => {
    const body = readFileSync(join(process.cwd(), "src/components/work/work-queue-inline-actions.tsx"), "utf8");
    expect(body.toLowerCase()).not.toContain("request evidence");
    expect(body.toLowerCase()).not.toContain("evidence_request");
  });
});
