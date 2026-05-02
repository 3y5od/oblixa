import { afterEach, describe, expect, it, vi } from "vitest";

describe("DELETE /api/me/account", () => {
  const prev = process.env.OBLIXA_DSR_ACCOUNT_DELETE;

  afterEach(() => {
    if (prev === undefined) delete process.env.OBLIXA_DSR_ACCOUNT_DELETE;
    else process.env.OBLIXA_DSR_ACCOUNT_DELETE = prev;
  });

  it("returns 403 when account deletion API is not enabled", async () => {
    delete process.env.OBLIXA_DSR_ACCOUNT_DELETE;
    vi.resetModules();
    const { DELETE } = await import("./route");
    const res = await DELETE(new Request("http://127.0.0.1/api/me/account", { method: "DELETE" }));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body).toMatchObject({ error: "Account deletion API is not enabled" });
  });
});
