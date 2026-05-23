import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Migration 050 columns — server reads/writes must not be migration-only (plan §17.5 / §19.3).
 */
describe("V9 migration 050 import/export job fields in product paths", () => {
  it("health diagnostics selects import job recovery + completion columns", () => {
    const src = readFileSync(join(process.cwd(), "src/app/(dashboard)/settings/health/page.tsx"), "utf8");
    expect(src).toContain('.from("contract_import_jobs")');
    expect(src).toContain("failure_reason");
    expect(src).toContain("completed_at");
    expect(src).toContain("retry_of_job_id");
    expect(src).toContain("superseded_by_job_id");
    expect(src).toContain('.from("contract_export_jobs")');
    expect(src).toContain("truncated");
    expect(src).toContain("error_message");
    expect(src).toContain("completed_at");
  });

  it("import job library queries 050-aware columns for history and retry lineage", () => {
    const src = readFileSync(join(process.cwd(), "src/lib/import-jobs.ts"), "utf8");
    expect(src).toContain('.from("contract_import_jobs")');
    expect(src).toContain("failure_reason");
    expect(src).toContain("retry_of_job_id");
    expect(src).toContain("superseded_by_job_id");
    expect(src).toContain("completed_at");
  });

  it("export API persists export job scope, partial status, and truncation flags", () => {
    const src = readFileSync(join(process.cwd(), "src/lib/export/contracts-csv.ts"), "utf8");
    expect(src).toContain('.from("contract_export_jobs")');
    expect(src).toContain("truncated");
    expect(src).toMatch(/status[^\n]*partial|["']partial["']/);
    expect(src).toContain("completed_at");
    expect(src).toContain("error_message");
  });
});
