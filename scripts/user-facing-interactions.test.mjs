import test from "node:test";
import assert from "node:assert/strict";
import {
  buildUserFacingInteractionReport,
  assertUserFacingInteractionReport,
} from "./report-user-facing-interactions.mjs";
import { getUserFacingInteractionProfile } from "./check-user-facing-interactions.mjs";

test("buildUserFacingInteractionReport includes settings/security and interaction audit rows", () => {
  const report = buildUserFacingInteractionReport();
  const securityRoute = report.routes.rows.find((entry) => entry.route === "/settings/security");
  assert.ok(securityRoute);
  assert.equal(securityRoute.owner, "security");
  assert.equal(securityRoute.visitPath, "/settings/security");
  assert.ok(report.interactions.total > 0);
  assert.ok((report.interactions.byKind.raw_client_fetch ?? 0) > 0);
  assert.ok((report.interactions.byKind.new_tab_link ?? 0) > 0);
});

test("user-facing interaction profiles include the expected closure steps", () => {
  const pr = getUserFacingInteractionProfile("pr");
  const nightly = getUserFacingInteractionProfile("nightly");
  assert.ok(pr.includes("check:ui-surface-consistency"));
  assert.ok(pr.includes("test:e2e:smoke"));
  assert.ok(nightly.includes("test:e2e:visual:full"));
  assert.ok(nightly.includes("test:e2e:multi-browser"));
});

test("user-facing interaction report has no blocking route closure failures", () => {
  const report = buildUserFacingInteractionReport();
  assert.equal(assertUserFacingInteractionReport(report).length, 0);
});