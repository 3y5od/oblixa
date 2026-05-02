#!/usr/bin/env node
/**
 * Validates scripts/debugging-sweep/provenance.json against provenance.schema rules
 * (structural checks in JS — no AJV dependency).
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const provPath = path.join(root, "scripts", "debugging-sweep", "provenance.json");

const LISTS = new Set(["1", "2", "3", "1+2", "1+3", "2+3", "1+2+3"]);
const LAYERS = new Set(["product", "protocol", "platform", "people", "pathology", "meta"]);
const IMPL = new Set(["native", "stub", "partial"]);
const PARTITIONS = new Set([
  "pass5",
  "pass6",
  "pass7",
  "pass8",
  "pass9",
  "pass10",
  "pass11",
  "meta",
  "native",
  "middleware-matrix",
]);
const SBOM = new Set(["SPDX", "CycloneDX", "SWID", "unknown"]);
const CA_HINT = new Set(["C2PA", "none", "unknown"]);

const PRIVATE_HOST_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
  /^::1$/,
  /^fc00:/i,
  /^fd[0-9a-f]{2}:/i,
];

function isPrivateHost(hostname) {
  const h = hostname.replace(/^\[|\]$/g, "");
  return PRIVATE_HOST_PATTERNS.some((re) => re.test(h));
}

function validateUrlList(urls, ctx) {
  if (!urls) return;
  if (!Array.isArray(urls) || urls.length > 5) throw new Error(`${ctx}: referenceUrls max 5`);
  for (const u of urls) {
    if (typeof u !== "string" || u.length > 512) throw new Error(`${ctx}: bad referenceUrl`);
    let parsed;
    try {
      parsed = new URL(u);
    } catch {
      throw new Error(`${ctx}: invalid referenceUrl ${u}`);
    }
    if (parsed.protocol !== "https:") throw new Error(`${ctx}: referenceUrl must be https`);
    if (isPrivateHost(parsed.hostname)) throw new Error(`${ctx}: referenceUrl host not allowed`);
  }
}

function titleScan(title, ctx) {
  const scan = process.env.OBLIXA_PROVENANCE_TITLE_SCAN;
  if (scan !== "1") return;
  const forbidden = [/password\s*=/i, /BEGIN (RSA |EC )?PRIVATE KEY/i, /sk_live_/i];
  for (const re of forbidden) {
    if (re.test(title)) throw new Error(`${ctx}: title failed OBLIXA_PROVENANCE_TITLE_SCAN`);
  }
}

function validateRow(row, index, idSet) {
  const ctx = `row[${index}]`;
  if (!row || typeof row !== "object") throw new Error(`${ctx}: not an object`);
  for (const k of Object.keys(row)) {
    if (!isAllowedKey(k)) throw new Error(`${ctx}: unknown key ${k}`);
  }

  for (const k of ["id", "title", "list", "sectionPath", "layer", "implementation"]) {
    if (typeof row[k] !== "string" || !row[k]) throw new Error(`${ctx}: missing ${k}`);
  }
  if (row.id.length > 128 || row.title.length > 512) throw new Error(`${ctx}: id/title length`);
  if (!LISTS.has(row.list)) throw new Error(`${ctx}: bad list`);
  if (!LAYERS.has(row.layer)) throw new Error(`${ctx}: bad layer`);
  if (!IMPL.has(row.implementation)) throw new Error(`${ctx}: bad implementation`);
  if (row.partition !== undefined && !PARTITIONS.has(row.partition)) throw new Error(`${ctx}: bad partition`);

  if (idSet.has(row.id)) throw new Error(`duplicate id ${row.id}`);
  idSet.add(row.id);

  validateUrlList(row.referenceUrls, ctx);
  titleScan(row.title, ctx);

  if (row.sbomFormat !== undefined && !SBOM.has(row.sbomFormat)) throw new Error(`${ctx}: bad sbomFormat`);
  if (row.npmPackageName !== undefined) {
    const re = /^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/;
    if (typeof row.npmPackageName !== "string" || !re.test(row.npmPackageName)) {
      throw new Error(`${ctx}: bad npmPackageName`);
    }
  }
  if (row.jurisdictionTags) {
    for (const t of row.jurisdictionTags) {
      if (!/^[A-Z]{2}$/.test(t)) throw new Error(`${ctx}: jurisdiction tag ${t}`);
    }
  }
  if (row.contentAuthenticityHint !== undefined && !CA_HINT.has(row.contentAuthenticityHint)) {
    throw new Error(`${ctx}: bad contentAuthenticityHint`);
  }
  for (const arrName of [
    "tags",
    "cweIds",
    "e2eSpecPaths",
    "relatedArtifactIds",
    "aiGovernanceFramework",
    "languageRuntimeTags",
    "peripheralApiTags",
    "filesystemStorageTags",
    "mlOpsToolTags",
    "formalMethodTags",
    "serializationFormatTags",
    "rpcContractTags",
    "nodeRuntimeTags",
  ]) {
    const a = row[arrName];
    if (!a) continue;
    if (!Array.isArray(a) || a.length > 32) throw new Error(`${ctx}: ${arrName} array bounds`);
    for (const x of a) {
      if (typeof x !== "string" || x.length > 256) throw new Error(`${ctx}: ${arrName} item`);
    }
  }
  if (row.cweIds) {
    for (const c of row.cweIds) {
      if (!/^CWE-[0-9]+$/.test(c)) throw new Error(`${ctx}: bad cweId ${c}`);
    }
  }
}

const ALLOWED_KEYS = new Set([
  "id",
  "title",
  "list",
  "sectionPath",
  "layer",
  "implementation",
  "partition",
  "provenanceMeta",
  "deprecated",
  "equivalenceGroup",
  "deprecatedBy",
  "supersedes",
  "notes",
  "stubClass",
  "implementationHint",
  "detectability",
  "blastRadius",
  "privacyRisk",
  "tags",
  "cweIds",
  "owaspCategory",
  "e2eSpecPaths",
  "relatedArtifactIds",
  "sbomFormat",
  "referenceUrls",
  "npmPackageName",
  "jurisdictionTags",
  "aiGovernanceFramework",
  "contentAuthenticityHint",
  "languageRuntimeTags",
  "peripheralApiTags",
  "filesystemStorageTags",
  "mlOpsToolTags",
  "formalMethodTags",
  "serializationFormatTags",
  "rpcContractTags",
  "nodeRuntimeTags",
  "artifactsPath",
  "configPath",
]);

function isAllowedKey(k) {
  return ALLOWED_KEYS.has(k);
}

function strictArtifacts(rows) {
  if (process.env.OBLIXA_STRICT_ARTIFACTS !== "1") return;
  for (const row of rows) {
    const ctx = row.id;
    if (row.artifactsPath) {
      const p = path.join(root, row.artifactsPath);
      if (!fs.existsSync(p)) {
        if (row.implementation === "stub" && row.implementationHint === "file optional") continue;
        throw new Error(`${ctx}: artifactsPath missing ${row.artifactsPath}`);
      }
      JSON.parse(fs.readFileSync(p, "utf8"));
    }
    if (row.configPath) {
      const p = path.join(root, row.configPath);
      if (!fs.existsSync(p)) {
        if (row.implementation === "stub" && row.implementationHint === "file optional") continue;
        throw new Error(`${ctx}: configPath missing ${row.configPath}`);
      }
      JSON.parse(fs.readFileSync(p, "utf8"));
    }
  }
}

function main() {
  if (!fs.existsSync(provPath)) {
    console.error("Missing provenance.json");
    process.exit(1);
  }
  const rows = JSON.parse(fs.readFileSync(provPath, "utf8"));
  if (!Array.isArray(rows)) {
    console.error("provenance.json must be an array");
    process.exit(1);
  }
  const idSet = new Set();
  rows.forEach((row, i) => validateRow(row, i, idSet));

  const byId = new Map(rows.map((r) => [r.id, r]));
  for (const row of rows) {
    if (row.deprecatedBy && !byId.has(row.deprecatedBy)) {
      console.warn(`[warn] ${row.id} deprecatedBy target missing: ${row.deprecatedBy}`);
    }
  }

  strictArtifacts(rows);
  console.log(`OK: ${rows.length} provenance row(s) validated.`);
}

main();
