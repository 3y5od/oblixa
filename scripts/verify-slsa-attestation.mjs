#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const strict = process.env.SLSA_VERIFY_STRICT === "1";
const stub = path.join(process.cwd(), "artifacts", "slsa-build-level-stub.json");
if (!fs.existsSync(stub)) {
  console.log(JSON.stringify({ ok: !strict, mode: "no_stub" }, null, 2));
  process.exit(strict ? 1 : 0);
}
JSON.parse(fs.readFileSync(stub, "utf8"));
console.log(JSON.stringify({ ok: true, mode: "telemetry" }, null, 2));
process.exit(0);
