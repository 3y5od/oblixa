#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const idempotency = fs.readFileSync(path.join(root, "src/lib/idempotency.ts"), "utf8");
const extractRoute = fs.readFileSync(path.join(root, "src/app/api/extract/run/route.ts"), "utf8");
const issues = [];

if (!/x-idempotency-key/.test(idempotency) || !/Duplicate request blocked by idempotency key/.test(idempotency)) {
  issues.push({ issue: "idempotency_helper_missing_header_contract" });
}
if (!/enforceIdempotency/.test(extractRoute)) {
  issues.push({ file: "src/app/api/extract/run/route.ts", issue: "worker_route_missing_idempotency_guard" });
}

console.log(JSON.stringify({ issueCount: issues.length, issues }, null, 2));
if (issues.length > 0) process.exit(1);
