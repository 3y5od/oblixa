import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("V9 migrations folder", () => {
  it("retains migration history for rollout/backfill discipline", () => {
    const dir = join(process.cwd(), "supabase", "migrations");
    const files = readdirSync(dir).filter((f) => f.endsWith(".sql"));
    expect(files.length).toBeGreaterThan(0);
  });

  it("050_v9_status_foundations defines export job columns used by UI/API", () => {
    const sql = readFileSync(
      join(process.cwd(), "supabase/migrations/050_v9_status_foundations.sql"),
      "utf8"
    );
    expect(sql).toContain("contract_export_jobs");
    expect(sql).toContain("exported_rows");
    expect(sql).toContain("contract_import_jobs");
    expect(sql).toContain("failure_reason");
  });
});
