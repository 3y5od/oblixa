import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  analyzeTelemetryEventInventory,
  buildTelemetryEventInventory,
  collectTelemetryEventsFromText,
} from "./check-telemetry-event-inventory.mjs";

const LEGACY_PRODUCT_EVENT = ["product", "v" + "9", "legacy_opened"].join(".");
const PAGE_LOAD_EVENT = ["product", "v" + "9", "page_load_measured"].join(".");
const FUTURE_PRODUCT_EVENT = ["product", "v" + "11", "new_label"].join(".");
const BRIDGE_EXPORT = ["V" + "10", "TELEMETRY", "COMPATIBILITY", "BRIDGES"].join("_");

function makeRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "telemetry-event-inventory-"));
}

function write(root, rel, content) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
  return abs;
}

function writeInventory(root, inventory) {
  write(root, "artifacts/telemetry/event-inventory.json", `${JSON.stringify(inventory, null, 2)}\n`);
}

test("collectTelemetryEventsFromText extracts literal, query, template, and SQL event names", () => {
  const refs = collectTelemetryEventsFromText({
    sourcePath: "src/app/api/example/route.ts",
    text: `
      await emitProductTelemetryEvent(admin, { action: "${PAGE_LOAD_EVENT}" });
      await admin.from("events").insert({ event_type: "decision.created" });
      await admin.from("events").insert({ event_type: \`external.workflow.\${stepType}\` });
      await admin.from("events").select("*").eq("event_type", "external.submitted");
      await admin.from("audit_events").select("*").in("action", ["field.approved"]);
    `,
  });

  assert.deepEqual(
    refs.map((ref) => ref.eventName).sort(),
    [
      "decision.created",
      "external.submitted",
      "external.workflow.*",
      "field.approved",
      PAGE_LOAD_EVENT,
    ],
  );
});

test("buildTelemetryEventInventory classifies compatibility-sensitive events and bootstraps versioned exceptions", () => {
  const root = makeRoot();
  write(
    root,
    "src/lib/product-telemetry.ts",
    `
      export const PRODUCT_TELEMETRY_ACTIONS = [
        "${LEGACY_PRODUCT_EVENT}",
        "product.command_palette_opened",
      ] as const;
      export const ${BRIDGE_EXPORT} = {
        "${LEGACY_PRODUCT_EVENT}": "product.command_palette_opened",
      } as const;
    `,
  );
  write(
    root,
    "src/app/api/webhooks/dispatch/route.ts",
    `await admin.from("outbound_events").insert({ event_type: "contract.updated" });`,
  );
  write(
    root,
    "supabase/migrations/001_events.sql",
    `
      create table public.task_events (
        event_type text not null check (event_type in ('created', 'deleted'))
      );
      create table public.webhook_subscriptions (
        events text[] not null default '{"contract.updated","reminder.due"}'
      );
    `,
  );

  const inventory = buildTelemetryEventInventory(root);
  const byName = new Map(inventory.events.map((event) => [event.eventName, event]));

  assert.equal(inventory.bridgeCount, 1);
  assert.equal(inventory.neutralAliasCount, 1);
  assert.equal(byName.get(LEGACY_PRODUCT_EVENT).versioned, true);
  assert.equal(byName.get(LEGACY_PRODUCT_EVENT).neutralAlias, "product.compat.legacy_opened");
  assert.ok(byName.get(LEGACY_PRODUCT_EVENT).compatibilityConsumers.includes("analytics_dashboard"));
  assert.ok(byName.get("contract.updated").compatibilityConsumers.includes("webhook_subscriber"));
  assert.ok(byName.get("created").compatibilityConsumers.includes("database_persisted_event"));
  assert.ok(inventory.versionedNameExceptions.some((row) => row.eventName === LEGACY_PRODUCT_EVENT));
  assert.ok(inventory.versionedEventRemovalQueue.some((row) => row.eventName === LEGACY_PRODUCT_EVENT));
});

test("analyzeTelemetryEventInventory accepts a current inventory", () => {
  const root = makeRoot();
  write(
    root,
    "src/lib/product-telemetry.ts",
    'export const PRODUCT_TELEMETRY_ACTIONS = ["product.command_palette_opened"] as const;\n',
  );
  writeInventory(root, buildTelemetryEventInventory(root));

  const report = analyzeTelemetryEventInventory({ root });

  assert.equal(report.ok, true);
  assert.equal(report.issueCount, 0);
});

test("analyzeTelemetryEventInventory fails when a new versioned event lacks an exception", () => {
  const root = makeRoot();
  write(
    root,
    "src/lib/product-telemetry.ts",
    'export const PRODUCT_TELEMETRY_ACTIONS = ["product.command_palette_opened"] as const;\n',
  );
  writeInventory(root, buildTelemetryEventInventory(root));
  write(
    root,
    "src/actions/product-telemetry.ts",
    `await emitProductTelemetryEvent(admin, { action: "${FUTURE_PRODUCT_EVENT}" });\n`,
  );

  const report = analyzeTelemetryEventInventory({ root });

  assert.equal(report.ok, false);
  assert.ok(report.issues.some((issue) => issue.issue === "versioned_telemetry_event_missing_exception"));
});

test("analyzeTelemetryEventInventory validates versioned exception metadata", () => {
  const root = makeRoot();
  write(
    root,
    "src/lib/product-telemetry.ts",
    `export const PRODUCT_TELEMETRY_ACTIONS = ["${LEGACY_PRODUCT_EVENT}"] as const;\n`,
  );
  const inventory = buildTelemetryEventInventory(root);
  inventory.versionedNameExceptions = [{ eventName: LEGACY_PRODUCT_EVENT, owner: "", reason: "" }];
  writeInventory(root, inventory);

  const report = analyzeTelemetryEventInventory({ root });

  assert.equal(report.ok, false);
  assert.ok(report.issues.some((issue) => issue.issue === "versioned_telemetry_event_exception_missing_owner"));
  assert.ok(report.issues.some((issue) => issue.issue === "versioned_telemetry_event_exception_missing_reason"));
});

test("analyzeTelemetryEventInventory validates versioned removal queue metadata", () => {
  const root = makeRoot();
  write(
    root,
    "src/lib/product-telemetry.ts",
    `export const PRODUCT_TELEMETRY_ACTIONS = ["${LEGACY_PRODUCT_EVENT}"] as const;\n`,
  );
  const inventory = buildTelemetryEventInventory(root);
  inventory.versionedEventRemovalQueue = [
    {
      eventName: LEGACY_PRODUCT_EVENT,
      owner: "",
      reason: "",
      neutralAlias: null,
      status: "",
      validationCommand: "",
      manualFollowUp: "",
    },
  ];
  writeInventory(root, inventory);

  const report = analyzeTelemetryEventInventory({ root });

  assert.equal(report.ok, false);
  assert.ok(report.issues.some((issue) => issue.issue === "telemetry_event_inventory_drift"));
  assert.ok(report.issues.some((issue) => issue.issue === "versioned_event_removal_queue_missing_owner"));
  assert.ok(report.issues.some((issue) => issue.issue === "versioned_event_removal_queue_missing_manual_follow_up"));
});

test("analyzeTelemetryEventInventory fails on inventory drift", () => {
  const root = makeRoot();
  write(
    root,
    "src/lib/product-telemetry.ts",
    'export const PRODUCT_TELEMETRY_ACTIONS = ["product.command_palette_opened"] as const;\n',
  );
  writeInventory(root, buildTelemetryEventInventory(root));
  write(root, "src/actions/product-telemetry.ts", 'await emitProductTelemetryEvent(admin, { action: "product.exported" });\n');

  const report = analyzeTelemetryEventInventory({ root });

  assert.equal(report.ok, false);
  assert.ok(report.issues.some((issue) => issue.issue === "telemetry_event_inventory_drift"));
});
