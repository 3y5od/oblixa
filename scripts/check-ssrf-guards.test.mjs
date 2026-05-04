import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { analyzeSsrfGuards } from "./check-ssrf-guards.mjs";

function write(root, rel, content) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
}

test("analyzeSsrfGuards validates SSRF guard wiring and source markers", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-ssrf-guards-"));
  write(root, "package.json", JSON.stringify({ scripts: { "check:outbound-fetch": "x", "check:outbound-domain-allowlist": "x", "check:ssrf-guards": "x" } }));
  write(root, ".github/workflows/ci.yml", "npm run check:outbound-fetch\nnpm run check:outbound-domain-allowlist\nnpm run check:ssrf-guards\n");
  write(root, "scripts/pipelines/pipeline-security-comprehensive.mjs", '"check:outbound-fetch"\n"check:outbound-domain-allowlist"\n"check:ssrf-guards"\n');
  write(root, "scripts/check-outbound-fetch.mjs", "export {};\n");
  write(root, "scripts/check-outbound-domain-allowlist.mjs", "export {};\n");
  write(root, "src/lib/security/safe-fetch.ts", "export function isBlockedOutboundIpv4(){}\nexport function isBlockedOutboundIp(){}\nexport async function safeFetch(){ dns.lookup(url.hostname); const allowLocalhostInDev = true; return fetch('https://x.test'); }\n");
  write(root, "src/lib/security/safe-fetch.test.ts", "blocks loopback and private IPv4\nallows localhost only in non-production dev when explicitly requested\n");
  write(root, "src/lib/security/url-policy.ts", "function isPrivateIpLiteral(){}\nexport function validateOutboundHttpUrl(){ const host=''; if (host === \"localhost\") return null; }\n");
  write(root, "src/lib/security/url-policy.test.ts", "rejects localhost and private IPv4 literals\nrejects non-http(s) schemes and malformed input\n");

  const report = analyzeSsrfGuards(root);
  assert.equal(report.ok, true);
  assert.equal(report.issueCount, 0);
});