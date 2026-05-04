#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const SRC_ROOT = "src";
const SURFACE_SCAN_TEST = "src/lib/__tests__/realtime-surface-scan.test.ts";
const REQUIRED_PACKAGE_SCRIPTS = ["check:realtime-auth-boundaries"];
const REQUIRED_CI_COMMANDS = ["npm run check:realtime-auth-boundaries"];
const REQUIRED_SECURITY_PIPELINE_STEPS = ['"check:realtime-auth-boundaries"'];
const REQUIRED_FILE_MARKERS = {
  [SURFACE_SCAN_TEST]: [
    'describe("realtime / SSE / WS surface (Phase 22)", () => {',
    'it("documents scan for supabase realtime channel usage", () => {',
    'scan("instrumentation", readFileSync(join(root, "instrumentation.ts"), "utf8"));',
    'expect(hits.length, "extend with integration tests when realtime channels ship").toBe(0);',
  ],
};
const REALTIME_PATTERNS = [/\bchannel\s*\(\s*['"]/m, /\.subscribe\s*\(/m];
const CODE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);

function fileExists(root, rel) {
  return fs.existsSync(path.join(root, rel));
}

function read(root, rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function collectMissingMarkers(content, markers) {
  return markers.filter((marker) => !content.includes(marker));
}

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

function collectRealtimeSurfaceHits(root) {
  const srcDir = path.join(root, SRC_ROOT);
  if (!fs.existsSync(srcDir)) return [];

  return walk(srcDir)
    .filter((abs) => CODE_EXTENSIONS.has(path.extname(abs)))
    .map((abs) => path.relative(root, abs))
    .filter((rel) => rel !== SURFACE_SCAN_TEST)
    .filter((rel) => REALTIME_PATTERNS.some((pattern) => pattern.test(read(root, rel))));
}

export function analyzeRealtimeAuthBoundaries(root = ROOT) {
  const issues = [];

  for (const rel of Object.keys(REQUIRED_FILE_MARKERS)) {
    if (!fileExists(root, rel)) issues.push({ issue: "missing_required_file", rel });
  }

  const pkg = JSON.parse(read(root, "package.json"));
  for (const script of REQUIRED_PACKAGE_SCRIPTS) {
    if (!pkg.scripts?.[script]) issues.push({ issue: "missing_package_script", script });
  }

  const ci = read(root, ".github/workflows/ci.yml");
  for (const cmd of REQUIRED_CI_COMMANDS) {
    if (!ci.includes(cmd)) issues.push({ issue: "missing_ci_reference", cmd });
  }

  const securityPipeline = read(root, "scripts/pipelines/pipeline-security-comprehensive.mjs");
  for (const step of REQUIRED_SECURITY_PIPELINE_STEPS) {
    if (!securityPipeline.includes(step)) {
      issues.push({ issue: "missing_security_pipeline_step", step: step.replaceAll('"', "") });
    }
  }

  for (const [rel, markers] of Object.entries(REQUIRED_FILE_MARKERS)) {
    if (!fileExists(root, rel)) continue;
    const content = read(root, rel);
    for (const marker of collectMissingMarkers(content, markers)) {
      issues.push({ issue: "missing_marker", rel, marker });
    }
  }

  for (const rel of collectRealtimeSurfaceHits(root)) {
    issues.push({ issue: "unexpected_realtime_surface", rel });
  }

  return { checkId: "realtime-auth-boundaries", ok: issues.length === 0, issueCount: issues.length, issues };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = analyzeRealtimeAuthBoundaries();
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}
