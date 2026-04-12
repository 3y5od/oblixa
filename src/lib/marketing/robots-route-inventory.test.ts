import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ROUTE_INVENTORY } from "@/lib/product-surface/route-inventory";

/** Top-level path segments under `(dashboard)` that crawlers must not index as public content. */
function inventoryRootSegments(): Set<string> {
  const out = new Set<string>();
  for (const entry of ROUTE_INVENTORY) {
    const parts = entry.pattern.split("/").filter(Boolean);
    const first = parts[0];
    if (first) out.add(first);
  }
  return out;
}

describe("robots.txt vs route inventory (V7 §AP)", () => {
  it("disallows every dashboard route-inventory root segment", () => {
    const raw = readFileSync(join(process.cwd(), "src/app/robots.ts"), "utf8");
    const segments = inventoryRootSegments();
    for (const seg of segments) {
      expect(raw, `missing disallow for /${seg}/`).toContain(`"/${seg}/"`);
    }
    expect(raw).toContain('"/api/"');
  });
});
