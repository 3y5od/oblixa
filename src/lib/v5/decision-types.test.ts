import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { DECISION_TYPES, mergeRequiredInputs } from "@/lib/v5/decision-types";

describe("decision_type DB alignment (046 migration)", () => {
  it("migration CHECK lists every DECISION_TYPES value", () => {
    const migrationPath = path.join(
      process.cwd(),
      "supabase/migrations/046_v5_decision_type_api_alignment.sql"
    );
    const sql = readFileSync(migrationPath, "utf8");
    for (const t of DECISION_TYPES) {
      expect(sql).toContain(`'${t}'`);
    }
  });
});

describe("mergeRequiredInputs", () => {
  it("merges patch over existing object", () => {
    expect(mergeRequiredInputs({ a: 1, b: 2 }, { b: 3, c: 4 })).toEqual({ a: 1, b: 3, c: 4 });
  });

  it("treats non-object existing as empty", () => {
    expect(mergeRequiredInputs(null, { x: true })).toEqual({ x: true });
  });
});
