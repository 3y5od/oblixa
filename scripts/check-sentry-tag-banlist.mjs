#!/usr/bin/env node
/**
 * Fails if source uses Sentry.setTag(s) with keys listed in metric-label-sentry-banlist.json.
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, name.name);
    if (name.isDirectory()) {
      if (name.name === "node_modules" || name.name === ".next") continue;
      walk(p, acc);
    } else if (/\.(tsx|ts)$/.test(name.name) && !name.name.endsWith(".test.ts") && !name.name.endsWith(".test.tsx")) {
      acc.push(p);
    }
  }
  return acc;
}

export function analyzeSentryTagBanlist(baseRoot = root) {
  const baseBanPath = path.join(baseRoot, "src", "lib", "observability", "metric-label-sentry-banlist.json");
  const baseSrcRoot = path.join(baseRoot, "src");
  const baseBan = JSON.parse(fs.readFileSync(baseBanPath, "utf8"));
  const denyTagKeys = Array.isArray(baseBan.deny_tag_keys) ? baseBan.deny_tag_keys.map((k) => String(k)) : [];
  const issues = [];
  let sentryTagCallFileCount = 0;

  for (const file of walk(baseSrcRoot)) {
    const rel = path.relative(baseRoot, file).replace(/\\/g, "/");
    if (rel.includes("metric-label-sentry-banlist.json")) continue;
    const text = fs.readFileSync(file, "utf8");
    if (!/\bSentry\.setTags?\s*\(/.test(text)) continue;
    sentryTagCallFileCount += 1;
    for (const key of denyTagKeys) {
      const re = new RegExp(`Sentry\\.setTags?\\s*\\(\\s*["']${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["']`, "iu");
      if (re.test(text)) {
        issues.push({ issue: "banned_sentry_tag_key", rel, key });
      }
    }
  }

  return {
    checkId: "sentry-tag-banlist",
    ok: issues.length === 0,
    issueCount: issues.length,
    denyTagKeyCount: denyTagKeys.length,
    sentryTagCallFileCount,
    issues,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = analyzeSentryTagBanlist();
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}
