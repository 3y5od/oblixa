import test from "node:test";
import assert from "node:assert/strict";
import { buildCheckRegistry, listCheckIds } from "./check-registry.mjs";
import { parseCommonFlags } from "./lib/args.mjs";
import { createResult } from "./lib/result.mjs";

test("check registry is populated", () => {
  const registry = buildCheckRegistry();
  assert.ok(registry.size > 0);
  assert.ok(registry.has("api-route-tests"));
});

test("check id listing is sorted", () => {
  const ids = listCheckIds();
  const sorted = [...ids].sort();
  assert.deepEqual(ids, sorted);
});

test("common flags parser reads strict/report/json", () => {
  const flags = parseCommonFlags(["--strict", "--report", "--json"]);
  assert.equal(flags.strict, true);
  assert.equal(flags.report, true);
  assert.equal(flags.json, true);
});

test("result contract sets deterministic fields", () => {
  const payload = createResult({
    checkId: "test",
    ok: true,
    strict: true,
    warnings: [],
    errors: [],
    meta: { foo: "bar" },
    startMs: Date.now() - 5,
  });
  assert.equal(payload.checkId, "test");
  assert.equal(payload.ok, true);
  assert.equal(payload.strict, true);
  assert.equal(typeof payload.generatedAt, "string");
  assert.equal(typeof payload.durationMs, "number");
  assert.equal(payload.exitCode, 0);
});
