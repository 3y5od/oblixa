import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { analyzeTerminalStateGuards } from "./check-terminal-state-guards.mjs";

function makeRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "terminal-state-guards-"));
}

function write(root, rel, content) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
}

function writeAllTargetFiles(root, overrides = {}) {
  const files = {
    "src/app/api/approvals/[id]/[action]/route.ts": `
      await q.eq("status", "pending").select("id, status").maybeSingle();
      "v10_approval_decision_stale_status";
      "v10_approval_delegate_not_pending";
      "v10_approval_escalate_not_pending";
      "v10_approval_delegate_stale_status";
      "v10_approval_escalate_stale_status";
    `,
    "src/app/api/decisions/[id]/approve/route.ts": `
      await q.in("status", ["open", "in_review"]);
      "decision_approval_stale_status";
    `,
    "src/app/api/decisions/[id]/close/route.ts": `
      await q.neq("status", "closed");
      "decision_close_stale_status";
      return { postActionResult: null };
    `,
    "src/app/api/campaigns/[id]/close/route.ts": `
      await q.in("status", ["active", "paused"]);
      "campaign_close_stale_status";
    `,
    "src/app/api/campaigns/[id]/rollback/route.ts": `
      await q.is("rolled_back_at", null);
      "campaign_already_rolled_back";
    `,
    "src/app/api/maintenance/campaigns/[id]/rollback/route.ts": `
      await q.is("rolled_back_at", null);
      "maintenance_campaign_already_rolled_back";
    `,
    "src/app/api/programs/[id]/[action]/route.ts": `
      if (alreadyPublished) return Response.json({});
      await q.eq("state", "draft");
      "program_publish_stale_status";
    `,
    "src/lib/v6/assurance.ts": `
      await q.neq("status", "resolved").neq("status", "dismissed");
      "finding_not_active";
    `,
    "src/app/api/assurance/findings/[id]/resolve/route.ts": `
      "assurance_finding_not_active";
      return jsonProblem(inactive ? 409 : 400, {});
    `,
    "src/app/api/attestations/[id]/respond/route.ts": `
      await q.in("status", ["open", "overdue"]);
      await q.eq("status", nextStatus);
      "attestation_response_stale_status";
    `,
    "src/app/api/evidence/[id]/[action]/route.ts": `
      "v10_evidence_review_not_submitted";
      await q.eq("status", "submitted");
      "v10_evidence_approve_stale_status";
    `,
    "src/app/api/evidence/submit/route.ts": `
      await q.in("status", ["required", "rejected", "overdue"]);
      "v10_evidence_submit_stale_status";
      "v10_external_evidence_submit_stale_status";
    `,
    "src/app/api/external-actions/[token]/submit/route.ts": `
      await q.neq("status", "submitted");
      "external_action_already_submitted";
    `,
    "src/lib/v6/playbooks.ts": `
      const claimedRun = await q.eq("status", "awaiting_approval");
      "run_not_awaiting_approval";
    `,
  };

  for (const [file, content] of Object.entries({ ...files, ...overrides })) {
    if (content === null) continue;
    write(root, file, content);
  }
}

test("accepts the full terminal-state guard marker set", () => {
  const root = makeRoot();
  writeAllTargetFiles(root);

  const report = analyzeTerminalStateGuards(root);

  assert.equal(report.ok, true);
  assert.equal(report.issueCount, 0);
  assert.equal(report.targetCount, 15);
  assert.equal(report.checkedMarkerCount > 20, true);
});

test("rejects missing terminal-state guard files and markers", () => {
  const root = makeRoot();
  writeAllTargetFiles(root, {
    "src/app/api/decisions/[id]/approve/route.ts": `
      await q.neq("status", "closed");
    `,
    "src/app/api/campaigns/[id]/rollback/route.ts": null,
  });

  const report = analyzeTerminalStateGuards(root);

  assert.equal(report.ok, false);
  assert(report.issues.some((issue) => issue.issue === "terminal_guard_file_missing"));
  assert(report.issues.some((issue) => issue.id === "decision_approve_claim_open_status"));
});
