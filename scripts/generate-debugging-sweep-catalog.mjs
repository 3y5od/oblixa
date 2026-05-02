#!/usr/bin/env node
/**
 * AUTO-GENERATED ARTIFACTS — never hand-edit outputs:
 * - scripts/debugging-sweep/provenance.json
 * - src/lib/debugging-sweep/catalog-generated.json
 * - src/lib/debugging-sweep/catalog-generated.ts
 * - src/lib/debugging-sweep/catalog-generated.meta.json
 * - src/lib/debugging-sweep/partition-checksums.generated.ts
 * - src/lib/debugging-sweep/stubs/catalog-stubs.generated.ts
 *
 * Merge conflicts: rerun `npm run generate:debugging-sweep-catalog`.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { buildStubPartitionMap } from "./debugging-sweep/bucket-definitions.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const provPath = path.join(root, "scripts", "debugging-sweep", "provenance.json");
const stubListPath = path.join(root, "scripts", "debugging-sweep", "stub-classes.txt");
const sweepLib = path.join(root, "src", "lib", "debugging-sweep");
const jsonOut = path.join(sweepLib, "catalog-generated.json");
const tsOut = path.join(sweepLib, "catalog-generated.ts");
const metaOut = path.join(sweepLib, "catalog-generated.meta.json");
const partSumOut = path.join(sweepLib, "partition-checksums.generated.ts");
const stubsOut = path.join(sweepLib, "stubs", "catalog-stubs.generated.ts");
const partitionManifestOut = path.join(sweepLib, "partition-manifest.generated.ts");
const catalogPartitionsDir = path.join(sweepLib, "catalog-partitions");

/** Plan v3–v11 partition anchor filenames (empty TS anchors; rows live in provenance). */
const PARTITION_ANCHOR_FILES = [
  "catalog-compliance-frameworks.ts",
  "catalog-cryptography-pki.ts",
  "catalog-data-lineage-warehouse.ts",
  "catalog-orchestration-etl.ts",
  "catalog-chaos-vendors.ts",
  "catalog-log-formats-siem.ts",
  "catalog-airgap-sovereign.ts",
  "catalog-humans-change-management.ts",
  "catalog-threat-stride-internal.ts",
  "catalog-supply-chain-provenance.ts",
  "catalog-package-registries.ts",
  "catalog-email-dns-security.ts",
  "catalog-webrtc-realtime.ts",
  "catalog-routing-rpki-bgp.ts",
  "catalog-os-hardware-pathology.ts",
  "catalog-financial-calendars.ts",
  "catalog-owasp-asvs-ssdf.ts",
  "catalog-ide-lsp-arch.ts",
  "catalog-licensing-notices.ts",
  "catalog-a11y-at-engines.ts",
  "catalog-ci-media-retention.ts",
  "catalog-vertical-regulated-industry.ts",
  "catalog-payments-rails-global.ts",
  "catalog-erp-hr-enterprise.ts",
  "catalog-media-drm-fonts-typography.ts",
  "catalog-devtools-debug-protocols.ts",
  "catalog-privacy-sandbox-identity.ts",
  "catalog-supabase-cdn-vercel.ts",
  "catalog-llm-safety-multimodal.ts",
  "catalog-a11y-standards-matrix.ts",
  "catalog-os-host-security-fs.ts",
  "catalog-build-monorepo-bundlers.ts",
  "catalog-container-k8s-admission.ts",
  "catalog-cloud-iam-secrets-gateways.ts",
  "catalog-product-analytics-experimentation.ts",
  "catalog-incident-comms-status.ts",
  "catalog-alt-e2e-visual-grid.ts",
  "catalog-native-sanitizers-profilers.ts",
  "catalog-sbom-formats-i18n-tax.ts",
  "catalog-jurisdictions-data-residency.ts",
  "catalog-ai-governance-standards.ts",
  "catalog-offline-crdt-local-first.ts",
  "catalog-edge-ml-serving.ts",
  "catalog-web-payment-vc-did-c2pa.ts",
  "catalog-dast-fuzz-proxy.ts",
  "catalog-data-engineering-distributed.ts",
  "catalog-observability-semconv-slo.ts",
  "catalog-fringe-physical-network-time.ts",
  "catalog-language-runtimes-gc.ts",
  "catalog-wasm-alternate-runtimes.ts",
  "catalog-filesystems-block-storage.ts",
  "catalog-web-peripheral-apis.ts",
  "catalog-device-attestation-os.ts",
  "catalog-ml-experiment-monitoring.ts",
  "catalog-nix-reproducible-builds.ts",
  "catalog-scientific-niche-domains.ts",
  "catalog-enterprise-idp-netfs.ts",
  "catalog-formal-methods-property-testing.ts",
  "catalog-serialization-parsing-matrix.ts",
  "catalog-rpc-schema-contracts.ts",
  "catalog-node-streams-process-managers.ts",
  "catalog-forensics-debug-symbols.ts",
  "catalog-time-determinism-simulation.ts",
];

const ARTIFACT_PATHS = [
  "artifacts/pqc-readiness.json",
  "artifacts/stride-dread-threat-model.json",
  "artifacts/dora-space-metrics.json",
  "artifacts/qa-game-day-checklist.json",
  "artifacts/pen-test-findings.json",
  "artifacts/memory-budgets.json",
  "artifacts/lighthouse-budgets.json",
  "artifacts/mta-sts-policy.json",
  "artifacts/bimi-svg-placeholder.json",
  "artifacts/sbom-diff-report.json",
  "artifacts/web3-surface-absent.json",
];

const CONFIG_PATHS = [
  "config/compliance/asvs-level-target.json",
  "config/compliance/nist-sp800-controls-map.json",
];

function stableJsonStringify(value) {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((x) => stableJsonStringify(x)).join(",")}]`;
  }
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableJsonStringify(value[k])}`).join(",")}}`;
}

function sha256Hex(s) {
  return crypto.createHash("sha256").update(s).digest("hex");
}

function buildNativeRows() {
  return [
    {
      id: "L1-NATIVE-MW-MATCHER",
      title: "Edge proxy matcher excludes static assets and image optimizer paths (src/proxy.ts config)",
      list: "1",
      sectionPath: "native/edge-proxy/matcher",
      layer: "platform",
      implementation: "native",
      partition: "native",
      tags: ["next", "middleware"],
    },
    {
      id: "L1-NATIVE-MW-CORRELATION",
      title: "Correlation headers x-request-id and x-correlation-id stamped on edge proxy responses (src/proxy.ts)",
      list: "1",
      sectionPath: "native/edge-proxy/correlation",
      layer: "platform",
      implementation: "native",
      partition: "native",
      tags: ["middleware", "tracing"],
    },
    {
      id: "L1-NATIVE-ROUTE-DIAG",
      title: "Internal debugging sweep JSON route gated by secret and env",
      list: "1",
      sectionPath: "native/api/internal-diagnostics",
      layer: "platform",
      implementation: "native",
      partition: "native",
      tags: ["api", "security"],
    },
    {
      id: "L1-NATIVE-LOGGER",
      title: "Server sweep logger uses redaction helpers for unknown errors",
      list: "1",
      sectionPath: "native/observability/logger",
      layer: "platform",
      implementation: "native",
      partition: "native",
    },
    {
      id: "L1-NATIVE-SENTRY-TAGS",
      title: "Sentry optional correlation context with bounded tag sizes",
      list: "1",
      sectionPath: "native/observability/sentry",
      layer: "platform",
      implementation: "partial",
      partition: "native",
    },
    {
      id: "L1-NATIVE-INSTRUMENTATION",
      title: "Instrumentation registers debugging sweep runtime on Node only",
      list: "1",
      sectionPath: "native/instrumentation",
      layer: "meta",
      implementation: "native",
      partition: "native",
    },
  ];
}

function buildMiddlewareMatrixRows() {
  const concerns = [
    ["L1-MW-001", "Matcher excludes /_next/static", "middleware-matrix/matcher/static"],
    ["L1-MW-002", "Matcher excludes /_next/image", "middleware-matrix/matcher/image"],
    ["L1-MW-003", "Matcher excludes favicon.ico", "middleware-matrix/matcher/favicon"],
    ["L1-MW-004", "RSC flight prefetch must not run heavy diagnostics in middleware", "middleware-matrix/rsc-prefetch"],
    ["L1-MW-005", "NextRequest geo and IP must not be logged raw", "middleware-matrix/privacy-ip"],
    ["L1-MW-006", "Bot User-Agent should not be special-cased unless product requires", "middleware-matrix/bot-ua"],
    ["L1-MW-007", "Edge middleware must not register process.on handlers", "middleware-matrix/edge-process"],
    ["L1-MW-008", "Correlation header values capped and CRLF stripped", "middleware-matrix/header-sanitize"],
    ["L1-MW-009", "Avoid conflicting Vary headers from middleware", "middleware-matrix/vary"],
  ];
  return concerns.map(([id, title, sectionPath]) => ({
    id,
    title,
    list: "1",
    sectionPath,
    layer: "protocol",
    implementation: "stub",
    partition: "middleware-matrix",
    detectability: "hybrid",
    blastRadius: "low",
    privacyRisk: "low",
  }));
}

function buildStrideRows() {
  return [
    {
      id: "L1-STRIDE-SPOOF",
      title: "STRIDE spoofing: forged bearer against internal diagnostics",
      list: "1",
      sectionPath: "stride/internal-diag/spoofing",
      layer: "pathology",
      implementation: "native",
      partition: "native",
      owaspCategory: "A07",
      cweIds: ["CWE-287"],
    },
    {
      id: "L1-STRIDE-TAMPER",
      title: "STRIDE tampering: MITM JSON response class (TLS-only posture)",
      list: "1",
      sectionPath: "stride/internal-diag/tampering",
      layer: "pathology",
      implementation: "stub",
      partition: "native",
    },
    {
      id: "L1-STRIDE-REPU",
      title: "STRIDE repudiation: access audit with redacted request id",
      list: "1",
      sectionPath: "stride/internal-diag/repudiation",
      layer: "people",
      implementation: "partial",
      partition: "native",
    },
    {
      id: "L1-STRIDE-INFO",
      title: "STRIDE information disclosure: strict allowlist on diagnostics JSON",
      list: "1",
      sectionPath: "stride/internal-diag/info-disclosure",
      layer: "pathology",
      implementation: "native",
      partition: "native",
    },
    {
      id: "L1-STRIDE-DOS",
      title: "STRIDE denial of service: rate limit and optional IP allowlist",
      list: "1",
      sectionPath: "stride/internal-diag/dos",
      layer: "pathology",
      implementation: "native",
      partition: "native",
    },
    {
      id: "L1-STRIDE-ELEV",
      title: "STRIDE elevation: separate internal diagnostics secret from cron secret",
      list: "1",
      sectionPath: "stride/internal-diag/elevation",
      layer: "pathology",
      implementation: "native",
      partition: "native",
    },
  ];
}

function buildArtifactRows() {
  const rows = [];
  let i = 0;
  for (const p of ARTIFACT_PATHS) {
    i += 1;
    rows.push({
      id: `L1-ART-${String(i).padStart(3, "0")}`,
      title: `Repo artifact linkage: ${path.basename(p)}`,
      list: "1",
      sectionPath: `artifacts/${path.basename(p, path.extname(p))}`,
      layer: "meta",
      implementation: "partial",
      partition: "pass8",
      artifactsPath: p,
      relatedArtifactIds: [path.basename(p).replace(/\.[^.]+$/, "")],
      sbomFormat: "unknown",
      tags: ["artifact", "compliance"],
    });
  }
  for (const p of CONFIG_PATHS) {
    i += 1;
    rows.push({
      id: `L1-CFG-${String(i).padStart(3, "0")}`,
      title: `Config linkage: ${path.basename(p)}`,
      list: "1",
      sectionPath: `config/${path.basename(p, path.extname(p))}`,
      layer: "meta",
      implementation: "partial",
      partition: "pass8",
      configPath: p,
      tags: ["config", "compliance"],
    });
  }
  return rows;
}

function buildMetaRows() {
  return [
    {
      id: "L1-META-PROV-HASH",
      title: "Provenance hash chain optional; disabled by default with tamper-evident stub row",
      list: "1",
      sectionPath: "meta/provenance-hash-chain",
      layer: "meta",
      implementation: "stub",
      partition: "meta",
      provenanceMeta: true,
    },
    {
      id: "L1-META-GEN-DIFF",
      title: "CI generator diff failures are catalogued as observability meta signal",
      list: "1",
      sectionPath: "meta/generator-diff",
      layer: "meta",
      implementation: "stub",
      partition: "meta",
      provenanceMeta: true,
    },
    {
      id: "L1-META-PARTITION-DRIFT",
      title: "Partition checksum drift detection for debugging sweep rows",
      list: "1",
      sectionPath: "meta/partition-checksum",
      layer: "meta",
      implementation: "native",
      partition: "meta",
      provenanceMeta: true,
    },
    {
      id: "L1-META-DEP-SAMPLE",
      title: "Sample deprecated catalog row for merge policy tests",
      list: "1",
      sectionPath: "meta/deprecation-sample",
      layer: "meta",
      implementation: "stub",
      partition: "meta",
      provenanceMeta: true,
      deprecated: true,
      deprecatedBy: "L1-NATIVE-MW-CORRELATION",
    },
  ];
}

function buildSampleTaxonomyRows() {
  return [
    {
      id: "L1-SAMPLE-REFURL",
      title: "Sample row with public https reference URL only",
      list: "1",
      sectionPath: "samples/reference-url",
      layer: "meta",
      implementation: "stub",
      partition: "pass8",
      referenceUrls: ["https://www.w3.org/TR/trace-context/"],
      sbomFormat: "SPDX",
      npmPackageName: "next",
    },
    {
      id: "L1-SAMPLE-JURIS",
      title: "Sample jurisdiction taxonomy row without legal advice text",
      list: "1",
      sectionPath: "samples/jurisdiction-tags",
      layer: "product",
      implementation: "stub",
      partition: "pass9",
      jurisdictionTags: ["DE", "US"],
      aiGovernanceFramework: ["nist_ai_rmf"],
      contentAuthenticityHint: "C2PA",
    },
    {
      id: "L1-SAMPLE-RUNTIME-TAGS",
      title: "Sample Pass-10 bounded runtime and peripheral tags",
      list: "1",
      sectionPath: "samples/pass10-tags",
      layer: "platform",
      implementation: "stub",
      partition: "pass10",
      languageRuntimeTags: ["node-20"],
      peripheralApiTags: ["webhid"],
      filesystemStorageTags: ["sqlite-wal"],
      mlOpsToolTags: ["mlflow"],
    },
    {
      id: "L1-SAMPLE-PASS11",
      title: "Sample Pass-11 formal methods and RPC contract tags",
      list: "1",
      sectionPath: "samples/pass11-tags",
      layer: "platform",
      implementation: "stub",
      partition: "pass11",
      formalMethodTags: ["tlc"],
      serializationFormatTags: ["json"],
      rpcContractTags: ["grpc"],
      nodeRuntimeTags: ["streams"],
    },
  ];
}

function buildStubRows(stubPartitionMap) {
  const raw = fs.readFileSync(stubListPath, "utf8");
  const ids = raw
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  const rows = [];
  let idx = 0;
  for (const stubClass of ids) {
    idx += 1;
    const partition = stubPartitionMap.get(stubClass) ?? "pass8";
    rows.push({
      id: `L1-${partition.toUpperCase()}-STUB-${String(idx).padStart(4, "0")}`,
      title: `Sweep stub surface: ${stubClass.replace(/-/g, " ")}`,
      list: "1",
      sectionPath: `${partition}/stub/${stubClass}`,
      layer: "platform",
      implementation: "stub",
      partition,
      stubClass,
    });
  }
  return rows;
}

function buildStubRegistrySource(ids) {
  const lines = [
    "/** AUTO-GENERATED — run `npm run generate:debugging-sweep-catalog`. Do not edit by hand. */",
    "",
    "export const STUB_CLASS_COUNT = " + JSON.stringify(ids.length) + " as const;",
    "",
    "export const STUB_CLASS_IDS = " + JSON.stringify(ids, null, 2) + " as const;",
    "",
    "export const STUB_CLASS_REGISTRY: Record<string, () => void> = {",
  ];
  for (const id of ids) {
    const safe = JSON.stringify(id);
    lines.push(
      `  ${safe}: () => { if (process.env.OBLIXA_SWEEP_STUB_VERBOSE === \"1\") console.debug(\"[sweep-stub]\", ${safe}); },`
    );
  }
  lines.push("};");
  lines.push("");
  return lines.join("\n");
}

function writePartitionAnchorFiles() {
  fs.mkdirSync(catalogPartitionsDir, { recursive: true });
  for (const name of PARTITION_ANCHOR_FILES) {
    const body = `/** AUTO-GENERATED partition anchor — rows live in provenance.json. */\nexport const PARTITION_FILE = ${JSON.stringify(name)};\n`;
    fs.writeFileSync(path.join(catalogPartitionsDir, name), body, "utf8");
  }
  const man = [
    "/** AUTO-GENERATED — run `npm run generate:debugging-sweep-catalog`. */",
    "",
    "export const PARTITION_MANIFEST = " + JSON.stringify(PARTITION_ANCHOR_FILES, null, 2) + " as const;",
    "",
    "export type PartitionManifestEntry = (typeof PARTITION_MANIFEST)[number];",
    "",
  ].join("\n");
  fs.writeFileSync(partitionManifestOut, man, "utf8");
}

function partitionChecksums(rows) {
  const byPart = new Map();
  for (const r of rows) {
    const p = r.partition ?? "pass8";
    if (!byPart.has(p)) byPart.set(p, []);
    byPart.get(p).push(r);
  }
  const sums = {};
  for (const [p, list] of byPart) {
    const sorted = [...list].sort((a, b) => a.id.localeCompare(b.id));
    sums[p] = sha256Hex(stableJsonStringify(sorted));
  }
  return sums;
}

function main() {
  const check = process.argv.includes("--check");
  const stubPartitionMap = buildStubPartitionMap();
  const rows = [
    ...buildNativeRows(),
    ...buildMiddlewareMatrixRows(),
    ...buildStrideRows(),
    ...buildArtifactRows(),
    ...buildMetaRows(),
    ...buildSampleTaxonomyRows(),
    ...buildStubRows(stubPartitionMap),
  ];
  const byId = new Map();
  for (const r of rows) {
    if (byId.has(r.id)) throw new Error(`Duplicate id ${r.id}`);
    byId.set(r.id, r);
  }
  const sortedRows = [...rows].sort((a, b) => a.id.localeCompare(b.id));
  const provenanceHash = sha256Hex(stableJsonStringify(sortedRows));
  const sums = partitionChecksums(sortedRows);
  const stubIds = sortedRows.filter((r) => r.stubClass).map((r) => r.stubClass);

  const meta = {
    rowCount: sortedRows.length,
    partitionCount: Object.keys(sums).length,
    stubCount: stubIds.length,
    provenanceHash,
    generatedAt: new Date().toISOString(),
  };

  if (check) {
    const existing = fs.readFileSync(jsonOut, "utf8");
    const next = JSON.stringify(sortedRows, null, 2) + "\n";
    if (existing !== next) {
      console.error("catalog-generated.json is out of date; run without --check to regenerate.");
      process.exit(1);
    }
    console.log("OK: catalog-generated.json matches generator output.");
    process.exit(0);
  }

  fs.mkdirSync(path.dirname(provPath), { recursive: true });
  fs.mkdirSync(path.join(sweepLib, "stubs"), { recursive: true });

  fs.writeFileSync(provPath, JSON.stringify(sortedRows, null, 2) + "\n", "utf8");
  fs.writeFileSync(jsonOut, JSON.stringify(sortedRows, null, 2) + "\n", "utf8");

  const tsBanner =
    "/** AUTO-GENERATED — run `npm run generate:debugging-sweep-catalog`. Do not edit by hand. */\n";
  const ts = `${tsBanner}import type { SweepItem } from "./catalog-types";\nimport catalogGenerated from "./catalog-generated.json";\n\nexport const CATALOG_GENERATED_HASH = ${JSON.stringify(provenanceHash)};\n\nexport const ALL_SWEEP_ITEMS = catalogGenerated as unknown as readonly SweepItem[];\n`;
  fs.writeFileSync(tsOut, ts, "utf8");

  fs.writeFileSync(metaOut, JSON.stringify(meta, null, 2) + "\n", "utf8");

  const partLines = [
    "/** AUTO-GENERATED — run `npm run generate:debugging-sweep-catalog`. */",
    "",
    "export const PARTITION_ROW_CHECKSUMS: Record<string, string> = " + JSON.stringify(sums, null, 2) + " as const;",
    "",
  ];
  fs.writeFileSync(partSumOut, partLines.join("\n"), "utf8");

  fs.writeFileSync(stubsOut, buildStubRegistrySource([...new Set(stubIds)].sort((a, b) => a.localeCompare(b))), "utf8");

  writePartitionAnchorFiles();

  console.log(`Wrote ${sortedRows.length} rows; provenance hash ${provenanceHash.slice(0, 12)}…`);
}

main();
