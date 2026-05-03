import { describe, expect, it } from "vitest";
import { GET, HEAD } from "./route";

describe("/api/health", () => {
  it("returns a no-store public health document", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("x-oblixa-route-id")).toBe("/api/health");
    expect(res.headers.get("Cache-Control")).toContain("no-store");
    await expect(res.json()).resolves.toMatchObject({
      ok: true,
      route: "/api/health",
      status: "ok",
      runtime: "nodejs",
    });
  });

  it("supports HEAD without a body", async () => {
    const res = await HEAD();
    expect(res.status).toBe(200);
    expect(res.headers.get("x-oblixa-route-id")).toBe("/api/health");
    expect(await res.text()).toBe("");
  });
});
