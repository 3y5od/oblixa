#!/usr/bin/env node
/** Emits bus-factor JSON from CODEOWNERS line count (plan: bus-factor-codeowners-json). */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const p = path.join(root, ".github", "CODEOWNERS");
const lines = fs.existsSync(p)
  ? fs.readFileSync(p, "utf8").split("\n").filter((l) => l.trim() && !l.startsWith("#"))
  : [];
const out = {
  generatedAt: new Date().toISOString(),
  codeownerLines: lines.length,
  note: "Extend with git shortlog --summary for depth.",
};
fs.mkdirSync(path.join(root, "artifacts"), { recursive: true });
fs.writeFileSync(path.join(root, "artifacts", "bus-factor-codeowners.json"), `${JSON.stringify(out, null, 2)}\n`);
console.log(JSON.stringify({ ok: true, ...out }, null, 2));
