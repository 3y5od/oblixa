#!/usr/bin/env node
const on = process.env.RUN_CHAOS === "1";
console.log(JSON.stringify({ ok: true, chaos: on ? "would_run_compose" : "skipped" }, null, 2));
process.exit(0);
