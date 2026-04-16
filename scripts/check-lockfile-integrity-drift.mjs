#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const lockfile = JSON.parse(fs.readFileSync(path.join(root, "package-lock.json"), "utf8"));

const rootPkg = lockfile.packages?.[""] ?? {};
const issues = [];

for (const section of ["dependencies", "devDependencies"]) {
  const pkgDeps = pkg[section] ?? {};
  const lockDeps = rootPkg[section] ?? {};
  for (const [name, version] of Object.entries(pkgDeps)) {
    if (!(name in lockDeps)) {
      issues.push({ issue: "missing_lockfile_entry", section, name });
      continue;
    }
    if (lockDeps[name] !== version) {
      issues.push({
        issue: "version_mismatch",
        section,
        name,
        packageJson: version,
        lockfile: lockDeps[name],
      });
    }
  }
}

console.log(JSON.stringify({ issueCount: issues.length, issues }, null, 2));
if (issues.length > 0) process.exit(1);
