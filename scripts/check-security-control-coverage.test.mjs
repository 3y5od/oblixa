import test from "node:test";
import assert from "node:assert/strict";
import { validateSecurityControlCoverage } from "./check-security-control-coverage.mjs";

test("security control coverage matrix validates", () => {
  const r = validateSecurityControlCoverage();
  assert.equal(r.ok, true);
  assert.ok(r.rowCount > 200);
});
