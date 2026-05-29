#!/usr/bin/env node
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

import { analyzeGeneratedArtifactHygiene } from "./check-generated-artifact-hygiene.mjs";
import { analyzeOperationalPackagePipelines } from "./check-operational-package-pipelines.mjs";

const ROOT = process.cwd();
const CONFIG_REL = "config/operational-static-architecture-code-health.json";
const ARTIFACT_REL = "artifacts/operational-static-architecture-code-health.json";
const WRITE = process.argv.includes("--write");

function stableStringify(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function read(root, rel) {
  const abs = path.join(root, rel);
  return fs.existsSync(abs) ? fs.readFileSync(abs, "utf8") : "";
}

function readJson(root, rel, fallback = null) {
  const text = read(root, rel);
  return text ? JSON.parse(text) : fallback;
}

function writeJson(root, rel, value) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, stableStringify(value));
}

function issue(code, fields = {}) {
  return { issue: code, ...fields };
}

function walk(root, rel, predicate, out = []) {
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) return out;
  for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
    const childRel = path.join(rel, entry.name).replace(/\\/gu, "/");
    if (entry.name === "node_modules" || entry.name === ".next" || entry.name === ".git") continue;
    if (entry.isDirectory()) walk(root, childRel, predicate, out);
    else if (entry.isFile() && predicate(childRel)) out.push(childRel);
  }
  return out;
}

function sourceFiles(root) {
  return walk(root, "src", (rel) => /\.(?:ts|tsx)$/u.test(rel)).sort((a, b) => a.localeCompare(b));
}

function packageScripts(root) {
  return readJson(root, "package.json", { scripts: {} })?.scripts ?? {};
}

function isTestPath(rel) {
  return rel.startsWith("src/test-utils/") || /\.test\.|\.spec\.|\/__tests__\//u.test(rel);
}

function hasClientDirective(text) {
  return /^\s*["']use client["'];?/u.test(text);
}

function importsFor(text) {
  const rows = [];
  const re =
    /(?<statement>import\s+type\s+[^;]*?\s+from\s+["'](?<typeFrom>[^"']+)["']|import\s+[^;]*?\s+from\s+["'](?<from>[^"']+)["']|export\s+[^;]*?\s+from\s+["'](?<exportFrom>[^"']+)["']|import\s*\(\s*["'](?<dynamic>[^"']+)["']\s*\)|require\s*\(\s*["'](?<require>[^"']+)["']\s*\))/gsu;
  for (const match of text.matchAll(re)) {
    const specifier = match.groups?.typeFrom ?? match.groups?.from ?? match.groups?.exportFrom ?? match.groups?.dynamic ?? match.groups?.require;
    if (!specifier) continue;
    rows.push({
      specifier,
      dynamic: Boolean(match.groups?.dynamic),
      typeOnly: Boolean(match.groups?.typeFrom),
      statement: match.groups?.statement ?? "",
    });
  }
  return rows;
}

function specMatches(specifier, patterns = []) {
  return patterns.some((pattern) => {
    if (pattern.endsWith(":") || pattern.endsWith("/")) return specifier.startsWith(pattern);
    if (pattern.includes("/")) return specifier === pattern || specifier.startsWith(pattern);
    return specifier === pattern;
  });
}

function resolveSpecifier(fromRel, specifier) {
  if (specifier.startsWith("@/")) return `src/${specifier.slice(2)}`;
  if (!specifier.startsWith(".")) return null;
  const base = path.posix.normalize(path.posix.join(path.posix.dirname(fromRel), specifier));
  return base;
}

function appliesToRule(rel, text, appliesTo = {}) {
  if (appliesTo.productionOnly && isTestPath(rel)) return false;
  if (appliesTo.clientDirective && !hasClientDirective(text)) return false;
  if (Array.isArray(appliesTo.pathPrefixes) && !appliesTo.pathPrefixes.some((prefix) => rel.startsWith(prefix))) return false;
  return true;
}

export function analyzeImportBoundaries(root, config, issues = []) {
  const violations = [];
  const files = sourceFiles(root);
  for (const rel of files) {
    const text = read(root, rel);
    const imports = importsFor(text);
    for (const rule of config.importBoundaryRules ?? []) {
      if (!appliesToRule(rel, text, rule.appliesTo)) continue;
      for (const imp of imports) {
        if (rule.allowTypeOnly && imp.typeOnly) continue;
        const resolved = resolveSpecifier(rel, imp.specifier) ?? imp.specifier;
        const forbidden =
          specMatches(imp.specifier, rule.forbiddenSpecifiers ?? []) ||
          (rule.forbiddenResolvedPathFragments ?? []).some((fragment) => resolved.includes(fragment));
        if (!forbidden) continue;
        const row = { file: rel, rule: rule.id, specifier: imp.specifier, reason: rule.reason };
        violations.push(row);
        issues.push(issue("operational_static_import_boundary_violation", row));
      }
    }
  }
  return { scannedFileCount: files.length, ruleCount: config.importBoundaryRules?.length ?? 0, violationCount: violations.length, violations };
}

function runtimeFor(text) {
  const match = text.match(/export\s+const\s+runtime\s*=\s*["'](edge|nodejs)["']/u);
  return match?.[1] ?? "nodejs-default";
}

export function analyzeRuntimeBoundaries(root, config, issues = []) {
  const runtimeConfig = config.runtimeBoundary ?? {};
  const routeFiles = (runtimeConfig.routeRoots ?? ["src/app"]).flatMap((routeRoot) =>
    walk(root, routeRoot, (rel) => rel.endsWith("/route.ts") || rel === "src/app/route.ts")
  );
  const rows = [];
  for (const rel of routeFiles.sort((a, b) => a.localeCompare(b))) {
    const text = read(root, rel);
    const imports = importsFor(text);
    const runtime = runtimeFor(text);
    const edgeForbidden = imports.filter((imp) => specMatches(imp.specifier, runtimeConfig.edgeForbiddenSpecifiers ?? []));
    const nativeNode = imports.filter((imp) => specMatches(imp.specifier, runtimeConfig.nodeNativeSpecifiers ?? []));
    if (runtime === "edge") {
      for (const imp of edgeForbidden) {
        issues.push(issue("operational_static_edge_forbidden_import", { file: rel, specifier: imp.specifier }));
      }
    }
    rows.push({
      file: rel,
      runtime,
      lineCount: read(root, rel).split("\n").length,
      nativeNodeImportCount: nativeNode.length,
      dynamicImportCount: imports.filter((imp) => imp.dynamic).length,
      nodeOnlyDocumented: runtime !== "edge" && nativeNode.length > 0,
    });
  }

  const nextConfig = read(root, "next.config.ts");
  const externalPackages = runtimeConfig.requiredServerExternalPackages ?? [];
  const serverExternalPackages = externalPackages.map((pkg) => ({ package: pkg, present: nextConfig.includes(`"${pkg}"`) || nextConfig.includes(`'${pkg}'`) }));
  for (const row of serverExternalPackages) {
    if (!row.present) issues.push(issue("operational_static_server_external_package_missing", { package: row.package }));
  }
  return {
    routeCount: rows.length,
    edgeRouteCount: rows.filter((row) => row.runtime === "edge").length,
    nodeRuntimeRouteCount: rows.filter((row) => row.runtime !== "edge").length,
    nodeOnlyRouteCount: rows.filter((row) => row.nodeOnlyDocumented).length,
    routeRuntimeRows: rows,
    serverExternalPackages,
  };
}

function resolveImport(root, fromRel, specifier) {
  const resolved = resolveSpecifier(fromRel, specifier);
  if (!resolved || !resolved.startsWith("src/")) return null;
  const base = path.join(root, resolved);
  const candidates = [`${base}.ts`, `${base}.tsx`, path.join(base, "index.ts"), path.join(base, "index.tsx")];
  const hit = candidates.find((candidate) => fs.existsSync(candidate));
  return hit ? path.relative(path.join(root, "src"), hit).replace(/\\/gu, "/") : null;
}

function normalizeDependencyCycle(cycle) {
  return cycle.join(" -> ");
}

function loadDependencyCycleBaseline(root, baselineRel, issues) {
  if (!baselineRel) return new Set();
  const baseline = readJson(root, baselineRel, null);
  if (!baseline) {
    issues.push(issue("operational_static_dependency_cycle_baseline_missing", { baseline: baselineRel }));
    return new Set();
  }
  return new Set((baseline.cycles ?? []).filter((cycle) => typeof cycle === "string"));
}

export function analyzeDependencyCycles(root, config = {}, issues = []) {
  const files = sourceFiles(root).filter((rel) => !isTestPath(rel));
  const graph = new Map();
  for (const rel of files) {
    const imports = importsFor(read(root, rel))
      .map((imp) => resolveImport(root, rel, imp.specifier))
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));
    graph.set(rel.replace(/^src\//u, ""), imports);
  }
  const cycles = [];
  const visiting = new Set();
  const visited = new Set();
  function visit(node, stack) {
    if (visiting.has(node)) {
      cycles.push(stack.slice(stack.indexOf(node)));
      return;
    }
    if (visited.has(node)) return;
    visiting.add(node);
    for (const next of graph.get(node) ?? []) visit(next, [...stack, next]);
    visiting.delete(node);
    visited.add(node);
  }
  for (const node of [...graph.keys()].sort((a, b) => a.localeCompare(b))) visit(node, [node]);
  const normalizedCycles = [...new Set(cycles.map(normalizeDependencyCycle))].sort((a, b) => a.localeCompare(b));
  const baseline = loadDependencyCycleBaseline(root, config.dependencyCycleBaseline, issues);
  const regressions = normalizedCycles.filter((cycle) => !baseline.has(cycle));
  for (const cycle of regressions) issues.push(issue("operational_static_dependency_cycle_regression", { cycle, baseline: config.dependencyCycleBaseline ?? null }));
  return {
    scannedFileCount: files.length,
    baseline: config.dependencyCycleBaseline ?? null,
    cycleCount: normalizedCycles.length,
    regressionCount: regressions.length,
    cycles: normalizedCycles.slice(0, 50),
    regressions,
  };
}

function matchesExtension(rel, extensions) {
  return extensions.some((ext) => (ext.startsWith(".") ? rel.endsWith(ext) : rel.endsWith(`/${ext}`) || rel.endsWith(ext)));
}

function loadBaseline(root, baselineRel) {
  if (!baselineRel) return new Map();
  const baseline = readJson(root, baselineRel, { offenders: [] });
  return new Map((baseline.offenders ?? []).map((row) => [row.file, Number(row.lines)]));
}

export function analyzeComplexity(root, config, issues = []) {
  const ratchets = [];
  for (const rule of config.complexityRatchets ?? []) {
    const files = (rule.roots ?? []).flatMap((rootRel) => walk(root, rootRel, (rel) => matchesExtension(rel, rule.extensions ?? [])));
    const candidates = files
      .filter((rel) => !(rule.excludePathFragments ?? []).some((fragment) => rel.includes(fragment)))
      .map((rel) => ({ file: rel, lines: read(root, rel).split("\n").length, maxLines: rule.maxLines }))
      .sort((a, b) => b.lines - a.lines || a.file.localeCompare(b.file));
    const offenders = candidates.filter((row) => row.lines > rule.maxLines);
    const baseline = loadBaseline(root, rule.baseline);
    const regressions = rule.baseline
      ? offenders.filter((row) => !baseline.has(row.file) || row.lines > baseline.get(row.file))
      : offenders;
    for (const row of regressions) {
      issues.push(issue("operational_static_complexity_regression", { category: rule.id, file: row.file, lines: row.lines, maxLines: row.maxLines }));
    }
    ratchets.push({
      id: rule.id,
      scannedFileCount: candidates.length,
      maxLines: rule.maxLines,
      baseline: rule.baseline ?? null,
      offenderCount: offenders.length,
      regressionCount: regressions.length,
      largestFiles: candidates.slice(0, 25),
      regressions,
    });
  }
  return ratchets;
}

function referencedScriptFiles(root) {
  const pkg = readJson(root, "package.json", { scripts: {} });
  const commandText = Object.values(pkg.scripts ?? {}).join("\n");
  const workflowText = walk(root, ".github/workflows", (rel) => /\.ya?ml$/u.test(rel))
    .map((rel) => read(root, rel))
    .join("\n");
  const used = new Set();
  for (const text of [commandText, workflowText]) {
    for (const match of text.matchAll(/scripts\/([A-Za-z0-9_./-]+\.mjs)/gu)) used.add(match[1]);
  }
  return used;
}

export function analyzeDeadSurfaces(root, config, issues = []) {
  const deadConfig = config.deadSurface ?? {};
  const used = referencedScriptFiles(root);
  const ignored = new Set(deadConfig.scriptIgnore ?? []);
  const scripts = walk(root, "scripts", (rel) => rel.endsWith(".mjs")).map((rel) => rel.replace(/^scripts\//u, ""));
  const unusedScripts = scripts
    .filter((rel) => !used.has(rel) && !ignored.has(rel) && !rel.startsWith("lib/") && !rel.endsWith(".test.mjs"))
    .sort((a, b) => a.localeCompare(b));
  for (const script of unusedScripts) issues.push(issue("operational_static_unused_script_file", { script: `scripts/${script}` }));

  const allText = sourceFiles(root)
    .concat(walk(root, "scripts", (rel) => rel.endsWith(".mjs")), walk(root, "e2e", (rel) => /\.(?:ts|json)$/u.test(rel)))
    .map((rel) => [rel, read(root, rel)]);
  const fixtureAllow = new Set(deadConfig.fixtureReferenceAllowlist ?? []);
  const fixtureFiles = (deadConfig.fixtureRoots ?? []).flatMap((fixtureRoot) => walk(root, fixtureRoot, () => true)).sort((a, b) => a.localeCompare(b));
  const orphanedFixtures = [];
  for (const fixture of fixtureFiles) {
    if (fixtureAllow.has(fixture)) continue;
    const basename = path.basename(fixture);
    const extensionless = fixture.replace(/\.[^.]+$/u, "");
    const basenameExtensionless = path.basename(extensionless);
    const referenced = allText.some(
      ([rel, text]) =>
        rel !== fixture && (text.includes(fixture) || text.includes(extensionless) || text.includes(basename) || text.includes(basenameExtensionless))
    );
    if (!referenced) orphanedFixtures.push(fixture);
  }
  for (const fixture of orphanedFixtures) issues.push(issue("operational_static_orphaned_fixture", { fixture }));

  const scriptsMap = packageScripts(root);
  const routeMetadataEvidence = (deadConfig.routeMetadataEvidenceCommands ?? []).map((command) => ({ command, present: Boolean(scriptsMap[command]) }));
  for (const row of routeMetadataEvidence) {
    if (!row.present) issues.push(issue("operational_static_route_metadata_evidence_missing", { command: row.command }));
  }
  const packagePipelines = analyzeOperationalPackagePipelines(root);
  if (!packagePipelines.ok) issues.push(issue("operational_static_package_pipeline_failed", { issueCount: packagePipelines.issueCount }));

  return {
    scriptFileCount: scripts.length,
    referencedScriptFileCount: used.size,
    unusedScripts,
    fixtureFileCount: fixtureFiles.length,
    orphanedFixtures,
    routeMetadataEvidence,
    packagePipelines: { ok: packagePipelines.ok, issueCount: packagePipelines.issueCount },
  };
}

function sha256(root, rel) {
  return createHash("sha256").update(fs.readFileSync(path.join(root, rel))).digest("hex");
}

export function analyzeReproducibility(root, config, issues = []) {
  const repro = config.reproducibility ?? {};
  const inputHashes = [];
  for (const rel of repro.hashInputs ?? []) {
    if (!fs.existsSync(path.join(root, rel))) {
      issues.push(issue("operational_static_repro_hash_input_missing", { path: rel }));
      continue;
    }
    const first = sha256(root, rel);
    const second = sha256(root, rel);
    if (first !== second) issues.push(issue("operational_static_repro_hash_unstable", { path: rel }));
    inputHashes.push({ path: rel, sha256: first, stable: first === second });
  }
  const generatedTypes = (repro.generatedTypeArtifacts ?? []).map((rel) => ({ path: rel, present: fs.existsSync(path.join(root, rel)) }));
  for (const row of generatedTypes) {
    if (!row.present) issues.push(issue("operational_static_generated_type_artifact_missing", { path: row.path }));
  }
  const markerRows = [];
  for (const [rel, markers] of Object.entries(repro.requiredMarkers ?? {})) {
    const text = read(root, rel);
    const missing = markers.filter((marker) => !text.includes(marker));
    markerRows.push({ path: rel, markerCount: markers.length, missingCount: missing.length, ok: missing.length === 0 });
    for (const marker of missing) issues.push(issue("operational_static_repro_marker_missing", { path: rel, marker }));
  }
  return { inputHashes, generatedTypes, markerRows };
}

function summarizeGeneratedArtifactHygiene(root, issues) {
  const report = analyzeGeneratedArtifactHygiene(root);
  if (!report.ok) issues.push(issue("operational_static_generated_artifact_hygiene_failed", { issueCount: report.issueCount }));
  return { ok: report.ok, issueCount: report.issueCount, artifactCount: report.artifactCount };
}

export function buildOperationalStaticArchitectureCodeHealthReport(root = ROOT) {
  const config = readJson(root, CONFIG_REL, {});
  const scripts = packageScripts(root);
  const ci = read(root, ".github/workflows/ci.yml");
  const issues = [];

  if (config.schemaVersion !== 1 || config.source !== "code-owned-operational-static-architecture-code-health") {
    issues.push(issue("operational_static_invalid_config_metadata"));
  }
  if (config.generatedArtifact !== ARTIFACT_REL) issues.push(issue("operational_static_unexpected_generated_artifact", { generatedArtifact: config.generatedArtifact ?? null }));
  for (const rel of config.sourceFiles ?? []) {
    if (!fs.existsSync(path.join(root, rel))) issues.push(issue("operational_static_source_file_missing", { path: rel }));
  }
  for (const command of config.requiredValidationCommands ?? []) {
    if (!scripts[command]) issues.push(issue("operational_static_missing_package_script", { command }));
  }
  if (!ci.includes("npm run check:operational-static-architecture-code-health")) {
    issues.push(issue("operational_static_missing_ci_command", { command: "npm run check:operational-static-architecture-code-health" }));
  }

  const importBoundaries = analyzeImportBoundaries(root, config, issues);
  const runtimeBoundaries = analyzeRuntimeBoundaries(root, config, issues);
  const dependencyCycles = analyzeDependencyCycles(root, config, issues);
  const complexityRatchets = analyzeComplexity(root, config, issues);
  const deadSurfaces = analyzeDeadSurfaces(root, config, issues);
  const reproducibility = analyzeReproducibility(root, config, issues);
  const generatedArtifactHygiene = summarizeGeneratedArtifactHygiene(root, issues);

  return {
    schemaVersion: 1,
    source: "code-owned-operational-static-architecture-code-health",
    generatedArtifact: ARTIFACT_REL,
    ok: issues.length === 0,
    summary: {
      sourceFileCount: sourceFiles(root).length,
      importBoundaryViolationCount: importBoundaries.violationCount,
      routeCount: runtimeBoundaries.routeCount,
      dependencyCycleCount: dependencyCycles.cycleCount,
      dependencyCycleRegressionCount: dependencyCycles.regressionCount,
      complexityRegressionCount: complexityRatchets.reduce((count, row) => count + row.regressionCount, 0),
      unusedScriptCount: deadSurfaces.unusedScripts.length,
      orphanedFixtureCount: deadSurfaces.orphanedFixtures.length,
    },
    requiredValidationCommands: config.requiredValidationCommands ?? [],
    importBoundaries,
    runtimeBoundaries,
    dependencyCycles,
    complexityRatchets,
    deadSurfaces,
    reproducibility,
    generatedArtifactHygiene,
    manualBoundary: config.manualBoundary ?? null,
    issueCount: issues.length,
    issues: issues.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = buildOperationalStaticArchitectureCodeHealthReport();

  if (WRITE) {
    writeJson(ROOT, ARTIFACT_REL, report);
  } else {
    const existing = readJson(ROOT, ARTIFACT_REL, null);
    if (!existing) {
      report.issues.push(issue("operational_static_artifact_missing", { artifact: ARTIFACT_REL }));
      report.issueCount = report.issues.length;
      report.ok = false;
    } else if (stableStringify(existing) !== stableStringify(report)) {
      report.issues.push(issue("operational_static_artifact_drift", { artifact: ARTIFACT_REL, writeCommand: "npm run write:operational-static-architecture-code-health" }));
      report.issueCount = report.issues.length;
      report.ok = false;
    }
  }

  console.log(stableStringify(report));
  if (!report.ok) process.exitCode = 1;
}
