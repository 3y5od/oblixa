#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { parse as parseYaml } from "yaml";

const root = process.cwd();
const strict = process.argv.includes("--strict");
export const ACTIVE_RULEPACKS = [
  "semgrep/oblixa-security.yml",
  "semgrep/oblixa-performance.yml",
  "semgrep/oblixa-surface.yml",
];
export const LEGACY_RULEPACKS = [
  "semgrep/oblixa-v7-surface.yml",
  "semgrep/oblixa-v8-surface.yml",
  "semgrep/oblixa-v10-surface.yml",
];

function ruleIdsFor(text) {
  const parsed = parseYaml(text);
  return (parsed?.rules ?? []).map((rule) => String(rule?.id ?? "")).filter(Boolean);
}

export function analyzeSemgrepRulepackIntegrity(options = {}) {
  const repoRoot = options.root ?? root;
  const strictMode = options.strict ?? strict;
  const activeRulepacks = options.activeRulepacks ?? ACTIVE_RULEPACKS;
  const legacyRulepacks = options.legacyRulepacks ?? LEGACY_RULEPACKS;
  const ci = fs.readFileSync(path.join(repoRoot, ".github", "workflows", "ci.yml"), "utf8");
  const sarifWorkflow = fs.existsSync(path.join(repoRoot, ".github", "workflows", "semgrep-sarif.yml"))
    ? fs.readFileSync(path.join(repoRoot, ".github", "workflows", "semgrep-sarif.yml"), "utf8")
    : "";
  const missing = activeRulepacks.filter((rel) => !fs.existsSync(path.join(repoRoot, rel)));
  const missingLegacyRulepacks = legacyRulepacks.filter((rel) => !fs.existsSync(path.join(repoRoot, rel)));
  const missingCiReferences = activeRulepacks.filter((rel) => !ci.includes(rel));
  const missingSarifReferences = activeRulepacks.filter((rel) => !sarifWorkflow.includes(rel));
  const legacyStillActive = legacyRulepacks.filter((rel) => ci.includes(rel) || sarifWorkflow.includes(rel));
  const parseIssues = [];
  const versionedActiveRuleIds = [];
  for (const rel of [...activeRulepacks, ...legacyRulepacks]) {
    const abs = path.join(repoRoot, rel);
    if (!fs.existsSync(abs)) continue;
    const text = fs.readFileSync(abs, "utf8");
    try {
      const ids = ruleIdsFor(text);
      if (activeRulepacks.includes(rel)) {
        versionedActiveRuleIds.push(...ids.filter((id) => /\bv[0-9]+\b|v[0-9]+-/iu.test(id)).map((id) => ({ rel, id })));
      }
    } catch (err) {
      parseIssues.push({ rel, message: err instanceof Error ? err.message : String(err) });
    }
  }

  return {
    checkId: "semgrep-rulepack-integrity",
    strict: strictMode,
    ok:
      !strictMode ||
      (missing.length === 0 &&
        missingLegacyRulepacks.length === 0 &&
        missingCiReferences.length === 0 &&
        missingSarifReferences.length === 0 &&
        legacyStillActive.length === 0 &&
        versionedActiveRuleIds.length === 0 &&
        parseIssues.length === 0),
    activeRulepacks,
    legacyRulepacks,
    missingRulepacks: missing,
    missingLegacyRulepacks,
    missingCiReferences,
    missingSarifReferences,
    legacyStillActive,
    versionedActiveRuleIds,
    parseIssues,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const payload = analyzeSemgrepRulepackIntegrity({ root, strict });
  console.log(JSON.stringify(payload, null, 2));
  process.exit(payload.ok ? 0 : 1);
}
