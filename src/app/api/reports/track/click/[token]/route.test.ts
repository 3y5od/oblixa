import { describe, expect, it } from "vitest";

describe("GET /api/reports/track/click/[token]", () => {
  it("redirects to dashboard fallback for invalid target", async () => {
    const { GET } = await import("@/app/api/reports/track/click/[token]/route");
    const req = new Request(
      "http://localhost:3000/api/reports/track/click/abc?target=not-a-url"
    );
    const res = await GET(req, { params: Promise.resolve({ token: "abc" }) });
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("http://localhost:3000/dashboard");
  });
});
