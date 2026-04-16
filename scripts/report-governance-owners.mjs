#!/usr/bin/env node
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const ownerSummary = new Map();

function inc(owner, field) {
  const row = ownerSummary.get(owner) ?? {
    owner,
    allowlistEntries: 0,
    exemptionEntries: 0,
    skipIssues: 0,
  };
  row[field] += 1;
  ownerSummary.set(owner, row);
}

const allowlist = readFileSync(path.join(ROOT, "scripts", "api-route-test-allowlist.txt"), "utf8").split("\n");
const metaRe = /^#\s*meta:\s*owner=([^\s]+)\s+expiry=(\d{4}-\d{2}-\d{2})\s+reason=(.+)$/;
let activeOwner = null;
for (const line of allowlist) {
  const t = line.trim();
  if (!t) continue;
  if (t.startsWith("#")) {
    const m = t.match(metaRe);
    if (m) activeOwner = m[1];
    continue;
  }
  if (activeOwner) inc(activeOwner, "allowlistEntries");
}

const exemptions = JSON.parse(
  readFileSync(path.join(ROOT, "src/lib/product-surface/v8-test-exemptions.json"), "utf8")
);
for (const row of Array.isArray(exemptions) ? exemptions : []) {
  if (row?.owner) inc(row.owner, "exemptionEntries");
}

const skipReport = JSON.parse(
  readFileSync(path.join(ROOT, "scripts", "e2e-skip-baseline.json"), "utf8")
);
if (skipReport.skipCount > 0) {
  inc("@test-governance", "skipIssues");
}

const owners = Array.from(ownerSummary.values()).sort((a, b) => a.owner.localeCompare(b.owner));
console.log(
  JSON.stringify(
    {
      ownerCount: owners.length,
      owners,
    },
    null,
    2
  )
);
