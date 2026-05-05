#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";
import { walkFiles } from "./lib/fs-walk.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const strict = process.env.CI_INGEST_NOTEBOOKS === "1";
const nb = walkFiles(root, (file) => file.endsWith(".ipynb"));
if (nb.length && !strict) {
  console.warn(`WARN: ${nb.length} .ipynb file(s) present — set CI_INGEST_NOTEBOOKS=1 only if CI executes them.`);
}
console.log("OK: notebook execution guard.");
