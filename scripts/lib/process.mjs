#!/usr/bin/env node

import { spawn } from "node:child_process";
import { commandForPlatform } from "./cross-platform-spawn.mjs";

export function runCommand(command, args = [], options = {}) {
  const {
    cwd = process.cwd(),
    env = process.env,
    stdio = "inherit",
    timeoutMs = 0,
    shell = false,
    platform = process.platform,
    runner = spawn,
  } = options;
  const resolved = shell ? { cmd: command, args } : commandForPlatform(command, args, platform);

  return new Promise((resolve) => {
    const child = runner(resolved.cmd, resolved.args, { cwd, env, stdio, shell });
    let timedOut = false;
    let timer = null;

    if (timeoutMs > 0) {
      timer = setTimeout(() => {
        timedOut = true;
        child.kill("SIGTERM");
      }, timeoutMs);
    }

    child.on("close", (code) => {
      if (timer) clearTimeout(timer);
      resolve({
        ok: !timedOut && code === 0,
        code: timedOut ? 124 : code ?? 1,
        timedOut,
      });
    });
  });
}

export async function runNpmScript(scriptName, options = {}) {
  return runCommand("npm", ["run", scriptName], options);
}

export async function runNodeScript(scriptPath, args = [], options = {}) {
  return runCommand("node", [scriptPath, ...args], options);
}
