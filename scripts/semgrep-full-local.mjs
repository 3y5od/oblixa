#!/usr/bin/env node
/**
 * Local parity with .github/workflows/semgrep-sarif.yml configs (no SARIF upload).
 * Set SEMGREP_FULL=1 in CI; skips when semgrep is not on PATH.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const enabled = process.env.SEMGREP_FULL === "1" || process.env.SEMGREP_FULL === "true";
if (!enabled) {
  console.log(JSON.stringify({ ok: true, mode: "skipped_set_SEMGREP_FULL" }, null, 2));
  process.exit(0);
}

const which = spawnSync("which", ["semgrep"], { encoding: "utf8" });
if (which.status !== 0) {
  console.error(JSON.stringify({ ok: false, error: "semgrep_not_on_path" }, null, 2));
  process.exit(1);
}

const root = process.cwd();
const configs = [
  "p/ci",
  "p/typescript",
  "semgrep/oblixa-security.yml",
  "semgrep/oblixa-performance.yml",
  "semgrep/oblixa-surface.yml",
].filter((c) => c.startsWith("p/") || fs.existsSync(path.join(root, c)));

const args = ["scan", ...configs.flatMap((c) => ["--config", c]), "--error", "."];
const r = spawnSync("semgrep", args, { stdio: "inherit", cwd: root });
process.exit(r.status ?? 1);
