#!/usr/bin/env node
/**
 * Advisory: counts API routes that use readJsonBodyLimited or parseJsonBodyWithLimit (M18 adoption tracker).
 * Always exits 0; raise OBLIXA_STRICT_BODY_LIMITS=1 later to enforce a minimum.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const modPath = path.join(__dirname, "..", "src", "lib", "security", "read-json-body-limited.ts");
if (!fs.existsSync(modPath)) {
  console.error("missing read-json-body-limited.ts");
  process.exit(1);
}
const root = path.join(__dirname, "..");
let uses = 0;
function walk(dir) {
  for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, name.name);
    if (name.isDirectory()) {
      if (name.name === "node_modules") continue;
      walk(p);
    } else if (name.name === "route.ts" && p.includes(`${path.sep}api${path.sep}`)) {
      const raw = fs.readFileSync(p, "utf8");
      if (raw.includes("readJsonBodyLimited") || raw.includes("parseJsonBodyWithLimit")) uses++;
    }
  }
}
walk(path.join(root, "src", "app", "api"));
const min = Number(process.env.BODY_LIMIT_MIN_ROUTES ?? "0");
if (process.env.OBLIXA_STRICT_BODY_LIMITS === "1" && uses < min) {
  console.error(`Strict body limits: need >=${min} routes using readJsonBodyLimited, found ${uses}`);
  process.exit(1);
}
console.log(
  JSON.stringify({ checkId: "json-body-limited-adoption", ok: true, apiRoutesUsingReadJsonBodyLimited: uses })
);
console.log("OK: read-json-body-limited module present (adoption advisory).");
