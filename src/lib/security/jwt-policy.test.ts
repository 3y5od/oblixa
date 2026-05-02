import { describe, expect, it } from "vitest";
import { CUSTOM_JWT_VERIFY_NOT_USED } from "@/lib/security/jwt-policy";

describe("jwt-policy", () => {
  it("documents no custom JWT verification stack", () => {
    expect(CUSTOM_JWT_VERIFY_NOT_USED).toBe(true);
  });
});
