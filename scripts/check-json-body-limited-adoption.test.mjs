import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { analyzeJsonBodyLimitedAdoption } from "./check-json-body-limited-adoption.mjs";

function write(root, rel, content) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
}

test("analyzeJsonBodyLimitedAdoption accepts bounded and bodyless mutating routes", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-body-adoption-"));
  write(root, "src/lib/security/read-json-body-limited.ts", "export async function readJsonBodyLimited() {}\nexport async function readJsonBodyLimitedWithRaw() {}\n");
  write(
    root,
    "src/app/api/bounded/route.ts",
    'import { readJsonBodyLimited } from "@/lib/security/read-json-body-limited";\nexport async function POST(request) { const parsed = await readJsonBodyLimited(request); if (!parsed.ok) return parsed.response; }\n'
  );
  write(
    root,
    "src/app/api/bodyless/route.ts",
    'import { rejectUnexpectedBody } from "@/lib/security/read-json-body-limited";\nexport async function DELETE(request) { const unexpectedBody = await rejectUnexpectedBody(request); if (unexpectedBody) return unexpectedBody; }\n'
  );
  write(
    root,
    "src/app/api/signed/route.ts",
    'import { readJsonBodyLimitedWithRaw } from "@/lib/security/read-json-body-limited";\nexport async function POST(request) { const parsed = await readJsonBodyLimitedWithRaw(request); if (!parsed.ok) return parsed.response; }\n'
  );
  write(
    root,
    "artifacts/route-universe.json",
    JSON.stringify({
      routes: [
        {
          kind: "api_route",
          route: "/api/bounded",
          sourcePath: "src/app/api/bounded/route.ts",
          methods: ["POST"],
          bodyPolicy: "bounded_or_form_body",
        },
        {
          kind: "api_route",
          route: "/api/bodyless",
          sourcePath: "src/app/api/bodyless/route.ts",
          methods: ["DELETE"],
          bodyPolicy: "no_body_rejected",
        },
        {
          kind: "api_route",
          route: "/api/signed",
          sourcePath: "src/app/api/signed/route.ts",
          methods: ["POST"],
          bodyPolicy: "bounded_or_form_body",
        },
      ],
    })
  );

  const report = analyzeJsonBodyLimitedAdoption(root);

  assert.equal(report.ok, true);
  assert.equal(report.issueCount, 0);
  assert.equal(report.mutatingRouteCount, 3);
  assert.equal(report.safeMutatingBodyRouteCount, 3);
});

test("analyzeJsonBodyLimitedAdoption rejects mutating routes without body policy", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "oblixa-body-adoption-"));
  write(root, "src/lib/security/read-json-body-limited.ts", "export async function readJsonBodyLimited() {}\n");
  write(root, "src/app/api/unsafe/route.ts", "export async function POST(request) { return Response.json({ ok: true }); }\n");
  write(
    root,
    "artifacts/route-universe.json",
    JSON.stringify({
      routes: [
        {
          kind: "api_route",
          route: "/api/unsafe",
          sourcePath: "src/app/api/unsafe/route.ts",
          methods: ["POST"],
          bodyPolicy: "body_limit_required",
        },
      ],
    })
  );

  const report = analyzeJsonBodyLimitedAdoption(root);

  assert.equal(report.ok, false);
  assert(report.issues.some((issue) => issue.issue === "mutating_route_missing_bounded_body_guard"));
  assert(report.issues.some((issue) => issue.issue === "route_universe_unsafe_body_policy"));
});
