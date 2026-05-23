#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();

const TARGETS = [
  {
    id: "shared_expected_version_guard",
    file: "src/lib/security/stale-write-guard.ts",
    objective: "Shared stale-write guard must read x-v10-expected-version or If-Match and emit deterministic conflicts.",
    markers: [
      marker("V10 expected version header parser", /getV10ExpectedVersionFromRequest/),
      marker("missing expected version diagnostic", /expected_version_required/),
      marker("stale version diagnostic", /stale_version/),
    ],
  },
  {
    id: "v6_update_row_expected_updated_at",
    file: "src/lib/v6/service.ts",
    objective: "Shared V6 row updates must support expected updated_at predicates.",
    markers: [
      marker("expected updated_at option", /expectedUpdatedAt/),
      marker("updated_at predicate", /\.eq\(\s*["']updated_at["']\s*,\s*String\(options\.expectedUpdatedAt\)\s*\)/),
    ],
  },
  {
    id: "autopilot_rule_patch_expected_version",
    file: "src/app/api/autopilot/rules/[id]/route.ts",
    objective: "Autopilot rule edits must require an expected version and map stale writes to 409.",
    markers: routeMarkers("autopilot_rule"),
  },
  {
    id: "autopilot_rule_helper_expected_updated_at",
    file: "src/lib/v6/autopilot.ts",
    objective: "Autopilot rule helper must pass expected versions into the shared update predicate.",
    markers: [
      marker("expected version helper parameter", /expectedVersion\?:\s*string\s*\|\s*number\s*\|\s*null/),
      marker("expected updated_at forwarding", /expectedUpdatedAt:\s*expectedVersion/),
    ],
  },
  {
    id: "campaign_patch_expected_version",
    file: "src/app/api/campaigns/[id]/route.ts",
    objective: "Campaign edits must require an expected version and claim the current updated_at.",
    markers: routeUpdatedAtMarkers("campaign"),
  },
  {
    id: "campaign_contract_row_patch_expected_version",
    file: "src/app/api/campaigns/[id]/contracts/[rowId]/route.ts",
    objective: "Campaign contract-row edits must require an expected version and claim the current updated_at.",
    markers: routeUpdatedAtMarkers("campaign_contract_row"),
  },
  {
    id: "control_policy_patch_expected_version",
    file: "src/app/api/control-policies/[id]/route.ts",
    objective: "Control-policy settings edits must require an expected version and map stale writes to 409.",
    markers: routeMarkers("control_policy"),
  },
  {
    id: "control_policy_helper_expected_updated_at",
    file: "src/lib/v6/control-policies.ts",
    objective: "Control-policy helper must pass expected versions into the shared update predicate.",
    markers: [
      marker("expected version helper parameter", /expectedVersion\?:\s*string\s*\|\s*number\s*\|\s*null/),
      marker("expected updated_at forwarding", /expectedUpdatedAt:\s*expectedVersion/),
    ],
  },
  {
    id: "decision_patch_expected_version",
    file: "src/app/api/decisions/[id]/route.ts",
    objective: "Decision workspace edits must require an expected version and claim the current updated_at.",
    markers: routeUpdatedAtMarkers("decision"),
  },
  {
    id: "packet_template_patch_expected_version",
    file: "src/app/api/decisions/packet-templates/[id]/route.ts",
    objective: "Decision packet-template edits must require an expected version and claim the current updated_at.",
    markers: routeUpdatedAtMarkers("packet_template"),
  },
  {
    id: "review_board_patch_expected_version",
    file: "src/app/api/review-boards/[id]/route.ts",
    objective: "Review-board edits must require an expected version and map stale writes to 409.",
    markers: routeMarkers("review_board"),
  },
  {
    id: "review_board_helper_expected_updated_at",
    file: "src/lib/v6/review-boards.ts",
    objective: "Review-board helper must pass expected versions into the shared update predicate.",
    markers: [
      marker("expected version helper parameter", /expectedVersion\?:\s*string\s*\|\s*number\s*\|\s*null/),
      marker("expected updated_at forwarding", /expectedUpdatedAt:\s*expectedVersion/),
    ],
  },
  {
    id: "workspace_v6_settings_patch_expected_version",
    file: "src/app/api/workspace/v6-settings/route.ts",
    objective: "Workspace settings edits must expose a settings version and require it on PATCH.",
    markers: [
      marker("snapshot version response", /settingsVersion:\s*snapshot\.updatedAt/),
      ...routeMarkers("workspace_v6_settings"),
      marker("merge expected version", /expectedVersion:\s*expectedVersionResult\.expectedVersion/),
    ],
  },
  {
    id: "workspace_v6_settings_helper_expected_updated_at",
    file: "src/lib/v6/org-settings.ts",
    objective: "Workspace settings merge must guard organization JSON writes with updated_at.",
    markers: [
      marker("settings snapshot includes updated_at", /select\(\s*["']v6_org_settings_json,\s*updated_at["']\s*\)/),
      marker("expected version option", /options\?:\s*\{\s*expectedVersion\?:\s*string\s*\|\s*number\s*\|\s*null\s*\}/),
      marker("updated_at predicate", /\.eq\(\s*["']updated_at["']\s*,\s*String\(expectedVersion\)\s*\)/),
      marker("stale version result", /message:\s*["']stale_version["']/),
    ],
  },
];

function marker(name, pattern) {
  return { name, pattern };
}

function routeMarkers(diagnosticPrefix) {
  return [
    marker("expected version guard", /requireExpectedVersionForMutation/),
    marker("route diagnostic prefix", new RegExp(`diagnosticPrefix:\\s*["']${diagnosticPrefix}["']`)),
    marker("stale version response", /staleExpectedVersionResponse/),
    marker("expected version forwarding", /expectedVersionResult\.expectedVersion/),
  ];
}

function routeUpdatedAtMarkers(diagnosticPrefix) {
  return [
    ...routeMarkers(diagnosticPrefix),
    marker("updated_at predicate", /\.eq\(\s*["']updated_at["']\s*,\s*expectedVersionResult\.expectedVersion\s*\)/),
  ];
}

function readSource(root, file) {
  const abs = path.join(root, file);
  if (!fs.existsSync(abs)) return { source: "", missing: true };
  return { source: fs.readFileSync(abs, "utf8"), missing: false };
}

export function analyzeStaleWriteGuards(root = ROOT) {
  const issues = [];
  let checkedMarkerCount = 0;

  for (const target of TARGETS) {
    const { source, missing } = readSource(root, target.file);
    if (missing) {
      issues.push({
        issue: "stale_write_guard_file_missing",
        id: target.id,
        file: target.file,
        objective: target.objective,
      });
      continue;
    }

    for (const markerSpec of target.markers) {
      checkedMarkerCount += 1;
      if (!markerSpec.pattern.test(source)) {
        issues.push({
          issue: "stale_write_guard_marker_missing",
          id: target.id,
          file: target.file,
          objective: target.objective,
          marker: markerSpec.name,
          pattern: String(markerSpec.pattern),
        });
      }
    }
  }

  return {
    checkId: "stale-write-guards",
    ok: issues.length === 0,
    targetCount: TARGETS.length,
    checkedMarkerCount,
    issueCount: issues.length,
    issues,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = analyzeStaleWriteGuards();
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}
