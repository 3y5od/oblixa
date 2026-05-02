import { describe, expect, it } from "vitest";

/** Minimal host→tenant fixture table for custom-domain edge cases (Phase 63). */
const TABLE: Record<string, string> = {
  "app.acme.test": "org_acme",
  "oblixa.invalid": "default",
};

export function resolveTenantFromHost(host: string | null): string | null {
  if (!host) return null;
  const h = host.split(":")[0].toLowerCase();
  return TABLE[h] ?? null;
}

describe("tenant custom domain host resolution", () => {
  it("maps known hosts", () => {
    expect(resolveTenantFromHost("app.acme.test")).toBe("org_acme");
    expect(resolveTenantFromHost("unknown.example")).toBeNull();
  });
});
