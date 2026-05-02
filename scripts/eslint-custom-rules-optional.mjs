#!/usr/bin/env node
/**
 * Placeholder for repo-local ESLint rules when gaps are found.
 * Always exits 0; set ESLINT_CUSTOM_RULES_STRICT=1 to reserve strict hook.
 */
const strict = process.env.ESLINT_CUSTOM_RULES_STRICT === "1" || process.env.ESLINT_CUSTOM_RULES_STRICT === "true";
console.log(
  JSON.stringify(
    {
      checkId: "eslint-custom-rules-optional",
      ok: true,
      strict,
      note: "No custom rule pack registered; strict mode reserved for future ratchet.",
    },
    null,
    2
  )
);
process.exit(0);
