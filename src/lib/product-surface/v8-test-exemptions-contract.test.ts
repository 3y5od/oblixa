import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

type GovernedActionTestExemption = {
  kind: "governed_action_test";
  module: string;
  reason: string;
  owner: string;
  expiresOn?: string;
  bundledTestFiles?: string[];
};

function loadRows(): unknown {
  const p = path.join(process.cwd(), "src/lib/product-surface/v8-test-exemptions.json");
  return JSON.parse(readFileSync(p, "utf8"));
}

describe("v8 test exemption registry (§22.3)", () => {
  it("is a narrow, machine-readable array", () => {
    const raw = loadRows();
    expect(Array.isArray(raw)).toBe(true);
  });

  it("enforces required fields and resolvable file pointers", () => {
    const rows = loadRows() as GovernedActionTestExemption[];
    for (const row of rows) {
      expect(row.kind).toBe("governed_action_test");
      expect(typeof row.module).toBe("string");
      expect(row.module.startsWith("src/actions/")).toBe(true);
      expect(row.module.endsWith(".ts")).toBe(true);
      expect(row.reason.trim().length).toBeGreaterThan(0);
      expect(row.owner.trim().length).toBeGreaterThan(0);
      expect(typeof row.expiresOn).toBe("string");
      expect(/\d{4}-\d{2}-\d{2}/.test(row.expiresOn as string)).toBe(true);
      const parsed = Date.parse(row.expiresOn as string);
      expect(Number.isNaN(parsed)).toBe(false);
      expect(existsSync(path.join(process.cwd(), row.module)), `missing module ${row.module}`).toBe(true);

      for (const file of row.bundledTestFiles ?? []) {
        expect(file.endsWith(".test.ts") || file.endsWith(".spec.ts")).toBe(true);
        expect(existsSync(path.join(process.cwd(), file)), `missing bundled test ${file}`).toBe(true);
      }
    }
  });
});

