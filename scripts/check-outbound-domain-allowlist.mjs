#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.join(__dirname, "..");
const SRC_ROOT_NAME = "src";

const SOURCE_FILE_RE = /\.(ts|tsx)$/;
const TEST_FILE_RE = /\.(test|spec)\.(ts|tsx)$/;
const DECLARATION_FILE_RE = /\.d\.ts$/;
const TEST_HELPER_FILE_RE = /(^|\/)\S*test-helper\.(ts|tsx)$/;
const SAFE_FETCH_IMPORT_RE = /from\s+["'](?:@\/lib\/security\/safe-fetch|\.{1,2}\/.*safe-fetch)["']/;
const SAFE_FETCH_CALL_RE = /\bsafeFetch\s*\(/;

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const name of fs.readdirSync(dir)) {
    const abs = path.join(dir, name);
    const st = fs.statSync(abs);
    if (st.isDirectory()) walk(abs, acc);
    else acc.push(abs);
  }
  return acc;
}

function isRuntimeSourceFile(abs) {
  return (
    SOURCE_FILE_RE.test(abs) &&
    !TEST_FILE_RE.test(abs) &&
    !DECLARATION_FILE_RE.test(abs) &&
    !TEST_HELPER_FILE_RE.test(abs)
  );
}

function loadAllowlist(allowlistPath) {
  if (!fs.existsSync(allowlistPath)) return new Set();
  const entries = new Set();
  for (const line of fs.readFileSync(allowlistPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    entries.add(trimmed.replace(/\\/g, "/"));
  }
  return entries;
}

function toSrcRelative(root, abs) {
  return path.relative(path.join(root, SRC_ROOT_NAME), abs).replace(/\\/g, "/");
}

export function fileUsesSafeFetch(raw) {
  return SAFE_FETCH_IMPORT_RE.test(raw) && SAFE_FETCH_CALL_RE.test(raw);
}

export function fileHasAcceptedSafeFetchUrlSource(raw) {
  if (/\bvalidateOutboundHttpUrl\b/.test(raw)) {
    return { ok: true, reason: "validated_dynamic_url" };
  }
  if (/\bgetSupabasePublicEnv\s*\(/.test(raw)) {
    return { ok: true, reason: "trusted_supabase_env" };
  }
  if (/\bresolveAppBaseUrl\s*\(/.test(raw) && /allowLocalhostInDev\s*:\s*true/.test(raw)) {
    return { ok: true, reason: "trusted_same_app_origin" };
  }
  return { ok: false, reason: "missing_validated_or_trusted_url_source" };
}

export function analyzeOutboundDomainAllowlist(root = DEFAULT_ROOT) {
  const srcRoot = path.join(root, SRC_ROOT_NAME);
  const allowlistPath = path.join(root, "scripts", "outbound-domain-allowlist.txt");
  const allowlisted = loadAllowlist(allowlistPath);
  const files = walk(srcRoot).filter(isRuntimeSourceFile);
  const violations = [];
  let safeFetchFilesChecked = 0;

  for (const abs of files) {
    const rel = toSrcRelative(root, abs);
    if (allowlisted.has(rel)) continue;
    const raw = fs.readFileSync(abs, "utf8");
    if (!fileUsesSafeFetch(raw)) continue;
    safeFetchFilesChecked += 1;
    const source = fileHasAcceptedSafeFetchUrlSource(raw);
    if (!source.ok) {
      violations.push({ file: rel, reason: source.reason });
    }
  }

  return {
    fileCount: files.length,
    safeFetchFilesChecked,
    violationCount: violations.length,
    violations,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = analyzeOutboundDomainAllowlist();
  if (report.violationCount > 0) {
    console.error(
      JSON.stringify(
        {
          checkId: "outbound-domain-allowlist",
          ok: false,
          ...report,
          hint: "Use validateOutboundHttpUrl for dynamic URLs, or a recognized trusted source pattern such as getSupabasePublicEnv() or resolveAppBaseUrl() + allowLocalhostInDev: true. Otherwise add a reviewed path relative to src/ in scripts/outbound-domain-allowlist.txt.",
        },
        null,
        2
      )
    );
    process.exit(1);
  }
  console.log(JSON.stringify({ checkId: "outbound-domain-allowlist", ok: true, ...report }, null, 2));
}
