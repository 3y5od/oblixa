#!/usr/bin/env node
/**
 * Phase 0a: emit artifacts/security-route-matrix.json with per-route heuristics
 * for auth, rate limits, idempotency, admin client, etc.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const apiRoot = path.join(root, "src", "app", "api");
const outPath = path.join(root, "artifacts", "security-route-matrix.json");

function walkRoutes(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walkRoutes(p, acc);
    else if (name === "route.ts") acc.push(p);
  }
  return acc;
}

function toPath(abs) {
  const rel = path.relative(apiRoot, abs).replace(/\\/g, "/");
  const segs = rel.split("/").filter(Boolean);
  segs.pop();
  return "/api/" + segs.join("/");
}

function detect(text) {
  return {
    hasSessionAuth: /\bgetApiAuthContext\b|\bgetAuthContext\b|\.auth\.getUser\s*\(/.test(text),
    hasCronAuth: /\bauthorizeCronRequest\b|\bensureCronAuthorized\b|\bCRON_SECRET\b/.test(text),
    hasWebhookSig: /stripe-signature|constructEvent|webhook.*signature/i.test(text),
    hasRateLimit: /\brateLimitCheck\b/.test(text),
    hasJsonCt: /\bjsonContentTypeRejection\b|\bapplication\/json/i.test(text),
    hasIdempotency: /\benforceIdempotency\b|\bidempotency/i.test(text),
    touchesAdminClient: /\bcreateAdminClient\b/.test(text),
    hasWorkspaceGate: /\brequireApiWorkspaceEligibility\b/.test(text),
  };
}

function secIds(flags, isPublicGuess) {
  const ids = new Set(["SEC-DOS-001"]);
  for (let i = 1; i <= 10; i++) ids.add(`SEC-API${i}`);
  if (flags.hasSessionAuth) ids.add("SEC-AZ-002");
  if (flags.hasCronAuth) ids.add("SEC-AUTH-012").add("SEC-CRON-001");
  if (flags.hasWebhookSig) ids.add("SEC-INT-001").add("SEC-INT-003");
  if (flags.hasRateLimit) ids.add("SEC-DOS-001");
  if (flags.touchesAdminClient) ids.add("SEC-AZ-010").add("SEC-DATA-001");
  if (flags.hasWorkspaceGate) ids.add("SEC-AZ-003");
  if (isPublicGuess) ids.add("SEC-API8");
  return [...ids].sort();
}

function main() {
  const rows = [];
  for (const abs of walkRoutes(apiRoot).sort()) {
    const text = fs.readFileSync(abs, "utf8");
    const flags = detect(text);
    const p = toPath(abs);
    const publicGuess =
      /unauthenticatedAccessAllowed|publicAllowlist|\/health\b/i.test(text) ||
      p.endsWith("/health");
    rows.push({
      path: p,
      route_file: path.relative(root, abs).replace(/\\/g, "/"),
      ...flags,
      public_guess: publicGuess,
      sec_ids: secIds(flags, publicGuess),
    });
  }
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(rows, null, 2));
  console.log(`Wrote ${outPath} (${rows.length} routes)`);
}

main();
