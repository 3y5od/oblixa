#!/usr/bin/env node
/** Epic 116 — SHA256 of vendored maximal assurance plan snapshot matches sidecar file. */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const planPath = path.join(root, "artifacts", "assurance", "maximal-assurance-program.plan.md");
const shaPath = path.join(root, "artifacts", "assurance", "maximal-assurance-program.plan.sha256");

const body = fs.readFileSync(planPath);
const actual = crypto.createHash("sha256").update(body).digest("hex");
const expected = fs.readFileSync(shaPath, "utf8").trim().split(/\s+/)[0];

if (actual !== expected) {
  console.error("Plan snapshot SHA256 mismatch — regenerate sidecar after intentional edits:");
  console.error(`  echo "${actual}" > artifacts/assurance/maximal-assurance-program.plan.sha256`);
  process.exit(1);
}

console.log("OK: maximal-assurance-program.plan.md matches committed SHA256.");
