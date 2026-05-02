#!/usr/bin/env node
/**
 * Lightweight parse of next.config.ts for remotePatterns / headers / redirects mentions.
 */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const p = path.join(root, "next.config.ts");
if (!fs.existsSync(p)) {
  console.log(JSON.stringify({ ok: true, mode: "no_next_config" }, null, 2));
  process.exit(0);
}
const text = fs.readFileSync(p, "utf8");
const hints = {
  remotePatterns: /remotePatterns/.test(text),
  headers: /\.headers\s*\(/.test(text) || /headers\s*:\s*\[/.test(text),
  redirects: /\.redirects\s*\(/.test(text) || /redirects\s*:\s*\[/.test(text),
  experimental: /experimental\s*:\s*\{/.test(text),
};
const strict =
  process.env.NEXT_CONFIG_SURFACE_STRICT === "1" || process.env.NEXT_CONFIG_SURFACE_STRICT === "true";
const thirdParty = path.join(root, "scripts", "check-third-party-script-integrity.mjs");
const thirdPartyOk = fs.existsSync(thirdParty);
const ok =
  !strict || (hints.headers && hints.experimental && thirdPartyOk && /supabase|stripe|sentry/i.test(text));
console.log(JSON.stringify({ ok, checkId: "next-config-surface", strict, hints, thirdPartyOk }, null, 2));
process.exit(ok ? 0 : 1);
