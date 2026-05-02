#!/usr/bin/env node
/**
 * When SYNTHETIC_STRICT=1, staging URL + secrets must be present so synthetic/SLO jobs can run for real.
 */
const strict = process.env.SYNTHETIC_STRICT === "1" || process.env.SYNTHETIC_STRICT === "true";
const staging = Boolean(process.env.STAGING_BASE_URL?.trim());
if (strict && !staging) {
  console.error(
    JSON.stringify(
      {
        ok: false,
        checkId: "synthetic-slo-env",
        error: "STAGING_BASE_URL_required_when_SYNTHETIC_STRICT",
      },
      null,
      2
    )
  );
  process.exit(1);
}
console.log(JSON.stringify({ ok: true, checkId: "synthetic-slo-env", strict, hasStaging: staging }, null, 2));
process.exit(0);
