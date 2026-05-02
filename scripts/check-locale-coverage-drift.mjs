#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const payload = { ok: true, defaultLocales: ["en"], note: "Extend with Intl coverage matrix when i18n ships." };
fs.writeFileSync(path.join(ROOT, "artifacts", "locale-coverage-drift.json"), `${JSON.stringify(payload, null, 2)}\n`);
console.log(JSON.stringify(payload, null, 2));
process.exit(0);
