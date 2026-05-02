/**
 * Autonomous security program — Phase 0 / P0 / SDLC inventory checks (no plan file edits).
 * Invoked from scripts/check-autonomous-security-program.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { validatePhase112Integrity } from "./phase112-integrity.mjs";

const root = process.cwd();

function walkTs(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) {
      if (name === "node_modules" || name === ".next") continue;
      walkTs(p, acc);
    } else if (/\.(tsx?|jsx?)$/.test(name)) acc.push(p);
  }
  return acc;
}

function loadEnvExampleKeys() {
  const raw = fs.readFileSync(path.join(root, ".env.example"), "utf8");
  const keys = new Set();
  for (const line of raw.split("\n")) {
    const t = line.trim();
    const m = /^([A-Z][A-Z0-9_]*)\s*=/.exec(t);
    if (m) keys.add(m[1]);
    const mComment = /^#\s*([A-Z][A-Z0-9_]*)\s*=/.exec(t);
    if (mComment) keys.add(mComment[1]);
    const mBare = /^#\s*([A-Z][A-Z0-9_]*)\s*$/.exec(t);
    if (mBare) keys.add(mBare[1]);
  }
  return keys;
}

/** Phase 0d — NEXT_PUBLIC_* referenced via process.env / import.meta.env must be named in .env.example. */
export function checkNextPublicEnvSurface() {
  const documented = loadEnvExampleKeys();
  const used = new Set();
  const re = /(?:process\.env|import\.meta\.env)\.(NEXT_PUBLIC_[A-Z0-9_]+)\b/g;
  for (const file of walkTs(path.join(root, "src"))) {
    if (/\.(test|spec|ui\.test)\.(tsx?|jsx?)$/.test(file)) continue;
    const text = fs.readFileSync(file, "utf8");
    let m;
    while ((m = re.exec(text)) !== null) {
      if (m[1]) used.add(m[1]);
    }
  }
  const missing = [...used].filter((k) => !documented.has(k)).sort();
  if (missing.length) {
    return {
      id: "phase0-secrets-surface",
      ok: false,
      detail: `NEXT_PUBLIC key(s) used in src/ but not in .env.example: ${missing.join(", ")}`,
    };
  }
  return { id: "phase0-secrets-surface", ok: true, detail: `${used.size} NEXT_PUBLIC key(s) documented` };
}

/** Phase 0i — native bindings / worker_threads in application src (informational fail on unexpected hits). */
export function checkNativeFfiSurface() {
  const needles = [/from\s+["']ffi-napi["']/, /\bworker_threads\b/, /\.node["'`]/, /\bnew\s+Worker\s*\(/];
  const hits = [];
  for (const file of walkTs(path.join(root, "src"))) {
    if (/\.(test|spec|ui\.test)\.(tsx?|jsx?)$/.test(file)) continue;
    const text = fs.readFileSync(file, "utf8");
    for (const n of needles) {
      if (n.test(text)) hits.push(`${path.relative(root, file)}: ${n}`);
    }
  }
  if (hits.length) {
    return {
      id: "phase0-native-ffi",
      ok: false,
      detail: `Unexpected native/FFI/worker surface:\n${hits.slice(0, 20).join("\n")}`,
    };
  }
  return { id: "phase0-native-ffi", ok: true, detail: "No ffi-napi/worker_threads/.node bindings in src/" };
}

/** Phase 0j — non-literal dynamic import() in API route handlers (avoids prose "import (" in UI copy). */
export function checkDynamicImportFsHeuristic() {
  const bad = [];
  const re = /\bimport\s*\(\s*(?![`'"])/g;
  const apiRoot = path.join(root, "src", "app", "api");
  function walkApiRoutes(dir, acc = []) {
    if (!fs.existsSync(dir)) return acc;
    for (const name of fs.readdirSync(dir)) {
      const p = path.join(dir, name);
      const st = fs.statSync(p);
      if (st.isDirectory()) walkApiRoutes(p, acc);
      else if (name === "route.ts" || name === "route.tsx") acc.push(p);
    }
    return acc;
  }
  for (const file of walkApiRoutes(apiRoot)) {
    const text = fs.readFileSync(file, "utf8");
    if (re.test(text)) bad.push(path.relative(root, file));
  }
  if (bad.length) {
    return {
      id: "phase0-dynamic-import-fs",
      ok: false,
      detail: `Non-literal dynamic import in API route(s): ${bad.join(", ")}`,
    };
  }
  return {
    id: "phase0-dynamic-import-fs",
    ok: true,
    detail: "No non-literal dynamic import() in src/app/api/**/route.ts(x)",
  };
}

/** Phase 0k — Stripe live secret key material must not appear in tracked sources outside fixtures. */
export function checkEnvVariantStrings() {
  function allowed(f) {
    if (f === ".env.example") return true;
    if (f.startsWith("e2e/fixtures/")) return true;
    if (f.startsWith("scripts/") && f.endsWith(".mjs")) return true;
    return false;
  }
  let tracked;
  try {
    tracked = execSync("git ls-files", { encoding: "utf8", cwd: root })
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
  } catch {
    return { id: "phase0-env-variants", ok: true, detail: "git unavailable; skip tracked scan" };
  }
  const skLive = /\bsk_live_[0-9a-zA-Z]{48,}/;
  const violations = [];
  for (const f of tracked) {
    if (!/\.(ts|tsx|js|jsx|json|md|mjs|yml|yaml|sql)$/.test(f)) continue;
    if (allowed(f)) continue;
    const full = path.join(root, f);
    if (!fs.existsSync(full)) continue;
    const text = fs.readFileSync(full, "utf8");
    if (skLive.test(text)) violations.push(f);
  }
  if (violations.length) {
    return {
      id: "phase0-env-variants",
      ok: false,
      detail: `Stripe sk_live_* material in: ${violations.join(", ")}`,
    };
  }
  return { id: "phase0-env-variants", ok: true, detail: "No Stripe sk_live key blobs in tracked app sources" };
}

/** Phase 0o — temp dirs: ban obvious world-readable chmod 0o777 in src. */
export function checkTempFileHygiene() {
  const hits = [];
  for (const file of walkTs(path.join(root, "src"))) {
    const text = fs.readFileSync(file, "utf8");
    if (/chmod(?:Sync)?\s*\(\s*[^,]+,\s*0o777/.test(text) || /chmod(?:Sync)?\s*\(\s*[^,]+,\s*511\b/.test(text)) {
      hits.push(path.relative(root, file));
    }
  }
  if (hits.length) {
    return { id: "phase0-temp-umask", ok: false, detail: `chmod 777 patterns: ${hits.join(", ")}` };
  }
  return { id: "phase0-temp-umask", ok: true, detail: "No chmod 0o777 in src/" };
}

/** Phase 0p — lockfile v3+ */
export function checkLockfileIntegrity() {
  const lp = path.join(root, "package-lock.json");
  if (!fs.existsSync(lp)) {
    return { id: "phase0-lockfile-integrity", ok: false, detail: "Missing package-lock.json" };
  }
  const j = JSON.parse(fs.readFileSync(lp, "utf8"));
  const v = j.lockfileVersion;
  if (typeof v !== "number" || v < 3) {
    return { id: "phase0-lockfile-integrity", ok: false, detail: `lockfileVersion ${v} expected >= 3` };
  }
  return { id: "phase0-lockfile-integrity", ok: true, detail: `package-lock.json lockfileVersion=${v}` };
}

/** Phase112 — canonical ledger section order vs manifest (maximal program closure). */
export function checkPhase112PlanIntegrity() {
  try {
    return validatePhase112Integrity();
  } catch (e) {
    return {
      id: "phase112-plan-integrity",
      ok: false,
      detail: e instanceof Error ? e.message : String(e),
    };
  }
}

/** Phase12 — forbid high-risk realtime/protocol stacks unless explicitly adopted. */
export function checkForbiddenProtocolPackages() {
  const pkgPath = path.join(root, "package.json");
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  const deps = {
    ...(pkg.dependencies ?? {}),
    ...(pkg.devDependencies ?? {}),
    ...(pkg.optionalDependencies ?? {}),
  };
  const forbidden = [
    "@apollo/server",
    "apollo-server-core",
    "graphql-yoga",
    "@grpc/grpc-js",
    "grpc",
    "socket.io",
    "socket.io-client",
    "mqtt",
    "kafkajs",
  ];
  const hits = forbidden.filter((name) => Object.prototype.hasOwnProperty.call(deps, name));
  if (hits.length) {
    return {
      id: "phase12-protocol-surfaces",
      ok: false,
      detail: `Unexpected protocol stack dependency(ies): ${hits.join(", ")}`,
    };
  }
  return { id: "phase12-protocol-surfaces", ok: true, detail: "No GraphQL server / gRPC / socket.io / MQTT / Kafka client deps" };
}

/** Phase11 / phase19 — committed compliance artifacts and worker isolation config exist. */
export function checkComplianceArtifactRegistry() {
  const regPath = path.join(root, "config", "compliance-artifact-registry.json");
  if (!fs.existsSync(regPath)) {
    return { id: "phase11-artifact-registry", ok: false, detail: "Missing config/compliance-artifact-registry.json" };
  }
  const reg = JSON.parse(fs.readFileSync(regPath, "utf8"));
  const rows = reg.artifacts;
  if (!Array.isArray(rows)) {
    return { id: "phase11-artifact-registry", ok: false, detail: "compliance-artifact-registry.json: expected artifacts array" };
  }
  const missing = [];
  for (const row of rows) {
    if (!row || typeof row.path !== "string") continue;
    if (row.optional) continue;
    const full = path.join(root, row.path);
    if (!fs.existsSync(full)) missing.push(row.path);
  }
  if (missing.length) {
    return {
      id: "phase11-artifact-registry",
      ok: false,
      detail: `Missing required artifact(s): ${missing.join(", ")}`,
    };
  }
  return { id: "phase11-artifact-registry", ok: true, detail: `${rows.length} registry row(s) checked` };
}

/** External obligations registry (completeness; org-owned evidence). */
export function checkExternalObligationsRegistry() {
  const p = path.join(root, "config", "security-external-obligations.json");
  if (!fs.existsSync(p)) {
    return { id: "ext-obligations-registry", ok: false, detail: "Missing config/security-external-obligations.json" };
  }
  const j = JSON.parse(fs.readFileSync(p, "utf8"));
  const obs = j.obligations;
  if (!Array.isArray(obs) || obs.length < 30) {
    return {
      id: "ext-obligations-registry",
      ok: false,
      detail: `Expected obligations array length >= 30, got ${Array.isArray(obs) ? obs.length : "invalid"}`,
    };
  }
  return { id: "ext-obligations-registry", ok: true, detail: `${obs.length} external obligation row(s)` };
}

/** Phase36 — global privacy matrix rows carry owner + expiry for governance. */
export function checkGlobalPrivacyLawMatrix() {
  const p = path.join(root, "config", "global-privacy-law-matrix.json");
  if (!fs.existsSync(p)) {
    return { id: "phase36-global-privacy-matrix", ok: false, detail: "Missing config/global-privacy-law-matrix.json" };
  }
  const j = JSON.parse(fs.readFileSync(p, "utf8"));
  if (!Array.isArray(j.laws)) {
    return { id: "phase36-global-privacy-matrix", ok: false, detail: "global-privacy-law-matrix: laws must be an array" };
  }
  for (let i = 0; i < j.laws.length; i++) {
    const row = j.laws[i];
    if (!row.id || !row.owner || !row.expiry) {
      return {
        id: "phase36-global-privacy-matrix",
        ok: false,
        detail: `laws[${i}] missing id, owner, or expiry`,
      };
    }
  }
  return {
    id: "phase36-global-privacy-matrix",
    ok: true,
    detail: `${j.laws.length} jurisdiction row(s) with owner+expiry`,
  };
}

export function runSecurityProgramChecks() {
  const checks = [
    checkNextPublicEnvSurface,
    checkNativeFfiSurface,
    checkDynamicImportFsHeuristic,
    checkEnvVariantStrings,
    checkTempFileHygiene,
    checkLockfileIntegrity,
    checkPhase112PlanIntegrity,
    checkForbiddenProtocolPackages,
    checkComplianceArtifactRegistry,
    checkExternalObligationsRegistry,
    checkGlobalPrivacyLawMatrix,
  ];
  const results = checks.map((fn) => fn());
  const failures = results.filter((r) => !r.ok);
  return { results, failures };
}
