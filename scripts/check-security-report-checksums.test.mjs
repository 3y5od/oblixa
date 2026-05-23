import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  SECURITY_REPORT_CHECKSUM_ARTIFACTS,
  analyzeSecurityReportChecksums,
  buildSecurityReportChecksumManifest,
} from "./check-security-report-checksums.mjs";

function writeJson(root, rel, value) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, JSON.stringify(value, null, 2) + "\n");
}

function seedRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-security-checksums-"));
  for (const rel of SECURITY_REPORT_CHECKSUM_ARTIFACTS) {
    writeJson(root, rel, {
      generatedAt: "2000-01-01T00:00:00.000Z",
      generated_at: "2000-01-01T00:00:00.000Z",
      generated: "2000-01-01T00:00:00.000Z",
      path: rel,
      rows: [{ id: rel, value: 1 }],
    });
  }
  return root;
}

test("security report checksum analyzer ignores volatile generated timestamps", () => {
  const root = seedRoot();
  writeJson(root, "artifacts/security-report-checksums.json", buildSecurityReportChecksumManifest(root));

  for (const rel of SECURITY_REPORT_CHECKSUM_ARTIFACTS) {
    writeJson(root, rel, {
      generatedAt: "2099-01-01T00:00:00.000Z",
      generated_at: "2099-01-01T00:00:00.000Z",
      generated: "2099-01-01T00:00:00.000Z",
      path: rel,
      rows: [{ id: rel, value: 1 }],
    });
  }

  assert.deepEqual(analyzeSecurityReportChecksums(root).issues, []);
});

test("security report checksum analyzer rejects stable content drift", () => {
  const root = seedRoot();
  writeJson(root, "artifacts/security-report-checksums.json", buildSecurityReportChecksumManifest(root));

  writeJson(root, SECURITY_REPORT_CHECKSUM_ARTIFACTS[0], {
    path: SECURITY_REPORT_CHECKSUM_ARTIFACTS[0],
    rows: [{ id: "changed", value: 2 }],
  });

  const report = analyzeSecurityReportChecksums(root);
  assert.equal(report.ok, false);
  assert.equal(report.issues.some((issue) => issue.issue === "security_report_checksum_drift"), true);
});
