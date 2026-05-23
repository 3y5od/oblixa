import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { analyzeMutationRaceSafety } from "./check-mutation-race-safety.mjs";

function makeRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mutation-race-safety-"));
  fs.mkdirSync(path.join(root, "artifacts"), { recursive: true });
  return root;
}

function write(root, rel, content) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
}

function writeMatrix(root, rows) {
  write(root, "artifacts/security-route-matrix.json", `${JSON.stringify(rows, null, 2)}\n`);
}

test("accepts matrix rows with matching duplicate, terminal-state, and cron lock signals", () => {
  const root = makeRoot();
  write(root, "src/app/api/good/route.ts", `
export async function POST(request) {
  const duplicate = await enforceIdempotency(request, { scope: "good", actorKey: "actor" });
  if (duplicate) return duplicate;
  void recordApiMutationAuditEvent(admin, {});
  return Response.json({ ok: true });
}
`);
  write(root, "src/app/api/blocked/route.ts", `
export async function POST(request) {
  if (!hasSensitiveActionProof()) {
    void recordSecurityAuditEvent(admin, {
      action: "security.example_blocked",
      outcome: "forbidden",
    });
    return Response.json({ ok: false }, { status: 403 });
  }
  const duplicate = await enforceIdempotency(request, { scope: "blocked", actorKey: "actor" });
  if (duplicate) return duplicate;
  return Response.json({ ok: true });
}
`);
  write(root, "src/app/api/status/route.ts", `
export async function PATCH() {
  await admin.from("items").update({ status: "closed" }).eq("status", "open");
  return Response.json({ ok: true });
}
`);
  write(root, "src/app/api/cron/example/route.ts", `
export async function GET(request) {
  return runCronRoute(request, { route: "/api/cron/example" });
}
`);
  writeMatrix(root, [
    {
      path: "/api/good",
      method: "POST",
      route_file: "src/app/api/good/route.ts",
      idempotency_or_job_lock_policy: "idempotency_or_duplicate_guard",
    },
    {
      path: "/api/blocked",
      method: "POST",
      route_file: "src/app/api/blocked/route.ts",
      idempotency_or_job_lock_policy: "idempotency_or_duplicate_guard",
    },
    {
      path: "/api/status",
      method: "PATCH",
      route_file: "src/app/api/status/route.ts",
      idempotency_or_job_lock_policy: "terminal_state_guard",
    },
    {
      path: "/api/cron/example",
      method: "GET",
      route_file: "src/app/api/cron/example/route.ts",
      idempotency_or_job_lock_policy: "job_lock_or_claim",
    },
  ]);

  const report = analyzeMutationRaceSafety(root);
  assert.equal(report.ok, true);
  assert.equal(report.issueCount, 0);
  assert.equal(report.checkedRowCount, 4);
});

test("rejects missing policy, missing source signal, and audit-before-idempotency regressions", () => {
  const root = makeRoot();
  write(root, "src/app/api/missing/route.ts", `
export async function POST() {
  await admin.from("items").insert({ id: "1" });
  return Response.json({ ok: true });
}
`);
  write(root, "src/app/api/audit-first/route.ts", `
export async function POST(request) {
  void recordApiMutationAuditEvent(admin, {});
  const duplicate = await enforceIdempotency(request, { scope: "bad", actorKey: "actor" });
  if (duplicate) return duplicate;
  return Response.json({ ok: true });
}
`);
  writeMatrix(root, [
    {
      path: "/api/missing",
      method: "POST",
      route_file: "src/app/api/missing/route.ts",
      idempotency_or_job_lock_policy: "idempotency_or_duplicate_guard",
    },
    {
      path: "/api/side-effect",
      method: "POST",
      route_file: "src/app/api/missing/route.ts",
      idempotency_or_job_lock_policy: "side_effect_policy_required",
    },
    {
      path: "/api/audit-first",
      method: "POST",
      route_file: "src/app/api/audit-first/route.ts",
      idempotency_or_job_lock_policy: "idempotency_or_duplicate_guard",
    },
  ]);

  const report = analyzeMutationRaceSafety(root);
  assert.equal(report.ok, false);
  assert.deepEqual(
    report.issues.map((issue) => issue.issue).sort(),
    ["audit_before_idempotency_guard", "race_safety_signal_missing", "side_effect_policy_required"]
  );
});
