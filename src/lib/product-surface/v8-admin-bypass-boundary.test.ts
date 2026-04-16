import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("admin route bypass boundary (§10.4)", () => {
  it("does not reference roleMayBypassProductRoute in API or server-action guards", () => {
    const api = readFileSync(
      join(process.cwd(), "src/lib/product-surface/api-workspace-guard.ts"),
      "utf8"
    );
    const sa = readFileSync(
      join(process.cwd(), "src/lib/product-surface/server-action-guard.ts"),
      "utf8"
    );
    expect(api.includes("roleMayBypassProductRoute")).toBe(false);
    expect(sa.includes("roleMayBypassProductRoute")).toBe(false);
  });
});
