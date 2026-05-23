import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { analyzeTrustedHostHandling } from "./check-trusted-host-handling.mjs";

function write(root, rel, content) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
}

test("analyzeTrustedHostHandling validates forwarded-host origin derivation and tests", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-trusted-host-"));
  write(root, "package.json", JSON.stringify({ scripts: { "check:trusted-host-handling": "x" } }));
  write(root, ".github/workflows/ci.yml", "npm run check:trusted-host-handling\n");
  write(root, "scripts/pipelines/pipeline-security-comprehensive.mjs", '"check:trusted-host-handling"\n');
  write(root, "src/lib/security/trusted-origin.ts", "OBLIXA_TRUSTED_APP_ORIGINS\nexport function resolveTrustedOriginFromHeaders\nexport function resolveTrustedOriginFromRequest\nexport function isTrustedAppOrigin\nisProductionLikeOriginEnv\n");
  write(root, "src/lib/security/trusted-forwarded.ts", "export function getTrustedPublicOriginFromRequest(request: Request){}\nresolveTrustedOriginFromRequest(request)\ngetCanonicalTrustedAppOriginFromEnv()\nMissing trusted public origin\n");
  write(root, "src/lib/security/trusted-forwarded.test.ts", "prefers x-forwarded-proto and x-forwarded-host when present\nfalls back to request URL when forwards absent\nignores untrusted forwarded hosts in production\n");
  write(root, "src/lib/app-url.ts", "resolveTrustedOriginFromHeaders(h)\ngetCanonicalTrustedAppOriginFromEnv\nMissing trusted app origin\n");
  write(root, "src/lib/app-url.test.ts", "prefers x-forwarded-host and x-forwarded-proto when present\nrejects untrusted forwarded hosts in production\naccepts allowlisted forwarded hosts in production\n");

  const report = analyzeTrustedHostHandling(root);
  assert.equal(report.ok, true);
  assert.equal(report.issueCount, 0);
});
