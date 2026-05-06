import test from "node:test";
import assert from "node:assert/strict";
import { assessRetryWorkerHeartbeat } from "./slo-monitor.mjs";

test("stale heartbeat is warning-only when retry queue is empty", () => {
  const result = assessRetryWorkerHeartbeat({
    queueDepth: 0,
    heartbeatAgeMin: 73,
    hasHeartbeat: true,
  });

  assert.equal(result.error, null);
  assert.equal(result.status, "stale_but_idle");
  assert.match(result.warnings[0] ?? "", /queue is empty/);
});

test("stale heartbeat remains critical when retry queue has work", () => {
  const result = assessRetryWorkerHeartbeat({
    queueDepth: 4,
    heartbeatAgeMin: 73,
    hasHeartbeat: true,
  });

  assert.equal(result.status, "stale");
  assert.match(result.error ?? "", /critical: retry-worker heartbeat stale/);
});

test("missing heartbeat is tolerated only when idle", () => {
  const idle = assessRetryWorkerHeartbeat({
    queueDepth: 0,
    heartbeatAgeMin: null,
    hasHeartbeat: false,
  });
  assert.equal(idle.error, null);
  assert.equal(idle.status, "missing_but_idle");

  const active = assessRetryWorkerHeartbeat({
    queueDepth: 2,
    heartbeatAgeMin: null,
    hasHeartbeat: false,
  });
  assert.equal(active.status, "missing");
  assert.match(active.error ?? "", /critical: no retry-worker heartbeat found/);
});