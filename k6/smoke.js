import http from "k6/http";
import { check } from "k6";

export const options = { vus: 1, duration: "5s" };

function paths() {
  const raw = __ENV.K6_PATHS || "/";
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export default function () {
  const base = __ENV.STAGING_BASE_URL || "http://127.0.0.1:3000";
  for (const p of paths()) {
    const url = p.startsWith("http") ? p : `${base.replace(/\/$/, "")}${p.startsWith("/") ? p : `/${p}`}`;
    const res = http.get(url);
    check(res, { [`status 2xx ${p}`]: (r) => r.status >= 200 && r.status < 300 });
  }
}
