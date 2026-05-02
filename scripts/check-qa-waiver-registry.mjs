#!/usr/bin/env node
/**
 * Validates config/qa-external-waiver-registry.json — each waiver needs id, issue, expires, scope.
 */
import fs from "node:fs";
import path from "node:path";

const p = path.join(process.cwd(), "config", "qa-external-waiver-registry.json");
if (!fs.existsSync(p)) {
  console.error(JSON.stringify({ ok: false, reason: "missing_registry" }, null, 2));
  process.exit(1);
}
const data = JSON.parse(fs.readFileSync(p, "utf8"));
const waivers = data.waivers || [];
const issuePattern = /^(GH-\d+|https:\/\/)/i;
const bad = [];
for (const w of waivers) {
  if (!w.id || typeof w.id !== "string") bad.push({ w, reason: "id" });
  if (!w.issue || !issuePattern.test(String(w.issue))) bad.push({ w, reason: "issue" });
  if (!w.expires || Number.isNaN(Date.parse(w.expires))) bad.push({ w, reason: "expires" });
  if (!w.scope || typeof w.scope !== "string") bad.push({ w, reason: "scope" });
  if (w.expires && new Date(w.expires) < new Date()) bad.push({ w, reason: "expired" });
}
if (bad.length) {
  console.error(JSON.stringify({ ok: false, bad }, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({ ok: true, waivers: waivers.length }, null, 2));
