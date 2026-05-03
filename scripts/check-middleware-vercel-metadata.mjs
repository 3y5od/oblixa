#!/usr/bin/env node
/** Epic 17 — proxy + vercel.json route metadata sanity. */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const vercelPath = path.join(root, "vercel.json");
const proxyPath = path.join(root, "src", "proxy.ts");
const errors = [];

const raw = fs.readFileSync(vercelPath, "utf8");
const doc = JSON.parse(raw);
if (!Array.isArray(doc.crons) || doc.crons.length < 1) {
  errors.push("vercel.json must define non-empty crons[]");
}
for (const [index, c] of (doc.crons ?? []).entries()) {
  if (!c.path || !c.schedule) {
    errors.push(`vercel.json crons[${index}] needs path + schedule`);
    continue;
  }
  if (!String(c.path).startsWith("/api/")) {
    errors.push(`vercel.json crons[${index}] path must be /api/*: ${c.path}`);
  }
  const routeFile = path.join(root, "src", "app", ...String(c.path).split("/").filter(Boolean), "route.ts");
  if (!fs.existsSync(routeFile)) {
    errors.push(`vercel.json crons[${index}] has no route file: ${c.path}`);
  }
}

if (!fs.existsSync(proxyPath)) {
  errors.push("src/proxy.ts is missing");
} else {
  const proxy = fs.readFileSync(proxyPath, "utf8");
  for (const needle of [
    "export async function proxy",
    "export const config",
    "matcher",
    "applyCorrelationHeadersToResponse",
    "OBLIXA_PATHNAME_HEADER",
    "unauthenticatedAccessAllowed",
  ]) {
    if (!proxy.includes(needle)) errors.push(`src/proxy.ts missing marker: ${needle}`);
  }
}

if (errors.length) {
  console.error("check-middleware-vercel-metadata failed:");
  for (const error of errors) console.error(`  - ${error}`);
  process.exit(1);
}

console.log(`OK: vercel.json crons=${doc.crons.length}; proxy metadata markers present`);
