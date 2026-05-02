#!/usr/bin/env node
/**
 * Validate artifacts/debugging-sweep-closure.json against config/debugging-sweep-closure.schema.json.
 */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const artifactPath = path.join(root, "artifacts", "debugging-sweep-closure.json");
const schemaPath = path.join(root, "config", "debugging-sweep-closure.schema.json");

const ROW_KINDS = new Set([
  "npm_script",
  "github_workflow",
  "playwright_profile",
  "playwright_config_axis",
  "ifEnv_gate",
  "manual_doc_review",
  "manual_security_surface_review",
  "deploy_config_review",
  "dependency_policy_review",
  "toolchain_config_file",
  "repo_policy_file",
  "node_smoke_test",
  "telemetry_report",
  "fixture_or_fixture_policy",
]);

const STATUSES = new Set(["pass", "fail", "skipped_waiver", "skipped_missing_secret"]);

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

function isIsoDateTime(s) {
  if (typeof s !== "string") return false;
  const t = Date.parse(s);
  return Number.isFinite(t);
}

function main() {
  if (!fs.existsSync(artifactPath)) {
    fail(`missing ${path.relative(root, artifactPath)} — run npm run write:debugging-sweep-closure`);
  }
  let data;
  try {
    data = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
  } catch (e) {
    fail(`invalid JSON in closure artifact: ${e}`);
  }

  if (data.version !== 1) fail('closure.version must be 1');
  if (typeof data.repo_head !== "string" || !data.repo_head) fail("closure.repo_head must be a non-empty string");
  if (!isIsoDateTime(data.generated_at_utc)) fail("closure.generated_at_utc must be parseable ISO date-time");
  if (!Array.isArray(data.rows)) fail("closure.rows must be an array");

  const ids = new Set();
  for (let i = 0; i < data.rows.length; i++) {
    const row = data.rows[i];
    const p = `rows[${i}]`;
    if (!row || typeof row !== "object") fail(`${p}: must be object`);
    if (typeof row.id !== "string" || !row.id) fail(`${p}.id: required string`);
    if (ids.has(row.id)) fail(`duplicate row id: ${row.id}`);
    ids.add(row.id);
    if (!ROW_KINDS.has(row.kind)) fail(`${p}.kind: invalid kind ${row.kind}`);
    if (typeof row.command_or_workflow !== "string") fail(`${p}.command_or_workflow: must be string`);
    if (!STATUSES.has(row.status)) fail(`${p}.status: invalid ${row.status}`);
    if ("manifest_tier" in row && row.manifest_tier != null && typeof row.manifest_tier !== "string") {
      fail(`${p}.manifest_tier: must be string or null`);
    }
    if ("waiver_id" in row && row.waiver_id != null && typeof row.waiver_id !== "string") {
      fail(`${p}.waiver_id: must be string or null`);
    }
    if ("owner" in row && row.owner != null && typeof row.owner !== "string") fail(`${p}.owner: must be string or null`);
    if ("log_uri" in row && row.log_uri != null && typeof row.log_uri !== "string") fail(`${p}.log_uri: must be string or null`);
    if ("duration_ms" in row && row.duration_ms != null && (!Number.isInteger(row.duration_ms) || row.duration_ms < 0)) {
      fail(`${p}.duration_ms: must be non-negative integer or null`);
    }
    if ("notes" in row && row.notes != null && typeof row.notes !== "string") fail(`${p}.notes: must be string or null`);
    if (row.status === "skipped_waiver" && row.waiver_id == null) {
      fail(`${p}: skipped_waiver requires waiver_id`);
    }
    if (row.status === "skipped_missing_secret" && row.waiver_id == null) {
      fail(`${p}: skipped_missing_secret requires waiver_id or policy ref in waiver_id field`);
    }
  }

  const extraKeys = Object.keys(data).filter((k) => !["version", "repo_head", "generated_at_utc", "rows", "meta"].includes(k));
  if (extraKeys.length) fail(`unknown top-level keys: ${extraKeys.join(", ")}`);

  if (!fs.existsSync(schemaPath)) {
    fail(`missing schema ${path.relative(root, schemaPath)}`);
  }

  const pkgPath = path.join(root, "package.json");
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  const checkScripts = Object.keys(pkg.scripts || {}).filter((k) => k.startsWith("check:"));
  const rowIds = new Set(data.rows.map((r) => r.id));
  const missingLedger = [];
  for (const name of checkScripts) {
    const expectedId = `check-${name.replace(/:/g, "-")}`;
    if (!rowIds.has(expectedId)) missingLedger.push({ script: name, expectedId });
  }
  if (missingLedger.length) {
    fail(
      `check-script-registry-closure: ${missingLedger.length} check:* script(s) missing closure row id:\n${JSON.stringify(missingLedger.slice(0, 20), null, 2)}${missingLedger.length > 20 ? "\n…" : ""}`
    );
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        artifact: path.relative(root, artifactPath),
        schema: path.relative(root, schemaPath),
        rows: data.rows.length,
        checkScriptsLedgered: checkScripts.length,
      },
      null,
      2
    )
  );
}

main();
