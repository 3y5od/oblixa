import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function collectDashboardLoadingFiles(dir: string, out: string[]): void {
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, ent.name);
    if (ent.isDirectory()) {
      collectDashboardLoadingFiles(p, out);
    } else if (ent.name === "loading.tsx") {
      out.push(p);
    }
  }
}

describe("dashboard loading and error consistency (V9)", () => {
  it("announces loading state on the main dashboard shells", () => {
    const dashboardShell = readFileSync(
      join(process.cwd(), "src/app/(dashboard)/loading.tsx"),
      "utf8"
    );
    const dashboardPage = readFileSync(
      join(process.cwd(), "src/app/(dashboard)/dashboard/loading.tsx"),
      "utf8"
    );
    const contractsPage = readFileSync(
      join(process.cwd(), "src/app/(dashboard)/contracts/loading.tsx"),
      "utf8"
    );

    expect(dashboardShell).toContain('role="status"');
    expect(dashboardShell).toContain("Loading workspace");
    expect(dashboardPage).toContain("Loading dashboard");
    expect(dashboardPage).toContain('aria-live="polite"');
    expect(contractsPage).toContain("Loading contracts");
    expect(contractsPage).toContain('aria-busy="true"');
  });

  it("uses the same plain-language recovery model across dashboard and onboarding errors", () => {
    const dashboardError = readFileSync(
      join(process.cwd(), "src/app/(dashboard)/error.tsx"),
      "utf8"
    );
    const onboardingError = readFileSync(
      join(process.cwd(), "src/app/(dashboard)/onboarding/error.tsx"),
      "utf8"
    );

    expect(dashboardError).toContain("This page could not load");
    expect(dashboardError).toContain("return to the dashboard");
    expect(onboardingError).toContain("Onboarding could not load");
    expect(onboardingError).toContain("return to the dashboard");
    expect(onboardingError).toContain("captureClientException");
  });

  it("keeps root, global, and marketing errors on the same recovery vocabulary", () => {
    const rootError = readFileSync(join(process.cwd(), "src/app/error.tsx"), "utf8");
    const globalError = readFileSync(join(process.cwd(), "src/app/global-error.tsx"), "utf8");
    const marketingError = readFileSync(join(process.cwd(), "src/app/(marketing)/error.tsx"), "utf8");

    for (const raw of [rootError, globalError, marketingError]) {
      expect(raw).toContain("This page could not load");
      expect(raw).toMatch(/Try again/i);
    }
    expect(rootError).toContain("Dashboard");
    expect(globalError).toContain('href="/dashboard"');
    expect(marketingError).toContain("home page");
  });

  it("crawls every (dashboard) segment loading.tsx for §21.1–21.2 status + busy semantics", () => {
    const root = join(process.cwd(), "src/app/(dashboard)");
    const absPaths: string[] = [];
    collectDashboardLoadingFiles(root, absPaths);
    expect(absPaths.length).toBeGreaterThanOrEqual(15);
    for (const abs of absPaths.sort()) {
      const rel = abs.replace(process.cwd() + "/", "");
      const src = readFileSync(abs, "utf8");
      expect(src, rel).toContain('role="status"');
      expect(src, rel).toContain('aria-live="polite"');
      expect(src, rel).toContain('aria-busy="true"');
    }
  });

  it("keeps contracts, work, and review loading trees aligned to their shell geometry", () => {
    const contractsLoading = readFileSync(join(process.cwd(), "src/app/(dashboard)/contracts/loading.tsx"), "utf8");
    const workLoading = readFileSync(join(process.cwd(), "src/app/(dashboard)/work/loading.tsx"), "utf8");
    const reviewLoading = readFileSync(join(process.cwd(), "src/app/(dashboard)/contracts/review/loading.tsx"), "utf8");

    expect(contractsLoading).toContain("ui-page-header");
    // v16: stat strip + next-actions tiles dropped; skeleton mirrors the slim
    // toolbar + quick-filter chip strip + single table block.
    expect(contractsLoading).toContain("rounded-full");
    expect(contractsLoading).toContain("ui-skeleton h-96 rounded-2xl");

    expect(workLoading).toContain("ui-page-header");
    expect(workLoading).toContain("ui-page-shell");
    expect(workLoading).toContain("lg:grid-cols-2");

    // Review loading was migrated to the unified card-raised + flat-identity skeleton vocabulary.
    expect(reviewLoading).toContain("ui-card-raised");
    expect(reviewLoading).toContain("ui-skeleton h-10 w-10 rounded-xl");
    expect(reviewLoading).toContain("xl:grid-cols-4");
    expect(reviewLoading).not.toContain("ui-page-header flex flex-col gap-6");
    expect(reviewLoading).not.toContain("ui-card-hero");
    expect(reviewLoading).not.toContain("grid grid-cols-3 gap-2");
    expect(reviewLoading).not.toContain("ui-page-header-compact");
  });

  it("renders the dashboard composition through the Core dashboard model (v22: triage moved into spec sections)", () => {
    const dashboardPage = readFileSync(
      join(process.cwd(), "src/app/(dashboard)/dashboard/page.tsx"),
      "utf8"
    );
    // v22 structural refactor: the standalone <OperationalTriagePanel> +
    // v10HasActiveTriageItems gating was rolled into the canonical Core
    // dashboard composition. Active items now surface through the 5 spec
    // main sections (Review Queue, Upcoming Deadlines, Work Needing
    // Action, Data Gaps, Recent Activity) + the partial-data notice — the
    // panel concept is gone, the data flow is owned by the Core model
    // layer. Verify the page delegates to <CoreDashboard> + loads via
    // loadCoreDashboardModel.
    expect(dashboardPage).toContain("<CoreDashboard");
    expect(dashboardPage).toContain("loadCoreDashboardModel");
  });
});
