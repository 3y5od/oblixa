import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { analyzeClientStorageSensitivity } from "./check-client-storage-sensitivity.mjs";

function write(root, rel, content) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
}

function writeStorageHelper(root) {
  write(
    root,
    "src/lib/security/client-storage.ts",
    [
      "const CLIENT_STORAGE_JSON_MAX_LENGTH = 4096;",
      "function readStoredJson(parsed) {",
      "  hasUnsafeJsonKey(parsed);",
      "  isJsonShapeWithinLimits(parsed, {});",
      "}",
      "export function readCommandPaletteRecentCommands() {}",
      "export function readUploadMetadataDraft() {}",
      "export function writeContractTableSelection() {}",
      "export function clearUploadMetadataDraft() {}",
    ].join("\n")
  );
}

test("analyzeClientStorageSensitivity accepts approved UI and ephemeral storage keys", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-storage-ok-"));
  writeStorageHelper(root);
  write(root, "src/components/layout/sidebar.tsx", "readSidebarCollapsedPreference();\n");
  write(root, "src/components/layout/command-palette.tsx", "writeCommandPaletteRecentCommands(next);\n");
  write(root, "src/components/contracts/contract-table.tsx", "writeContractTableSelection(orgId, selected);\n");
  write(root, "src/components/contracts/upload-form.tsx", "writeUploadMetadataDraft(orgId, metadata);\n");

  const report = analyzeClientStorageSensitivity(root);
  assert.equal(report.ok, true, JSON.stringify(report.issues, null, 2));
  assert.equal(report.issueCount, 0);
});

test("analyzeClientStorageSensitivity rejects sensitive key names", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-storage-key-"));
  writeStorageHelper(root);
  write(root, "src/components/bad.tsx", 'window.localStorage.setItem("oblixa.session.token", token);\n');

  const report = analyzeClientStorageSensitivity(root);
  assert.equal(report.ok, false);
  assert.equal(report.issues.some((issue) => issue.issue === "direct_client_storage_access"), true);
  assert.equal(report.issues.some((issue) => issue.issue === "sensitive_storage_key"), true);
});

test("analyzeClientStorageSensitivity rejects sensitive stored values", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-storage-value-"));
  writeStorageHelper(root);
  write(root, "src/components/bad.tsx", 'window.localStorage.setItem("oblixa.sidebar.collapsed", signedUrl);\n');

  const report = analyzeClientStorageSensitivity(root);
  assert.equal(report.ok, false);
  assert.equal(report.issues.some((issue) => issue.issue === "direct_client_storage_access"), true);
  assert.equal(report.issues.some((issue) => issue.issue === "sensitive_storage_value"), true);
});

test("analyzeClientStorageSensitivity rejects unapproved app storage keys", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-storage-unapproved-"));
  writeStorageHelper(root);
  write(root, "src/components/bad.tsx", 'window.sessionStorage.setItem("oblixa.unreviewed", "1");\n');

  const report = analyzeClientStorageSensitivity(root);
  assert.equal(report.ok, false);
  assert.equal(report.issues.some((issue) => issue.issue === "direct_client_storage_access"), true);
  assert.equal(report.issues.some((issue) => issue.issue === "unapproved_storage_key"), true);
});

test("analyzeClientStorageSensitivity rejects missing bounded storage helper markers", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-storage-helper-"));
  write(root, "src/lib/security/client-storage.ts", "export function readCommandPaletteRecentCommands() {}\n");

  const report = analyzeClientStorageSensitivity(root);
  assert.equal(report.ok, false);
  assert.equal(report.issues.some((issue) => issue.issue === "missing_client_storage_helper_marker"), true);
});
