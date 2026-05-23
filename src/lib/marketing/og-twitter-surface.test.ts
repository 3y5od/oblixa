import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("OG / Twitter preview surfaces (V7)", () => {
  it("reuses opengraph-image from twitter-image entrypoint", () => {
    const tw = readFileSync(join(process.cwd(), "src/app/twitter-image.tsx"), "utf8");
    expect(tw).toContain("opengraph-image");
  });

  it("keeps neutral Oblixa framing without Advanced/Assurance product names in OG image copy", () => {
    const og = readFileSync(join(process.cwd(), "src/app/opengraph-image.tsx"), "utf8");
    expect(og).toContain("Oblixa");
    // v1 marketing pass: aligned to release-state wedge ("Replace the
    // contract tracking spreadsheet"). Headline leads with the operational
    // verb instead of the legacy "Contract execution" framing.
    expect(og).toContain("Track renewals, obligations, and owners from signed contracts");
    expect(og.toLowerCase()).not.toContain("decisions");
    expect(og.toLowerCase()).not.toContain("campaigns");
    expect(og.toLowerCase()).not.toContain("assurance");
  });
});
