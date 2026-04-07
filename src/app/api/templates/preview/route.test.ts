import { describe, expect, it } from "vitest";

describe("GET /api/templates/preview", () => {
  it("returns 400 for invalid contractId", async () => {
    const { GET } = await import("@/app/api/templates/preview/route");
    const req = new Request("http://localhost:3000/api/templates/preview?contractId=bad-id");
    const res = await GET(req);
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body).toEqual({ error: "Invalid contractId" });
  });
});

