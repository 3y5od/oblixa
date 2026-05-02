#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const p = path.join(__dirname, "..", "config", "upload-format-banlist.json");
if (!fs.existsSync(p)) {
  console.error("missing config/upload-format-banlist.json");
  process.exit(1);
}
const j = JSON.parse(fs.readFileSync(p, "utf8"));
if (!Array.isArray(j.extensions) || j.extensions.length === 0) {
  console.error("upload-format-banlist: extensions[] required");
  process.exit(1);
}
console.log(`OK: upload banlist (${j.extensions.length} extension(s)).`);
