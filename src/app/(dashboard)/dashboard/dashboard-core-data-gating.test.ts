import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * product-surface policy §8 / §21.1 — Core home must not execute assurance portfolio data fetches;
 * heavy queries stay under `productSurface.mode === "assurance"` branches.
 */
const DASHBOARD_PAGE = join(process.cwd(), "src/app/(dashboard)/dashboard/page.tsx");

describe("dashboard Core vs assurance data gating (source tripwire)", () => {
  it("assurance-only Supabase reads and analytics calls appear only after assurance mode checks", () => {
    const raw = readFileSync(DASHBOARD_PAGE, "utf8");
    const needles = [
      '.from("assurance_findings")',
      '.from("assurance_scorecards")',
      '.from("adaptive_playbook_runs")',
      '.from("portfolio_health_graph_edges")',
      '.from("control_policies")',
      '.from("assurance_check_runs")',
      "buildAssuranceAnalyticsSummary(",
      "computeOutcomeViews(",
      "listOutcomeInterventionsPaginated(",
    ];
    for (const n of needles) {
      let idx = 0;
      while ((idx = raw.indexOf(n, idx)) !== -1) {
        const windowStart = Math.max(0, idx - 4800);
        const slice = raw.slice(windowStart, idx);
        expect(
          slice.includes('productSurface.mode === "assurance"'),
          `Expected "${n}" to sit after an assurance mode gate (near index ${idx})`
        ).toBe(true);
        idx += n.length;
      }
    }
  });
});
