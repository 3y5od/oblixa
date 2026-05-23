import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { analyzeStaleWriteGuards } from "./check-stale-write-guards.mjs";

function makeRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "stale-write-guards-"));
}

function write(root, rel, content) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
}

function writeAllTargetFiles(root, overrides = {}) {
  const directRoute = (prefix) => `
    requireExpectedVersionForMutation(request, { diagnosticPrefix: "${prefix}" });
    await q.eq("updated_at", expectedVersionResult.expectedVersion);
    staleExpectedVersionResponse({ diagnosticPrefix: "${prefix}" });
    expectedVersionResult.expectedVersion;
  `;
  const delegatedRoute = (prefix) => `
    requireExpectedVersionForMutation(request, { diagnosticPrefix: "${prefix}" });
    staleExpectedVersionResponse({ diagnosticPrefix: "${prefix}" });
    expectedVersionResult.expectedVersion;
  `;
  const delegatedHelper = `
    expectedVersion?: string | number | null;
    updateRowById(admin, table, orgId, id, payload, { expectedUpdatedAt: expectedVersion });
  `;
  const files = {
    "src/lib/security/stale-write-guard.ts": `
      getV10ExpectedVersionFromRequest(request);
      "expected_version_required";
      "stale_version";
    `,
    "src/lib/v6/service.ts": `
      options?: { expectedUpdatedAt?: string | number | null };
      query.eq("updated_at", String(options.expectedUpdatedAt));
    `,
    "src/app/api/autopilot/rules/[id]/route.ts": delegatedRoute("autopilot_rule"),
    "src/lib/v6/autopilot.ts": delegatedHelper,
    "src/app/api/campaigns/[id]/route.ts": directRoute("campaign"),
    "src/app/api/campaigns/[id]/contracts/[rowId]/route.ts": directRoute("campaign_contract_row"),
    "src/app/api/control-policies/[id]/route.ts": delegatedRoute("control_policy"),
    "src/lib/v6/control-policies.ts": delegatedHelper,
    "src/app/api/decisions/[id]/route.ts": directRoute("decision"),
    "src/app/api/decisions/packet-templates/[id]/route.ts": directRoute("packet_template"),
    "src/app/api/review-boards/[id]/route.ts": delegatedRoute("review_board"),
    "src/lib/v6/review-boards.ts": delegatedHelper,
    "src/app/api/workspace/v6-settings/route.ts": `
      settingsVersion: snapshot.updatedAt;
      ${delegatedRoute("workspace_v6_settings")}
      expectedVersion: expectedVersionResult.expectedVersion;
    `,
    "src/lib/v6/org-settings.ts": `
      options?: { expectedVersion?: string | number | null };
      select("v6_org_settings_json, updated_at");
      q.eq("updated_at", String(expectedVersion));
      return { error: { message: "stale_version" } };
    `,
  };

  for (const [file, content] of Object.entries({ ...files, ...overrides })) {
    if (content === null) continue;
    write(root, file, content);
  }
}

test("accepts the full stale-write guard marker set", () => {
  const root = makeRoot();
  writeAllTargetFiles(root);

  const report = analyzeStaleWriteGuards(root);

  assert.equal(report.ok, true);
  assert.equal(report.issueCount, 0);
  assert.equal(report.targetCount, 14);
  assert.equal(report.checkedMarkerCount > 35, true);
});

test("rejects missing stale-write guard files and markers", () => {
  const root = makeRoot();
  writeAllTargetFiles(root, {
    "src/app/api/campaigns/[id]/route.ts": `
      requireExpectedVersionForMutation(request, { diagnosticPrefix: "campaign" });
    `,
    "src/lib/v6/org-settings.ts": null,
  });

  const report = analyzeStaleWriteGuards(root);

  assert.equal(report.ok, false);
  assert(report.issues.some((issue) => issue.issue === "stale_write_guard_file_missing"));
  assert(report.issues.some((issue) => issue.id === "campaign_patch_expected_version"));
});
