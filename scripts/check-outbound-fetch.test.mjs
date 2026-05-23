import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { findOutboundFetchViolations } from "./check-outbound-fetch.mjs";

test("findOutboundFetchViolations scans routes and server actions, excluding tests", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-outbound-fetch-"));
  fs.mkdirSync(path.join(root, "scripts"), { recursive: true });
  fs.mkdirSync(path.join(root, "src", "app", "api", "demo"), { recursive: true });
  fs.mkdirSync(path.join(root, "src", "actions"), { recursive: true });
  fs.mkdirSync(path.join(root, "src", "lib", "integrations"), { recursive: true });
  fs.writeFileSync(path.join(root, "scripts", "outbound-fetch-allowlist.txt"), "");

  fs.writeFileSync(
    path.join(root, "src", "app", "api", "demo", "route.ts"),
    'import { safeFetch } from "@/lib/security/safe-fetch";\nexport async function GET() { return safeFetch("https://example.com"); }\n'
  );
  fs.writeFileSync(
    path.join(root, "src", "actions", "good.ts"),
    '"use server";\nimport { safeFetch } from "@/lib/security/safe-fetch";\nexport async function good() { return safeFetch("https://example.com"); }\n'
  );
  fs.writeFileSync(
    path.join(root, "src", "actions", "bad.ts"),
    '"use server";\nexport async function bad() { return fetch("https://example.com"); }\n'
  );
  fs.writeFileSync(
    path.join(root, "src", "lib", "integrations", "bad.ts"),
    'export async function badIntegration() { return fetch("https://example.com"); }\n'
  );
  fs.writeFileSync(
    path.join(root, "src", "actions", "bad.test.ts"),
    'import { expect } from "vitest";\nexpect("fetch(").toBe("fetch(");\n'
  );

  const result = findOutboundFetchViolations(root);

  assert.equal(result.routeFilesChecked, 1);
  assert.equal(result.actionFilesChecked, 2);
  assert.equal(result.integrationFilesChecked, 1);
  assert.deepEqual(result.violations.sort(), ["actions/bad.ts", "lib/integrations/bad.ts"].sort());
});