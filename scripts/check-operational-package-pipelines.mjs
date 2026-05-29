#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

import {
  analyzeGeneratedArtifactHygiene,
  DETERMINISTIC_GENERATED_ARTIFACT_PATHS,
  GENERATED_ARTIFACT_HYGIENE_PATHS,
  GENERATED_ARTIFACT_WRITE_COMMANDS,
} from "./check-generated-artifact-hygiene.mjs";
import { analyzeStaticCheckDeterminism } from "./check-static-check-determinism.mjs";

const ROOT = process.cwd();
const CONFIG_REL = "config/operational-package-pipelines.json";
const ARTIFACT_REL = "artifacts/operational-package-pipelines.json";
const WRITE = process.argv.includes("--write");

function stableStringify(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function read(root, rel) {
  return fs.existsSync(path.join(root, rel)) ? fs.readFileSync(path.join(root, rel), "utf8") : "";
}

function readJson(root, rel) {
  const text = read(root, rel);
  if (!text) throw new Error(`Missing JSON file: ${rel}`);
  return JSON.parse(text);
}

function issue(code, fields = {}) {
  return { issue: code, ...fields };
}

function normalizeCommandRef(command) {
  return String(command ?? "").trim().replace(/^npm\s+run\s+/u, "");
}

function npmRunRefs(command) {
  const refs = [];
  const re = /\bnpm\s+run\s+([A-Za-z0-9:_-]+)/gu;
  for (const match of String(command ?? "").matchAll(re)) refs.push(match[1]);
  return refs;
}

function operationalOwnerFor(script, rules) {
  return rules.find((rule) => script.startsWith(rule.prefix)) ?? null;
}

function isOperationalScript(script, rules) {
  return Boolean(operationalOwnerFor(script, rules));
}

function commandUsesOnlyAlias(command) {
  return /^(?:[A-Z0-9_]+=[^\s]+\s+)*npm run [A-Za-z0-9:_-]+(?:\s+--.*)?$/u.test(String(command ?? "").trim());
}

function workflowFiles(root) {
  const dir = path.join(root, ".github", "workflows");
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((name) => /\.ya?ml$/iu.test(name))
    .sort((a, b) => a.localeCompare(b))
    .map((name) => {
      const rel = `.github/workflows/${name}`;
      return { rel, text: read(root, rel) };
    });
}

function collectWorkflowRefs(files) {
  const refs = [];
  for (const file of files) {
    for (const script of npmRunRefs(file.text)) refs.push({ file: file.rel, script });
  }
  return refs.sort((a, b) => `${a.file}:${a.script}`.localeCompare(`${b.file}:${b.script}`));
}

function collectGraph(scripts) {
  return Object.entries(scripts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([script, command]) => ({
      script,
      refs: [...new Set(npmRunRefs(command))].sort((a, b) => a.localeCompare(b)),
    }));
}

function findCycles(graph) {
  const edges = new Map(graph.map((entry) => [entry.script, entry.refs]));
  const cycles = [];
  const active = new Set();
  const visited = new Set();

  function visit(node, stack) {
    if (active.has(node)) {
      const cycle = stack.slice(stack.indexOf(node)).concat(node);
      cycles.push(cycle);
      return;
    }
    if (visited.has(node)) return;
    visited.add(node);
    active.add(node);
    for (const next of edges.get(node) ?? []) {
      if (edges.has(next)) visit(next, [...stack, next]);
    }
    active.delete(node);
  }

  for (const node of [...edges.keys()].sort((a, b) => a.localeCompare(b))) visit(node, [node]);
  return cycles.map((cycle) => cycle.join(" -> ")).sort((a, b) => a.localeCompare(b));
}

function tierSteps(manifest) {
  const byTier = {};
  const all = new Set();
  for (const [tier, data] of Object.entries(manifest.tiers ?? {})) {
    const steps = [];
    for (const step of data.steps ?? []) {
      const script = typeof step === "string" ? step : step?.script;
      if (!script) continue;
      steps.push(script);
      all.add(script);
    }
    byTier[tier] = steps.sort((a, b) => a.localeCompare(b));
  }
  return { byTier, all };
}

function checkTierCoverage(packageScripts, manifest, allowlist, issues) {
  const { all } = tierSteps(manifest);
  const allow = new Set(Array.isArray(allowlist.scripts) ? allowlist.scripts : []);
  const checkScripts = Object.keys(packageScripts).filter((name) => name.startsWith("check:")).sort((a, b) => a.localeCompare(b));
  const uncovered = checkScripts.filter((script) => !all.has(script) && !allow.has(script));
  const orphanAllowlist = [...allow].filter((script) => script.startsWith("check:") && !packageScripts[script]).sort((a, b) => a.localeCompare(b));

  for (const script of uncovered) issues.push(issue("operational_package_check_script_uncovered", { script }));
  for (const script of orphanAllowlist) issues.push(issue("operational_package_orphan_tier_allowlist", { script }));

  return {
    checkScripts: checkScripts.length,
    manifestScripts: all.size,
    allowlist: allow.size,
    uncovered: uncovered.length,
    orphanAllowlist: orphanAllowlist.length,
  };
}

function matchArtifactOwner(rel, rules) {
  return rules.find((rule) => rel.startsWith(rule.prefix)) ?? null;
}

function validateGeneratedArtifactOwners(config, packageScripts, issues) {
  const deterministic = new Set(DETERMINISTIC_GENERATED_ARTIFACT_PATHS);
  const artifactPaths = [...new Set([...GENERATED_ARTIFACT_HYGIENE_PATHS, ...DETERMINISTIC_GENERATED_ARTIFACT_PATHS])].sort((a, b) => a.localeCompare(b));
  const rows = [];

  for (const rel of artifactPaths) {
    const ownerRule = matchArtifactOwner(rel, config.generatedArtifactOwnerRules ?? []);
    const writeCommand = GENERATED_ARTIFACT_WRITE_COMMANDS[rel] ?? null;
    const script = writeCommand ? normalizeCommandRef(writeCommand) : null;

    if (!ownerRule) issues.push(issue("operational_package_generated_artifact_missing_owner", { path: rel }));
    if (deterministic.has(rel) && !writeCommand) issues.push(issue("operational_package_generated_artifact_missing_write_command", { path: rel }));
    if (script && !packageScripts[script]) issues.push(issue("operational_package_generated_artifact_unknown_write_script", { path: rel, script }));
    if (ownerRule && !ownerRule.cleanupPolicy) issues.push(issue("operational_package_generated_artifact_missing_cleanup_policy", { path: rel, ownerArea: ownerRule.ownerArea }));

    rows.push({
      path: rel,
      ownerArea: ownerRule?.ownerArea ?? null,
      deterministic: deterministic.has(rel),
      writeCommand,
      cleanupPolicy: ownerRule?.cleanupPolicy ?? null,
    });
  }

  return rows;
}

function validateDangerousShellPatterns(config, packageScripts, issues) {
  const findings = [];
  const patterns = (config.dangerousShellPatterns ?? []).map((row) => ({ id: row.id, regex: new RegExp(row.regex, "u") }));
  for (const [script, command] of Object.entries(packageScripts).sort(([a], [b]) => a.localeCompare(b))) {
    for (const pattern of patterns) {
      if (pattern.regex.test(command)) {
        const finding = { script, pattern: pattern.id };
        findings.push(finding);
        issues.push(issue("operational_package_dangerous_shell_pattern", finding));
      }
    }
  }
  return findings;
}

function validatePipelineTiers(config, packageScripts, manifest, workflows, issues) {
  const tierData = tierSteps(manifest);
  return (config.pipelineTiers ?? []).map((tier) => {
    const scriptExists = Boolean(packageScripts[tier.script]);
    if (!scriptExists) issues.push(issue("operational_package_missing_pipeline_tier_script", { tier: tier.id, script: tier.script }));

    const manifestPresence = (tier.manifestTiers ?? []).map((manifestTier) => {
      const present = tierData.byTier[manifestTier]?.includes(tier.script) ?? false;
      if (!present) issues.push(issue("operational_package_pipeline_tier_missing_manifest_ref", { tier: tier.id, script: tier.script, manifestTier }));
      return { manifestTier, present };
    });

    let workflowPresent = null;
    if (tier.workflow) {
      const workflow = workflows.find((file) => file.rel === tier.workflow);
      workflowPresent = Boolean(workflow?.text.includes(`npm run ${tier.script}`));
      if (!workflowPresent) issues.push(issue("operational_package_pipeline_tier_missing_workflow_ref", { tier: tier.id, script: tier.script, workflow: tier.workflow }));
    }

    return {
      id: tier.id,
      ownerArea: tier.ownerArea,
      script: tier.script,
      scriptExists,
      manifestPresence,
      workflow: tier.workflow ?? null,
      workflowPresent,
    };
  });
}

export function analyzeOperationalPackagePipelines(root = process.cwd(), options = {}) {
  const config = readJson(root, CONFIG_REL);
  const pkg = readJson(root, "package.json");
  const packageScripts = pkg.scripts ?? {};
  const manifest = readJson(root, "config/qa-tier-manifest.json");
  const allowlist = readJson(root, "config/qa-tier-coverage-allowlist.json");
  const workflows = workflowFiles(root);
  const issues = [];

  for (const row of config.requiredCommands ?? []) {
    if (!packageScripts[row.command]) {
      issues.push(issue("operational_package_missing_required_command", { id: row.id, command: row.command }));
    }
  }

  const graph = collectGraph(packageScripts);
  for (const entry of graph) {
    for (const ref of entry.refs) {
      if (!packageScripts[ref]) issues.push(issue("operational_package_missing_script_reference", { script: entry.script, missing: ref }));
    }
  }

  const graphCycles = findCycles(graph);
  for (const cycle of graphCycles) issues.push(issue("operational_package_script_cycle", { cycle }));

  const workflowRefs = collectWorkflowRefs(workflows);
  for (const ref of workflowRefs) {
    if (!packageScripts[ref.script]) issues.push(issue("operational_package_workflow_missing_script_reference", ref));
  }

  const operationalScripts = Object.entries(packageScripts)
    .filter(([script]) => isOperationalScript(script, config.scriptOwnerRules ?? []))
    .map(([script, command]) => {
      const ownerRule = operationalOwnerFor(script, config.scriptOwnerRules ?? []);
      return {
        script,
        ownerArea: ownerRule?.ownerArea ?? null,
        coverage: ownerRule?.coverage ?? null,
        aliasOnly: commandUsesOnlyAlias(command),
        referencedByScriptCount: graph.filter((entry) => entry.refs.includes(script)).length,
        referencedByWorkflowCount: workflowRefs.filter((entry) => entry.script === script).length,
      };
    })
    .sort((a, b) => a.script.localeCompare(b.script));

  for (const row of operationalScripts) {
    if (!row.ownerArea) issues.push(issue("operational_package_script_missing_owner", { script: row.script }));
  }

  const aliasOnlyScripts = operationalScripts.filter((row) => row.aliasOnly);
  const tierCoverage = checkTierCoverage(packageScripts, manifest, allowlist, issues);
  const dangerousShellFindings = validateDangerousShellPatterns(config, packageScripts, issues);
  const pipelineTiers = validatePipelineTiers(config, packageScripts, manifest, workflows, issues);
  const generatedArtifacts = validateGeneratedArtifactOwners(config, packageScripts, issues);
  const generatedArtifactHygiene = analyzeGeneratedArtifactHygiene(root);
  const staticCheckDeterminism = analyzeStaticCheckDeterminism(root);

  if (!generatedArtifactHygiene.ok) {
    issues.push(issue("operational_package_generated_artifact_hygiene_failed", { issueCount: generatedArtifactHygiene.issueCount }));
  }
  if (!staticCheckDeterminism.ok) {
    issues.push(issue("operational_package_static_check_determinism_failed", { issueCount: staticCheckDeterminism.issueCount }));
  }

  const payload = {
    ok: issues.length === 0,
    schemaVersion: 1,
    source: config.source,
    generatedFrom: CONFIG_REL,
    packageScriptCount: Object.keys(packageScripts).length,
    operationalScriptCount: operationalScripts.length,
    packageGraph: {
      nodeCount: graph.length,
      edgeCount: graph.reduce((count, entry) => count + entry.refs.length, 0),
      cycleCount: graphCycles.length,
      aliasOnlyCount: aliasOnlyScripts.length,
      missingReferenceCount: issues.filter((entry) => entry.issue === "operational_package_missing_script_reference").length,
    },
    workflowScriptReferenceCount: workflowRefs.length,
    requiredCommands: [...(config.requiredCommands ?? [])].sort((a, b) => a.id.localeCompare(b.id)),
    tierCoverage,
    pipelineTiers,
    deterministicOutput: {
      staticCheckDeterminism: {
        ok: staticCheckDeterminism.ok,
        issueCount: staticCheckDeterminism.issueCount,
        blockingScriptsChecked: staticCheckDeterminism.blockingScriptsChecked,
      },
      generatedArtifactHygiene: {
        ok: generatedArtifactHygiene.ok,
        issueCount: generatedArtifactHygiene.issueCount,
        artifactCount: generatedArtifactHygiene.artifactCount,
        deterministicArtifactCount: generatedArtifactHygiene.deterministicArtifactCount,
        safeToRegenerateCount: generatedArtifactHygiene.safeToRegenerateCount,
      },
    },
    generatedArtifacts,
    aliasOnlyScripts,
    dangerousShellFindings,
    issueCount: issues.length,
    issues: issues.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
  };

  const expected = stableStringify(payload);
  const artifactPath = path.join(root, ARTIFACT_REL);
  if (WRITE || options.write) {
    fs.mkdirSync(path.dirname(artifactPath), { recursive: true });
    fs.writeFileSync(artifactPath, expected);
  } else if (fs.existsSync(artifactPath)) {
    const actual = fs.readFileSync(artifactPath, "utf8");
    if (actual !== expected) {
      payload.ok = false;
      payload.issues.push(issue("operational_package_pipeline_artifact_drift", { artifact: ARTIFACT_REL }));
      payload.issueCount = payload.issues.length;
    }
  } else {
    payload.ok = false;
    payload.issues.push(issue("operational_package_pipeline_artifact_missing", { artifact: ARTIFACT_REL }));
    payload.issueCount = payload.issues.length;
  }

  return payload;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = analyzeOperationalPackagePipelines();
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}
