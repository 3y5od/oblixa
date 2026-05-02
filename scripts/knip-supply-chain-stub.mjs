#!/usr/bin/env node
/**
 * Optional supply-chain placeholder until knip is adopted (exclude e2e snapshots in real runs).
 * KNIP_STRICT=1 reserved for future non-zero exit when knip is wired.
 */
const strict = process.env.KNIP_STRICT === "1" || process.env.KNIP_STRICT === "true";
console.log(JSON.stringify({ ok: true, checkId: "knip-supply-chain-stub", strict, mode: "stub" }, null, 2));
process.exit(strict ? 0 : 0);
