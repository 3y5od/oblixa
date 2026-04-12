import { describe, expect, it, vi } from "vitest";

vi.mock("next/og", () => ({
  ImageResponse: class MockImageResponse {
    constructor() {}
  },
}));

describe("opengraph-image exports", () => {
  it("exposes dimensions and default handler", async () => {
    const mod = await import("@/app/opengraph-image");
    expect(mod.size).toEqual({ width: 1200, height: 630 });
    expect(mod.contentType).toBe("image/png");
    expect(typeof mod.default).toBe("function");
  });
});
