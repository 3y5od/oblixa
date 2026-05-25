import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { findMissingRequiredAppRouterStateFailures, findRouteUniverseFailures } from "./check-route-universe.mjs";
import { buildRouteUniversePayload, methodsFromSource } from "./lib/build-route-universe.mjs";

function write(root, rel, content) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
}

function withFixture(files, fn) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "route-universe-"));
  try {
    for (const [rel, content] of Object.entries(files)) write(root, rel, content);
    return fn(root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

test("findMissingRequiredAppRouterStateFailures flags missing loading/error/not_found states", () => {
  const failures = findMissingRequiredAppRouterStateFailures([
    {
      kind: "page",
      sourcePath: "src/app/foo/page.tsx",
      routeStates: {
        required: ["loading", "error", "not_found", "mobile"],
        present: ["loading", "error"],
      },
    },
  ]);

  assert.deepEqual(failures, ["src/app/foo/page.tsx:missing_required_app_router_state:not_found"]);
});

test("findMissingRequiredAppRouterStateFailures ignores non-page rows and non-app-router states", () => {
  const failures = findMissingRequiredAppRouterStateFailures([
    {
      kind: "api_route",
      sourcePath: "src/app/api/foo/route.ts",
      routeStates: { required: [], present: [] },
    },
    {
      kind: "page",
      sourcePath: "src/app/bar/page.tsx",
      routeStates: { required: ["loading", "mobile"], present: ["loading"] },
    },
  ]);

  assert.deepEqual(failures, []);
});

test("methodsFromSource detects function and const route handlers", () => {
  const methods = methodsFromSource(`
    export async function GET() {}
    export function HEAD() {}
    export const POST = async () => Response.json({});
    export const PATCH = withCronRoute({ route: "/api/example", handler: async () => ({ body: {} }) });
  `);

  assert.deepEqual(methods, ["GET", "POST", "PATCH", "HEAD"]);
});

test("buildRouteUniversePayload follows local route re-export wrappers", () => {
  const payload = withFixture(
    {
      "src/app/api/cron/task/route.ts": 'export * from "../task-source/route";\n',
      "src/app/api/cron/task-source/route.ts": `
        export const runtime = "nodejs";
        export const GET = async () => Response.json({ ok: true });
      `,
    },
    buildRouteUniversePayload
  );

  const row = payload.universe.routes.find((route) => route.sourcePath === "src/app/api/cron/task/route.ts");
  assert(row);
  assert.deepEqual(row.methods, ["GET"]);
  assert.equal(row.runtime, "nodejs");
  assert.equal(row.authModel, "cron_secret");
});

test("findRouteUniverseFailures reads generated artifacts from the provided root", () => {
  const { failures } = withFixture(
    {
      "src/app/api/demo/route.ts": "export async function GET() { return Response.json({ ok: true }); }\n",
    },
    findRouteUniverseFailures
  );

  assert(failures.includes("artifacts/route-universe.json:missing"));
});
