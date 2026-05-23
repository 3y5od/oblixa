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
  write(root, "src/lib/security/safe-fetch.ts", "const SAFE_FETCH_MAX_TIMEOUT_MS = 30000;\nfunction normalizeSafeFetchTimeoutMs(){}\nfunction stripIpv6Brackets(){}\nexport function isBlockedOutboundIpv4(){}\nexport function isBlockedOutboundIp(){ return \"2001:db8::\" && \"fe80::\"; }\nexport function createPinnedDnsLookupForSafeFetch(){}\nexport async function safeFetch(){ dns.lookup(hostname); new Agent({}); const allowLocalhostInDev = true; if (rest.redirect) throw new Error(\"safeFetch: redirect following is disabled\"); if (res.headers.has(\"location\")) throw new Error(\"safeFetch: redirect response blocked\"); fetchInit.dispatcher = dispatcher; return fetch('https://x.test', { redirect: \"manual\" }); }\n");
  write(root, "src/lib/security/safe-fetch.test.ts", "blocks loopback and private IPv4\nblocks IPv6 documentation, compatibility, and translation ranges\nallows localhost only in non-production dev when explicitly requested\nrejects DNS resolution to blocked IPs before fetch\nrejects bracketed IPv6 loopback before DNS resolution\nrejects DNS resolution to blocked IPv6 ranges before fetch\npins DNS result for dispatcher lookup to prevent rebinding\nforces manual redirects and rejects explicit redirect following\nrejects redirect responses with Location headers\naborts outbound calls after the configured timeout\n");
  write(root, "src/lib/security/url-policy.ts", "function isPrivateIpLiteral(){ return ipv6MatchesPrefix(\"2001:db8::\", \"fe80::\", 10); }\nexport function validateOutboundHttpUrl(){ const host=''; const a=224; if (host === \"localhost\") return null; return a >= 224; }\n");
  write(root, "src/lib/security/url-policy.test.ts", "rejects localhost and private IPv4 literals\nrejects IPv6 documentation, translation, and link-local variants\nrejects non-http(s) schemes and malformed input\nrejects encoded and unusual localhost URL forms\n");

  const report = analyzeSsrfGuards(root);
  assert.equal(report.ok, true);
  assert.equal(report.issueCount, 0);
});
