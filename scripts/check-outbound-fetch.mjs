#!/usr/bin/env node
/**
 * Enforce SSRF-safe outbound HTTP: runtime route/action files that call global fetch( )
 * must import safeFetch from @/lib/security/safe-fetch (or be allowlisted).
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.join(__dirname, "..");

const fetchCall = /\bfetch\s*\(/;
const SOURCE_FILE_RE = /\.(ts|tsx)$/;
const TEST_FILE_RE = /\.(test|spec)\.(ts|tsx)$/;
const DECLARATION_FILE_RE = /\.d\.ts$/;

function walk(dir, acceptFile, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p, acceptFile, acc);
    else if (acceptFile(p, name)) acc.push(p);
  }
  return acc;
}

function isSourceFile(abs) {
  return SOURCE_FILE_RE.test(abs) && !TEST_FILE_RE.test(abs) && !DECLARATION_FILE_RE.test(abs);
}

function walkRoutes(apiRoot) {
  return walk(apiRoot, (_abs, name) => name === "route.ts");
}

function walkActionFiles(actionsRoot) {
  return walk(actionsRoot, (abs) => isSourceFile(abs));
}

function loadAllowlist(allowlistPath) {
  if (!fs.existsSync(allowlistPath)) return new Set();
  const routes = new Set();
  for (const line of fs.readFileSync(allowlistPath, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    routes.add(t.replace(/\\/g, "/"));
  }
  return routes;
}

function toSrcRelative(root, abs) {
  return path.relative(path.join(root, "src"), abs).replace(/\\/g, "/");
}

function fileUsesSafeFetch(raw) {
  const hasSafeFetchImport =
    /from\s+["']@\/lib\/security\/safe-fetch["']/.test(raw) ||
    /from\s+["']\.\.\/.*safe-fetch["']/.test(raw) ||
    /from\s+["']\.\/.*safe-fetch["']/.test(raw);
  const usesSafeFetchCall = /\bsafeFetch\s*\(/.test(raw);
  if (hasSafeFetchImport && usesSafeFetchCall) return true;
  return hasSafeFetchImport && !fetchCall.test(raw.replace(/\bsafeFetch\s*\(/g, ""));
}

export function findOutboundFetchViolations(root = DEFAULT_ROOT) {
  const apiRoot = path.join(root, "src", "app", "api");
  const actionsRoot = path.join(root, "src", "actions");
  const allowlistPath = path.join(root, "scripts", "outbound-fetch-allowlist.txt");
  const allowlisted = loadAllowlist(allowlistPath);
  const routeFiles = walkRoutes(apiRoot);
  const actionFiles = walkActionFiles(actionsRoot);
  const files = [...routeFiles, ...actionFiles];
  const violations = [];

  for (const abs of files) {
    const rel = toSrcRelative(root, abs);
    if (allowlisted.has(rel)) continue;
    const raw = fs.readFileSync(abs, "utf8");
    if (!fetchCall.test(raw)) continue;
    if (fileUsesSafeFetch(raw)) continue;
    violations.push(rel);
  }

  return {
    routeFilesChecked: routeFiles.length,
    actionFilesChecked: actionFiles.length,
    violations,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const reportOnly = process.argv.includes("--report");
  const result = findOutboundFetchViolations();
  if (result.violations.length) {
    const body = {
      checkId: "outbound-fetch",
      ok: false,
      violationCount: result.violations.length,
      violations: result.violations,
      hint: "Import safeFetch from @/lib/security/safe-fetch or add path relative to src/ in scripts/outbound-fetch-allowlist.txt with # meta: owner=... expiry=... reason=...",
      routeFilesChecked: result.routeFilesChecked,
      actionFilesChecked: result.actionFilesChecked,
    };
    console.error(JSON.stringify(body, null, 2));
    if (!reportOnly) process.exit(1);
  } else {
    console.log(
      JSON.stringify(
        {
          checkId: "outbound-fetch",
          ok: true,
          routesChecked: result.routeFilesChecked,
          actionFilesChecked: result.actionFilesChecked,
        },
        null,
        2
      )
    );
  }
}
