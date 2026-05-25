import { describe, expect, it } from "vitest";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import {
  V10_ACCEPTANCE_MATRIX,
  V10_REQUIRED_ACCEPTANCE_IDS,
  buildV10AcceptanceGateClosureLedger,
  classifyV10AcceptanceRuntimeStatus,
  getV10AcceptanceMatrixRow,
  getV10AcceptanceProof,
  summarizeV10AcceptanceCoverage,
  validateV10AcceptanceGateClosureLedger,
  validateV10AcceptanceMatrix,
} from "./acceptance-matrix";
import { V10_SPEC_TRACE } from "./spec-trace-map";
import { V10_REQUIRED_PLAN_TODO_IDS } from "./autonomous-coverage";

function listV10LibSources(): string[] {
  const srcLib = join(process.cwd(), "src/lib");
  return readdirSync(srcLib)
    .filter((name) => name.startsWith("v10-") && name.endsWith(".ts") && !name.endsWith(".v10.test.ts"))
    .map((name) => relative(process.cwd(), join(srcLib, name)));
}

function readV10TestCorpus(): string {
  const srcLib = join(process.cwd(), "src/lib");
  return readdirSync(srcLib)
    .filter((name) => name.startsWith("v10-") && name.endsWith(".v10.test.ts"))
    .map((name) => readFileSync(join(srcLib, name), "utf8"))
    .join("\n");
}

function readPackageScripts(): Record<string, string> {
  return JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8")).scripts ?? {};
}

function expandGateGlob(gate: string): string[] {
  if (!gate.includes("*")) return [gate];
  const srcLib = join(process.cwd(), "src/lib");
  const escaped = gate
    .replace(/^src\/lib\//, "")
    .split("*")
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  const pattern = new RegExp(`^${escaped}$`);
  return readdirSync(srcLib)
    .filter((name) => pattern.test(name))
    .map((name) => relative(process.cwd(), join(srcLib, name)));
}

describe("V10 acceptance matrix", () => {
  it("keeps acceptance gates traceable to the autonomous planTodoId inventory (Phase 0 baseline)", () => {
    expect(V10_REQUIRED_PLAN_TODO_IDS.length).toBe(42);
    expect(
      V10_ACCEPTANCE_MATRIX.some((row) =>
        row.gates.includes("src/lib/autonomous-coverage.test.ts")
      )
    ).toBe(true);
    expect(V10_ACCEPTANCE_MATRIX.find((row) => row.id === "journey-contracts")?.gates).toEqual(
      expect.arrayContaining(["src/lib/autonomous-coverage.test.ts"])
    );
  });

  it("maps cross-cutting plan requirements to evidence or explicit blockers", () => {
    expect(V10_ACCEPTANCE_MATRIX.length).toBe(V10_REQUIRED_ACCEPTANCE_IDS.length);
    expect(validateV10AcceptanceMatrix()).toEqual([]);
    expect(new Set(V10_ACCEPTANCE_MATRIX.map((row) => row.id)).size).toBe(V10_ACCEPTANCE_MATRIX.length);
    expect([...V10_ACCEPTANCE_MATRIX.map((row) => row.id)].sort()).toEqual([...V10_REQUIRED_ACCEPTANCE_IDS].sort());
    expect(V10_ACCEPTANCE_MATRIX.map((row) => row.id)).toEqual(
      expect.arrayContaining([
        "fix-runtime-migration",
        "activation-intake",
        "fixture-measurement-gates",
        "negative-adversarial-coverage",
        "final-gap-audit-protocol",
        "tenant-isolation-proof",
        "report-export-redaction",
        "implementation-slicing",
        "deterministic-ordering-contracts",
        "failure-injection-qa",
        "trace-release-evidence",
        "verification-gates",
      ])
    );
  });

  it("derives the full acceptance proof fields required for handoff", () => {
    const row = getV10AcceptanceMatrixRow("deterministic-ordering-contracts");
    expect(row).not.toBeNull();
    expect(row ? getV10AcceptanceProof(row) : null).toMatchObject({
      id: "deterministic-ordering-contracts",
      priority: "P2",
      runtimeStatus: "runtime_verified",
      releaseEvidenceOwner: "product",
      verificationCommands: expect.arrayContaining(["npm run check:release-suite-current"]),
      objectiveMetricKey: null,
      releaseBlocking: false,
      blockerStatus: "none",
      releaseStateImpact: "blocks_complete",
    });
    expect(row ? getV10AcceptanceProof(row).specSections : []).toContain("Implementation Slicing Rules");
    expect(row ? getV10AcceptanceProof(row).docSpecSections : []).toEqual(expect.arrayContaining(["6.13", "6.14"]));
    expect(row ? getV10AcceptanceProof(row).testGates : []).toEqual(
      expect.arrayContaining(["src/lib/semantics.test.ts"])
    );
  });

  it("maps acceptance proofs to canonical V10 document sections", () => {
    for (const row of V10_ACCEPTANCE_MATRIX) {
      const proof = getV10AcceptanceProof(row);
      expect(proof.docSpecSections.length, row.id).toBeGreaterThan(0);
      for (const section of proof.docSpecSections) {
        expect(V10_SPEC_TRACE[section]?.length, `${row.id}:${section}`).toBeGreaterThan(0);
      }
    }
  });

  it("keeps non-autonomous and environment-gated rows classified", () => {
    expect(getV10AcceptanceMatrixRow("non-autonomous-evidence-schema")).toMatchObject({
      disposition: "automated_gate",
      blockerType: "human_study",
    });
    expect(getV10AcceptanceMatrixRow("measurement-governance")).toMatchObject({
      disposition: "automated_gate",
      blockerType: "external_dashboard",
    });
    for (const row of V10_ACCEPTANCE_MATRIX) {
      const proof = getV10AcceptanceProof(row);
      if (row.disposition === "environment_gated" || row.disposition === "non_autonomous_blocker") {
        expect(row.blockerType, row.id).toBeTruthy();
        expect(proof.blockerStatus, row.id).toMatch(/^blocked:/);
        expect(proof.releaseBlocking, row.id).toBe(true);
      }
      if (row.disposition === "automated_gate") {
        expect(row.gates.some((gate) => gate.endsWith(".test.ts") || gate.endsWith(".test.tsx") || gate.startsWith("npm run")), row.id).toBe(
          true
        );
      }
      expect(proof.releaseEvidenceOwner, row.id).toMatch(/^(engineering|product|operations|security|release|support)$/);
      expect(proof.verificationCommands.length, row.id).toBeGreaterThan(0);
      expect(proof.releaseStateImpact, row.id).toMatch(/^(blocks_beta|blocks_ga|blocks_complete|holds_promotion)$/);
    }
  });

  it("maps acceptance IDs to beta, GA, complete, or promotion hold impact", () => {
    expect(getV10AcceptanceProof(V10_ACCEPTANCE_MATRIX.find((row) => row.id === "fix-runtime-migration")!)).toMatchObject({
      priority: "P0",
      releaseStateImpact: "blocks_beta",
    });
    expect(getV10AcceptanceProof(V10_ACCEPTANCE_MATRIX.find((row) => row.id === "rollout-backfill-recovery")!)).toMatchObject({
      priority: "P1",
      releaseStateImpact: "blocks_ga",
    });
    expect(getV10AcceptanceProof(V10_ACCEPTANCE_MATRIX.find((row) => row.id === "deterministic-ordering-contracts")!)).toMatchObject({
      priority: "P2",
      releaseStateImpact: "blocks_complete",
    });
    expect(getV10AcceptanceProof(V10_ACCEPTANCE_MATRIX.find((row) => row.id === "non-autonomous-evidence-schema")!)).toMatchObject({
      priority: "P1",
      releaseStateImpact: "blocks_ga",
      releaseBlocking: false,
    });
  });

  it("requires release-evidence acceptance ids to carry executable gates and owners", () => {
    const scripts = readPackageScripts();
    for (const row of V10_ACCEPTANCE_MATRIX.filter((entry) => entry.disposition === "release_evidence")) {
      const proof = getV10AcceptanceProof(row);
      expect(row.gates.some((gate) => gate.startsWith("npm run ") || gate.endsWith(".test.ts") || gate.includes("*")), row.id).toBe(true);
      for (const gate of row.gates.filter((gate) => gate.startsWith("npm run "))) {
        const scriptName = gate.match(/^npm run ([^ ]+)/)?.[1];
        expect(scriptName && scripts[scriptName], `${row.id}:${gate}`).toBeTruthy();
      }
      expect(proof.releaseEvidence.length, row.id).toBeGreaterThan(0);
      expect(proof.releaseEvidenceOwner, row.id).toMatch(/^(engineering|product|operations|security|release|support)$/);
      expect(proof.verificationCommands.some((command) => command.startsWith("npm run ")), row.id).toBe(true);
    }
  });

  it("summarizes every gate as runtime-backed or explicitly evidence-gated", () => {
    const summary = summarizeV10AcceptanceCoverage();
    expect(summary.total).toBe(V10_REQUIRED_ACCEPTANCE_IDS.length);
    expect(summary.silentGaps).toEqual([]);
    expect(
      summary.runtimeBacked.length +
        summary.staticContractOnly.length +
        summary.releaseEvidenceGated.length +
        summary.environmentGated.length +
        summary.nonAutonomousBlocked.length
    ).toBeGreaterThanOrEqual(summary.total);
    expect(summary.staticContractOnly.length).toBeGreaterThan(0);
    for (const id of summary.staticContractOnly) {
      expect(getV10AcceptanceMatrixRow(id)?.disposition, id).not.toBe("shipped");
    }
    expect(summary.environmentGated.length).toBe(0);
    expect(summary.nonAutonomousBlocked.length).toBe(0);
    expect(summary.automatedGated).toEqual(expect.arrayContaining(["fix-runtime-migration", "verification-gates"]));
  });

  it("closes every acceptance gate with runtime proof, an automated gate, release evidence, or an external blocker", () => {
    const ledger = buildV10AcceptanceGateClosureLedger();

    expect(validateV10AcceptanceGateClosureLedger(ledger)).toEqual([]);
    expect(ledger).toHaveLength(V10_REQUIRED_ACCEPTANCE_IDS.length);
    expect(new Set(ledger.map((row) => row.id)).size).toBe(ledger.length);
    expect(ledger.map((row) => row.closureKind)).toEqual(
      expect.arrayContaining(["runtime_proof", "automated_gate"])
    );
    expect(ledger.find((row) => row.id === "activation-intake")).toMatchObject({
      closureKind: "runtime_proof",
      runtimeStatus: "runtime_verified",
      openGap: null,
    });
    expect(ledger.find((row) => row.id === "non-autonomous-evidence-schema")).toMatchObject({
      closureKind: "automated_gate",
      blockerStatus: "blocked:human_study",
      openGap: null,
    });
    expect(
      validateV10AcceptanceGateClosureLedger([
        {
          id: "activation-intake",
          closureKind: "runtime_proof",
          runtimeStatus: "typed_contract_only",
          proofArtifacts: [],
          executableGates: [],
          releaseEvidence: [],
          blockerStatus: "none",
          openGap: "artifact_missing",
        },
      ])
    ).toEqual(
      expect.arrayContaining([
        "activation-intake:artifact_missing",
        "activation-intake:proof_artifact_required",
        "activation-intake:executable_gate_required",
        "activation-intake:release_evidence_required",
        "activation-intake:runtime_proof_required",
        "closure_missing:fix-runtime-migration",
      ])
    );
  });

  it("keeps shipped claims tied to runtime artifacts and non-autonomous proof explicit", () => {
    for (const row of V10_ACCEPTANCE_MATRIX) {
      const proof = getV10AcceptanceProof(row);
      if (row.disposition === "shipped") {
        expect(["runtime_verified", "runtime_mapped"], row.id).toContain(proof.runtimeStatus);
      }
      if (row.disposition === "automated_gate") {
        if (proof.priority === "P0" || proof.priority === "P1") {
          expect(classifyV10AcceptanceRuntimeStatus(row), row.id).not.toBe("typed_contract_only");
        }
      }
      if (row.disposition === "non_autonomous_blocker") {
        expect(proof.runtimeStatus, row.id).toBe("non_autonomous_blocker");
        expect(proof.priority, row.id).toBe("release_blocker");
      }
    }
    expect(
      classifyV10AcceptanceRuntimeStatus({
        id: "static-shipped-claim",
        category: "release",
        disposition: "shipped",
        artifacts: ["src/lib/implementation-checklist.ts", "src/lib/final-gap-audit.ts"],
        gates: ["src/lib/implementation-checklist.test.ts"],
      })
    ).toBe("typed_contract_only");
    expect(
      validateV10AcceptanceMatrix(
        [
          {
            id: "static-shipped-claim",
            category: "release",
            disposition: "shipped",
            artifacts: ["src/lib/implementation-checklist.ts"],
            gates: ["src/lib/implementation-checklist.test.ts"],
          },
        ],
        { requireAllIds: false }
      )
    ).toEqual(expect.arrayContaining(["shipped_without_runtime:static-shipped-claim"]));
  });

  it("rejects hidden acceptance gaps", () => {
    expect(
      validateV10AcceptanceMatrix([
        {
          id: "gap",
          category: "release",
          disposition: "environment_gated",
          artifacts: [],
          gates: [],
        },
      ])
    ).toEqual(
      expect.arrayContaining([
        "missing_artifact:gap",
        "missing_gate:gap",
        "release_evidence_without_gate:gap",
        "missing_blocker_type:gap",
      ])
    );
  });

  it("ratchets every V10 library module to a test import, matrix artifact, or release gate", () => {
    const matrixCorpus = V10_ACCEPTANCE_MATRIX.flatMap((row) => [...row.artifacts, ...row.gates]).join("\n");
    const testCorpus = readV10TestCorpus();

    for (const source of listV10LibSources()) {
      const moduleSpecifier = `./${source.replace(/^src\/lib\//, "").replace(/\.ts$/, "")}`;
      expect(
        matrixCorpus.includes(source) || testCorpus.includes(source) || testCorpus.includes(moduleSpecifier),
        `${source} must be mapped to V10 proof`
      ).toBe(true);
    }
  });

  it("keeps npm gates and V10 browser smoke wired to real package scripts", () => {
    const scripts = readPackageScripts();

    for (const row of V10_ACCEPTANCE_MATRIX) {
      for (const gate of row.gates) {
        const scriptName = gate.match(/^npm run ([^ ]+)/)?.[1];
        if (scriptName) expect(scripts[scriptName], `${row.id}:${gate}`).toBeTruthy();
      }
    }
    expect(scripts["test:e2e:smoke"]).toContain("e2e/current-product-core-smoke.spec.ts");
    expect(scripts["test:e2e:current-product"]).toContain("@current-product");
  });

  it("keeps concrete acceptance artifacts and gate files present", () => {
    const specArtifactIds = readFileSync(join(process.cwd(), "src/lib/spec-artifact-ids.ts"), "utf8");
    for (const row of V10_ACCEPTANCE_MATRIX) {
      for (const artifact of row.artifacts) {
        if (artifact.includes("*")) continue;
        if (artifact.startsWith("spec:") || artifact.startsWith("ops:")) {
          expect(specArtifactIds.includes(`"${artifact}"`), `${row.id}:${artifact} codified in spec-artifact-ids.ts`).toBe(
            true
          );
          continue;
        }
        expect(existsSync(join(process.cwd(), artifact)), `${row.id}:${artifact}`).toBe(true);
      }
      for (const gate of row.gates) {
        if (gate.startsWith("npm run ") || gate.includes("*")) continue;
        expect(existsSync(join(process.cwd(), gate)), `${row.id}:${gate}`).toBe(true);
      }
    }
  });

  it("expands globbed acceptance gates to concrete files", () => {
    for (const row of V10_ACCEPTANCE_MATRIX) {
      for (const gate of row.gates.filter((entry) => entry.includes("*"))) {
        const matches = expandGateGlob(gate);
        expect(matches.length, `${row.id}:${gate}`).toBeGreaterThan(0);
        for (const match of matches) {
          expect(existsSync(join(process.cwd(), match)), `${row.id}:${gate}:${match}`).toBe(true);
        }
      }
    }
  });
});
