import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { metadata as homeMetadata } from "@/app/page";

describe("home metadata", () => {
  it("sets absolute title string for SERP/social", () => {
    expect(typeof homeMetadata.title).toBe("string");
    expect(homeMetadata.title).toContain("Oblixa");
    // Marketing pass: aligned to the release-state wedge, replacing the
    // contract-tracking spreadsheet.
    expect(homeMetadata.title).toContain("Replace your contract-tracking spreadsheet");
  });

  it("has canonical and openGraph url", () => {
    expect(homeMetadata.alternates?.canonical).toBe("/");
    expect(homeMetadata.openGraph?.url).toBe("/");
  });
});

describe("root layout metadata contract (source)", () => {
  it("defines metadataBase and title template for child routes", () => {
    const raw = fs.readFileSync(path.join(process.cwd(), "src", "app", "layout.tsx"), "utf8");
    expect(raw).toContain("metadataBase:");
    expect(raw).toMatch(/template:\s*["']%s — Oblixa["']/);
  });
});
