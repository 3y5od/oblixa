#!/usr/bin/env node
/**
 * Server actions:
 * 1) "use server" modules must reference Supabase auth or admin (prevents empty auth story).
 * 2) Actions that read organizationId from FormData must also verify org membership (not client trust alone).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const actionsDir = path.join(root, "src", "actions");

const AUTH_SIGNALS = [
  "createClient(",
  "createAdminClient(",
  "getAuthContext",
  "getApiAuthContext",
  "getUser(",
  "getSession(",
];

const ORG_MEMBERSHIP_SIGNALS = [
  "verifyOrgMembership(",
  "getDeterministicMembership(",
  'from("organization_members")',
  "from('organization_members')",
  "assertOrgMembership(",
  "requireOrgAdmin(",
];

const ORG_FORM_PATTERNS = [
  /formData\.get\(\s*["']organizationId["']\s*\)/,
  /formData\.get\(\s*["']orgId["']\s*\)/,
];

function walk(dir, acc = []) {
  for (const name of fs.readdirSync(dir)) {
    if (name.endsWith(".test.ts") || name.endsWith(".test.tsx")) continue;
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p, acc);
    else if (name.endsWith(".ts")) acc.push(p);
  }
  return acc;
}

const files = walk(actionsDir);
const violations = [];
const orgViolations = [];

for (const abs of files) {
  const raw = fs.readFileSync(abs, "utf8");
  if (!raw.includes('"use server"') && !raw.includes("'use server'")) continue;
  if (!AUTH_SIGNALS.some((s) => raw.includes(s))) {
    violations.push(path.relative(root, abs).replace(/\\/g, "/"));
  }
  if (ORG_FORM_PATTERNS.some((re) => re.test(raw)) && !ORG_MEMBERSHIP_SIGNALS.some((s) => raw.includes(s))) {
    orgViolations.push(path.relative(root, abs).replace(/\\/g, "/"));
  }
}

if (violations.length || orgViolations.length) {
  console.error(
    JSON.stringify(
      {
        ok: false,
        violations,
        orgScopeViolations: orgViolations,
        detail:
          "Each server action must reference auth helpers; org-scoped FormData actions must query organization_members or verifyOrgMembership.",
      },
      null,
      2
    )
  );
  process.exit(1);
}
console.log(JSON.stringify({ ok: true, filesChecked: files.length }, null, 2));
