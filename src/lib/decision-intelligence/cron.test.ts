import { describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { cronErrorResponse, listOrganizationIds, requireV5CronAuth } from "./cron";

vi.mock("@/lib/contract-operations/cron", () => ({
  ensureCronAuthorized: vi.fn((request: Request) => {
    if (request.headers.get("x-cron-secret") !== "ok") {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    return null;
  }),
}));

describe("v5/cron helpers", () => {
  it("requireV5CronAuth delegates to ensureCronAuthorized", () => {
    const ok = new Request("https://example.com/api/cron/x", {
      headers: { "x-cron-secret": "ok" },
    });
    expect(requireV5CronAuth(ok)).toBeNull();

    const bad = new Request("https://example.com/api/cron/x");
    const res = requireV5CronAuth(bad);
    expect(res).toBeInstanceOf(NextResponse);
  });

  it("listOrganizationIds maps organization rows", async () => {
    const range = vi
      .fn()
      .mockResolvedValueOnce({
        data: [{ id: "org-1" }, { id: "org-2" }],
      })
      .mockResolvedValueOnce({
        data: [],
      });
    const admin = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          order: vi.fn(() => ({
            range,
          })),
        })),
      })),
    };
    const ids = await listOrganizationIds(admin as never);
    expect(ids).toEqual(["org-1", "org-2"]);
  });

  it("cronErrorResponse returns JSON NextResponse", async () => {
    const res = cronErrorResponse("bad", 429);
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ error: "bad" });
  });
});
