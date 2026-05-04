import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { analyzeSecurityEventContract, extractSecurityAuditActions } from "./check-security-event-contract.mjs";

function write(root, rel, content) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
}

test("extractSecurityAuditActions parses sorted security.* action literals", () => {
  assert.deepEqual(extractSecurityAuditActions('"security.b"\n"security.a"\n'), ["security.a", "security.b"]);
});

test("analyzeSecurityEventContract validates writer delegation and runtime callsites", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-security-event-"));
  write(root, "package.json", JSON.stringify({ scripts: { "check:security-event-contract": "x" } }));
  write(root, ".github/workflows/ci.yml", "npm run check:security-event-contract\n");
  write(root, "scripts/pipelines/pipeline-security-comprehensive.mjs", '"check:security-event-contract"\n');
  write(
    root,
    "src/lib/security/audit-write.ts",
    'import { recordV10AuditEvent } from "x";\nexport type SecurityAuditAction = "security.a" | "security.b";\nexport async function recordSecurityAuditEvent(){ return recordV10AuditEvent(); }\n'
  );
  for (const rel of [
    "src/actions/auth.ts",
    "src/actions/mfa.ts",
    "src/actions/sessions.ts",
    "src/actions/workflow-config.ts",
    "src/app/api/me/export/route.ts",
    "src/app/api/me/account/route.ts",
    "src/app/api/internal/debugging-sweep/route.ts",
  ]) {
    write(root, rel, 'import { recordSecurityAuditEvent } from "@/lib/security/audit-write";\nvoid recordSecurityAuditEvent(null as never, { action: "security.a" });\nvoid recordSecurityAuditEvent(null as never, { action: "security.b" });\n');
  }

  const report = analyzeSecurityEventContract(root);
  assert.equal(report.ok, true);
  assert.equal(report.issueCount, 0);
  assert.equal(report.actionCount, 2);
});