import http from "k6/http";
import { check } from "k6";

/** Short soak behind RUN_K6_SOAK=1 in CI (keep duration tiny). */
export const options = {
  thresholds: {
    http_req_failed: ["rate<0.05"],
    http_req_duration: ["p(95)<2500"],
    checks: ["rate>0.95"],
  },
  stages: [
    { duration: "3s", target: 1 },
    { duration: "5s", target: 2 },
    { duration: "3s", target: 0 },
  ],
};

export default function () {
  const base = __ENV.STAGING_BASE_URL || "http://127.0.0.1:3000";
  const res = http.get(`${base.replace(/\/$/, "")}/`, { tags: { route: "landing" }, timeout: "10s" });
  check(res, { "status 200": (r) => r.status === 200 });
}
