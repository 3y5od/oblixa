import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { analyzeApiTenantIsolation, analyzeTenantIsolationRoute, findTenantQueryStatements } from "./check-api-tenant-isolation.mjs";

function withFixture(files, fn) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "api-tenant-isolation-"));
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

const CROSS_ORG_GUESSED_ID_CASES = [
  ["contracts/[id]/route.ts", "contracts"],
  ["approvals/[id]/route.ts", "contract_approvals"],
  ["renewals/[id]/route.ts", "renewals"],
  ["obligations/[id]/route.ts", "obligations"],
  ["exceptions/[id]/route.ts", "exceptions"],
  ["evidence/records/[id]/route.ts", "evidence_records"],
  ["evidence/requests/[id]/route.ts", "evidence_requests"],
  ["assurance/findings/[id]/route.ts", "assurance_findings"],
  ["assurance/scorecards/[id]/route.ts", "assurance_scorecards"],
  ["campaigns/[id]/route.ts", "campaigns"],
  ["simulations/[id]/route.ts", "simulations"],
  ["segments/[id]/route.ts", "segments"],
  ["decisions/[id]/route.ts", "decisions"],
  ["review-boards/[id]/route.ts", "review_boards"],
  ["review-boards/runs/[id]/route.ts", "review_board_runs"],
  ["report-packs/[id]/route.ts", "report_packs"],
  ["report-packs/[id]/runs/[runId]/route.ts", "report_pack_runs"],
  ["import/contracts/[jobId]/route.ts", "contract_import_jobs"],
  ["export/contracts/[jobId]/route.ts", "contract_export_jobs"],
  ["autopilot/rules/[id]/route.ts", "autopilot_rules"],
  ["autopilot/runs/[id]/route.ts", "autopilot_runs"],
  ["autopilot/runs/[id]/logs/[logId]/route.ts", "autopilot_run_logs"],
  ["integrations/settings/[id]/route.ts", "integration_settings"],
  ["integrations/provider-accounts/[id]/route.ts", "provider_accounts"],
];

test("findTenantQueryStatements extracts tenant table chains", () => {
  const statements = findTenantQueryStatements(`
    const row = await admin.from("contracts").select("id").eq("organization_id", orgId).single();
  `);

  assert.equal(statements.length, 1);
  assert.equal(statements[0]?.table, "contracts");
});

test("analyzeTenantIsolationRoute accepts org-scoped detail lookups and mutations", () => {
  const issues = analyzeTenantIsolationRoute(
    "contracts/[id]/route.ts",
    `
      export async function PATCH() {
        const { ctx } = await requireV6Context("contracts_edit");
        const row = await ctx.admin.from("contracts").select("id").eq("id", id).eq("organization_id", ctx.orgId).single();
        await ctx.admin.from("contracts").update({ name: "x" }).eq("id", id).eq("organization_id", ctx.orgId);
        return Response.json({ row });
      }
    `
  );

  assert.deepEqual(issues, []);
});

test("analyzeTenantIsolationRoute flags guessed-ID detail lookup without org predicate", () => {
  const issues = analyzeTenantIsolationRoute(
    "contracts/[id]/route.ts",
    `
      export async function GET() {
        const { ctx } = await requireV6Context("contracts_read");
        const row = await ctx.admin.from("contracts").select("id").eq("id", id).single();
        return Response.json({ row });
      }
    `
  );

  assert.equal(issues.some((issue) => issue.issue === "tenant_detail_lookup_without_org_predicate"), true);
});

test("analyzeTenantIsolationRoute flags guessed-ID mutation without org predicate", () => {
  const issues = analyzeTenantIsolationRoute(
    "approvals/[id]/route.ts",
    `
      export async function POST() {
        const { ctx } = await requireV6Context("approvals_manage");
        await ctx.admin.from("approvals").update({ status: "approved" }).eq("id", id);
        return Response.json({ ok: true });
      }
    `
  );

  assert.equal(issues.some((issue) => issue.issue === "tenant_mutation_without_org_predicate"), true);
});

test("analyzeTenantIsolationRoute accepts list queries that filter by org before pagination", () => {
  const issues = analyzeTenantIsolationRoute(
    "contracts/route.ts",
    `
      export async function GET() {
        const { ctx } = await requireV6Context("contracts_read");
        const rows = await ctx.admin.from("contracts").select("id").eq("organization_id", ctx.orgId).order("created_at").range(0, 25);
        return Response.json({ rows });
      }
    `
  );

  assert.deepEqual(issues, []);
});

test("analyzeTenantIsolationRoute flags list pagination before org predicates", () => {
  const issues = analyzeTenantIsolationRoute(
    "contracts/route.ts",
    `
      export async function GET() {
        const { ctx } = await requireV6Context("contracts_read");
        const rows = await ctx.admin.from("contracts").select("id").range(0, 25).eq("organization_id", ctx.orgId);
        return Response.json({ rows });
      }
    `
  );

  assert.equal(issues.some((issue) => issue.issue === "tenant_list_operation_before_org_predicate"), true);
});

test("analyzeTenantIsolationRoute flags cursor predicates before org predicates", () => {
  const issues = analyzeTenantIsolationRoute(
    "contracts/route.ts",
    `
      export async function GET() {
        const { ctx } = await requireV6Context("contracts_read");
        const rows = await ctx.admin.from("contracts").select("id").gt("id", cursor).eq("organization_id", ctx.orgId).limit(25);
        return Response.json({ rows });
      }
    `
  );

  assert.equal(issues.some((issue) => issue.issue === "tenant_list_operation_before_org_predicate"), true);
});

test("analyzeTenantIsolationRoute accepts command-palette search through command index visibility helper", () => {
  const issues = analyzeTenantIsolationRoute(
    "command-palette/contracts/route.ts",
    `
      export async function GET() {
        const ctx = await getApiAuthContext();
        const rows = await applyV10CommandSearchVisibility(
          ctx.admin.from("v10_command_search_index").select("record_id, label"),
          { organizationId: ctx.orgId, role: ctx.role, workspaceMode: "core", plan: "enterprise" }
        ).or("label.ilike.%msa%").order("updated_at", { ascending: false }).limit(12);
        return Response.json({ rows });
      }
    `
  );

  assert.deepEqual(issues, []);
});

test("analyzeTenantIsolationRoute rejects command-palette search index queries without org visibility", () => {
  const issues = analyzeTenantIsolationRoute(
    "command-palette/contracts/route.ts",
    `
      export async function GET() {
        const ctx = await getApiAuthContext();
        const rows = await ctx.admin.from("v10_command_search_index").select("record_id, label").or("label.ilike.%msa%").limit(12);
        return Response.json({ rows });
      }
    `
  );

  assert.equal(issues.some((issue) => issue.issue === "tenant_list_query_without_org_predicate"), true);
});

test("analyzeTenantIsolationRoute flags background job lookup by id without org predicate", () => {
  const issues = analyzeTenantIsolationRoute(
    "export/contracts/[jobId]/route.ts",
    `
      export async function GET() {
        const { ctx } = await requireV6Context("contracts_read");
        const job = await ctx.admin.from("contract_export_jobs").select("id").eq("id", jobId).maybeSingle();
        return Response.json({ job });
      }
    `
  );

  assert.equal(issues.some((issue) => issue.issue === "background_job_lookup_without_org_predicate"), true);
});

test("analyzeTenantIsolationRoute accepts background job lookup by id and org", () => {
  const issues = analyzeTenantIsolationRoute(
    "export/contracts/[jobId]/route.ts",
    `
      export async function GET() {
        const { ctx } = await requireV6Context("contracts_read");
        const job = await ctx.admin.from("contract_export_jobs").select("id").eq("id", jobId).eq("organization_id", ctx.orgId).maybeSingle();
        return Response.json({ job });
      }
    `
  );

  assert.deepEqual(issues, []);
});

test("analyzeTenantIsolationRoute covers cross-org guessed-ID lookups for tenant families", () => {
  for (const [rel, table] of CROSS_ORG_GUESSED_ID_CASES) {
    const unsafeIssues = analyzeTenantIsolationRoute(
      rel,
      `
        export async function GET() {
          const { ctx } = await requireV6Context("tenant_read");
          const row = await ctx.admin.from("${table}").select("id").eq("id", id).maybeSingle();
          return Response.json({ row });
        }
      `
    );
    assert.equal(
      unsafeIssues.some(
        (issue) =>
          issue.issue === "tenant_detail_lookup_without_org_predicate" ||
          issue.issue === "background_job_lookup_without_org_predicate"
      ),
      true,
      `${rel} should reject guessed-ID lookup without organization_id`
    );

    const safeIssues = analyzeTenantIsolationRoute(
      rel,
      `
        export async function GET() {
          const { ctx } = await requireV6Context("tenant_read");
          const row = await ctx.admin.from("${table}").select("id").eq("id", id).eq("organization_id", ctx.orgId).maybeSingle();
          return Response.json({ row });
        }
      `
    );
    assert.deepEqual(safeIssues, [], `${rel} should accept guessed-ID lookup with organization_id`);
  }
});

test("analyzeApiTenantIsolation scans route fixtures", () => {
  const report = withFixture(
    {
      "src/app/api/contracts/[id]/route.ts": `
        export async function GET() {
          const { ctx } = await requireV6Context("contracts_read");
          const row = await ctx.admin.from("contracts").select("id").eq("id", id).single();
          return Response.json({ row });
        }
      `,
      "src/app/api/contracts/route.ts": `
        export async function GET() {
          const { ctx } = await requireV6Context("contracts_read");
          const rows = await ctx.admin.from("contracts").select("id").eq("organization_id", ctx.orgId);
          return Response.json({ rows });
        }
      `,
    },
    analyzeApiTenantIsolation
  );

  assert.equal(report.ok, false);
  assert.equal(report.issueCount, 1);
  assert.equal(report.issues[0]?.rel, "contracts/[id]/route.ts");
});
