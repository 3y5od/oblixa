import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

import { analyzeBeaconTimingLeakage } from "./check-beacon-timing-leakage.mjs";

function makeRoot(files) {
  const root = mkdtempSync(path.join(tmpdir(), "oblixa-beacon-check-"));
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(root, rel);
    mkdirSync(path.dirname(abs), { recursive: true });
    writeFileSync(abs, content);
  }
  return root;
}

test("accepts wrapper beacon use and approved first-party telemetry", () => {
  const root = makeRoot({
    "src/lib/http/client-json.ts": "navigator.sendBeacon('/x', blob); fetch('/x', { keepalive: true });",
    "src/components/layout/page-load-reporter.tsx": "sendJsonKeepalive('/api/product-telemetry/page-load', body);",
  });
  const report = analyzeBeaconTimingLeakage(root);
  assert.equal(report.ok, true);
});

test("rejects direct beacon use outside the wrapper", () => {
  const root = makeRoot({
    "src/app/example.ts": "navigator.sendBeacon('/api/product-telemetry/page-load', blob);",
  });
  const report = analyzeBeaconTimingLeakage(root);
  assert.equal(report.ok, false);
  assert.equal(report.issues[0].issue, "direct_send_beacon_outside_wrapper");
});

test("rejects unapproved or dynamic keepalive endpoints", () => {
  const root = makeRoot({
    "src/app/example.ts": "sendJsonKeepalive('/api/private/timing', body);\nsendJsonKeepalive(endpoint, body);",
  });
  const report = analyzeBeaconTimingLeakage(root);
  assert.equal(report.ok, false);
  assert.deepEqual(
    report.issues.map((row) => row.issue).sort(),
    ["dynamic_keepalive_endpoint_requires_review", "unapproved_keepalive_endpoint"]
  );
});

test("rejects Server-Timing header surfaces", () => {
  const root = makeRoot({
    "src/app/api/example/route.ts": "return new Response('ok', { headers: { 'Server-Timing': 'db;dur=1' } });",
  });
  const report = analyzeBeaconTimingLeakage(root);
  assert.equal(report.ok, false);
  assert.equal(report.issues[0].issue, "server_timing_header_surface");
});
