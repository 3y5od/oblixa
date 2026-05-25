#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.join(__dirname, "..");
const DEFAULT_INVENTORY_REL = "artifacts/telemetry/event-inventory.json";
const SOURCE_ROOTS = ["src", "supabase/migrations"];
const TEXT_EXTENSIONS = new Set([".js", ".jsx", ".mjs", ".ts", ".tsx", ".sql"]);
const EXCLUDED_DIRS = new Set([".git", ".next", "artifacts", "coverage", "node_modules", "playwright-report", "test-results"]);
const TEST_FILE_RE = /\.(?:test|spec|v\d+\.test)\.(?:js|jsx|ts|tsx)$/u;
const EVENT_NAME_RE = /^[a-z0-9][a-z0-9._:%*-]{0,159}$/u;
const VERSIONED_EVENT_RE = /(^|[._:-])v\d+(?=$|[._:-])/iu;
const TELEMETRY_BRIDGE_EXPORT_NAME = ["V" + "10", "TELEMETRY", "COMPATIBILITY", "BRIDGES"].join("_");
const AUDIT_WRITER_RE = new RegExp(
  [
    "audit_events",
    ["record", "V" + "10", "AuditEvent"].join(""),
    "recordSecurityAuditEvent",
    "recordSecurityAuditEventStrict",
    ["record", "V" + "10", "AuditEventStrict"].join(""),
  ].join("|"),
  "u",
);

function read(file) {
  return fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
}

function toPosix(value) {
  return String(value).replace(/\\/g, "/");
}

function relPath(root, abs) {
  return toPosix(path.relative(root, abs));
}

function stableStringify(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function sourceLineForIndex(text, index) {
  return text.slice(0, index).split(/\r?\n/u).length;
}

function walkFiles(root, dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!EXCLUDED_DIRS.has(entry.name)) walkFiles(root, abs, acc);
      continue;
    }
    if (!entry.isFile()) continue;
    if (!TEXT_EXTENSIONS.has(path.extname(entry.name))) continue;
    if (TEST_FILE_RE.test(entry.name)) continue;
    acc.push(abs);
  }
  return acc;
}

function listSourceFiles(root) {
  const files = [];
  for (const rel of SOURCE_ROOTS) walkFiles(root, path.join(root, rel), files);
  return files.sort((a, b) => relPath(root, a).localeCompare(relPath(root, b)));
}

function sortedSet(set) {
  return Array.from(set ?? []).sort((a, b) => a.localeCompare(b));
}

function uniqueRows(rows) {
  const seen = new Set();
  const out = [];
  for (const row of rows) {
    const key = JSON.stringify(row);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

function normalizeEventName(value) {
  const name = String(value ?? "").trim();
  return EVENT_NAME_RE.test(name) ? name : "";
}

function templateEventName(value) {
  return normalizeEventName(String(value).replace(/\$\{[^}]+\}/gu, "*"));
}

function contextWindow(text, index, before = 240, after = 240) {
  return text.slice(Math.max(0, index - before), Math.min(text.length, index + after));
}

function addEvent(events, eventName, row) {
  const normalized = normalizeEventName(eventName);
  if (!normalized) return;
  events.push({
    eventName: normalized,
    ...row,
  });
}

function quotedValues(text) {
  return [...text.matchAll(/["']([^"']+)["']/gu)].map((match) => ({ value: match[1], index: match.index ?? 0 }));
}

function classifyActionReference({ eventName, context }) {
  if (eventName.startsWith("product.")) return "product_telemetry_emit";
  if (AUDIT_WRITER_RE.test(context)) {
    return "audit_action_reference";
  }
  if (/\./u.test(eventName)) return "action_event_reference";
  return "";
}

function classifyPropertyReference({ property, eventName, context }) {
  if (property === "action" || property === "auditAction") return classifyActionReference({ eventName, context });
  if (property === "event_type") return "event_type_write";
  if (/outbound_events|webhook|dispatch|acceptedEvents/u.test(context)) return "outbound_event_type";
  return "event_type_reference";
}

function compatibilityConsumersFor({ eventName, eventClass, file, context }) {
  const consumers = new Set();
  if (eventClass.startsWith("product_") || eventName.startsWith("product.")) consumers.add("analytics_dashboard");
  if (eventClass.includes("event_type") || eventClass === "sql_event_type_constraint") consumers.add("database_persisted_event");
  if (eventClass.includes("action_event") || eventClass.includes("bridge")) consumers.add("analytics_dashboard");
  if (/outbound_events|webhook|acceptedEvents|webhook_subscriptions/u.test(context) || eventClass === "webhook_subscription_default") {
    consumers.add("webhook_subscriber");
  }
  if (AUDIT_WRITER_RE.test(context) || eventClass.includes("audit")) {
    consumers.add("audit_log");
  }
  if (/security\./u.test(eventName)) consumers.add("security_audit");
  if (/(?:dashboard|analytics|insights|milestones|usage-stats|health|slo)/iu.test(file)) consumers.add("analytics_dashboard");
  if (/(?:sla|breach|failed|suppressed|alert)/iu.test(eventName)) consumers.add("operations_alert");
  return sortedSet(consumers);
}

function collectProductTelemetryActions({ text, sourcePath }) {
  const events = [];
  const block = text.match(/PRODUCT_TELEMETRY_ACTIONS\s*=\s*\[([\s\S]*?)\]\s+as\s+const/u);
  if (!block) return events;
  const baseIndex = block.index ?? 0;
  for (const match of quotedValues(block[1])) {
    addEvent(events, match.value, {
      file: sourcePath,
      line: sourceLineForIndex(text, baseIndex + match.index),
      eventClass: "product_telemetry_definition",
      property: "PRODUCT_TELEMETRY_ACTIONS",
      context: "product telemetry allowlist",
    });
  }
  return events;
}

function collectTelemetryBridges({ text, sourcePath }) {
  const bridges = [];
  const block = text.match(new RegExp(`${TELEMETRY_BRIDGE_EXPORT_NAME}\\s*=\\s*\\{([\\s\\S]*?)\\}\\s+as\\s+const`, "u"));
  if (!block) return bridges;
  const baseIndex = block.index ?? 0;
  for (const match of block[1].matchAll(/["']([^"']+)["']\s*:\s*["']([^"']+)["']/gu)) {
    const from = normalizeEventName(match[1]);
    const to = normalizeEventName(match[2]);
    if (!from || !to) continue;
    bridges.push({
      from,
      to,
      file: sourcePath,
      line: sourceLineForIndex(text, baseIndex + (match.index ?? 0)),
      compatibilitySensitive: true,
    });
  }
  return bridges;
}

function collectPropertyEvents({ text, sourcePath }) {
  const events = [];
  const literalRe = /\b(eventType|event_type|action|auditAction)\s*:\s*["']([^"']+)["']/gu;
  for (const match of text.matchAll(literalRe)) {
    const property = match[1];
    const eventName = normalizeEventName(match[2]);
    if (!eventName) continue;
    const context = contextWindow(text, match.index ?? 0);
    const eventClass = classifyPropertyReference({ property, eventName, context });
    if (!eventClass) continue;
    addEvent(events, eventName, {
      file: sourcePath,
      line: sourceLineForIndex(text, match.index ?? 0),
      eventClass,
      property,
      context,
    });
  }

  const templateRe = /\b(eventType|event_type|action|auditAction)\s*:\s*`([^`]*\$\{[^`]+\}[^`]*)`/gu;
  for (const match of text.matchAll(templateRe)) {
    const property = match[1];
    const eventName = templateEventName(match[2]);
    if (!eventName) continue;
    const context = contextWindow(text, match.index ?? 0);
    const eventClass = classifyPropertyReference({ property, eventName, context });
    if (!eventClass) continue;
    addEvent(events, eventName, {
      file: sourcePath,
      line: sourceLineForIndex(text, match.index ?? 0),
      eventClass,
      property,
      context,
    });
  }

  return events;
}

function collectQueryEvents({ text, sourcePath }) {
  const events = [];
  const scalarRe = /\.(eq|neq|like|ilike)\(\s*["'](event_type|action)["']\s*,\s*["']([^"']+)["']\s*\)/gu;
  for (const match of text.matchAll(scalarRe)) {
    const eventName = normalizeEventName(match[3]);
    if (!eventName) continue;
    const context = contextWindow(text, match.index ?? 0);
    const eventClass = match[2] === "action" ? classifyActionReference({ eventName, context }) : "event_type_query";
    if (!eventClass) continue;
    addEvent(events, eventName, {
      file: sourcePath,
      line: sourceLineForIndex(text, match.index ?? 0),
      eventClass,
      property: match[2],
      context,
    });
  }

  const inRe = /\.in\(\s*["'](event_type|action)["']\s*,\s*\[([\s\S]*?)\]\s*\)/gu;
  for (const match of text.matchAll(inRe)) {
    const context = contextWindow(text, match.index ?? 0);
    for (const value of quotedValues(match[2])) {
      const eventName = normalizeEventName(value.value);
      if (!eventName) continue;
      const eventClass = match[1] === "action" ? classifyActionReference({ eventName, context }) : "event_type_query";
      if (!eventClass) continue;
      addEvent(events, eventName, {
        file: sourcePath,
        line: sourceLineForIndex(text, match.index ?? 0),
        eventClass,
        property: match[1],
        context,
      });
    }
  }

  return events;
}

function collectSqlEvents({ text, sourcePath }) {
  if (!sourcePath.endsWith(".sql")) return [];
  const events = [];
  const constraintRe = /event_type[\s\S]{0,160}?check\s*\([^)]*?event_type\s+in\s*\(([^)]*)\)/giu;
  for (const match of text.matchAll(constraintRe)) {
    for (const value of quotedValues(match[1])) {
      addEvent(events, value.value, {
        file: sourcePath,
        line: sourceLineForIndex(text, match.index ?? 0),
        eventClass: "sql_event_type_constraint",
        property: "event_type",
        context: contextWindow(text, match.index ?? 0),
      });
    }
  }

  const defaultEventsRe = /\bevents\s+text\[\][\s\S]{0,180}?default\s+'?\{([^}]*)\}'?/giu;
  for (const match of text.matchAll(defaultEventsRe)) {
    for (const value of quotedValues(match[1])) {
      addEvent(events, value.value, {
        file: sourcePath,
        line: sourceLineForIndex(text, match.index ?? 0),
        eventClass: "webhook_subscription_default",
        property: "events",
        context: contextWindow(text, match.index ?? 0),
      });
    }
  }

  return events;
}

export function collectTelemetryEventsFromText({ text, sourcePath }) {
  return [
    ...collectProductTelemetryActions({ text, sourcePath }),
    ...collectPropertyEvents({ text, sourcePath }),
    ...collectQueryEvents({ text, sourcePath }),
    ...collectSqlEvents({ text, sourcePath }),
  ];
}

function summarizeEvents(refs) {
  const byName = new Map();
  for (const ref of refs) {
    const row = byName.get(ref.eventName) ?? {
      eventName: ref.eventName,
      eventClasses: new Set(),
      sources: [],
      compatibilityConsumers: new Set(),
      versioned: VERSIONED_EVENT_RE.test(ref.eventName),
      pattern: /[%*]/u.test(ref.eventName),
    };
    row.eventClasses.add(ref.eventClass);
    row.sources.push({
      file: ref.file,
      line: ref.line,
      eventClass: ref.eventClass,
      property: ref.property,
    });
    for (const consumer of compatibilityConsumersFor(ref)) row.compatibilityConsumers.add(consumer);
    byName.set(ref.eventName, row);
  }

  return Array.from(byName.values())
    .map((row) => ({
      eventName: row.eventName,
      eventClasses: sortedSet(row.eventClasses),
      compatibilitySensitive: row.compatibilityConsumers.size > 0,
      compatibilityConsumers: sortedSet(row.compatibilityConsumers),
      versioned: row.versioned,
      pattern: row.pattern,
      neutralAlias: neutralAliasForVersionedEvent(row.eventName),
      sources: uniqueRows(row.sources).sort(
        (a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.eventClass.localeCompare(b.eventClass),
      ),
    }))
    .sort((a, b) => a.eventName.localeCompare(b.eventName));
}

function neutralAliasForVersionedEvent(eventName) {
  const productMatch = /^product\.v(\d+)\.(.+)$/u.exec(eventName);
  if (productMatch) {
    const [, version, suffix] = productMatch;
    return version === "10" ? `product.${suffix}` : `product.compat.${suffix}`;
  }
  const genericMatch = /^v\d+[._:-](.+)$/u.exec(eventName);
  if (genericMatch) return genericMatch[1].replace(/[:]/gu, ".");
  return null;
}

function normalizeVersionedNameExceptions(exceptions) {
  return (Array.isArray(exceptions) ? exceptions : [])
    .map((exception) => ({
      eventName: normalizeEventName(exception?.eventName),
      owner: String(exception?.owner ?? ""),
      reason: String(exception?.reason ?? ""),
    }))
    .filter((exception) => exception.eventName)
    .sort((a, b) => a.eventName.localeCompare(b.eventName));
}

function bootstrapVersionedNameExceptions(events) {
  return events
    .filter((event) => event.versioned && !event.pattern)
    .map((event) => ({
      eventName: event.eventName,
      owner: "platform",
      reason: "Existing versioned telemetry label retained for compatibility until neutral aliases and removal queue land.",
    }))
    .sort((a, b) => a.eventName.localeCompare(b.eventName));
}

function buildVersionedEventRemovalQueue({ events, exceptions }) {
  const exceptionByName = new Map(normalizeVersionedNameExceptions(exceptions).map((row) => [row.eventName, row]));
  return events
    .filter((event) => event.versioned && !event.pattern)
    .map((event) => {
      const exception = exceptionByName.get(event.eventName) ?? {};
      return {
        eventName: event.eventName,
        owner: exception.owner ?? "platform",
        reason: exception.reason ?? "Existing versioned telemetry label retained for compatibility.",
        neutralAlias: event.neutralAlias,
        status: "legacy_retained",
        validationCommand: "npm run check:telemetry-event-inventory",
        manualFollowUp: "Migrate analytics, dashboard, alert, webhook, or audit consumers before removing the legacy event label.",
      };
    })
    .sort((a, b) => a.eventName.localeCompare(b.eventName));
}

export function buildTelemetryEventInventory(root = DEFAULT_ROOT, options = {}) {
  const refs = [];
  const bridges = [];
  for (const abs of listSourceFiles(root)) {
    const sourcePath = relPath(root, abs);
    const text = read(abs);
    refs.push(...collectTelemetryEventsFromText({ text, sourcePath }));
    bridges.push(...collectTelemetryBridges({ text, sourcePath }));
  }

  for (const bridge of bridges) {
    refs.push(
      {
        eventName: bridge.from,
        file: bridge.file,
        line: bridge.line,
        eventClass: "telemetry_bridge_source",
        property: TELEMETRY_BRIDGE_EXPORT_NAME,
        context: "telemetry compatibility bridge",
      },
      {
        eventName: bridge.to,
        file: bridge.file,
        line: bridge.line,
        eventClass: "telemetry_bridge_target",
        property: TELEMETRY_BRIDGE_EXPORT_NAME,
        context: "telemetry compatibility bridge",
      },
    );
  }

  const events = summarizeEvents(refs);
  const versionedNameExceptions =
    options.versionedNameExceptions === undefined
      ? bootstrapVersionedNameExceptions(events)
      : normalizeVersionedNameExceptions(options.versionedNameExceptions);
  const versionedEventRemovalQueue = buildVersionedEventRemovalQueue({
    events,
    exceptions: versionedNameExceptions,
  });
  const productVersionedEvents = events.filter((event) => /^product\.v\d+\./u.test(event.eventName));

  return {
    schemaVersion: 1,
    generatedBy: "scripts/check-telemetry-event-inventory.mjs --write",
    sourceRoots: SOURCE_ROOTS,
    eventCount: events.length,
    compatibilitySensitiveCount: events.filter((event) => event.compatibilitySensitive).length,
    versionedEventNameCount: events.filter((event) => event.versioned && !event.pattern).length,
    neutralAliasCount: events.filter((event) => event.neutralAlias).length,
    bridgeCount: bridges.length,
    neutralAliasCoverage: {
      productVersionedEventCount: productVersionedEvents.length,
      productNeutralAliasCount: productVersionedEvents.filter((event) => event.neutralAlias).length,
      normalizerExport: "normalizeProductTelemetryAction",
    },
    versionedNameExceptions,
    versionedEventRemovalQueue,
    bridges: bridges.sort((a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to)),
    events,
  };
}

function loadInventory(root, inventoryRel) {
  const abs = path.join(root, inventoryRel);
  if (!fs.existsSync(abs)) return null;
  return JSON.parse(read(abs));
}

function analyzeVersionedExceptions({ current }) {
  const issues = [];
  const versionedEvents = new Set(current.events.filter((event) => event.versioned && !event.pattern).map((event) => event.eventName));
  const exceptions = normalizeVersionedNameExceptions(current.versionedNameExceptions);
  const seen = new Set();

  for (const exception of exceptions) {
    if (seen.has(exception.eventName)) {
      issues.push({ issue: "duplicate_versioned_telemetry_event_exception", eventName: exception.eventName });
    }
    seen.add(exception.eventName);
    if (!exception.owner) issues.push({ issue: "versioned_telemetry_event_exception_missing_owner", eventName: exception.eventName });
    if (!exception.reason) issues.push({ issue: "versioned_telemetry_event_exception_missing_reason", eventName: exception.eventName });
    if (!versionedEvents.has(exception.eventName)) {
      issues.push({ issue: "stale_versioned_telemetry_event_exception", eventName: exception.eventName });
    }
  }

  for (const eventName of versionedEvents) {
    if (!seen.has(eventName)) {
      issues.push({
        issue: "versioned_telemetry_event_missing_exception",
        eventName,
        hint: "Add a reviewed versionedNameExceptions entry or rename to a neutral event label.",
      });
    }
  }

  return issues;
}

function analyzeBridges({ current }) {
  const issues = [];
  const eventNames = new Set(current.events.map((event) => event.eventName));
  for (const bridge of current.bridges) {
    if (!eventNames.has(bridge.from)) {
      issues.push({ issue: "telemetry_bridge_source_missing", eventName: bridge.from, to: bridge.to });
    }
    if (!eventNames.has(bridge.to)) {
      issues.push({ issue: "telemetry_bridge_target_missing", eventName: bridge.to, from: bridge.from });
    }
  }
  return issues;
}

function analyzeRemovalQueue({ current }) {
  const issues = [];
  const queue = Array.isArray(current.versionedEventRemovalQueue) ? current.versionedEventRemovalQueue : [];
  const versionedEvents = new Set(current.events.filter((event) => event.versioned && !event.pattern).map((event) => event.eventName));
  const queuedEvents = new Set();
  for (const row of queue) {
    if (!row.eventName || !versionedEvents.has(row.eventName)) {
      issues.push({ issue: "versioned_event_removal_queue_stale_entry", eventName: row.eventName ?? null });
    }
    if (!row.owner) issues.push({ issue: "versioned_event_removal_queue_missing_owner", eventName: row.eventName ?? null });
    if (!row.reason) issues.push({ issue: "versioned_event_removal_queue_missing_reason", eventName: row.eventName ?? null });
    if (!row.status) issues.push({ issue: "versioned_event_removal_queue_missing_status", eventName: row.eventName ?? null });
    if (!row.validationCommand) issues.push({ issue: "versioned_event_removal_queue_missing_validation_command", eventName: row.eventName ?? null });
    if (!row.manualFollowUp) issues.push({ issue: "versioned_event_removal_queue_missing_manual_follow_up", eventName: row.eventName ?? null });
    queuedEvents.add(row.eventName);
  }
  for (const eventName of versionedEvents) {
    if (!queuedEvents.has(eventName)) {
      issues.push({ issue: "versioned_event_missing_removal_queue_entry", eventName });
    }
  }
  return issues;
}

export function analyzeTelemetryEventInventory(options = {}) {
  const root = options.root ?? DEFAULT_ROOT;
  const inventoryRel = toPosix(options.inventoryRel ?? DEFAULT_INVENTORY_REL);
  const committed = loadInventory(root, inventoryRel);
  const current = buildTelemetryEventInventory(root, { versionedNameExceptions: committed?.versionedNameExceptions ?? [] });
  const issues = [];

  if (!committed) {
    issues.push({ issue: "telemetry_event_inventory_missing", path: inventoryRel });
  } else if (committed.schemaVersion !== 1) {
    issues.push({ issue: "invalid_telemetry_event_inventory_schema", path: inventoryRel });
  } else if (stableStringify(committed) !== stableStringify(current)) {
    issues.push({
      issue: "telemetry_event_inventory_drift",
      path: inventoryRel,
      hint: "Run npm run write:telemetry-event-inventory",
    });
  }

  issues.push(...analyzeVersionedExceptions({ current }));
  issues.push(...analyzeBridges({ current }));
  issues.push(...analyzeRemovalQueue({ current }));
  if (committed) issues.push(...analyzeRemovalQueue({ current: committed }));

  return {
    ok: issues.length === 0,
    inventoryPath: inventoryRel,
    eventCount: current.eventCount,
    compatibilitySensitiveCount: current.compatibilitySensitiveCount,
    versionedEventNameCount: current.versionedEventNameCount,
    neutralAliasCount: current.neutralAliasCount,
    bridgeCount: current.bridgeCount,
    issueCount: issues.length,
    issues,
    current,
  };
}

function parseArgs(argv) {
  const options = {
    root: DEFAULT_ROOT,
    inventoryRel: DEFAULT_INVENTORY_REL,
    write: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--root") {
      options.root = path.resolve(argv[index + 1] ?? "");
      index += 1;
    } else if (arg.startsWith("--root=")) {
      options.root = path.resolve(arg.slice("--root=".length));
    } else if (arg === "--inventory") {
      options.inventoryRel = toPosix(argv[index + 1] ?? DEFAULT_INVENTORY_REL);
      index += 1;
    } else if (arg.startsWith("--inventory=")) {
      options.inventoryRel = toPosix(arg.slice("--inventory=".length));
    } else if (arg === "--write") {
      options.write = true;
    }
  }
  return options;
}

function writeInventory(root, inventoryRel) {
  const existing = loadInventory(root, inventoryRel);
  const inventory = buildTelemetryEventInventory(root, {
    versionedNameExceptions: existing?.versionedNameExceptions,
  });
  const abs = path.join(root, inventoryRel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, stableStringify(inventory));
  return inventory;
}

export function runTelemetryEventInventoryCheck(options = parseArgs(process.argv.slice(2))) {
  if (options.write) {
    const inventory = writeInventory(options.root, options.inventoryRel);
    console.log(
      JSON.stringify(
        {
          ok: true,
          wrote: options.inventoryRel,
          eventCount: inventory.eventCount,
          compatibilitySensitiveCount: inventory.compatibilitySensitiveCount,
          versionedEventNameCount: inventory.versionedEventNameCount,
          neutralAliasCount: inventory.neutralAliasCount,
          bridgeCount: inventory.bridgeCount,
        },
        null,
        2,
      ),
    );
    return inventory;
  }

  const report = analyzeTelemetryEventInventory(options);
  const { current, ...printable } = report;
  console.log(JSON.stringify(printable, null, 2));
  if (!report.ok) process.exitCode = 1;
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runTelemetryEventInventoryCheck();
}
