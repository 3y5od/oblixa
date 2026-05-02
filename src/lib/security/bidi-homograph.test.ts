import { describe, expect, it } from "vitest";
import { hasConfusableMixedScript, isPunycodeInternationalizedDomain } from "@/lib/security/bidi-homograph";

describe("bidi-homograph", () => {
  it("flags Latin + Cyrillic in one string", () => {
    expect(hasConfusableMixedScript("paypal")).toBe(false);
    expect(hasConfusableMixedScript("раypal")).toBe(true);
  });

  it("detects punycode IDN host segments", () => {
    expect(isPunycodeInternationalizedDomain("example.com")).toBe(false);
    expect(isPunycodeInternationalizedDomain("xn--e1afmkfd.xn--p1ai")).toBe(true);
  });
});
