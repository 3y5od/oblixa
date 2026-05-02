#!/usr/bin/env node
/**
 * CT monitor config gate. CT_STRICT=1 requires config/ct-monitor-hosts.json with apex_hostnames[].
 * Optional live crt.sh fetch: CT_FETCH=1 (CI usually skips network).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const cfg = path.join(root, "config", "ct-monitor-hosts.json");

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

async function main() {
  if (process.env.CT_STRICT === "1") {
    if (!fs.existsSync(cfg)) fail("CT_STRICT=1 but missing config/ct-monitor-hosts.json");
    let doc;
    try {
      doc = JSON.parse(fs.readFileSync(cfg, "utf8"));
    } catch {
      fail("ct-monitor-hosts.json invalid JSON");
    }
    if (!Array.isArray(doc.apex_hostnames) || doc.apex_hostnames.length === 0) {
      fail("ct-monitor-hosts.json: apex_hostnames[] required when CT_STRICT=1");
    }
  }
  if (process.env.CT_FETCH === "1" && fs.existsSync(cfg)) {
    const doc = JSON.parse(fs.readFileSync(cfg, "utf8"));
    const host = doc.apex_hostnames?.[0];
    if (typeof host === "string" && host.length > 0) {
      const url = `https://crt.sh/?q=${encodeURIComponent("%." + host)}&output=json`;
      const res = await fetch(url, { signal: AbortSignal.timeout(12_000) });
      if (!res.ok) fail(`crt.sh query failed: ${res.status}`);
    }
  }
  console.log("OK: certificate transparency monitor (config validated when CT_STRICT=1).");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
