import { describe, expect, it } from "vitest";
import { jsonProblem, jsonRateLimited, jsonUnauthorized } from "./problem";

describe("http problem helpers", () => {
  it("adds private no-store headers to problem responses", () => {
    const res = jsonProblem(500, {
      error: "Unexpected server error",
      code: "unexpected_server_error",
      diagnostic_id: "route_unhandled_error",
      route: "/api/example",
    });

    expect(res.status).toBe(500);
    expect(res.headers.get("Cache-Control")).toContain("no-store");
    expect(res.headers.get("Pragma")).toBe("no-cache");
  });

  it("returns stable unauthorized and rate-limit diagnostic ids", async () => {
    const unauthorized = await jsonUnauthorized("/api/private").json();
    expect(unauthorized).toMatchObject({ code: "unauthorized", diagnostic_id: "route_unauthorized" });

    const limitedResponse = jsonRateLimited(1234, "/api/private");
    const limited = await limitedResponse.json();
    expect(limited).toMatchObject({ code: "rate_limited", diagnostic_id: "route_rate_limited" });
    expect(limited.details).toEqual({ retryAfterMs: 1234 });
    expect(limitedResponse.headers.get("Retry-After")).toBe("2");
  });
});