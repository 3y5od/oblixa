import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  V10_ACCEPTANCE_GATES,
  V10_GA_SAMPLE_SIZES,
  V10_MUTATION_CATALOG,
  V10_OBJECTIVE_TARGETS,
  V10_RELEASE_PRIORITY_TIERS,
} from "./v10-release-contract";
import {
  V10_FINAL_VERIFICATION_COMMANDS,
  V10_OPERATOR_RUNBOOK_CONTRACTS,
  V10_RELEASE_CANDIDATE_EVIDENCE_REQUIREMENTS,
  validateV10NonAutonomousEvidenceGateSet,
  validateV10ReleaseCandidateEvidenceRequirements,
} from "./v10-release-evidence";
import { V10_REQUIRED_MUTATION_CONTRACTS } from "./v10-mutation-envelope";
import { V10_IMPLEMENTATION_REQUIREMENTS } from "./v10-implementation-checklist";
import {
  V10_ATTACHED_PLAN_TODO_IDS,
  getV10PlanTodoProof,
} from "./v10-final-gap-audit";

describe("V10 plan completion harness", () => {
  it("maps every V10_OBJECTIVE_TARGETS entry to a GA sample metric key", () => {
    const metricKeys = new Set(Object.keys(V10_GA_SAMPLE_SIZES));
    for (const row of V10_OBJECTIVE_TARGETS) {
      expect(metricKeys.has(row.measurementKey), row.key).toBe(true);
    }
  });

  it("keeps V10_MUTATION_CATALOG aligned with V10_REQUIRED_MUTATION_CONTRACTS", () => {
    const catalogNames = new Set<string>(V10_MUTATION_CATALOG.map((m) => m.name));
    for (const contract of V10_REQUIRED_MUTATION_CONTRACTS) {
      expect(catalogNames.has(contract.key), contract.key).toBe(true);
    }
  });

  it("covers every V10_ACCEPTANCE_GATE in implementation requirements or release contract scope", () => {
    const gateHits = new Set<V10AcceptanceGate>();
    type V10AcceptanceGate = (typeof V10_ACCEPTANCE_GATES)[number];
    for (const req of V10_IMPLEMENTATION_REQUIREMENTS) {
      gateHits.add(req.gate as V10AcceptanceGate);
    }
    for (const gate of V10_ACCEPTANCE_GATES) {
      expect(gateHits.has(gate), `implementation checklist missing gate ${gate}`).toBe(true);
    }
  });

  it("enumerates P0/P1/P2 release priority tiers with checklist coverage", () => {
    const impl = new Set(V10_IMPLEMENTATION_REQUIREMENTS.map((r) => r.id));
    const tierStrings = [
      ...V10_RELEASE_PRIORITY_TIERS.P0,
      ...V10_RELEASE_PRIORITY_TIERS.P1,
      ...V10_RELEASE_PRIORITY_TIERS.P2,
    ];
    expect(tierStrings.length).toBeGreaterThan(0);
    expect(impl.has("approval-gated-automation")).toBe(true);
  });

  it("validates release candidate evidence requirement set invariants", () => {
    expect(validateV10ReleaseCandidateEvidenceRequirements()).toEqual([]);
  });

  it("validates non-autonomous evidence gate taxonomy", () => {
    expect(validateV10NonAutonomousEvidenceGateSet()).toEqual([]);
  });

  it("lists final verification commands that exist in package.json scripts", () => {
    const pkg = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8")) as {
      scripts?: Record<string, string>;
    };
    const scripts = pkg.scripts ?? {};
    for (const row of V10_FINAL_VERIFICATION_COMMANDS) {
      const cmd = row.command.trim();
      expect(cmd.startsWith("npm run "), cmd).toBe(true);
      const name = cmd.replace(/^npm run\s+/, "").split(/\s/)[0];
      expect(scripts[name], `missing script: ${name}`).toBeTruthy();
    }
  });

  it("anchors operator runbook contracts to documented diagnostics", () => {
    expect(V10_OPERATOR_RUNBOOK_CONTRACTS.map((c) => c.key)).toEqual([
      "rc_fixture_rebuild",
      "read_model_repair",
      "provider_outage",
      "post_ga_slo",
    ]);
    for (const contract of V10_OPERATOR_RUNBOOK_CONTRACTS) {
      expect(contract.diagnostics.length, contract.key).toBeGreaterThan(0);
      expect(contract.supportSafe, contract.key).toBe(true);
    }
  });

  it("requires eleven RC evidence rows with unique persistence keys", () => {
    const keys = V10_RELEASE_CANDIDATE_EVIDENCE_REQUIREMENTS.map((r) => r.persistence_key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(V10_RELEASE_CANDIDATE_EVIDENCE_REQUIREMENTS.length).toBe(11);
  });

  it("closes attached plan todos against proof rows (master phases roll up to these proofs)", () => {
    for (const id of V10_ATTACHED_PLAN_TODO_IDS) {
      expect(getV10PlanTodoProof(id), `missing plan todo proof for ${id}`).not.toBeNull();
    }
  });
});
