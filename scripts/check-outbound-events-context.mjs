#!/usr/bin/env node
/**
 * docs/refinement.md §18 — callers of enqueueOutboundEvent must either enforce tier in-file
 * or route through `src/lib/integrations/events.ts` (getV6OrgSettingsJson + workspace tiers).
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const apiRoutesRoot = join(root, "src", "app", "api");

const TOKENS = [
  "getV6OrgSettingsJson",
  "isNotificationAllowed",
  "workspaceModeAllowsNotificationTier",
  "parseWorkspaceMode",
];

const CALLEE_COMMENT = "refinement §18: tier enforced in callee";

function walkDir(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      walkDir(p, out);
    } else if (e.isFile() && e.name === "route.ts") {
      out.push(p);
    }
  }
  return out;
}

function passes(content, relPath) {
  if (relPath.replace(/\\/g, "/").endsWith("src/lib/integrations/events.ts")) {
    return true;
  }
  for (const t of TOKENS) {
    if (content.includes(t)) return true;
  }
  if (content.includes(CALLEE_COMMENT)) return true;
  if (
    content.includes('from "@/lib/integrations/events"') &&
    content.includes("enqueueOutboundEvent")
  ) {
    return true;
  }
  return false;
}

const failures = [];
for (const abs of walkDir(apiRoutesRoot)) {
  const raw = readFileSync(abs, "utf8");
  if (!raw.includes("enqueueOutboundEvent(")) continue;
  const rel = abs.slice(root.length + 1);
  if (!passes(raw, abs)) {
    failures.push(rel);
  }
}

const actionsDir = join(root, "src", "actions");
try {
  if (statSync(actionsDir).isDirectory()) {
    for (const name of readdirSync(actionsDir)) {
      if (!name.endsWith(".ts")) continue;
      const abs = join(actionsDir, name);
      const raw = readFileSync(abs, "utf8");
      if (!raw.includes("enqueueOutboundEvent(")) continue;
      const rel = abs.slice(root.length + 1);
      if (!passes(raw, abs)) {
        failures.push(rel);
      }
    }
  }
} catch {
  // optional
}

if (failures.length) {
  console.error("Outbound events context check failed (§18):\n");
  for (const f of failures) {
    console.error(`  ${f}`);
    console.error(
      `    Add one of: ${TOKENS.join(", ")}, "${CALLEE_COMMENT}", or call enqueueOutboundEvent from @/lib/integrations/events (tier enforced in callee).\n`
    );
  }
  process.exit(1);
}

console.log("Outbound events context check: OK (enqueueOutboundEvent callers covered).");
