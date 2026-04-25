import { describe, expect, it } from "vitest";
import { interpretHttpMutationFailure } from "@/lib/v9-api-client-errors";

describe("interpretHttpMutationFailure (V9 §17.2 / §22)", () => {
  it("maps 413 to payload_too_large with stable copy for upload/export surfaces", () => {
    const r = interpretHttpMutationFailure({ status: 413 });
    expect(r.kind).toBe("payload_too_large");
    expect(r.userMessage.toLowerCase()).toMatch(/large|reduce|rows|files|columns/);
    expect(r.retryAppropriate).toBe(false);
  });

  it("maps 429 to rate_limited with retry guidance", () => {
    const r = interpretHttpMutationFailure({ status: 429 });
    expect(r.kind).toBe("rate_limited");
    expect(r.retryAppropriate).toBe(true);
  });

  it("passes server messages through describeRecoverableMutationError for unknown statuses", () => {
    const r = interpretHttpMutationFailure({ status: 503, message: "upstream timeout" });
    expect(r.kind).toBe("unknown");
    expect(r.retryAppropriate).toBe(true);
  });
});
