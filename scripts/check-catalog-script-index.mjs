#!/usr/bin/env node
/** Epic 13 — Drift check for catalog-script-index.json */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { buildCatalogScriptIndexPayload } from "./lib/build-catalog-script-index.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const p = path.join(root, "artifacts", "assurance", "catalog-script-index.json");

function norm(payload) {
  return JSON.stringify(
    payload.catalogs.map((c) => ({ catalogId: c.catalogId, catalogFile: c.catalogFile })),
    null,
    2
  );
}

const committed = JSON.parse(fs.readFileSync(p, "utf8"));
const fresh = buildCatalogScriptIndexPayload(root);
if (committed.catalogCount !== fresh.catalogCount || norm(committed) !== norm(fresh)) {
  console.error("catalog-script-index.json drifts from catalog-partitions/. Run npm run generate:catalog-script-index");
  process.exit(1);
}
console.log(`OK: catalog-script-index (${fresh.catalogCount} catalogs).`);
