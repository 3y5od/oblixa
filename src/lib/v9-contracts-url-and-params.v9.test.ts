/**
 * V9 §9.3 + §24.4 — contracts list URL state: safe parsing + stable redirect param order.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("contracts page URL params (V9)", () => {
  it("falls back invalid page numbers to page 1", () => {
    const page = readFileSync(join(process.cwd(), "src/app/(dashboard)/contracts/page.tsx"), "utf8");
    expect(page).toContain("const parsedPage = parseInt(searchParams.page ?? \"1\", 10)");
    expect(page).toContain("const page =");
    expect(page).toMatch(/Number\.isFinite\(parsedPage\).*parsedPage > 0 \? parsedPage : 1/);
  });

  it("uses parseContractListSort so invalid sort falls back to activity", () => {
    const page = readFileSync(join(process.cwd(), "src/app/(dashboard)/contracts/page.tsx"), "utf8");
    expect(page).toContain("parseContractListSort");
  });

  it("builds out-of-range pagination redirects with deterministic URLSearchParams set order", () => {
    const page = readFileSync(join(process.cwd(), "src/app/(dashboard)/contracts/page.tsx"), "utf8");
    const idx = page.indexOf("if (page > listTotalPages && contractTotal > 0)");
    expect(idx).toBeGreaterThan(-1);
    const slice = page.slice(idx, idx + 900);
    expect(slice).toContain("buildContractsListHref");
    expect(slice).toContain("page: String(listTotalPages)");
    expect(slice).toContain("search: searchParams.search");
    expect(slice).toContain("evidence: searchParams.evidence");
  });
});
