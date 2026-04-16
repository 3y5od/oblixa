#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

export function walkFiles(rootDir, matcher = () => true, acc = []) {
  if (!fs.existsSync(rootDir)) return acc;
  for (const name of fs.readdirSync(rootDir)) {
    if (name === "node_modules" || name === ".git" || name === ".next") continue;
    const abs = path.join(rootDir, name);
    const st = fs.statSync(abs);
    if (st.isDirectory()) {
      walkFiles(abs, matcher, acc);
      continue;
    }
    if (matcher(abs)) acc.push(abs);
  }
  return acc;
}
