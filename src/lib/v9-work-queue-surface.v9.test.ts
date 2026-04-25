import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("V9 §12 work hub — lenses + inline mutation affordances", () => {
  it("work page reads lens from URL and composes inline actions", () => {
    const page = readFileSync(join(process.cwd(), "src/app/(dashboard)/work/page.tsx"), "utf8");
    expect(page).toMatch(/lens|WORK_HUB|work-hub/i);
    expect(page).toContain("WorkQueueInlineActionsGate");
    expect(page).toContain("ExceptionMutationPanels");
    expect(page).toContain("#contract-evidence");
  });

  it("inline actions pair with eligibility gate for permission clarity", () => {
    const gate = readFileSync(
      join(process.cwd(), "src/components/work/work-queue-inline-actions-gate.tsx"),
      "utf8"
    );
    expect(gate).toContain('from "@/components/work/work-queue-inline-actions"');
    expect(gate.length).toBeGreaterThan(120);
  });

  it("work page passes mutation eligibility into the gate for all queue kinds", () => {
    const page = readFileSync(join(process.cwd(), "src/app/(dashboard)/work/page.tsx"), "utf8");
    const gates = page.match(/WorkQueueInlineActionsGate/g) ?? [];
    expect(gates.length).toBeGreaterThanOrEqual(3);
    expect(page.split("mutationsEnabled={workQueueMutationsEnabled}").length - 1).toBeGreaterThanOrEqual(3);
    expect(page).toContain("blockerHref=");
  });
});
