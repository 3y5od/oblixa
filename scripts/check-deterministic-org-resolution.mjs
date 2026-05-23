#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

const SENSITIVE_ROOTS = [
  path.join("src", "actions"),
  path.join("src", "app", "api"),
  path.join("src", "lib"),
];

function walkTs(root, dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const name of fs.readdirSync(dir)) {
    const abs = path.join(dir, name);
    const stat = fs.statSync(abs);
    if (stat.isDirectory()) {
      walkTs(root, abs, acc);
      continue;
    }
    if (!/\.(?:ts|tsx)$/u.test(name)) continue;
    if (/\.(?:test|spec)\.(?:ts|tsx)$/u.test(name)) continue;
    acc.push(path.relative(root, abs).replace(/\\/g, "/"));
  }
  return acc;
}

function hasEarliestMembershipPattern(source) {
  for (const match of source.matchAll(/\.from\(\s*["']organization_members["']\s*\)/gu)) {
    const tail = source.slice(match.index ?? 0);
    const statement = tail.slice(0, Math.max(tail.indexOf(";"), 0) || 1200);
    const ordersByCreatedAt = /\.order\(\s*["']created_at["']/u.test(statement);
    const picksOne = /\.limit\(\s*1\s*\)/u.test(statement) || /\.maybeSingle\(\s*\)/u.test(statement);
    const hasExplicitOrgPredicate = /\.(?:eq|match)\(\s*(?:["']organization_id["']|\{[^}]*organization_id)/u.test(statement);
    if (ordersByCreatedAt && picksOne && !hasExplicitOrgPredicate) return true;
  }
  return false;
}

export function analyzeDeterministicOrgResolution(root = ROOT) {
  const issues = [];
  const serverRel = path.join("src", "lib", "supabase", "server.ts");
  const orgScopedRel = path.join("src", "lib", "supabase", "org-scoped-admin.ts");
  const serverText = fs.readFileSync(path.join(root, serverRel), "utf8");
  const orgScopedText = fs.readFileSync(path.join(root, orgScopedRel), "utf8");

  if (!serverText.includes("const resolution = await resolveExplicitOrSingleMembership(admin, userId)")) {
    issues.push({ issue: "legacy_membership_not_delegated_to_explicit_or_single", file: serverRel });
  }
  if (hasEarliestMembershipPattern(serverText)) {
    issues.push({ issue: "legacy_membership_uses_earliest_org_fallback", file: serverRel });
  }
  if (!serverText.includes('resolution.reason !== "organization_membership_missing"')) {
    issues.push({ issue: "ensure_membership_can_create_org_on_ambiguous_resolution", file: serverRel });
  }
  for (const marker of [
    "resolveSensitiveOrgContext",
    "getExplicitOrgIdFromInput",
    "getExplicitOrgIdFromRequestWithBody",
    "orgResolutionHttpStatus",
    "createOrgScopedAdminContext",
  ]) {
    if (!orgScopedText.includes(marker)) {
      issues.push({ issue: "missing_org_scoped_boundary_marker", file: orgScopedRel, marker });
    }
  }

  const files = SENSITIVE_ROOTS.flatMap((rel) => walkTs(root, path.join(root, rel))).sort();
  for (const rel of files) {
    if (rel === serverRel) continue;
    const text = fs.readFileSync(path.join(root, rel), "utf8");
    if (hasEarliestMembershipPattern(text)) {
      issues.push({ issue: "sensitive_code_uses_earliest_org_fallback", file: rel });
    }
  }

  return {
    checkId: "deterministic-org-resolution",
    ok: issues.length === 0,
    issueCount: issues.length,
    issues,
    scannedFileCount: files.length + 2,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = analyzeDeterministicOrgResolution(ROOT);
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exit(1);
}
