import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = readFileSync(join(process.cwd(), "src/actions/policy-operations.ts"), "utf8");

describe("policy operations action scope", () => {
  it("returns an authentication failure before policy mutations without a user", () => {
    expect(SRC).toContain("supabase.auth.getUser()");
    expect(SRC).toContain('return { error: "Not authenticated" as const }');
  });

  it("keeps policy mutations scoped to the authenticated organization", () => {
    expect(SRC).toContain("getOrEnsureDeterministicMembership");
    expect(SRC).toContain("organization_id");
    expect(SRC).toContain("ensureProgramsSurfaceAccess(ctx)");
  });
});
