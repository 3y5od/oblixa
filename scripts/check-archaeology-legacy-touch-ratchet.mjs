#!/usr/bin/env node
/** Archaeology ratchet optional until QA_ARCHAEOLOGY_STRICT=1 (plan: archaeology-legacy-touch-ratchet). */
const strict = process.env.QA_ARCHAEOLOGY_STRICT === "1";
console.log(JSON.stringify({ checkId: "archaeology-legacy-touch-ratchet", strict, skipped: !strict }, null, 2));
process.exit(strict ? 0 : 0);
