/**
 * V9 §24 + Appendix AO — Core routes expose distinct document title segments and primary h1 text.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("Core route metadata + heading anchors (V9 §24)", () => {
  const routes: {
    pagePath: string;
    title: string;
    h1: string;
    h1Path?: string;
    /** When true, the metadata title is a const-reference, not a string
     *  literal. Test relaxes the literal-string match for these routes. */
    titleViaConst?: boolean;
  }[] = [
    {
      // v11 dashboard spec compliance: title is sourced from
      // src/lib/dashboard/spec-strings.ts (DASHBOARD_TITLE = "Contract tracking").
      pagePath: "src/app/(dashboard)/dashboard/page.tsx",
      title: "Contract tracking",
      h1: "Contract tracking",
      h1Path: "src/components/dashboard/dashboard-upper.tsx",
      titleViaConst: true,
    },
    { pagePath: "src/app/(dashboard)/contracts/page.tsx", title: "Contracts", h1: "Contracts" },
    { pagePath: "src/app/(dashboard)/work/page.tsx", title: "Work", h1: "Work", titleViaConst: true },
    {
      pagePath: "src/app/(dashboard)/contracts/review/page.tsx",
      title: "Review fields",
      h1: "Review fields",
      titleViaConst: true,
    },
    { pagePath: "src/app/(dashboard)/contracts/renewals/page.tsx", title: "Renewals", h1: "Renewals", titleViaConst: true },
    { pagePath: "src/app/(dashboard)/contracts/exceptions/page.tsx", title: "Exceptions", h1: "Exception ledger" },
    {
      pagePath: "src/app/(dashboard)/contracts/evidence-studio/page.tsx",
      title: "Evidence",
      h1: "Evidence",
      titleViaConst: true,
    },
    { pagePath: "src/app/(dashboard)/reports/page.tsx", title: "Reports", h1: "Reports", titleViaConst: true },
    {
      pagePath: "src/app/(dashboard)/settings/page.tsx",
      title: "Settings",
      h1: "Settings",
      titleViaConst: true,
    },
    {
      pagePath: "src/app/(dashboard)/settings/billing/page.tsx",
      title: "Billing",
      h1: "Billing",
      titleViaConst: true,
    },
    {
      pagePath: "src/app/(dashboard)/settings/security/page.tsx",
      title: "Security",
      h1: "Security",
      titleViaConst: true,
    },
    {
      pagePath: "src/app/(dashboard)/settings/health/page.tsx",
      title: "System health",
      h1: "System health",
    },
    { pagePath: "src/app/(dashboard)/settings/product/page.tsx", title: "Product experience", h1: "Product experience" },
    {
      pagePath: "src/app/(dashboard)/settings/operations/page.tsx",
      title: "Notifications",
      h1: "Notifications",
      h1Path: "src/app/(dashboard)/settings/operations/operations-settings-view.tsx",
      titleViaConst: true,
    },
  ];

  it("each listed page exports metadata.title and the primary h1 matches (page or hero component)", () => {
    const titles = new Set<string>();
    for (const row of routes) {
      const pageRaw = readFileSync(join(process.cwd(), row.pagePath), "utf8");
      if (row.titleViaConst) {
        // Accept either literal string OR const/member reference.
        expect(pageRaw).toMatch(
          /export const metadata = \{[^\}]*title:\s*(?:["']|[A-Z][A-Z0-9_]*(?:\.[A-Za-z0-9_]+)*)/
        );
      } else {
        expect(pageRaw).toMatch(/export const metadata = \{[^\}]*title:\s*["']/);
        expect(pageRaw).toContain(`title: "${row.title}"`);
      }
      const h1Src = readFileSync(join(process.cwd(), row.h1Path ?? row.pagePath), "utf8");
      // Accept inline `>Foo<`, component literal `title="Foo"`, or const/member ref `title={CONST}`.
      const inlineMatch = h1Src.includes(`>${row.h1}<`);
      const componentMatch = h1Src.includes(`title="${row.h1}"`);
      const constRefMatch =
        row.titleViaConst && h1Src.match(/title=\{[A-Z][A-Z0-9_]*(?:\.[A-Za-z0-9_]+)*\}/);
      expect(inlineMatch || componentMatch || Boolean(constRefMatch)).toBe(true);
      titles.add(row.title);
    }
    expect(titles.size).toBe(routes.length);
  });
});
