#!/usr/bin/env node
/** Epic 136 — programVersion semver on epics.json */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const epicsPath = path.join(root, "artifacts", "assurance", "epics.json");

const semverRe = /^\d+\.\d+\.\d+$/;
const doc = JSON.parse(fs.readFileSync(epicsPath, "utf8"));
const pv = doc.programVersion ?? doc.version;
if (typeof pv !== "string" || !semverRe.test(pv)) {
  console.error("epics.json must define programVersion (or version) as semver major.minor.patch");
  process.exit(1);
}
console.log(`OK: assurance programVersion=${pv}`);
