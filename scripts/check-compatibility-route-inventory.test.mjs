import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  analyzeCompatibilityRouteInventory,
  buildCompatibilityRouteInventory,
} from "./check-compatibility-route-inventory.mjs";

function makeRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "compatibility-route-inventory-"));
}

function write(root, rel, content) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
  return abs;
}

function writeInventory(root, inventory) {
  write(root, "artifacts/routes/compatibility-route-inventory.json", `${JSON.stringify(inventory, null, 2)}\n`);
}

test("buildCompatibilityRouteInventory classifies static, dynamic, webhook, and cron routes", () => {
  const root = makeRoot();
  write(
    root,
    "vercel.json",
    JSON.stringify({ crons: [{ path: "/api/cron/nightly", schedule: "0 0 * * *" }] }),
  );
  write(root, "src/app/api/contracts/route.ts", "export async function GET() { return Response.json({ ok: true }); }\n");
  write(root, "src/app/api/cron/nightly/route.ts", "export async function GET() { return Response.json({ ok: true }); }\n");
  write(root, "src/app/api/stripe/webhook/route.ts", "export async function POST(request) { request.headers.get('stripe-signature'); }\n");
  write(
    root,
    "src/app/api/external-actions/[token]/submit/route.ts",
    "import { publicTokenHash } from '@/lib/security/public-token-key';\nexport async function POST() { publicTokenHash('x'); }\n",
  );

  const inventory = buildCompatibilityRouteInventory(root);
  const byPath = new Map(inventory.routes.map((route) => [route.path, route]));

  assert.equal(inventory.routeCount, 4);
  assert.equal(byPath.get("/api/contracts").externallyCalled, false);
  assert.deepEqual(byPath.get("/api/contracts").categories, ["api"]);
  assert.deepEqual(byPath.get("/api/cron/nightly").externalCallers, ["vercel_cron"]);
  assert.ok(byPath.get("/api/stripe/webhook").categories.includes("webhook"));
  assert.ok(byPath.get("/api/external-actions/[token]/submit").categories.includes("signed_link"));
  assert.ok(byPath.get("/api/external-actions/[token]/submit").categories.includes("public_token"));
});

test("analyzeCompatibilityRouteInventory accepts a current inventory", () => {
  const root = makeRoot();
  write(root, "src/app/api/contracts/route.ts", "export async function GET() { return Response.json({ ok: true }); }\n");
  writeInventory(root, buildCompatibilityRouteInventory(root));

  const report = analyzeCompatibilityRouteInventory({ root });

  assert.equal(report.ok, true);
  assert.equal(report.issueCount, 0);
});

test("buildCompatibilityRouteInventory adds deprecation metadata to generated aliases", () => {
  const root = makeRoot();
  write(root, "src/app/api/cron/v10/read-model-refresh/route.ts", "export async function GET() { return Response.json({ ok: true }); }\n");
  write(root, "src/app/api/cron/read-model-refresh/route.ts", "export * from '../v10/read-model-refresh/route';\n");

  const inventory = buildCompatibilityRouteInventory(root);
  const alias = inventory.aliases.find((row) => row.from === "/api/cron/v10/read-model-refresh");

  assert.equal(alias.status, "alias_added");
  assert.equal(alias.earliestRemovalCondition.length > 0, true);
  assert.equal(alias.manualFollowUp.length > 0, true);
});


test("analyzeCompatibilityRouteInventory fails when a sensitive route disappears without alias", () => {
  const root = makeRoot();
  write(root, "src/app/api/contracts/route.ts", "export async function GET() { return Response.json({ ok: true }); }\n");
  const inventory = buildCompatibilityRouteInventory(root);
  writeInventory(root, inventory);
  fs.rmSync(path.join(root, "src/app/api/contracts/route.ts"));

  const report = analyzeCompatibilityRouteInventory({ root });

  assert.equal(report.ok, false);
  assert.ok(report.issues.some((issue) => issue.issue === "compatibility_route_missing_without_alias"));
});

test("analyzeCompatibilityRouteInventory accepts an alias for a removed sensitive route", () => {
  const root = makeRoot();
  write(root, "src/app/api/contracts-next/route.ts", "export async function GET() { return Response.json({ ok: true }); }\n");
  const inventory = buildCompatibilityRouteInventory(root);
  inventory.aliases = [
    {
      from: "/api/contracts",
      to: "/api/contracts-next",
      owner: "platform",
      reason: "compatibility alias retained during route rename",
    },
  ];
  inventory.routes.push({
    path: "/api/contracts",
    routeFile: "src/app/api/contracts/route.ts",
    methods: ["GET"],
    categories: ["api"],
    externallyCalled: false,
    externalCallers: [],
    compatibilitySensitive: true,
    cronSchedule: null,
  });
  writeInventory(root, inventory);

  const report = analyzeCompatibilityRouteInventory({ root });

  assert.equal(report.ok, true);
});

test("analyzeCompatibilityRouteInventory fails when cron routes drift from deployment config", () => {
  const root = makeRoot();
  write(root, "vercel.json", JSON.stringify({ crons: [] }));
  write(root, "src/app/api/cron/nightly/route.ts", "export async function GET() { return Response.json({ ok: true }); }\n");
  writeInventory(root, buildCompatibilityRouteInventory(root));

  const report = analyzeCompatibilityRouteInventory({ root });

  assert.equal(report.ok, false);
  assert.ok(report.issues.some((issue) => issue.issue === "cron_route_missing_vercel_schedule"));
});
