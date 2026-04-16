import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveFeatureMappingForApiPath } from "@/lib/product-surface/v8-surface-mapping";

const NAV_SOURCES = [
  join(process.cwd(), "src/lib/navigation.ts"),
  join(process.cwd(), "src/lib/product-surface/resolver.ts"),
  join(process.cwd(), "src/lib/product-surface/cmdk-search-jumps.ts"),
];

describe("capability token routes stay out of primary nav / cmd-K builders (§17.3)", () => {
  it("does not embed external-actions API paths in nav / cmd-K sources", () => {
    for (const file of NAV_SOURCES) {
      const raw = readFileSync(file, "utf8");
      expect(raw.includes("/api/external-actions"), file).toBe(false);
    }
  });

  it("maps external-actions API family for session-governed create-link (§17.2 smoke)", () => {
    const m = resolveFeatureMappingForApiPath("/api/external-actions/create-link");
    expect(m.status).toBe("mapped");
    if (m.status === "mapped") expect(m.featureFamily).toBe("collaboration");
  });
});
