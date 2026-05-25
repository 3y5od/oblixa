import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireV5ApiFeature } from "@/lib/decision-intelligence/feature-guards";

vi.mock("@/lib/decision-intelligence/feature-guards", () => ({
  requireV5ApiFeature: vi.fn(() => null),
}));

const mockedV5Guard = vi.mocked(requireV5ApiFeature);

async function loadRoute(segment: "preview" | "start" | "pause" | "resume" | "close") {
  switch (segment) {
    case "preview":
      return import("@/app/api/campaigns/[id]/preview/route");
    case "start":
      return import("@/app/api/campaigns/[id]/start/route");
    case "pause":
      return import("@/app/api/campaigns/[id]/pause/route");
    case "resume":
      return import("@/app/api/campaigns/[id]/resume/route");
    case "close":
      return import("@/app/api/campaigns/[id]/close/route");
    default:
      throw new Error("unknown segment");
  }
}

describe("POST /api/campaigns/[id]/* lifecycle (feature guard)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedV5Guard.mockReturnValue(null);
  });

  for (const segment of ["preview", "start", "pause", "resume", "close"] as const) {
    it(`returns 403 when portfolio campaigns flag is off (${segment})`, async () => {
      mockedV5Guard.mockReturnValueOnce(
        NextResponse.json({ error: "This feature is disabled for your workspace." }, { status: 403 })
      );
      const { POST } = await loadRoute(segment);
      const res = await POST(new Request(`http://localhost/api/campaigns/c1/${segment}`), {
        params: Promise.resolve({ id: "c1" }),
      });
      expect(res.status).toBe(403);
    });
  }
});
