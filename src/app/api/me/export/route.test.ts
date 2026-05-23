import { afterEach, describe, expect, it, vi } from "vitest";

describe("GET /api/me/export", () => {
  const prev = process.env.OBLIXA_DSR_SELF_EXPORT;

  afterEach(() => {
    if (prev === undefined) delete process.env.OBLIXA_DSR_SELF_EXPORT;
    else process.env.OBLIXA_DSR_SELF_EXPORT = prev;
  });

  it("returns 403 when self-service export is disabled", async () => {
    process.env.OBLIXA_DSR_SELF_EXPORT = "0";
    vi.resetModules();
    const { GET } = await import("./route");
    const res = await GET(new Request("http://127.0.0.1/api/me/export"));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body).toMatchObject({ error: "Forbidden", code: "forbidden" });
  });
});
