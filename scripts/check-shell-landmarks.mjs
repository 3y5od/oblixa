#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const files = [
  "src/app/(dashboard)/layout.tsx",
  "src/components/layout/skip-link.tsx",
  "src/components/layout/sidebar.tsx",
  "src/components/layout/legal-footer.tsx",
];

const failures = [];

for (const rel of files) {
  const raw = fs.readFileSync(path.join(root, rel), "utf8");
  if (rel.endsWith("layout.tsx") && !raw.includes("<main")) failures.push(`${rel} missing <main`);
  if (rel.endsWith("skip-link.tsx") && !raw.includes("MAIN_CONTENT_ID")) failures.push(`${rel} missing shared main-content target`);
  if (rel.endsWith("sidebar.tsx") && !raw.includes("aria-label=\"Workspace\"")) failures.push(`${rel} missing workspace landmark`);
  if (rel.endsWith("legal-footer.tsx") && !raw.includes("aria-label=\"Footer links\"")) failures.push(`${rel} missing footer nav landmark`);
}

if (failures.length) {
  console.error("check-shell-landmarks: failures");
  for (const failure of failures) console.error(" ", failure);
  process.exit(1);
}

console.log("check-shell-landmarks: OK");

