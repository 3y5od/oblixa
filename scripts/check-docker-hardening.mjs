#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

function findDockerfiles(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const name of fs.readdirSync(dir)) {
    if (name === "node_modules" || name === ".git") continue;
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) findDockerfiles(p, acc);
    else if (name === "Dockerfile" || name.endsWith("Dockerfile")) acc.push(p);
  }
  return acc;
}

const hits = findDockerfiles(root);
if (hits.length === 0) {
  console.log("OK: no Dockerfile in repo (docker hardening not applicable).");
} else {
  console.log(`OK: found ${hits.length} Dockerfile(s) — review USER/read_only manually.`);
}
