import { describe, expect, it, vi } from "vitest";
import { jsonContentTypeRejection } from "@/lib/security/json-content-type";
import {
  jsonWithRouteId,
  withApiRouteTelemetry,
} from "@/lib/observability/api-route-instrumentation";

describe("Epic 6 — api-route instrumentation", () => {
  it("forwards invocation and stamps route telemetry headers", async () => {
    const handler = vi.fn().mockResolvedValue(new Response("ok", { status: 201 }));
    const wrapped = withApiRouteTelemetry("/api/test", handler);
    const res = await wrapped(
      new Request("http://localhost/api/test", {
        headers: { "x-request-id": "req-1", "x-correlation-id": "corr-1" },
      })
    );
    expect(handler).toHaveBeenCalledOnce();
    expect(res).toBeInstanceOf(Response);
    expect(await res.text()).toBe("ok");
    expect(res.status).toBe(201);
    expect(res.headers.get("x-oblixa-route-id")).toBe("/api/test");
    expect(res.headers.get("x-request-id")).toBe("req-1");
    expect(res.headers.get("x-correlation-id")).toBe("corr-1");
    expect(res.headers.get("x-oblixa-route-status-class")).toBe("2xx");
    expect(res.headers.get("Cache-Control")).toContain("no-store");
    expect(Number(res.headers.get("x-oblixa-route-duration-ms"))).toBeGreaterThanOrEqual(0);
  });

  it("converts thrown errors to stable diagnostic JSON", async () => {
    const wrapped = withApiRouteTelemetry("/api/test", async (_request: Request) => {
      void _request;
      throw new TypeError("boom");
    });
    const res = await wrapped(new Request("http://localhost/api/test", { headers: { "x-request-id": "req-2" } }));
    await expect(res.json()).resolves.toMatchObject({
      error: "Unexpected server error",
      code: "unexpected_server_error",
      diagnostic_id: "route_unhandled_error",
      route: "/api/test",
      request_id: "req-2",
    });
    expect(res.status).toBe(500);
    expect(res.headers.get("x-oblixa-error-class")).toBe("TypeError");
  });

  it("jsonWithRouteId attaches route header", () => {
    const res = jsonWithRouteId("demo", { ok: true });
    expect(res.headers.get("x-oblixa-route-id")).toBe("demo");
  });
});

describe("Epic 15 — HTTP semantics helpers", () => {
  it("rejects non-JSON Content-Type for JSON bodies", () => {
    const req = new Request("http://localhost/api/x", {
      method: "POST",
      headers: { "content-type": "application/xml" },
      body: "<x/>",
    });
    const rej = jsonContentTypeRejection(req);
    expect(rej?.status).toBe(415);
  });

  it("rejects missing Content-Type for JSON bodies", () => {
    const req = new Request("http://localhost/api/x", { method: "POST", body: "{}" });
    expect(jsonContentTypeRejection(req)?.status).toBe(415);
  });
});
