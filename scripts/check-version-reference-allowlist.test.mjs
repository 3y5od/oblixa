import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { analyzeVersionReferenceAllowlist } from "./check-version-reference-allowlist.mjs";

function makeRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "version-reference-allowlist-"));
}

function writeJson(root, rel, value) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, `${JSON.stringify(value, null, 2)}\n`);
}

test("analyzeVersionReferenceAllowlist accepts reviewed legitimate version metadata", () => {
  const root = makeRoot();
  writeJson(root, "scripts/version-reference-allowlist.json", {
    schemaVersion: 1,
    entries: [
      {
        id: "accessibility-and-css-standards",
        owner: "frontend-platform",
        reason: "Accessibility, CSS, and browser standards are external versions.",
        reviewedOn: "2026-05-23",
        pattern: "\\b(?:WCAG [0-9]+(?:\\.[0-9]+)?|CSS Color [0-9]+)\\b",
        examples: ["WCAG 2.2", "CSS Color 4"],
        surface: "browser_or_web_standard",
        validationCommand: "npm run check:version-reference-allowlist",
      },
      {
        id: "asvs-control-ids",
        owner: "platform-security",
        reason: "OWASP ASVS uses V-prefixed chapter identifiers.",
        reviewedOn: "2026-05-23",
        pattern: "\\bV(?:1[0-4]|[1-9])\\b",
        examples: ["V1", "V14"],
        surface: "security_standard",
        validationCommand: "npm run check:version-reference-allowlist",
      },
      {
        id: "cryptographic-envelope-prefixes",
        owner: "platform-security",
        reason: "Encrypted payload envelopes encode their compatibility version in the persisted prefix.",
        reviewedOn: "2026-05-23",
        pattern: "\\benc:v[0-9]+:",
        examples: ["enc:v1:", "enc:v2:"],
        surface: "cryptographic_format",
        validationCommand: "npm run check:version-reference-allowlist",
      },
      {
        id: "dependency-runtime-versions",
        owner: "release-engineering",
        reason: "Runtime and dependency versions are reproducibility inputs.",
        reviewedOn: "2026-05-23",
        pattern: "\\b(?:[Nn]ode|[Pp]ostgres):? ?v?[0-9]+(?:\\.[0-9]+){0,2}\\b",
        examples: ["node:20", "Postgres 16"],
        surface: "runtime_dependency",
        validationCommand: "npm run check:version-reference-allowlist",
      },
      {
        id: "localization-standards",
        owner: "frontend-platform",
        reason: "Locale tags and Unicode/Intl versions are language/platform standards.",
        reviewedOn: "2026-05-23",
        pattern: "\\b(?:[a-z]{2,3}-[A-Z]{2}|Unicode [0-9]+)\\b",
        examples: ["en-US", "Unicode 15"],
        surface: "localization_standard",
        validationCommand: "npm run check:version-reference-allowlist",
      },
      {
        id: "provider-endpoint-versions",
        owner: "platform-integrations",
        reason: "Provider endpoint names can include externally defined API versions.",
        reviewedOn: "2026-05-23",
        pattern: "\\boauth\\.v2\\b",
        examples: ["oauth.v2"],
        surface: "provider_endpoint",
        validationCommand: "npm run check:version-reference-allowlist",
      },
      {
        id: "provider-signature-versions",
        owner: "platform-integrations",
        reason: "Provider signatures are externally defined.",
        reviewedOn: "2026-05-23",
        pattern: "(?:\\bv0=|\\bv1=)",
        examples: ["v0=", "v1="],
        surface: "provider_signature",
        validationCommand: "npm run check:version-reference-allowlist",
      },
      {
        id: "schema-version-fields",
        owner: "platform-hardening",
        reason: "Generated artifacts need explicit schemaVersion fields.",
        reviewedOn: "2026-05-23",
        pattern: "\\bschemaVersion\\b",
        examples: ["schemaVersion"],
        surface: "schema_metadata",
        validationCommand: "npm run check:version-reference-allowlist",
      },
      {
        id: "supply-chain-standards",
        owner: "release-engineering",
        reason: "Supply-chain evidence formats use external standards.",
        reviewedOn: "2026-05-23",
        pattern: "\\b(?:SPDX [0-9]+(?:\\.[0-9]+)?|CycloneDX [0-9]+(?:\\.[0-9]+)?|SLSA [0-9]+|SARIF [0-9]+(?:\\.[0-9]+)?|VEX [0-9]+(?:\\.[0-9]+)?)\\b",
        examples: ["CycloneDX 1.5", "SLSA 3", "SARIF 2.1"],
        surface: "supply_chain_standard",
        validationCommand: "npm run check:version-reference-allowlist",
      },
    ],
  });

  const report = analyzeVersionReferenceAllowlist({ root });

  assert.equal(report.ok, true);
  assert.equal(report.entryCount, 9);
});

test("analyzeVersionReferenceAllowlist requires high-risk preservation examples", () => {
  const root = makeRoot();
  writeJson(root, "scripts/version-reference-allowlist.json", {
    schemaVersion: 1,
    entries: [
      {
        id: "provider-signature-versions",
        owner: "platform-integrations",
        reason: "Provider signatures are externally defined.",
        reviewedOn: "2026-05-23",
        pattern: "\\bv1=",
        examples: ["v1="],
        surface: "provider_signature",
        validationCommand: "npm run check:version-reference-allowlist",
      },
    ],
  });

  const report = analyzeVersionReferenceAllowlist({ root });

  assert.equal(report.ok, false);
  assert.ok(report.issues.some((issue) => issue.issue === "version_reference_required_preservation_example_uncovered"));
  assert.ok(report.issues.some((issue) => issue.id === "preserve-enc-v1-prefix"));
  assert.ok(report.issues.some((issue) => issue.id === "preserve-slack-v0-signature"));
});

test("analyzeVersionReferenceAllowlist rejects missing metadata and invalid patterns", () => {
  const root = makeRoot();
  writeJson(root, "scripts/version-reference-allowlist.json", {
    schemaVersion: 1,
    entries: [
      {
        id: "bad",
        owner: "",
        reason: "missing owner",
        reviewedOn: "not-a-date",
        pattern: "[",
        examples: [],
        surface: "test",
        validationCommand: "",
      },
    ],
  });

  const report = analyzeVersionReferenceAllowlist({ root });

  assert.equal(report.ok, false);
  assert.ok(report.issues.some((issue) => issue.issue === "version_reference_allowlist_missing_metadata"));
  assert.ok(report.issues.some((issue) => issue.issue === "invalid_version_reference_allowlist_pattern"));
  assert.ok(report.issues.some((issue) => issue.issue === "version_reference_allowlist_missing_examples"));
  assert.ok(report.issues.some((issue) => issue.issue === "version_reference_allowlist_invalid_review_date"));
});

test("analyzeVersionReferenceAllowlist rejects stale examples and product phase entries", () => {
  const root = makeRoot();
  writeJson(root, "scripts/version-reference-allowlist.json", {
    schemaVersion: 1,
    entries: [
      {
        id: "product-phase",
        owner: "platform-hardening",
        reason: "Product phase labels must be queued rather than allowlisted.",
        reviewedOn: "2026-05-23",
        pattern: "\\bv[0-9]+\\b",
        examples: ["current-release"],
        surface: "product_phase",
        validationCommand: "npm run check:version-reference-allowlist",
      },
    ],
  });

  const report = analyzeVersionReferenceAllowlist({ root });

  assert.equal(report.ok, false);
  assert.ok(report.issues.some((issue) => issue.issue === "version_reference_allowlist_example_not_matched"));
  assert.ok(report.issues.some((issue) => issue.issue === "product_phase_version_reference_requires_removal_queue"));
});
