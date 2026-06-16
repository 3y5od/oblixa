import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const RENEWALS_PAGE = join(process.cwd(), "src/app/(dashboard)/contracts/renewals/page.tsx");
const EXCEPTIONS_PAGE = join(process.cwd(), "src/app/(dashboard)/contracts/exceptions/page.tsx");
const BULK_PAGE = join(process.cwd(), "src/app/(dashboard)/contracts/bulk/page.tsx");
const WORK_PAGE = join(process.cwd(), "src/app/(dashboard)/work/page.tsx");

describe("core CTA gating tripwire", () => {
  it("keeps decisions CTA on renewals behind visibility predicate", () => {
    const raw = [
      RENEWALS_PAGE,
      join(process.cwd(), "src/app/(dashboard)/contracts/renewals/renewals-page-view.tsx"),
    ]
      .map((file) => readFileSync(file, "utf8"))
      .join("\n");
    const idx = raw.indexOf('href="/decisions"');
    expect(idx).toBeGreaterThan(-1);
    const before = raw.slice(Math.max(0, idx - 500), idx);
    expect(before).toMatch(/showDecisionsCta \?\s*\(/);
  });

  it("keeps decisions CTA on exceptions behind visibility predicate", () => {
    const raw = [
      EXCEPTIONS_PAGE,
      join(process.cwd(), "src/app/(dashboard)/contracts/exceptions/exceptions-page-view.tsx"),
    ]
      .map((file) => readFileSync(file, "utf8"))
      .join("\n");
    const idx = raw.indexOf('href="/decisions"');
    expect(idx).toBeGreaterThan(-1);
    const before = raw.slice(Math.max(0, idx - 500), idx);
    // Accept inline, prop, and extracted helper forms where the decision link remains gated.
    expect(before).toMatch(/showDecisionsCta \?\s*\(/);
  });

  it("keeps campaign CTA off the Core import surface", () => {
    const raw = readFileSync(BULK_PAGE, "utf8");
    const idx = raw.indexOf('href="/campaigns"');
    expect(idx).toBe(-1);
    expect(raw).not.toContain("showCampaignCta");
  });

  it("keeps work-queue decisions CTA behind visibility predicate", () => {
    const raw = readFileSync(WORK_PAGE, "utf8");
    const idx = raw.indexOf('href="/decisions"');
    expect(idx).toBeGreaterThan(-1);
    const before = raw.slice(Math.max(0, idx - 500), idx);
    expect(before.includes("{showDecisionsCta ? (")).toBe(true);
  });
});
