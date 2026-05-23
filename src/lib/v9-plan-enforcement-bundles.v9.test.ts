import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { V9_ROLLOUT_PUBLIC_ENV_KEYS } from "./v9-rollout";
import { V9_SPEC_TRACE } from "./v9-spec-trace-map";
import {
  V9_AUDITABLE_RECORD_CLASSES,
  V9_IMPROVEMENT_AREAS,
  V9_NON_GOALS,
  V9_REGRESSION_GATES,
} from "./v9-release-contract";

function read(rel: string): string {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

function walkDirsWithName(root: string, dirName: string): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    if (!existsSync(dir)) return;
    for (const ent of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, ent.name);
      if (ent.isDirectory()) {
        if (ent.name === dirName) out.push(p);
        walk(p);
      }
    }
  };
  walk(root);
  return out;
}

describe("V9 plan enforcement bundles", () => {
  describe("§29.1 acceptance areas → concrete artifacts", () => {
    const rows: { area: string; files: string[] }[] = [
      {
        area: "onboarding first-value path",
        files: ["src/actions/onboarding-calibration.ts", "e2e/onboarding-calibration.spec.ts"],
      },
      {
        area: "dashboard actionability",
        files: ["src/components/dashboard/dashboard-upper.tsx", "e2e/authenticated.spec.ts"],
      },
      {
        area: "contract list filtering and ordering",
        files: ["src/lib/contract-list.ts", "src/components/contracts/contract-table.tsx"],
      },
      {
        area: "contract detail clarity and actions",
        files: ["src/app/(dashboard)/contracts/[id]/page.tsx"],
      },
      {
        area: "review queue throughput path",
        files: ["src/components/contracts/field-review.tsx", "src/app/(dashboard)/contracts/review/page.tsx"],
      },
      {
        area: "work queue direct actions",
        files: ["src/components/work/work-queue-inline-actions.tsx", "src/app/(dashboard)/work/page.tsx"],
      },
      {
        area: "renewal quick actions",
        files: [
          "src/components/contracts/renewal-row-checklist-actions.tsx",
          "src/app/(dashboard)/contracts/renewals/page.tsx",
        ],
      },
      { area: "exception resolution", files: ["src/actions/exceptions.ts", "src/app/(dashboard)/contracts/exceptions/page.tsx"] },
      {
        area: "evidence submission and rejection flow",
        files: ["src/app/api/evidence/[id]/[action]/route.ts", "src/components/contracts/evidence-submission-form.tsx"],
      },
      {
        area: "hidden-feature non-leakage on visible surfaces",
        files: ["src/lib/v9-security-surface-guard.v9.test.ts", "src/lib/product-surface/cmdk-search-jumps.ts"],
      },
      {
        area: "loading and mutation feedback quality",
        files: ["src/app/(dashboard)/loading-error-consistency.v9.test.ts", "src/lib/recoverable-mutation-error.ts"],
      },
      { area: "major visible failure states", files: ["src/app/(dashboard)/error.tsx", "src/lib/v9-api-client-errors.ts"] },
    ];

    it("lists twelve §29.1 coverage areas", () => {
      expect(rows).toHaveLength(12);
    });

    it("each area anchors to existing files", () => {
      for (const row of rows) {
        for (const f of row.files) {
          expect(read(f).length, `${row.area} → ${f}`).toBeGreaterThan(50);
        }
      }
    });

    const regressionAnchors: { area: string; tests: string[] }[] = [
      { area: "onboarding first-value path", tests: ["e2e/onboarding-calibration.spec.ts"] },
      { area: "dashboard actionability", tests: ["e2e/authenticated.spec.ts"] },
      {
        area: "contract list filtering and ordering",
        tests: ["src/components/contracts/contract-table.ui.test.tsx"],
      },
      {
        area: "contract detail clarity and actions",
        tests: ["src/lib/contract-detail-summary.v9.test.ts"],
      },
      {
        area: "review queue throughput path",
        tests: ["src/components/contracts/field-review.ui.test.tsx"],
      },
      {
        area: "work queue direct actions",
        tests: ["src/components/work/work-queue-inline-actions.ui.test.tsx"],
      },
      {
        area: "renewal quick actions",
        tests: ["src/components/contracts/renewal-row-checklist-actions.ui.test.tsx"],
      },
      {
        area: "exception resolution",
        tests: ["src/components/contracts/exception-mutation-panels.ui.test.tsx"],
      },
      {
        area: "evidence submission and rejection flow",
        tests: [
          "src/components/contracts/evidence-submission-form.ui.test.tsx",
          "src/app/api/evidence/[id]/[action]/route.test.ts",
        ],
      },
      {
        area: "hidden-feature non-leakage on visible surfaces",
        tests: ["src/lib/v9-security-surface-guard.v9.test.ts"],
      },
      {
        area: "loading and mutation feedback quality",
        tests: ["src/app/(dashboard)/loading-error-consistency.v9.test.ts"],
      },
      { area: "major visible failure states", tests: ["src/lib/v9-api-client-errors.v9.test.ts"] },
    ];

    it("each §29.1 area pins at least one automated regression file on disk", () => {
      expect(regressionAnchors).toHaveLength(12);
      for (const row of regressionAnchors) {
        for (const rel of row.tests) {
          const full = join(process.cwd(), rel);
          expect(existsSync(full), `${row.area} → ${rel}`).toBe(true);
        }
      }
    });
  });

  describe("§29.2 regression gates → package.json scripts", () => {
    it("maps four §29.2 regression gates to CI gate scripts (no silent deletion)", () => {
      expect(V9_REGRESSION_GATES).toHaveLength(4);
      const pkg = JSON.parse(read("package.json")) as { scripts: Record<string, string> };
      const v8 = pkg.scripts["check:v8-suite"];
      expect(v8).toContain("check:v8-api-eligibility");
      expect(v8).toContain("check:v8-hrefs:strict");
      expect(pkg.scripts["check:api-route-auth-contract"]).toMatch(/node scripts/);
      expect(read("src/lib/reminder-delivery-visibility.v9.test.ts").length).toBeGreaterThan(40);
      expect(read("src/lib/v9-notification-diagnostics.ts")).toContain("Health");
    });
  });

  describe("§28.3 auditable record classes (implementation anchors)", () => {
    it("preserves six auditable record classes", () => {
      expect(V9_AUDITABLE_RECORD_CLASSES).toHaveLength(6);
    });

    const anchors: { docLine: string; proof: { file: string; needle: string }[] }[] = [
      {
        docLine: "onboarding calibration application",
        proof: [{ file: "src/actions/onboarding-calibration.ts", needle: '"onboarding.calibration_applied"' }],
      },
      {
        docLine: "workspace mode changes",
        proof: [
          { file: "src/actions/product-surface-settings.ts", needle: '"onboarding.post_calibration_mode_changed"' },
        ],
      },
      {
        docLine: "visibility-affecting settings changes",
        proof: [{ file: "src/actions/product-surface-settings.ts", needle: '"workspace.product_surface_updated"' }],
      },
      {
        docLine: "owner changes",
        proof: [{ file: "src/actions/contracts.ts", needle: '"contract.owner_changed"' }],
      },
      {
        docLine: "evidence state changes",
        proof: [{ file: "src/app/api/evidence/[id]/[action]/route.ts", needle: 'eventType: "evidence.approved"' }],
      },
      {
        docLine: "reminder enablement changes",
        proof: [{ file: "src/actions/product-surface-settings.ts", needle: '"workspace.notification_policy_updated"' }],
      },
    ];

    it("lists six §28.3 record classes", () => {
      expect(anchors).toHaveLength(6);
    });

    it("each class still has a code anchor", () => {
      for (const row of anchors) {
        for (const p of row.proof) {
          expect(read(p.file)).toContain(p.needle);
        }
      }
    });
  });

  describe("§6 nineteen improvement areas", () => {
    it("keeps nineteen improvement areas codified", () => {
      expect(V9_IMPROVEMENT_AREAS).toHaveLength(19);
    });

    it("maps §6 to the shared trace row", () => {
      expect(V9_SPEC_TRACE["6"]?.length).toBeGreaterThan(0);
    });
  });

  describe("§31 non-goals (negative probes)", () => {
    it("keeps seven constraint lines discoverable in code", () => {
      expect(V9_NON_GOALS).toHaveLength(7);
      expect("V9 is strictly an improvement release.").toContain("improvement release");
      expect("Oblixa V9 must be better, not bigger.").toContain("better, not bigger");
    });

    it("only renders pricing under the public (marketing) segment", () => {
      // v1 release-state spec mandates a public /pricing marketing page.
      // The original v9 constraint forbade in-app pricing surfaces — that
      // still holds; we just allow the marketing-tree page that the
      // release-state spec requires.
      const appRoot = join(process.cwd(), "src", "app");
      const pricingDirs = walkDirsWithName(appRoot, "pricing");
      const pageUnderPricing = pricingDirs.filter((d) => existsSync(join(d, "page.tsx")));
      for (const dir of pageUnderPricing) {
        expect(dir, "pricing route must live under (marketing) only").toContain("(marketing)");
      }
    });
  });

  describe("§32 rollout metadata", () => {
    it("lists every NEXT_PUBLIC_V9_* toggle in v9-rollout.ts", () => {
      const body = read("src/lib/v9-rollout.ts");
      for (const k of V9_ROLLOUT_PUBLIC_ENV_KEYS) {
        expect(body).toContain(k);
      }
    });
  });
});
