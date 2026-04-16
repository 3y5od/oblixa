#!/usr/bin/env node
import { spawnSync } from "node:child_process";

const outdated = spawnSync("npm", ["outdated", "--json"], {
  encoding: "utf8",
  env: process.env,
});

let parsed = {};
try {
  parsed = JSON.parse(outdated.stdout || "{}");
} catch {
  parsed = {};
}

function parseMajor(v) {
  if (typeof v !== "string") return null;
  const normalized = v.replace(/^[^\d]*/, "");
  const major = Number.parseInt(normalized.split(".")[0] ?? "", 10);
  return Number.isFinite(major) ? major : null;
}

const deps = Object.entries(parsed).map(([name, row]) => {
  const currentMajor = parseMajor(row.current);
  const latestMajor = parseMajor(row.latest);
  const majorLag = currentMajor !== null && latestMajor !== null ? Math.max(0, latestMajor - currentMajor) : 0;
  return {
    name,
    current: row.current,
    wanted: row.wanted,
    latest: row.latest,
    majorLag,
    sunsetRisk: majorLag >= 2 ? "high" : majorLag === 1 ? "watch" : "low",
    suggestedOwner: "@deps",
  };
});
const byRisk = {
  high: deps.filter((d) => d.sunsetRisk === "high").length,
  watch: deps.filter((d) => d.sunsetRisk === "watch").length,
  low: deps.filter((d) => d.sunsetRisk === "low").length,
};

console.log(
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      commandExitCode: outdated.status ?? 0,
      outdatedCount: deps.length,
      byRisk,
      dependencies: deps,
    },
    null,
    2
  )
);
