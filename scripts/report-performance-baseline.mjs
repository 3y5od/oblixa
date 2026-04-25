#!/usr/bin/env node
/**
 * Repository-local performance baseline snapshot.
 *
 * This is intentionally artifact-tolerant: it reports source-level signals on every
 * run and enriches the output with Next analyzer data when `npm run analyze` has
 * produced artifacts.
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { createResult, finishWithResult } from "./lib/result.mjs";
import { nowMs } from "./lib/timing.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const srcRoot = path.join(root, "src");
const appRoot = path.join(srcRoot, "app");
const startMs = nowMs();

function walk(dir, predicate = () => true, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const name of fs.readdirSync(dir)) {
    if (name === "node_modules" || name === ".next" || name === "coverage") continue;
    const abs = path.join(dir, name);
    const stat = fs.statSync(abs);
    if (stat.isDirectory()) {
      walk(abs, predicate, acc);
    } else if (predicate(abs)) {
      acc.push(abs);
    }
  }
  return acc;
}

function rel(abs) {
  return path.relative(root, abs).replace(/\\/g, "/");
}

function read(abs) {
  return fs.readFileSync(abs, "utf8");
}

function countMatches(source, re) {
  return [...source.matchAll(re)].length;
}

function summarizeAnalyzerArtifacts() {
  const candidates = [
    path.join(root, ".next", "analyze", "client.json"),
    path.join(root, ".next", "analyze", "stats-client.json"),
  ];
  const artifact = candidates.find((candidate) => fs.existsSync(candidate));
  if (!artifact) return { found: false };

  try {
    const stats = JSON.parse(read(artifact));
    const assets = Array.isArray(stats?.assets) ? stats.assets : [];
    const jsAssets = assets.filter(
      (asset) => typeof asset?.name === "string" && asset.name.endsWith(".js")
    );
    const totalClientKb =
      jsAssets.reduce((sum, asset) => sum + (Number(asset?.size ?? 0) || 0), 0) / 1024;
    const largestJsAssets = jsAssets
      .map((asset) => ({
        name: asset.name,
        kb: Number(((Number(asset?.size ?? 0) || 0) / 1024).toFixed(1)),
      }))
      .sort((a, b) => b.kb - a.kb)
      .slice(0, 10);
    return {
      found: true,
      path: rel(artifact),
      totalClientKb: Number(totalClientKb.toFixed(1)),
      jsAssetCount: jsAssets.length,
      largestJsAssets,
    };
  } catch (error) {
    return {
      found: true,
      path: rel(artifact),
      parseError: error instanceof Error ? error.message : "unknown error",
    };
  }
}

const sourceFiles = walk(srcRoot, (abs) => /\.[jt]sx?$/.test(abs)).sort();
const appFiles = sourceFiles.filter((abs) => rel(abs).startsWith("src/app/"));
const pageFiles = appFiles.filter((abs) => /\/page\.tsx?$/.test(abs));
const apiRouteFiles = appFiles.filter((abs) => /\/route\.tsx?$/.test(abs));
const loadingFiles = appFiles.filter((abs) => /\/loading\.tsx?$/.test(abs));
const errorFiles = appFiles.filter((abs) => /\/error\.tsx?$/.test(abs));
const clientFiles = sourceFiles.filter((abs) => /^\s*["']use client["']\s*;/m.test(read(abs)));

let clientBytes = 0;
let clientServerActionImports = 0;
let exactCountReads = 0;
let routerRefreshCalls = 0;
let dynamicRouteMarkers = 0;
let largeLimitReads = 0;
let revalidationCalls = 0;

const largestClientFiles = [];
const appRouteSignals = [];

for (const abs of sourceFiles) {
  const content = read(abs);
  const relative = rel(abs);
  exactCountReads += countMatches(content, /count\s*:\s*["']exact["']/g);
  routerRefreshCalls += countMatches(content, /\brouter\.refresh\s*\(/g);
  dynamicRouteMarkers += countMatches(
    content,
    /dynamic\s*=\s*["']force-dynamic["']|revalidate\s*=\s*0\b/g
  );
  largeLimitReads += countMatches(
    content,
    /\.limit\s*\(\s*(?:1000|[2-9]\d{3}|\d{5,})\s*\)/g
  );
  revalidationCalls += countMatches(content, /\brevalidate(?:Path|Tag)\s*\(/g);

  if (/^\s*["']use client["']\s*;/m.test(content)) {
    const bytes = Buffer.byteLength(content);
    clientBytes += bytes;
    if (/from\s+["']@\/actions\//.test(content)) clientServerActionImports += 1;
    largestClientFiles.push({ path: relative, kb: Number((bytes / 1024).toFixed(1)) });
  }

  if (relative.startsWith("src/app/") && /\/(?:page|route)\.tsx?$/.test(relative)) {
    const querySignals = countMatches(content, /\.from\s*\(\s*["'][^"']+["']\s*\)/g);
    const exactCounts = countMatches(content, /count\s*:\s*["']exact["']/g);
    if (querySignals > 0 || exactCounts > 0) {
      appRouteSignals.push({ path: relative, querySignals, exactCounts });
    }
  }
}

largestClientFiles.sort((a, b) => b.kb - a.kb);
appRouteSignals.sort((a, b) => b.querySignals - a.querySignals || b.exactCounts - a.exactCounts);

const analyzer = summarizeAnalyzerArtifacts();
const warnings = [];
if (!analyzer.found) {
  warnings.push("No Next analyzer artifact found; run `npm run analyze` for bundle-size enrichment.");
}
if (clientServerActionImports > 0) {
  warnings.push(`${clientServerActionImports} client file(s) import server actions; review for passive telemetry or heavy mutations.`);
}

finishWithResult(
  createResult({
    checkId: "performance-baseline",
    ok: true,
    warnings,
    meta: {
      source: {
        sourceFileCount: sourceFiles.length,
        appPageCount: pageFiles.length,
        apiRouteCount: apiRouteFiles.length,
        loadingFileCount: loadingFiles.length,
        errorFileCount: errorFiles.length,
        clientFileCount: clientFiles.length,
        clientSourceKb: Number((clientBytes / 1024).toFixed(1)),
      },
      hotPathSignals: {
        exactCountReads,
        largeLimitReads,
        routerRefreshCalls,
        dynamicRouteMarkers,
        revalidationCalls,
        clientServerActionImports,
        topAppRouteQuerySignals: appRouteSignals.slice(0, 15),
        largestClientFiles: largestClientFiles.slice(0, 15),
      },
      analyzer,
    },
    startMs,
  })
);
