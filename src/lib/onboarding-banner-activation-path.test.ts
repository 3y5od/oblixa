import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * §7.2 activation path — banner rows expose CTAs into calibration, intake, review, work, and dashboard
 * (server-backed stats are wired in dashboard-upper; this test locks stable navigation targets).
 */
describe("onboarding banner activation path anchors (V9 §7.1–7.2)", () => {
  it("links each incomplete step to an operational surface", () => {
    const raw = readFileSync(
      join(process.cwd(), "src/components/dashboard/onboarding-banner.tsx"),
      "utf8"
    );
    expect(raw).toContain('"/onboarding/calibration"');
    expect(raw).not.toContain('"/settings/product"');
    expect(raw).toContain("Review workspace setup");
    expect(raw).toContain('href="/contracts/new"');
    expect(raw).toContain('href: "/contracts/review"');
    expect(raw).toContain('href: "/contracts?sort=activity"');
    expect(raw).toContain("/work?lens=assigned");
    expect(raw).toContain("/contracts/renewals");
    expect(raw).toContain("/contracts/bulk");
    expect(raw).toContain("/contracts/bulk#recent-imports");
    expect(raw).toContain("bulk import status");
    expect(raw).toContain("importJobProcessing");
    expect(raw).toContain('href: "/dashboard"');
    expect(raw).toContain("completeProductOnboarding");
  });

  it("keeps seven tracked activation rows with explicit ordering hook", () => {
    const raw = readFileSync(
      join(process.cwd(), "src/components/dashboard/onboarding-banner.tsx"),
      "utf8"
    );
    expect(raw).toContain("totalSteps = 7");
    expect(raw).toContain("checklistRowOrderFromSetupChecklist");
    expect(raw).toContain("isLateStage");
  });
});
