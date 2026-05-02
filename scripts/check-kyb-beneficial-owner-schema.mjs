#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const p = path.join(root, "artifacts", "kyb-beneficial-owner-schema.json");
const raw = fs.readFileSync(p, "utf8");
JSON.parse(raw);
const strict = process.env.AML_ARTIFACT_STRICT === "1" || process.env.AML_ARTIFACT_STRICT === "true";
const bootstrap = path.join(root, "src", "lib", "__tests__", "contract-json-schemas.bootstrap.test.ts");
const hasBootstrap = fs.existsSync(bootstrap);
if (strict && !hasBootstrap) {
  console.error(JSON.stringify({ ok: false, checkId: "kyb-beneficial-owner-schema", error: "missing_schema_bootstrap_test" }, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({ ok: true, checkId: "kyb-beneficial-owner-schema", strict, hasBootstrap }, null, 2));
process.exit(0);
