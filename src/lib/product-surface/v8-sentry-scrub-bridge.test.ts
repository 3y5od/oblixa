import { describe, expect, it } from "vitest";
import { scrubSentryEvent } from "@/lib/observability/sentry-scrub";

describe("Sentry scrub vs secret-shaped fields (§19.2)", () => {
  it("redacts Authorization and Cookie request headers", () => {
    const event = {
      request: {
        headers: {
          Authorization: "Bearer secret-token",
          Cookie: "session=abc",
          "x-custom": "ok",
        },
      },
    };
    const out = scrubSentryEvent(event) as typeof event;
    expect(out.request.headers.Authorization).toBe("[redacted]");
    expect(out.request.headers.Cookie).toBe("[redacted]");
    expect(out.request.headers["x-custom"]).toBe("ok");
  });
});
