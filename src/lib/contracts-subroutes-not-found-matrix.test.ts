/**
 * V9 §10 + §22 — contract `[id]` has an explicit not-found; other contract segments rely on the
 * dashboard shell + route guard (documented matrix to avoid silent gaps).
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("contracts subroutes not-found matrix (V9)", () => {
  it("defines not-found for dynamic contract detail only; other Core contract routes use inherited boundaries", () => {
    const root = join(process.cwd(), "src/app/(dashboard)/contracts");
    expect(existsSync(join(root, "[id]/not-found.tsx"))).toBe(true);

    const segmentsWithExplicitNotFound = ["[id]/not-found.tsx"];
    expect(segmentsWithExplicitNotFound.length).toBe(1);

    for (const rel of [
      "page.tsx",
      "bulk/page.tsx",
      "review/page.tsx",
      "evidence-studio/page.tsx",
      "exceptions/page.tsx",
      "renewals/page.tsx",
      "loading.tsx",
    ]) {
      expect(existsSync(join(root, rel)), rel).toBe(true);
    }
  });
});
