import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { tmpdir } from "node:os";
import { analyzePersistenceRedaction } from "./check-persistence-redaction.mjs";

function makeFixtureRoot() {
  const root = join(tmpdir(), `oblixa-redaction-${process.pid}-${Math.random().toString(16).slice(2)}`);
  for (const dir of ["src/lib/security", "src/lib/v6", "src/lib"]) {
    mkdirSync(join(root, dir), { recursive: true });
  }
  writeFileSync(
    join(root, "src/lib/security/persistence-redaction.ts"),
    "export const redactForPersistence = 1; export const redactPersistenceString = 1; export const isHighRiskPersistenceKey = 1;\n"
  );
  writeFileSync(join(root, "src/lib/v10-server-contracts.ts"), "redactPersistenceString(input)\n");
  writeFileSync(join(root, "src/lib/product-telemetry.ts"), "redactPersistenceString(input)\n");
  writeFileSync(
    join(root, "src/lib/v6/external-collaboration.ts"),
    "redactForPersistence(payload); payload_json: redactForPersistence(payload)\n"
  );
  writeFileSync(
    join(root, "src/lib/import-jobs.ts"),
    "minimizeImportRawPayload(); raw_payload_minimized; ttl_expires_at;\n"
  );
  writeFileSync(
    join(root, "src/lib/security/persistence-redaction.test.ts"),
    "raw tokens, cookies, headers, and document text; strips sensitive query params\n"
  );
  return root;
}

test("persistence redaction check accepts required sites", () => {
  assert.equal(analyzePersistenceRedaction(makeFixtureRoot()).issueCount, 0);
});

test("persistence redaction check rejects raw external event payload persistence", () => {
  const root = makeFixtureRoot();
  writeFileSync(join(root, "src/lib/v6/external-collaboration.ts"), "payload_json: payload\n");
  const report = analyzePersistenceRedaction(root);
  assert.equal(
    report.issues.some((issue) => issue.issue === "external_action_event_raw_payload_persisted"),
    true
  );
});
