import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";

import { runCommand } from "./process.mjs";

function fakeChild(closeCode = 0) {
  const child = new EventEmitter();
  child.kill = () => {};
  queueMicrotask(() => child.emit("close", closeCode));
  return child;
}

test("runCommand routes npm through cmd.exe on Windows without shell mode", async () => {
  const calls = [];
  const result = await runCommand("npm", ["run", "check:plan-ia"], {
    platform: "win32",
    cwd: "/repo",
    runner: (cmd, args, options) => {
      calls.push({ cmd, args, cwd: options.cwd, shell: options.shell });
      return fakeChild(0);
    },
  });

  assert.deepEqual(calls, [
    {
      cmd: "cmd.exe",
      args: ["/d", "/s", "/c", "npm", "run", "check:plan-ia"],
      cwd: "/repo",
      shell: false,
    },
  ]);
  assert.deepEqual(result, { ok: true, code: 0, timedOut: false });
});
