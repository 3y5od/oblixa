import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = readFileSync(join(process.cwd(), "src/actions/notifications.ts"), "utf8");

describe("notification settings action scope", () => {
  it("requires authentication before updating notification policy", () => {
    expect(SRC).toContain("supabase.auth.getUser()");
    expect(SRC).toContain('return { error: "Not authenticated" }');
  });

  it("scopes writes to the actor membership organization", () => {
    expect(SRC).toContain("organization_members");
    expect(SRC).toContain("organization_id");
    expect(SRC).toContain("membership.organization_id");
  });
});
