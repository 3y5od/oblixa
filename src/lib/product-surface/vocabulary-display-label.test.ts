import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SETTINGS_MODULE_LABELS = join(
  process.cwd(),
  "src/lib/product-surface/workspace-settings-module-labels.ts"
);
const FEATURE_REGISTRY = join(process.cwd(), "src/lib/product-surface/feature-registry.ts");

describe("v7 vocabulary label consistency", () => {
  it("exports displayLabelForFeature from the feature registry", () => {
    const raw = readFileSync(FEATURE_REGISTRY, "utf8");
    expect(raw.includes("export function displayLabelForFeature")).toBe(true);
  });

  it("uses displayLabelForFeature for product settings module labels", () => {
    const raw = readFileSync(SETTINGS_MODULE_LABELS, "utf8");
    expect(raw.includes("displayLabelForFeature(\"decisions\")")).toBe(true);
    expect(raw.includes("displayLabelForFeature(\"findings\")")).toBe(true);
    expect(raw.includes("displayLabelForFeature(\"intake\")")).toBe(true);
  });
});
