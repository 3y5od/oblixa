#!/usr/bin/env node
/**
 * Human-readable V8 inventory summary.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const appRoot = path.join(root, "src", "app");
const apiRoot = path.join(root, "src", "app", "api");
const actionsRoot = path.join(root, "src", "actions");

function countRouteTs(dir) {
  let n = 0;
  if (!fs.existsSync(dir)) return 0;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) n += countRouteTs(full);
    else if (name === "route.ts") n += 1;
  }
  return n;
}

function countPageTsx(dir) {
  let n = 0;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) n += countPageTsx(full);
    else if (name === "page.tsx") n += 1;
  }
  return n;
}

function countActionFiles(dir) {
  let n = 0;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) n += countActionFiles(full);
    else if (name.endsWith(".ts") && !name.endsWith(".test.ts")) {
      const src = fs.readFileSync(full, "utf8");
      if (src.includes('"use server"')) n += 1;
    }
  }
  return n;
}

const pages = countPageTsx(appRoot);
const apis = countRouteTs(apiRoot);
const actions = countActionFiles(actionsRoot);

const report = {
  generatedAt: new Date().toISOString(),
  counts: { pageTsxFiles: pages, apiRouteTsFiles: apis, serverActionModules: actions },
  checks: [
    "npm run check:v8-page-inventory",
    "npm run check:v8-api-inventory",
    "npm run check:v8-action-inventory",
  ],
};

console.log(JSON.stringify(report, null, 2));
