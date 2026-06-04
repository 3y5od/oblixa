import assert from "node:assert/strict";
import test from "node:test";

import { commandForPlatform, spawnSyncCrossPlatform } from "./cross-platform-spawn.mjs";

test("commandForPlatform routes npm and npx through cmd.exe on Windows", () => {
  assert.deepEqual(commandForPlatform("npx", ["vitest", "run", "src/lib/example test.ts"], "win32"), {
    cmd: "cmd.exe",
    args: ["/d", "/s", "/c", "npx", "vitest", "run", "src/lib/example test.ts"],
  });
  assert.deepEqual(commandForPlatform("npm", ["run", "lint"], "linux"), {
    cmd: "npm",
    args: ["run", "lint"],
  });
});

test("spawnSyncCrossPlatform invokes the resolved command", () => {
  const calls = [];
  const result = spawnSyncCrossPlatform("npm", ["run", "typecheck"], {
    platform: "win32",
    cwd: "/repo",
    runner: (cmd, args, options) => {
      calls.push({ cmd, args, cwd: options.cwd });
      return { status: 0 };
    },
  });

  assert.deepEqual(calls, [
    {
      cmd: "cmd.exe",
      args: ["/d", "/s", "/c", "npm", "run", "typecheck"],
      cwd: "/repo",
    },
  ]);
  assert.equal(result.status, 0);
});
