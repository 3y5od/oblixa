import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ENTERPRISE_UI_COMPONENT_CONTRACTS,
  ENTERPRISE_UI_COPY_GUARD,
  ENTERPRISE_UI_FIXTURE_STATES,
  ENTERPRISE_UI_ROLLOUT_MONITORING,
  ENTERPRISE_UI_ROUTE_INVENTORY,
  ENTERPRISE_UI_SWEEP_LEDGER,
  ENTERPRISE_UI_SWEEP_REMAINING_IDS,
  validateEnterpriseUiSweepContract,
} from "./enterprise-ui-sweep-contract";

function readRepoFile(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("enterprise UI sweep contract", () => {
  it("maps every remaining sweep todo to artifacts, gates, and acceptance evidence", () => {
    expect(validateEnterpriseUiSweepContract()).toEqual([]);
    expect(ENTERPRISE_UI_SWEEP_LEDGER.map((row) => row.id).sort()).toEqual(
      [...ENTERPRISE_UI_SWEEP_REMAINING_IDS].sort()
    );
    for (const row of ENTERPRISE_UI_SWEEP_LEDGER) {
      expect(row.status).toBe("verified");
      expect(row.artifacts.length, row.id).toBeGreaterThan(0);
      expect(row.gates.length, row.id).toBeGreaterThan(0);
      expect(row.acceptanceEvidence.length, row.id).toBeGreaterThan(0);
    }
  });

  it("keeps the route inventory broad enough for the no-exclusions plan", () => {
    const routes = ENTERPRISE_UI_ROUTE_INVENTORY.map((row) => row.route);
    expect(routes).toEqual(
      expect.arrayContaining([
        "/dashboard",
        "/work",
        "/contracts",
        "/contracts/[id]",
        "/contracts/tasks",
        "/contracts/obligations",
        "/contracts/approvals",
        "/contracts/exceptions",
        "/contracts/renewals",
        "/contracts/review",
        "/settings/health",
        "/reports",
        "/decisions",
        "/campaigns",
        "/accounts/[key]",
        "/counterparties/[key]",
        "/assurance",
        "/settings/product",
      ])
    );
    expect(ENTERPRISE_UI_ROUTE_INVENTORY.some((row) => row.primaryPattern === "advanced-analysis-first")).toBe(true);
    expect(ENTERPRISE_UI_ROUTE_INVENTORY.some((row) => row.primaryPattern === "diagnostics-first-when-abnormal")).toBe(true);
    for (const row of ENTERPRISE_UI_ROUTE_INVENTORY) {
      expect(existsSync(join(process.cwd(), row.ownerArtifact)), row.route).toBe(true);
      expect(row.firstFoldAnswer.length, row.route).toBeGreaterThan(20);
      expect(row.states).toEqual(expect.arrayContaining(["mobile", "keyboard"]));
      expect(row.roleModes.length, row.route).toBeGreaterThan(0);
    }
  });

  it("keeps shared component contracts aligned with density, diagnostics, telemetry, and a11y expectations", () => {
    expect(ENTERPRISE_UI_COMPONENT_CONTRACTS.map((row) => row.component)).toEqual(
      expect.arrayContaining([
        "RecoverableState",
        "OperationalTriagePanel",
        "ContractTable",
        "DiagnosticDisclosure",
        "CommandPalette",
      ])
    );
    for (const row of ENTERPRISE_UI_COMPONENT_CONTRACTS) {
      expect(existsSync(join(process.cwd(), row.artifact)), row.component).toBe(true);
      expect(row.density.length, row.component).toBeGreaterThan(0);
      expect(row.requiredBehaviors.length, row.component).toBeGreaterThan(1);
      expect(row.telemetryOrA11yContract.length, row.component).toBeGreaterThan(10);
    }
  });

  it("guards default operator surfaces from implementation-first and generic action copy", () => {
    const defaultSurfaceFiles = [
      "src/app/(dashboard)/dashboard/page.tsx",
      "src/app/(dashboard)/work/page.tsx",
      "src/app/(dashboard)/accounts/[key]/page.tsx",
      "src/app/(dashboard)/counterparties/[key]/page.tsx",
      "src/components/dashboard/dashboard-upper.tsx",
    ];
    for (const file of defaultSurfaceFiles) {
      const source = readRepoFile(file);
      for (const term of ENTERPRISE_UI_COPY_GUARD.defaultSurfaceForbiddenTerms) {
        expect(source.includes(term), `${file}:${term}`).toBe(false);
      }
    }
    expect(ENTERPRISE_UI_COPY_GUARD.allowedActionVerbs).toEqual(
      expect.arrayContaining(["review", "resolve", "retry", "inspect", "configure", "browse"])
    );
  });

  it("records fixture, privacy, locale/theme/browser, and rollout-monitoring coverage", () => {
    expect(ENTERPRISE_UI_FIXTURE_STATES).toEqual(
      expect.arrayContaining([
        "all-clear workspace",
        "single critical exception",
        "failed report",
        "forbidden user",
        "long-title unicode contract row",
        "mobile dense table",
        "advanced mode",
        "assurance mode",
      ])
    );
    expect(ENTERPRISE_UI_ROLLOUT_MONITORING).toEqual(
      expect.arrayContaining([
        "route errors",
        "hydration errors",
        "command palette errors",
        "mutation recoverability",
        "partial data states",
      ])
    );
  });
});
