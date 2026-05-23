#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const LIB_ROOT_REL = path.join("src", "lib");
const ALLOWLIST_REL = path.join("scripts", "server-lib-admin-allowlist.txt");
const SRC_ROOT_REL = "src";

const VALID_CLASSIFICATIONS = new Set([
  "session-scoped",
  "job-scoped",
  "cron-scoped",
  "provider-scoped",
  "migration-test-only",
  "intentionally-global",
  "type-only",
]);

const TENANT_TABLE_NAMES = new Set([
  "contracts",
  "contract_approvals",
  "contract_import_jobs",
  "contract_export_jobs",
  "evidence_records",
  "evidence_requirements",
  "findings",
  "integration_settings",
  "notification_deliveries",
  "notification_policies",
  "obligations",
  "organizations",
  "provider_accounts",
  "report_pack_runs",
]);

const SERVICE_ROLE_QUERY_RE = /\.from\(\s*["']([^"']+)["']\s*\)/g;
const READ_WRITE_RE = /\.(?:select|update|delete)\s*\(/;
const WRITE_RE = /\.(?:update|delete)\s*\(/;
const USER_CONTROLLED_OR_DETAIL_PREDICATE_RE = /\.eq\(\s*["'](?:id|contract_id|job_id|run_id|requirement_id|organization_id|user_id)["']/;
const ORG_PREDICATE_RE = /\.(?:eq|in)\(\s*["']organization_id["']|\.match\(\s*\{[^}]*organization_id/;
const ORG_PRIMARY_KEY_PREDICATE_RE = /\.from\(\s*["']organizations["']\s*\)[\s\S]{0,300}\.eq\(\s*["']id["']/;
const ORG_DISCOVERY_SELECT_RE = /\.select\(\s*["'][^"']*\borganization_id\b/;
const SIGNED_TOKEN_OR_MEMBERSHIP_RE = /\b(?:tokenHash|secureCompareUtf8|signed token|signedToken|getDeterministicMembership|getMembership|organization_members)\b/;

function walkLibTs(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const name of fs.readdirSync(dir)) {
    if (name.endsWith(".test.ts") || name.endsWith(".test.tsx")) continue;
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walkLibTs(p, acc);
    else if (name.endsWith(".ts") || name.endsWith(".tsx")) acc.push(p);
  }
  return acc;
}

function walkSourceTs(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walkSourceTs(p, acc);
    else if (name.endsWith(".ts") || name.endsWith(".tsx")) acc.push(p);
  }
  return acc;
}

function hasRuntimeAdminUsage(source) {
  const withoutTypeImports = source
    .replace(/import\s+type\s+\{[^}]*\bcreateAdminClient\b[^}]*\}\s+from\s+["'][^"']+["'];?\n?/gu, "")
    .replace(/import\s+type\s+\*\s+as\s+\w+\s+from\s+["'][^"']+["'];?\n?/gu, "");
  return (
    /\bcreateAdminClient\s*\(/u.test(withoutTypeImports) ||
    /\badminFactory\s*:\s*createAdminClient\b/u.test(withoutTypeImports) ||
    /=>\s*createAdminClient\s*\(/u.test(withoutTypeImports)
  );
}

function extractStatement(source, index) {
  const tail = source.slice(index);
  const semicolon = tail.indexOf(";");
  return semicolon >= 0 ? tail.slice(0, semicolon + 1) : tail.slice(0, 1000);
}

function findServiceRoleQueryViolations(rel, source) {
  const violations = [];
  for (const match of source.matchAll(SERVICE_ROLE_QUERY_RE)) {
    const table = match[1];
    if (!TENANT_TABLE_NAMES.has(table)) continue;
    const statement = extractStatement(source, match.index ?? 0);
    if (!READ_WRITE_RE.test(statement)) continue;
    if (!USER_CONTROLLED_OR_DETAIL_PREDICATE_RE.test(statement)) continue;
    if (ORG_PREDICATE_RE.test(statement)) continue;
    if (table === "organizations" && ORG_PRIMARY_KEY_PREDICATE_RE.test(statement)) continue;
    if (!WRITE_RE.test(statement) && ORG_DISCOVERY_SELECT_RE.test(statement)) continue;
    if (SIGNED_TOKEN_OR_MEMBERSHIP_RE.test(statement)) continue;
    violations.push({ issue: "service_role_query_without_org_predicate", rel, table });
  }
  return violations;
}

function isExpired(dateStr) {
  const parsed = Date.parse(dateStr);
  return Number.isNaN(parsed) || parsed < Date.now();
}

function parseKeyValueMeta(raw) {
  const matches = [...raw.matchAll(/\b([A-Za-z][A-Za-z0-9_-]*)=/gu)];
  const meta = {};
  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index];
    const key = match[1];
    const valueStart = (match.index ?? 0) + match[0].length;
    const valueEnd =
      index + 1 < matches.length ? matches[index + 1].index ?? raw.length : raw.length;
    meta[key] = raw.slice(valueStart, valueEnd).trim();
  }
  return meta;
}

function readAllowlist(root) {
  const allowlistPath = path.join(root, ALLOWLIST_REL);
  const entries = new Map();
  const violations = [];
  if (!fs.existsSync(allowlistPath)) return { entries, violations };

  let currentMeta = null;
  for (const [index, line] of fs.readFileSync(allowlistPath, "utf8").split("\n").entries()) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith("#")) {
      const match = trimmed.match(/^#\s*meta:\s*(?<body>.*)$/u);
      if (!match?.groups?.body) continue;
      const meta = parseKeyValueMeta(match.groups.body);
      if (!meta.owner || !meta.expiry || !meta.classification || !meta.reason || !meta.compensatingTest) {
        violations.push({ issue: "invalid_allowlist_metadata", line: index + 1, meta });
        currentMeta = null;
        continue;
      }
      currentMeta = {
        owner: meta.owner,
        expiry: meta.expiry,
        classification: meta.classification,
        reason: meta.reason,
        reviewedOn: meta.reviewedOn ?? meta.reviewDate ?? meta.lastReviewed ?? null,
        compensatingTest: meta.compensatingTest,
        line: index + 1,
      };
      if (!VALID_CLASSIFICATIONS.has(currentMeta.classification)) {
        violations.push({ issue: "invalid_allowlist_classification", line: currentMeta.line, classification: currentMeta.classification });
      }
      if (isExpired(currentMeta.expiry)) {
        violations.push({ issue: "expired_allowlist_metadata", line: currentMeta.line, expiry: currentMeta.expiry });
      }
      if (!fs.existsSync(path.join(root, currentMeta.compensatingTest))) {
        violations.push({ issue: "missing_compensating_test", line: currentMeta.line, compensatingTest: currentMeta.compensatingTest });
      }
      continue;
    }
    const rel = trimmed.replace(/\\/g, "/");
    if (!currentMeta) {
      violations.push({ issue: "missing_allowlist_metadata", line: index + 1, rel });
    }
    entries.set(rel, currentMeta);
    currentMeta = null;
  }
  return { entries, violations };
}

export function analyzeServerLibAdminUsage(root = ROOT) {
  const libRoot = path.join(root, LIB_ROOT_REL);
  const srcRoot = path.join(root, SRC_ROOT_REL);
  const files = walkLibTs(libRoot).sort();
  const sourceFiles = walkSourceTs(srcRoot).sort();
  const hits = [];
  for (const abs of files) {
    const content = fs.readFileSync(abs, "utf8");
    if (!hasRuntimeAdminUsage(content)) continue;
    hits.push(path.relative(root, abs).replace(/\\/g, "/"));
  }

  const allowlist = readAllowlist(root);
  const hitSet = new Set(hits);
  const violations = [...allowlist.violations];
  for (const abs of sourceFiles) {
    const content = fs.readFileSync(abs, "utf8");
    if (!/^["']use client["'];?/m.test(content)) continue;
    if (!/\bcreateAdminClient\b|@\/lib\/supabase\/server/.test(content)) continue;
    violations.push({
      issue: "client_importable_service_role_access",
      rel: path.relative(root, abs).replace(/\\/g, "/"),
    });
  }
  for (const hit of hits) {
    if (!allowlist.entries.has(hit)) {
      violations.push({ issue: "unallowlisted_create_admin_client", rel: hit });
    }
    const content = fs.readFileSync(path.join(root, hit), "utf8");
    violations.push(...findServiceRoleQueryViolations(hit, content));
  }
  for (const rel of allowlist.entries.keys()) {
    if (!hitSet.has(rel)) {
      violations.push({ issue: "stale_allowlist_entry", rel });
    }
  }

  return {
    checkId: "server-lib-admin",
    ok: violations.length === 0,
    fileCount: files.length,
    sourceFileCount: sourceFiles.length,
    hitCount: hits.length,
    hits,
    allowlistCount: allowlist.entries.size,
    violationCount: violations.length,
    violations,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = analyzeServerLibAdminUsage(ROOT);
  if (process.argv.includes("--print-hits")) {
    for (const h of report.hits) console.log(h);
    process.exit(0);
  }
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exit(1);
}
