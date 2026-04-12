import { describe, expect, it } from "vitest";
import { stripPrototypePollutionKeys } from "./strip-prototype-pollution";

describe("stripPrototypePollutionKeys", () => {
  it("removes constructor and prototype keys from a shallow copy", () => {
    const raw: Record<string, unknown> = { a: 1 };
    raw["constructor"] = { nested: true };
    raw["prototype"] = {};
    const cleaned = stripPrototypePollutionKeys(raw);
    expect(cleaned).toEqual({ a: 1 });
  });
});
