import { describe, it, expect, vi, beforeEach } from "vitest";

const { init, captureRouterTransitionStart } = vi.hoisted(() => ({
  init: vi.fn(),
  captureRouterTransitionStart: vi.fn(),
}));

vi.mock("@sentry/nextjs", () => ({
  init,
  replayIntegration: vi.fn(() => ({})),
  captureRouterTransitionStart,
}));

vi.mock("@/lib/observability/sentry-release", () => ({ getSentryRelease: () => "test-rel" }));
vi.mock("@/lib/observability/sentry-scrub", () => ({ scrubSentryEvent: (e: unknown) => e }));
vi.mock("@/lib/observability/sentry-sampling", () => ({ parseSampleRate: () => 1 }));

describe("instrumentation-client", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it("initializes Sentry and re-exports captureRouterTransitionStart when DSN is set", async () => {
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "https://public@o1.ingest.sentry.io/1");
    const Sentry = await import("@sentry/nextjs");
    const mod = await import("./instrumentation-client");
    expect(mod.onRouterTransitionStart).toBe(Sentry.captureRouterTransitionStart);
    expect(Sentry.init).toHaveBeenCalled();
  });
});
