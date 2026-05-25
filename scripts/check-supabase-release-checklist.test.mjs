import assert from "node:assert/strict";
import test from "node:test";

import {
  LOCAL_READ_ONLY_COMMANDS,
  OPTIONAL_LINKED_READ_ONLY_COMMANDS,
  analyzeSupabaseReleaseChecklist,
  buildSupabaseReleaseChecklist,
} from "./check-supabase-release-checklist.mjs";

function packageScriptsFor(commands) {
  return Object.fromEntries(
    commands
      .map((command) => /^npm run ([^ ]+)/u.exec(command)?.[1])
      .filter(Boolean)
      .map((script) => [script, `node scripts/${script}.mjs`]),
  );
}

test("buildSupabaseReleaseChecklist separates local, explicit, linked, and smoke commands", () => {
  const checklist = buildSupabaseReleaseChecklist();
  assert.equal(checklist.commandGroups.localReadOnly.every((entry) => entry.mutates === false), true);
  assert.equal(checklist.commandGroups.localExplicitExecution[0].mutates, true);
  assert.equal(checklist.commandGroups.optionalLinkedReadOnly.every((entry) => entry.credentialRequirement === "production"), true);
  assert.ok(checklist.commandGroups.smoke.some((entry) => entry.service === "Storage"));
});

test("analyzeSupabaseReleaseChecklist validates package scripts without executing commands", () => {
  const commands = [
    ...LOCAL_READ_ONLY_COMMANDS,
    ...OPTIONAL_LINKED_READ_ONLY_COMMANDS,
    "npm run test:supabase:local-reset",
    "npm run report:supabase:fingerprint-drift",
    "npm run report:migration-rollbacks",
    "npm run report:supabase:release-checklist",
    "npm run report:production-evidence-summary",
    "npm run report:hardening-pr-summary",
  ];
  const report = analyzeSupabaseReleaseChecklist({ packageScripts: packageScriptsFor(commands) });
  assert.equal(report.ok, true);
  assert.equal(report.issueCount, 0);
});

test("analyzeSupabaseReleaseChecklist rejects missing scripts and secret-shaped commands", () => {
  const report = analyzeSupabaseReleaseChecklist({
    packageScripts: {},
    localReadOnlyCommands: ["npm run check:supabase:ops", "SUPABASE_DB_PASSWORD=secret npm run check:supabase:prod"],
    localExplicitExecutionCommands: [],
    localReportCommands: [],
    optionalLinkedReadOnlyCommands: [],
    smokeCommands: [],
  });
  assert.equal(report.ok, false);
  assert.ok(report.issues.some((issue) => issue.issue === "release_checklist_missing_package_script"));
  assert.ok(report.issues.some((issue) => issue.issue === "release_checklist_unknown_command_shape"));
  assert.ok(report.issues.some((issue) => issue.issue === "release_checklist_secret_shaped_command"));
});
