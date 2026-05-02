#!/usr/bin/env node
/**
 * Alias for check-env-matrix.mjs — separate npm script for QA manifests / fleet parity.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const target = path.join(root, "scripts", "check-env-matrix.mjs");
const r = spawnSync(process.execPath, [target], { stdio: "inherit", cwd: root });
process.exit(r.status ?? 1);
