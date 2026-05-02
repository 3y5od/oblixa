#!/usr/bin/env node
/**
 * Writes artifacts/baseline/baseline-manifest.json with current timestamp (run after green sweep).
 */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const dir = path.join(root, "artifacts", "baseline");
fs.mkdirSync(dir, { recursive: true });
const manifest = {
  version: 1,
  capturedAt: new Date().toISOString(),
  branch: process.env.GITHUB_HEAD_REF || process.env.GITHUB_REF_NAME || "local",
  note: "Captured by qa-baseline-capture.mjs",
  commands: {},
};
fs.writeFileSync(path.join(dir, "baseline-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify({ ok: true, wrote: "artifacts/baseline/baseline-manifest.json" }, null, 2));
