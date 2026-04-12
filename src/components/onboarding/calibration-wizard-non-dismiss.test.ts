import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const WIZARD = join(process.cwd(), "src/components/onboarding/calibration-wizard.tsx");

describe("calibration wizard — non-dismissible blocking flow (§4.1)", () => {
  it("does not register a document-level Escape handler to dismiss the questionnaire", () => {
    const raw = readFileSync(WIZARD, "utf8");
    expect(raw.includes("Escape")).toBe(false);
    expect(raw.includes("keydown")).toBe(false);
  });
});
