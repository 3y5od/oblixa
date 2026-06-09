import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("tasks vs contract requirements user language", () => {
  it("work hub queue cards use distinct execution-kind labels", () => {
    const spec = readFileSync(join(process.cwd(), "src/lib/work/spec-strings.ts"), "utf8");
    expect(spec).toContain('contract_task: "Task"');
    expect(spec).toContain('obligation: "Contract requirement"');
    expect(spec).toContain('approval: "Approval"');
  });

  it("inline row mutations keep task vs requirement wording in success copy", () => {
    const src = readFileSync(
      join(process.cwd(), "src/components/work/work-queue-inline-actions.tsx"),
      "utf8"
    );
    expect(src).toContain("Task marked complete.");
    expect(src).toContain("Contract requirement marked complete.");
    expect(src).toContain("Task moved into progress.");
    expect(src).toContain("Contract requirement moved into progress.");
    expect(src).toContain("Task reopened for work.");
    expect(src).toContain("dependent task");
    expect(src).toContain("recurring requirement");
  });

  it("Tasks route tabs distinguish approvals and requirements without old sidebar lanes", () => {
    const spec = readFileSync(join(process.cwd(), "src/lib/work/spec-strings.ts"), "utf8");
    const nav = readFileSync(join(process.cwd(), "src/lib/navigation.ts"), "utf8");
    expect(spec).toContain('approvals: "Approvals"');
    expect(spec).toContain('obligations: "Requirements"');
    expect(nav).toContain('name: "Tasks"');
    expect(nav).not.toMatch(/\{\s*name: "Tasks",\s*href: "\/contracts\/tasks"/);
  });
});
