#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

import { analyzeHardeningDebtRatchet } from "./check-hardening-debt-ratchet.mjs";
import { runVersionedNamingCheck } from "./check-versioned-naming.mjs";

const DEFAULT_ROOT = process.cwd();

const BASELINES = [
  { id: "e2eSkipBaseline", rel: "scripts/e2e-skip-baseline.json" },
  { id: "hardeningDebtBaseline", rel: "scripts/hardening-debt-baseline.json" },
  { id: "frontendComponentComplexityBaseline", rel: "scripts/frontend-component-complexity-baseline.json" },
  { id: "wrapperReintroductionBaseline", rel: "scripts/wrapper-reintroduction-baseline.json" },
  { id: "versionedNamingBaseline", rel: "scripts/versioned-naming-baseline.json" },
];

function loadJson(root, rel) {
  return JSON.parse(fs.readFileSync(path.join(root, rel), "utf8"));
}

function summarizeBaseline(root, { id, rel }) {
  const abs = path.join(root, rel);
  const exists = fs.existsSync(abs);
  if (!exists) return { id, path: rel, exists: false, keyCount: 0 };
  try {
    const data = loadJson(root, rel);
    return {
      id,
      path: rel,
      exists: true,
      keyCount: data && typeof data === "object" && !Array.isArray(data) ? Object.keys(data).length : 0,
      baselineDate: typeof data?.baselineDate === "string" ? data.baselineDate : null,
    };
  } catch {
    return { id, path: rel, exists: true, parseError: true, keyCount: 0 };
  }
}

function hardeningDebtCandidates(root) {
  try {
    const baseline = loadJson(root, "scripts/hardening-debt-baseline.json");
    const current = JSON.parse(
      execFileSync("node", [path.join(root, "scripts", "report-hardening-debt.mjs")], {
        cwd: root,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }),
    );
    const report = analyzeHardeningDebtRatchet({ baseline, current, strict: false });
    return report.ratchetCandidates.map((candidate) => ({
      ratchet: "hardening-debt",
      key: candidate.key,
      baseline: candidate.baseline,
      current: candidate.current,
      delta: candidate.delta,
    }));
  } catch {
    return [];
  }
}

function versionedNamingCandidates(root) {
  try {
    const report = runVersionedNamingCheck({ root, report: true });
    return (report.reductions ?? []).map((candidate) => ({
      ratchet: "versioned-naming",
      path: candidate.path,
      baseline: candidate.baseline,
      current: candidate.current,
      delta: candidate.current - candidate.baseline,
    }));
  } catch {
    return [];
  }
}

export function buildRatchetSnapshot(options = {}) {
  const root = options.root ?? DEFAULT_ROOT;
  const baselines = (options.baselines ?? BASELINES).map((baseline) => summarizeBaseline(root, baseline));
  const ratchetCandidates =
    options.ratchetCandidates ??
    [
      ...hardeningDebtCandidates(root),
      ...versionedNamingCandidates(root),
    ].sort((a, b) => String(a.ratchet).localeCompare(String(b.ratchet)) || String(a.path ?? a.key).localeCompare(String(b.path ?? b.key)));

  return {
    schemaVersion: 1,
    report: "ratchet-snapshot",
    ok: true,
    baselineCount: baselines.length,
    baselines,
    ratchetCandidateCount: ratchetCandidates.length,
    ratchetCandidates,
  };
}

function parseArgs(argv) {
  const options = { root: DEFAULT_ROOT };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--root") {
      options.root = path.resolve(argv[index + 1] ?? "");
      index += 1;
    } else if (arg.startsWith("--root=")) {
      options.root = path.resolve(arg.slice("--root=".length));
    }
  }
  return options;
}

export function runRatchetSnapshot(options = parseArgs(process.argv.slice(2))) {
  const report = buildRatchetSnapshot(options);
  console.log(JSON.stringify(report, null, 2));
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runRatchetSnapshot();
}
