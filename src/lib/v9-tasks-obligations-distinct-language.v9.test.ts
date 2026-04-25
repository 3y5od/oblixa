/**
 * V9 §12 + Appendix AK — row actions and inline feedback name tasks vs obligations distinctly.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("tasks vs obligations user language (V9 §12 + §24)", () => {
  it("work hub queue cards use distinct execution-kind labels", () => {
    const work = readFileSync(join(process.cwd(), "src/app/(dashboard)/work/page.tsx"), "utf8");
    expect(work).toContain('objectType="Task"');
    expect(work).toContain('objectType="Obligation"');
    expect(work).toContain('objectType="Approval"');
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

  it("primary nav distinguishes Tasks and Obligations destinations", () => {
    const nav = readFileSync(join(process.cwd(), "src/lib/navigation.ts"), "utf8");
    expect(nav).toContain('{ name: "Tasks", href: "/contracts/tasks" }');
    expect(nav).toContain('{ name: "Obligations", href: "/contracts/obligations" }');
  });
});
