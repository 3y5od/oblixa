import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { analyzeDuplicateExecutionPolicy } from "./check-duplicate-execution-policy.mjs";

function write(root, rel, content) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
}

test("analyzeDuplicateExecutionPolicy validates route and cron idempotency anchors", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-duplicate-execution-"));
  write(root, "package.json", JSON.stringify({ scripts: { "check:duplicate-execution-policy": "x" } }));
  write(root, ".github/workflows/ci.yml", "npm run check:duplicate-execution-policy\n");
  write(root, "scripts/pipelines/pipeline-security-comprehensive.mjs", '"check:duplicate-execution-policy"\n');
  write(root, "src/lib/idempotency.ts", 'const IDEMPOTENCY_KEY_RE = /^[A-Za-z0-9:_\\-]{8,200}$/;\nconst limiterKey = `idem:${input.scope}:${input.actorKey}:${key}`;\nheaders: { "Retry-After": String(Math.max(1, Math.ceil(result.retryAfterMs / 1000))) },\n');
  write(root, "src/app/api/external-actions/create-link/route.ts", 'const duplicate = await enforceIdempotency(request, {\nscope: "external-action.create-link",\nactorKey: `${ctx.orgId}:${ctx.userId}`,\n});\n');
  write(root, "src/app/api/external-actions/create-link/route.test.ts", 'it("blocks duplicate replay of create-link with x-idempotency-key", async () => {})\nerror: "Duplicate request blocked by idempotency key",\n');
  write(root, "src/app/api/external-actions/[token]/workflow-step/route.ts", 'const duplicate = await enforceIdempotency(request, {\nscope: "external-workflow.internal-step",\nactorKey: `${ctx.orgId}:${ctx.userId}:${tokenKey}`,\n});\n');
  write(root, "src/app/api/external-actions/[token]/workflow-step/route.test.ts", 'it("blocks duplicate replay of internal workflow-step with x-idempotency-key", async () => {})\nerror: "Duplicate request blocked by idempotency key",\n');
  write(root, "src/app/api/external-actions/[token]/participant/workflow-step/route.ts", 'const duplicate = await enforceIdempotency(request, {\nscope: "external-workflow.participant-step",\nactorKey: tokenKey,\n});\n');
  write(root, "src/app/api/external-actions/[token]/participant/workflow-step/route.test.ts", 'it("blocks duplicate replay of participant workflow-step with x-idempotency-key", async () => {})\nerror: "Duplicate request blocked by idempotency key",\n');
  write(root, "src/app/api/external-actions/[token]/submit/route.ts", 'const duplicate = await enforceIdempotency(request, {\nscope: "external-action.submit",\nactorKey: tokenKey,\n});\n');
  write(root, "src/app/api/stripe/webhook/route.ts", '.insert({ id: event.id, status: "processing" });\nif (claimErr.code === "23505") {}\nduplicate: true\n');
  write(root, "src/lib/cron/route-runner.ts", 'const duplicate = await enforceIdempotency(request, {\nscope: `cron:${options.route}`,\nactorKey: "cron",\n});\nreason: "duplicate_request",\n');
  write(root, "artifacts/security-route-matrix.json", '[{"idempotency_or_job_lock_policy":"idempotency_or_duplicate_guard"},{"idempotency_or_job_lock_policy":"job_lock_or_claim"},{"idempotency_or_job_lock_policy":"terminal_state_guard"}]\n');

  const report = analyzeDuplicateExecutionPolicy(root);
  assert.equal(report.ok, true);
  assert.equal(report.issueCount, 0);
});
