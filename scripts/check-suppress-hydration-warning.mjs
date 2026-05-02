#!/usr/bin/env node
/**
 * Flags `suppressHydrationWarning` without a nearby ticket reference (TICKET- or OBLIXA-).
 */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const targets = ["src", "e2e"];
const ticketRe = /(TICKET-|OBLIXA-|#)\d+/i;
const problems = [];

function walk(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name.startsWith(".")) continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === "node_modules" || ent.name === ".next") continue;
      out.push(...walk(p));
    } else if (/\.(tsx|jsx)$/.test(ent.name)) out.push(p);
  }
  return out;
}

for (const t of targets) {
  for (const file of walk(path.join(root, t))) {
    const raw = fs.readFileSync(file, "utf8");
    if (!raw.includes("suppressHydrationWarning")) continue;
    const lines = raw.split("\n");
    lines.forEach((line, i) => {
      if (!line.includes("suppressHydrationWarning")) return;
      const window = lines.slice(Math.max(0, i - 2), i + 3).join("\n");
      if (!ticketRe.test(window)) {
        problems.push({ file: path.relative(root, file), line: i + 1 });
      }
    });
  }
}

const strict = process.env.HYDRATION_WARNING_STRICT === "1" || process.env.HYDRATION_WARNING_STRICT === "true";
const clean = problems.length === 0;
console.log(JSON.stringify({ checkId: "hydration-warning-tickets", clean, strict, problems }, null, 2));
process.exit(strict && !clean ? 1 : 0);
