#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const nextConfigPath = path.join(root, "next.config.ts");
const strict = process.argv.includes("--strict");
const maxClientKb = Number(process.env.BUNDLE_BUDGET_CLIENT_KB ?? "900");
const maxFirstLoadKb = Number(process.env.BUNDLE_BUDGET_FIRST_LOAD_KB ?? "350");

function result(ok, errors = [], warnings = [], meta = {}) {
  const payload = {
    checkId: "bundle-budget",
    ok,
    strict,
    errors,
    warnings,
    meta,
    generatedAt: new Date().toISOString(),
  };
  console.log(JSON.stringify(payload, null, 2));
  process.exit(ok ? 0 : 1);
}

if (!fs.existsSync(nextConfigPath)) {
  result(!strict, strict ? ["next.config.ts not found"] : [], ["next.config.ts not found; skipped"]);
}

const configSource = fs.readFileSync(nextConfigPath, "utf8");
const warnings = [];
const errors = [];

if (!/optimizePackageImports\s*:\s*\[/.test(configSource)) {
  const msg = "next.config.ts missing experimental.optimizePackageImports list";
  if (strict) errors.push(msg);
  else warnings.push(msg);
}

if (!/serverExternalPackages\s*:\s*\[/.test(configSource)) {
  warnings.push("next.config.ts missing serverExternalPackages list");
}

// Optional analyzer artifact checks (available when analyze ran previously).
const analyzeJsonCandidates = [
  path.join(root, ".next", "analyze", "client.json"),
  path.join(root, ".next", "analyze", "stats-client.json"),
];

const analyzeJsonPath = analyzeJsonCandidates.find((p) => fs.existsSync(p));
if (analyzeJsonPath) {
  try {
    const stats = JSON.parse(fs.readFileSync(analyzeJsonPath, "utf8"));
    const assets = Array.isArray(stats?.assets) ? stats.assets : [];
    const jsAssets = assets.filter((asset) => typeof asset?.name === "string" && asset.name.endsWith(".js"));
    const totalClientKb =
      jsAssets.reduce((sum, asset) => sum + (Number(asset?.size ?? 0) || 0), 0) / 1024;
    if (totalClientKb > maxClientKb) {
      errors.push(
        `Client JS assets ${totalClientKb.toFixed(1)}KB exceed budget ${maxClientKb.toFixed(1)}KB`
      );
    }

    // Heuristic: check largest initial JS asset if chunk metadata exists.
    const initialAssets = jsAssets.filter((asset) =>
      Array.isArray(asset?.chunks) ? asset.chunks.length > 0 : true
    );
    const largestInitialKb =
      initialAssets.length > 0
        ? Math.max(...initialAssets.map((asset) => (Number(asset?.size ?? 0) || 0) / 1024))
        : 0;
    if (largestInitialKb > maxFirstLoadKb) {
      errors.push(
        `Largest JS asset ${largestInitialKb.toFixed(1)}KB exceeds first-load budget ${maxFirstLoadKb.toFixed(
          1
        )}KB`
      );
    }
  } catch (error) {
    warnings.push(
      `Failed to parse analyzer stats at ${path.relative(root, analyzeJsonPath)}: ${
        error instanceof Error ? error.message : "unknown error"
      }`
    );
  }
} else {
  warnings.push(
    "No analyzer stats found under .next/analyze; run `npm run analyze` for artifact-based budget checks"
  );
}

result(errors.length === 0, errors, warnings, {
  maxClientKb,
  maxFirstLoadKb,
  analyzerStatsFound: Boolean(analyzeJsonPath),
});
