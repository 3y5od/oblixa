import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { analyzeApiRouteGuardNormalization, analyzeApiRouteGuardNormalizationRatchet, extractExportedHandlers } from "./check-api-route-guard-normalization.mjs";

function withFixture(files, fn) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "api-route-guard-normalization-"));
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

test("extractExportedHandlers returns method blocks", () => {
  const handlers = extractExportedHandlers(`
    export async function POST(request) { await getApiAuthContext(); return Response.json({}); }
    export const GET = async () => { return Response.json({}); };
  `);
  assert.deepEqual(handlers.map((handler) => handler.method), ["GET", "POST"]);
});

test("analyzeApiRouteGuardNormalization accepts normalized mutating session route order", () => {
  const report = withFixture(
    {
      "src/app/api/segments/route.ts": `
        export async function POST(request: Request) {
          const { ctx, errorResponse } = await requireV6Context("settings_manage");
          if (!ctx) return errorResponse;
          const rl = await rateLimitCheck("segments", "user");
          if (!rl.ok) return Response.json({}, { status: 429 });
          const modeGate = await requireApiWorkspaceEligibility({ admin: ctx.admin, orgId: ctx.orgId, role: ctx.role, apiPath: "/api/segments" });
          if (modeGate) return modeGate;
          const parsed = await parseJsonBodyWithLimit(request, (raw) => raw);
          const result = await createSegment(ctx.admin, ctx.orgId, parsed.data);
          return Response.json(result);
        }
      `,
    },
    analyzeApiRouteGuardNormalization
  );
  assert.equal(report.ok, true);
  assert.deepEqual(report.issues, []);
});

test("analyzeApiRouteGuardNormalization flags body and DB mutation before auth and rate limit", () => {
  const report = withFixture(
    {
      "src/app/api/contracts/route.ts": `
        export async function POST(request: Request) {
          const body = await request.json();
          const result = await admin.from("contracts").insert(body);
          const { ctx } = await getApiAuthContext();
          const rl = await rateLimitCheck("contracts", ctx.userId);
          return Response.json(result);
        }
      `,
    },
    analyzeApiRouteGuardNormalization
  );
  assert.equal(report.ok, false);
  assert.ok(report.issues.some((issue) => issue.issue === "body_parse_before_auth_guard"));
  assert.ok(report.issues.some((issue) => issue.issue === "body_parse_before_rate_limit"));
  assert.ok(report.issues.some((issue) => issue.issue === "db_mutation_before_auth_guard"));
  assert.ok(report.issues.some((issue) => issue.issue === "db_mutation_before_rate_limit"));
});

test("analyzeApiRouteGuardNormalization allows signed raw-body verification before auth", () => {
  const report = withFixture(
    {
      "src/app/api/stripe/webhook/route.ts": `
        export async function POST(request: Request) {
          const raw = await request.text();
          const event = stripe.webhooks.constructEvent(raw, request.headers.get("stripe-signature"), "secret");
          return Response.json({ ok: true, event });
        }
      `,
    },
    analyzeApiRouteGuardNormalization
  );
  assert.equal(report.ok, true);
});

test("analyzeApiRouteGuardNormalization flags workspace eligibility before role or capability guard", () => {
  const report = withFixture(
    {
      "src/app/api/evidence/route.ts": `
        export async function POST(request: Request) {
          const { ctx } = await getApiAuthContext();
          const modeGate = await requireApiWorkspaceEligibility({ admin: ctx.admin, orgId: ctx.orgId, role: ctx.role, apiPath: "/api/evidence" });
          if (modeGate) return modeGate;
          if (!(await canManageCapability(ctx, "contracts_edit"))) return Response.json({}, { status: 403 });
          return Response.json({});
        }
      `,
    },
    analyzeApiRouteGuardNormalization
  );

  assert.equal(report.ok, false);
  assert.ok(report.issues.some((issue) => issue.issue === "workspace_eligibility_before_role_or_capability_guard"));
});

test("analyzeApiRouteGuardNormalization flags feature-specific work before workspace eligibility", () => {
  const report = withFixture(
    {
      "src/app/api/import/contracts/route.ts": `
        export async function POST(request: Request) {
          const { ctx } = await getApiAuthContext();
          if (!(await canManageCapability(ctx, "contracts_edit"))) return Response.json({}, { status: 403 });
          const result = await runContractCsvImport({ admin: ctx.admin, membership: ctx.membership, userId: ctx.userId, rows: [] });
          const modeGate = await requireApiWorkspaceEligibility({ admin: ctx.admin, orgId: ctx.orgId, role: ctx.role, apiPath: "/api/import/contracts" });
          if (modeGate) return modeGate;
          return Response.json(result);
        }
      `,
    },
    analyzeApiRouteGuardNormalization
  );

  assert.equal(report.ok, false);
  assert.ok(report.issues.some((issue) => issue.issue === "feature_specific_work_before_workspace_eligibility"));
});

test("analyzeApiRouteGuardNormalization flags feature-specific work before role or capability guard", () => {
  const report = withFixture(
    {
      "src/app/api/import/contracts/route.ts": `
        export async function POST(request: Request) {
          const { ctx } = await getApiAuthContext();
          const rl = await rateLimitCheck("contracts", ctx.userId);
          if (!rl.ok) return Response.json({}, { status: 429 });
          const result = await runContractCsvImport({ admin: ctx.admin, membership: ctx.membership, userId: ctx.userId, rows: [] });
          if (!(await canManageCapability(ctx, "contracts_edit"))) return Response.json({}, { status: 403 });
          const modeGate = await requireApiWorkspaceEligibility({ admin: ctx.admin, orgId: ctx.orgId, role: ctx.role, apiPath: "/api/import/contracts" });
          if (modeGate) return modeGate;
          return Response.json(result);
        }
      `,
    },
    analyzeApiRouteGuardNormalization
  );

  assert.equal(report.ok, false);
  assert.ok(report.issues.some((issue) => issue.issue === "feature_specific_work_before_role_or_capability_guard"));
});

test("analyzeApiRouteGuardNormalization flags user-controlled ids before membership resolution", () => {
  const report = withFixture(
    {
      "src/app/api/import/contracts/[jobId]/route.ts": `
        export async function GET() {
          const { jobId } = await params;
          const membership = await getDeterministicMembership(admin, user.id);
          return Response.json({ jobId, orgId: membership.organization_id });
        }
      `,
    },
    analyzeApiRouteGuardNormalization
  );

  assert.equal(report.ok, false);
  assert.ok(report.issues.some((issue) => issue.issue === "user_controlled_id_before_membership_or_org_resolution"));
});

test("analyzeApiRouteGuardNormalizationRatchet fails on new issues outside baseline", () => {
  const report = withFixture(
    {
      "artifacts/api-route-guard-normalization-baseline.json": JSON.stringify({
        issues: [
          {
            issue: "body_parse_before_auth_guard",
            rel: "src/app/api/contracts/route.ts",
            method: "POST",
          },
          {
            issue: "body_parse_before_rate_limit",
            rel: "src/app/api/contracts/route.ts",
            method: "POST",
          },
        ],
      }),
      "src/app/api/contracts/route.ts": `
        export async function POST(request: Request) {
          const body = await request.json();
          await getApiAuthContext();
          const rl = await rateLimitCheck("contracts", "user");
          return Response.json(body);
        }
      `,
      "src/app/api/reports/route.ts": `
        export async function POST(request: Request) {
          const body = await request.json();
          await getApiAuthContext();
          return Response.json(body);
        }
      `,
    },
    analyzeApiRouteGuardNormalizationRatchet
  );
  assert.equal(report.ok, false);
  assert.equal(report.newIssueCount, 1);
  assert.equal(report.newIssues[0]?.rel, "src/app/api/reports/route.ts");
});
