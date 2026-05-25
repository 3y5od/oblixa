#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createResult, finishWithResult } from "./lib/result.mjs";
import { nowMs } from "./lib/timing.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.join(__dirname, "..");
const DISCOVERY_ROOTS = [".github", "artifacts", "config", "scripts"];
const ALLOWLIST_FILE_RE = /(^|[-_/])allowlist(?:[-_.]|$)/iu;
const ALLOWLIST_DATA_EXT_RE = /\.(json|txt)$/iu;
const EXCLUDED_DIRS = new Set([".git", ".next", "coverage", "node_modules", "test-results"]);
const MAX_ISSUES = 160;
const WEAK_HIGH_RISK_REASON_RE =
  /\b(?:backlog|bypass|legacy|not\s+reviewed|reviewed_exception|temporary|todo|wip)\b/iu;
const TOKEN_STORAGE_SURFACE_RE =
  /\b(?:access[_-]?token|auth[_-]?token|credential|localStorage|password|refresh[_-]?token|secret|sessionStorage|token[_-]?storage)\b/iu;
const HIGH_RISK_ALLOWLIST_FILES = new Map([
  ["scripts/api-route-admin-org-scope-allowlist.txt", "route-org-scope"],
  ["scripts/api-route-public-allowlist.txt", "route-auth"],
  ["scripts/server-action-auth-contract-allowlist.txt", "server-action-auth"],
  ["scripts/server-action-org-scope-allowlist.txt", "server-action-org-scope"],
  ["scripts/server-lib-admin-allowlist.txt", "admin-client-org-scope"],
]);

function toPosix(value) {
  return String(value).replace(/\\/g, "/");
}

function relPath(root, abs) {
  return toPosix(path.relative(root, abs));
}

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (EXCLUDED_DIRS.has(entry.name)) continue;
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(abs, acc);
    } else {
      acc.push(abs);
    }
  }
  return acc;
}

function discoverAllowlistFiles(root) {
  return DISCOVERY_ROOTS.flatMap((dir) => walk(path.join(root, dir)))
    .map((abs) => ({ abs, rel: relPath(root, abs) }))
    .filter(({ rel }) => ALLOWLIST_FILE_RE.test(rel))
    .filter(({ rel }) => ALLOWLIST_DATA_EXT_RE.test(rel))
    .filter(({ rel }) => !/\.test\./u.test(rel))
    .sort((a, b) => a.rel.localeCompare(b.rel));
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

function normalizeMetadata(...candidates) {
  const merged = {};
  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) continue;
    for (const [key, value] of Object.entries(candidate)) {
      if (value === undefined || value === null || value === "") continue;
      merged[key] = value;
    }
  }
  return merged;
}

function metadataFromObject(entry, defaults = {}) {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    return normalizeMetadata(defaults);
  }
  return normalizeMetadata(defaults, entry.metadata, {
    allowBroadPattern: entry.allowBroadPattern,
    controlRationale: entry.controlRationale,
    owner: entry.owner,
    reason: entry.reason,
    reviewedOn: entry.reviewedOn,
    reviewDate: entry.reviewDate,
    lastReviewed: entry.lastReviewed,
    revisitTrigger: entry.revisitTrigger,
    expiry: entry.expiry,
    expires: entry.expires,
    expiresOn: entry.expiresOn,
    compensatingTest: entry.compensatingTest,
    compensatingTests: entry.compensatingTests,
    bundleProofTest: entry.bundleProofTest,
  });
}

function jsonLineFor(raw, value) {
  const needle = JSON.stringify(value);
  const index = raw.indexOf(needle);
  if (index < 0) return null;
  return raw.slice(0, index).split("\n").length;
}

function labelFromObject(entry) {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) return String(entry);
  return (
    entry.path ??
    entry.script ??
    entry.name ??
    entry.id ??
    entry.pattern ??
    entry.description ??
    JSON.stringify(entry)
  );
}

function parseTextAllowlist({ rel, raw }) {
  const entries = [];
  let currentMeta = null;

  for (const [index, line] of raw.split("\n").entries()) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith("#")) {
      const metaMatch = trimmed.match(/^#\s*meta:\s*(?<body>.*)$/iu);
      if (metaMatch?.groups?.body) {
        currentMeta = {
          line: index + 1,
          values: parseKeyValueMeta(metaMatch.groups.body),
          source: "text_meta",
        };
      }
      continue;
    }

    const entry = toPosix(trimmed.replace(/\s+#.*$/u, "").trim());
    if (!entry) continue;
    entries.push({
      file: rel,
      entry,
      line: index + 1,
      metadataLine: currentMeta?.line ?? null,
      metadata: currentMeta?.values ?? null,
      metadataSource: currentMeta?.source ?? null,
      raw: { entry },
    });
  }

  return entries;
}

function pushJsonEntry(entries, { rel, raw, label, metadata, rawEntry, line }) {
  entries.push({
    file: rel,
    entry: String(label),
    line: line ?? jsonLineFor(raw, label),
    metadata,
    metadataLine: null,
    metadataSource: "json",
    raw: rawEntry,
  });
}

function parseJsonAllowlist({ rel, raw }) {
  const parsed = JSON.parse(raw);
  const entries = [];
  const defaults = normalizeMetadata(parsed.metadataDefaults, parsed.metadata);

  if (Array.isArray(parsed.entries)) {
    for (const entry of parsed.entries) {
      const label = labelFromObject(entry);
      pushJsonEntry(entries, {
        rel,
        raw,
        label,
        rawEntry: entry,
        metadata: metadataFromObject(entry, defaults),
      });
    }
  }

  if (Array.isArray(parsed.families)) {
    for (const family of parsed.families) {
      pushJsonEntry(entries, {
        rel,
        raw,
        label: family,
        rawEntry: { family },
        metadata: normalizeMetadata(defaults, parsed.metadataByFamily?.[family]),
      });
    }
  }

  if (Array.isArray(parsed.metricNames)) {
    for (const metric of parsed.metricNames) {
      pushJsonEntry(entries, {
        rel,
        raw,
        label: metric,
        rawEntry: { metricName: metric },
        metadata: normalizeMetadata(defaults, parsed.metadataByMetric?.[metric]),
      });
    }
  }

  if (Array.isArray(parsed.scripts)) {
    for (const script of parsed.scripts) {
      pushJsonEntry(entries, {
        rel,
        raw,
        label: script,
        rawEntry: { script },
        metadata: normalizeMetadata(defaults, parsed.metadataByScript?.[script]),
      });
    }
  }

  if (Array.isArray(parsed.allowlists)) {
    for (const allowlist of parsed.allowlists) {
      const allowlistMeta = normalizeMetadata(defaults, allowlist.metadata);
      const paths = Array.isArray(allowlist.paths) ? allowlist.paths : [];
      for (const pathEntry of paths) {
        pushJsonEntry(entries, {
          rel,
          raw,
          label: pathEntry,
          rawEntry: { path: pathEntry, description: allowlist.description },
          metadata: allowlistMeta,
        });
      }
    }
  }

  return entries;
}

function parseAllowlistFile(root, file) {
  const raw = fs.readFileSync(file.abs, "utf8");
  if (file.rel.endsWith(".json")) {
    return parseJsonAllowlist({ rel: file.rel, raw, root });
  }
  return parseTextAllowlist({ rel: file.rel, raw, root });
}

function expiryValue(meta) {
  return meta?.expiry ?? meta?.expiresOn ?? meta?.expires ?? null;
}

function reviewDateValue(meta) {
  return meta?.reviewedOn ?? meta?.reviewDate ?? meta?.lastReviewed ?? null;
}

function revisitTriggerValue(meta) {
  return meta?.revisitTrigger ?? meta?.revisit ?? null;
}

function compensatingTests(meta) {
  const value = meta?.compensatingTests ?? meta?.compensatingTest ?? meta?.bundleProofTest ?? null;
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value !== "string") return [];
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function isValidIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(String(value ?? ""))) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function isTruthyMetadata(value) {
  return value === true || String(value ?? "").toLowerCase() === "true";
}

function hasControlRationale(meta, { requireExplicit = false } = {}) {
  const value = requireExplicit ? meta?.controlRationale : meta?.controlRationale ?? meta?.reason;
  return typeof value === "string" && value.trim().length >= 12;
}

function isBroadAllowlistEntry(entry) {
  const value = String(entry.entry ?? "").trim();
  if (!value) return false;
  if (/^(?:\.?\/)?(?:src|app|scripts|e2e|artifacts|config|public)\/?$/iu.test(value)) return true;
  if (/(?:^|\/)\*\*(?:\/|$)|(?:^|\/)\*(?:\/|$)|\.\*|\[[^\]/]+-[^\]/]+\]|\?/.test(value)) {
    return true;
  }
  if (/^\^|[^\\]\$$|\\\./u.test(value)) return true;
  return false;
}

function highRiskCategory(entry) {
  const direct = HIGH_RISK_ALLOWLIST_FILES.get(entry.file);
  if (direct) return direct;
  const combined = `${entry.file} ${entry.entry}`;
  if (TOKEN_STORAGE_SURFACE_RE.test(combined)) return "token-storage";
  return null;
}

function testExists(root, file, meta, testRel) {
  const candidates = [path.join(root, testRel)];
  if (meta?.bundleProofTest === testRel) {
    candidates.push(path.join(root, "src", testRel));
  }
  if (file === "scripts/api-route-test-allowlist.txt") {
    candidates.push(path.join(root, "src", testRel));
  }
  return candidates.some((candidate) => fs.existsSync(candidate));
}

function validateEntryMetadata(root, today, entry) {
  const issues = [];
  const meta = entry.metadata;
  const location = {
    file: entry.file,
    entry: entry.entry,
    line: entry.line,
    metadataLine: entry.metadataLine,
  };

  if (!meta || Object.keys(meta).length === 0) {
    return [{ issue: "missing_allowlist_metadata", ...location }];
  }

  if (typeof meta.owner !== "string" || meta.owner.trim().length < 2) {
    issues.push({ issue: "missing_allowlist_owner", ...location });
  }
  if (typeof meta.reason !== "string" || meta.reason.trim().length < 8) {
    issues.push({ issue: "missing_allowlist_reason", ...location });
  }

  const reviewDate = reviewDateValue(meta);
  if (!isValidIsoDate(reviewDate)) {
    issues.push({ issue: "invalid_allowlist_review_date", reviewDate, ...location });
  } else if (reviewDate > today) {
    issues.push({ issue: "future_allowlist_review_date", reviewDate, ...location });
  }

  const expiry = expiryValue(meta);
  const revisitTrigger = revisitTriggerValue(meta);
  if (!expiry && (typeof revisitTrigger !== "string" || revisitTrigger.trim().length < 12)) {
    issues.push({ issue: "missing_allowlist_expiry_or_revisit_trigger", ...location });
  } else if (expiry && !isValidIsoDate(expiry)) {
    issues.push({ issue: "invalid_allowlist_expiry", expiry, ...location });
  } else if (expiry && expiry < today) {
    issues.push({ issue: "expired_allowlist_entry", expiry, ...location });
  } else if (isValidIsoDate(reviewDate) && expiry && expiry < reviewDate) {
    issues.push({ issue: "invalid_allowlist_review_window", reviewDate, expiry, ...location });
  }

  const tests = compensatingTests(meta);
  if (tests.length === 0) {
    issues.push({ issue: "missing_allowlist_compensating_test", ...location });
  } else {
    for (const testRel of tests) {
      if (!testExists(root, entry.file, meta, testRel)) {
        issues.push({
          issue: "missing_allowlist_compensating_test_file",
          compensatingTest: testRel,
          ...location,
        });
      }
    }
  }

  if (isBroadAllowlistEntry(entry)) {
    if (!isTruthyMetadata(meta.allowBroadPattern)) {
      issues.push({ issue: "broad_allowlist_pattern_without_explicit_approval", ...location });
    }
    if (!hasControlRationale(meta, { requireExplicit: true })) {
      issues.push({ issue: "broad_allowlist_pattern_without_control_rationale", ...location });
    }
  }

  const highRisk = highRiskCategory(entry);
  if (highRisk) {
    if (isBroadAllowlistEntry(entry)) {
      issues.push({ issue: "p0_allowlist_entry_must_be_path_specific", category: highRisk, ...location });
    }
    if (!hasControlRationale(meta)) {
      issues.push({ issue: "missing_p0_allowlist_control_rationale", category: highRisk, ...location });
    }
    if (WEAK_HIGH_RISK_REASON_RE.test(String(meta.reason ?? ""))) {
      issues.push({ issue: "weak_p0_allowlist_reason", category: highRisk, ...location });
    }
  }

  return issues;
}

function readIfExists(root, rel) {
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) return null;
  return fs.readFileSync(abs, "utf8");
}

function staleTextEntryIssue(root, entry) {
  const value = entry.entry;

  if (entry.file === "scripts/api-route-test-allowlist.txt") {
    const routeAbs = path.join(root, "src", "app", "api", value);
    const routeTest = path.join(path.dirname(routeAbs), "route.test.ts");
    if (fs.existsSync(routeTest)) return "stale_allowlist_entry_has_colocated_route_test";
    return null;
  }

  if (entry.file === "scripts/api-route-public-allowlist.txt") {
    const routeAbs = path.join(root, "src", "app", "api", value);
    if (!fs.existsSync(routeAbs)) return "stale_allowlist_entry_missing_route";
    return null;
  }

  if (entry.file === "scripts/api-route-admin-org-scope-allowlist.txt") {
    const routeRel = path.join("src", "app", "api", value);
    const text = readIfExists(root, routeRel);
    if (text === null) return "stale_allowlist_entry_missing_route";
    if (!/\bcreateAdminClient\b/u.test(text)) return "stale_allowlist_entry_no_admin_client";
    return null;
  }

  if (entry.file === "scripts/api-route-rate-limit-allowlist.txt") {
    const routeRel = path.join("src", "app", "api", value);
    const text = readIfExists(root, routeRel);
    if (text === null) return "stale_allowlist_entry_missing_route";
    if (/\brateLimitCheck\b|\bwith(?:V6)?CronRoute\b|\brunCronRoute\b/u.test(text)) {
      return "stale_allowlist_entry_now_rate_limited";
    }
    return null;
  }

  if (entry.file === "scripts/dangerously-set-inner-html-allowlist.txt") {
    const text = readIfExists(root, value);
    if (text === null) return "stale_allowlist_entry_missing_file";
    if (!/\bdangerouslySetInnerHTML\s*=/u.test(text)) return "stale_allowlist_entry_no_dangerous_html";
    return null;
  }

  if (entry.file === "scripts/pwa-well-known-allowlist.txt") {
    if (!fs.existsSync(path.join(root, value))) return "stale_allowlist_entry_missing_file";
    return null;
  }

  if (entry.file === "scripts/scheduled-cron-route-wrapper-allowlist.txt") {
    const routeRel = path.join("src", "app", "api", value);
    const text = readIfExists(root, routeRel);
    if (text === null) return "stale_allowlist_entry_missing_route";
    if (/\bwithCronRoute\b|\bwithV6CronRoute\b|\brunCronRoute\b/u.test(text)) {
      return "stale_allowlist_entry_now_wrapped";
    }
    return null;
  }

  if (entry.file === "scripts/security-static-audit-allowlist.txt") {
    if (!fs.existsSync(path.join(root, value))) return "stale_allowlist_entry_missing_file";
    return null;
  }

  if (entry.file === "scripts/performance-static-audit-allowlist.txt") {
    if (!fs.existsSync(path.join(root, value))) return "stale_allowlist_entry_missing_file";
    return null;
  }

  if (entry.file === "scripts/server-action-auth-contract-allowlist.txt") {
    if (!fs.existsSync(path.join(root, value))) return "stale_allowlist_entry_missing_file";
    return null;
  }

  if (entry.file === "scripts/server-action-org-scope-allowlist.txt") {
    if (!fs.existsSync(path.join(root, value))) return "stale_allowlist_entry_missing_file";
    return null;
  }

  if (entry.file === "scripts/server-lib-admin-allowlist.txt") {
    const text = readIfExists(root, value);
    if (text === null) return "stale_allowlist_entry_missing_file";
    if (!/\bcreateAdminClient\b/u.test(text)) return "stale_allowlist_entry_no_admin_client";
    return null;
  }

  if (entry.file === "scripts/compatibility-href-audit-allowlist.txt") {
    if (!fs.existsSync(path.join(root, value))) return "stale_allowlist_entry_missing_file";
    return null;
  }

  return null;
}

function staleJsonEntryIssue(root, entry) {
  if (entry.file === "artifacts/supply-chain-install-script-allowlist.json") {
    const lockPath = path.join(root, "package-lock.json");
    if (!fs.existsSync(lockPath)) return null;
    const lockfile = JSON.parse(fs.readFileSync(lockPath, "utf8"));
    const packagePath = entry.raw?.path ?? entry.entry;
    if (!lockfile.packages?.[packagePath]) return "stale_allowlist_entry_missing_lockfile_package";
    return null;
  }

  if (entry.file === "config/qa-tier-coverage-allowlist.json") {
    const packagePath = path.join(root, "package.json");
    if (!fs.existsSync(packagePath)) return null;
    const pkg = JSON.parse(fs.readFileSync(packagePath, "utf8"));
    if (!pkg.scripts?.[entry.entry]) return "stale_allowlist_entry_missing_package_script";
    return null;
  }

  if (entry.file === "artifacts/assurance/gitleaks-allowlist-inventory.json") {
    const configPath = path.join(root, ".gitleaks.toml");
    if (!fs.existsSync(configPath)) return null;
    const config = fs.readFileSync(configPath, "utf8");
    if (!config.includes(`'''${entry.entry}'''`)) return "stale_allowlist_entry_missing_gitleaks_config_path";
    return null;
  }

  if (entry.file === "artifacts/assurance/api-problem-json-allowlist.json") {
    if (!fs.existsSync(path.join(root, entry.entry))) return "stale_allowlist_entry_missing_route";
    return null;
  }

  return null;
}

function staleEntryIssue(root, entry) {
  if (entry.file.endsWith(".json")) return staleJsonEntryIssue(root, entry);
  return staleTextEntryIssue(root, entry);
}

export function analyzeAllowlistMetadata(root = DEFAULT_ROOT, options = {}) {
  const now = options.now instanceof Date ? options.now : new Date();
  const today = now.toISOString().slice(0, 10);
  const files = discoverAllowlistFiles(root);
  const issues = [];
  const countsByFile = [];
  let entryCount = 0;

  for (const file of files) {
    let entries = [];
    try {
      entries = parseAllowlistFile(root, file);
    } catch (error) {
      issues.push({
        issue: "unparseable_allowlist_file",
        file: file.rel,
        message: error instanceof Error ? error.message : String(error),
      });
      countsByFile.push({ file: file.rel, entryCount: 0 });
      continue;
    }

    entryCount += entries.length;
    countsByFile.push({ file: file.rel, entryCount: entries.length });

    for (const entry of entries) {
      issues.push(...validateEntryMetadata(root, today, entry));
      const staleIssue = staleEntryIssue(root, entry);
      if (staleIssue) {
        issues.push({
          issue: staleIssue,
          file: entry.file,
          entry: entry.entry,
          line: entry.line,
        });
      }
    }
  }

  const metadataIssues = issues.filter((issue) =>
    [
      "broad_allowlist_pattern_without_control_rationale",
      "broad_allowlist_pattern_without_explicit_approval",
      "future_allowlist_review_date",
      "missing_allowlist_metadata",
      "missing_allowlist_owner",
      "missing_allowlist_reason",
      "missing_allowlist_expiry_or_revisit_trigger",
      "invalid_allowlist_expiry",
      "invalid_allowlist_review_date",
      "invalid_allowlist_review_window",
      "missing_allowlist_compensating_test",
      "missing_allowlist_compensating_test_file",
      "missing_p0_allowlist_control_rationale",
      "p0_allowlist_entry_must_be_path_specific",
      "weak_p0_allowlist_reason",
      "unparseable_allowlist_file",
    ].includes(issue.issue)
  );
  const reviewMetadataIssues = issues.filter((issue) =>
    [
      "future_allowlist_review_date",
      "invalid_allowlist_review_date",
      "invalid_allowlist_review_window",
      "missing_allowlist_expiry_or_revisit_trigger",
    ].includes(issue.issue)
  );
  const broadPatternIssues = issues.filter((issue) => issue.issue.startsWith("broad_allowlist_pattern"));
  const highRiskBypassIssues = issues.filter((issue) =>
    [
      "missing_p0_allowlist_control_rationale",
      "p0_allowlist_entry_must_be_path_specific",
      "weak_p0_allowlist_reason",
    ].includes(issue.issue)
  );
  const expiredEntries = issues.filter((issue) => issue.issue === "expired_allowlist_entry");
  const staleEntries = issues.filter((issue) => issue.issue.startsWith("stale_allowlist_entry"));

  return {
    checkId: "allowlist-metadata",
    ok: issues.length === 0,
    allowlistFileCount: files.length,
    entryCount,
    metadataIssueCount: metadataIssues.length,
    reviewMetadataIssueCount: reviewMetadataIssues.length,
    broadPatternIssueCount: broadPatternIssues.length,
    highRiskBypassIssueCount: highRiskBypassIssues.length,
    expiredEntryCount: expiredEntries.length,
    staleEntryCount: staleEntries.length,
    countsByFile,
    issueCount: issues.length,
    issues: issues.slice(0, options.maxIssues ?? MAX_ISSUES),
    truncatedIssueCount: Math.max(0, issues.length - (options.maxIssues ?? MAX_ISSUES)),
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const startMs = nowMs();
  const report = analyzeAllowlistMetadata();
  if (process.argv.includes("--report")) {
    console.log(JSON.stringify(report, null, 2));
    process.exit(0);
  }
  finishWithResult(
    createResult({
      checkId: "allowlist-metadata",
      ok: report.ok,
      strict: true,
      errors: report.ok
        ? []
        : [
            `${report.issueCount} allowlist metadata issue(s): ${report.metadataIssueCount} metadata, ${report.expiredEntryCount} expired, ${report.staleEntryCount} stale`,
          ],
      meta: report,
      startMs,
    })
  );
}
