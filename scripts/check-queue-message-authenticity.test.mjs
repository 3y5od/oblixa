import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { analyzeQueueMessageAuthenticity } from "./check-queue-message-authenticity.mjs";

function write(root, rel, content) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
}

test("analyzeQueueMessageAuthenticity validates outbound webhook signing and dedupe anchors", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-queue-authenticity-"));
  write(root, "package.json", JSON.stringify({ scripts: { "check:queue-message-authenticity": "x" } }));
  write(root, ".github/workflows/ci.yml", "npm run check:queue-message-authenticity\n");
  write(root, "scripts/pipelines/pipeline-security-comprehensive.mjs", '"check:queue-message-authenticity"\n');
  write(root, "src/app/api/webhooks/dispatch/route.ts", '{ name: "HMAC", hash: "SHA-256" },\nconst sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));\n{ onConflict: "outbound_event_id,subscription_id", ignoreDuplicates: true }\nsigningSecret = decryptIntegrationToken(sub.secret) ?? sub.secret;\nconst reencrypted = encryptIntegrationToken(signingSecret);\n"x-oblixa-signature": signature,\n');
  write(root, "src/app/api/webhooks/dispatch/route.test.ts", 'it("signs webhook deliveries with HMAC and dedupes delivery rows", async () => {})\nexpect(headers["x-oblixa-signature"]).toBe(expectedSignature);\nexpect(deliverySeedUpsert).toHaveBeenCalledWith(\n');

  const report = analyzeQueueMessageAuthenticity(root);
  assert.equal(report.ok, true);
  assert.equal(report.issueCount, 0);
});