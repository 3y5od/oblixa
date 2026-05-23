import { describe, expect, it } from "vitest";
import { rejectInvalidRouteParamEnums, rejectUnsafeRouteParams } from "@/lib/security/route-params";

describe("rejectUnsafeRouteParams", () => {
  it("returns null for safe path parameters", () => {
    expect(rejectUnsafeRouteParams({ id: "c1", action: "request-changes" }, ["id", "action"], "/api/example")).toBeNull();
  });

  it("returns problem JSON for unsafe path parameters", async () => {
    const response = rejectUnsafeRouteParams({ id: "c1\r\nX-Bad: yes" }, ["id"], "/api/example");
    expect(response).not.toBeNull();
    expect(response?.status).toBe(400);
    await expect(response?.json()).resolves.toMatchObject({
      code: "invalid_request",
      details: { reason: "invalid_route_param", param: "id" },
    });
  });

  it("returns problem JSON for unsupported enum path parameters", async () => {
    expect(rejectInvalidRouteParamEnums({ action: "approve" }, { action: ["approve", "reject"] }, "/api/example")).toBeNull();

    const response = rejectInvalidRouteParamEnums(
      { action: "delegate" },
      { action: ["approve", "reject"] },
      "/api/example"
    );
    expect(response).not.toBeNull();
    expect(response?.status).toBe(400);
    await expect(response?.json()).resolves.toMatchObject({
      code: "invalid_request",
      details: { reason: "invalid_route_param_enum", param: "action" },
    });
  });
});
