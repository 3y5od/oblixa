#!/usr/bin/env node
/**
 * Executes discovered check:* scripts (minus qa-tier-manifest denylist), optionally sharded.
 * Requires QA_MAXIMAL_DISCOVER_CHECK_UNION=1 and QA_MAXIMAL_DISCOVER_BATCH_TOTAL>=1 to run anything;
 * otherwise exits 0 (no-op for local maximal runs).
 */
import fs from "node:fs";
import path from "node:path";
import { discoverCheckScripts, filterCheckBatch, loadPackageJson } from "./lib/qa-discover-check-scripts.mjs";
import { runNpmScript } from "./lib/process.mjs";

const enabled =
  process.env.QA_MAXIMAL_DISCOVER_CHECK_UNION === "1" || process.env.QA_MAXIMAL_DISCOVER_CHECK_UNION === "true";
if (!enabled) {
  console.log(JSON.stringify({ ok: true, skipped: true, reason: "QA_MAXIMAL_DISCOVER_CHECK_UNION unset" }, null, 2));
  process.exit(0);
}

const total = Number(
  process.env.QA_MAXIMAL_DISCOVER_BATCH_TOTAL ||
    process.env.QA_CHECK_BATCH_TOTAL ||
    process.env.QA_CHECK_BATCH_SIZE ||
    process.env.QA_CHECK_BATCH_COUNT ||
    0
);
const index = Number(
  process.env.QA_MAXIMAL_DISCOVER_BATCH_INDEX || process.env.QA_CHECK_BATCH_INDEX || 0
);
if (!total || total < 1 || !index || index < 1) {
  console.error(
    JSON.stringify(
      {
        ok: false,
        reason: "set_batch_total_and_index",
        aliases: {
          total: [
            "QA_MAXIMAL_DISCOVER_BATCH_TOTAL",
            "QA_CHECK_BATCH_TOTAL",
            "QA_CHECK_BATCH_SIZE",
            "QA_CHECK_BATCH_COUNT",
          ],
          index: ["QA_MAXIMAL_DISCOVER_BATCH_INDEX", "QA_CHECK_BATCH_INDEX"],
        },
      },
      null,
      2
    )
  );
  process.exit(1);
}

const root = process.cwd();
const manifest = JSON.parse(fs.readFileSync(path.join(root, "config", "qa-tier-manifest.json"), "utf8"));
const pkg = loadPackageJson(root);
const denylist = [...(manifest.autodiscover?.denylist || [])];
let discovered = discoverCheckScripts(pkg, { denylist });
discovered = filterCheckBatch(discovered, { batchTotal: total, batchIndex: index });

console.error(
  `[qa-discovered-union] batch ${index}/${total} — ${discovered.length} script(s) (shard env: QA_MAXIMAL_DISCOVER_* | QA_CHECK_BATCH_*)`
);

for (const name of discovered) {
  const result = await runNpmScript(name);
  if (!result.ok) {
    console.error(JSON.stringify({ ok: false, failed: name, code: result.code }, null, 2));
    process.exit(result.code ?? 1);
  }
}
console.log(JSON.stringify({ ok: true, ran: discovered.length }, null, 2));
