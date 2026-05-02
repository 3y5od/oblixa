#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const lock = JSON.parse(fs.readFileSync(path.join(ROOT, "package-lock.json"), "utf8"));
const deps = { ...(lock.packages?.[""]?.dependencies || {}), ...(lock.packages?.[""]?.devDependencies || {}) };
const keys = Object.keys(deps);
const hasGraphql = keys.some((k) => /graphql|@apollo|yoga/i.test(k));
const absent = { graphqlPackages: hasGraphql, note: "Extend with /api/graphql route scan when used." };
fs.mkdirSync(path.join(ROOT, "artifacts"), { recursive: true });
fs.writeFileSync(
  path.join(ROOT, "artifacts", "graphql-surface-absent.json"),
  `${JSON.stringify(absent, null, 2)}\n`
);
console.log(JSON.stringify(absent, null, 2));
process.exit(0);
