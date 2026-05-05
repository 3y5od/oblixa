#!/usr/bin/env node
/**
 * Epic 3 — HTTP smoke probes driven by artifacts/assurance/api-runtime-smoke-registry.json
 * Emits artifacts/assurance/api-runtime-smoke-last-run.json (+ optional JUnit)
 *
 * Env:
 *   API_RUNTIME_SMOKE_BASE_URL — defaults to COMPREHENSIVE_PASS_BASE_URL or STAGING_BASE_URL
 *   API_RUNTIME_SMOKE_TIER=ci|nightly|all
 *   API_RUNTIME_SMOKE_STRICT=1 — exit non-zero on failures
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import nextEnv from "@next/env";
import { fileURLToPath } from "node:url";
import { classifyRuntimeSmokeResponse } from "./lib/route-runtime-semantics.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
nextEnv.loadEnvConfig(root);

const registryPath = path.join(root, "artifacts", "assurance", "api-runtime-smoke-registry.json");
const outJson = path.join(root, "artifacts", "assurance", "api-runtime-smoke-last-run.json");
const outJUnit = path.join(root, "artifacts", "assurance", "api-runtime-smoke-junit.xml");

function env(name) {
  return (process.env[name] ?? "").trim();
}

function tierFilter(row, tierMode) {
  if (tierMode === "all") return true;
  if (tierMode === "ci") return row.smokeTier === "ci";
  if (tierMode === "nightly") return row.smokeTier === "ci" || row.smokeTier === "nightly";
  return row.smokeTier === tierMode;
}

function unsignedRejectStatuses(status) {
  return status === 401 || status === 403 || status === 503;
}

async function probeRow(baseUrl, row) {
  const url = `${baseUrl.replace(/\/+$/, "")}${row.samplePath}`;
  const hint = row.runnerHint;
  const method = Array.isArray(row.methods) && row.methods.includes("GET") ? "GET" : (row.methods?.[0] ?? "GET");
  if (hint === "defer_cron_canary") {
    return { id: row.pathTemplate, status: "skipped", detail: "cron family (cron-canary)" };
  }

  try {
    const res = await fetch(url, {
      method,
      redirect: "manual",
      headers: {
        "Cache-Control": "no-store",
        ...(method !== "GET" && method !== "HEAD" ? { "Content-Type": "application/json" } : {}),
      },
      ...(method !== "GET" && method !== "HEAD" ? { body: "{}" } : {}),
    });
    const bodyText = await res.text();

    if (hint === "session_or_worker_unsigned_reject" || hint === "signature_or_unsigned_reject") {
      if (unsignedRejectStatuses(res.status)) {
        return { id: row.pathTemplate, status: "passed", httpStatus: res.status, outcomeClass: "unsigned_reject" };
      }
      return {
        id: row.pathTemplate,
        status: "failed",
        detail: `expected 401/403/503 for unsigned ${method}, got ${res.status}`,
        httpStatus: res.status,
      };
    }

    if (hint === "public_or_token_surface") {
      const classified = classifyRuntimeSmokeResponse(row, res, bodyText);
      if (classified.passed) {
        return {
          id: row.pathTemplate,
          status: "passed",
          httpStatus: res.status,
          outcomeClass: classified.outcomeClass,
          detail: classified.detail,
        };
      }
      return {
        id: row.pathTemplate,
        status: "failed",
        detail: classified.detail,
        httpStatus: res.status,
      };
    }

    return { id: row.pathTemplate, status: "skipped", detail: `unknown hint ${hint}` };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { id: row.pathTemplate, status: "failed", detail: `fetch error: ${msg}` };
  }
}

function toJUnit(results, suiteName) {
  const cases = results
    .map((r) => {
      const name = escapeXml(r.id);
      if (r.status === "passed") {
        return `<testcase classname="api-runtime-smoke" name="${name}" time="0"/>`;
      }
      if (r.status === "skipped") {
        return `<testcase classname="api-runtime-smoke" name="${name}" time="0"><skipped message="${escapeXml(r.detail ?? "")}"/></testcase>`;
      }
      return `<testcase classname="api-runtime-smoke" name="${name}" time="0"><failure message="failed">${escapeXml(r.detail ?? "")}</failure></testcase>`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<testsuite name="${escapeXml(suiteName)}" tests="${results.length}">\n${cases}\n</testsuite>\n`;
}

function escapeXml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function main() {
  const tierMode = env("API_RUNTIME_SMOKE_TIER") || "ci";
  const strict = env("API_RUNTIME_SMOKE_STRICT") === "1" || env("API_RUNTIME_SMOKE_STRICT").toLowerCase() === "true";
  const baseUrl =
    env("API_RUNTIME_SMOKE_BASE_URL") || env("COMPREHENSIVE_PASS_BASE_URL") || env("STAGING_BASE_URL");

  if (!baseUrl) {
    console.error(
      "api-runtime-smoke: set API_RUNTIME_SMOKE_BASE_URL (or COMPREHENSIVE_PASS_BASE_URL / STAGING_BASE_URL)"
    );
    process.exit(strict ? 1 : 0);
  }

  const registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));
  const routes = registry.routes ?? [];
  const selected = routes.filter((r) => tierFilter(r, tierMode));

  const results = [];
  for (const row of selected) {
    results.push(await probeRow(baseUrl, row));
  }

  const summary = {
    version: 1,
    generatedAt: new Date().toISOString(),
    baseUrl,
    tierMode,
    total: results.length,
    passed: results.filter((r) => r.status === "passed").length,
    failed: results.filter((r) => r.status === "failed").length,
    skipped: results.filter((r) => r.status === "skipped").length,
    passedByOutcomeClass: Object.fromEntries(
      [...new Set(results.map((r) => r.outcomeClass).filter(Boolean))]
        .sort()
        .map((key) => [key, results.filter((r) => r.status === "passed" && r.outcomeClass === key).length])
    ),
    results,
  };

  fs.mkdirSync(path.dirname(outJson), { recursive: true });
  fs.writeFileSync(outJson, `${JSON.stringify(summary, null, 2)}\n`);
  fs.writeFileSync(outJUnit, toJUnit(results, `api-runtime-smoke-${tierMode}`));

  console.log(
    JSON.stringify({
      artifact: path.relative(root, outJson),
      junit: path.relative(root, outJUnit),
      passed: summary.passed,
      failed: summary.failed,
      skipped: summary.skipped,
    })
  );

  if (strict && summary.failed > 0) {
    process.exit(1);
  }
}

await main();
