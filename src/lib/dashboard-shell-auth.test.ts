import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * §5.3 + Appendix AB — dashboard shell uses concrete Supabase session + route eligibility
 * (no unauthenticated data shell for protected segments).
 */
describe("V9 dashboard shell auth wiring", () => {
  it("anchors (dashboard)/layout.tsx session + route guard", () => {
    const raw = readFileSync(join(process.cwd(), "src/app/(dashboard)/layout.tsx"), "utf8");
    expect(raw).toContain("getAuthContext");
    expect(raw).toContain("assertPagePathEligibleForContextOrNotFound");
    expect(raw).toContain("OBLIXA_PATHNAME_HEADER");
  });

  it("documents absence of root middleware.ts (Next middleware optional)", () => {
    const atRoot = existsSync(join(process.cwd(), "middleware.ts"));
    const atSrc = existsSync(join(process.cwd(), "src/middleware.ts"));
    expect(atRoot || atSrc).toBe(false);
  });
});
