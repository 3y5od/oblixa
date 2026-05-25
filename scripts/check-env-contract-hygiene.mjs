#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.join(__dirname, "..");
const ENV_EXAMPLE_REL = ".env.example";
const ENV_ALLOWLIST_REL = "scripts/env-example-parity-allowlist.txt";
const REQUIRED_PACKAGE_SCRIPTS = [
  "check:env-example-parity",
  "check:env-matrix",
  "check:security-env-contract",
  "check:secrets-env-token-quality",
  "check:static-secret-safety",
];
const SENSITIVE_KEY_RE =
  /(?:SECRET|TOKEN|PASSWORD|PRIVATE|SERVICE_ROLE|API_KEY|_KEY\b|HMAC|PEPPER|BEARER|CLIENT_SECRET|ENCRYPTION_KEY|DSN|PASSCODE)/iu;
const LOCAL_KEY_RE = /(?:^|_)(?:LOCAL|DEV|TEST|E2E|PLAYWRIGHT|FIXTURE|MOCK|STUB)(?:_|$)/iu;
const CI_KEY_RE = /(?:^|_)(?:CI|GITHUB|ACTIONS|PLAYWRIGHT|E2E|TEST)(?:_|$)/iu;
const STAGING_KEY_RE = /(?:^|_)(?:STAGING|DAST|CANARY|PREVIEW)(?:_|$)/iu;
const PUBLIC_SAFE_KEYS = new Set([
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_POSTHOG_KEY",
  "NEXT_PUBLIC_SENTRY_DSN",
  "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SITE_URL",
]);

function toPosix(value) {
  return String(value ?? "").replace(/\\/g, "/");
}

function sortedUnique(values) {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}

function read(root, rel) {
  return fs.existsSync(path.join(root, rel)) ? fs.readFileSync(path.join(root, rel), "utf8") : "";
}

function parseEnvExample(text) {
  const entries = [];
  for (const [offset, line] of text.split(/\r?\n/u).entries()) {
    const match = /^\s*#?\s*([A-Z][A-Z0-9_]*)\s*=(.*)$/u.exec(line);
    if (!match) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    entries.push({ key: match[1], value, line: offset + 1 });
  }
  return entries;
}

function walkSourceFiles(root, dirs = ["src"]) {
  const out = [];
  const skip = new Set([".git", ".next", "coverage", "node_modules", "playwright-report", "test-results"]);
  function walk(absDir) {
    if (!fs.existsSync(absDir)) return;
    for (const name of fs.readdirSync(absDir)) {
      if (skip.has(name)) continue;
      const abs = path.join(absDir, name);
      const stat = fs.statSync(abs);
      if (stat.isDirectory()) {
        walk(abs);
      } else if (/\.(?:cjs|js|jsx|mjs|ts|tsx)$/iu.test(name)) {
        out.push(toPosix(path.relative(root, abs)));
      }
    }
  }
  for (const dir of dirs) walk(path.join(root, dir));
  return out.sort((a, b) => a.localeCompare(b));
}

function collectProcessEnvRefs(root) {
  const refs = new Map();
  const envRefRe = /\bprocess\.env\.([A-Z][A-Z0-9_]*)\b/gu;
  for (const rel of walkSourceFiles(root)) {
    const text = read(root, rel);
    let match;
    while ((match = envRefRe.exec(text)) !== null) {
      const key = match[1];
      const entry = refs.get(key) ?? { key, files: new Set() };
      entry.files.add(rel);
      refs.set(key, entry);
    }
  }
  return [...refs.values()]
    .map((entry) => ({ key: entry.key, files: [...entry.files].sort((a, b) => a.localeCompare(b)) }))
    .sort((a, b) => a.key.localeCompare(b.key));
}

function classifyEnvKey(key) {
  const isPublic = key.startsWith("NEXT_PUBLIC_");
  const sensitive = SENSITIVE_KEY_RE.test(key);
  const localOnly = LOCAL_KEY_RE.test(key);
  const ciOnly = CI_KEY_RE.test(key);
  const staging = STAGING_KEY_RE.test(key);
  const productionSecret = sensitive && !isPublic && !localOnly && !ciOnly;
  return {
    key,
    publicExposure: isPublic,
    publicExposureSafe: !isPublic || PUBLIC_SAFE_KEYS.has(key),
    sensitive,
    localOnly,
    ciOnly,
    staging,
    productionSecret,
  };
}

function readPackageScripts(root) {
  try {
    return JSON.parse(read(root, "package.json")).scripts ?? {};
  } catch {
    return {};
  }
}

function readEnvAllowlist(root) {
  return new Set(
    read(root, ENV_ALLOWLIST_REL)
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#")),
  );
}

export function analyzeEnvContractHygiene(root = DEFAULT_ROOT, options = {}) {
  const envEntries = parseEnvExample(read(root, ENV_EXAMPLE_REL));
  const envKeys = sortedUnique(envEntries.map((entry) => entry.key));
  const processEnvRefs = collectProcessEnvRefs(root);
  const envAllowlist = readEnvAllowlist(root);
  const allKeys = sortedUnique([...envKeys, ...processEnvRefs.map((entry) => entry.key)]);
  const classifications = allKeys.map(classifyEnvKey);
  const scripts = options.packageScripts ?? readPackageScripts(root);
  const issues = [];

  if (envEntries.length === 0) {
    issues.push({ issue: "env_example_missing_or_empty", path: ENV_EXAMPLE_REL });
  }

  for (const script of REQUIRED_PACKAGE_SCRIPTS) {
    if (typeof scripts[script] !== "string" || scripts[script].trim() === "") {
      issues.push({ issue: "missing_package_script", script });
    }
  }

  for (const classification of classifications) {
    if (classification.publicExposure && classification.sensitive && !classification.publicExposureSafe) {
      issues.push({ issue: "next_public_key_looks_sensitive", key: classification.key });
    }
  }

  for (const entry of envEntries) {
    const classification = classifyEnvKey(entry.key);
    if (classification.productionSecret && entry.value.trim() !== "") {
      issues.push({ issue: "production_secret_env_example_value_must_be_empty", path: ENV_EXAMPLE_REL, line: entry.line, key: entry.key });
    }
  }

  const documented = new Set(envKeys);
  for (const ref of processEnvRefs) {
    if (!documented.has(ref.key) && !envAllowlist.has(ref.key)) {
      issues.push({ issue: "process_env_reference_missing_from_env_example", key: ref.key, files: ref.files.slice(0, 5) });
    }
  }

  return {
    checkId: "env-contract-hygiene",
    ok: issues.length === 0,
    summary: `${allKeys.length} env key(s) classified without reading local env files.`,
    counts: {
      envExampleKeys: envKeys.length,
      processEnvReferencedKeys: processEnvRefs.length,
      publicKeys: classifications.filter((entry) => entry.publicExposure).length,
      sensitiveKeys: classifications.filter((entry) => entry.sensitive).length,
      productionSecretKeys: classifications.filter((entry) => entry.productionSecret).length,
      localOnlyKeys: classifications.filter((entry) => entry.localOnly).length,
      ciOnlyKeys: classifications.filter((entry) => entry.ciOnly).length,
      stagingKeys: classifications.filter((entry) => entry.staging).length,
    },
    classifications,
    processEnvRefs,
    artifacts: [ENV_EXAMPLE_REL, ENV_ALLOWLIST_REL, "package.json"],
    issueCount: issues.length,
    issues,
  };
}

function parseArgs(argv) {
  const options = { root: DEFAULT_ROOT, report: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--root") {
      options.root = path.resolve(argv[index + 1] ?? "");
      index += 1;
    } else if (arg.startsWith("--root=")) {
      options.root = path.resolve(arg.slice("--root=".length));
    } else if (arg === "--report") {
      options.report = true;
    }
  }
  return options;
}

export function runEnvContractHygiene(options = parseArgs(process.argv.slice(2))) {
  const report = analyzeEnvContractHygiene(options.root);
  console.log(
    JSON.stringify(
      options.report
        ? report
        : {
            checkId: report.checkId,
            ok: report.ok,
            summary: report.summary,
            counts: report.counts,
            artifacts: report.artifacts,
            issueCount: report.issueCount,
            issues: report.issues,
          },
      null,
      2,
    ),
  );
  if (!report.ok && !options.report) process.exitCode = 1;
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runEnvContractHygiene();
}
