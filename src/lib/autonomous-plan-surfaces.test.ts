import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { WORK_TAB_ORDER } from "./work/model";
import { parseContractListSort } from "./contract-list-id-filters";
import { V9_ACTIVATION_PATH, V9_NOTIFICATION_CLASSES } from "./compatibility-release-contract";

function read(rel: string): string {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

describe("V9 autonomous plan — surface proxies (§7–§27 + matrices)", () => {
  describe("§7 activation anchors", () => {
    it("keeps activation path intent codified", () => {
      expect(V9_ACTIVATION_PATH).toContain("importing or uploading the first contract");
      expect(V9_ACTIVATION_PATH).toContain("reviewing key extracted fields");
      expect(V9_ACTIVATION_PATH).toContain("returning to a useful dashboard");
    });

    it("anchors onboarding checklist + telemetry surfaces", () => {
      expect(read("src/actions/onboarding-calibration.ts").length).toBeGreaterThan(500);
      expect(read("src/components/dashboard/onboarding-banner.tsx")).toContain("onboarding");
    });
  });

  describe("§8.2 dashboard — eight home card ids + deep links", () => {
    it("defines eight operational focus cards with filtered destinations", () => {
      const upper = read("src/components/dashboard/dashboard-upper.tsx");
      const ids = [
        "assigned-work",
        "due-soon",
        "approvals",
        "renewals",
        "exceptions",
        "evidence",
        "review",
        "recent",
      ];
      for (const id of ids) {
        expect(upper).toContain(`id: "${id}"`);
      }
      expect(upper).toContain('href: "/work?lens=assigned"');
      expect(upper).toContain('href: "/contracts/review"');
      expect(upper).toContain('href: "/contracts?sort=activity"');
    });
  });

  describe("§9 contract list — default sort + row signals", () => {
    it("defaults operational sort to activity (not naive created-only)", () => {
      expect(parseContractListSort(undefined)).toBe("activity");
      expect(parseContractListSort("created")).toBe("created");
    });

    it("anchors row signal computation", () => {
      expect(existsSync(join(process.cwd(), "src/lib/contract-list-row-signals.ts"))).toBe(true);
      expect(read("src/components/contracts/contract-table.tsx")).toContain("ContractTable");
    });
  });

  describe("§10 contract detail", () => {
    it("anchors above-fold summary on detail page", () => {
      const page = read("src/app/(dashboard)/contracts/[id]/page.tsx");
      expect(page).toMatch(/owner|Owner/i);
      expect(page).toMatch(/status|Status/i);
    });
  });

  describe("§11 review + §11.2 field states", () => {
    it("anchors field review + feedback tests", () => {
      expect(read("src/components/contracts/field-review.tsx").length).toBeGreaterThan(200);
      expect(existsSync(join(process.cwd(), "src/lib/review-feedback.test.ts"))).toBe(true);
    });
  });

  describe("§12 Work — release-state tabs", () => {
    it("exports release-state Work tabs matching spec", () => {
      expect([...WORK_TAB_ORDER]).toEqual([
        "all",
        "my_work",
        "overdue",
        "blocked",
        "approvals",
        "obligations",
        "exceptions",
      ]);
    });
  });

  describe("§13–§15 renewals / exceptions / evidence", () => {
    it("anchors renewal next action + exceptions + evidence studio", () => {
      expect(read("src/lib/renewal-next-action.ts").length).toBeGreaterThan(80);
      expect(read("src/lib/exception-priority.ts").length).toBeGreaterThan(40);
      expect(existsSync(join(process.cwd(), "src/app/(dashboard)/contracts/evidence-studio/page.tsx"))).toBe(
        true
      );
    });
  });

  describe("§16 search — dual channel files", () => {
    it("anchors CmdK + in-page search jumps", () => {
      expect(read("src/components/layout/command-palette.tsx").length).toBeGreaterThan(200);
      expect(read("src/lib/product-surface/cmdk-search-jumps.ts")).toContain("contracts");
    });
  });

  describe("§17 import / extraction trust", () => {
    it("anchors import visibility + extraction pipeline", () => {
      expect(existsSync(join(process.cwd(), "src/lib/import-job-visibility.test.ts"))).toBe(true);
      expect(read("src/lib/extraction/run-pipeline.ts").length).toBeGreaterThan(200);
    });
  });

  describe("§18 notifications — §18.2 seven classes (delivery surfaces)", () => {
    it("preserves seven notification class lines and anchors delivery visibility", () => {
      expect(V9_NOTIFICATION_CLASSES).toHaveLength(7);
      const vis = read("src/lib/reminder-delivery-visibility.ts").toLowerCase();
      expect(vis).toContain("reminder");
      expect(vis).toContain("delivery");
    });
  });

  describe("§19 reports / exports", () => {
    it("anchors reports page + export API tests", () => {
      expect(read("src/app/(dashboard)/reports/page.tsx").length).toBeGreaterThan(200);
      expect(existsSync(join(process.cwd(), "src/app/api/export/contracts/route.test.ts"))).toBe(true);
    });
  });

  describe("§20 empty states", () => {
    it("anchors shared EmptyState primitive", () => {
      expect(read("src/components/ui/empty-state.tsx")).toContain("function EmptyState");
    });
  });

  describe("§21 loading + §22 errors", () => {
    it("anchors loading/error consistency + recoverable errors", () => {
      expect(existsSync(join(process.cwd(), "src/app/(dashboard)/loading-error-consistency.test.ts"))).toBe(
        true
      );
      expect(read("src/lib/recoverable-mutation-error.ts").length).toBeGreaterThan(100);
      expect(read("src/lib/api-client-errors.ts").length).toBeGreaterThan(80);
    });
  });

  describe("§23 performance + §27 reliability copy", () => {
    it("anchors page-load reporter + job lifecycle copy", () => {
      expect(read("src/components/layout/page-load-reporter.tsx")).toContain("MEASURED_PREFIXES");
      expect(read("src/lib/job-lifecycle-copy.ts").length).toBeGreaterThan(80);
      expect(read("src/lib/data-freshness.ts").length).toBeGreaterThan(40);
    });
  });

  describe("§24 vocabulary — seven Core nouns in primary nav labels", () => {
    it("retains canonical nouns on primary nav items", () => {
      const nav = read("src/lib/navigation.ts");
      const normalizedNav = nav.toLowerCase();
      for (const w of ["Contracts", "Review", "Work", "Renewals", "Exceptions", "Evidence", "Reports"]) {
        expect(normalizedNav).toContain(w.toLowerCase());
      }
    });
  });

  describe("§25 CmdK dialog accessibility anchor", () => {
    it("keeps command palette UI test with dialog semantics", () => {
      const t = read("src/components/layout/command-palette.ui.test.tsx");
      expect(t).toMatch(/dialog|aria-modal|Command palette/i);
    });
  });

  describe("§3 permissions-visible UI", () => {
    it("anchors eligibility hint + inline action gate", () => {
      expect(read("src/components/ui/permission-eligibility-hint.tsx")).toContain("PermissionEligibilityHint");
      expect(read("src/components/work/work-queue-inline-actions.tsx")).toContain("PermissionEligibilityHint");
      expect(existsSync(join(process.cwd(), "src/components/work/work-queue-inline-actions-gate.tsx"))).toBe(
        true
      );
    });
  });

  describe("§12.3 work actions — inline affordances", () => {
    it("anchors complete/approve style actions on work inline component", () => {
      const w = read("src/components/work/work-queue-inline-actions.tsx").toLowerCase();
      expect(w).toMatch(/complete|approve|assign/);
    });
  });

  describe("§22.3 recovery vocabulary", () => {
    it("recoverable mutation helper mentions retry-style recovery", () => {
      const r = read("src/lib/recoverable-mutation-error.ts").toLowerCase();
      expect(r).toMatch(/retry|again|shortly/);
    });
  });

  describe("Core subroutes completeness", () => {
    it("maps bulk, review, evidence-studio, contract detail", () => {
      for (const p of [
        "src/app/(dashboard)/contracts/bulk/page.tsx",
        "src/app/(dashboard)/contracts/review/page.tsx",
        "src/app/(dashboard)/contracts/evidence-studio/page.tsx",
        "src/app/(dashboard)/contracts/[id]/page.tsx",
      ]) {
        expect(existsSync(join(process.cwd(), p)), p).toBe(true);
      }
    });
  });

  describe("Queue primitives", () => {
    it("QueueItemCard exposes title, status, nextAction", () => {
      const q = read("src/components/ui/queue-item-card.tsx");
      expect(q).toContain("nextAction");
      expect(q).toContain("statusLabel");
    });
  });

  describe("Saved views / tasks automation (Core trace)", () => {
    it("keeps server modules discoverable for refinement gating", () => {
      expect(existsSync(join(process.cwd(), "src/actions/saved-views.ts"))).toBe(true);
      expect(existsSync(join(process.cwd(), "src/actions/tasks-automation.ts"))).toBe(true);
    });
  });

  describe("§29.2 extended regression — security guard on disk", () => {
    it("retains v9-security-surface-guard for hidden-family + cmdk compliance", () => {
      expect(read("src/lib/security-surface-guard.test.ts").length).toBeGreaterThan(200);
    });
  });

  describe("§28.3 dual emission inventory (legacy audit tests)", () => {
    it("retains onboarding audit inventory tests", () => {
      expect(existsSync(join(process.cwd(), "src/actions/onboarding-audit-inventory.test.ts"))).toBe(true);
    });
  });

  describe("Cron / background §3 anchor", () => {
    it("package.json retains cron route auth check script", () => {
      const pkg = JSON.parse(read("package.json")) as { scripts: Record<string, string> };
      expect(pkg.scripts["check:cron-route-auth"]).toContain("check-cron-route-auth");
    });
  });

  describe("Filter crosswalk (partial equivalence)", () => {
    it("contracts list shares owner/status vocabulary with other Core lists", () => {
      const c = read("src/app/(dashboard)/contracts/page.tsx");
      expect(c).toContain("owner");
      expect(c).toContain("status");
    });
  });

  describe("Optimistic UI inventory (§21.3 proxy)", () => {
    it("lists known transition-wrapped mutation surfaces (rollback via router refresh / revalidate)", () => {
      expect(read("src/components/contracts/field-review.tsx")).toContain("startTransition");
      expect(read("src/components/work/work-queue-inline-actions.tsx")).toContain("startTransition");
      expect(read("src/components/contracts/upload-form.tsx")).toContain("startTransition");
    });
  });
});
