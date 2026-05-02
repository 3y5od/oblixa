#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const matrixPath = path.join(root, "config", "security-enforcement-matrix.json");
const strict = process.argv.includes("--strict");

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

function main() {
  if (!fs.existsSync(matrixPath)) fail("missing config/security-enforcement-matrix.json");
  let data;
  try {
    data = JSON.parse(fs.readFileSync(matrixPath, "utf8"));
  } catch (e) {
    fail(`invalid JSON: ${e}`);
  }
  if ((data.version !== 1 && data.version !== 2) || !Array.isArray(data.controls)) {
    fail("matrix: expected { version: 1|2, controls: [] }");
  }
  const now = Date.now();
  for (const row of data.controls) {
    for (const k of ["control_id", "priority", "bucket", "status", "owner"]) {
      if (!row[k] || typeof row[k] !== "string") fail(`matrix row missing ${k}: ${JSON.stringify(row)}`);
    }
    if (row.expiry) {
      const t = Date.parse(row.expiry);
      if (!Number.isNaN(t) && t < now && row.status !== "waiver" && row.status !== "not_applicable_product") {
        if (strict) fail(`matrix control ${row.control_id}: expiry passed (${row.expiry})`);
      }
    }
    if (strict && row.status === "waiver" && !row.expiry) {
      fail(`matrix control ${row.control_id}: waiver requires expiry`);
    }
    if (strict) {
      for (const k of ["mitre_refs", "regulatory_refs", "domain_tags", "closure_status"]) {
        if (!(k in row)) fail(`matrix control ${row.control_id}: strict requires field ${k}`);
      }
      if (!Array.isArray(row.mitre_refs)) fail(`matrix control ${row.control_id}: mitre_refs must be array`);
      if (!Array.isArray(row.regulatory_refs)) {
        fail(`matrix control ${row.control_id}: regulatory_refs must be array`);
      }
      if (row.regulatory_refs.length === 0) {
        fail(`matrix control ${row.control_id}: regulatory_refs must be non-empty (framework crosswalk)`);
      }
      if (!Array.isArray(row.domain_tags) || row.domain_tags.length === 0) {
        fail(`matrix control ${row.control_id}: domain_tags must be non-empty array`);
      }
      if (typeof row.closure_status !== "string" || !row.closure_status.trim()) {
        fail(`matrix control ${row.control_id}: closure_status required`);
      }
    }
  }
  console.log(`OK: security enforcement matrix (${data.controls.length} control(s)).`);
}

main();
