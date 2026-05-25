#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.join(__dirname, "..");
const DEFAULT_ALLOWLIST_REL = "scripts/version-reference-allowlist.json";
const REQUIRED_PRESERVATION_EXAMPLES = [
  {
    id: "preserve-enc-v1-prefix",
    example: "enc:v1:",
    surfaces: ["cryptographic_format"],
    reason: "Encrypted payload envelope prefixes are persisted compatibility markers.",
  },
  {
    id: "preserve-enc-v2-prefix",
    example: "enc:v2:",
    surfaces: ["cryptographic_format"],
    reason: "Encrypted payload envelope prefixes are persisted compatibility markers.",
  },
  {
    id: "preserve-slack-v0-signature",
    example: "v0=",
    surfaces: ["provider_signature"],
    reason: "Slack webhook signatures include an externally defined version prefix.",
  },
  {
    id: "preserve-stripe-v1-signature",
    example: "v1=",
    surfaces: ["provider_signature"],
    reason: "Stripe webhook signatures include an externally defined version prefix.",
  },
  {
    id: "preserve-oauth-v2-endpoint",
    example: "oauth.v2",
    surfaces: ["provider_endpoint", "provider_protocol"],
    reason: "Provider endpoint names can include externally defined API versions.",
  },
  {
    id: "preserve-schema-version-field",
    example: "schemaVersion",
    surfaces: ["schema_metadata"],
    reason: "Generated artifact schemaVersion fields are compatibility metadata.",
  },
  {
    id: "preserve-asvs-control-ids",
    example: "V14",
    surfaces: ["security_standard"],
    reason: "OWASP ASVS control IDs are standards references.",
  },
  {
    id: "preserve-spdx-cyclonedx-slsa-sarif-vex-versions",
    example: "CycloneDX 1.5",
    surfaces: ["supply_chain_standard"],
    reason: "Supply-chain schemas and evidence formats use standards-owned versions.",
  },
  {
    id: "preserve-node-postgres-runtime-versions",
    example: "node:20",
    surfaces: ["runtime_dependency"],
    reason: "Runtime and database versions are reproducibility inputs.",
  },
  {
    id: "preserve-bcp47-locale-tags",
    example: "en-US",
    surfaces: ["localization_standard"],
    reason: "Language and locale tags are standards-owned identifiers.",
  },
  {
    id: "preserve-wcag-css-color-versions",
    example: "WCAG 2.2",
    surfaces: ["browser_or_web_standard", "security_standard"],
    reason: "Accessibility and CSS standards use externally defined versions.",
  },
  {
    id: "preserve-unicode-intl-versions",
    example: "Unicode 15",
    surfaces: ["localization_standard", "browser_or_web_standard"],
    reason: "Unicode and Intl references are standards-owned versions.",
  },
];

function readJson(abs) {
  return JSON.parse(fs.readFileSync(abs, "utf8"));
}

function stableStringify(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function analyzeVersionReferenceAllowlist(options = {}) {
  const root = options.root ?? DEFAULT_ROOT;
  const allowlistRel = options.allowlistRel ?? DEFAULT_ALLOWLIST_REL;
  const abs = path.join(root, allowlistRel);
  const issues = [];

  if (!fs.existsSync(abs)) {
    return {
      ok: false,
      allowlistPath: allowlistRel,
      entryCount: 0,
      issueCount: 1,
      issues: [{ issue: "version_reference_allowlist_missing", path: allowlistRel }],
    };
  }

  const allowlist = readJson(abs);
  if (allowlist.schemaVersion !== 1 || !Array.isArray(allowlist.entries)) {
    issues.push({ issue: "invalid_version_reference_allowlist_schema", path: allowlistRel });
  }

  const ids = new Set();
  for (const [index, entry] of (allowlist.entries ?? []).entries()) {
    for (const key of ["id", "owner", "reason", "reviewedOn", "pattern", "surface", "validationCommand"]) {
      if (typeof entry[key] !== "string" || entry[key].trim() === "") {
        issues.push({ issue: "version_reference_allowlist_missing_metadata", index, key, id: entry.id ?? null });
      }
    }
    if (entry.reviewedOn && Number.isNaN(Date.parse(entry.reviewedOn))) {
      issues.push({ issue: "version_reference_allowlist_invalid_review_date", index, id: entry.id ?? null });
    }
    if (ids.has(entry.id)) {
      issues.push({ issue: "duplicate_version_reference_allowlist_id", index, id: entry.id });
    }
    ids.add(entry.id);
    try {
      new RegExp(entry.pattern, "u");
    } catch (error) {
      issues.push({ issue: "invalid_version_reference_allowlist_pattern", index, id: entry.id ?? null, message: error.message });
    }
    if (!Array.isArray(entry.examples) || entry.examples.length === 0) {
      issues.push({ issue: "version_reference_allowlist_missing_examples", index, id: entry.id ?? null });
    } else {
      try {
        const pattern = new RegExp(entry.pattern, "u");
        for (const example of entry.examples) {
          if (typeof example !== "string" || !pattern.test(example)) {
            issues.push({ issue: "version_reference_allowlist_example_not_matched", index, id: entry.id ?? null, example });
          }
        }
      } catch {
        // The invalid pattern issue above is clearer than duplicate example errors.
      }
    }
    if (/product[_ -]?phase|release[_ -]?phase/iu.test(entry.surface ?? "")) {
      issues.push({
        issue: "product_phase_version_reference_requires_removal_queue",
        index,
        id: entry.id ?? null,
        hint: "Product phase labels are version-name debt; track them in scripts/versioned-naming-removal-queue.json instead of the legitimate-version allowlist.",
      });
    }
  }

  const sorted = {
    ...allowlist,
    entries: [...(allowlist.entries ?? [])].sort((a, b) => String(a.id).localeCompare(String(b.id))),
  };
  if (stableStringify(sorted) !== stableStringify(allowlist)) {
    issues.push({ issue: "version_reference_allowlist_not_deterministic", path: allowlistRel });
  }

  for (const required of REQUIRED_PRESERVATION_EXAMPLES) {
    const covered = (allowlist.entries ?? []).some((entry) => {
      if (!required.surfaces.includes(entry.surface)) return false;
      try {
        return new RegExp(entry.pattern, "u").test(required.example);
      } catch {
        return false;
      }
    });
    if (!covered) {
      issues.push({
        issue: "version_reference_required_preservation_example_uncovered",
        id: required.id,
        example: required.example,
        surfaces: required.surfaces,
        reason: required.reason,
      });
    }
  }

  return {
    ok: issues.length === 0,
    allowlistPath: allowlistRel,
    entryCount: allowlist.entries?.length ?? 0,
    issueCount: issues.length,
    issues,
  };
}

function parseArgs(argv) {
  const options = { root: DEFAULT_ROOT, allowlistRel: DEFAULT_ALLOWLIST_REL };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--root") {
      options.root = path.resolve(argv[index + 1] ?? "");
      index += 1;
    } else if (arg.startsWith("--root=")) {
      options.root = path.resolve(arg.slice("--root=".length));
    } else if (arg === "--allowlist") {
      options.allowlistRel = argv[index + 1] ?? DEFAULT_ALLOWLIST_REL;
      index += 1;
    } else if (arg.startsWith("--allowlist=")) {
      options.allowlistRel = arg.slice("--allowlist=".length);
    }
  }
  return options;
}

export function runVersionReferenceAllowlistCheck(options = parseArgs(process.argv.slice(2))) {
  const report = analyzeVersionReferenceAllowlist(options);
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exitCode = 1;
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runVersionReferenceAllowlistCheck();
}
