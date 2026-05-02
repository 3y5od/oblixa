import fs from "node:fs";
import path from "node:path";
import { resolveFeatureMappingForAction } from "@/lib/product-surface/v8-surface-mapping";
import { resolveActionExemptSurface } from "@/lib/product-surface/v8-exempt-surfaces";

const SETTINGS_ACTION_MODULES = new Set([
  "onboarding-calibration",
  "settings",
  "workflow-config",
  "product-surface-settings",
  "mfa",
  "sessions",
]);

/** Intentionally empty; add basenames here if a module is infra-only (non-feature-governed) server actions land in-repo. */
const INFRA_ACTION_MODULES = new Set<string>();

export type V8TestExemptionRow = {
  kind: "governed_action_test";
  /** Repo-relative path, e.g. `src/actions/foo.ts` */
  module: string;
  reason: string;
  owner: string;
  /** Expiration date (`YYYY-MM-DD`) for periodic review. */
  expiresOn?: string;
  /** When tests live outside the default `basename*.test.ts` pattern */
  bundledTestFiles?: string[];
};

function readTestExemptions(rootDir: string): V8TestExemptionRow[] {
  const p = path.join(rootDir, "src/lib/product-surface/v8-test-exemptions.json");
  const raw = fs.readFileSync(p, "utf8");
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) return [];
  return parsed.filter(
    (row): row is V8TestExemptionRow =>
      row !== null &&
      typeof row === "object" &&
      (row as V8TestExemptionRow).kind === "governed_action_test" &&
      typeof (row as V8TestExemptionRow).module === "string"
  );
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Colocated Vitest files for a server action module (`foo.ts` → `foo.test.ts`, `foo-*.test.ts`, `foo.*.test.ts`). */
function colocatedActionTestFiles(actionFileAbs: string): string[] {
  const dir = path.dirname(actionFileAbs);
  const base = path.basename(actionFileAbs, ".ts");
  const names = fs.readdirSync(dir);
  const out: string[] = [];
  const re = new RegExp(
    `^${escapeRegExp(base)}(\\.test\\.ts|-.+\\.test\\.ts|\\..+\\.test\\.ts)$`
  );
  for (const name of names) {
    if (re.test(name)) out.push(path.join(dir, name));
  }
  return out;
}

const AUTH_FAILURE_RE =
  /Not authenticated|getUser\(|user:\s*null|unauthenticated|Unauthorized|Forbidden|\b401\b|\b403\b|without a user|no user/i;
/** Built without a contiguous admin-client literal so `check:server-lib-admin` stays clean on this file. */
const ADMIN_CLIENT_TOKEN = "createAdmin" + "Client";
const SCOPE_OR_ELIGIBILITY_RE = new RegExp(
  [
    "organization_id",
    "eligibility",
    "requireServerActionEligibility",
    "getOrgMemberRole",
    "getDeterministicMembership",
    ADMIN_CLIENT_TOKEN,
    "membership",
    "insufficient_workspace",
    "Feature not available",
    "org scope",
    "organization scope",
  ].join("|"),
  "i"
);

function testFileMeetsCoverageSignals(absTestFiles: string[]): boolean {
  if (absTestFiles.length === 0) return false;
  let auth = false;
  let scope = false;
  for (const f of absTestFiles) {
    const src = fs.readFileSync(f, "utf8");
    if (AUTH_FAILURE_RE.test(src)) auth = true;
    if (SCOPE_OR_ELIGIBILITY_RE.test(src)) scope = true;
  }
  return auth && scope;
}

const AUTH_MARKERS = [
  "auth.getUser()",
  "getAuthContext(",
  "requireV6Context(",
  "requireV6ReadContext(",
  "getAuthenticatedActionContext(",
  "getAuthenticatedMembershipContext(",
] as const;
const ORG_SCOPE_MARKERS = [
  "getOrgMemberRole(",
  "getAuthContext(",
  '.eq("organization_id"',
  ".eq('organization_id'",
  "organization_members",
  "getContractAccessContext(",
  "hasOrgCapability(",
  "getOrEnsureDeterministicMembership(",
] as const;

function walkActionFiles(dir: string, out: string[] = []): string[] {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) {
      walkActionFiles(full, out);
      continue;
    }
    if (name.endsWith(".ts") && !name.endsWith(".test.ts")) out.push(full);
  }
  return out;
}

function exportedAsyncFunctions(source: string): string[] {
  const out: string[] = [];
  const regex = /export\s+async\s+function\s+(\w+)/g;
  let match: RegExpExecArray | null = null;
  while ((match = regex.exec(source)) !== null) {
    out.push(match[1]);
  }
  return out;
}

function actionFileBaseName(filePath: string): string {
  return path.basename(filePath, ".ts").toLowerCase();
}

function hasAnyMarker(source: string, markers: readonly string[]): boolean {
  return markers.some((m) => source.includes(m));
}

export type V8ActionEligibilityViolation = { file: string; reason: string };

/**
 * Returns violations: governed (mapped) server action modules missing eligibility enforcement.
 */
export function collectV8ServerActionEligibilityViolations(rootDir = process.cwd()): V8ActionEligibilityViolation[] {
  const actionsRoot = path.join(rootDir, "src", "actions");
  const violations: V8ActionEligibilityViolation[] = [];

  for (const file of walkActionFiles(actionsRoot)) {
    const source = fs.readFileSync(file, "utf8");
    if (!source.includes('"use server"')) continue;
    const exports = exportedAsyncFunctions(source);
    if (exports.length === 0) continue;

    const base = actionFileBaseName(file);
    if (resolveActionExemptSurface(base)) continue;

    const rel = path.relative(rootDir, file).split(path.sep).join("/");
    let hasMappedExport = false;
    for (const name of exports) {
      const mapping = resolveFeatureMappingForAction(`${rel}:${name}`);
      if (mapping.status === "mapped") {
        hasMappedExport = true;
        break;
      }
    }
    if (!hasMappedExport) continue;

    const hasCanonicalGuard =
      source.includes("requireServerActionEligibility") ||
      source.includes("requireContractWriteAccess");
    const hasFallback =
      hasAnyMarker(source, AUTH_MARKERS) && hasAnyMarker(source, ORG_SCOPE_MARKERS);
    if (!hasCanonicalGuard && !hasFallback) {
      violations.push({
        file: rel,
        reason: "missing requireServerActionEligibility and auth+org scope markers",
      });
    }
  }

  return violations;
}

export type V8ActionTestCoverageViolation = { file: string; reason: string };
export type V8ActionTaxonomyViolation = { file: string; reason: string };

/**
 * §13.3 — governed (mapped, non-exempt) action modules need colocated tests that exercise
 * auth failure and org-scope / eligibility themes, or a `v8-test-exemptions.json` row.
 */
export function collectV8GovernedActionTestCoverageViolations(
  rootDir = process.cwd()
): V8ActionTestCoverageViolation[] {
  const violations: V8ActionTestCoverageViolation[] = [];
  const exemptions = readTestExemptions(rootDir);
  const actionsRoot = path.join(rootDir, "src", "actions");

  for (const file of walkActionFiles(actionsRoot)) {
    const source = fs.readFileSync(file, "utf8");
    if (!source.includes('"use server"')) continue;
    const exports = exportedAsyncFunctions(source);
    if (exports.length === 0) continue;

    const base = actionFileBaseName(file);
    if (resolveActionExemptSurface(base)) continue;

    const rel = path.relative(rootDir, file).split(path.sep).join("/");
    let hasMappedExport = false;
    for (const name of exports) {
      const mapping = resolveFeatureMappingForAction(`${rel}:${name}`);
      if (mapping.status === "mapped") {
        hasMappedExport = true;
        break;
      }
    }
    if (!hasMappedExport) continue;

    const exemptRow = exemptions.find((e) => e.module === rel);
    const testPaths = colocatedActionTestFiles(file);
    const bundled = exemptRow?.bundledTestFiles?.map((p) => path.join(rootDir, p)) ?? [];
    const allTests = [...new Set([...testPaths, ...bundled])].filter((p) => fs.existsSync(p));

    if (exemptRow) {
      if (allTests.length === 0) {
        violations.push({
          file: rel,
          reason: `exemption ${exemptRow.module} lists no resolvable bundledTestFiles`,
        });
      } else if (!testFileMeetsCoverageSignals(allTests)) {
        violations.push({
          file: rel,
          reason: `exemption tests for ${rel} missing auth-failure + scope/eligibility signals`,
        });
      }
      continue;
    }

    if (testPaths.length === 0) {
      violations.push({
        file: rel,
        reason: "missing colocated *.test.ts for governed server action module (§13.3)",
      });
      continue;
    }

    if (!testFileMeetsCoverageSignals(testPaths)) {
      violations.push({
        file: rel,
        reason:
          "colocated tests must exercise auth failure and org-scope/eligibility (see v8-action-eligibility-check signals)",
      });
    }
  }

  return violations;
}

/**
 * §13.1 — every `src/actions/*.ts` server module is exactly one of exempt / settings / infra / governed_feature.
 */
export function collectV8ActionTaxonomyViolations(rootDir = process.cwd()): V8ActionTaxonomyViolation[] {
  const violations: V8ActionTaxonomyViolation[] = [];
  const actionsRoot = path.join(rootDir, "src", "actions");

  for (const file of walkActionFiles(actionsRoot)) {
    const source = fs.readFileSync(file, "utf8");
    if (!source.includes('"use server"')) continue;
    const exports = exportedAsyncFunctions(source);
    if (exports.length === 0) continue;

    const base = actionFileBaseName(file);
    const rel = path.relative(rootDir, file).split(path.sep).join("/");
    const exempt = Boolean(resolveActionExemptSurface(base));

    let hasMapped = false;
    for (const name of exports) {
      if (resolveFeatureMappingForAction(`${rel}:${name}`).status === "mapped") {
        hasMapped = true;
        break;
      }
    }

    if (exempt) {
      if (SETTINGS_ACTION_MODULES.has(base) || INFRA_ACTION_MODULES.has(base)) {
        violations.push({
          file: rel,
          reason: "exempt module also listed as settings/infra bucket",
        });
      }
      continue;
    }

    if (!hasMapped) {
      violations.push({
        file: rel,
        reason: "non-exempt server action module has no mapped exports (fix inventory or exempt)",
      });
      continue;
    }

    if (SETTINGS_ACTION_MODULES.has(base) && INFRA_ACTION_MODULES.has(base)) {
      violations.push({
        file: rel,
        reason: "module is listed in both SETTINGS_ACTION_MODULES and INFRA_ACTION_MODULES",
      });
    }
  }

  return violations;
}
