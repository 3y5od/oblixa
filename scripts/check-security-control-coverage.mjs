#!/usr/bin/env node
/**
 * Validates artifacts/security-control-coverage-matrix.rows.json:
 * - Every row has a non-empty aggregate of I_refs|T_refs|E_refs|M_refs
 * - N/A rows include n_a_rationale + n_a_reviewed_at
 * - SEC-STD-023 implies all SEC-NIST53-* families exist
 * - SEC-STD-021 implies SEC-LLM-001..010
 * (No markdown / Appendix file requirements.)
 */
import { existsSync, readFileSync } from "node:fs";
import path, { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const NIST53 = ["AC", "AU", "AT", "CA", "CM", "CP", "IA", "IR", "MA", "MP", "PE", "PL", "PM", "PS", "RA", "SA", "SC", "SI", "SR"];

function nonEmpty(s) {
  return typeof s === "string" && s.trim().length > 0;
}

function loadRows() {
  const p = join(root, "artifacts/security-control-coverage-matrix.rows.json");
  if (!existsSync(p)) {
    throw new Error(`Missing ${p}; run node scripts/build-security-control-coverage-matrix.mjs --write`);
  }
  const j = JSON.parse(readFileSync(p, "utf8"));
  const rows = j.rows;
  if (!Array.isArray(rows)) throw new Error("rows.json: expected top-level rows array");
  return rows;
}

export function validateSecurityControlCoverage() {
  const rows = loadRows();
  const byId = new Map(rows.map((r) => [r.sec_id, r]));
  const errors = [];

  for (const r of rows) {
    const agg =
      (nonEmpty(r.I_refs) ? 1 : 0) +
      (nonEmpty(r.T_refs) ? 1 : 0) +
      (nonEmpty(r.E_refs) ? 1 : 0) +
      (nonEmpty(r.M_refs) ? 1 : 0);
    if (agg === 0) errors.push(`${r.sec_id}: empty I_refs, T_refs, E_refs, M_refs aggregate`);
    if (nonEmpty(r.n_a_rationale) || nonEmpty(r.n_a_reviewed_at)) {
      if (!nonEmpty(r.n_a_rationale)) errors.push(`${r.sec_id}: n_a_reviewed_at set but n_a_rationale empty`);
      if (!nonEmpty(r.n_a_reviewed_at)) errors.push(`${r.sec_id}: n_a_rationale set but n_a_reviewed_at empty`);
    }
  }

  if (!byId.has("SEC-STD-023")) errors.push("Missing SEC-STD-023 row");
  else {
    for (const fam of NIST53) {
      const id = `SEC-NIST53-${fam}`;
      if (!byId.has(id)) errors.push(`SEC-STD-023 requires child row ${id}`);
    }
  }

  if (!byId.has("SEC-STD-021")) errors.push("Missing SEC-STD-021 row");
  else {
    for (let i = 1; i <= 10; i++) {
      const id = `SEC-LLM-${String(i).padStart(3, "0")}`;
      if (!byId.has(id)) errors.push(`SEC-STD-021 requires child row ${id} (or SEC-LLM-INDEX merge — not present)`);
    }
  }

  if (!byId.has("SEC-STD-026")) errors.push("Missing SEC-STD-026 row");

  const routePath = join(root, "artifacts/security-route-matrix.json");
  if (existsSync(routePath)) {
    const raw = JSON.parse(readFileSync(routePath, "utf8"));
    const list = Array.isArray(raw) ? raw : raw.routes;
    if (Array.isArray(list) && list.length > 0) {
      for (let i = 0; i < list.length; i++) {
        const e = list[i];
        const ids = e.sec_ids ?? e.secIds;
        if (!Array.isArray(ids) || ids.length === 0) {
          errors.push(`artifacts/security-route-matrix.json entry[${i}] missing non-empty sec_ids`);
        }
      }
    }
  }

  if (errors.length) {
    throw new Error("check-security-control-coverage failed:\n- " + errors.join("\n- "));
  }
  return { ok: true, rowCount: rows.length };
}

function main() {
  const r = validateSecurityControlCoverage();
  console.log(`OK: ${r.rowCount} SEC rows validated`);
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  try {
    main();
  } catch (e) {
    console.error(e.message || e);
    process.exit(1);
  }
}
