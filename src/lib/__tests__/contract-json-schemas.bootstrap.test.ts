import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function assertJsonShape(label: string, raw: string, keys: string[]) {
  const o = JSON.parse(raw) as Record<string, unknown>;
  for (const k of keys) {
    expect(o, `${label} missing ${k}`).toHaveProperty(k);
  }
}

describe("committed contract JSON (Phases 42, 67, 68, 85)", () => {
  it("scim-oidc-contract.json is object with surface", () => {
    const p = join(process.cwd(), "artifacts", "scim-oidc-contract.json");
    assertJsonShape("scim", readFileSync(p, "utf8"), ["surface"]);
  });

  it("warehouse-export-contract.json lists columns array", () => {
    const p = join(process.cwd(), "artifacts", "warehouse-export-contract.json");
    assertJsonShape("warehouse", readFileSync(p, "utf8"), ["columns", "piiFlags"]);
  });

  it("outbox-event-schemas.json lists eventTypes", () => {
    const p = join(process.cwd(), "artifacts", "outbox-event-schemas.json");
    assertJsonShape("outbox", readFileSync(p, "utf8"), ["eventTypes"]);
  });

  it("kyb-beneficial-owner-schema.json parses as JSON Schema", () => {
    const p = join(process.cwd(), "artifacts", "kyb-beneficial-owner-schema.json");
    const o = JSON.parse(readFileSync(p, "utf8")) as { type?: string };
    expect(o.type).toBe("object");
  });
});
