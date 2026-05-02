#!/usr/bin/env node
/**
 * Strip sensitive headers from a Playwright-exported HAR file.
 * Usage: node scripts/redact-har.mjs path/to/file.har
 */
import fs from "node:fs";

const p = process.argv[2];
if (!p || !fs.existsSync(p)) {
  console.log(JSON.stringify({ ok: true, mode: "no_har_path" }, null, 2));
  process.exit(0);
}

const raw = fs.readFileSync(p, "utf8");
let har;
try {
  har = JSON.parse(raw);
} catch {
  console.error(JSON.stringify({ ok: false, error: "invalid_json" }, null, 2));
  process.exit(1);
}

const strip = (headers) => {
  if (!Array.isArray(headers)) return headers;
  return headers.filter((h) => {
    const n = (h.name || "").toLowerCase();
    return !["cookie", "authorization", "set-cookie"].includes(n);
  });
};

if (har.log?.entries) {
  for (const e of har.log.entries) {
    if (e.request?.headers) e.request.headers = strip(e.request.headers);
    if (e.response?.headers) e.response.headers = strip(e.response.headers);
  }
}

process.stdout.write(`${JSON.stringify(har, null, 2)}\n`);
process.exit(0);
