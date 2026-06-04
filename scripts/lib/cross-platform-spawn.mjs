import { spawnSync } from "node:child_process";
import process from "node:process";

export function commandForPlatform(command, args = [], platform = process.platform) {
  if (platform === "win32" && (command === "npm" || command === "npx")) {
    return {
      cmd: "cmd.exe",
      args: ["/d", "/s", "/c", command, ...args],
    };
  }
  return { cmd: command, args };
}

export function spawnSyncCrossPlatform(command, args = [], options = {}) {
  const resolved = commandForPlatform(command, args, options.platform);
  return (options.runner ?? spawnSync)(resolved.cmd, resolved.args, {
    ...options,
    platform: undefined,
    runner: undefined,
  });
}
