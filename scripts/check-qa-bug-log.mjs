#!/usr/bin/env node
/**
 * Validates scripts/qa-bug-log.json shape and file references.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const logPath = path.join(root, "scripts", "qa-bug-log.json");

const SEVERITY = new Set(["P0", "P1", "P2", "P3"]);
const STATUS = new Set(["open", "fixed", "wontfix", "duplicate"]);

function main() {
  if (!fs.existsSync(logPath)) {
    console.error("Missing", logPath);
    process.exit(1);
  }
  let data;
  try {
    data = JSON.parse(fs.readFileSync(logPath, "utf8"));
  } catch (e) {
    console.error("Invalid JSON:", e.message);
    process.exit(1);
  }
  if (!Array.isArray(data)) {
    console.error("qa-bug-log.json must be a JSON array");
    process.exit(1);
  }
  const ids = new Set();
  for (let i = 0; i < data.length; i += 1) {
    const row = data[i];
    if (!row || typeof row !== "object") {
      console.error(`Entry ${i}: must be an object`);
      process.exit(1);
    }
    for (const k of ["id", "severity", "route", "status", "summary"]) {
      if (typeof row[k] !== "string" || !row[k].trim()) {
        console.error(`Entry ${i}: missing or invalid string field "${k}"`);
        process.exit(1);
      }
    }
    if (!SEVERITY.has(row.severity)) {
      console.error(`Entry ${i}: severity must be one of`, [...SEVERITY].join(", "));
      process.exit(1);
    }
    if (!STATUS.has(row.status)) {
      console.error(`Entry ${i}: status must be one of`, [...STATUS].join(", "));
      process.exit(1);
    }
    if (!row.route.startsWith("/")) {
      console.error(`Entry ${i}: route must start with /`);
      process.exit(1);
    }
    if (ids.has(row.id)) {
      console.error(`Duplicate bug id: ${row.id}`);
      process.exit(1);
    }
    ids.add(row.id);
    if (Array.isArray(row.suspected_files)) {
      for (const f of row.suspected_files) {
        if (typeof f !== "string" || !f.startsWith("src/")) {
          console.error(`Entry ${i}: suspected_files entries must be src/ paths`);
          process.exit(1);
        }
        const abs = path.join(root, f);
        if (!fs.existsSync(abs)) {
          console.error(`Entry ${i}: missing suspected_file ${f}`);
          process.exit(1);
        }
      }
    }
  }
  console.log(`check-qa-bug-log: OK (${data.length} entries)`);
}

main();
