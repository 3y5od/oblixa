import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { analyzeAuthErrorConsistency } from "./check-auth-error-consistency.mjs";

function write(root, rel, content) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
}

function withFixture(files, fn) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "auth-error-consistency-"));
  try {
    write(
      root,
      "src/lib/http/problem.ts",
      `
        export function jsonUnauthorized() {
          return { error: "Unauthorized", code: "unauthorized", diagnostic_id: "route_unauthorized" };
        }
        export function jsonForbidden() {
          return { error: "Forbidden", code: "forbidden", diagnostic_id: "route_forbidden" };
        }
      `
    );
    write(
      root,
      "src/lib/security/api-guards.ts",
      `
        return jsonUnauthorized();
        return jsonForbidden();
      `
    );
    write(
      root,
      "src/lib/v6/api-auth.ts",
      `
        jsonUnauthorized();
        jsonForbidden();
      `
    );
    write(
      root,
      "src/lib/v6/feature-guards.ts",
      `
        jsonProblem(403, { code: "feature_disabled", diagnostic_id: "v6_feature_disabled" });
      `
    );
    for (const [rel, content] of Object.entries(files)) write(root, rel, content);
    return fn(root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

test("analyzeAuthErrorConsistency accepts helpers and custom auth problems", () => {
  const report = withFixture(
    {
      "src/app/api/safe/route.ts": `
        import { jsonForbidden, jsonProblem, jsonUnauthorized } from "@/lib/http/problem";
        export async function GET() {
          if (!user) return jsonUnauthorized("/api/safe");
          if (!role) return jsonForbidden("/api/safe");
          return jsonProblem(401, {
            error: "Invalid API key",
            code: "invalid_api_key",
            diagnostic_id: "safe_invalid_api_key",
            route: "/api/safe",
          });
        }
      `,
    },
    analyzeAuthErrorConsistency
  );
  assert.equal(report.ok, true);
  assert.equal(report.helperUnauthorizedUses, 1);
  assert.equal(report.helperForbiddenUses, 1);
  assert.equal(report.directCustomAuthProblems, 1);
});

test("analyzeAuthErrorConsistency rejects raw route auth JSON", () => {
  const report = withFixture(
    {
      "src/app/api/raw/route.ts": `
        import { NextResponse } from "next/server";
        export async function GET() {
          return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
      `,
      "src/app/api/other/route.ts": `
        import { jsonForbidden, jsonUnauthorized } from "@/lib/http/problem";
        export async function GET() {
          if (!user) return jsonUnauthorized("/api/other");
          return jsonForbidden("/api/other");
        }
      `,
    },
    analyzeAuthErrorConsistency
  );
  assert.equal(report.ok, false);
  assert.equal(report.issues.some((issue) => issue.issue === "raw_auth_error_response"), true);
});

test("analyzeAuthErrorConsistency rejects custom auth problems without diagnostics", () => {
  const report = withFixture(
    {
      "src/app/api/bad/route.ts": `
        import { jsonForbidden, jsonProblem, jsonUnauthorized } from "@/lib/http/problem";
        export async function GET() {
          if (!user) return jsonUnauthorized("/api/bad");
          if (!role) return jsonForbidden("/api/bad");
          return jsonProblem(403, { error: "Nope" });
        }
      `,
    },
    analyzeAuthErrorConsistency
  );
  assert.equal(report.ok, false);
  assert.equal(report.issues.some((issue) => issue.issue === "auth_problem_missing_code_or_diagnostic"), true);
});

test("analyzeAuthErrorConsistency requires default auth helpers for default auth shapes", () => {
  const report = withFixture(
    {
      "src/app/api/default/route.ts": `
        import { jsonForbidden, jsonProblem, jsonUnauthorized } from "@/lib/http/problem";
        export async function GET() {
          if (!user) return jsonUnauthorized("/api/default");
          if (!role) return jsonForbidden("/api/default");
          return jsonProblem(401, {
            error: "Unauthorized",
            code: "unauthorized",
            diagnostic_id: "route_unauthorized",
          });
        }
      `,
    },
    analyzeAuthErrorConsistency
  );
  assert.equal(report.ok, false);
  assert.equal(report.issues.some((issue) => issue.issue === "default_auth_problem_should_use_helper"), true);
});
