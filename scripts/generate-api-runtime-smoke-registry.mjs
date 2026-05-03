#!/usr/bin/env node
/**
 * Epic 3 — Regenerate api-runtime-smoke-registry.json from src/app/api route modules.
 * Usage: node scripts/generate-api-runtime-smoke-registry.mjs --write [--output=path]
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { buildApiRuntimeSmokeRegistryPayload } from "./lib/build-api-runtime-smoke-registry.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const defaultOut = path.join(root, "artifacts", "assurance", "api-runtime-smoke-registry.json");

function main() {
  const write = process.argv.includes("--write");
  const outArg = process.argv.find((x) => x.startsWith("--output="));
  const outPath = outArg ? outArg.slice("--output=".length).trim() : defaultOut;
  const payload = buildApiRuntimeSmokeRegistryPayload(root);

  if (!write) {
    console.log(JSON.stringify({ routeCount: payload.routeCount, preview: payload.routes.slice(0, 5) }, null, 2));
    console.error("Dry run. Pass --write to update registry.");
    return;
  }

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(`Wrote ${payload.routeCount} routes to ${path.relative(root, outPath)}`);
}

main();
