import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { analyzeSignedLinkScopeNarrowing } from "./check-signed-link-scope-narrowing.mjs";

function write(root, rel, content) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
}

test("analyzeSignedLinkScopeNarrowing validates scoped external-link creation and token route boundaries", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-signed-link-scope-"));
  write(root, "package.json", JSON.stringify({ scripts: { "check:signed-link-scope-narrowing": "x" } }));
  write(root, ".github/workflows/ci.yml", "npm run check:signed-link-scope-narrowing\n");
  write(root, "scripts/pipelines/pipeline-security-comprehensive.mjs", '"check:signed-link-scope-narrowing"\n');
  write(root, "src/app/api/external-actions/create-link/route.ts", 'if (!isValidExternalActionType(rawAction)) {\n}\nfunction parseExpiresInHours(value: unknown, actionType: ExternalActionType): number {\n}\nparseExpiresInHours(body.expiresInHours, actionType)\nisSensitiveExternalActionType(actionType)\nparseFutureIsoTimestamp(workflowDeadlineRaw)\nconst scope: Record<string, unknown> = {\nworkflow_config: body.workflowConfig ?? {},\ncollaboration_version: "v6",\n};\nerror: "workflowDeadlineIso must be a future ISO timestamp",\nerror: "workflowDeadlineIso must be on or before the link expires_at",\nconst decisionWorkspaceId =\ntypeof rawDw === "string" && /^[0-9a-f-]{36}$/i.test(rawDw) ? rawDw : null;\ntoken: null,\ntoken_hash: tokenHash,\ntoken_prefix: tokenPrefix,\npasscode_hash: passcodeHash,\nrequires_reauth: requiresReauth,\n');
  write(root, "src/app/api/external-actions/create-link/route.test.ts", 'it("returns 400 for invalid actionType", async () => {})\nit("returns 400 when workflowDeadlineIso is in the past", async () => {})\nit("returns 400 when workflowDeadlineIso is not a strict UTC ISO timestamp", async () => {})\nit("returns 400 when workflowDeadlineIso is after link expiry", async () => {})\nit("returns 201 externalAction payload shape and stores workflow_deadline_iso on scope_json when deadline is valid", async () => {})\nexpect(captured.scope_json?.workflow_ack_required).toBe(true);\nit("allows passcode-protected sensitive links without forcing reauth", async () => {})\nit("clamps sensitive external action TTLs to one week", async () => {})\n');
  write(root, "src/app/api/external-actions/[token]/submit/route.ts", 'const bodyForValidation = { ...rawPayload };\ndelete bodyForValidation.passcode;\ndelete bodyForValidation.submitTicket;\nexternalActionTokenMatches(row, token)\nconst validated = validateExternalActionPayload(at as ExternalActionType, bodyForValidation);\ncorrection_message: validated.error,\n');
  write(root, "src/app/api/external-actions/[token]/status/route.ts", 'externalActionTokenMatches(row, token)\npasscode_hash: _h,\nexternalAction: {\nstatus: effectiveStatus,\nrequires_passcode: Boolean(_h),\nworkflow_step_count: Array.isArray(scope.workflow_chain) ? scope.workflow_chain.length : 0,\n');
  write(root, "src/app/api/external-actions/[token]/participant/workflow-step/route.ts", 'externalActionTokenMatches(row, token)\nif (link.expires_at && link.expires_at < nowIso()) {\n}\nif (!verifyExternalPasscode(body.passcode, link.passcode_hash ?? null)) {\n}\n');
  write(root, "src/app/api/decisions/[id]/packet-runs/[runId]/route.ts", '.eq("organization_id", ctx.orgId)\nif (String(run.decision_workspace_id) !== decisionId) {\n}\nisDecisionPacketArtifactStoragePathScoped(storagePath, {\nconst expiresIn = DECISION_PACKET_SIGNED_URL_TTL_SECONDS;\naction: "decision_packet_artifact.download_url_created"\n"Cache-Control": "private, no-store"\n');
  write(root, "src/lib/v5/decision-packet-storage.ts", 'export const DECISION_PACKET_SIGNED_URL_TTL_SECONDS = 5 * 60;\nexport function isDecisionPacketArtifactStoragePathScoped(\nexport function normalizeDecisionPacketSignedUrlTtl(expiresInSeconds: number): number {\n.createSignedUrl(storagePath, safeExpiresIn);\n');
  write(root, "src/lib/product-surface/v8-external-actions-token-contract.test.ts", 'const BEARER_STYLE_POST_ROUTES = [\n"[token]/submit/route.ts"\n];\nconst hasVerify = raw.includes("verifyExternalSubmitTicket(") || raw.includes("verifyExternalPasscode(");\nit("internal workflow-step POST is session-governed (not anonymous token crypto)", () => {\nexpect(raw.includes("getApiAuthContext(")).toBe(true);\nexpect(raw.includes("requireApiWorkspaceEligibility(")).toBe(true);\n});\n');

  const report = analyzeSignedLinkScopeNarrowing(root);
  assert.equal(report.ok, true);
  assert.equal(report.issueCount, 0);
});
