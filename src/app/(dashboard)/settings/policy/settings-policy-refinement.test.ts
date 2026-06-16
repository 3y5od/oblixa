import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const OVERVIEW = join(process.cwd(), "src/app/(dashboard)/settings/policy/page.tsx");
const OVERVIEW_SECTIONS = join(process.cwd(), "src/app/(dashboard)/settings/policy/policy-page-sections.tsx");
const REGISTRY = join(process.cwd(), "src/app/(dashboard)/settings/policy/registry/page.tsx");
const REGISTRY_FORM = join(
  process.cwd(),
  "src/app/(dashboard)/settings/policy/registry/policy-registry-editor-form.tsx"
);
const DIAGNOSTICS = join(process.cwd(), "src/app/(dashboard)/settings/policy/diagnostics/page.tsx");
const SIMULATION_PANEL = join(process.cwd(), "src/components/policy-simulation-panel.tsx");

describe("settings policy refinement", () => {
  it("keeps the default policy page user-facing", () => {
    const raw = [readFileSync(OVERVIEW, "utf8"), readFileSync(OVERVIEW_SECTIONS, "utf8")].join("\n");
    expect(raw).toContain("Workflow policies");
    expect(raw).toContain("Internal settings");
    expect(raw).toContain("Private policy controls for approvals, reminders, evidence, and review workflow compatibility.");
    expect(raw).toContain("Advanced policy editor");
    expect(raw).toContain('mode="preview"');
    expect(raw).not.toContain("Policy registry & simulation");
    expect(raw).not.toContain("sla_hours");
    expect(raw).not.toContain("approval_slas");
    expect(raw).not.toContain("cron");
    expect(raw).not.toContain("without writes");
  });

  it("keeps raw registry editing on the advanced route", () => {
    const raw = [readFileSync(REGISTRY, "utf8"), readFileSync(REGISTRY_FORM, "utf8")].join("\n");
    expect(raw).toContain("Advanced policy editor");
    expect(raw).toContain("Registry JSON");
    expect(raw).toContain("Save registry");
    expect(raw).toContain("registryJson");
    expect(raw).toContain("Duplicate id values");
    expect(raw).toContain("Draft is not valid JSON.");
    expect(raw).toContain("ctx.role !== \"admin\"");
  });

  it("keeps the advanced registry textarea programmatically labelled", () => {
    const raw = readFileSync(REGISTRY_FORM, "utf8");
    expect(raw).toContain("useId");
    expect(raw).toContain("htmlFor={registryTextareaId}");
    expect(raw).toContain("id={registryTextareaId}");
    expect(raw).toContain("aria-describedby={validationMessageId}");
  });

  it("keeps implementation diagnostics isolated on the diagnostics route", () => {
    const raw = readFileSync(DIAGNOSTICS, "utf8");
    expect(raw).toContain("Policy diagnostics");
    expect(raw).toContain("sla_hours");
    expect(raw).toContain("approval_slas");
    expect(raw).toContain("cron");
    expect(raw).toContain("POST /api/policy/simulate");
    expect(raw).toContain("ctx.role !== \"admin\"");
    expect(raw).toContain('mode="diagnostics"');
    expect(raw).toContain("Workflow policies");
  });

  it("uses preview language for the user-facing simulation panel", () => {
    const raw = readFileSync(SIMULATION_PANEL, "utf8");
    expect(raw).toContain("Preview impact");
    expect(raw).toContain("Preview only");
    expect(raw).toContain("Optional draft registry JSON");
    expect(raw).toContain('mode === "diagnostics"');
  });

  it("keeps simulation controls programmatically labelled", () => {
    const raw = readFileSync(SIMULATION_PANEL, "utf8");
    expect(raw).toContain("useId");
    expect(raw).toContain("htmlFor={contractSelectId}");
    expect(raw).toContain("id={contractSelectId}");
    expect(raw).toContain("htmlFor={draftTextareaId}");
    expect(raw).toContain("id={draftTextareaId}");
  });
});
