import { describe, expect, it } from "vitest";
import { parseBearerToken, secureCompareUtf8 } from "@/lib/security/secret-compare";

describe("secureCompareUtf8", () => {
  it("returns true for equal strings", () => {
    expect(secureCompareUtf8("a", "a")).toBe(true);
  });

  it("returns false for different strings", () => {
    expect(secureCompareUtf8("a", "b")).toBe(false);
  });

  it("compares different lengths without throwing", () => {
    expect(secureCompareUtf8("short", "much-longer-secret-value")).toBe(false);
  });

  it("uses digest-length timingSafeEqual semantics for bearer secrets", () => {
    expect(secureCompareUtf8("Bearer secret-a", "Bearer secret-b")).toBe(false);
    expect(secureCompareUtf8("same-token", "same-token")).toBe(true);
  });
});

describe("parseBearerToken", () => {
  it("parses Bearer header", () => {
    expect(parseBearerToken("Bearer abc.def.ghi")).toBe("abc.def.ghi");
  });

  it("returns null for missing or invalid", () => {
    expect(parseBearerToken(null)).toBeNull();
    expect(parseBearerToken("Basic x")).toBeNull();
  });

  it("accepts Bearer prefix case-insensitively and trims token", () => {
    expect(parseBearerToken("bearer  abc")).toBe("abc");
    expect(parseBearerToken("Bearer   spaced-secret ")).toBe("spaced-secret");
  });
});
