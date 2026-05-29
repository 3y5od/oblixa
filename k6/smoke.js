import http from "k6/http";
import { check } from "k6";

export const options = {
  vus: Number(__ENV.K6_VUS || "1"),
  duration: __ENV.K6_DURATION || "5s",
  summaryTrendStats: ["avg", "min", "med", "p(75)", "p(95)", "max"],
  thresholds: {
    http_req_failed: ["rate<0.05"],
    http_req_duration: ["p(95)<2500"],
    checks: ["rate>0.95"],
  },
};

const DEFAULT_PATHS = [
  "/",
  "/login",
  "/dashboard",
  "/contracts",
  "/contracts/performance-smoke-contract",
  "/contracts/bulk",
  "/search?q=renewal",
  "/reports",
  "/api/report-packs",
  "/api/reminders/send",
  "/external/performance-provider-mock",
];

const PROTECTED_STATUSES = [200, 302, 303, 307, 308, 401, 403];

function paths() {
  const raw = __ENV.K6_PATHS || DEFAULT_PATHS.join(",");
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function expectedStatus(path, status) {
  if (path === "/" || path === "/login" || path.startsWith("/external/")) return status === 200;
  if (path.includes("/api/reminders/send")) return [401, 403, 503].includes(status);
  if (path.includes("/api/report-packs")) return [...PROTECTED_STATUSES, 405].includes(status);
  if (path.includes("/contracts/performance-smoke-contract")) return [...PROTECTED_STATUSES, 404].includes(status);
  return PROTECTED_STATUSES.includes(status);
}

export default function () {
  const base = __ENV.STAGING_BASE_URL || "http://127.0.0.1:3000";
  for (const p of paths()) {
    const url = p.startsWith("http") ? p : `${base.replace(/\/$/, "")}${p.startsWith("/") ? p : `/${p}`}`;
    const res = http.get(url, { tags: { route: p }, timeout: "10s" });
    check(
      res,
      {
        [`accepted status ${p}`]: (r) => expectedStatus(p, r.status),
        [`bounded body ${p}`]: (r) => (r.body || "").length < 900 * 1024,
      },
      { route: p }
    );
  }
}
