#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import process from "node:process";
import { pathToFileURL } from "node:url";

export function npmRunCommandForPlatform(script, platform = process.platform) {
  if (platform === "win32") {
    return { cmd: "cmd.exe", args: ["/d", "/s", "/c", `npm run ${script}`] };
  }
  return { cmd: "npm", args: ["run", script] };
}

export function runTypeLintCommand(name, cmd, args, options = {}) {
  const start = Date.now();
  const runner = options.runner ?? spawnSync;
  const res = runner(cmd, args, { stdio: "pipe", encoding: "utf8", env: options.env ?? process.env });
  return {
    name,
    status: res.status ?? 1,
    elapsedMs: Date.now() - start,
    stderr: (res.stderr || res.error?.message || "").slice(0, 300),
  };
}

export function buildTypeLintStrictnessReport(options = {}) {
  const lintCommand = options.lintCommand ?? npmRunCommandForPlatform("lint", options.platform);
  const typecheckCommand = options.typecheckCommand ?? npmRunCommandForPlatform("typecheck", options.platform);
  return {
    lint: runTypeLintCommand("lint", lintCommand.cmd, lintCommand.args, options),
    typecheck: runTypeLintCommand("typecheck", typecheckCommand.cmd, typecheckCommand.args, options),
  };
}

export function runTypeLintStrictnessCli() {
  console.log(JSON.stringify(buildTypeLintStrictnessReport(), null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runTypeLintStrictnessCli();
}
