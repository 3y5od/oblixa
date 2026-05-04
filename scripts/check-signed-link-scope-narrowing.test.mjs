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
  write(root, "src/app/api/external-actions/create-link/route.ts", 'if (!isValidExternalActionType(rawAction)) {\n}\nconst expiresInHours = Math.max(1, Math.min(720, Number(body.expiresInHours ?? 72)));\nconst scope: Record<string, unknown> = {\nworkflow_config: body.workflowConfig ?? {},\ncollaboration_version: "v6",\n};\nreturn NextResponse.json({ error: "workflowDeadlineIso must be a future ISO timestamp" }, { status: 400 });\nreturn NextResponse.json({ error: "workflowDeadlineIso must be on or before the link expires_at" }, { status: 400 });\nconst decisionWorkspaceId =\ntypeof rawDw === "string" && /^[0-9a-f-]{36}$/i.test(rawDw) ? rawDw : null;\npasscode_hash: passcodeHash,\nrequires_reauth: Boolean(body.requiresReauth),\n');
  write(root, "src/app/api/external-actions/create-link/route.test.ts", 'it("returns 400 for invalid actionType", async () => {})\nit("returns 400 when workflowDeadlineIso is in the past", async () => {})\nit("returns 400 when workflowDeadlineIso is after link expiry", async () => {})\nit("returns 201 externalAction payload shape and stores workflow_deadline_iso on scope_json when deadline is valid", async () => {})\nexpect(captured.scope_json?.workflow_ack_required).toBe(true);\n');
  write(root, "src/app/api/external-actions/[token]/submit/route.ts", 'const bodyForValidation = { ...rawPayload };\ndelete bodyForValidation.passcode;\ndelete bodyForValidation.submitTicket;\nconst validated = validateExternalActionPayload(at as ExternalActionType, bodyForValidation);\ncorrection_message: validated.error,\n');
  write(root, "src/app/api/external-actions/[token]/status/route.ts", 'const { passcode_hash: _h, ...rest } = data;\nrequires_passcode: Boolean(_h),\nworkflow_chain: Array.isArray(scope.workflow_chain) ? scope.workflow_chain : [],\n');
  write(root, "src/app/api/external-actions/[token]/participant/workflow-step/route.ts", 'if (link.expires_at && link.expires_at < nowIso()) {\n}\nif (!verifyExternalPasscode(body.passcode, link.passcode_hash ?? null)) {\n}\n');
  write(root, "src/lib/product-surface/v8-external-actions-token-contract.test.ts", 'const BEARER_STYLE_POST_ROUTES = [\n"[token]/submit/route.ts"\n];\nconst hasVerify = raw.includes("verifyExternalSubmitTicket(") || raw.includes("verifyExternalPasscode(");\nit("internal workflow-step POST is session-governed (not anonymous token crypto)", () => {\nexpect(raw.includes("getApiAuthContext(")).toBe(true);\nexpect(raw.includes("requireApiWorkspaceEligibility(")).toBe(true);\n});\n');

  const report = analyzeSignedLinkScopeNarrowing(root);
  assert.equal(report.ok, true);
  assert.equal(report.issueCount, 0);
});