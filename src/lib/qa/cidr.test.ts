import { describe, expect, it } from "vitest";
import { isPlausibleCidrLine } from "./cidr";

describe("cidr (admin allowlist hints)", () => {
  it("accepts common IPv4 CIDR and host forms", () => {
    expect(isPlausibleCidrLine("10.0.0.0/8")).toBe(true);
    expect(isPlausibleCidrLine("192.168.0.0/16")).toBe(true);
    expect(isPlausibleCidrLine("8.8.8.8")).toBe(true);
  });

  it("accepts a minimal IPv6 CIDR", () => {
    expect(isPlausibleCidrLine("2001:db8::/32")).toBe(true);
  });

  it("rejects obvious garbage", () => {
    expect(isPlausibleCidrLine("")).toBe(false);
    expect(isPlausibleCidrLine("   ")).toBe(false);
    expect(isPlausibleCidrLine("not-a-network")).toBe(false);
  });
});
