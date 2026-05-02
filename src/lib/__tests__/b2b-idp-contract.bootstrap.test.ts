import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("B2B IdP contract (Phase 51)", () => {
  it("parses absent surface manifest", () => {
    const o = JSON.parse(readFileSync(join(process.cwd(), "artifacts", "b2b-idp-contract.json"), "utf8")) as {
      surface?: string;
    };
    expect(o.surface).toBe("absent");
  });
});
