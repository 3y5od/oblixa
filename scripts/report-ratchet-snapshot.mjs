#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const baselines = [
  { id: "e2eSkipBaseline", rel: "scripts/e2e-skip-baseline.json" },
  { id: "hardeningDebtBaseline", rel: "scripts/hardening-debt-baseline.json" },
  { id: "frontendComponentComplexityBaseline", rel: "scripts/frontend-component-complexity-baseline.json" },
  { id: "wrapperReintroductionBaseline", rel: "scripts/wrapper-reintroduction-baseline.json" },
];

const out = {};
for (const { id, rel } of baselines) {
  const abs = path.join(root, rel);
  const exists = existsSync(abs);
  if (!exists) {
    out[id] = { exists: false, keyCount: 0 };
    continue;
  }
  const raw = readFileSync(abs, "utf8");
  let data = null;
  try {
    data = JSON.parse(raw);
  } catch {
    out[id] = { exists: true, parseError: true, keyCount: 0 };
    continue;
  }
  const entry = {
    exists: true,
    keyCount: data && typeof data === "object" && !Array.isArray(data) ? Object.keys(data).length : 0,
  };
  if (data && typeof data === "object" && !Array.isArray(data) && "baselineDate" in data) {
    entry.baselineDate = data.baselineDate;
  }
  out[id] = entry;
}

console.log(JSON.stringify({ report: "ratchet-snapshot", generatedAt: new Date().toISOString(), baselines: out }, null, 2));
