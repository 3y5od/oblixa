import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { getV10AcceptanceMatrixRow } from "./acceptance-matrix";
import { V10_REQUIRED_MUTATION_CONTRACTS, validateV10RequiredMutationContracts } from "./mutation-envelope";

/** npm scripts listed in V10 program Inventory I (docs + plan). */
const INVENTORY_I_SCRIPT_KEYS = [
  "test:e2e:current-product",
  "test:e2e:smoke",
  "check:release-evidence",
  "check:release-inventory-lock",
  "check:migration-smoke:current",
  "check:migration-smoke:current:strict",
  "check:release-promotable",
  "check:release-promotable:report",
  "report:runtime-evidence-plan",
  "check:release-privacy-scan",
  "check:zero-exclusion-report",
  "check:complete-closure",
  "check:release-suite-current",
  "rebuild:read-models",
] as const;

/** Primary acceptance rows per program Appendix L (phase → proof anchors). */
const PLAN_PHASE_ACCEPTANCE_IDS: Record<number, readonly string[]> = {
  1: ["read-model-foundation", "tenant-isolation-proof", "database-constraint-index-budget", "data-lineage-invariants"],
  2: ["mutation-contracts", "route-api-contracts"],
  3: [
    "activation-intake",
    "home-daily-brief",
    "unified-work",
    "contract-record",
    "review-provenance-quality",
  ],
  4: ["renewals-critical-dates", "evidence-obligations-collaboration"],
  5: ["complete-search-router", "reports-exports-reviews"],
  6: ["governance-health-reliability"],
  /** Appendix L maps P2 continuity to phases 7 and 8; one ratchet covers both. */
  7: ["p1-p2-continuity"],
  9: ["accessibility-performance-responsive"],
  10: ["telemetry-objectives"],
};

function assertAcceptanceArtifactsPresent(phase: number, ids: readonly string[]) {
  for (const id of ids) {
    const row = getV10AcceptanceMatrixRow(id);
    expect(row, `${phase}:${id}`).not.toBeNull();
    for (const artifact of row!.artifacts) {
      if (artifact.includes("*")) continue;
      expect(existsSync(join(process.cwd(), artifact)), `${phase}:${id}:${artifact}`).toBe(true);
    }
  }
}

describe("Phase 0 — baseline & Inventory I", () => {
  it("declares every Inventory I npm script in package.json", () => {
    const scripts = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8")).scripts as Record<string, string>;
    for (const key of INVENTORY_I_SCRIPT_KEYS) {
      expect(scripts[key], key).toBeTruthy();
      expect(typeof scripts[key]).toBe("string");
    }
  });

  it("emits machine-parseable promotability JSON from check-release-promotable --report", () => {
    const r = spawnSync("node", ["scripts/check-release-promotable.mjs", "--report"], {
      cwd: process.cwd(),
      encoding: "utf8",
    });
    expect(r.status, r.stderr).toBe(0);
    const json = JSON.parse(r.stdout);
    expect(json).toMatchObject({
      ok: expect.any(Boolean),
      blockerCount: expect.any(Number),
      blockers: expect.any(Array),
    });
  });
});

describe("Phase 2 — required mutations bound to real runtime files", () => {
  it("keeps all 29 required mutation contracts on disk", () => {
    expect(validateV10RequiredMutationContracts()).toEqual([]);
    expect(V10_REQUIRED_MUTATION_CONTRACTS.length).toBe(29);
    for (const contract of V10_REQUIRED_MUTATION_CONTRACTS) {
      expect(existsSync(join(process.cwd(), contract.runtimeArtifact)), contract.key).toBe(true);
    }
  });
});

describe("Phases 1–10 — acceptance matrix artifacts remain present", () => {
  for (const [phase, ids] of Object.entries(PLAN_PHASE_ACCEPTANCE_IDS)) {
    it(`phase ${phase} rows resolve to existing artifacts`, () => {
      assertAcceptanceArtifactsPresent(Number(phase), ids);
    });
  }
});

describe("Phase 8 — P2 / advanced assurance continuity (in-branch scope)", () => {
  it("keeps advanced assurance continuity sources and regression tests present", () => {
    expect(existsSync(join(process.cwd(), "src/lib/advanced-assurance-continuity.ts"))).toBe(true);
    expect(existsSync(join(process.cwd(), "src/lib/continuity.test.ts"))).toBe(true);
  });
});

describe("Phase 11 — post-GA evidence command surface", () => {
  it("keeps human + signoff governance artifacts wired in the matrix", () => {
    assertAcceptanceArtifactsPresent(11, ["non-autonomous-evidence-schema", "release-signoff-governance"]);
  });

  it("emits structured JSON for --post-ga 7d (release_check_required)", () => {
    const r = spawnSync("node", ["scripts/check-release-evidence.mjs", "--post-ga", "7d"], {
      cwd: process.cwd(),
      encoding: "utf8",
    });
    expect(r.status).toBe(1);
    const json = JSON.parse(r.stdout);
    expect(json).toMatchObject({
      mode: "post_ga_runtime_dashboard_required",
      window: "7d",
      persistenceMode: "runtime_evidence_required",
    });
  });

  it("allows documented post-GA operator attestation when V10_POST_GA_EVIDENCE_CAPTURE_OK=1", () => {
    const r = spawnSync("node", ["scripts/check-release-evidence.mjs", "--post-ga", "30d"], {
      cwd: process.cwd(),
      encoding: "utf8",
      env: { ...process.env, V10_POST_GA_EVIDENCE_CAPTURE_OK: "1" },
    });
    expect(r.status).toBe(0);
    expect(JSON.parse(r.stdout)).toMatchObject({
      ok: true,
      mode: "post_ga_capture_path_documented",
      window: "30d",
    });
  });
});

describe("Cross-phase — semantics, inventory, vocabulary", () => {
  it("keeps work semantics, renewal posture, operational contracts, and inventory modules present", () => {
    for (const rel of [
      "src/lib/work-semantics.ts",
      "src/lib/renewal-posture.ts",
      "src/lib/operational-contracts.ts",
      "src/lib/source-object-inventory.ts",
      "src/lib/status-action-vocabulary.ts",
      "src/lib/approval-exception.ts",
    ]) {
      expect(existsSync(join(process.cwd(), rel)), rel).toBe(true);
    }
  });
});

describe("Phase 12 — Semgrep + CI wiring", () => {
  it("keeps the V10 Semgrep pack and workflow checks", () => {
    expect(existsSync(join(process.cwd(), "semgrep/oblixa-v10-surface.yml"))).toBe(true);
    const ci = readFileSync(join(process.cwd(), ".github/workflows/ci.yml"), "utf8");
    expect(ci).toContain("semgrep/oblixa-surface.yml");
    expect(ci).toContain("npm run check:semgrep-rulepack-integrity");
    expect(ci).toContain("npm run check:release-suite-current");
  });
});
