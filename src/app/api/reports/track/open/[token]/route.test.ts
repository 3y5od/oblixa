import { describe, expect, it } from "vitest";

describe("GET /api/reports/track/open/[token]", () => {
  it("returns tracking pixel even for short token", async () => {
    const { GET } = await import("@/app/api/reports/track/open/[token]/route");
    const req = new Request("http://localhost:3000/api/reports/track/open/abc");
    const res = await GET(req, { params: Promise.resolve({ token: "abc" }) });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("image/gif");
  });
});
