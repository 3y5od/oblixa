#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";

const result = spawnSync(
  process.execPath,
  [path.join(process.cwd(), "scripts", "check-operational-feature-flags-rollout.mjs")],
  {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: "inherit",
  }
);

process.exit(result.status ?? 1);
