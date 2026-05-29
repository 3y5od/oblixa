import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  buildOperationalGovernanceOwnershipReport,
  stableReportChecksum,
} from "./check-operational-governance-ownership.mjs";

function write(root, rel, text) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, text);
}

function writeJson(root, rel, value) {
  write(root, rel, `${JSON.stringify(value, null, 2)}\n`);
}

test("stableReportChecksum ignores configured volatile keys", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-governance-checksum-"));
  writeJson(root, "artifacts/report.json", { generatedAt: "2026-01-01T00:00:00.000Z", rows: [{ b: 2, a: 1 }] });
  const first = stableReportChecksum(root, "artifacts/report.json", new Set(["generatedAt"]));

  writeJson(root, "artifacts/report.json", { rows: [{ a: 1, b: 2 }], generatedAt: "2099-01-01T00:00:00.000Z" });
  const second = stableReportChecksum(root, "artifacts/report.json", new Set(["generatedAt"]));

  assert.equal(first.stableSha256, second.stableSha256);
  assert.equal(first.stableBytes, second.stableBytes);
});

test("buildOperationalGovernanceOwnershipReport maps objectives routes providers artifacts and CODEOWNERS", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-governance-ownership-"));
  writeJson(root, "package.json", {
    scripts: {
      "check:operational-governance-ownership": "node scripts/check-operational-governance-ownership.mjs",
      "write:operational-governance-ownership": "node scripts/check-operational-governance-ownership.mjs --write",
      "test:operational-governance-ownership": "node --test scripts/check-operational-governance-ownership.test.mjs",
      "check:codeowners-security-paths": "node scripts/check-codeowners-security-paths.mjs",
      "check:ci-change-impact": "node scripts/check-ci-change-impact.mjs --strict",
      "check:security-report-checksums": "node scripts/check-security-report-checksums.mjs",
      "check:api-route-auth-contract": "node scripts/check-api-route-auth-contract.mjs",
      "check:operational-provider-integrations": "node scripts/check-operational-provider-integrations.mjs",
      "write:security": "node scripts/write-security.mjs",
      "write:example": "node scripts/write-example.mjs",
    },
  });
  write(root, ".github/CODEOWNERS", "src/lib/security/ @security\n.github/workflows/ @security\n.github/CODEOWNERS @security\npackage.json @security\nartifacts/ @security\nconfig/ @security\n");
  write(root, ".github/workflows/ci.yml", "run: npm run check:operational-governance-ownership\n");
  write(root, "src/lib/security/index.ts", "export const ok = true;\n");
  writeJson(root, "config/operational-hardening-objectives.json", {
    objectives: [
      {
        id: "oph-test",
        section: "Test",
        ownerArea: "platform-security",
        status: "implemented",
        validationCommand: "check:codeowners-security-paths",
      },
    ],
  });
  writeJson(root, "config/operational-package-pipelines.json", {
    generatedArtifactOwnerRules: [{ prefix: "artifacts/", ownerArea: "platform-security", cleanupPolicy: "regenerate-on-check-drift" }],
  });
  writeJson(root, "artifacts/route-universe.json", {
    routes: [{ route: "/api/test", sourcePath: "src/app/api/test/route.ts", class: "api", owner: "security", providers: ["supabase"] }],
  });
  writeJson(root, "artifacts/example.json", { ok: true });
  writeJson(root, "artifacts/security.json", { generatedAt: "ignored", ok: true });
  writeJson(root, "config/operational-governance-ownership.json", {
    schemaVersion: 1,
    source: "code-owned-operational-governance-ownership",
    generatedArtifact: "artifacts/operational-governance-ownership.json",
    requiredCommands: [
      "check:operational-governance-ownership",
      "write:operational-governance-ownership",
      "test:operational-governance-ownership",
      "check:codeowners-security-paths",
      "check:ci-change-impact",
      "check:security-report-checksums",
    ],
    requiredOwnerAreaIds: ["security"],
    ownerAreas: [
      {
        id: "security",
        label: "Security",
        codeowners: ["@security"],
        coveredOwnerAreas: ["platform-security"],
        routeOwners: ["security"],
        validationCommands: ["check:codeowners-security-paths"],
      },
    ],
    routeFamilyOwners: [{ family: "api", ownerArea: "security", validationCommand: "check:api-route-auth-contract" }],
    providerOwners: [{ provider: "supabase", ownerArea: "security", validationCommand: "check:operational-provider-integrations" }],
    requiredSensitivePathCategories: ["security"],
    sensitivePathOwners: [{ category: "security", path: "src/lib/security/", ownerArea: "security", reason: "security helpers" }],
    changeImpact: {
      requiredRiskAreas: ["api_routes"],
      syntheticChanges: [
        {
          path: "src/app/api/test/route.ts",
          expectedRiskAreas: ["api_routes"],
          expectedChecks: ["check:api-route-auth-contract"],
        },
      ],
    },
    reportChecksums: {
      volatileKeysIgnored: ["generatedAt"],
      requiredCategories: ["security"],
      reports: [{ id: "security", category: "security", path: "artifacts/security.json", generator: "npm run write:security" }],
    },
  });

  const report = buildOperationalGovernanceOwnershipReport(root, {
    generatedArtifactPaths: ["artifacts/example.json"],
    deterministicArtifactPaths: ["artifacts/example.json"],
    generatedArtifactWriteCommands: { "artifacts/example.json": "npm run write:example" },
    skipArtifactDrift: true,
  });

  assert.equal(report.ok, true);
  assert.equal(report.objectiveOwnerCoverage.coveredObjectiveCount, 1);
  assert.equal(report.routeProviderOwnership.providerCount, 1);
  assert.equal(report.generatedArtifactOwnership.ownedArtifactCount, 1);
  assert.equal(report.codeownersParity.coveredSensitivePathCount, 1);
  assert.equal(report.governanceReportChecksums.reportCount, 1);
});
