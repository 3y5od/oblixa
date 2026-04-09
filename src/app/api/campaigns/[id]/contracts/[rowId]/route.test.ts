import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireV5ApiFeature } from "@/lib/v5/feature-guards";

vi.mock("@/lib/v5/feature-guards", () => ({
  requireV5ApiFeature: vi.fn(() => null),
}));

const mockedV5Guard = vi.mocked(requireV5ApiFeature);

describe("PATCH /api/campaigns/[id]/contracts/[rowId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedV5Guard.mockReturnValue(null);
  });

  it("returns 403 when portfolio campaigns flag is off", async () => {
    mockedV5Guard.mockReturnValueOnce(
      NextResponse.json({ error: "This feature is disabled for your workspace." }, { status: 403 })
    );
    const { PATCH } = await import("@/app/api/campaigns/[id]/contracts/[rowId]/route");
    const res = await PATCH(
      new Request("http://localhost/api/campaigns/c1/contracts/r1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignedTeam: "ops" }),
      }),
      { params: Promise.resolve({ id: "c1", rowId: "r1" }) }
    );
    expect(res.status).toBe(403);
  });
});
