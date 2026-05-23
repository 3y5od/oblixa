import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  buildSecurityRouteMatrix,
  findSecurityRouteMatrixFailures,
  findSecurityRouteMatrixUniverseFailures,
  SECURITY_ROUTE_MATRIX_REQUIRED_FIELDS,
} from "./report-security-route-matrix.mjs";

function withFixture(files, fn) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "security-route-matrix-"));
  try {
    for (const [rel, content] of Object.entries(files)) {
      const file = path.join(root, rel);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, content);
    }
    return fn(root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

test("buildSecurityRouteMatrix emits method-level rows with required classifications", () => {
  const rows = withFixture(
    {
      "vercel.json": JSON.stringify({ crons: [{ path: "/api/cron/example", schedule: "0 0 * * *" }] }),
      "scripts/api-route-public-allowlist.txt": "# meta: owner=security expiry=2099-01-01 reason=test\nhealth/route.ts\n",
      "src/app/api/contracts/route.ts": `
        export async function GET() { return Response.json({ ok: true }); }
        export async function POST(request: Request) {
          await readJsonBodyLimitedWithRaw(request, 1024);
          await rateLimitCheck("contracts", "user");
          await getApiAuthContext();
          await requireApiWorkspaceEligibility();
          await recordAuditEvent();
          return Response.json({ ok: true });
        }
        export const PATCH = async (request: Request) => {
          await readJsonBodyLimited(request, 1024);
          await rateLimitCheck("contracts", "user");
          await getApiAuthContext();
          await requireApiWorkspaceEligibility();
          await recordAuditEvent();
          return Response.json({ ok: true });
        }
      `,
      "src/app/api/cron/example/route.ts": `
        export const GET = withCronRoute({
          route: "/api/cron/example",
          handler: async () => ({ body: { ok: true } })
        });
      `,
      "src/app/api/health/route.ts": `
        export async function GET() { return Response.json({ ok: true }); }
        export function HEAD() { return new Response(null, { status: 204 }); }
      `,
    },
    buildSecurityRouteMatrix
  );

  assert.equal(rows.length, 6);
  for (const row of rows) {
    for (const field of SECURITY_ROUTE_MATRIX_REQUIRED_FIELDS) assert.equal(typeof row[field], "string");
  }
  assert.equal(rows.find((row) => row.path === "/api/contracts" && row.method === "POST")?.body_size_policy, "bounded_json");
  assert.equal(rows.find((row) => row.path === "/api/contracts" && row.method === "PATCH")?.body_size_policy, "bounded_json");
  assert.equal(rows.find((row) => row.path === "/api/cron/example")?.auth_type, "cron_secret");
  assert.equal(rows.find((row) => row.path === "/api/health")?.auth_type, "explicitly_exempt");
  assert.equal(rows.find((row) => row.path === "/api/health" && row.method === "HEAD")?.body_size_policy, "no_body_expected");
});

test("findSecurityRouteMatrixFailures rejects missing and invalid non-exempt classifications", () => {
  const failures = findSecurityRouteMatrixFailures([
    {
      path: "/api/example",
      method: "POST",
      route_file: "src/app/api/example/route.ts",
      auth_type: "session",
      required_role_or_capability: "not_applicable",
      org_scope_source: "none_required",
      workspace_eligibility_gate: "not_governed",
      rate_limit_policy: "mutation_required",
      rate_limit_key_shape: "session_user_or_org",
      body_size_policy: "raw_json_limit_required",
      csrf_origin_policy: "cookie_mutation_origin_required",
      idempotency_or_job_lock_policy: "side_effect_policy_required",
      audit_event_expectation: "audit_event_expected",
    },
    {
      path: "/api/bad",
      method: "TRACE",
      route_file: "src/app/api/bad/route.ts",
      auth_type: "unknown",
    },
  ]);

  assert.ok(failures.includes("src/app/api/example/route.ts:POST:non_exempt_route_missing_scope_or_role_classification"));
  assert.ok(failures.includes("src/app/api/example/route.ts:POST:cookie_mutation_origin_required"));
  assert.ok(failures.includes("src/app/api/example/route.ts:POST:mutation_rate_limit_required"));
  assert.ok(failures.includes("src/app/api/example/route.ts:POST:side_effect_policy_required"));
  assert.ok(failures.includes("src/app/api/bad/route.ts:TRACE:unsupported_method"));
  assert.ok(failures.includes("src/app/api/bad/route.ts:TRACE:invalid_auth_type:unknown"));
  assert.ok(failures.some((failure) => failure.endsWith("missing_rate_limit_policy")));
});

test("findSecurityRouteMatrixUniverseFailures rejects matrix rows that drift from route universe methods", () => {
  withFixture(
    {
      "scripts/api-route-public-allowlist.txt": "",
      "src/app/api/example/route.ts": `
        export async function GET() { return Response.json({ ok: true }); }
        export const POST = async (request: Request) => {
          await readJsonBodyLimited(request, 1024);
          await rateLimitCheck("example", "user");
          await getApiAuthContext();
          return Response.json({ ok: true });
        }
      `,
    },
    (root) => {
      const rows = buildSecurityRouteMatrix(root);
      const missingPost = rows.filter((row) => row.method !== "POST");
      const missingFailures = findSecurityRouteMatrixUniverseFailures(root, missingPost);
      assert.ok(missingFailures.includes("src/app/api/example/route.ts:POST:missing_security_matrix_row"));

      const extraRows = [
        ...rows,
        {
          ...rows[0],
          method: "DELETE",
        },
      ];
      const extraFailures = findSecurityRouteMatrixUniverseFailures(root, extraRows);
      assert.ok(extraFailures.includes("src/app/api/example/route.ts:DELETE:security_matrix_row_not_in_route_universe"));
    }
  );
});
