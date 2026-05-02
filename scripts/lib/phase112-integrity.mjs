/**
 * Phase112 — canonical coverage ledger section order vs manifest (no plan file edits).
 */
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

const root = process.cwd();

export function loadLedgerSectionIds() {
  const p = path.join(root, "config", "security-coverage-ledger.json");
  const ledger = JSON.parse(fs.readFileSync(p, "utf8"));
  if (!Array.isArray(ledger.sections)) throw new Error("ledger.sections must be an array");
  return {
    version: String(ledger.version ?? ""),
    ids: ledger.sections.map((s) => {
      if (!s || typeof s.id !== "string" || !s.id.trim()) throw new Error("ledger section missing id");
      return s.id;
    }),
  };
}

export function validatePhase112Integrity() {
  const manifestPath = path.join(root, "config", "phase112-integrity-manifest.json");
  if (!fs.existsSync(manifestPath)) {
    return { id: "phase112-plan-integrity", ok: false, detail: "Missing config/phase112-integrity-manifest.json" };
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const { version, ids } = loadLedgerSectionIds();
  if (manifest.expectedLedgerVersion !== version) {
    return {
      id: "phase112-plan-integrity",
      ok: false,
      detail: `Ledger version mismatch: manifest expects ${manifest.expectedLedgerVersion}, ledger has ${version}`,
    };
  }
  const expected = manifest.sectionIdsOrdered;
  if (!Array.isArray(expected)) {
    return { id: "phase112-plan-integrity", ok: false, detail: "manifest.sectionIdsOrdered must be an array" };
  }
  if (expected.length !== ids.length) {
    return {
      id: "phase112-plan-integrity",
      ok: false,
      detail: `Section count mismatch: manifest ${expected.length} vs ledger ${ids.length}`,
    };
  }
  for (let i = 0; i < ids.length; i++) {
    if (expected[i] !== ids[i]) {
      return {
        id: "phase112-plan-integrity",
        ok: false,
        detail: `Section id mismatch at index ${i}: manifest "${expected[i]}" vs ledger "${ids[i]}"`,
      };
    }
  }
  const ledgerPath = path.join(root, "config", "security-coverage-ledger.json");
  const sha = createHash("sha256").update(fs.readFileSync(ledgerPath)).digest("hex");
  const detail = `ledger sections=${ids.length} sha256=${sha.slice(0, 16)}…`;
  return { id: "phase112-plan-integrity", ok: true, detail };
}
