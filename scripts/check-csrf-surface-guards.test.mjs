import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { analyzeCsrfSurfaceGuards } from "./check-csrf-surface-guards.mjs";

function write(root, rel, content) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
}

const REQUIRED_HELPER = 'const DEFAULT_MAX = 512 * 1024;\nexport const BODY_LIMIT_SMALL_JSON = 32 * 1024;\nexport const BODY_LIMIT_MEDIUM_JSON = 256 * 1024;\nexport const BODY_LIMIT_LARGE_JSON = 1024 * 1024;\nexport const BODY_LIMIT_STRICT_INBOUND = 256 * 1024;\nconst len = request.headers.get("content-length");\nreturn jsonPayloadTooLarge();\nreason: "unsafe_json_key"\nreason: "json_shape_too_large"\nhasUnsafeJsonKey\nisJsonShapeWithinLimits\nallowJsonWhitespaceControls\nexport async function readTextBodyLimited(\nexport async function parseJsonBodyWithLimit<T>(\n';
const REQUIRED_HELPER_TEST = 'it("rejects oversized body by Content-Length", () => {})\nit("parses small JSON", () => {})\nit("returns safe 400 for invalid JSON", () => {})\nit("rejects oversized text body before parsing", () => {})\nit("maps body through parse", () => {})\n';
const ROUTE_UNIVERSE_BUILDER = 'function bodyPolicy(methods, source, cls) {\nconst mutating = methods.some((method) => ["POST", "PUT", "PATCH", "DELETE"].includes(method));\nif (/readJsonBodyLimited|parseJsonBodyWithLimit|readRequestBodyLimited|readTextBodyLimited|formData\\(/.test(source)) return "bounded_or_form_body";\nif (/rejectUnexpectedBody/.test(source)) return "no_body_rejected";\nreturn "body_limit_required";\n}\n';
const PROGRAMS_ROUTE = 'const parsed = await readJsonBodyLimited(request);\nif (!parsed.ok) return parsed.response;\n';
const EXTRACT_ROUTE = 'const ctReject = jsonContentTypeRejection(request);\nconst _limBody = await readJsonBodyLimited(request, BODY_LIMIT_LARGE_JSON);\nif (!_limBody.ok) return _limBody.response;\n';
const OAUTH_START_ROUTE = 'const _lb_body = await readJsonBodyLimited(request);\nif (!_lb_body.ok) return _lb_body.response;\n';
const MARKER_ROUTES = {
  "src/app/api/workspace/v6-settings/route.ts": "BODY_LIMIT_SMALL_JSON\nreadJsonBodyLimited(request, BODY_LIMIT_SMALL_JSON)\n",
  "src/app/api/command-centers/preferences/route.ts": "BODY_LIMIT_SMALL_JSON\nreadJsonBodyLimited(request, BODY_LIMIT_SMALL_JSON)\n",
  "src/app/api/autopilot/rules/route.ts": "BODY_LIMIT_MEDIUM_JSON\nparseJsonBodyWithLimit(\n",
  "src/app/api/segments/route.ts": "BODY_LIMIT_MEDIUM_JSON\nparseJsonBodyWithLimit(\n",
  "src/app/api/import/contracts/route.ts": "BODY_LIMIT_LARGE_JSON\nreadTextBodyLimited(request, MAX_IMPORT_BODY_CHARS)\nreadJsonBodyLimited(request, BODY_LIMIT_LARGE_JSON)\n",
  "src/app/api/extract/run/route.ts": "BODY_LIMIT_LARGE_JSON\nreadJsonBodyLimitedWithRaw(request, BODY_LIMIT_LARGE_JSON)\n",
  "src/app/api/stripe/webhook/route.ts": "STRIPE_WEBHOOK_BODY_MAX\nreadTextBodyLimited(request, STRIPE_WEBHOOK_BODY_MAX)\n",
  "src/app/api/tasks/from-slack/route.ts": "SLACK_INBOUND_BODY_MAX\nreadTextBodyLimited(request, SLACK_INBOUND_BODY_MAX)\n",
  "src/app/api/tasks/from-email/route.ts": "EMAIL_INBOUND_SIGNED_BODY_MAX\nreadTextBodyLimited(request, EMAIL_INBOUND_SIGNED_BODY_MAX)\n",
  "src/app/api/integrations/actions/callback/route.ts": "BODY_LIMIT_STRICT_INBOUND\nreadJsonBodyLimited(request, BODY_LIMIT_STRICT_INBOUND)\n",
  "src/app/api/webhooks/dispatch/route.ts": "BODY_LIMIT_STRICT_INBOUND\nreadJsonBodyLimited(request, BODY_LIMIT_STRICT_INBOUND)\n",
};
const ROUTE_UNIVERSE = JSON.stringify({
  routes: [
    { route: "/api/programs", methods: ["GET", "POST"], cachePolicy: "private_no_store", bodyPolicy: "bounded_or_form_body" },
    { route: "/api/extract", methods: ["POST"], cachePolicy: "private_no_store", bodyPolicy: "bounded_or_form_body" },
    { route: "/api/integrations/oauth/start", methods: ["POST"], cachePolicy: "private_no_store", bodyPolicy: "bounded_or_form_body" },
  ],
});

function writeMarkerRoutes(root) {
  for (const [rel, content] of Object.entries(MARKER_ROUTES)) {
    write(root, rel, content);
  }
}

test("analyzeCsrfSurfaceGuards validates bounded-body mutation surfaces", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-csrf-surface-"));
  write(root, "package.json", JSON.stringify({ scripts: { "check:csrf-surface-guards": "x" } }));
  write(root, ".github/workflows/ci.yml", "npm run check:csrf-surface-guards\n");
  write(root, "scripts/pipelines/pipeline-security-comprehensive.mjs", '"check:csrf-surface-guards"\n');
  write(root, "src/lib/security/read-json-body-limited.ts", REQUIRED_HELPER);
  write(root, "src/lib/security/read-json-body-limited.test.ts", REQUIRED_HELPER_TEST);
  write(root, "scripts/lib/build-route-universe.mjs", ROUTE_UNIVERSE_BUILDER);
  write(root, "src/app/api/programs/route.ts", PROGRAMS_ROUTE);
  write(root, "src/app/api/extract/route.ts", EXTRACT_ROUTE);
  write(root, "src/app/api/integrations/oauth/start/route.ts", OAUTH_START_ROUTE);
  writeMarkerRoutes(root);
  write(root, "artifacts/route-universe.json", ROUTE_UNIVERSE);

  const report = analyzeCsrfSurfaceGuards(root);
  assert.equal(report.ok, true);
  assert.equal(report.issueCount, 0);
});

test("analyzeCsrfSurfaceGuards rejects raw route request body reads", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-csrf-surface-raw-"));
  write(root, "package.json", JSON.stringify({ scripts: { "check:csrf-surface-guards": "x" } }));
  write(root, ".github/workflows/ci.yml", "npm run check:csrf-surface-guards\n");
  write(root, "scripts/pipelines/pipeline-security-comprehensive.mjs", '"check:csrf-surface-guards"\n');
  write(root, "src/lib/security/read-json-body-limited.ts", REQUIRED_HELPER);
  write(root, "src/lib/security/read-json-body-limited.test.ts", REQUIRED_HELPER_TEST);
  write(root, "scripts/lib/build-route-universe.mjs", ROUTE_UNIVERSE_BUILDER);
  write(root, "src/app/api/programs/route.ts", PROGRAMS_ROUTE);
  write(root, "src/app/api/extract/route.ts", EXTRACT_ROUTE);
  write(root, "src/app/api/integrations/oauth/start/route.ts", OAUTH_START_ROUTE);
  writeMarkerRoutes(root);
  write(root, "src/app/api/raw/route.ts", 'export async function POST(request) { return Response.json(await request.json()); }');
  write(root, "artifacts/route-universe.json", ROUTE_UNIVERSE);

  const report = analyzeCsrfSurfaceGuards(root);
  assert.equal(report.ok, false);
  assert.equal(report.issues.some((issue) => issue.issue === "raw_request_body_read"), true);
});
