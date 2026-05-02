import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";

describe("B2B / SCIM artifact contracts", () => {
  it("b2b-idp-contract.json parses with expected top-level keys", () => {
    const p = path.join(process.cwd(), "artifacts", "b2b-idp-contract.json");
    const raw = fs.readFileSync(p, "utf8");
    const j = JSON.parse(raw) as Record<string, unknown>;
    expect(typeof j).toBe("object");
    expect(Object.keys(j).length).toBeGreaterThan(0);
    expect(["absent", "planned", "active"]).toContain(j.surface);
    expect(Object.prototype.hasOwnProperty.call(j, "saml")).toBe(true);
    expect(Object.prototype.hasOwnProperty.call(j, "oidc")).toBe(true);
  });

  it("scim-oidc-contract.json parses", () => {
    const p = path.join(process.cwd(), "artifacts", "scim-oidc-contract.json");
    const raw = fs.readFileSync(p, "utf8");
    const j = JSON.parse(raw) as Record<string, unknown>;
    expect(j).toBeTruthy();
    expect(typeof j).toBe("object");
  });
});
