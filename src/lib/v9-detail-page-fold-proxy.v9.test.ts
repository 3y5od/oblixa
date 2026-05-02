import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const detailPagePath = join(process.cwd(), "src/app/(dashboard)/contracts/[id]/page.tsx");

describe("V9 §10.2 contract detail above-the-fold proxy", () => {
  it("detail page module references identity, owner, dates, status, and actions", () => {
    const page = readFileSync(detailPagePath, "utf8").toLowerCase();
    expect(page).toMatch(/title|identity/);
    expect(page).toMatch(/owner/);
    expect(page).toMatch(/date|deadline|renewal/);
    expect(page).toMatch(/status/);
    expect(page).toMatch(/exception|blocker/);
    expect(page).toMatch(/href|link|button/);
  });
});

describe("V9 §10.3 overview reading order — extraction before review fields", () => {
  it("renders ExtractionJobAlert before FieldReview in the extracted-fields card (§10.6 freshness cue)", () => {
    const raw = readFileSync(detailPagePath, "utf8");
    const firstAlert = raw.indexOf("<ExtractionJobAlert");
    const firstReview = raw.indexOf("<FieldReview");
    expect(firstAlert).toBeGreaterThan(-1);
    expect(firstReview).toBeGreaterThan(-1);
    expect(firstAlert).toBeLessThan(firstReview);
  });

  it("keeps hero metrics before tabbed body so summary stays above the fold", () => {
    const raw = readFileSync(detailPagePath, "utf8");
    const hero = raw.indexOf("<ContractHeroMetrics");
    // Anchor the primary tab strip in JSX (not tab metadata declared earlier in the module).
    const tabs = raw.indexOf("{primaryTabGroups.map");
    expect(hero).toBeGreaterThan(-1);
    expect(tabs).toBeGreaterThan(-1);
    expect(hero).toBeLessThan(tabs);
  });
});

describe("V9 §10.4–10.5 actions + mode containment hooks", () => {
  it("gates advanced surfaces with evaluateFeatureEligibility + product surface context", () => {
    const raw = readFileSync(detailPagePath, "utf8");
    expect(raw).toContain("evaluateFeatureEligibility");
    expect(raw).toContain("loadProductSurfaceContext");
  });
});
