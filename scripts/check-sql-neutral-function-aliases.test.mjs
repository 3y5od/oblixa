import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const MIGRATION_REL = "supabase/migrations/088_sql_neutral_function_aliases.sql";
const MIGRATION_SQL = fs.readFileSync(path.join(ROOT, MIGRATION_REL), "utf8");
const phaseSix = `v${6}`;
const phaseTen = `v${10}`;

const ALIASES = [
  {
    legacy: `cleanup_expired_${phaseTen}_mutation_idempotency`,
    neutral: "cleanup_expired_mutation_idempotency",
    signature: "timestamptz",
    grants: ["service_role"],
    securityDefiner: true,
    searchPath: true,
  },
  {
    legacy: `claim_${phaseTen}_mutation_idempotency`,
    neutral: "claim_mutation_idempotency",
    signature: "uuid, uuid, text, text, text, text, text, text, jsonb, timestamptz",
    grants: ["service_role"],
    securityDefiner: true,
    searchPath: true,
  },
  {
    legacy: `complete_${phaseTen}_mutation_idempotency`,
    neutral: "complete_mutation_idempotency",
    signature: "uuid, uuid, text, text, text, text, text, jsonb",
    grants: ["service_role"],
    securityDefiner: true,
    searchPath: true,
  },
  {
    legacy: `${phaseTen}_role_rank`,
    neutral: "role_rank",
    signature: "text",
    grants: ["authenticated", "service_role"],
    securityDefiner: true,
    searchPath: true,
  },
  {
    legacy: `${phaseTen}_member_can_read`,
    neutral: "member_can_read",
    signature: "uuid, text, text",
    grants: ["authenticated", "service_role"],
    securityDefiner: true,
    searchPath: true,
  },
  {
    legacy: `cleanup_old_${phaseTen}_read_model_refresh_jobs`,
    neutral: "cleanup_old_read_model_refresh_jobs",
    signature: "timestamptz",
    grants: ["service_role"],
    securityDefiner: true,
    searchPath: true,
  },
  {
    legacy: `cleanup_expired_${phaseTen}_runtime_artifacts`,
    neutral: "cleanup_expired_runtime_artifacts",
    signature: "timestamptz",
    grants: ["service_role"],
    securityDefiner: true,
    searchPath: true,
  },
  {
    legacy: `replace_${phaseTen}_read_model_rows`,
    neutral: "replace_read_model_rows",
    signature: "text, uuid, jsonb, text[], timestamptz",
    grants: ["service_role"],
    securityDefiner: true,
    searchPath: true,
  },
  {
    legacy: `${phaseSix}_apply_updated_at_trigger`,
    neutral: "apply_updated_at_trigger",
    signature: "text",
    grants: ["service_role"],
    securityDefiner: false,
    searchPath: false,
  },
];

function functionBlock(neutral) {
  const match = MIGRATION_SQL.match(
    new RegExp(`create or replace function public\\.${neutral}\\([\\s\\S]*?(?=\\nrevoke all on function public\\.${neutral}\\()`, "u"),
  );
  assert.ok(match, `missing wrapper block for ${neutral}`);
  return match[0];
}

test("neutral SQL function aliases are forward-only and delegate to legacy functions", () => {
  for (const alias of ALIASES) {
    const block = functionBlock(alias.neutral);
    assert.match(block, new RegExp(`create or replace function public\\.${alias.neutral}\\(`, "u"));
    assert.match(block, new RegExp(`public\\.${alias.legacy}\\(`, "u"));
    assert.match(MIGRATION_SQL, new RegExp(`revoke all on function public\\.${alias.neutral}\\(${alias.signature.replaceAll("[", "\\[").replaceAll("]", "\\]")}\\) from public;`, "u"));
    for (const grant of alias.grants) {
      assert.match(MIGRATION_SQL, new RegExp(`grant execute on function public\\.${alias.neutral}\\(${alias.signature.replaceAll("[", "\\[").replaceAll("]", "\\]")}\\) to ${grant};`, "u"));
    }
    if (alias.securityDefiner) {
      assert.match(block, /\bsecurity definer\b/u, `${alias.neutral} must preserve security definer behavior`);
    } else {
      assert.doesNotMatch(block, /\bsecurity definer\b/u, `${alias.neutral} must not add security definer behavior`);
    }
    if (alias.searchPath) {
      assert.match(block, /\bset search_path = public\b/u, `${alias.neutral} must pin search_path`);
    } else {
      assert.doesNotMatch(block, /\bset search_path\b/u, `${alias.neutral} must not add a search_path clause`);
    }
  }
});

test("neutral SQL function alias migration does not broaden execution grants", () => {
  assert.doesNotMatch(MIGRATION_SQL, /\bgrant execute on function public\.[^(]+\([^)]*\) to anon;/u);
  assert.doesNotMatch(MIGRATION_SQL, /\bgrant execute on function public\.[^(]+\([^)]*\) to public;/u);
  for (const alias of ALIASES.filter((row) => !row.grants.includes("authenticated"))) {
    assert.doesNotMatch(MIGRATION_SQL, new RegExp(`grant execute on function public\\.${alias.neutral}\\([^)]*\\) to authenticated;`, "u"));
  }
});

test("neutral SQL function alias migration does not drop or rename legacy objects", () => {
  assert.doesNotMatch(MIGRATION_SQL, /\bdrop\s+(?:function|table|view|policy)\b/iu);
  assert.doesNotMatch(MIGRATION_SQL, /\balter\s+(?:function|table|view|policy)\b[\s\S]*\brename\b/iu);
  assert.doesNotMatch(MIGRATION_SQL, /\bcreate\s+(?:table|view)\s+public\.(?:activation_state|read_model_rows|work_items)\b/iu);
});
