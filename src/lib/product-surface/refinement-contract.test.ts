/**
 * Automated checks for product-surface policy checklist items (supplements E2E + audits).
 * §23: this file asserts containment/gating — it does not delete routes or schemas.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { NAV_ITEMS, PRIMARY_NAV_GROUPS } from "@/lib/navigation";
import {
  REFINEMENT_CONTEXTUAL_ENTRY_ANCHORS,
  REFINEMENT_LAYER2_ANCHORS,
  REFINEMENT_LAYER3_ANCHORS,
  REFINEMENT_OBJECTIVES,
  REFINEMENT_V7_TRACE_STRINGS,
} from "@/lib/product-surface/refinement-trace";

/** product-surface policy §3 — stable checklist strings for PR traceability. */
const EXPECTED_REFINEMENT_OBJECTIVES = [
  "Clearer primary surface",
  "Progressive disclosure",
  "Stronger information hierarchy",
  "Fewer top-level concepts",
  "More consistent naming",
  "Better defaults",
  "Stronger quality/polish on visible surfaces",
] as const;
import { buildProductSurfaceContext, parseWorkspaceMode } from "@/lib/product-surface/context";
import { ROUTE_INVENTORY } from "@/lib/product-surface/route-inventory";
import { filterNavBadgesForSurface } from "@/lib/product-surface/nav-visibility";
import type { NavSurfaceInput } from "@/lib/product-surface/nav-visibility";
import type { FeatureFlagKey } from "@/lib/feature-flags";

function primaryHrefs(): Set<string> {
  return new Set(
    NAV_ITEMS.filter((i) => i.section === "primary").map((i) => (i.href.split("?")[0] ?? i.href).toLowerCase())
  );
}

/** Primary items plus release-state sidebar children and non-Core operations queue links. */
function discoverableNavHrefs(): Set<string> {
  const s = new Set<string>();
  for (const i of NAV_ITEMS) {
    s.add((i.href.split("?")[0] ?? i.href).toLowerCase());
    for (const c of i.navChildren ?? []) {
      s.add((c.href.split("?")[0] ?? c.href).toLowerCase());
    }
  }
  return s;
}

describe("refinement §2 primary story routes", () => {
  it("maps release-state Core narrative centers to public nav targets", () => {
    const p = primaryHrefs();
    const nav = discoverableNavHrefs();
    const ops = new Set(
      NAV_ITEMS.filter((i) => i.section === "operations").map((i) => (i.href.split("?")[0] ?? i.href).toLowerCase())
    );
    const has = (href: string) => p.has(href) || ops.has(href) || nav.has(href);
    expect(has("/contracts")).toBe(true);
    expect(has("/contracts/review")).toBe(true);
    expect(has("/work")).toBe(true);
    expect(has("/contracts/renewals")).toBe(true);
    expect(has("/contracts/evidence-studio")).toBe(true);
    expect(has("/reports") || has("/contracts/reports")).toBe(true);
    expect(has("/contracts/tasks")).toBe(false);
    const corePatterns = new Set(
      ROUTE_INVENTORY.filter((e) => e.tier === "core").map((e) => e.pattern.toLowerCase())
    );
    expect(corePatterns.has("/contracts/new")).toBe(true);
  });
});

describe("refinement §7.1 primary nav workspace group order", () => {
  it("matches v11 dashboard spec compliance: Dashboard → Contracts → Work → Renewals → Evidence → Reports → Settings", () => {
    // v11 dashboard spec compliance: Renewals + Evidence promoted to top-level
    // per docs/oblixa-release-state.md §In-App Pages (7 Core nav items).
    const workspace = PRIMARY_NAV_GROUPS.find((g) => g.label === "Workspace");
    expect(workspace?.hrefs).toEqual([
      "/dashboard",
      "/contracts",
      "/work",
      "/contracts/renewals",
      "/contracts/evidence-studio",
      "/reports",
      "/settings",
    ]);
  });
});

describe("refinement §5 layer anchors", () => {
  it("documents Layer 2 and Layer 3 implementation paths for traceability", () => {
    expect(REFINEMENT_LAYER2_ANCHORS.length).toBeGreaterThanOrEqual(6);
    expect(REFINEMENT_LAYER3_ANCHORS.length).toBeGreaterThanOrEqual(3);
  });
});

describe("refinement §14 contextual entry anchors", () => {
  it("lists each spec example with an implementation pointer", () => {
    expect(REFINEMENT_CONTEXTUAL_ENTRY_ANCHORS.length).toBeGreaterThanOrEqual(6);
  });
});

describe("refinement §3 objectives", () => {
  it("exports seven PR-checklist priorities", () => {
    expect(REFINEMENT_OBJECTIVES).toHaveLength(7);
  });

  it("keeps REFINEMENT_OBJECTIVES aligned with product-surface policy §3 wording", () => {
    expect([...REFINEMENT_OBJECTIVES]).toEqual([...EXPECTED_REFINEMENT_OBJECTIVES]);
  });
});

describe("v7 product-surface trace strings", () => {
  it("keeps explicit V7 acceptance anchors for registry, eligibility, and diagnostics", () => {
    expect(REFINEMENT_V7_TRACE_STRINGS).toHaveLength(7);
    expect(REFINEMENT_V7_TRACE_STRINGS).toContain("Registry-first feature ownership");
    expect(REFINEMENT_V7_TRACE_STRINGS).toContain(
      "Route/API/server-action guards with mismatch policy"
    );
  });

  it("anchors V7 automation entrypoints on disk (traceability)", () => {
    const paths = [
      "scripts/audit-compatibility-cross-surface-hrefs.mjs",
      "scripts/check-product-surface-compatibility-vocabulary.mjs",
      "src/lib/product-surface/compatibility-vocabulary-consistency.test.ts",
      "src/lib/product-surface/workspace-settings-module-labels.ts",
      "src/lib/product-surface/href-eligibility-registry-compatibility.test.ts",
      "src/lib/product-surface/more-index-header-parity.test.ts",
      "src/lib/product-surface/api-workspace-guard-compatibility-matrix.test.ts",
      "src/lib/observability/sentry-product-surface-breadcrumb.test.ts",
      "src/lib/integrations/calendar-compatibility.test.ts",
      "src/lib/marketing/robots-route-inventory.test.ts",
      "src/lib/marketing/proxy-public-paths-alignment.test.ts",
      "src/components/settings/billing-stripe-surface.test.ts",
      "src/lib/extraction/extraction-user-messages.test.ts",
      "src/app/(dashboard)/settings/operations/settings-operations-surface.test.ts",
      "src/lib/product-surface/api-error-json-core-compatibility.test.ts",
      "src/app/(dashboard)/contracts/reports/contracts-reports-pack-surface.test.ts",
      "src/lib/qa/dashboard-shell-copy.test.ts",
    ];
    for (const rel of paths) {
      const raw = readFileSync(join(process.cwd(), rel), "utf8");
      expect(raw.length, rel).toBeGreaterThan(20);
    }
  });
});

describe("refinement §10 route inventory", () => {
  it("includes appendix edge paths and every §10.1 core pattern", () => {
    const patterns = new Set(ROUTE_INVENTORY.map((e) => e.pattern));
    expect(patterns.has("/dashboard/persona")).toBe(true);
    expect(patterns.has("/settings/security")).toBe(true);
    expect(patterns.has("/settings/health")).toBe(true);
    expect(patterns.has("/settings/policy")).toBe(true);
    expect(patterns.has("/settings/product")).toBe(true);
    expect(patterns.has("/more")).toBe(true);
  });
});

describe("refinement §12.4 / §19 nav badges", () => {
  it("filterNavBadgesForSurface zeroes watchlists on Core even with counts", () => {
    const surface: NavSurfaceInput = {
      mode: "core",
      role: "editor",
      featureFlags: {} as Record<FeatureFlagKey, boolean>,
      seesAdvancedPrimaryNav: false,
      seesAssuranceNav: false,
      advancedModulesHidden: [],
      assuranceModulesHidden: [],
      utilityModulesHidden: [],
      searchScope: "match_mode",
    };
    const out = filterNavBadgesForSurface({ watchlists: 9, reviewQueue: 2, approvals: 1 }, surface);
    expect(out.watchlists).toBeUndefined();
    expect(out.reviewQueue).toBeGreaterThan(0);
    expect(out.approvals).toBeUndefined();
  });
});

describe("refinement §7.3 Assurance nav href order", () => {
  it("matches product-surface policy (findings through health graph)", () => {
    const assurance = NAV_ITEMS.find((i) => i.name === "Assurance");
    const hrefs =
      assurance?.navChildren?.map((c) => (c.href.split("?")[0] ?? c.href).toLowerCase()) ?? [];
    expect(hrefs).toEqual([
      "/assurance/findings",
      "/assurance/control-policies",
      "/assurance/scorecards",
      "/assurance/playbooks",
      "/assurance/review-boards",
      "/assurance/autopilot",
      "/assurance/segments",
      "/assurance/program-evolution",
      "/assurance/health-graph",
    ]);
  });
});

describe("refinement §7.3 Advanced workspace", () => {
  it("does not surface Assurance primary nav without Assurance mode", () => {
    const ctx = buildProductSurfaceContext({
      orgId: "o1",
      role: "manager",
      v6: { workspace_mode: "advanced" },
      featureFlags: {} as Record<FeatureFlagKey, boolean>,
    });
    expect(ctx.mode).toBe("advanced");
    expect(ctx.seesAssuranceNav).toBe(false);
  });
});

describe("refinement §13.1 / §17 defaults (product surface context)", () => {
  it("parseWorkspaceMode defaults missing/invalid to core", () => {
    expect(parseWorkspaceMode({})).toBe("core");
    expect(parseWorkspaceMode({ workspace_mode: "typo" as never })).toBe("core");
  });

  it("Core + editor does not see Assurance nav without admin testing", () => {
    const ctx = buildProductSurfaceContext({
      orgId: "o1",
      role: "editor",
      v6: { workspace_mode: "core" },
      featureFlags: {} as Record<FeatureFlagKey, boolean>,
    });
    expect(ctx.mode).toBe("core");
    expect(ctx.seesAssuranceNav).toBe(false);
    expect(ctx.seesAdvancedPrimaryNav).toBe(false);
  });

  it("Assurance mode enables assurance nav for manager default", () => {
    const ctx = buildProductSurfaceContext({
      orgId: "o1",
      role: "manager",
      v6: { workspace_mode: "assurance" },
      featureFlags: {} as Record<FeatureFlagKey, boolean>,
    });
    expect(ctx.seesAssuranceNav).toBe(true);
    expect(ctx.seesAdvancedPrimaryNav).toBe(true);
  });

  it("Assurance mode with empty assurance_nav_roles limits Assurance nav to admin", () => {
    const editor = buildProductSurfaceContext({
      orgId: "o1",
      role: "editor",
      v6: { workspace_mode: "assurance", assurance_nav_roles: [] },
      featureFlags: {} as Record<FeatureFlagKey, boolean>,
    });
    expect(editor.seesAssuranceNav).toBe(false);
    const admin = buildProductSurfaceContext({
      orgId: "o1",
      role: "admin",
      v6: { workspace_mode: "assurance", assurance_nav_roles: [] },
      featureFlags: {} as Record<FeatureFlagKey, boolean>,
    });
    expect(admin.seesAssuranceNav).toBe(true);
  });
});
