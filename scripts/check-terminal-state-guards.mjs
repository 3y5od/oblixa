#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();

const TARGETS = [
  {
    id: "approval_decisions_claim_pending_status",
    file: "src/app/api/approvals/[id]/[action]/route.ts",
    objective: "Approval approve/reject/request-changes writes must claim pending status before emitting events.",
    markers: [
      marker("pending status predicate", /\.eq\(\s*["']status["']\s*,\s*["']pending["']\s*\)/),
      marker("stale decision diagnostic", /v10_approval_decision_stale_status/),
    ],
  },
  {
    id: "approval_delegate_escalate_claim_pending_status",
    file: "src/app/api/approvals/[id]/[action]/route.ts",
    objective: "Approval delegate and escalate writes must be limited to pending approvals.",
    markers: [
      marker("delegate pending diagnostic", /v10_approval_delegate_not_pending/),
      marker("escalate pending diagnostic", /v10_approval_escalate_not_pending/),
      marker("stale delegate diagnostic", /v10_approval_delegate_stale_status/),
      marker("stale escalate diagnostic", /v10_approval_escalate_stale_status/),
    ],
  },
  {
    id: "decision_approve_claim_open_status",
    file: "src/app/api/decisions/[id]/approve/route.ts",
    objective: "Decision approval must claim open or in_review status in the update.",
    markers: [
      marker("open/in_review status predicate", /\.in\(\s*["']status["']\s*,\s*\[\s*["']open["']\s*,\s*["']in_review["']\s*\]\s*\)/),
      marker("stale approval diagnostic", /decision_approval_stale_status/),
    ],
  },
  {
    id: "decision_close_claim_not_closed",
    file: "src/app/api/decisions/[id]/close/route.ts",
    objective: "Decision close must not apply post-close side effects when another request already closed the decision.",
    markers: [
      marker("not closed update predicate", /\.neq\(\s*["']status["']\s*,\s*["']closed["']\s*\)/),
      marker("stale close diagnostic", /decision_close_stale_status/),
      marker("closed idempotent response", /postActionResult:\s*null/),
    ],
  },
  {
    id: "campaign_close_claim_active_or_paused",
    file: "src/app/api/campaigns/[id]/close/route.ts",
    objective: "Campaign close must claim active or paused status before writing close side effects.",
    markers: [
      marker("active/paused status predicate", /\.in\(\s*["']status["']\s*,\s*\[\s*["']active["']\s*,\s*["']paused["']\s*\]\s*\)/),
      marker("stale close diagnostic", /campaign_close_stale_status/),
    ],
  },
  {
    id: "campaign_rollback_claim_not_rolled_back",
    file: "src/app/api/campaigns/[id]/rollback/route.ts",
    objective: "Campaign rollback must claim rolled_back_at before deleting or resetting related rows.",
    markers: [
      marker("rolled_back_at null predicate", /\.is\(\s*["']rolled_back_at["']\s*,\s*null\s*\)/),
      marker("already rolled back diagnostic", /campaign_already_rolled_back/),
    ],
  },
  {
    id: "maintenance_campaign_rollback_claim_not_rolled_back",
    file: "src/app/api/maintenance/campaigns/[id]/rollback/route.ts",
    objective: "Maintenance campaign rollback must claim rolled_back_at before reporting success.",
    markers: [
      marker("rolled_back_at null predicate", /\.is\(\s*["']rolled_back_at["']\s*,\s*null\s*\)/),
      marker("already rolled back diagnostic", /maintenance_campaign_already_rolled_back/),
    ],
  },
  {
    id: "program_publish_claim_draft_version",
    file: "src/app/api/programs/[id]/[action]/route.ts",
    objective: "Program publish must claim the latest draft version before marking it published.",
    markers: [
      marker("draft version predicate", /\.eq\(\s*["']state["']\s*,\s*["']draft["']\s*\)/),
      marker("stale publish diagnostic", /program_publish_stale_status/),
      marker("already published response", /alreadyPublished/),
    ],
  },
  {
    id: "assurance_finding_resolve_claim_non_terminal",
    file: "src/lib/assurance/assurance.ts",
    objective: "Finding resolve/dismiss must not rewrite already resolved or dismissed findings.",
    markers: [
      marker("resolved exclusion", /\.neq\(\s*["']status["']\s*,\s*["']resolved["']\s*\)/),
      marker("dismissed exclusion", /\.neq\(\s*["']status["']\s*,\s*["']dismissed["']\s*\)/),
      marker("inactive finding error", /finding_not_active/),
    ],
  },
  {
    id: "assurance_finding_terminal_response",
    file: "src/app/api/assurance/findings/[id]/resolve/route.ts",
    objective: "Finding resolve route must map terminal-state helper failures to a 409 conflict.",
    markers: [
      marker("inactive finding diagnostic", /assurance_finding_not_active/),
      marker("409 conflict response", /jsonProblem\(\s*inactive\s*\?\s*409\s*:\s*400/),
    ],
  },
  {
    id: "attestation_respond_claim_open_status",
    file: "src/app/api/attestations/[id]/respond/route.ts",
    objective: "Attestation response must claim open or overdue status before inserting a response.",
    markers: [
      marker("open/overdue status predicate", /\.in\(\s*["']status["']\s*,\s*\[\s*["']open["']\s*,\s*["']overdue["']\s*\]\s*\)/),
      marker("stale response diagnostic", /attestation_response_stale_status/),
      marker("insert rollback predicate", /\.eq\(\s*["']status["']\s*,\s*nextStatus\s*\)/),
    ],
  },
  {
    id: "evidence_review_claim_submitted_status",
    file: "src/app/api/evidence/[id]/[action]/route.ts",
    objective: "Evidence approve/reject must only transition submitted evidence.",
    markers: [
      marker("submitted preflight diagnostic", /v10_evidence_review_not_submitted/),
      marker("submitted update predicate", /\.eq\(\s*["']status["']\s*,\s*["']submitted["']\s*\)/),
      marker("stale review diagnostic", /v10_evidence_(?:approve|reject)_stale_status/),
    ],
  },
  {
    id: "evidence_submit_claim_open_requirement",
    file: "src/app/api/evidence/submit/route.ts",
    objective: "Evidence submit must claim an open requirement status before inserting a submission.",
    markers: [
      marker("open requirement status predicate", /\.in\(\s*["']status["']\s*,\s*\[\s*["']required["']\s*,\s*["']rejected["']\s*,\s*["']overdue["']\s*\]\s*\)/),
      marker("authenticated stale submit diagnostic", /v10_evidence_submit_stale_status/),
      marker("external stale submit diagnostic", /v10_external_evidence_submit_stale_status/),
    ],
  },
  {
    id: "external_action_submit_claim_not_submitted",
    file: "src/app/api/external-actions/[token]/submit/route.ts",
    objective: "External action submit must claim a non-submitted link before persisting payload side effects.",
    markers: [
      marker("not submitted predicate", /\.neq\(\s*["']status["']\s*,\s*["']submitted["']\s*\)/),
      marker("already submitted diagnostic", /external_action_already_submitted/),
    ],
  },
  {
    id: "playbook_approval_claim_awaiting_approval",
    file: "src/lib/assurance/playbooks.ts",
    objective: "Playbook approval must claim awaiting_approval before executing follow-up side effects.",
    markers: [
      marker("awaiting approval predicate", /\.eq\(\s*["']status["']\s*,\s*["']awaiting_approval["']\s*\)/),
      marker("approval claim result", /claimedRun/),
      marker("not awaiting approval error", /run_not_awaiting_approval/),
    ],
  },
];

function marker(name, pattern) {
  return { name, pattern };
}

function readSource(root, file) {
  const abs = path.join(root, file);
  if (!fs.existsSync(abs)) return { source: "", missing: true };
  return { source: fs.readFileSync(abs, "utf8"), missing: false };
}

export function analyzeTerminalStateGuards(root = ROOT) {
  const issues = [];
  let checkedMarkerCount = 0;

  for (const target of TARGETS) {
    const { source, missing } = readSource(root, target.file);
    if (missing) {
      issues.push({
        issue: "terminal_guard_file_missing",
        id: target.id,
        file: target.file,
        objective: target.objective,
      });
      continue;
    }

    for (const markerSpec of target.markers) {
      checkedMarkerCount += 1;
      if (!markerSpec.pattern.test(source)) {
        issues.push({
          issue: "terminal_guard_marker_missing",
          id: target.id,
          file: target.file,
          objective: target.objective,
          marker: markerSpec.name,
          pattern: String(markerSpec.pattern),
        });
      }
    }
  }

  return {
    checkId: "terminal-state-guards",
    ok: issues.length === 0,
    targetCount: TARGETS.length,
    checkedMarkerCount,
    issueCount: issues.length,
    issues,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = analyzeTerminalStateGuards();
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}
