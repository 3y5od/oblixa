import { describe, expect, it, vi } from "vitest";
import { recordPublicTokenMiss } from "@/lib/security/public-token-telemetry";

describe("public-token-telemetry", () => {
  it("logs token misses without raw bearer token material", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    recordPublicTokenMiss({
      surface: "external_action",
      route: "/api/external-actions/[token]/status",
      tokenKey: "public-token-key:abcdef",
      ip: "198.51.100.10",
      reason: "not_found",
    });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("[security-event:public-token-miss]"));
    expect(warn.mock.calls[0]?.[0]).toContain("public-token-key:abcdef");
    expect(warn.mock.calls[0]?.[0]).not.toContain("tok_live_raw_secret");
    warn.mockRestore();
  });
});
