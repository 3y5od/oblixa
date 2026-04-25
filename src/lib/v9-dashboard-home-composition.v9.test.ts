import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function read(rel: string): string {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

describe("V9 §8 dashboard home — composition + refresh anchors", () => {
  it("composes upper and lower on the dashboard route", () => {
    const page = read("src/app/(dashboard)/dashboard/page.tsx");
    expect(page).toContain("DashboardUpper");
    expect(page).toContain("DashboardLower");
  });

  it("gates portfolio / assurance strips behind non-core home + isHomeBlockAllowed (§8 + §5.4)", () => {
    const page = read("src/app/(dashboard)/dashboard/page.tsx");
    expect(page).toContain("isCoreHome");
    expect(page).toContain("showPortfolioIntel");
    expect(page).toContain("isHomeBlockAllowed");
  });

  it("keeps window-focus refetch in the dashboard shell for §8.7 stability", () => {
    const layout = read("src/app/(dashboard)/layout.tsx");
    expect(layout).toContain("RefetchOnWindowFocus");
    expect(layout).toContain("refetch-on-window-focus");
  });

  it("anchors lower home density lanes (tasks, table, eligibility)", () => {
    const lower = read("src/components/dashboard/dashboard-lower.tsx");
    expect(lower).toContain("MyTasks");
    expect(lower).toContain("ContractTable");
    expect(lower).toContain("isHrefEligibleForProductSurface");
  });

  it("anchors upper home due-soon horizon shared with business dates", () => {
    const upper = read("src/components/dashboard/dashboard-upper.tsx");
    expect(upper).toContain("V9_DUE_SOON_DAYS");
    expect(upper).toContain("isHrefEligibleForProductSurface");
  });

  it("keeps all focus lanes visible instead of silently dropping evidence or recent changes", () => {
    const upper = read("src/components/dashboard/dashboard-upper.tsx");
    expect(upper).toContain('id: "evidence"');
    expect(upper).toContain('id: "recent"');
    expect(upper).not.toContain(".slice(0, 6)");
  });

  it("feeds pinned saved views for dashboard personalization (§8.5)", () => {
    const data = read("src/lib/dashboard-data.ts");
    const upper = read("src/components/dashboard/dashboard-upper.tsx");
    expect(data).toContain("getPinnedSavedViewsCached");
    expect(data).toMatch(/saved_views[\s\S]*pinned/);
    expect(upper).toContain("buildContractsListHref");
  });

  it("keeps pending approvals card pointed at the approvals queue (§8.2 ↔ §12)", () => {
    const upper = read("src/components/dashboard/dashboard-upper.tsx");
    expect(upper).toContain("/contracts/approvals?status=pending");
    expect(upper).toContain("/work?lens=assigned");
  });

  it("aligns recent-changes KPI semantics with the contracts list activity destination", () => {
    const data = read("src/lib/dashboard-data.ts");
    const upper = read("src/components/dashboard/dashboard-upper.tsx");
    expect(data).toContain('.from("contracts")');
    expect(data).toContain('.gte("updated_at", reviewWindowIso)');
    expect(upper).toContain('href: "/contracts?sort=activity"');
  });

  it("keeps dashboard evidence gaps tied to the shared required-or-rejected status helper", () => {
    const data = read("src/lib/dashboard-data.ts");
    expect(data).toContain("EVIDENCE_GAP_STATUSES");
  });
});
