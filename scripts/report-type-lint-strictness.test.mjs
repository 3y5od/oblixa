import assert from "node:assert/strict";
import test from "node:test";

import {
  buildTypeLintStrictnessReport,
  npmRunCommandForPlatform,
} from "./report-type-lint-strictness.mjs";

test("npmRunCommandForPlatform resolves Windows npm through cmd.exe", () => {
  assert.deepEqual(npmRunCommandForPlatform("lint", "win32"), {
    cmd: "cmd.exe",
    args: ["/d", "/s", "/c", "npm run lint"],
  });
  assert.deepEqual(npmRunCommandForPlatform("lint", "linux"), {
    cmd: "npm",
    args: ["run", "lint"],
  });
});

test("buildTypeLintStrictnessReport runs lint and typecheck through the resolved npm command", () => {
  const calls = [];
  const report = buildTypeLintStrictnessReport({
    platform: "win32",
    runner: (cmd, args) => {
      calls.push({ cmd, args });
      return { status: 0, stderr: "" };
    },
  });

  assert.deepEqual(calls, [
    { cmd: "cmd.exe", args: ["/d", "/s", "/c", "npm run lint"] },
    { cmd: "cmd.exe", args: ["/d", "/s", "/c", "npm run typecheck"] },
  ]);
  assert.equal(report.lint.status, 0);
  assert.equal(report.typecheck.status, 0);
});
