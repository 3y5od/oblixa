#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { walkFiles } from "./lib/fs-walk.mjs";

const root = process.cwd();
const srcRoot = path.join(root, "src");
const files = walkFiles(srcRoot, (abs) => abs.endsWith(".ts") || abs.endsWith(".tsx"));

const rows = [];
for (const abs of files) {
  const rel = path.relative(root, abs).replace(/\\/g, "/");
  const text = fs.readFileSync(abs, "utf8");
  const usesAdmin = /\bcreateAdminClient\b/.test(text);
  const usesMembership = /\bgetDeterministicMembership\b|\bgetOrEnsureDeterministicMembership\b/.test(text);
  const usesOrgScope =
    /\borganization_id\b|\borgId\b|\bgetOrgMemberRole\b|\brequireApiWorkspaceEligibility\b/.test(text);
  if (!usesAdmin && !usesMembership) continue;
  rows.push({
    file: rel,
    usesAdmin,
    usesMembership,
    usesOrgScope,
  });
}

console.log(
  JSON.stringify(
    {
      fileCount: rows.length,
      rows,
    },
    null,
    2
  )
);
