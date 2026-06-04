#!/usr/bin/env node
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

function printUsage() {
  console.error("Usage: node scripts/run-with-env.mjs KEY=value [KEY=value ...] -- command [args...]");
}

const separatorIndex = process.argv.indexOf("--", 2);
if (separatorIndex === -1) {
  printUsage();
  process.exit(2);
}

const assignments = process.argv.slice(2, separatorIndex);
const commandParts = process.argv.slice(separatorIndex + 1);

if (assignments.length === 0 || commandParts.length === 0) {
  printUsage();
  process.exit(2);
}

const env = { ...process.env };
for (const assignment of assignments) {
  const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/u.exec(assignment);
  if (!match) {
    console.error(`Invalid environment assignment: ${assignment}`);
    printUsage();
    process.exit(2);
  }
  env[match[1]] = match[2];
}

function pathEntries(env) {
  const localBin = path.join(process.cwd(), "node_modules", ".bin");
  const entries = String(env.PATH ?? env.Path ?? env.path ?? "")
    .split(path.delimiter)
    .filter(Boolean);
  return fs.existsSync(localBin) ? [localBin, ...entries] : entries;
}

function pathExtEntries(env) {
  return String(env.PATHEXT ?? ".COM;.EXE;.BAT;.CMD")
    .split(";")
    .filter(Boolean);
}

function resolveWindowsCommand(command, env) {
  if (process.platform !== "win32") return command;
  if (/[\\/]/u.test(command)) return command;

  const extensions = path.extname(command) ? [""] : pathExtEntries(env);
  for (const dir of pathEntries(env)) {
    for (const extension of extensions) {
      const candidate = path.join(dir, `${command}${extension}`);
      if (fs.existsSync(candidate)) return candidate;
    }
  }
  return command;
}

function quoteForCmd(value) {
  if (value === "") return '""';
  if (!/[ \t&()<>^|"]/u.test(value)) return value;
  return `"${value.replace(/"/gu, '""')}"`;
}

function spawnCrossPlatform(command, args, env) {
  if (process.platform === "win32" && /\.(?:bat|cmd)$/iu.test(command)) {
    const comspec = env.ComSpec ?? env.COMSPEC ?? "cmd.exe";
    return spawn(comspec, ["/d", "/s", "/c", [quoteForCmd(command), ...args.map(quoteForCmd)].join(" ")], {
      env,
      stdio: "inherit",
    });
  }
  return spawn(command, args, {
    env,
    stdio: "inherit",
  });
}

const [rawCommand, ...args] = commandParts;
const command = resolveWindowsCommand(rawCommand, env);
const child = spawnCrossPlatform(command, args, env);

child.on("error", (error) => {
  console.error(error.message);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
