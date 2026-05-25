/**
 * V9 §12 + Appendix AK — row actions and inline feedback name tasks vs obligations distinctly.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("tasks vs obligations user language (V9 §12 + §24)", () => {
  it("work hub queue cards use distinct execution-kind labels", () => {
    const spec = readFileSync(join(process.cwd(), "src/lib/work/spec-strings.ts"), "utf8");
    expect(spec).toContain('contract_task: "Task"');
    expect(spec).toContain('obligation: "Obligation"');
    expect(spec).toContain('approval: "Approval"');
  });

  it("inline row mutations keep task vs obligation wording in success copy", () => {
    const src = readFileSync(
      join(process.cwd(), "src/components/work/work-queue-inline-actions.tsx"),
      "utf8"
    );
    expect(src).toContain("Task marked complete.");
    expect(src).toContain("Obligation marked complete.");
    expect(src).toContain("Task moved into progress.");
    expect(src).toContain("Obligation moved into progress.");
    expect(src).toContain("Task reopened for work.");
    expect(src).toContain("blocked dependent task");
    expect(src).toContain("recurring obligation");
  });

  it("Work route tabs distinguish approvals and obligations without old sidebar lanes", () => {
    const spec = readFileSync(join(process.cwd(), "src/lib/work/spec-strings.ts"), "utf8");
    const nav = readFileSync(join(process.cwd(), "src/lib/navigation.ts"), "utf8");
    expect(spec).toContain('approvals: "Approvals"');
    expect(spec).toContain('obligations: "Obligations"');
    expect(nav).toContain('name: "Work"');
    expect(nav).not.toMatch(/\{\s*name: "Tasks",\s*href: "\/contracts\/tasks"/);
  });
});
