import { beforeEach, describe, expect, it, vi } from "vitest";

const captureException = vi.fn();
const captureMessage = vi.fn();

vi.mock("@sentry/nextjs", () => ({
  captureException,
  captureMessage,
}));

describe("observability sentry helpers", () => {
  beforeEach(() => {
    vi.resetModules();
    captureException.mockClear();
    captureMessage.mockClear();
    delete process.env.SENTRY_DSN;
    delete process.env.NEXT_PUBLIC_SENTRY_DSN;
  });

  it("captureServerException no-ops without server DSN", async () => {
    const { captureServerException } = await import("@/lib/observability/sentry");
    captureServerException(new Error("x"));
    expect(captureException).not.toHaveBeenCalled();
  });

  it("captureServerException forwards when SENTRY_DSN is set", async () => {
    process.env.SENTRY_DSN = "https://examplePublicKey@o0.ingest.sentry.io/0";
    const { captureServerException } = await import("@/lib/observability/sentry");
    const err = new Error("server");
    captureServerException(err);
    expect(captureException).toHaveBeenCalledWith(err, undefined);
  });

  it("captureServerMessage forwards when SENTRY_DSN is set", async () => {
    process.env.SENTRY_DSN = "https://examplePublicKey@o0.ingest.sentry.io/0";
    const { captureServerMessage } = await import("@/lib/observability/sentry");
    captureServerMessage("hello");
    expect(captureMessage).toHaveBeenCalledWith("hello", undefined);
  });

  it("captureClientException no-ops without client DSN", async () => {
    const { captureClientException } = await import("@/lib/observability/sentry");
    captureClientException(new Error("y"));
    expect(captureException).not.toHaveBeenCalled();
  });

  it("captureClientException forwards when NEXT_PUBLIC_SENTRY_DSN is set", async () => {
    process.env.NEXT_PUBLIC_SENTRY_DSN =
      "https://examplePublicKey@o0.ingest.sentry.io/0";
    const { captureClientException } = await import("@/lib/observability/sentry");
    const err = new Error("client");
    captureClientException(err);
    expect(captureException).toHaveBeenCalledWith(err, undefined);
  });
});
