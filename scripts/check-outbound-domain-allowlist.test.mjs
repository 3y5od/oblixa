import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  analyzeOutboundDomainAllowlist,
  fileHasAcceptedSafeFetchUrlSource,
  fileUsesSafeFetch,
} from "./check-outbound-domain-allowlist.mjs";

test("safeFetch source helpers recognize validated and trusted sources", () => {
  assert.equal(fileUsesSafeFetch('import { safeFetch } from "@/lib/security/safe-fetch";\nsafeFetch("https://x.test");'), true);
  assert.deepEqual(fileHasAcceptedSafeFetchUrlSource("const url = validateOutboundHttpUrl(raw);"), {
    ok: true,
    reason: "validated_dynamic_url",
  });
  assert.deepEqual(fileHasAcceptedSafeFetchUrlSource("const { url } = getSupabasePublicEnv();"), {
    ok: true,
    reason: "trusted_supabase_env",
  });
  assert.deepEqual(
    fileHasAcceptedSafeFetchUrlSource("const appUrl = await resolveAppBaseUrl();\nsafeFetch(appUrl, { allowLocalhostInDev: true });"),
    { ok: true, reason: "trusted_same_app_origin" }
  );
});

test("analyzeOutboundDomainAllowlist flags only untrusted runtime safeFetch callers", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-outbound-domain-"));
  fs.mkdirSync(path.join(root, "scripts"), { recursive: true });
  fs.mkdirSync(path.join(root, "src", "app", "api", "demo"), { recursive: true });
  fs.mkdirSync(path.join(root, "src", "actions"), { recursive: true });
  fs.mkdirSync(path.join(root, "src", "lib"), { recursive: true });
  fs.writeFileSync(path.join(root, "scripts", "outbound-domain-allowlist.txt"), "");

  fs.writeFileSync(
    path.join(root, "src", "app", "api", "demo", "route.ts"),
    'import { safeFetch } from "@/lib/security/safe-fetch";\nimport { validateOutboundHttpUrl } from "@/lib/security/url-policy";\nconst url = validateOutboundHttpUrl("https://example.com");\nexport async function GET() { return safeFetch(String(url)); }\n'
  );
  fs.writeFileSync(
    path.join(root, "src", "actions", "good.ts"),
    '"use server";\nimport { safeFetch } from "@/lib/security/safe-fetch";\nimport { resolveAppBaseUrl } from "@/lib/app-url";\nexport async function good() { const appUrl = await resolveAppBaseUrl(); return safeFetch(appUrl, { allowLocalhostInDev: true }); }\n'
  );
  fs.writeFileSync(
    path.join(root, "src", "lib", "trusted-env.ts"),
    'import { safeFetch } from "@/lib/security/safe-fetch";\nimport { getSupabasePublicEnv } from "@/lib/env/server";\nconst { url } = getSupabasePublicEnv();\nexport async function call() { return safeFetch(url); }\n'
  );
  fs.writeFileSync(
    path.join(root, "src", "lib", "bad.ts"),
    'import { safeFetch } from "@/lib/security/safe-fetch";\nexport async function bad() { return safeFetch("https://example.com"); }\n'
  );
  fs.writeFileSync(
    path.join(root, "src", "lib", "bad.test.ts"),
    'import { safeFetch } from "@/lib/security/safe-fetch";\nsafeFetch("https://test.example");\n'
  );

  const report = analyzeOutboundDomainAllowlist(root);

  assert.equal(report.safeFetchFilesChecked, 4);
  assert.equal(report.violationCount, 1);
  assert.deepEqual(report.violations, [
    { file: "lib/bad.ts", reason: "missing_validated_or_trusted_url_source" },
  ]);
});