import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { analyzeOriginReferrerEnforcement } from "./check-origin-referrer-enforcement.mjs";

function write(root, rel, content) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
}

test("analyzeOriginReferrerEnforcement validates live Sec-Fetch-Site mutation guards", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-origin-referrer-"));
  write(root, "package.json", JSON.stringify({ scripts: { "check:origin-referrer-enforcement": "x" } }));
  write(root, ".github/workflows/ci.yml", "npm run check:origin-referrer-enforcement\n");
  write(root, "scripts/pipelines/pipeline-security-comprehensive.mjs", '"check:origin-referrer-enforcement"\n');
  write(root, "src/lib/security/sec-fetch-policy.ts", 'BROWSER_SAME_ORIGIN_MUTATION_HEADER = "x-oblixa-browser-mutation"\nBROWSER_SAME_ORIGIN_MUTATION_VALUE = "same-origin"\nconst LOCALHOST_EQUIVALENT_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);\nfunction originMatchesRequestOrigin(candidateOrigin: string, requestOrigin: string): boolean {\n}\nexport function secFetchSiteAllowsSensitiveMutation(request: Request): boolean {\nif (method === "GET" || method === "HEAD" || method === "OPTIONS") return true;\nconst requestOrigin = new URL(request.url).origin;\nconst origin = request.headers.get("origin")?.trim();\nif (!originMatchesRequestOrigin(new URL(origin).origin, requestOrigin)) return false;\nconst referer = request.headers.get("referer")?.trim();\nif (!originMatchesRequestOrigin(new URL(referer).origin, requestOrigin)) return false;\nconst site = request.headers.get("sec-fetch-site")?.toLowerCase().trim();\nif (!origin && !referer && !site) return explicitSameOriginMutation;\nif (site === "same-origin" || site === "same-site") return true;\nif (site === "none") return true;\nif (site) return false;\n}\n');
  write(root, "src/lib/security/sec-fetch-policy.test.ts", 'it("allows GET regardless of Sec-Fetch-Site", () => {})\nit("blocks cross-site POST", () => {})\nit("blocks POST when browser-origin metadata is absent", () => {})\nit("allows explicit same-origin browser mutations when browser metadata is stripped", () => {})\nit("blocks cross-site Origin values", () => {})\nit("allows equivalent localhost origins on the same protocol and port", () => {})\nit("blocks localhost-equivalent origins when protocol or port differs", () => {})\nit("blocks hostile Referer when Origin is absent", () => {})\nit("allows explicit browser user activation requests", () => {})\nit("blocks cross-site form-style submissions", () => {})\n');
  write(root, "src/app/api/programs/route.ts", 'import { secFetchSiteAllowsSensitiveMutation } from "@/lib/security/sec-fetch-policy";\nif (!secFetchSiteAllowsSensitiveMutation(request)) {\ncode: "cross_site_request_rejected"\n}\n');
  write(root, "src/app/api/extract/route.ts", 'import { secFetchSiteAllowsSensitiveMutation } from "@/lib/security/sec-fetch-policy";\nif (!secFetchSiteAllowsSensitiveMutation(request)) {\ncode: "cross_site_request_rejected"\n}\n');
  write(root, "src/proxy.ts", 'import { secFetchSiteAllowsSensitiveMutation } from "@/lib/security/sec-fetch-policy";\nconst MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);\nfunction isBrowserOriginPolicyExemptApiPath(pathname: string): boolean {\npathname.startsWith("/api/cron/")\npathname.startsWith("/api/webhooks/")\npathname.startsWith("/api/external-actions/")\npathname === "/api/stripe/webhook"\npathname === "/api/integrations/actions/callback"\n}\nrequiresBrowserOriginPolicy(request, pathname)\nsecFetchSiteAllowsSensitiveMutation(request)\ncode: "cross_site_request_rejected"\n');

  const report = analyzeOriginReferrerEnforcement(root);
  assert.equal(report.ok, true);
  assert.equal(report.issueCount, 0);
});
