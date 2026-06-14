export const REQUIRED_ENV_CLASS_IDS = ["local", "test", "ci", "preview", "staging", "production"];

export const REQUIRED_ENV_DIMENSIONS = [
  "urlSignals",
  "requiredKeySignals",
  "callbackOriginPolicy",
  "cookiePolicy",
  "storageBucketPolicy",
  "providerModePolicy",
  "productionJobPolicy",
];

export const REQUIRED_FIXTURE_CONTROLS = [
  "fixture-creation",
  "fixture-teardown",
  "namespace-isolation",
  "org-isolation",
  "token-expiry",
  "file-cleanup",
  "conflict-handling",
];

export const REQUIRED_PREVIEW_CONTROLS = [
  "preview-auth-redirects",
  "preview-callback-url-integrity",
  "preview-stripe-test-mode",
  "preview-supabase-project-class",
  "preview-upstash-class",
  "preview-email-sender",
  "preview-production-jobs-disabled",
];

export const LIVE_SECRET_RE = /\b(?:sk|rk|pk)_live_[A-Za-z0-9]{12,}\b|\bwhsec_live_[A-Za-z0-9]{12,}\b/u;
const SECRET_RE = /\b(?:sk-proj-[A-Za-z0-9_-]{48,}|sk-[A-Za-z0-9]{48,}|AKIA[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9_]{36,})\b/u;
const PROD_PROVIDER_ID_RE = /\b(?:cus|sub|acct|prod|price|evt|in|pi|cs)_live_[A-Za-z0-9_]+|\b(?:cus|sub|acct|prod|evt|in|pi|cs)_[A-Za-z0-9]{14,}\b/u;

function issue(code, fields = {}) {
  return { issue: code, ...fields };
}

function uniqueSorted(values) {
  return [...new Set(values.filter((value) => value != null && value !== ""))].sort((a, b) => String(a).localeCompare(String(b)));
}

export function parseEnvFile(text) {
  const rows = [];
  const lines = text.split(/\r?\n/u);
  for (const [index, rawLine] of lines.entries()) {
    const commented = /^\s*#/u.test(rawLine);
    const match = /^\s*#?\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*)$/u.exec(rawLine);
    if (!match) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    rows.push({ key: match[1], value, line: index + 1, commented });
  }
  return rows;
}

function stripSqlComments(sql) {
  return sql
    .split(/\r?\n/u)
    .filter((line) => !/^\s*--/u.test(line))
    .join("\n");
}

function lineForIndex(raw, index) {
  return raw.slice(0, index).split(/\r?\n/u).length;
}

function isLocalOrPrivateHostname(hostname) {
  const lower = hostname.toLowerCase();
  if (lower === "localhost" || lower.endsWith(".localhost") || lower.endsWith(".local")) return true;
  if (lower === "::1" || lower === "[::1]" || lower === "0.0.0.0") return true;
  if (/^127\./u.test(lower) || /^10\./u.test(lower) || /^192\.168\./u.test(lower)) return true;
  const private172 = /^172\.(\d{1,2})\./u.exec(lower);
  return Boolean(private172 && Number(private172[1]) >= 16 && Number(private172[1]) <= 31);
}

function parseUrl(value) {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

export function classifyEnvironmentValue(value) {
  const raw = String(value ?? "").trim();
  const lower = raw.toLowerCase();
  if (!raw) return "empty";
  const url = parseUrl(raw);
  if (url && isLocalOrPrivateHostname(url.hostname)) return "local";
  if (/(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\.local\b)/u.test(lower)) return "local";
  if (/\b(?:pk|sk|rk)_live_/u.test(lower) || /\blive\b|production|prod|oblixa\.io/u.test(lower)) return "production";
  if (/\b(?:pk|sk|rk)_test_/u.test(lower) || /example\.test|example\.invalid|\btest\b|sandbox/u.test(lower)) return "test";
  if (/preview|vercel\.app|branch|pr-/u.test(lower)) return "preview";
  if (/staging|stage|canary|dast/u.test(lower)) return "staging";
  return "unknown";
}

export function classifyEnvironmentKey(key) {
  const publicKey = key.startsWith("NEXT_PUBLIC_");
  const sensitive = /(?:SECRET|TOKEN|PASSWORD|PRIVATE|SERVICE_ROLE|API_KEY|_KEY\b|HMAC|PEPPER|BEARER|DSN|PASSCODE)/u.test(key);
  const classHints = [];
  if (/(?:^|_)(?:LOCAL|DEV)(?:_|$)/u.test(key)) classHints.push("local");
  if (/(?:^|_)(?:TEST|E2E|PLAYWRIGHT|FIXTURE)(?:_|$)/u.test(key)) classHints.push("test");
  if (/(?:^|_)(?:CI|GITHUB|ACTIONS)(?:_|$)/u.test(key)) classHints.push("ci");
  if (/(?:^|_)(?:PREVIEW)(?:_|$)/u.test(key)) classHints.push("preview");
  if (/(?:^|_)(?:STAGING|DAST|CANARY)(?:_|$)/u.test(key)) classHints.push("staging");
  if (/(?:^|_)(?:PROD|PRODUCTION|RELEASE|LIVE)(?:_|$)/u.test(key)) classHints.push("production");
  return {
    key,
    public: publicKey,
    sensitive,
    classHints: uniqueSorted(classHints),
  };
}

export function syntheticEnv(base) {
  return {
    ...base,
    CRON_SECRET_PREVIOUS_EXPIRES_AT: "2030-01-01T00:00:00.000Z",
    STRIPE_WEBHOOK_SECRET_PREVIOUS_EXPIRES_AT: "2030-01-01T00:00:00.000Z",
  };
}

export function issueCodes(report) {
  return new Set((report.issues ?? []).map((row) => row.issue));
}

export function scanSeedFileSource(raw, rel, seedConfig) {
  const body = stripSqlComments(raw);
  const issues = [];
  const rows = [];
  if (!raw) {
    issues.push(issue("operational_environment_seed_file_missing", { path: rel }));
    return { issues, result: { path: rel, mutationCount: 0, uuidCount: 0, emailCount: 0, rows } };
  }

  if (SECRET_RE.test(body) || LIVE_SECRET_RE.test(body)) {
    issues.push(issue("operational_environment_seed_contains_secret_like_value", { path: rel }));
  }
  if (PROD_PROVIDER_ID_RE.test(body)) {
    issues.push(issue("operational_environment_seed_contains_provider_production_id", { path: rel }));
  }

  const allowedDomains = new Set(seedConfig.allowedEmailDomains ?? []);
  const emailMatches = [...body.matchAll(/\b[A-Z0-9._%+-]+@([A-Z0-9.-]+\.[A-Z]{2,})\b/giu)];
  for (const match of emailMatches) {
    const domain = match[1].toLowerCase();
    if (!allowedDomains.has(domain)) {
      issues.push(issue("operational_environment_seed_unapproved_email_domain", { path: rel, line: lineForIndex(body, match.index), domain }));
    }
  }

  const allowedUuidPrefixes = seedConfig.allowedUuidPrefixes ?? [];
  const uuidMatches = [...body.matchAll(/\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/giu)];
  for (const match of uuidMatches) {
    const uuid = match[0].toLowerCase();
    if (!allowedUuidPrefixes.some((prefix) => uuid.startsWith(prefix.toLowerCase()))) {
      issues.push(issue("operational_environment_seed_uuid_not_deterministic_allowlisted", { path: rel, line: lineForIndex(body, match.index), uuid }));
    }
  }

  const mutationMatches = [...body.matchAll(/\b(insert|update|delete)\b/giu)];
  const hasConflictPolicy = /\bon\s+conflict\b/iu.test(body) || mutationMatches.length === 0;
  if (mutationMatches.length > 0 && !hasConflictPolicy) {
    issues.push(issue("operational_environment_seed_mutation_missing_conflict_policy", { path: rel }));
  }
  if (/\bdelete\s+from\b/iu.test(body) && !/\bwhere\b/iu.test(body)) {
    issues.push(issue("operational_environment_seed_unbounded_delete", { path: rel }));
  }

  const markerCoverage = (seedConfig.requiredSafetyMarkers ?? []).map((marker) => ({
    marker,
    present: raw.includes(marker),
  }));
  if (mutationMatches.length > 0 && !markerCoverage.some((row) => row.marker === "on conflict" && row.present)) {
    issues.push(issue("operational_environment_seed_missing_conflict_marker", { path: rel }));
  }

  return {
    issues,
    result: {
      path: rel,
      mutationCount: mutationMatches.length,
      uuidCount: uuidMatches.length,
      emailCount: emailMatches.length,
      markerCoverage,
    },
  };
}
