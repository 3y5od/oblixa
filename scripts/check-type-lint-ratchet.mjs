#!/usr/bin/env node
import { readFileSync } from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const strict = process.argv.includes("--strict");
const ROOT = process.cwd();
const baseline = JSON.parse(readFileSync(path.join(ROOT, "scripts", "type-lint-baseline.json"), "utf8"));
const current = JSON.parse(
  execFileSync("node", [path.join(ROOT, "scripts", "report-type-lint-strictness.mjs")], {
    encoding: "utf8",
  })
);

const lintRegressed = current.lint.status > baseline.lintStatus;
const typeRegressed = current.typecheck.status > baseline.typecheckStatus;
console.log(
  JSON.stringify(
    {
      baseline,
      current,
      lintRegressed,
      typeRegressed,
      strict,
    },
    null,
    2
  )
);

if (strict && (lintRegressed || typeRegressed)) {
  process.exit(1);
}
