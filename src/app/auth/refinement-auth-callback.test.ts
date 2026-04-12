import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** docs/refinement.md §13.1 — invite/signup path should provision org via ensureUserOrg (Core defaults). */
describe("auth callback org provisioning", () => {
  it("calls ensureUserOrg for new memberships", () => {
    const raw = readFileSync(join(process.cwd(), "src/app/auth/callback/route.ts"), "utf8");
    expect(raw.includes("ensureUserOrg")).toBe(true);
  });
});
