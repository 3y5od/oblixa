import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = readFileSync(join(process.cwd(), "src/actions/email-verification.ts"), "utf8");

describe("resendEmailVerification action contract", () => {
  it("returns Not authenticated before sending verification email without a user", () => {
    expect(SRC).toContain("supabase.auth.getUser()");
    expect(SRC).toContain('return { error: "Not authenticated" }');
  });

  it("keeps audit emission org scope best-effort and only writes with ctx.orgId", () => {
    expect(SRC).toContain("getAuthContext");
    expect(SRC).toContain("if (ctx?.orgId)");
    expect(SRC).toContain("organizationId: ctx.orgId");
  });
});
