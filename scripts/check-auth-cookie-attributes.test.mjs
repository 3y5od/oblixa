import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { analyzeAuthCookieAttributes } from "./check-auth-cookie-attributes.mjs";

function write(root, rel, content) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
}

test("analyzeAuthCookieAttributes validates cookie attribute surfaces", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-auth-cookies-"));
  write(root, "package.json", JSON.stringify({ scripts: { "check:auth-cookie-attributes": "x" } }));
  write(root, ".github/workflows/ci.yml", "npm run check:auth-cookie-attributes\n");
  write(root, "scripts/pipelines/pipeline-security-comprehensive.mjs", '"check:auth-cookie-attributes"\n');
  write(root, "src/app/api/settings/step-up/route.ts", 'jar.set(STEP_UP_COOKIE_NAME, token, {\nhttpOnly: true,\nsameSite: "lax",\nsecure: process.env.NODE_ENV === "production",\npath: "/",\nmaxAge: 600,\n});\n');
  write(root, "src/actions/workflow-config.ts", 'cookieStore.set("oblixa_new_api_key_token", res.token, {\nhttpOnly: true,\nsecure: process.env.NODE_ENV === "production",\nsameSite: "lax",\nmaxAge: 300,\npath: "/settings/operations",\n});\n');
  write(root, "src/lib/supabase/server.ts", 'cookiesToSet.forEach(({ name, value, options }) =>\ncookieStore.set(name, value, options)\n');
  write(root, "src/proxy.ts", 'request.cookies.set(name, value)\nsupabaseResponse.cookies.set(name, value, options)\n');

  const report = analyzeAuthCookieAttributes(root);
  assert.equal(report.ok, true);
  assert.equal(report.issueCount, 0);
});