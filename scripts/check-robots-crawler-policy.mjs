#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const robots = path.join(process.cwd(), "public", "robots.txt");
if (!fs.existsSync(robots)) {
  console.log(JSON.stringify({ ok: true, mode: "no_robots_txt" }, null, 2));
  process.exit(0);
}
const text = fs.readFileSync(robots, "utf8");
const bots = ["GPTBot", "OAI-SearchBot", "Google-Extended", "PerplexityBot"];
const found = bots.filter((b) => text.includes(b));
const strict = process.env.ROBOTS_POLICY_STRICT === "1";
const ok = !strict || found.length > 0 || /User-agent:/i.test(text) || /Disallow:/i.test(text);
console.log(JSON.stringify({ ok, strict, found, hasDisallow: /Disallow:/i.test(text) }, null, 2));
process.exit(ok ? 0 : 1);
