#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const dockerfile = path.join(process.cwd(), "Dockerfile");
const exists = fs.existsSync(dockerfile);
const payload = { surface: exists ? "dockerfile_present" : "no_container_surface" };
fs.mkdirSync(path.join(process.cwd(), "artifacts"), { recursive: true });
fs.writeFileSync(
  path.join(process.cwd(), "artifacts", "dockerfile-presence.json"),
  `${JSON.stringify(payload, null, 2)}\n`
);
console.log(JSON.stringify(payload, null, 2));
process.exit(0);
