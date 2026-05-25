import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function read(rel: string): string {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

describe("dashboard home - Core composition and refresh anchors", () => {
  it("composes the Core dashboard model and renderer on the dashboard route", () => {
    const page = read("src/app/(dashboard)/dashboard/page.tsx");
    expect(page).toContain("CoreDashboard");
    expect(page).toContain("loadCoreDashboardModel");
    expect(page).not.toContain("DashboardUpper");
    expect(page).not.toContain("DashboardLower");
  });

  it("keeps window-focus refetch in the dashboard shell for route stability", () => {
    const layout = read("src/app/(dashboard)/layout.tsx");
    expect(layout).toContain("RefetchOnWindowFocus");
    expect(layout).toContain("refetch-on-window-focus");
  });

  it("keeps all six release-state cards visible in fixed model order", () => {
    const model = read("src/lib/dashboard/core-dashboard-model.ts");
    const component = read("src/components/dashboard/core-dashboard.tsx");
    expect(model).toContain("const TOP_CARD_ORDER");
    expect(model).toContain('"needs_review"');
    expect(model).toContain('"upcoming_deadlines"');
    expect(model).toContain('"blocked_work"');
    expect(model).toContain('"missing_owners"');
    expect(model).toContain('"open_exceptions"');
    expect(model).toContain('"evidence_requested"');
    expect(component).toContain("model.topCards.map");
  });

  it("keeps the five Core dashboard sections as the only main surface", () => {
    const model = read("src/lib/dashboard/core-dashboard-model.ts");
    const component = read("src/components/dashboard/core-dashboard.tsx");
    expect(model).toContain("DASHBOARD_MAIN_SECTIONS[0]");
    expect(model).toContain("DASHBOARD_MAIN_SECTIONS[4]");
    expect(component).toContain("orderedSections.map");
    expect(component).toContain('getSection(model, "review_queue")');
    expect(component).toContain('getSection(model, "recent_activity")');
    expect(component).not.toContain("ContractTable");
  });

  it("uses visible V10 read models for work, evidence, and activity data", () => {
    const model = read("src/lib/dashboard/core-dashboard-model.ts");
    expect(model).toContain("applyV10ReadModelVisibility");
    expect(model).toContain('from("v10_work_items")');
    expect(model).toContain('from("v10_evidence_request_statuses")');
    expect(model).toContain('from("v10_contract_activity_events")');
  });
});
