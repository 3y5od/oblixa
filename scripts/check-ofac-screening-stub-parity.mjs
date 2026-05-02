#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const sha = path.join(process.cwd(), "artifacts", "ofac-sdn-sample.sha256");
const txt = path.join(process.cwd(), "artifacts", "ofac-sdn-sample-placeholder.txt");
const ok = fs.existsSync(sha) && fs.existsSync(txt);
console.log(JSON.stringify({ ok, checkId: "ofac-screening-stub-parity" }, null, 2));
process.exit(ok ? 0 : 1);
