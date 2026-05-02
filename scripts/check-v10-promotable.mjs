#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const args = new Set(process.argv.slice(2));

function readOption(flag, fallback) {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return fallback;
  return process.argv[idx + 1] ?? fallback;
}

const stage = readOption("--stage", "complete");
if (!["beta", "GA", "complete"].includes(stage)) {
  console.error(`Unknown V10 promotability stage: ${stage}`);
  process.exit(1);
}

function read(relative) {
  return readFileSync(join(root, relative), "utf8").split(/\r?\n/);
}

function push(blockers, source, key, proofKind, blocker) {
  blockers.push({ source, key, proofKind, blocker });
}

function collectAutonomousCoverageBlockers(blockers) {
  let planTodoId = null;
  for (const line of read("src/lib/v10-autonomous-coverage.ts")) {
    const planMatch = line.match(/planTodoId:\s*"([^"]+)"/);
    if (planMatch) planTodoId = planMatch[1];
    const statusMatch = line.match(/status:\s*"(typed_contract|release_check_required|environment_gated)"/);
    if (!statusMatch || !planTodoId) continue;
    const status = statusMatch[1];
    if (status === "typed_contract") {
      push(blockers, "autonomous_coverage", `coverage:${planTodoId}`, "static_or_contract_only", "runtime_proof_required");
    } else if (status === "environment_gated") {
      push(blockers, "autonomous_coverage", `coverage:${planTodoId}`, "environment_gated", "environment_gate_must_resolve");
    } else {
      push(blockers, "autonomous_coverage", `coverage:${planTodoId}`, "release_check_required", "release_evidence_must_be_promoted");
    }
  }
}

function collectAcceptanceBlockers(blockers) {
  let id = null;
  for (const line of read("src/lib/v10-acceptance-matrix.ts")) {
    const idMatch = line.match(/id:\s*"([^"]+)"/);
    if (idMatch) id = idMatch[1];
    const dispositionMatch = line.match(/disposition:\s*"(release_evidence|environment_gated|non_autonomous_blocker)"/);
    if (!dispositionMatch || !id) continue;
    const disposition = dispositionMatch[1];
    if (disposition === "environment_gated") {
      push(blockers, "acceptance_matrix", `acceptance:${id}`, "environment_gated", "environment_gate_must_resolve");
    } else if (disposition === "non_autonomous_blocker") {
      push(blockers, "acceptance_matrix", `acceptance:${id}`, "external_blocker", "external_evidence_must_be_promoted");
    } else {
      push(blockers, "acceptance_matrix", `acceptance:${id}`, "release_check_required", "release_evidence_must_be_promoted");
    }
  }
}

function collectReleaseEvidenceBlockers(blockers) {
  let metricKey = null;
  let externalKey = null;
  for (const line of read("src/lib/v10-release-evidence.ts")) {
    const metricMatch = line.match(/metric_key:\s*"([^"]+)"/);
    if (metricMatch) metricKey = metricMatch[1];
    const localProofMatch = line.match(/autonomous_local_proof:\s*"(contract_only|synthetic_descriptor)"/);
    if (localProofMatch && metricKey) {
      push(blockers, "metric_evidence", `metric:${metricKey}`, "descriptor_fixture_only", "promoted_runtime_metric_evidence_required");
    }

    const keyMatch = line.match(/key:\s*"([^"]+)"/);
    if (keyMatch) externalKey = keyMatch[1];
    if (/validation_status:\s*"release_check_required"/.test(line) && externalKey) {
      push(blockers, "non_autonomous_evidence", `external:${externalKey}`, "external_blocker", "external_evidence_must_be_promoted");
    }
  }
}

const blockers = [];
collectAutonomousCoverageBlockers(blockers);
collectAcceptanceBlockers(blockers);
collectReleaseEvidenceBlockers(blockers);

const summary = blockers.reduce(
  (acc, blocker) => {
    acc[blocker.proofKind] = (acc[blocker.proofKind] ?? 0) + 1;
    return acc;
  },
  {}
);

const payload = {
  ok: blockers.length === 0,
  stage,
  mode: "v10_promotability_baseline",
  blockerCount: blockers.length,
  summary,
  blockers,
};

console.log(JSON.stringify(payload, null, 2));
if (blockers.length > 0 && !args.has("--report") && !args.has("--allow-blocked")) process.exit(1);
