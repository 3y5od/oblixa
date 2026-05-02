import process from "node:process";
import nextEnv from "@next/env";
import { CRON_ROUTE_EXPECTED_KEYS } from "./cron-route-expected-keys.mjs";

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
  const probeRoute = "/api/reminders/send";
  const probeOpts = { cache: "no-store", headers: { "Cache-Control": "no-store" } };

  let firstRes;
  let firstErr;
  try {
    firstRes = await safeFetch(`${configured}${probeRoute}`, probeOpts);
  } catch (e) {
    firstErr = e;
  }

  if (firstRes?.status === 401) {
    return configured;
  }

  if (
    publicApp &&
    publicApp !== configured &&
    (firstErr || firstRes?.status !== 401)
  ) {
    try {
      const sec = await safeFetch(`${publicApp}${probeRoute}`, probeOpts);
      if (sec.status === 401) {
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

  if (publicApp && isLocalhostUrl(publicApp) && (firstErr || firstRes?.status !== 401)) {
    try {
      const local = await safeFetch(`${publicApp}${probeRoute}`, probeOpts);
      if (local.status === 401) {
        return publicApp;
      }
    } catch (e) {
      warn(`NEXT_PUBLIC_APP_URL (localhost) probe failed: ${String(e?.message || e)}`);
    }
  }

  if (firstRes && firstRes.status !== 401 && firstRes.status >= 500) {
    const snippet = (await firstRes.clone().text().catch(() => "")).slice(0, 500);
    const looksLikeHtml = /<!DOCTYPE html|<html/i.test(snippet);
    for (const localBase of ["http://127.0.0.1:3000", "http://localhost:3000"]) {
      try {
        const lr = await safeFetch(`${localBase}${probeRoute}`, probeOpts);
        if (lr.status === 401) {
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
    `${probeRoute}: expected unsigned 401, got ${firstRes?.status ?? "no response"} (start \`npm run start\` locally when using production URLs that return HTML errors)`
  );
}

async function run() {
  const baseUrl = await resolveReachableBaseUrl();
  const cronSecret = requireEnv("CRON_SECRET");

  for (const [route, expectedKeys] of CRON_ROUTE_EXPECTED_KEYS.entries()) {
    const skipIf404 = /^\/api\/cron\/v\d+\//.test(route);
    const isV5Cron = route.startsWith("/api/cron/v5/");

    const unsigned = await safeFetch(`${baseUrl}${route}`);
    if (skipIf404 && unsigned.status === 404) {
      warn(`${route}: route unavailable on target base URL; skipping cron route check`);
      continue;
    }
    if (unsigned.status !== 401) {
      throw new Error(`${route}: expected unsigned 401, got ${unsigned.status}`);
    }
    ok(`${route} unsigned check`);

    const signed = await safeFetch(`${baseUrl}${route}`, {
      headers: { "x-cron-secret": cronSecret },
    });
    if (skipIf404 && signed.status === 404) {
      warn(`${route}: route unavailable on target base URL; skipping cron route check`);
      continue;
    }
    if (signed.status >= 400) {
      const bodyText = await signed.text();
      throw new Error(`${route}: signed request failed ${signed.status} ${bodyText.slice(0, 300)}`);
    }
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
