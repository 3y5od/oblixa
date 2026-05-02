import { describe, expect, it } from "vitest";
import { getTrustedPublicOriginFromRequest } from "@/lib/security/trusted-forwarded";

describe("trusted-forwarded", () => {
  it("prefers x-forwarded-proto and x-forwarded-host when present", () => {
    const req = new Request("http://internal/app/callback", {
      headers: {
        "x-forwarded-proto": "https",
        "x-forwarded-host": "app.example.com",
      },
    });
    expect(getTrustedPublicOriginFromRequest(req)).toBe("https://app.example.com");
  });

  it("falls back to request URL when forwards absent", () => {
    const req = new Request("https://oblixa.test/login");
    expect(getTrustedPublicOriginFromRequest(req)).toBe("https://oblixa.test");
  });
});
