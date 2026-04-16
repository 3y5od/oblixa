#!/usr/bin/env node
/**
 * Performance-oriented static greps under src/ (heuristics only).
 *
 * Default: WARN + INFO to stdout, exit 0.
 * --warnings-only: print WARN lines only (CI-friendly).
 * --strict: exit 1 if any WARN would have been printed.
 *
 * Allowlist: scripts/performance-static-audit-allowlist.txt (path substrings).
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { createResult, finishWithResult } from "./lib/result.mjs";
import { nowMs } from "./lib/timing.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const srcRoot = path.join(root, "src");
const allowlistPath = path.join(__dirname, "performance-static-audit-allowlist.txt");

const warningsOnly = process.argv.includes("--warnings-only");
const strict = process.argv.includes("--strict");
const startMs = nowMs();

function loadAllowlist() {
  if (!fs.existsSync(allowlistPath)) return [];
  return fs
    .readFileSync(allowlistPath, "utf8")
    .split("\n")
    .map((l) => {
      const trimmed = l.trim();
      const beforeHash = trimmed.split("#")[0]?.trim() ?? "";
      return beforeHash;
    })
    .filter((l) => l && !l.startsWith("#"));
}

function isAllowed(relPath, subs) {
  const n = relPath.replace(/\\/g, "/");
  return subs.some((sub) => n.includes(sub));
}

function walkSrcFiles(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const name of fs.readdirSync(dir)) {
    if (name === "node_modules" || name === ".next") continue;
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walkSrcFiles(p, acc);
    else if (/\.(tsx?|jsx?)$/.test(name)) acc.push(p);
  }
  return acc;
}

/** WARN: Supabase .select("*") */
const reSelectStar = /\.select\s*\(\s*['"]\*['"]\s*\)/;

/** WARN: very large .limit( — 5000+ or 5+ digit number */
const reLargeLimit = /\.limit\s*\(\s*(?:5000|[6-9]\d{3}|\d{5,})\s*\)/;

function isTestPath(rel) {
  return (
    /\.test\.tsx?$/.test(rel) ||
    /\.spec\.tsx?$/.test(rel) ||
    rel.includes("/e2e/") ||
    rel.includes("__tests__/")
  );
}

function isUseClientSource(content) {
  return /^\s*["']use client["']\s*;/m.test(content);
}

function hasClientTimer(content, rel) {
  if (!isUseClientSource(content) || isTestPath(rel)) return false;
  return /(?:^|\n)\s*(?:setInterval|setTimeout)\s*\(/m.test(content);
}

function isApiRoute(rel) {
  return rel.startsWith("src/app/api/") && rel.endsWith("/route.ts");
}

function hasPotentialUnboundedSelect(content) {
  if (!/\.select\s*\(/.test(content)) return false;
  const hasSelectHead = /\.select\s*\([^)]*head\s*:\s*true/.test(content);
  if (hasSelectHead) return false;
  if (/\.single\s*\(|\.maybeSingle\s*\(/.test(content)) return false;
  if (/\.eq\s*\(\s*["']id["']/.test(content)) return false;
  if (/\.eq\s*\(\s*["']token["']/.test(content)) return false;
  const hasBound = /\.limit\s*\(|\.range\s*\(/.test(content);
  return !hasBound;
}

function isExportOrReportRoute(rel) {
  return /src\/app\/api\/(?:export|reports)\//.test(rel);
}

function run() {
  const allowSubs = loadAllowlist();
  const files = walkSrcFiles(srcRoot).sort();
  let warnCount = 0;

  const infoOnce = new Set();

  function info(key, msg) {
    if (warningsOnly) return;
    if (infoOnce.has(key)) return;
    infoOnce.add(key);
    console.log(`INFO ${msg}`);
  }

  for (const abs of files) {
    const rel = path.relative(root, abs).replace(/\\/g, "/");
    if (isAllowed(rel, allowSubs)) continue;

    const content = fs.readFileSync(abs, "utf8");

    if (reSelectStar.test(content)) {
      console.warn(`WARN Supabase .select("*") in ${rel} — prefer explicit columns`);
      warnCount += 1;
    }
    if (reLargeLimit.test(content)) {
      console.warn(`WARN Large .limit(...) in ${rel} — confirm pagination/chunking`);
      warnCount += 1;
    }
    if (hasClientTimer(content, rel)) {
      console.warn(`WARN setInterval/setTimeout in client component ${rel} — check cleanup and rerenders`);
      warnCount += 1;
    }
    if (
      isApiRoute(rel) &&
      /export\s+async\s+function\s+GET\b/.test(content) &&
      hasPotentialUnboundedSelect(content)
    ) {
      console.warn(`WARN Potential unbounded API read in ${rel} — prefer limit/range pagination`);
      warnCount += 1;
    }
    if (isExportOrReportRoute(rel) && hasPotentialUnboundedSelect(content)) {
      console.warn(`WARN Export/report route may miss pagination cap in ${rel}`);
      warnCount += 1;
    }
    if (
      isUseClientSource(content) &&
      /\brouter\.refresh\s*\(/.test(content) &&
      /setInterval\s*\(/.test(content)
    ) {
      info(`refresh:${rel}`, `Review setInterval + router.refresh in ${rel} for refresh amplification risk`);
    }

    if (/readFileSync\s*\(|writeFileSync\s*\(/.test(content) && rel.includes("src/app/api/")) {
      info(`fs:${rel}`, `Review sync fs in ${rel} (prefer async or stream)`);
    }
    if (/revalidate\s*=\s*0\b/.test(content) || /dynamic\s*=\s*['"]force-dynamic['"]/.test(content)) {
      info(`dyn:${rel}`, `Review dynamic/revalidate settings in ${rel}`);
    }
    if (/\brevalidatePath\s*\(|\brevalidateTag\s*\(/.test(content)) {
      info(`rev:${rel}`, `Review revalidatePath/revalidateTag usage in ${rel}`);
    }
    if (/\bunstable_cache\s*\(/.test(content) || /(?:^|\n)\s*cache\s*\(/m.test(content)) {
      if (/\bfrom\s+["']react["']/.test(content) || /\bfrom\s+["']next\/cache["']/.test(content)) {
        info(`cache:${rel}`, `Review cache()/unstable_cache usage in ${rel}`);
      }
    }
    if (/export\s+const\s+maxDuration\b/.test(content)) {
      info(`md:${rel}`, `Review export const maxDuration in ${rel}`);
    }
    if (/from\s+["']next\/server["']/.test(content) && /\bafter\s*\(/.test(content)) {
      info(`after:${rel}`, `Review after() from next/server in ${rel}`);
    }
    if (/\bchild_process\b|\bexecSync\s*\(|\bspawnSync\s*\(/.test(content) && !isTestPath(rel)) {
      info(`cp:${rel}`, `Review child_process/execSync/spawnSync in ${rel}`);
    }
  }

  return { warnCount };
}

console.log(
  `Performance static audit (warnings-only=${warningsOnly}, strict=${strict})`
);
const { warnCount } = run();
finishWithResult(
  createResult({
    checkId: "performance-static-audit",
    ok: !(strict && warnCount > 0),
    strict,
    warnings: warnCount > 0 ? [`detected ${warnCount} warning pattern(s)`] : [],
    errors: strict && warnCount > 0 ? [`strict mode failed with ${warnCount} warning pattern(s)`] : [],
    meta: { warningsOnly, warnCount },
    startMs,
  })
);
