import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("REQUIRED_V10_INDEXES in 057 migration", () => {
  it("declares every required index in supabase/migrations/057_v10_runtime_contracts.sql", async () => {
    const { REQUIRED_V10_INDEXES } = await import("../../scripts/lib/v10-required-indexes.mjs");
    const sql = readFileSync(
      join(process.cwd(), "supabase/migrations/057_v10_runtime_contracts.sql"),
      "utf8"
    );
    for (const indexName of REQUIRED_V10_INDEXES) {
      expect(sql.includes(indexName), `missing index declaration: ${indexName}`).toBe(true);
    }
  });
});
