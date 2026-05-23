import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildSecurityProxyMatrix, writeSecurityProxyMatrix } from "./report-security-proxy-matrix.mjs";

function makeRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-security-proxy-"));
  fs.mkdirSync(path.join(root, "src/lib/auth"), { recursive: true });
  fs.mkdirSync(path.join(root, "src/lib/marketing"), { recursive: true });
  fs.mkdirSync(path.join(root, "artifacts"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "src/lib/auth/proxy-path-policy.ts"),
    'const publicRoutes = ["/", "/sign-in"] as const;\n'
  );
  fs.writeFileSync(
    path.join(root, "src/lib/marketing/public-paths.ts"),
    [
      'export const PUBLIC_INFORMATION_PATHS = ["/pricing", "/security"] as const;',
      'export const SITEMAP_PATHS = ["/", "/pricing", "/security"] as const;',
      "",
    ].join("\n")
  );
  fs.writeFileSync(
    path.join(root, "artifacts/security-route-matrix.json"),
    JSON.stringify(
      [
        { path: "/api/private", public_guess: false },
        { path: "/api/public-b", public_guess: true },
        { path: "/api/public-a", public_guess: true },
      ],
      null,
      2
    )
  );
  return root;
}

test("security proxy matrix builder emits deterministic schema without timestamps", () => {
  const root = makeRoot();
  const doc = buildSecurityProxyMatrix(root);

  assert.equal(doc.version, 1);
  assert.equal(Object.hasOwn(doc, "generated_at"), false);
  assert.deepEqual(doc.sources, [
    "src/lib/auth/proxy-path-policy.ts",
    "src/lib/marketing/public-paths.ts",
  ]);
  assert.deepEqual(doc.unauthenticated_rules.public_auth_surface_paths, ["/", "/sign-in"]);
  assert.deepEqual(doc.marketing_sitemap_paths, ["/", "/pricing", "/security"]);
  assert.deepEqual(doc.api_routes_flagged_public_guess, ["/api/public-a", "/api/public-b"]);
});

test("security proxy matrix writer appends a trailing newline", () => {
  const root = makeRoot();
  const outputPath = path.join(root, "artifacts/security-proxy-matrix.json");
  writeSecurityProxyMatrix(root, outputPath);

  assert.equal(fs.readFileSync(outputPath, "utf8").endsWith("\n"), true);
});
