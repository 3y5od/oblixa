#!/usr/bin/env node
/** Epic 156 — verify signed bundle when ASSURANCE_BUNDLE_SIGNING=required */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const manifestPath = path.join(root, "artifacts", "assurance", "assurance-bundle.manifest.json");

const required = process.env.ASSURANCE_BUNDLE_SIGNING === "required";
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

if (!required) {
  console.log("OK: assurance bundle signing not required (ASSURANCE_BUNDLE_SIGNING≠required).");
  process.exit(0);
}

if (!manifest.signature || manifest.signingPolicy !== "required") {
  console.error(
    "ASSURANCE_BUNDLE_SIGNING=required but manifest missing signature or signingPolicy!=required"
  );
  process.exit(1);
}

console.log("OK: assurance bundle signature present (placeholder — wire Ed25519 verify).");
