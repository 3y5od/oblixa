import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("V9 settings health/product/operations (§3 + §27 anchors)", () => {
  it("retains settings trio pages", () => {
    for (const p of [
      "src/app/(dashboard)/settings/health/page.tsx",
      "src/app/(dashboard)/settings/product/page.tsx",
      "src/app/(dashboard)/settings/operations/page.tsx",
    ]) {
      expect(existsSync(join(process.cwd(), p)), p).toBe(true);
    }
  });

  it("health control room still samples import/export job tables for §27 diagnostics", () => {
    const health = readFileSync(join(process.cwd(), "src/app/(dashboard)/settings/health/page.tsx"), "utf8");
    expect(health.length).toBeGreaterThan(2000);
    expect(health).toContain('.from("contract_import_jobs")');
    expect(health).toContain('.from("contract_export_jobs")');
  });
});
