import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const INTERNAL_DIAGNOSTICS = join(process.cwd(), "src/app/(dashboard)/settings/health/diagnostics/page.tsx");
const HEALTH_SOURCE_FILES = [
  "src/app/(dashboard)/settings/health/page.tsx",
  "src/app/(dashboard)/settings/health/settings-health-page-model.ts",
  "src/app/(dashboard)/settings/health/settings-health-hero.tsx",
  "src/app/(dashboard)/settings/health/settings-health-recovery-actions.tsx",
  "src/app/(dashboard)/settings/health/settings-health-healthy-checks.tsx",
  "src/app/(dashboard)/settings/health/settings-health-support-disclosure.tsx",
  "src/app/(dashboard)/settings/health/settings-health-diagnostics-sections.tsx",
];

describe("settings health recoverability coverage (V10)", () => {
  it("keeps reminder recovery visible while removing internal route diagnostics from the default surface", () => {
    const raw = HEALTH_SOURCE_FILES.map((file) => readFileSync(join(process.cwd(), file), "utf8")).join("\n");
    expect(raw).toContain("Workflow reliability, delivery status, and configuration issues");
    expect(raw).toContain("Automated recovery");
    expect(raw).toContain('id: "automated-recovery"');
    expect(raw).toContain("No recovery heartbeat recorded");
    expect(raw).toContain("Inspect recovery settings");
    expect(raw).not.toContain("API route health");
    expect(raw).not.toContain("Critical product path hooks");
    expect(raw).not.toContain('/api/notifications/retry-deliveries');
    expect(raw).toContain("Review renewals");
    expect(raw).not.toContain("Payload boundary");
    expect(raw).not.toContain("Evidence scope");
    expect(raw).toContain('<details id="support"');
    expect(raw).toContain("workflow check");
    expect(raw).toContain("are clear");
    expect(raw).toContain("capability: \"settings_manage\"");
  });

  it("moves internal route and release diagnostics to the diagnostics route", () => {
    const raw = readFileSync(INTERNAL_DIAGNOSTICS, "utf8");
    expect(raw).toContain("Internal route, release, recovery, and implementation diagnostics");
    expect(raw).toContain("/api/notifications/retry-deliveries");
    expect(raw).toContain("Release readiness");
    expect(raw).toContain("rollback:");
  });
});
