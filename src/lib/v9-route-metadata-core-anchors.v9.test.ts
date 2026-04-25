/**
 * V9 §24 + Appendix AO — Core routes expose distinct document title segments and primary h1 text.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("Core route metadata + heading anchors (V9 §24)", () => {
  const routes: { pagePath: string; title: string; h1: string; h1Path?: string }[] = [
    {
      pagePath: "src/app/(dashboard)/dashboard/page.tsx",
      title: "Dashboard",
      h1: "Dashboard",
      h1Path: "src/components/dashboard/dashboard-upper.tsx",
    },
    { pagePath: "src/app/(dashboard)/contracts/page.tsx", title: "Contracts", h1: "Contracts" },
    { pagePath: "src/app/(dashboard)/work/page.tsx", title: "Work queue", h1: "Work Queue" },
    { pagePath: "src/app/(dashboard)/contracts/review/page.tsx", title: "Review queue", h1: "Review queue" },
    { pagePath: "src/app/(dashboard)/contracts/renewals/page.tsx", title: "Renewals", h1: "Renewals workspace" },
    { pagePath: "src/app/(dashboard)/contracts/exceptions/page.tsx", title: "Exceptions", h1: "Exception ledger" },
    { pagePath: "src/app/(dashboard)/contracts/evidence-studio/page.tsx", title: "Evidence studio", h1: "Evidence studio" },
    { pagePath: "src/app/(dashboard)/reports/page.tsx", title: "Operational reports", h1: "Operational reports" },
    {
      pagePath: "src/app/(dashboard)/settings/health/page.tsx",
      title: "System health",
      h1: "System health transparency",
    },
    { pagePath: "src/app/(dashboard)/settings/product/page.tsx", title: "Product experience", h1: "Product experience" },
    { pagePath: "src/app/(dashboard)/settings/operations/page.tsx", title: "Workflow configuration", h1: "Workflow configuration" },
  ];

  it("each listed page exports metadata.title and the primary h1 matches (page or hero component)", () => {
    const titles = new Set<string>();
    for (const row of routes) {
      const pageRaw = readFileSync(join(process.cwd(), row.pagePath), "utf8");
      expect(pageRaw).toMatch(/export const metadata = \{[^\}]*title:\s*["']/);
      expect(pageRaw).toContain(`title: "${row.title}"`);
      const h1Src = readFileSync(join(process.cwd(), row.h1Path ?? row.pagePath), "utf8");
      expect(h1Src).toContain(`>${row.h1}<`);
      titles.add(row.title);
    }
    expect(titles.size).toBe(routes.length);
  });
});
