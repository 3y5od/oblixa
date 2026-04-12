import { describe, expect, it } from "vitest";

describe("GET /api/auth/post-sign-out", () => {
  it("redirects to login with Clear-Site-Data", async () => {
    const { GET } = await import("./route");
    const res = await GET(new Request("https://app.example.com/api/auth/post-sign-out"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("https://app.example.com/login");
    expect(res.headers.get("clear-site-data")).toBe('"cache", "cookies"');
  });
});
