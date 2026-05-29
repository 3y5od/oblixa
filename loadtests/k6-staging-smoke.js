import http from "k6/http";
import { check } from "k6";

const base = __ENV.STAGING_BASE_URL || "";
const root = base.replace(/\/+$/, "");
const allowProduction = __ENV.OBLIXA_ALLOW_PRODUCTION_LOAD === "1";

function assertSafeBaseUrl() {
  if (!root) return;
  const host = new URL(root).hostname;
  const productionHost = host === "oblixa.app" || host === "www.oblixa.app";
  if (productionHost && !allowProduction) {
    throw new Error("production_load_opt_in_required");
  }
}

export const options = {
  vus: 1,
  duration: "15s",
  summaryTrendStats: ["avg", "min", "med", "p(75)", "p(95)", "max"],
  thresholds: {
    "http_req_failed{route:health}": ["rate<0.01"],
    "http_req_duration{route:health}": ["p(95)<1500"],
    "checks{route:health}": ["rate>0.99"],
    "checks{route:cron_unsigned}": ["rate>0.99"],
  },
};

export default function () {
  if (!root) {
    return;
  }
  assertSafeBaseUrl();

  const health = http.get(`${root}/api/health`, {
    tags: { route: "health" },
    timeout: "10s",
  });
  check(
    health,
    {
      "health returns 200": (r) => r.status === 200,
      "health has route id": (r) => r.headers["X-Oblixa-Route-Id"] === "api.health",
    },
    { route: "health" }
  );

  const cron = http.get(`${root}/api/reminders/send`, {
    tags: { route: "cron_unsigned" },
    timeout: "10s",
  });
  check(
    cron,
    {
      "unsigned cron rejects": (r) => r.status === 401 || r.status === 503,
      "unsigned cron is structured": (r) => {
        try {
          const body = JSON.parse(r.body || "{}");
          return Boolean(body?.error || body?.ok === false);
        } catch {
          return false;
        }
      },
    },
    { route: "cron_unsigned" }
  );
}
