#!/usr/bin/env node
/**
 * Epic 12 — Validate artifacts/assurance/waivers.json against waivers.schema.json (lightweight checks).
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const dataPath = path.join(root, "artifacts", "assurance", "waivers.json");

const data = JSON.parse(fs.readFileSync(dataPath, "utf8"));
const errors = [];

if (data.version !== 1) errors.push(`waivers.json version must be 1 (got ${data.version})`);
if (!Array.isArray(data.waivers)) errors.push("waivers must be an array");

const soonMs = Date.now() + 30 * 24 * 60 * 60 * 1000;
for (const w of data.waivers ?? []) {
  for (const k of ["id", "owner", "expiresOn", "reason", "scope"]) {
    if (typeof w[k] !== "string" || !w[k].trim()) {
      errors.push(`waiver ${JSON.stringify(w.id)} missing ${k}`);
    }
  }
  const exp = Date.parse(`${w.expiresOn}T00:00:00.000Z`);
  if (!Number.isNaN(exp) && exp < Date.now()) {
    errors.push(`waiver ${w.id} expired on ${w.expiresOn}`);
  }
  if (!Number.isNaN(exp) && exp < soonMs && exp >= Date.now()) {
    console.warn(`WARN waiver ${w.id} expires within 30 days (${w.expiresOn})`);
  }
}

if (errors.length) {
  console.error("check-assurance-waivers failed:\n", errors.join("\n"));
  process.exit(1);
}

console.log(`OK: ${data.waivers.length} assurance waiver(s) validated.`);
