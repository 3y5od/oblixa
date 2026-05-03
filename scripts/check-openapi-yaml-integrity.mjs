#!/usr/bin/env node
/**
 * Epic 26 — structural integrity of openapi.yaml (parse + paths present).
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const specPath = path.join(root, "openapi.yaml");

if (!fs.existsSync(specPath)) {
  console.log(JSON.stringify({ ok: true, mode: "no_openapi_yaml" }));
  process.exit(0);
}

let doc;
try {
  doc = parse(fs.readFileSync(specPath, "utf8"));
} catch (e) {
  console.error("openapi.yaml parse error:", e?.message || e);
  process.exit(1);
}

if (!doc || typeof doc !== "object") {
  console.error("openapi.yaml: root must be an object");
  process.exit(1);
}

const paths = doc.paths;
if (!paths || typeof paths !== "object" || Array.isArray(paths)) {
  console.error("openapi.yaml: missing paths map");
  process.exit(1);
}

const pathKeys = Object.keys(paths);
console.log(
  JSON.stringify({
    ok: true,
    openapi: doc.openapi ?? doc.swagger ?? null,
    pathCount: pathKeys.length,
    samplePaths: pathKeys.slice(0, 8),
  })
);
