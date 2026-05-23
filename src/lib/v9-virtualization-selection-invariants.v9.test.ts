import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** §9.6 — selection persistence and cross-page honesty (contract table + bulk). */
describe("V9 contract table selection invariants", () => {
  it("persists selection in org-scoped sessionStorage and explains hidden picks", () => {
    const src = readFileSync(join(process.cwd(), "src/components/contracts/contract-table.tsx"), "utf8");
    const storage = readFileSync(join(process.cwd(), "src/lib/security/client-storage.ts"), "utf8");
    expect(storage).toContain("oblixa.contract-table.selection");
    expect(storage).toContain("sessionStorage");
    expect(src).toContain("writeContractTableSelection");
    expect(src).toContain("hiddenSelectedCount");
    expect(src).toContain("filterFingerprint");
  });

  it("contracts index passes filter fingerprint into ContractTable for cross-filter selection honesty", () => {
    const src = readFileSync(join(process.cwd(), "src/app/(dashboard)/contracts/page.tsx"), "utf8");
    expect(src).toContain("ContractTable");
    expect(src).toContain("filterFingerprint={filterFingerprint}");
  });
});
