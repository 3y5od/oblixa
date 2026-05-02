#!/usr/bin/env node
/**
 * Fails if multiple semver majors for react or next appear in npm ls (summary line).
 * npm ls output varies by version; this is a lightweight guardrail.
 */
import { spawnSync } from "node:child_process";

function majorsFor(pkg) {
  const r = spawnSync("npm", ["ls", pkg, "--json", "--depth=10"], {
    encoding: "utf8",
    shell: process.platform === "win32",
  });
  if (!r.stdout) return null;
  try {
    const tree = JSON.parse(r.stdout);
    const set = new Set();
    /** Only count semver majors for nodes whose dependency name is `pkg` (not every transitive version). */
    function walkDeps(deps) {
      if (!deps || typeof deps !== "object") return;
      for (const [name, child] of Object.entries(deps)) {
        if (name === pkg && child && typeof child.version === "string") {
          const m = child.version.match(/^(\d+)/);
          if (m) set.add(m[1]);
        }
        walkDeps(child.dependencies);
      }
    }
    walkDeps(tree.dependencies);
    return [...set];
  } catch {
    return null;
  }
}

const reactMajors = majorsFor("react");
const nextMajors = majorsFor("next");
let ok = true;
if (reactMajors && reactMajors.length > 1) {
  console.error(`Multiple react major versions detected: ${reactMajors.join(", ")}`);
  ok = false;
}
if (nextMajors && nextMajors.length > 1) {
  console.error(`Multiple next major versions detected: ${nextMajors.join(", ")}`);
  ok = false;
}
if (ok) {
  console.log(
    `duplicate-deps check: react majors=${reactMajors?.join(",") ?? "n/a"} next majors=${nextMajors?.join(",") ?? "n/a"}`,
  );
}
process.exit(ok ? 0 : 1);
