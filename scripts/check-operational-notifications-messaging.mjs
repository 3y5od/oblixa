#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

import { analyzeNotificationPayloadScrubContract } from "./check-notification-payload-scrub-contract.mjs";
import { analyzeOutboundMessageSafety } from "./check-outbound-message-safety.mjs";
import { analyzePoisonMessageContainment } from "./check-poison-message-containment.mjs";
import { analyzeQueueMessageAuthenticity } from "./check-queue-message-authenticity.mjs";
import {
  assertUserFacingInteractionReport,
  buildUserFacingInteractionReport,
} from "./report-user-facing-interactions.mjs";

const ROOT = process.cwd();
const CONFIG_REL = "config/operational-notifications-messaging.json";
const ARTIFACT_REL = "artifacts/operational-notifications-messaging.json";
const WRITE = process.argv.includes("--write");

const REQUIRED_MESSAGE_SURFACES = new Set([
  "email",
  "in-app-notifications",
  "toasts",
  "alerts",
  "errors",
  "banners",
  "reminders",
  "evidence-requests",
  "billing-notices",
]);

const REQUIRED_ELIGIBILITY_RULES = new Set([
  "opt-out",
  "disabled-org",
  "inactive-user",
  "billing-state",
  "workspace-mode",
  "duplicate-suppression",
  "rate-limits",
  "digest-grouping",
]);

const REQUIRED_RENDERING_SAFEGUARDS = new Set([
  "html-escaping",
  "markdown-links",
  "unsubscribe",
  "long-names",
  "missing-fields",
  "locale-dates",
  "no-secret-payloads",
]);

const REQUIRED_RETRY_CLASSES = new Set([
  "provider-failure",
  "transient-failure",
  "permanent-failure",
  "duplicate-delivery",
  "stale-notification",
  "poison-payload",
]);

function stableStringify(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function read(root, rel) {
  if (!rel) return "";
  const abs = path.join(root, rel);
  return fs.existsSync(abs) ? fs.readFileSync(abs, "utf8") : "";
}

function readJson(root, rel, fallback = null) {
  const text = read(root, rel);
  return text ? JSON.parse(text) : fallback;
}

function writeJson(root, rel, value) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, stableStringify(value));
}

function issue(code, fields = {}) {
  return { issue: code, ...fields };
}

function commandText(script) {
  return `npm run ${script}`;
}

function packageScripts(root) {
  return readJson(root, "package.json", { scripts: {} })?.scripts ?? {};
}

function validationCommandExists(scripts, command) {
  if (typeof command !== "string" || !command.trim()) return false;
  if (scripts[command]) return true;
  if (command.startsWith("npm run ")) return Boolean(scripts[command.slice("npm run ".length)]);
  return false;
}

function validateCommands(root, config, scripts, issues) {
  const ci = read(root, ".github/workflows/ci.yml");
  const rows = [];

  for (const objective of config.objectives ?? []) {
    for (const row of objective.commands ?? []) {
      const script = row.command;
      const packageScriptPresent = Boolean(scripts[script]);
      const ciPresent = ci.includes(commandText(script));
      if (!packageScriptPresent) {
        issues.push(issue("operational_notifications_missing_package_script", { objective: objective.id, script }));
      }
      if (row.ciRequired && !ciPresent) {
        issues.push(issue("operational_notifications_missing_ci_command", { objective: objective.id, script }));
      }
      rows.push({
        objective: objective.id,
        script,
        ciRequired: Boolean(row.ciRequired),
        packageScriptPresent,
        ciPresent,
        covers: [...(row.covers ?? [])].sort((a, b) => a.localeCompare(b)),
      });
    }

    for (const rel of objective.artifacts ?? []) {
      if (rel !== ARTIFACT_REL && !fs.existsSync(path.join(root, rel))) {
        issues.push(issue("operational_notifications_missing_objective_artifact", { objective: objective.id, path: rel }));
      }
    }
  }

  return rows.sort((a, b) => `${a.objective}:${a.script}`.localeCompare(`${b.objective}:${b.script}`));
}

export function validateMarkerRows(root, rows, requiredIds, issuePrefix, issues, scripts = packageScripts(root)) {
  const seen = new Set();
  const out = [];

  for (const row of rows ?? []) {
    const text = read(root, row.path);
    const missing = [];
    if (seen.has(row.id)) {
      issues.push(issue(`${issuePrefix}_duplicate_id`, { id: row.id }));
    }
    seen.add(row.id);
    if (typeof row.owner !== "string" || !row.owner.startsWith("@")) {
      issues.push(issue(`${issuePrefix}_missing_owner`, { id: row.id, owner: row.owner ?? null }));
    }
    if (!validationCommandExists(scripts, row.validationCommand)) {
      issues.push(issue(`${issuePrefix}_missing_validation_command`, {
        id: row.id,
        validationCommand: row.validationCommand ?? null,
      }));
    }
    if (!text) {
      missing.push(...(row.markers ?? []));
      issues.push(issue(`${issuePrefix}_missing_file`, { id: row.id, path: row.path }));
    } else {
      for (const marker of row.markers ?? []) {
        if (!text.includes(marker)) {
          missing.push(marker);
          issues.push(issue(`${issuePrefix}_missing_marker`, { id: row.id, path: row.path, marker }));
        }
      }
    }
    out.push({
      id: row.id,
      path: row.path,
      owner: row.owner ?? null,
      validationCommand: row.validationCommand ?? null,
      markerCount: row.markers?.length ?? 0,
      missingCount: missing.length,
      ok: missing.length === 0,
    });
  }

  for (const id of requiredIds) {
    if (!seen.has(id)) {
      issues.push(issue(`${issuePrefix}_missing_required_id`, { id }));
    }
  }

  return out.sort((a, b) => a.id.localeCompare(b.id));
}

function analyzeDelegatedChecks(root, issues) {
  const notificationPayload = analyzeNotificationPayloadScrubContract(root);
  const outboundMessage = analyzeOutboundMessageSafety(root);
  const poisonMessage = analyzePoisonMessageContainment(root);
  const queueAuthenticity = analyzeQueueMessageAuthenticity(root);
  const userFacing = buildUserFacingInteractionReport(root);
  const userFacingFailures = assertUserFacingInteractionReport(userFacing);

  const checks = [
    ["notification-payload-scrub-contract", notificationPayload],
    ["outbound-message-safety", outboundMessage],
    ["poison-message-containment", poisonMessage],
    ["queue-message-authenticity", queueAuthenticity],
  ];

  for (const [checkId, report] of checks) {
    if (!report.ok) {
      issues.push(issue("operational_notifications_delegated_check_failed", {
        checkId,
        issueCount: report.issueCount,
      }));
    }
  }
  if (userFacingFailures.length > 0) {
    issues.push(issue("operational_notifications_user_facing_interaction_failures", {
      failureCount: userFacingFailures.length,
    }));
  }

  return {
    rows: [
      {
        checkId: "notification-payload-scrub-contract",
        ok: notificationPayload.ok,
        issueCount: notificationPayload.issueCount,
      },
      {
        checkId: "outbound-message-safety",
        ok: outboundMessage.ok,
        issueCount: outboundMessage.issueCount,
      },
      {
        checkId: "poison-message-containment",
        ok: poisonMessage.ok,
        issueCount: poisonMessage.issueCount,
      },
      {
        checkId: "queue-message-authenticity",
        ok: queueAuthenticity.ok,
        issueCount: queueAuthenticity.issueCount,
      },
      {
        checkId: "user-facing-interactions",
        ok: userFacingFailures.length === 0,
        issueCount: userFacingFailures.length,
        routeCount: userFacing.summary.routeCount,
        interactionCount: userFacing.summary.interactionCount,
        openInteractionRiskCount: userFacing.summary.openInteractionRiskCount,
      },
    ],
  };
}

function countMatches(text, regex) {
  return [...text.matchAll(regex)].length;
}

function countConstStringArrayEntries(text, constName) {
  const start = text.indexOf(`export const ${constName} = [`);
  if (start < 0) return 0;
  const end = text.indexOf("] as const", start);
  if (end < 0) return 0;
  return countMatches(text.slice(start, end), /"[^"]+"/g);
}

function collectRuntimeInventoryCounts(root) {
  const operationalModel = read(root, "src/lib/operational-notifications-messaging.ts");
  const releaseTemplates = read(root, "src/lib/release-state-email-templates.ts");
  const notificationTaxonomy = read(root, "src/lib/notification-taxonomy.ts");
  return {
    operationalRegistryStaticRows: countMatches(operationalModel, /id: "(?:toast|alert|error|banner|evidence)\./g),
    releaseEmailTemplateKeys: countConstStringArrayEntries(releaseTemplates, "RELEASE_STATE_EMAIL_TEMPLATE_KEYS"),
    notificationTaxonomyRows: countMatches(notificationTaxonomy, /notificationType: "/g),
  };
}

export function analyzeOperationalNotificationsMessaging(root = ROOT) {
  const config = readJson(root, CONFIG_REL, {});
  const issues = [];
  const scripts = packageScripts(root);
  const commands = validateCommands(root, config, scripts, issues);
  const messageInventory = validateMarkerRows(
    root,
    config.messageInventory,
    REQUIRED_MESSAGE_SURFACES,
    "operational_notifications_message_inventory",
    issues,
    scripts
  );
  const eligibilityRules = validateMarkerRows(
    root,
    config.eligibilityRules,
    REQUIRED_ELIGIBILITY_RULES,
    "operational_notifications_eligibility",
    issues,
    scripts
  );
  const renderingSafeguards = validateMarkerRows(
    root,
    config.renderingSafeguards,
    REQUIRED_RENDERING_SAFEGUARDS,
    "operational_notifications_rendering",
    issues,
    scripts
  );
  const retryDeadLetter = validateMarkerRows(
    root,
    config.retryDeadLetter,
    REQUIRED_RETRY_CLASSES,
    "operational_notifications_retry",
    issues,
    scripts
  );
  const delegatedChecks = analyzeDelegatedChecks(root, issues);
  const runtimeInventory = collectRuntimeInventoryCounts(root);

  const report = {
    ok: issues.length === 0,
    schemaVersion: 1,
    source: "code-owned-operational-notifications-messaging",
    generatedBy: "scripts/check-operational-notifications-messaging.mjs --write",
    generatedFrom: CONFIG_REL,
    commandCount: commands.length,
    messageInventoryCount: messageInventory.length,
    eligibilityRuleCount: eligibilityRules.length,
    renderingSafeguardCount: renderingSafeguards.length,
    retryDeadLetterCount: retryDeadLetter.length,
    delegatedCheckCount: delegatedChecks.rows.length,
    runtimeInventory,
    commands,
    messageInventory,
    eligibilityRules,
    renderingSafeguards,
    retryDeadLetter,
    delegatedChecks: delegatedChecks.rows,
    manualBoundary: config.manualBoundary ?? null,
    issueCount: issues.length,
    issues,
  };

  const existing = read(root, ARTIFACT_REL);
  if (!WRITE && existing && existing !== stableStringify(report)) {
    report.ok = false;
    report.issueCount += 1;
    report.issues.push(issue("operational_notifications_artifact_drift", {
      path: ARTIFACT_REL,
      fix: "npm run write:operational-notifications-messaging",
    }));
  }

  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = analyzeOperationalNotificationsMessaging();
  if (WRITE) writeJson(ROOT, ARTIFACT_REL, report);
  console.log(stableStringify(report));
  process.exit(report.ok ? 0 : 1);
}
