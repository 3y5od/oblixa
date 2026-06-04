import assert from "node:assert/strict";
import test from "node:test";

import {
  productSurfaceVocabularyCommand,
  runProductSurfaceVocabularyCheck,
  vitestFiles,
} from "./check-product-surface-vocabulary.mjs";

test("productSurfaceVocabularyCommand resolves npx through cmd.exe on Windows", () => {
  assert.deepEqual(productSurfaceVocabularyCommand("win32"), {
    cmd: "cmd.exe",
    args: ["/d", "/s", "/c", `npx vitest run ${vitestFiles.join(" ")}`],
  });
  assert.deepEqual(productSurfaceVocabularyCommand("linux"), {
    cmd: "npx",
    args: ["vitest", "run", ...vitestFiles],
  });
});

test("runProductSurfaceVocabularyCheck uses the resolved command", () => {
  const calls = [];
  const result = runProductSurfaceVocabularyCheck({
    platform: "win32",
    cwd: "/repo",
    stdio: "pipe",
    env: {},
    runner: (cmd, args, options) => {
      calls.push({ cmd, args, cwd: options.cwd, stdio: options.stdio });
      return { status: 0 };
    },
  });

  assert.deepEqual(calls, [
    {
      cmd: "cmd.exe",
      args: ["/d", "/s", "/c", `npx vitest run ${vitestFiles.join(" ")}`],
      cwd: "/repo",
      stdio: "pipe",
    },
  ]);
  assert.equal(result.status, 0);
});
