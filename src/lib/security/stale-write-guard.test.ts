import { describe, expect, it } from "vitest";
import {
  requireExpectedVersionForMutation,
  staleExpectedVersionResponse,
} from "@/lib/security/stale-write-guard";

describe("stale-write-guard", () => {
  it("requires an expected version header", async () => {
    const result = requireExpectedVersionForMutation(new Request("http://localhost/api/resource"), {
      route: "/api/resource",
      diagnosticPrefix: "resource",
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected missing version response");

    expect(result.response.status).toBe(409);
    await expect(result.response.json()).resolves.toMatchObject({
      code: "expected_version_required",
      diagnostic_id: "resource_expected_version_required",
      route: "/api/resource",
    });
  });

  it("accepts weak If-Match entity tags as expected versions", () => {
    const result = requireExpectedVersionForMutation(
      new Request("http://localhost/api/resource", {
        headers: { "if-match": 'W/"2026-01-01T00:00:00Z"' },
      }),
      {
        route: "/api/resource",
        diagnosticPrefix: "resource",
      }
    );

    expect(result).toEqual({
      ok: true,
      expectedVersion: "2026-01-01T00:00:00Z",
    });
  });

  it("returns deterministic stale-write conflicts", async () => {
    const response = staleExpectedVersionResponse({
      route: "/api/resource",
      diagnosticPrefix: "resource",
    });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      code: "stale_version",
      diagnostic_id: "resource_stale_version",
      route: "/api/resource",
    });
  });
});
