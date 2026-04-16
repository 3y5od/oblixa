#!/usr/bin/env node
import { readFileSync } from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const ROOT = process.cwd();
const strict = process.argv.includes("--strict");
const baseline = JSON.parse(
  readFileSync(path.join(ROOT, "scripts", "concurrency-hotspots-baseline.json"), "utf8")
);

const current = JSON.parse(
  execFileSync("node", [path.join(ROOT, "scripts", "report-concurrency-hotspots.mjs")], {
    encoding: "utf8",
  })
);

const maxDelta = Number.isFinite(baseline.maxDelta) ? baseline.maxDelta : 0;
const hotspotDelta = Number(current.hotspotCount ?? 0) - Number(baseline.hotspotCount ?? 0);
const mutationRouteDelta =
  Number(current.mutationRouteCount ?? 0) - Number(baseline.mutationRouteCount ?? 0);
const violation = hotspotDelta > maxDelta;

const payload = {
  strict,
  maxDelta,
  baseline,
  current: {
    mutationRouteCount: Number(current.mutationRouteCount ?? 0),
    hotspotCount: Number(current.hotspotCount ?? 0),
  },
  deltas: {
    mutationRouteCount: mutationRouteDelta,
    hotspotCount: hotspotDelta,
  },
  violationCount: violation ? 1 : 0,
  violations: violation
    ? [
        {
          metric: "hotspotCount",
          message: `hotspotCount increased by ${hotspotDelta} (maxDelta=${maxDelta})`,
        },
      ]
    : [],
};

console.log(JSON.stringify(payload, null, 2));

if (strict && violation) {
  process.exit(1);
}
