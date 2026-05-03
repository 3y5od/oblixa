/**
 * Shared cron HTTP probe helpers (dual Authorization Bearer + x-cron-secret).
 * @see Epic 1 — Maximal assurance program
 */

/** @param {string} cronSecret */
export function cronAuthHeaders(cronSecret) {
  const trimmed = cronSecret.trim();
  return {
    Authorization: `Bearer ${trimmed}`,
    "x-cron-secret": trimmed,
    "x-vercel-cron-secret": trimmed,
  };
}

/**
 * @param {Response} res
 * @param {string} route
 */
export function assertJsonContentType(res, route) {
  const ct = res.headers.get("content-type") ?? "";
  if (!/application\/json/i.test(ct)) {
    throw new Error(`${route}: expected Content-Type application/json, got ${JSON.stringify(ct)}`);
  }
}

/** @returns {boolean} */
export function cronStrictNoSkip404() {
  const v = (process.env.CRON_CANARY_STRICT_NO_SKIP_404 ?? "").trim().toLowerCase();
  if (v === "0" || v === "false" || v === "no") return false;
  if (v === "1" || v === "true" || v === "yes") return true;
  return process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production";
}

/** @returns {boolean} */
export function cronFailOnOkFalse() {
  const v = (process.env.CRON_CANARY_FAIL_ON_OK_FALSE ?? "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

/**
 * Cron routes may expose GET, POST, or both; unsigned probe uses GET then POST on 405.
 * @param {(url: string, init?: RequestInit) => Promise<Response>} safeFetch
 * @param {string} absoluteUrl
 * @param {RequestInit} [init]
 */
export async function fetchCronWithMethodDiscovery(safeFetch, absoluteUrl, init = {}) {
  let res = await safeFetch(absoluteUrl, { ...init, method: "GET" });
  if (res.status === 405) {
    res = await safeFetch(absoluteUrl, { ...init, method: "POST" });
  }
  return res;
}
