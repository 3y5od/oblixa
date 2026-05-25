import { describe, expect, it } from "vitest";
import { ROUTE_INVENTORY } from "@/lib/product-surface/route-inventory";
import { resolveFeatureMappingForPagePath } from "@/lib/product-surface/surface-mapping";

function concreteInventoryPath(pattern: string): string {
  return pattern
    .replace(/\[id\]/gi, "00000000-0000-0000-0000-000000000001")
    .replace(/\[key\]/gi, "sample-key");
}

describe("ROUTE_INVENTORY vs V8 page mapping (§21.2)", () => {
  it("every static inventory path resolves to mapped or exempt (not unmapped)", () => {
    for (const entry of ROUTE_INVENTORY) {
      if (entry.pattern.includes("[")) continue;
      const m = resolveFeatureMappingForPagePath(entry.pattern);
      expect(m.status, entry.pattern).not.toBe("unmapped");
    }
  });

  it("dynamic inventory patterns sample to a mapped or exempt path", () => {
    for (const entry of ROUTE_INVENTORY) {
      if (!entry.pattern.includes("[")) continue;
      const path = concreteInventoryPath(entry.pattern);
      const m = resolveFeatureMappingForPagePath(path);
      expect(m.status, path).not.toBe("unmapped");
    }
  });
});
