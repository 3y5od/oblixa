#!/usr/bin/env node
/**
 * Enforce a lightweight auth contract across API route handlers.
 *
 * A route is compliant if any of:
 * - it is explicitly listed in scripts/api-route-public-allowlist.txt
 * - it matches an approved auth signal (session, cron secret/helper, webhook signature,
 *   inbound automation token, capability token, etc)
 *
 * For non-public routes, we also require an explicit deny-path signal (401/403 or
 * notFound/redirect to login) to reduce accidental auth bypasses.
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const apiRoot = path.join(root, "src", "app", "api");
const publicAllowlistPath = path.join(__dirname, "api-route-public-allowlist.txt");
const reportOnly = process.argv.includes("--report");
const strict = process.argv.includes("--strict");

function walkRoutes(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walkRoutes(p, acc);
    else if (name === "route.ts") acc.push(p);
  }
  return acc;
}

function toApiRelative(abs) {
  return path.relative(apiRoot, abs).replace(/\\/g, "/");
}

function loadPublicAllowlist() {
  if (!fs.existsSync(publicAllowlistPath)) {
    return { routes: new Set(), metadataIssues: [] };
  }
  const routes = new Set();
  const metadataIssues = [];
  let currentMeta = null;
  const metaRe =
    /^#\s*meta:\s*owner=([^\s]+)\s+expiry=(\d{4}-\d{2}-\d{2})\s+reason=(.+)$/;

  for (const [idx, line] of fs.readFileSync(publicAllowlistPath, "utf8").split("\n").entries()) {
    const t = line.trim();
    if (!t) continue;
    if (t.startsWith("#")) {
      const m = t.match(metaRe);
      if (m) {
        currentMeta = { owner: m[1], expiry: m[2], reason: m[3].trim() };
        const expiryEpoch = Date.parse(currentMeta.expiry);
        if (Number.isNaN(expiryEpoch) || expiryEpoch < Date.now()) {
          metadataIssues.push({
            line: idx + 1,
            issue: "expired_allowlist_meta",
            meta: currentMeta,
          });
        }
      }
      continue;
    }
    if (!currentMeta) {
      metadataIssues.push({
        line: idx + 1,
        issue: "missing_allowlist_meta",
        route: t.replace(/\\/g, "/"),
      });
    }
    routes.add(t.replace(/\\/g, "/"));
  }
  return { routes, metadataIssues };
}

const AUTH_SIGNALS = [
  // Session/user context
  /\bgetApiAuthContext\b/,
  /\bgetAuthContext\b/,
  /\.auth\.getUser\s*\(/,
  /\bcreateClient\s*\(/,
  /\bcreateServerClient\s*\(/,
  /\brequireV5ApiFeature\b/,
  /\brequireV6ApiFeature\b/,
  /\bcanManageCapability\b/,
  // Machine auth helpers/secrets
  /\bauthorizeCronRequest\b|\bgateCronRequest\b|\bensureCronAuthorized\b|\brequireCronAuthorized\b|\brequireV[56]CronAuth\b|\bCRON_SECRET\b/,
  /\bisInboundAutomationAuthorized\b/,
  /\bconstructEvent\b|stripe-signature/i,
  /\bparseBearerToken\b|\bx-api-key\b/i,
  /\bEXTRACTION_WORKER_SECRET\b/,
  /\bsecureCompare\w*\b/,
  // Tokenized external actions
  /\[token\]/,
];

const DENY_SIGNALS = [
  /status:\s*401\b/,
  /status:\s*403\b/,
  /status:\s*400\b/,
  /status:\s*404\b/,
  /status:\s*503\b/,
  /status:\s*429\b/,
  /\bpixelResponse\s*\(\s*429\b/,
  /\bnew\s+Response\s*\([^)]*status:\s*204/,
  /\bNextResponse\.redirect\b[\s\S]{0,200}\/login/,
  /\bnotFound\s*\(/,
  /\bunauthorized\b/i,
  /\bforbidden\b/i,
  /** Cron/service gates that return a prebuilt deny response (see `cron-route-gate`). */
  /\breturn\s+deny\b/,
  /\breturn\s+cronDenied\b/,
  /\bif\s*\(\s*auth\s*\)\s*return\s+auth\b/,
  /\breturn\s+errorResponse\b/,
  /\breturn\s+modeGate\b/,
];

const routes = walkRoutes(apiRoot).sort();
const publicAllowlist = loadPublicAllowlist();
const staleAllowlistEntries = [];
const authViolations = [];
const denyPathViolations = [];
const signalCoverage = [];

for (const abs of routes) {
  const rel = toApiRelative(abs);
  const text = fs.readFileSync(abs, "utf8");
  const isPublic = publicAllowlist.routes.has(rel);
  const pathAuthSignals = Number(rel.includes("[token]") || rel.includes("oauth/callback"));
  const authMatches = AUTH_SIGNALS.filter((re) => re.test(text)).length + pathAuthSignals;
  const denyMatches = DENY_SIGNALS.filter((re) => re.test(text)).length;
  signalCoverage.push({
    route: rel,
    publicAllowlisted: isPublic,
    authSignalCount: authMatches,
    denySignalCount: denyMatches,
  });

  if (isPublic) continue;
  if (authMatches === 0) authViolations.push(rel);
  if (strict && denyMatches === 0) denyPathViolations.push(rel);
}

for (const rel of publicAllowlist.routes) {
  const abs = path.join(apiRoot, rel);
  if (!fs.existsSync(abs)) staleAllowlistEntries.push(rel);
}

const payload = {
  totalRoutes: routes.length,
  publicAllowlistCount: publicAllowlist.routes.size,
  authViolationCount: authViolations.length,
  denyPathViolationCount: denyPathViolations.length,
  staleAllowlistCount: staleAllowlistEntries.length,
  allowlistMetadataIssueCount: publicAllowlist.metadataIssues.length,
  authViolations,
  denyPathViolations,
  staleAllowlistEntries,
  allowlistMetadataIssues: publicAllowlist.metadataIssues,
  signalCoverage,
};

console.log(JSON.stringify(payload, null, 2));

if (reportOnly) process.exit(0);
if (publicAllowlist.metadataIssues.length > 0) process.exit(1);
if (staleAllowlistEntries.length > 0) process.exit(1);
if (authViolations.length > 0) process.exit(1);
if (strict && denyPathViolations.length > 0) process.exit(1);
console.log(`OK: ${routes.length} API route(s) satisfy auth contract checks.`);
