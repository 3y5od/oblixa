#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "..", "public");
const robots = path.join(publicDir, "robots.txt");
if (!fs.existsSync(robots)) {
  console.error("missing public/robots.txt");
  process.exit(1);
}
console.log("OK: public SEO surface (robots.txt present).");
