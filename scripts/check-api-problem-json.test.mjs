import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { analyzeApiProblemJson } from "./check-api-problem-json.mjs";

function write(root, rel, content) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
}

function withFixture(files, fn) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "api-problem-json-"));
  try {
    write(root, "artifacts/assurance/api-problem-json-allowlist.json", JSON.stringify({ version: 1, entries: [] }));
    write(
      root,
      "src/lib/http/problem.ts",
      `
        export const SUPPORT_SAFE_PROBLEM_STATUSES = [400, 401, 403, 404, 405, 409, 413, 415, 422, 429, 500, 502, 503] as const;
        export function jsonBadRequest() {}
        export function jsonMethodNotAllowed() {}
        export function jsonConflict() {}
        export function jsonPayloadTooLarge() {}
        export function jsonUnsupportedMediaType() {}
        export function jsonUnprocessableEntity() {}
        export function jsonRateLimited() {}
        export function jsonUnhandled() {}
        export function jsonBadGateway() {}
        export function jsonServiceUnavailable() {}
        redactProblemErrorMessage(body.error)
        sanitizeProblemDetails(body.details)
        SENSITIVE_PROBLEM_DETAIL_KEY_RE
      `
    );
    write(
      root,
      "src/lib/http/problem.test.ts",
      `
        it("covers representative support-safe status helpers", () => {
          SUPPORT_SAFE_PROBLEM_STATUSES;
          jsonBadRequest("/api/example");
          jsonMethodNotAllowed("/api/example");
          jsonConflict("/api/example");
          jsonPayloadTooLarge("/api/example");
          jsonUnsupportedMediaType("/api/example");
          jsonUnprocessableEntity("/api/example");
          jsonBadGateway("/api/example");
          jsonServiceUnavailable("/api/example");
        });
      `
    );
    write(
      root,
      "src/lib/security/read-json-body-limited.ts",
      `
        jsonBadRequest();
        jsonPayloadTooLarge();
        jsonUnsupportedMediaType();
        reason: "invalid_json";
        reason: "invalid_content_length";
      `
    );
    for (const [rel, content] of Object.entries(files)) write(root, rel, content);
    return fn(root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

test("analyzeApiProblemJson accepts Problem JSON route errors", () => {
  const report = withFixture(
    {
      "src/app/api/safe/route.ts": `
        import { jsonProblem } from "@/lib/http/problem";
        export async function POST() {
          return jsonProblem(400, { error: "Invalid request", code: "validation_failed", diagnostic_id: "safe_validation_failed", route: "/api/safe" });
        }
      `,
    },
    analyzeApiProblemJson
  );
  assert.equal(report.ok, true);
  assert.equal(report.rawErrorRouteFiles, 0);
});

test("analyzeApiProblemJson rejects raw NextResponse error JSON", () => {
  const report = withFixture(
    {
      "src/app/api/raw/route.ts": `
        import { NextResponse } from "next/server";
        export async function POST() {
          return NextResponse.json({ error: "Bad request" }, { status: 400 });
        }
      `,
    },
    analyzeApiProblemJson
  );
  assert.equal(report.ok, false);
  assert.equal(report.issues.some((issue) => issue.issue === "raw_error_json"), true);
});

test("analyzeApiProblemJson rejects stack and raw exception response fields", () => {
  const report = withFixture(
    {
      "src/app/api/leaky/route.ts": `
        import { jsonProblem } from "@/lib/http/problem";
        export async function POST() {
          try { throw new Error("db failed"); }
          catch (error) {
            return jsonProblem(500, { error: "Failed", code: "failed", diagnostic_id: "failed", details: { stack: error.stack, message: error.message } });
          }
        }
      `,
    },
    analyzeApiProblemJson
  );
  assert.equal(report.ok, false);
  assert.equal(report.issues.some((issue) => issue.issue === "stack_in_route_response"), true);
  assert.equal(report.issues.some((issue) => issue.issue === "raw_exception_message_in_route_response"), true);
});

test("analyzeApiProblemJson rejects raw exception messages in server problem responses", () => {
  const report = withFixture(
    {
      "src/app/api/leaky/route.ts": `
        import { jsonProblem } from "@/lib/http/problem";
        export async function POST() {
          try { throw new Error("db failed"); }
          catch (error) {
            return jsonProblem(500, { error: error.message, code: "failed", diagnostic_id: "failed" });
          }
        }
      `,
    },
    analyzeApiProblemJson
  );
  assert.equal(report.ok, false);
  assert.equal(report.issues.some((issue) => issue.issue === "raw_exception_message_in_server_problem"), true);
});

test("analyzeApiProblemJson requires support-safe problem helper coverage", () => {
  const report = withFixture(
    {
      "src/lib/http/problem.test.ts": `
        it("does not cover statuses", () => {
          jsonBadRequest("/api/example");
        });
      `,
      "src/app/api/safe/route.ts": `
        import { jsonProblem } from "@/lib/http/problem";
        export async function POST() {
          return jsonProblem(400, { error: "Invalid request", code: "validation_failed", diagnostic_id: "safe_validation_failed" });
        }
      `,
    },
    analyzeApiProblemJson
  );
  assert.equal(report.ok, false);
  assert.equal(report.issues.some((issue) => issue.issue === "missing_support_safe_problem_marker"), true);
});
