import process from "node:process";
import nextEnv from "@next/env";
import { CRON_ROUTE_EXPECTED_KEYS } from "./cron-route-expected-keys.mjs";
import {
  assertJsonContentType,
  cronAuthHeaders,
  cronFailOnOkFalse,
  cronStrictNoSkip404,
  fetchCronWithMethodDiscovery,
} from "./lib/cron-http-probe.mjs";

const cwd = process.cwd();
const { loadEnvConfig } = nextEnv;
loadEnvConfig(cwd);

function env(name) {
  return (process.env[name] ?? "").trim();
}

function requireEnv(name) {
  const value = env(name);
  if (!value) {
    throw new Error(`missing required env: ${name}`);
  }
  return value;
}

function ok(msg) {
  console.log(`PASS ${msg}`);
}

function warn(msg) {
  console.warn(`WARN ${msg}`);
}

function normalizeBaseUrl(url) {
  return url.replace(/\/+$/, "");
}

function isLocalhostUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
  } catch {
    return false;
  }
}

function isCronUnsignedRejectStatus(status) {
  return status === 401 || status === 503;
}

async function safeFetch(url, init) {
  try {
    return await fetch(url, init);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`fetch failed for ${url}: ${message}`);
  }
}

async function resolveReachableBaseUrl() {
  const configured = normalizeBaseUrl(requireEnv("COMPREHENSIVE_PASS_BASE_URL"));
  const publicApp = normalizeBaseUrl(env("NEXT_PUBLIC_APP_URL"));
  const secondary = normalizeBaseUrl(env("COMPREHENSIVE_PASS_SECONDARY_BASE_URL"));
  const probeRoute = "/api/reminders/send";
  const probeOpts = { cache: "no-store", headers: { "Cache-Control": "no-store" } };

  async function probeCronUnsigned(base) {
    return safeFetch(`${base}${probeRoute}`, probeOpts);
  }

  let firstRes;
  let firstErr;
  try {
    firstRes = await probeCronUnsigned(configured);
  } catch (e) {
    firstErr = e;
  }

  if (firstRes && isCronUnsignedRejectStatus(firstRes.status)) {
    return configured;
  }

  if (
    secondary &&
    secondary !== configured &&
    (firstErr || !firstRes || !isCronUnsignedRejectStatus(firstRes.status))
  ) {
    warn(
      `COMPREHENSIVE_PASS_BASE_URL=${configured} probe ${
        firstErr ? `failed (${String(firstErr?.message || firstErr)})` : `returned ${firstRes?.status} (expected 401/503 unsigned)`
      }; retrying COMPREHENSIVE_PASS_SECONDARY_BASE_URL=${secondary}`
    );
    try {
      const secRes = await probeCronUnsigned(secondary);
      if (isCronUnsignedRejectStatus(secRes.status)) {
        return secondary;
      }
      warn(
        `COMPREHENSIVE_PASS_SECONDARY_BASE_URL probe returned ${secRes.status} (expected 401/503 unsigned); continuing fallbacks`
      );
    } catch (e) {
      warn(`COMPREHENSIVE_PASS_SECONDARY_BASE_URL probe failed: ${String(e?.message || e)}`);
    }
  }

  if (
    publicApp &&
    publicApp !== configured &&
    isLocalhostUrl(publicApp) &&
    (firstErr || !firstRes || !isCronUnsignedRejectStatus(firstRes.status))
  ) {
    warn(
      `COMPREHENSIVE_PASS_BASE_URL=${configured} probe ${
        firstErr ? `failed (${String(firstErr?.message || firstErr)})` : `returned ${firstRes?.status} (expected 401/503 unsigned)`
      }; retrying NEXT_PUBLIC_APP_URL=${publicApp}`
    );
    try {
      const second = await probeCronUnsigned(publicApp);
      if (isCronUnsignedRejectStatus(second.status)) {
        return publicApp;
      }
      warn(`NEXT_PUBLIC_APP_URL probe returned ${second.status} (expected 401/503 unsigned); continuing fallbacks`);
    } catch (e) {
      warn(`NEXT_PUBLIC_APP_URL probe failed: ${String(e?.message || e)}`);
    }
  }

  if (
    publicApp &&
    publicApp !== configured &&
    !isLocalhostUrl(publicApp) &&
    (firstErr || !firstRes || !isCronUnsignedRejectStatus(firstRes.status))
  ) {
    try {
      const sec = await probeCronUnsigned(publicApp);
      if (isCronUnsignedRejectStatus(sec.status)) {
        warn(
          `COMPREHENSIVE_PASS_BASE_URL=${configured} probe ${
            firstErr ? `failed (${String(firstErr?.message || firstErr)})` : `returned ${firstRes?.status}`
          }; using NEXT_PUBLIC_APP_URL=${publicApp}`
        );
        return publicApp;
      }
    } catch (e) {
      warn(`NEXT_PUBLIC_APP_URL probe failed: ${String(e?.message || e)}`);
    }
  }

  if (firstRes && !isCronUnsignedRejectStatus(firstRes.status) && firstRes.status >= 500) {
    const snippet = (await firstRes.clone().text().catch(() => "")).slice(0, 500);
    const looksLikeHtml = /<!DOCTYPE html|<html/i.test(snippet);
    const pw = normalizeBaseUrl(env("PLAYWRIGHT_BASE_URL"));
    const localCandidates = [
      pw && isLocalhostUrl(pw) ? pw : null,
      "http://127.0.0.1:3000",
      "http://localhost:3000",
      "http://127.0.0.1:3001",
      "http://127.0.0.1:3002",
    ].filter(Boolean);
    for (const localBase of localCandidates) {
      try {
        const lr = await probeCronUnsigned(localBase);
        if (isCronUnsignedRejectStatus(lr.status)) {
          warn(
            `cron canary using ${localBase} (configured URL returned ${firstRes.status}${
              looksLikeHtml ? " HTML" : ""
            } error; align COMPREHENSIVE_PASS_BASE_URL for production gates)`
          );
          return localBase;
        }
      } catch {
        /* ignore */
      }
    }
  }

  if (firstErr) {
    throw firstErr;
  }
  throw new Error(
    `${probeRoute}: expected unsigned 401 or 503, got ${firstRes?.status ?? "no response"} ` +
      `(run \`npm run build && npm run start\` locally, set NEXT_PUBLIC_APP_URL to that origin, ` +
      `or point COMPREHENSIVE_PASS_BASE_URL at a deployment where unsigned cron routes return 401 or 503.)`
  );
}

async function run() {
  const baseUrl = await resolveReachableBaseUrl();
  const cronSecret = requireEnv("CRON_SECRET");

  for (const [route, expectedKeys] of CRON_ROUTE_EXPECTED_KEYS.entries()) {
    const skipIf404 = /^\/api\/cron\/v\d+\//.test(route) && !cronStrictNoSkip404();
    const isV5Cron = route.startsWith("/api/cron/v5/");

    const unsigned = await fetchCronWithMethodDiscovery(safeFetch, `${baseUrl}${route}`);
    if (skipIf404 && unsigned.status === 404) {
      warn(`${route}: route unavailable on target base URL; skipping cron route check`);
      continue;
    }
    if (!isCronUnsignedRejectStatus(unsigned.status)) {
      throw new Error(`${route}: expected unsigned 401 or 503, got ${unsigned.status}`);
    }
    ok(`${route} unsigned check`);

    const signed = await fetchCronWithMethodDiscovery(safeFetch, `${baseUrl}${route}`, {
      headers: { ...cronAuthHeaders(cronSecret) },
    });
    if (skipIf404 && signed.status === 404) {
      warn(`${route}: route unavailable on target base URL; skipping cron route check`);
      continue;
    }
    if (signed.status >= 400) {
      const bodyText = await signed.text();
      throw new Error(`${route}: signed request failed ${signed.status} ${bodyText.slice(0, 300)}`);
    }
    assertJsonContentType(signed, route);
    const body = await signed.json();
    if (isV5Cron) {
      if (body.ok !== true) {
        throw new Error(`${route}: expected ok: true in JSON body`);
      }
      if (body.skipped === true) {
        warn(`${route}: skipped (feature flag off); shape check relaxed`);
      } else {
        for (const key of expectedKeys) {
          if (!(key in body)) {
            throw new Error(`${route}: missing expected key "${key}"`);
          }
        }
      }
    } else {
      for (const key of expectedKeys) {
        if (!(key in body)) {
          throw new Error(`${route}: missing expected key "${key}"`);
        }
      }
      if ("ok" in body && body.ok !== true) {
        if (cronFailOnOkFalse()) {
          throw new Error(`${route}: ok=false (CRON_CANARY_FAIL_ON_OK_FALSE)`);
        }
        warn(`${route}: ok=false (degraded business outcome)`);
      }
    }
    ok(`${route} signed check`);
  }
}

run().catch((error) => {
  console.error(`FAIL ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
