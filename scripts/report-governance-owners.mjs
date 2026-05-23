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
function parseKeyValueMeta(raw) {
  const matches = [...raw.matchAll(/\b([A-Za-z][A-Za-z0-9_-]*)=/gu)];
  const meta = {};
  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index];
    const key = match[1];
    const valueStart = (match.index ?? 0) + match[0].length;
    const valueEnd =
      index + 1 < matches.length ? matches[index + 1].index ?? raw.length : raw.length;
    meta[key] = raw.slice(valueStart, valueEnd).trim();
  }
  return meta;
}
let activeOwner = null;
for (const line of allowlist) {
  const t = line.trim();
  if (!t) continue;
  if (t.startsWith("#")) {
    const match = t.match(/^#\s*meta:\s*(?<body>.*)$/u);
    if (match?.groups?.body) activeOwner = parseKeyValueMeta(match.groups.body).owner ?? activeOwner;
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
