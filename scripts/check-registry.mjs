#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const scriptsDir = __dirname;

function isCheckFile(name) {
  return name.startsWith("check-") && name.endsWith(".mjs");
}

function checkIdFromFile(name) {
  return name.replace(/^check-/, "").replace(/\.mjs$/, "");
}

export function buildCheckRegistry() {
  const out = new Map();
  for (const name of fs.readdirSync(scriptsDir)) {
    if (!isCheckFile(name)) continue;
    const abs = path.join(scriptsDir, name);
    out.set(checkIdFromFile(name), {
      id: checkIdFromFile(name),
      file: abs,
      relativeFile: `scripts/${name}`,
    });
  }
  return out;
}

export function listCheckIds() {
  return [...buildCheckRegistry().keys()].sort();
}
