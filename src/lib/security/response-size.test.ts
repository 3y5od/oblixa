import { describe, expect, it } from "vitest";

import { encodedJsonSizeBytes, jsonResponseWithSizeLimit } from "./response-size";

describe("response-size", () => {
  it("measures encoded JSON bytes", () => {
    expect(encodedJsonSizeBytes({ ok: true })).toBe(new TextEncoder().encode('{"ok":true}').byteLength);
  });

  it("returns a safe problem response when the payload exceeds the limit", async () => {
    const res = jsonResponseWithSizeLimit(
      { rows: ["x".repeat(20)] },
      { maxBytes: 10, route: "/api/example", headers: { "Cache-Control": "private, no-store" } }
    );

    expect(res.status).toBe(413);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    await expect(res.json()).resolves.toMatchObject({
      code: "response_too_large",
      diagnostic_id: "api_response_size_limit_exceeded",
      route: "/api/example",
    });
  });
});
