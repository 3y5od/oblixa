import { describe, expect, it } from "vitest";
import { describeRecoverableMutationError } from "./recoverable-mutation-error";

describe("describeRecoverableMutationError", () => {
  it("maps auth failures to session guidance", () => {
    expect(describeRecoverableMutationError("Not authenticated")).toContain("session");
  });

  it("maps network failures to retry guidance", () => {
    expect(describeRecoverableMutationError("TypeError: Failed to fetch")).toContain("connection");
  });

  it("maps timeout and conflict signals to non-duplicating recovery guidance", () => {
    expect(describeRecoverableMutationError("Request timed out")).toContain("longer than expected");
    expect(describeRecoverableMutationError("Conflict: already processing")).toContain(
      "already being processed"
    );
  });

  it("passes through unknown errors unchanged", () => {
    expect(describeRecoverableMutationError("Title is required")).toBe("Title is required");
  });

  it("maps rate limit signals to the shared V9 capacity copy", () => {
    expect(describeRecoverableMutationError("HTTP 429 Too Many Requests")).toContain("rate limited");
  });
});
