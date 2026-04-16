#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const scriptsDir = path.join(root, "scripts");
const strict = process.argv.includes("--strict");

const wrapperBody =
  '#!/usr/bin/env node\nimport { runGenericSecurityCheck } from "./security-check-generic.mjs";\nrunGenericSecurityCheck(import.meta.url);\n';

const wrappers = [];
for (const name of fs.readdirSync(scriptsDir)) {
  if (!name.startsWith("check-") || !name.endsWith(".mjs")) continue;
  const abs = path.join(scriptsDir, name);
  const text = fs.readFileSync(abs, "utf8");
  if (text === wrapperBody) wrappers.push(`scripts/${name}`);
}

const payload = {
  checkId: "wrapper-reintroduction",
  strict,
  ok: !strict || wrappers.length === 0,
  wrappers,
};
console.log(JSON.stringify(payload, null, 2));
process.exit(payload.ok ? 0 : 1);
