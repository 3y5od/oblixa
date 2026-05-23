import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { analyzePoisonMessageContainment } from "./check-poison-message-containment.mjs";

function write(root, rel, content) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
}

test("analyzePoisonMessageContainment validates retry lock, poison, and terminal-failure anchors", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-poison-message-"));
  write(root, "package.json", JSON.stringify({ scripts: { "check:poison-message-containment": "x" } }));
  write(root, ".github/workflows/ci.yml", "npm run check:poison-message-containment\n");
  write(root, "scripts/pipelines/pipeline-security-comprehensive.mjs", '"check:poison-message-containment"\n');
  write(root, "src/lib/notification-delivery.ts", 'return { delivered: false, error: "delivery_locked_or_not_due", skipped: true };\nconst validKinds: string[] = ["reminder_due", "saved_view_summary", "review_board_packet", "slack_workflow"];\nsendResult = { error: new Error("invalid_retry_payload_kind") };\nsendResult = retryPayload\n? await runRetryPayload(retryPayload)\n: { error: new Error("missing_retry_payload") };\nconst terminal = isTerminalDeliveryError(sanitizedError);\nconst isFinal = terminal || nextAttempt >= maxAttempts;\nstatus: isFinal ? "failed" : "retrying",\nreturn Math.max(1, Math.min(5, Math.trunc(raw)));\n');
  write(root, "src/lib/notification-delivery.test.ts", 'it("fails poison messages without retry payload when max attempts reached", async () => {})\nexpect(rows[0]?.last_error).toContain("missing_retry_payload");\nit("uses lock semantics so overlapping workers do not duplicate sends", async () => {})\nit("clamps max attempts to 5 for repeated failures", async () => {})\nit("short-circuits terminal errors without extra retries", async () => {})\n');

  const report = analyzePoisonMessageContainment(root);
  assert.equal(report.ok, true);
  assert.equal(report.issueCount, 0);
});
