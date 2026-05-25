import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildVersionedNamingCleanupReport,
  classifyVersionedNamingSurface,
} from "./report-versioned-naming-cleanup.mjs";

function versionToken(number) {
  return `v${number}`;
}

function versionPath(prefix, number, suffix) {
  return `${prefix}/${versionToken(number)}${suffix}`;
}

function makeRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "versioned-naming-cleanup-"));
}

function writeFile(root, rel, content = "") {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
  return abs;
}

test("classifyVersionedNamingSurface groups sensitive database and API surfaces", () => {
  assert.equal(
    classifyVersionedNamingSurface(versionPath("supabase/migrations", 2, "_workflow.sql")),
    "database_migrations"
  );
  assert.equal(
    classifyVersionedNamingSurface(versionPath("src/app/api/cron", 6, "/refresh/route.ts")),
    "api_routes"
  );
  assert.equal(classifyVersionedNamingSurface("scripts/report-cleanup.mjs"), "tooling");
});

test("buildVersionedNamingCleanupReport ranks tokens, surfaces, and cleanup candidates", () => {
  const legacyToken = versionToken(4);
  const currentToken = versionToken(10);
  const baseline = {
    schemaVersion: 1,
    fileCount: 4,
    totalHits: 12,
    files: [
      {
        path: versionPath("src/app/api/cron", 10, "/refresh/route.ts"),
        total: 5,
        tokens: { [currentToken]: 5 },
        sources: { content: 4, path: 1 },
      },
      {
        path: versionPath("supabase/migrations", 4, "_legacy.sql"),
        total: 4,
        tokens: { [legacyToken]: 4 },
        sources: { content: 3, path: 1 },
      },
      {
        path: "scripts/tooling-check.mjs",
        total: 2,
        tokens: { [legacyToken]: 2 },
        sources: { content: 2 },
      },
      {
        path: versionPath("e2e", 4, "-smoke.spec.ts"),
        total: 1,
        tokens: { [legacyToken]: 1 },
        sources: { path: 1 },
      },
    ],
  };

  const report = buildVersionedNamingCleanupReport(baseline, { limit: 2 });

  assert.equal(report.baseline.totalHits, 12);
  assert.equal(report.byToken[0].name, legacyToken);
  assert.equal(report.byToken[0].total, 7);
  assert.equal(report.bySurface[0].name, "api_routes");
  assert.equal(report.cleanupCandidates.compatibilitySensitiveFiles[0].surface, "api_routes");
  assert.equal(report.cleanupCandidates.compatibilitySensitiveFiles[0].owner, "platform-api");
  assert.equal(report.cleanupCandidates.compatibilitySensitiveFiles[0].manualOnly, true);
  assert.equal(typeof report.cleanupCandidates.compatibilitySensitiveFiles[0].reason, "string");
  assert.equal(typeof report.cleanupCandidates.compatibilitySensitiveFiles[0].removalStrategy, "string");
  assert.equal(report.cleanupCandidates.lowRiskFiles.some((file) => file.path === "scripts/tooling-check.mjs"), true);
  assert.equal(report.cleanupCandidates.pathOnlyFiles[0].path, versionPath("e2e", 4, "-smoke.spec.ts"));
});

test("buildVersionedNamingCleanupReport lists zero-reference safe rename candidates", () => {
  const root = makeRoot();
  const candidatePath = versionPath("e2e", 4, "-smoke.spec.ts");
  writeFile(root, candidatePath, "test('smoke', () => {});\n");

  const report = buildVersionedNamingCleanupReport(
    {
      schemaVersion: 1,
      files: [
        {
          path: candidatePath,
          total: 1,
          tokens: { [versionToken(4)]: 1 },
          sources: { path: 1 },
        },
      ],
    },
    { root }
  );

  assert.equal(report.safeRenameCandidates.length, 1);
  assert.equal(report.safeRenameCandidates[0].path, candidatePath);
  assert.equal(report.safeRenameCandidates[0].referenceCount, 0);
  assert.deepEqual(report.safeRenameExclusions, []);
});

test("buildVersionedNamingCleanupReport excludes referenced safe rename candidates", () => {
  const root = makeRoot();
  const candidatePath = versionPath("e2e", 5, "-regression.spec.ts");
  writeFile(root, candidatePath, "test('regression', () => {});\n");
  writeFile(root, "README.md", `See ${candidatePath} before renaming.\n`);

  const report = buildVersionedNamingCleanupReport(
    {
      schemaVersion: 1,
      files: [
        {
          path: candidatePath,
          total: 1,
          tokens: { [versionToken(5)]: 1 },
          sources: { path: 1 },
        },
      ],
    },
    { root }
  );

  assert.deepEqual(report.safeRenameCandidates, []);
  assert.equal(report.safeRenameExclusions.length, 1);
  assert.equal(report.safeRenameExclusions[0].reason, "referenced_by_fixed_string");
  assert.equal(report.safeRenameExclusions[0].references[0].path, "README.md");
});

test("buildVersionedNamingCleanupReport excludes compatibility-sensitive path-only files", () => {
  const root = makeRoot();
  const routePath = versionPath("src/app/api/cron", 6, "/refresh/route.ts");
  writeFile(root, routePath, "export function GET() {}\n");

  const report = buildVersionedNamingCleanupReport(
    {
      schemaVersion: 1,
      files: [
        {
          path: routePath,
          total: 1,
          tokens: { [versionToken(6)]: 1 },
          sources: { path: 1 },
        },
      ],
    },
    { root }
  );

  assert.deepEqual(report.safeRenameCandidates, []);
  assert.equal(report.safeRenameExclusions[0].reason, "compatibility_sensitive_surface");
});
