#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

import { scanVersionedNaming } from "./check-versioned-naming.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.join(__dirname, "..");
const DEFAULT_ARTIFACT_REL = "artifacts/compatibility/versioned-content-contract-inventory.json";

const MANUAL_SURFACES = new Set([
  "api_or_cron_contract",
  "app_route_contract",
  "environment_key",
  "external_contract",
  "openapi_schema",
  "provider_or_crypto_format",
  "sql_object",
  "telemetry_event",
]);

const LEGITIMATE_VERSION_RE =
  /enc:v[0-9]:|Stripe-Signature|Slack|v0=|v1=|schemaVersion|schema_version|apiVersion|ASVS|IPv4|IPv6|OAuth|model|tokenizer|node:[0-9]+|postgres:[0-9]+/iu;

function stableStringify(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function sha256Short(value) {
  return crypto.createHash("sha256").update(value).digest("hex").slice(0, 16);
}

function tokenFromExcerpt(excerpt, token) {
  const candidates = [
    /\b[A-Z][A-Z0-9_]*V[0-9][A-Z0-9_]*\b/gu,
    /\bV[0-9]_[A-Z0-9_]+\b/gu,
    /\bNEXT_PUBLIC_[A-Z0-9_]*V[0-9][A-Z0-9_]*\b/gu,
    /\bENABLE_V[0-9]_[A-Z0-9_]+\b/gu,
    /\bproduct\.v[0-9]\.[a-z0-9_.-]+\b/gu,
    /\bv[0-9]_[a-z0-9_]+\b/gu,
    /\bdata-v[0-9][a-z0-9_-]*\b/gu,
  ];
  for (const pattern of candidates) {
    const found = excerpt.match(pattern);
    if (found?.length) return found[0];
  }
  return token;
}

export function suggestedNeutralContentName(value) {
  let next = String(value);
  next = next.replace(/\bNEXT_PUBLIC_V[0-9]+_/gu, "NEXT_PUBLIC_");
  next = next.replace(/\bENABLE_V[0-9]+_/gu, "ENABLE_");
  next = next.replace(/\bV[0-9]+_/gu, "");
  next = next.replace(/\bv[0-9]+_/gu, "");
  next = next.replace(/\bproduct\.v[0-9]+\./gu, "product.");
  next = next.replace(/\bdata-v[0-9]+-?/gu, "data-");
  next = next.replace(/(?<![A-Z])V[0-9]+(?=[A-Z_])/gu, "");
  next = next.replace(/_{2,}/gu, "_");
  next = next.replace(/-{2,}/gu, "-");
  next = next.replace(/_$/gu, "");
  next = next.replace(/-$/gu, "");
  return next && next !== value ? next : null;
}

export function classifyContentContract({ path: rel, excerpt, token }) {
  const text = `${excerpt}\n${rel}`;
  if (LEGITIMATE_VERSION_RE.test(text)) {
    return "provider_or_crypto_format";
  }
  if (/\bprocess\.env\.|\benv\.|NEXT_PUBLIC_|ENABLE_V[0-9]_|PLAYWRIGHT_V[0-9]|V[0-9]_[A-Z0-9_]+/u.test(excerpt)) {
    return "environment_key";
  }
  if (/product\.v[0-9]\./u.test(excerpt)) return "telemetry_event";
  if (/data-v[0-9]|data-v[0-9]-|getByTestId|testid/iu.test(excerpt)) return "dom_or_test_selector";
  if (/v[0-9]_[a-z0-9_]+/u.test(excerpt) && /(?:from|rpc|select|insert|update|delete|table|view|function|policy|trigger|index)/iu.test(excerpt)) {
    return "sql_object";
  }
  if (rel === "openapi.yaml" || rel.startsWith("openapi/")) return "openapi_schema";
  if (rel.startsWith("src/app/api/")) return "api_or_cron_contract";
  if (rel.startsWith("src/app/")) return "app_route_contract";
  if (rel.startsWith("supabase/")) return "sql_object";
  if (rel.startsWith("public/") || rel.startsWith("config/") || rel.endsWith(".config.ts") || rel.endsWith(".config.mjs")) {
    return "external_contract";
  }
  if (rel === "package.json") return "package_script_or_metadata";
  if (rel.startsWith(".github/")) return "ci_contract";
  if (rel.startsWith("e2e/")) return "e2e_contract";
  if (rel.startsWith("scripts/")) return "tooling_contract";
  if (rel.startsWith("docs/")) return "documentation_contract";
  if (token.toLowerCase() === "v8" && /\bnode:v8\b|\bv8\b/u.test(excerpt)) return "provider_or_crypto_format";
  return "source_content";
}

export function classifyContentSubSurface({ path: rel, excerpt, token, surfaceClass, contractName }) {
  const text = `${excerpt}\n${rel}\n${contractName ?? ""}\n${token ?? ""}`;
  if (surfaceClass === "provider_or_crypto_format") {
    if (/enc:v[0-9]:/iu.test(text)) return "cryptographic_envelope_version";
    if (/Stripe-Signature|Slack|v0=|v1=/iu.test(text)) return "provider_signature_version";
    if (/OAuth|oauth\.v[0-9]/iu.test(text)) return "provider_oauth_protocol_version";
    if (/model|tokenizer|eval|embedding/iu.test(text)) return "provider_model_or_eval_version";
    if (/ASVS|IPv4|IPv6|WCAG|CSP|Trusted Types/iu.test(text)) return "standards_compliance_reference";
    if (/schemaVersion|schema_version|apiVersion/iu.test(text)) return "artifact_schema_version";
    if (/node:[0-9]+|postgres:[0-9]+/iu.test(text)) return "dependency_or_runtime_version";
    return "provider_or_protocol_version";
  }
  if (surfaceClass === "environment_key") {
    if (/NEXT_PUBLIC_/u.test(contractName ?? excerpt)) return "public_env_key";
    if (/ENABLE_/u.test(contractName ?? excerpt)) return "feature_flag_key";
    if (/PLAYWRIGHT_/u.test(contractName ?? excerpt)) return "test_runtime_env_key";
    if (/URL|CRON|REBUILD|MIGRATION|SMOKE|BUCKET/u.test(contractName ?? excerpt)) return "operational_env_key";
    return "environment_key";
  }
  if (surfaceClass === "telemetry_event") return "telemetry_event_name";
  if (surfaceClass === "dom_or_test_selector") {
    if (/data-v[0-9]/iu.test(contractName ?? excerpt)) return "dom_data_attribute";
    if (/getByTestId|testid|test-id|selector/iu.test(text)) return "test_selector";
    return "dom_or_test_selector";
  }
  if (surfaceClass === "sql_object") {
    if (rel.startsWith("supabase/migrations/")) return "migration_sql_content";
    if (rel === "supabase/seed.sql" || rel.includes("/seed")) return "seed_fixture_key";
    if (/policy|grant|revoke|security definer|security invoker|rls|role|auth\./iu.test(text)) return "sql_security_object";
    if (/trigger|publication|realtime|storage\.|bucket/iu.test(text)) return "sql_runtime_object";
    return "sql_or_persisted_key";
  }
  if (surfaceClass === "api_or_cron_contract") {
    if (rel.startsWith("src/app/api/cron/")) return "cron_route_contract";
    if (/webhook|stripe|slack|oauth|callback/iu.test(rel)) return "webhook_or_provider_callback";
    return "api_route_contract";
  }
  if (surfaceClass === "app_route_contract") return "page_route_or_deep_link_contract";
  if (surfaceClass === "openapi_schema") return "openapi_or_json_schema_contract";
  if (surfaceClass === "external_contract") {
    if (rel.startsWith("public/")) return "public_metadata_or_asset";
    if (/manifest|well-known|service-worker|robots|sitemap/iu.test(text)) return "pwa_or_well_known_contract";
    if (/config|semgrep|allowlist|registry|policy/iu.test(rel)) return "source_owned_config_or_scanner_id";
    return "external_contract";
  }
  if (surfaceClass === "package_script_or_metadata") {
    if (/"scripts"|npm run|check:|test:|report:/u.test(text)) return "package_script_key";
    if (/"(?:exports|imports|bin|name|description|keywords|typesVersions)"/u.test(text)) return "package_metadata_or_resolver";
    return "package_script_or_metadata";
  }
  if (surfaceClass === "ci_contract") {
    if (/matrix|strategy|job|name:|workflow|artifact/iu.test(text)) return "ci_job_matrix_or_artifact";
    return "ci_contract";
  }
  if (surfaceClass === "e2e_contract") {
    if (/test|describe|it|snapshot|skip|tag|PLAYWRIGHT/iu.test(text)) return "e2e_test_tag_or_fixture";
    return "e2e_contract";
  }
  if (surfaceClass === "tooling_contract") {
    if (/allowlist|baseline|registry|manifest|policy|rule|scanner|semgrep/iu.test(text)) {
      return "source_owned_config_or_scanner_id";
    }
    if (/SBOM|SLSA|provenance|attestation|license|waiver|supply/iu.test(text)) return "supply_chain_evidence_id";
    return "tooling_or_local_fixture";
  }
  if (surfaceClass === "documentation_contract") return "local_copy_or_historical_document";
  if (surfaceClass === "source_content") {
    if (/cache|rate[-_ ]?limit|lock|queue|worker|job|storage|bucket|artifact|download|export/iu.test(text)) {
      return "operational_storage_or_queue_key";
    }
    if (/audit|evidence|security event|problem|diagnostic|SLO|metric|alert/iu.test(text)) {
      return "audit_evidence_or_diagnostic_key";
    }
    if (/FormData|action|payload|schema|zod|OpenAPI|JSON Schema/iu.test(text)) {
      return "source_schema_or_action_contract";
    }
    if (/email|notification|Slack|webhook|CSV|PDF|filename/iu.test(text)) {
      return "notification_or_export_contract";
    }
    if (/prompt|model|eval|tool|function-call/iu.test(text)) return "ai_fixture_or_prompt_contract";
    if (/CSS|theme|token|style|className/iu.test(text)) return "style_token_or_selector";
    if (/locale|translation|copy|spec-string|pseudo-locale/iu.test(text)) return "localization_or_copy_key";
    return "local_source_literal";
  }
  return surfaceClass;
}

function ownerForSurface(surface) {
  const owners = {
    api_or_cron_contract: "platform-api",
    app_route_contract: "frontend-platform",
    ci_contract: "release-engineering",
    documentation_contract: "docs-platform",
    dom_or_test_selector: "qa-platform",
    e2e_contract: "qa-platform",
    environment_key: "platform-runtime",
    external_contract: "platform-security",
    openapi_schema: "platform-api",
    package_script_or_metadata: "platform-hardening",
    provider_or_crypto_format: "platform-security",
    source_content: "platform-hardening",
    sql_object: "database-platform",
    telemetry_event: "platform-telemetry",
    tooling_contract: "platform-hardening",
  };
  return owners[surface] ?? "platform-hardening";
}

function reasonForSurface(surface, subSurface) {
  if (MANUAL_SURFACES.has(surface)) {
    return `Compatibility-sensitive ${subSurface} version content is inventoried and queued instead of removed in code-only passes.`;
  }
  return `Repo-local ${subSurface} version content can be renamed or normalized after references are manifest-listed and tests pass.`;
}

function manualFollowUpForSurface(surface, subSurface, manualOnly) {
  if (manualOnly) {
    return `Do not remove or rename this ${subSurface} until neutral compatibility is available, external consumers have moved, and manual cutover evidence is captured.`;
  }
  return `This ${subSurface} can be rewritten only through a deterministic local manifest and after its validation command passes.`;
}

function removalStrategyForSurface(surface, manualOnly) {
  return manualOnly ? "add_alias_or_queue_then_manual_cutover" : "local_manifest_rewrite";
}

function groupHits(hits) {
  const map = new Map();
  for (const hit of hits) {
    if (hit.source !== "content") continue;
    const contractName = tokenFromExcerpt(hit.excerpt, hit.token);
    const surfaceClass = classifyContentContract({
      path: hit.path,
      excerpt: hit.excerpt,
      token: hit.token,
    });
    const subSurfaceClass = classifyContentSubSurface({
      path: hit.path,
      excerpt: hit.excerpt,
      token: hit.token,
      surfaceClass,
      contractName,
    });
    const key = `${hit.path}\0${surfaceClass}\0${subSurfaceClass}\0${contractName}`;
    const row = map.get(key) ?? {
      path: hit.path,
      surfaceClass,
      subSurfaceClass,
      contractName,
      token: hit.canonicalToken,
      count: 0,
      sampleLines: [],
      evidenceHashes: [],
    };
    row.count += 1;
    if (row.sampleLines.length < 5 && hit.line != null) row.sampleLines.push(hit.line);
    if (row.evidenceHashes.length < 5) row.evidenceHashes.push(sha256Short(hit.excerpt));
    map.set(key, row);
  }
  return Array.from(map.values()).sort(
    (a, b) =>
      a.path.localeCompare(b.path) ||
      a.surfaceClass.localeCompare(b.surfaceClass) ||
      a.subSurfaceClass.localeCompare(b.subSurfaceClass) ||
      a.contractName.localeCompare(b.contractName),
  );
}

export function buildVersionedContentContractInventory(root = DEFAULT_ROOT) {
  const scan = scanVersionedNaming(root);
  const contracts = groupHits(scan.hits).map((row) => {
    const manualOnly = MANUAL_SURFACES.has(row.surfaceClass);
    return {
      ...row,
      owner: ownerForSurface(row.surfaceClass),
      reason: reasonForSurface(row.surfaceClass, row.subSurfaceClass),
      manualOnly,
      removalStrategy: removalStrategyForSurface(row.surfaceClass, manualOnly),
      validationCommand: "npm run check:versioned-content-contracts",
      manualFollowUp: manualFollowUpForSurface(row.surfaceClass, row.subSurfaceClass, manualOnly),
      suggestedNeutralName: suggestedNeutralContentName(row.contractName),
    };
  });
  const bySurface = {};
  const bySubSurface = {};
  for (const row of contracts) {
    bySurface[row.surfaceClass] = (bySurface[row.surfaceClass] ?? 0) + row.count;
    bySubSurface[row.subSurfaceClass] = (bySubSurface[row.subSurfaceClass] ?? 0) + row.count;
  }
  return {
    schemaVersion: 2,
    generatedBy: "scripts/check-versioned-content-contracts.mjs --write",
    policy:
      "Classify content-level product version labels without reading .env.local or embedding source excerpts. Manual surfaces require aliases, queues, or external evidence before removal.",
    contractCount: contracts.length,
    hitCount: contracts.reduce((sum, row) => sum + row.count, 0),
    manualOnlyContractCount: contracts.filter((row) => row.manualOnly).length,
    bySurface: Object.fromEntries(Object.entries(bySurface).sort(([a], [b]) => a.localeCompare(b))),
    bySubSurface: Object.fromEntries(Object.entries(bySubSurface).sort(([a], [b]) => a.localeCompare(b))),
    contracts,
  };
}

function validateInventory(inventory) {
  const issues = [];
  for (const [index, row] of (inventory.contracts ?? []).entries()) {
    for (const key of [
      "path",
      "surfaceClass",
      "subSurfaceClass",
      "contractName",
      "owner",
      "reason",
      "removalStrategy",
      "validationCommand",
      "manualFollowUp",
    ]) {
      if (typeof row[key] !== "string" || row[key].trim() === "") {
        issues.push({ issue: "versioned_content_contract_missing_metadata", index, key, path: row.path ?? null });
      }
    }
    if (typeof row.manualOnly !== "boolean") {
      issues.push({ issue: "versioned_content_contract_missing_manual_only", index, path: row.path ?? null });
    }
    if (Array.isArray(row.evidenceHashes) && row.evidenceHashes.some((hash) => !/^[a-f0-9]{16}$/u.test(hash))) {
      issues.push({ issue: "versioned_content_contract_invalid_evidence_hash", index, path: row.path ?? null });
    }
  }
  return issues;
}

export function analyzeVersionedContentContracts(options = {}) {
  const root = options.root ?? DEFAULT_ROOT;
  const artifactRel = options.artifactRel ?? DEFAULT_ARTIFACT_REL;
  const current = buildVersionedContentContractInventory(root);
  const issues = validateInventory(current);
  const artifactPath = path.join(root, artifactRel);
  if (!fs.existsSync(artifactPath)) {
    issues.push({ issue: "versioned_content_contract_inventory_missing", path: artifactRel });
  } else {
    const committed = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
    if (stableStringify(committed) !== stableStringify(current)) {
      issues.push({ issue: "versioned_content_contract_inventory_drift", path: artifactRel, hint: "Run npm run write:versioned-content-contracts" });
    }
  }
  return {
    ok: issues.length === 0,
    artifactPath: artifactRel,
    contractCount: current.contractCount,
    hitCount: current.hitCount,
    manualOnlyContractCount: current.manualOnlyContractCount,
    issueCount: issues.length,
    issues,
    current,
  };
}

function parseArgs(argv) {
  const options = { root: DEFAULT_ROOT, artifactRel: DEFAULT_ARTIFACT_REL, write: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--root") {
      options.root = path.resolve(argv[index + 1] ?? "");
      index += 1;
    } else if (arg.startsWith("--root=")) {
      options.root = path.resolve(arg.slice("--root=".length));
    } else if (arg === "--artifact") {
      options.artifactRel = argv[index + 1] ?? DEFAULT_ARTIFACT_REL;
      index += 1;
    } else if (arg.startsWith("--artifact=")) {
      options.artifactRel = arg.slice("--artifact=".length);
    } else if (arg === "--write") {
      options.write = true;
    }
  }
  return options;
}

function writeArtifact(root, artifactRel) {
  const artifact = buildVersionedContentContractInventory(root);
  const out = path.join(root, artifactRel);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, stableStringify(artifact));
  return artifact;
}

export function runVersionedContentContracts(options = parseArgs(process.argv.slice(2))) {
  if (options.write) {
    const artifact = writeArtifact(options.root, options.artifactRel);
    console.log(
      JSON.stringify(
        {
          ok: true,
          wrote: options.artifactRel,
          contractCount: artifact.contractCount,
          hitCount: artifact.hitCount,
          manualOnlyContractCount: artifact.manualOnlyContractCount,
        },
        null,
        2,
      ),
    );
    return artifact;
  }
  const report = analyzeVersionedContentContracts(options);
  const { current, ...printable } = report;
  console.log(JSON.stringify(printable, null, 2));
  if (!report.ok) process.exitCode = 1;
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runVersionedContentContracts();
}
