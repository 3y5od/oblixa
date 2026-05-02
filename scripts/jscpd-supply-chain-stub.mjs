#!/usr/bin/env node
/** Optional jscpd placeholder; JSCPD_STRICT=1 reserved for future ratchet. */
const strict = process.env.JSCPD_STRICT === "1" || process.env.JSCPD_STRICT === "true";
console.log(JSON.stringify({ ok: true, checkId: "jscpd-supply-chain-stub", strict, mode: "stub" }, null, 2));
process.exit(0);
