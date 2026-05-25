import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  analyzeVersionedLocalContentRewrites,
  applyVersionedLocalContentRewrites,
  buildVersionedLocalContentRewriteManifest,
} from "./check-versioned-local-content-rewrites.mjs";

function makeRoot(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "versioned-local-content-rewrites-"));
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(root, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content);
  }
  return root;
}

function writeJson(root, rel, value) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, `${JSON.stringify(value, null, 2)}\n`);
}

test("buildVersionedLocalContentRewriteManifest plans only local copy and test-title rewrites", () => {
  const root = makeRoot({
    "docs/local-note.md": "Remove data-v10-state from local copy.\n",
    "src/lib/example.test.ts": "test('data-v10-state is rendered', () => {});\nconst persisted = 'product.v9.persisted';\n",
    "src/app/api/example/route.ts": "export const route = '/api/v10/example';\n",
  });

  const manifest = buildVersionedLocalContentRewriteManifest(root);

  assert.ok(manifest.rewrites.some((row) => row.path === "docs/local-note.md" && row.neutralValue === "data-state"));
  assert.ok(manifest.rewrites.some((row) => row.path === "src/lib/example.test.ts" && row.neutralValue === "data-state"));
  assert.equal(manifest.rewrites.some((row) => row.path === "src/app/api/example/route.ts"), false);
  assert.ok(manifest.refusals.some((row) => row.path === "src/app/api/example/route.ts" && row.reason === "manual_only_surface"));
});

test("applyVersionedLocalContentRewrites rewrites only manifest-listed local content", () => {
  const root = makeRoot({
    "src/lib/example.test.ts": "test('data-v10-state is rendered', () => {});\nconst persisted = 'data-v10-state';\n",
  });
  const manifest = buildVersionedLocalContentRewriteManifest(root);
  const applied = applyVersionedLocalContentRewrites(root, manifest);
  const rewritten = fs.readFileSync(path.join(root, "src/lib/example.test.ts"), "utf8");

  assert.equal(applied.length, 1);
  assert.match(rewritten, /data-state is rendered/u);
  assert.doesNotMatch(rewritten, /test\('data-v10-state/u);
  assert.match(rewritten, /const persisted = 'data-v10-state'/u);
});

test("analyzeVersionedLocalContentRewrites detects manifest drift", () => {
  const root = makeRoot({
    "docs/local-note.md": "Remove data-v10-state from local copy.\n",
  });
  writeJson(root, "artifacts/compatibility/versioned-local-content-rewrite-manifest.json", { stale: true });

  const report = analyzeVersionedLocalContentRewrites({ root });

  assert.equal(report.ok, false);
  assert.ok(report.issues.some((issue) => issue.issue === "versioned_local_content_rewrite_manifest_drift"));
});

test("analyzeVersionedLocalContentRewrites accepts current manifest", () => {
  const root = makeRoot({
    "src/lib/example.ts": "const format = 'enc:v1:';\n",
  });
  writeJson(
    root,
    "artifacts/compatibility/versioned-local-content-rewrite-manifest.json",
    buildVersionedLocalContentRewriteManifest(root),
  );

  const report = analyzeVersionedLocalContentRewrites({ root });

  assert.equal(report.ok, true);
  assert.equal(report.issueCount, 0);
});

test("buildVersionedLocalContentRewriteManifest preserves crypto, provider, protocol, and schema version strings", () => {
  const root = makeRoot({
    "src/lib/provider-format.test.ts": [
      "test('enc:v1: and enc:v2: envelopes remain stable', () => {});",
      "test('Slack v0= and Stripe v1= signatures remain stable', () => {});",
      "test('oauth.v2 endpoints and schemaVersion metadata remain stable', () => {});",
    ].join("\n"),
  });

  const manifest = buildVersionedLocalContentRewriteManifest(root);
  const protectedValues = ["enc:v1:", "enc:v2:", "v0=", "v1=", "oauth.v2", "schemaVersion"];

  for (const value of protectedValues) {
    assert.equal(
      manifest.rewrites.some((row) => row.oldValue === value),
      false,
      `${value} should not be rewritten`,
    );
  }
  assert.ok(
    manifest.refusals.some(
      (row) =>
        row.path === "src/lib/provider-format.test.ts" &&
        row.surfaceClass === "provider_or_crypto_format" &&
        row.reason === "manual_only_surface",
    ),
  );
});
