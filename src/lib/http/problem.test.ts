import { describe, expect, it } from "vitest";
import {
  SUPPORT_SAFE_PROBLEM_STATUSES,
  jsonBadRequest,
  jsonBadGateway,
  jsonConflict,
  jsonForbidden,
  jsonMethodNotAllowed,
  jsonNotFound,
  jsonPayloadTooLarge,
  jsonProblem,
  jsonRateLimited,
  jsonServiceUnavailable,
  jsonUnauthorized,
  jsonUnhandled,
  jsonUnprocessableEntity,
  jsonUnsupportedMediaType,
} from "./problem";

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
    expect(res.headers.get("Vary")).toContain("Cookie");
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

  it("covers representative support-safe status helpers", async () => {
    const responses = [
      jsonBadRequest("/api/example"),
      jsonUnauthorized("/api/example"),
      jsonForbidden("/api/example"),
      jsonNotFound("/api/example"),
      jsonMethodNotAllowed("/api/example", ["GET", "POST"]),
      jsonConflict("/api/example"),
      jsonPayloadTooLarge("/api/example"),
      jsonUnsupportedMediaType("/api/example"),
      jsonUnprocessableEntity("/api/example"),
      jsonRateLimited(1000, "/api/example"),
      jsonUnhandled("/api/example"),
      jsonBadGateway("/api/example"),
      jsonServiceUnavailable("/api/example"),
    ];

    const statuses = responses.map((response) => response.status);
    expect(statuses).toEqual([...SUPPORT_SAFE_PROBLEM_STATUSES]);

    for (const response of responses) {
      const body = await response.json();
      expect(body).toEqual(
        expect.objectContaining({
          error: expect.any(String),
          code: expect.stringMatching(/^[a-z0-9_]+$/),
          diagnostic_id: expect.stringMatching(/^route_[a-z0-9_]+$/),
          route: "/api/example",
        })
      );
      expect(response.headers.get("Cache-Control")).toContain("no-store");
      expect(response.headers.get("Pragma")).toBe("no-cache");
      expect(response.headers.get("Vary")).toContain("Cookie");
    }

    expect(responses[4].headers.get("Allow")).toBe("GET, POST");
  });

  it("redacts technical provider and stack details from problem error messages", async () => {
    const res = jsonProblem(500, {
      error: "duplicate key value violates unique constraint users_email_key\n    at node_modules/postgrest/index.js:1",
      code: "data_source_failed",
      diagnostic_id: "example_data_source_failed",
      route: "/api/example",
    });

    const body = await res.json();
    expect(body.error).toBe("Something went wrong. Please try again.");
    expect(body.code).toBe("data_source_failed");
    expect(body.diagnostic_id).toBe("example_data_source_failed");
  });

  it("redacts secret-bearing problem details and raw exception strings", async () => {
    const res = jsonProblem(502, {
      error: "Provider error: Authorization Bearer abcdefghijk123456789 while fetching https://storage.test/a?token=secret123456",
      code: "provider_failed",
      diagnostic_id: "provider_failed",
      details: {
        request_id: "req_1",
        authorization: "Bearer abcdefghijk123456789",
        signed_url: "https://storage.test/a?signature=private123456",
        nested: {
          provider_payload: { raw: "private" },
          stack: "Error: private\n    at private.js:1",
          sql: "select * from private_table",
        },
      },
    });

    const body = await res.json();
    const text = JSON.stringify(body);
    expect(body.error).toBe("Something went wrong. Please try again.");
    expect(text).toContain("req_1");
    expect(text).not.toContain("abcdefghijk");
    expect(text).not.toContain("private123456");
    expect(text).not.toContain("secret123456");
    expect(body.details?.nested).toEqual({ provider_payload: "[redacted]", stack: "[redacted]", sql: "[redacted]" });
  });
});
