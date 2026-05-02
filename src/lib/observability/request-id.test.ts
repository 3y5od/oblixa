import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { resolveCorrelationIds } from "./request-id";

describe("resolveCorrelationIds", () => {
  it("reuses incoming headers when present", () => {
    const req = new NextRequest("http://localhost/", {
      headers: { "x-request-id": "rid-1", "x-correlation-id": "cid-2" },
    });
    expect(resolveCorrelationIds(req)).toEqual({ requestId: "rid-1", correlationId: "cid-2" });
  });

  it("falls back correlation to request id when only request id is set", () => {
    const req = new NextRequest("http://localhost/", {
      headers: { "x-request-id": "rid-only" },
    });
    expect(resolveCorrelationIds(req)).toEqual({ requestId: "rid-only", correlationId: "rid-only" });
  });
});
