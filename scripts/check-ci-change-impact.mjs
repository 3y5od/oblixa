#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { RISK_AREAS } from "./lib/ci-change-impact-risk-areas.mjs";
export { RISK_AREAS } from "./lib/ci-change-impact-risk-areas.mjs";

const DEFAULT_BASE_REF = process.env.CI_CHANGE_IMPACT_BASE_REF?.trim() || "HEAD~1";

function uniqueSorted(values) {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}

function normalizePath(value) {
  return String(value ?? "").trim().replace(/\\/gu, "/");
}

export function parseGitNameStatus(text) {
  return String(text ?? "")
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [rawStatus, firstPath, secondPath] = line.split(/\t/u);
      const status = rawStatus.replace(/\d+$/u, "");
      if ((status === "R" || status === "C") && secondPath) {
        return {
          status,
          path: normalizePath(secondPath),
          oldPath: normalizePath(firstPath),
        };
      }
      return {
        status: status || "M",
        path: normalizePath(firstPath ?? rawStatus),
        oldPath: null,
      };
    })
    .filter((entry) => entry.path);
}

export function classifyPath(file) {
  const areas = RISK_AREAS.filter((area) => area.matches(file)).map((area) => area.id);
  return areas.length > 0 ? areas : ["unclassified"];
}

export function classifyChangedEntries(entries) {
  const normalized = entries.map((entry) => {
    const pathAreas = classifyPath(entry.path);
    const oldPathAreas = entry.oldPath ? classifyPath(entry.oldPath) : [];
    const riskAreas = uniqueSorted([...pathAreas, ...oldPathAreas]);
    const checks = uniqueSorted(
      RISK_AREAS.filter((area) => riskAreas.includes(area.id)).flatMap((area) => area.checks),
    );
    const documentationOnly = riskAreas.length === 1 && riskAreas[0] === "documentation";
    return {
      status: entry.status ?? "M",
      path: normalizePath(entry.path),
      oldPath: entry.oldPath ? normalizePath(entry.oldPath) : null,
      riskAreas,
      requiredChecks: checks,
      documentationOnly,
      productionRelevant: !documentationOnly,
    };
  });

  const requiredChecks = uniqueSorted(normalized.flatMap((entry) => entry.requiredChecks));
  const riskAreaIds = uniqueSorted(normalized.flatMap((entry) => entry.riskAreas));
  const riskAreas = riskAreaIds.map((area) => ({
    area,
    changedCount: normalized.filter((entry) => entry.riskAreas.includes(area)).length,
    paths: uniqueSorted(normalized.filter((entry) => entry.riskAreas.includes(area)).map((entry) => entry.path)),
    requiredChecks: uniqueSorted(
      RISK_AREAS.filter((definition) => definition.id === area).flatMap((definition) => definition.checks),
    ),
  }));

  const documentationOnly = normalized.length > 0 && normalized.every((entry) => entry.documentationOnly);
  const productionRelevant = normalized.some((entry) => entry.productionRelevant);
  return {
    changedCount: normalized.length,
    changed: normalized.sort((a, b) => a.path.localeCompare(b.path)),
    riskAreas,
    requiredChecks,
    documentationOnly,
    productionRelevant,
    supabaseAffecting: riskAreaIds.some((area) => ["migrations", "rls_sql_functions", "environment_contracts"].includes(area)),
  };
}

export function buildPrSummary(changeImpact) {
  const checks = changeImpact.requiredChecks ?? [];
  const areas = (changeImpact.riskAreas ?? []).map((row) => row.area);
  const warnings = [];
  if ((changeImpact.changedCount ?? 0) === 0) warnings.push("No changed files were detected; confirm the base ref or attach explicit evidence.");
  if (areas.includes("unclassified")) warnings.push("At least one changed file is unclassified; add a change-impact rule or record reviewer-owned evidence.");
  for (const entry of changeImpact.changed ?? []) {
    if ((entry.requiredChecks ?? []).length === 0) {
      warnings.push(`${entry.path} has no targeted validation command; record why existing evidence is sufficient.`);
    }
  }

  const lines = [
    `Changed files: ${changeImpact.changedCount ?? 0}`,
    `Risk areas: ${areas.length ? areas.join(", ") : "none"}`,
    `Recommended validation: ${checks.length ? checks.map((check) => `npm run ${check}`).join("; ") : "none"}`,
  ];
  if (warnings.length > 0) lines.push(`Missing evidence warnings: ${warnings.join(" | ")}`);
  return {
    markdown: lines.map((line) => `- ${line}`).join("\n"),
    missingEvidenceWarnings: warnings,
  };
}

function runGit(args) {
  const result = spawnSync("git", args, {
    stdio: ["ignore", "pipe", "pipe"],
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  });
  if ((result.status ?? 1) !== 0) {
    throw new Error([`git ${args.join(" ")} failed`, result.stderr, result.stdout].filter(Boolean).join("\n"));
  }
  return result.stdout;
}

export function collectGitChangedEntries({ baseRef = DEFAULT_BASE_REF } = {}) {
  try {
    return parseGitNameStatus(runGit(["diff", "--name-status", "--find-renames", `${baseRef}...HEAD`]));
  } catch {
    const unstaged = parseGitNameStatus(runGit(["diff", "--name-status", "--find-renames"]));
    const staged = parseGitNameStatus(runGit(["diff", "--cached", "--name-status", "--find-renames"]));
    return [...unstaged, ...staged];
  }
}

export function analyzeChangeImpact({
  entries,
  baseRef = DEFAULT_BASE_REF,
  strict = false,
  maxChangedEntries = 200,
  maxPathsPerArea = 50,
} = {}) {
  const classified = classifyChangedEntries(entries ?? collectGitChangedEntries({ baseRef }));
  const changed = classified.changed.slice(0, maxChangedEntries);
  const riskAreas = classified.riskAreas.map((area) => ({
    ...area,
    paths: area.paths.slice(0, maxPathsPerArea),
    omittedPathCount: Math.max(0, area.paths.length - maxPathsPerArea),
  }));
  const issues = [];
  if (strict && classified.changedCount === 0) {
    issues.push({ issue: "no_changed_files_detected", baseRef });
  }

  const report = {
    ok: issues.length === 0,
    strict,
    baseRef,
    summary:
      classified.changedCount === 0
        ? "No changed files detected."
        : classified.documentationOnly
          ? `${classified.changedCount} documentation-only file change(s).`
          : `${classified.changedCount} changed file(s) across ${classified.riskAreas.length} risk area(s).`,
    ...classified,
    changed,
    riskAreas,
    omittedChangedCount: Math.max(0, classified.changed.length - maxChangedEntries),
    issueCount: issues.length,
    issues,
  };
  return {
    ...report,
    prSummary: buildPrSummary(report),
  };
}

function parseArgs(argv) {
  const options = { strict: false, baseRef: DEFAULT_BASE_REF, maxChangedEntries: 200, maxPathsPerArea: 50 };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--strict") {
      options.strict = true;
    } else if (arg === "--base-ref") {
      options.baseRef = argv[index + 1] ?? DEFAULT_BASE_REF;
      index += 1;
    } else if (arg.startsWith("--base-ref=")) {
      options.baseRef = arg.slice("--base-ref=".length);
    } else if (arg === "--max-changed") {
      options.maxChangedEntries = Number(argv[index + 1] ?? 200);
      index += 1;
    } else if (arg.startsWith("--max-changed=")) {
      options.maxChangedEntries = Number(arg.slice("--max-changed=".length));
    } else if (arg === "--max-paths-per-area") {
      options.maxPathsPerArea = Number(argv[index + 1] ?? 50);
      index += 1;
    } else if (arg.startsWith("--max-paths-per-area=")) {
      options.maxPathsPerArea = Number(arg.slice("--max-paths-per-area=".length));
    }
  }
  return options;
}

export function runChangeImpactCheck(options = parseArgs(process.argv.slice(2))) {
  const report = analyzeChangeImpact(options);
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exitCode = 1;
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runChangeImpactCheck();
}
